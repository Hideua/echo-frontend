// api/worker/diag.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET' });

  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    FROM_EMAIL: !!process.env.FROM_EMAIL,
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { ok: false, env, note: 'Add envs in Vercel → Settings → Environment Variables.' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js'); // ESM динамически
    const supa = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    const { error } = await supa.from('messages').select('id').limit(1);
    if (error) return json(res, 500, { ok: false, env, db: 'error', error: error.message });
    return json(res, 200, { ok: true, env, db: 'ok' });
  } catch (e: any) {
    return json(res, 500, { ok: false, env, fatal: e?.message || String(e) });
  }
}
