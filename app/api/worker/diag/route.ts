// app/api/worker/diag/route.ts
// Быстрая проверка окружения и доступа к БД. GET.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    FROM_EMAIL: !!process.env.FROM_EMAIL,
  };

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, env, note: 'Set missing envs in Vercel project (echo-frontend).' }, { status: 500 });
    }
    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    // простой пинг к таблице (под RLS service_role всё ок, пустой результат — тоже ок)
    const { error } = await supa.from('messages').select('id').limit(1);
    if (error) return NextResponse.json({ ok: false, env, db: 'error', error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, env, db: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, env, fatal: e?.message || String(e) }, { status: 500 });
  }
}
