/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Permite imágenes locales en /public y externas si algún día usas un CDN.
    // Agrega dominios remotos aquí si mueves las fotos a un servicio externo.
    remotePatterns: [],
  },
};

module.exports = nextConfig;
