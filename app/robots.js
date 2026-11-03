// Evita que los crawlers gasten invocaciones de funciones en el panel
// de administración y en la API de reseñas.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
  };
}
