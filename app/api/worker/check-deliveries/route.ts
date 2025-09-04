// app/api/worker/check-deliveries/route.ts
// Next.js 15 App Router (Node runtime). Доставка pending по времени и LifeCheck.
// Auth: Authorization: Bearer <CRON_SECRET>. Вернёт подробный JSON (без «FUNCTION_INVOCATION_FAILED»).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Echo <no-reply@echo.local>';
const CRON_SECRET = process.env.CRON_SECRET || '';

type DeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed';
type Delivery = { id: string; user_id: string; message_id: string; recipient_id: string; status: DeliveryStatus; updated_at: string; };
type Message = { id: string; user_id: string; title: string; body_text: string | null; media_key: string | null; deliver_at: string | null; lifecheck_enabled: boolean; };
type Recipient = { id: string; email: string; name: string | null; };
type LifecheckRow = { last_ping_at: string | null; grace_minutes: number | null; };

function nowIso() { return new Date().toISOString(); }
function authOk(req: NextRequest) { const h = req.headers.get('authorization') || ''; const m = /^Bearer\s+(.+)$/i.exec(h); return !!(m && m[1] && CRON_SECRET && m[1] === CRON_SECRET); }

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

export async function POST(req: NextRequest) {
  try {
    if (!authOk(req)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!RESEND_API_KEY) missing.push('RESEND_API_KEY');
    if (!CRON_SECRET) missing.push('CRON_SECRET');

    if (missing.length) {
      return NextResponse.json(
        { ok: false, error: 'Missing env', missing },
        { status: 500 },
      );
    }

    const supa = createClient(SUPABASE_URL!, SERVICE_ROLE!);

    const result = { ok: true, now: nowIso(), picked: 0, sent: 0, failed: 0, skipped: 0, errors: [] as Array<Record<string, unknown>> };

    // 1) Берём pending
    const { data: pendings, error: pendErr } = await supa
      .from('deliveries')
      .select('id, user_id, message_id, recipient_id, status, updated_at')
      .eq('status', 'pending')
      .order('updated_at', { ascending: true })
      .limit(50);

    if (pendErr) return NextResponse.json({ ok: false, step: 'fetch-pending', error: pendErr.message }, { status: 500 });

    for (const d of (pendings ?? []) as Delivery[]) {
      try {
        // 2) Дотянуть сущности
        const [{ data: msg, error: msgErr }, { data: rec, error: recErr }] = await Promise.all([
          supa.from('messages')
            .select('id, user_id, title, body_text, media_key, deliver_at, lifecheck_enabled')
            .eq('id', d.message_id).single<Message>(),
          supa.from('recipients')
            .select('id, email, name')
            .eq('id', d.recipient_id).single<Recipient>(),
        ]);
        if (msgErr) throw new Error(`msg: ${msgErr.message}`);
        if (recErr) throw new Error(`rec: ${recErr.message}`);

        // 3) Триггеры
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
            .eq('user_id', d.user_id)
            .maybeSingle<LifecheckRow>();
          if (lcErr) throw new Error(`lifecheck: ${lcErr.message}`);

          if (!lc || !lc.last_ping_at) {
            dueByLifecheck = true;
          } else {
            const last = new Date(lc.last_ping_at).getTime();
            const graceMs = ((lc.grace_minutes ?? 4320) as number) * 60 * 1000;
            if (!Number.isNaN(last) && now - last >= graceMs) dueByLifecheck = true;
          }
        }

        if (!dueByTime && !dueByLifecheck) { result.skipped++; continue; }

        // 4) pending -> processing
        const { data: picked, error: pickErr } = await supa
          .from('deliveries')
          .update({ status: 'processing', updated_at: nowIso(), last_error: null })
          .eq('id', d.id).eq('status', 'pending')
          .select('id').single();
        if (pickErr || !picked) { result.skipped++; continue; }
        result.picked++;

        // 5) Письмо (+ ссылка)
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

        await sendEmail((rec as Recipient).email, subject, text);

        // 6) sent
        const { error: updErr } = await supa
          .from('deliveries')
          .update({ status: 'sent', updated_at: nowIso(), last_error: null })
          .eq('id', d.id);
        if (updErr) throw new Error(`update-sent: ${updErr.message}`);

        result.sent++;
      } catch (e: any) {
        result.failed++;
        result.errors.push({ id: d.id, error: e?.message || String(e) });
        await supa
          .from('deliveries')
          .update({ status: 'failed', updated_at: nowIso(), last_error: String(e?.message || e).slice(0, 1000) })
          .eq('id', d.id);
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    // самый внешний catch — чтобы НЕ было FUNCTION_INVOCATION_FAILED
    return NextResponse.json({ ok: false, fatal: e?.message || String(e) }, { status: 500 });
  }
}
