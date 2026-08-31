/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Permite imágenes locales en /public y externas si algún día usas un CDN.
    // Agrega dominios remotos aquí si mueves las fotos a un servicio externo.
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      // Vercel limita el cuerpo de una función serverless a 4.5 MB; el
      // panel /admin sube las imágenes una por una (nunca todas juntas en
      // un solo request), así que este límite es por foto, no por lote.
      bodySizeLimit: "4mb",
    },
  },
};

module.exports = nextConfig;
