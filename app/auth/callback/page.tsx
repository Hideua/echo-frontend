'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallbackPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [msg, setMsg] = useState('Обрабатываем вход...');
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      try {
        const code = sp.get('code');                 // PKCE вариант
        const token_hash = sp.get('token_hash');     // Magic Link
        const type = sp.get('type');                 // magiclink | recovery

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
          if (error) throw error;
        } else {
          setMsg('Откройте эту страницу по ссылке из письма. Прямой вход сюда не нужен.');
          return;
        }

        setMsg('Готово. Перенаправляем в кабинет...');
        router.replace('/dashboard/');
      } catch (e: any) {
        setMsg('Ошибка входа: ' + (e?.message || 'неизвестно'));
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px',
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Arial,sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Echo — вход</h1>
      <p style={{ color: '#555' }}>{msg}</p>
      <p style={{ marginTop: 12 }}>Вернуться на <a href="/login/">/login/</a></p>
    </div>
  );
}
