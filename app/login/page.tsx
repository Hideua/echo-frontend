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
    } catch (e: any) {
      setErr(e?.message || 'Ошибка отправки ссылки.');
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
          onChange=
