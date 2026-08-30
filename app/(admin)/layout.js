import "../../styles/globals.css";
import "../../styles/admin.css";

export const metadata = {
  title: "Panel · Le Chic",
  robots: { index: false, follow: false },
};

/**
 * Root layout separado para /admin: no incluye el Navbar ni el
 * Footer públicos del sitio (ver app/(site)/layout.js). Next.js
 * permite varios "root layouts" usando grupos de rutas — cada uno
 * pone su propio <html>/<body>.
 */
export default function AdminRootLayout({ children }) {
  return (
    <html lang="es">
      <body className="admin-body">{children}</body>
    </html>
  );
}
