import "../../styles/globals.css";
import "../../styles/admin.css";

export const metadata = {
  title: "Ventas · Le Chic",
  robots: { index: false, follow: false },
};

/** Root layout propio de /sales (sin Navbar ni Footer del sitio público). */
export default function SalesRootLayout({ children }) {
  return (
    <html lang="es">
      <body className="admin-body">{children}</body>
    </html>
  );
}
