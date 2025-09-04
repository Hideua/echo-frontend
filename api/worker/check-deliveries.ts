// api/worker/check-deliveries.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
  RESEND_API_KEY,
  FROM_EMAIL = 'Echo <no-reply@echo.local>',
  CRON_SECRET = '',
} = process.env;

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}
function authOk(req: VercelRequest) {
  const h = (req.headers['authorization'] as string) || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return !!(m && m[1] && CRON_SECRET && m[1] === CRON_SECRET);
}
function nowIso() { return new Date().toISOString(); }

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Resend HTTP ${resp.status}: ${t}`);
  }
  return resp.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST' });
  if (!authOk(req)) return json(res, 401, { ok: false, error: 'Unauthorized' });

  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!CRON_SECRET) missing.push('CRON_SECRET');
  if (missing.length) return json(res, 500, { ok: false, error: 'Missing env', missing });

  const { createClient } = await import('@supabase/supabase-js'); // ESM динамически
  const supa = createClient(SUPABASE_URL as string, SERVICE_ROLE as string);

  const result = { ok: true, now: nowIso(), picked: 0, sent: 0, failed: 0, skipped: 0, errors: [] as Array<Record<string, unknown>> };

  try {
    const { data: pendings, error: pendErr } = await supa
      .from('deliveries')
      .select('id, user_id, message_id, recipient_id, status, updated_at')
      .eq('status', 'pending')
      .order('updated_at', { ascending: true })
      .limit(50);
    if (pendErr) return json(res, 500, { ok: false, step: 'fetch-pending', error: pendErr.message });

    for (const d of pendings ?? []) {
      try {
        const [{ data: msg, error: msgErr }, { data: rec, error: recErr }] = await Promise.all([
          supa.from('messages')
              .select('id, user_id, title, body_text, media_key, deliver_at, lifecheck_enabled')
              .eq('id', (d as any).message_id).single(),
          supa.from('recipients')
              .select('id, email, name')
              .eq('id', (d as any).recipient_id).single(),
        ]);
        if (msgErr) throw new Error(`msg: ${msgErr.message}`);
        if (recErr) throw new Error(`rec: ${recErr.message}`);

        const now = Date.now();

        let dueByTime = false;
        if (msg?.deliver_at) {
          const t = new Date(msg.deliver_at).getTime();
          if (!Number.isNaN(t) && t <= now) dueByTime = true;
        }

        let dueByLifecheck = false;
        if (msg?.lifecheck_enabled) {
          const { data: lc, error: lcErr } = await supa
            .from('lifecheck_settings')
            .select('last_ping_at, grace_minutes')
            .eq('user_id', (d as any).user_id)
            .maybeSingle();
          if (lcErr) throw new Error(`lifecheck: ${lcErr.message}`);

          if (!lc || !lc.last_ping_at) {
            dueByLifecheck = true;
          } else {
            const last = new Date(lc.last_ping_at).getTime();
            const graceMs = (Number(lc.grace_minutes ?? 4320)) * 60 * 1000;
            if (!Number.isNaN(last) && now - last >= graceMs) dueByLifecheck = true;
          }
        }

        if (!dueByTime && !dueByLifecheck) { result.skipped++; continue; }

        const { data: picked, error: pickErr } = await supa
          .from('deliveries')
          .update({ status: 'processing', updated_at: nowIso(), last_error: null })
          .eq('id', (d as any).id).eq('status', 'pending')
          .select('id').single();
        if (pickErr || !picked) { result.skipped++; continue; }
        result.picked++;

        let mediaLine = '';
        if (msg?.media_key) {
          const { data: signed, error: signErr } = await supa.storage
            .from('echo-uploads')
            .createSignedUrl(msg.media_key, 60 * 60 * 24 * 7);
          mediaLine = signErr
            ? `\n\n[Вложение недоступно: ${signErr.message}]`
            : `\n\nAttachment:\n${signed?.signedUrl}`;
        }

        const subject = `Echo • ${msg?.title ?? 'Message'}`;
        const text =
          (msg?.body_text ? `${msg.body_text}\n\n` : '') +
          `— This message was delivered by Echo.` +
          mediaLine;

        await sendEmail((rec as any).email, subject, text);

        const { error: updErr } = await supa
          .from('deliveries')
          .update({ status: 'sent', updated_at: nowIso(), last_error: null })
          .eq('id', (d as any).id);
        if (updErr) throw new Error(`update-sent: ${updErr.message}`);

        result.sent++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ id: (d as any).id, error: e?.message || String(e) });
        await supa
          .from('deliveries')
          .update({ status: 'failed', updated_at: nowIso(), last_error: String(e?.message || e).slice(0, 1000) })
          .eq('id', (d as any).id);
      }
    }

    return json(res, 200, result);
  } catch (e: any) {
    return json(res, 500, { ok: false, fatal: e?.message || String(e) });
  }
}
