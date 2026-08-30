/**
 * Not-found "global" para rutas que no calzan en ningún grupo de rutas
 * ((site) o (admin)). Next.js exige que este archivo tenga su propio
 * <html>/<body> porque no cuelga de ningún root layout. El 404 normal
 * del sitio público vive en app/(site)/not-found.js.
 */
export default function GlobalNotFound() {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "100px 20px" }}>
        <h1>Página no encontrada</h1>
        <p>
          <a href="/">Volver al inicio</a>
        </p>
      </body>
    </html>
  );
}
