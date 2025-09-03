/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

// Временные логи, чтобы убедиться, что .env.local подхватился на билде
console.log('ECHO ENV URL =', process.env.NEXT_PUBLIC_SUPABASE_URL || '(missing)');
console.log(
  'ECHO ENV ANON =',
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '(missing)').slice(0, 8) + '...'
);

export default nextConfig;
