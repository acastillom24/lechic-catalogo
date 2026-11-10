import "../../styles/globals.css";
import "../../styles/admin.css";

export const metadata = {
  title: "Operaciones · Le Chic",
  robots: { index: false, follow: false },
};

/** Root layout propio de /operaciones (sin Navbar ni Footer del sitio público). */
export default function SalesRootLayout({ children }) {
  return (
    <html lang="es">
      <body className="admin-body">{children}</body>
    </html>
  );
}
