// next.config.js
/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === '1';

module.exports = {
  // В статическом режиме (для FTP) делаем export; на Vercel — серверные функции.
  output: isStatic ? 'export' : undefined,

  // Безопасно оставить экспериментальные/прочие опции при необходимости:
  experimental: {
    typedRoutes: true,
  },

  // Если используешь basePath/assetPrefix — добавь сюда при необходимости.
};
