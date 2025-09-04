// api/worker/diag.js
module.exports = async (req, res) => {
  const json = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') return json(405, { ok: false, error: 'Use GET' });

  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    FROM_EMAIL: !!process.env.FROM_EMAIL,
  };

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, env, note: 'Add envs in Vercel → Settings → Environment Variables.' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supa.from('messages').select('id').limit(1);
    if (error) return json(500, { ok: false, env, db: 'error', error: error.message });
    return json(200, { ok: true, env, db: 'ok' });
  } catch (e) {
    return json(500, { ok: false, env, fatal: e && e.message ? e.message : String(e) });
  }
};
