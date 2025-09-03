'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type OtpType = 'magiclink' | 'recovery' | 'email_change';
function asOtpType(t: string | null): OtpType | null {
  if (t === 'magiclink' || t === 'recovery' || t === 'email_change') return t;
  return null;
}

function CallbackInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [msg, setMsg] = useState('Обрабатываем вход...');
  const [debug, setDebug] = useState<{ href: string; search: string; hash: string } | null>(null);

  const debugMode = useMemo(() => sp.get('debug') === '1', [sp]);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      if (!cancelled) {
        setMsg('Готово. Перенаправляем в кабинет...');
        router.replace('/dashboard/');
      }
    };

    (async () => {
      try {
        // --- 1) Токены во фрагменте (#access_token & #refresh_token) ---
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          return finish();
        }

        // --- 2) ?code=... (PKCE) ---
        const code = sp.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          return finish();
        }

        // --- 3) ?token_hash=&type=magiclink (классический Magic Link) ---
        const token_hash = sp.get('token_hash');
        const typeParam = asOtpType(sp.get('type'));
        if (token_hash && typeParam) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: typeParam });
          if (error) throw error;
          return finish();
        }

        // --- Нет токенов: показываем диагностику ---
        const info = {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
        };
        setDebug(info);

        setMsg('Откройте эту страницу по ссылке из письма. Прямой вход сюда не нужен.');
      } catch (unknownErr) {
        const message = unknownErr instanceof Error ? unknownErr.message : 'неизвестная ошибка';
        if (!cancelled) setMsg('Ошибка входа: ' + message);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 740, margin: '48px auto', padding: '0 16px',
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Arial,sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Echo — вход</h1>
      <p style={{ color: '#555' }}>{msg}</p>

      {(debugMode || debug) && (
        <div style={{
          marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 12,
          fontSize: 13, color: '#222', background: '#fafafa'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Диагностика</div>
          <div><b>location.href:</b> <code>{debug?.href || (typeof window !== 'undefined' ? window.location.href : '')}</code></div>
          <div><b>search:</b> <code>{debug?.search || (typeof window !== 'undefined' ? window.location.search : '')}</code></div>
          <div><b>hash:</b> <code>{debug?.hash || (typeof window !== 'undefined' ? window.location.hash : '')}</code></div>
          <p style={{ marginTop: 8, color: '#555' }}>
            Если здесь нет <code>#access_token</code> и <code>#refresh_token</code>,
            значит почтовый клиент/редиректор их вырезал. В таком случае
            кликните по ссылке правой кнопкой → <b>«Копировать адрес ссылки»</b> и
            вставьте адрес вручную в ту же вкладку браузера.
          </p>
        </div>
      )}

      <p style={{ marginTop: 12 }}>Вернуться на <a href="/login/">/login/</a></p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 740, margin: '48px auto', padding: '0 16px',
          fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Arial,sans-serif' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Echo — вход</h1>
          <p style={{ color: '#555' }}>Обрабатываем вход…</p>
          <p style={{ marginTop: 12 }}>Вернуться на <a href="/login/">/login/</a></p>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
