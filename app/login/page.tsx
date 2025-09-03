'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [left, setLeft] = useState(0);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (left > 0) return;

    setErr(null);
    if (!email || !email.includes('@')) {
      setErr('Введите корректный email.');
      return;
    }

    try {
      const origin =
        (process.env.NEXT_PUBLIC_SITE_ORIGIN || window.location.origin).replace(/\/$/, '');
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback/?email=${encodeURIComponent(email)}`,
        },
      });
      if (error) throw error;
      setSent(true);
      setLeft(15);
    } catch (unknownErr: unknown) {
      const message =
        unknownErr instanceof Error ? unknownErr.message : 'Ошибка отправки ссылки.';
      setErr(message);
    }
  };

  const onEmail = (e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: '0 16px',
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Arial,sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px' }}>Вход по ссылке</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={onEmail}
          required
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d0d0d0',
            marginBottom: 12, outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={left > 0}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #111',
            background: '#111', color: '#fff', cursor: left > 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {left > 0 ? `Подождите ${left}с` : 'Получить ссылку'}
        </button>
      </form>
      {sent && <p style={{ color: '#444', marginTop: 10 }}>
        Проверьте почту и откройте ссылку <b>в этой же вкладке</b>.
      </p>}
      {err && <p style={{ color: '#c00', marginTop: 10 }}>{err}</p>}
      <p style={{ marginTop: 16 }}>
        Вернуться на <a href="/dashboard/">/dashboard/</a>
      </p>
    </div>
  );
}
