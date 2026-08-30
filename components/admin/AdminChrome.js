"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "../../app/(admin)/admin/actions";

/**
 * Envuelve las páginas de /admin con una barra superior (título,
 * navegación y botón de cerrar sesión). En /admin/login no se
 * muestra: esa página tiene su propia pantalla completa y, además,
 * en ese punto todavía no hay sesión que cerrar.
 */
export default function AdminChrome({ children }) {
  const pathname = usePathname();
  const esLogin = pathname === "/admin/login";

  if (esLogin) return children;

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <span className="admin-topbar-marca">Panel Le Chic</span>
          <nav className="admin-nav">
            <Link href="/admin">Productos</Link>
            <Link href="/admin/productos/nuevo">Nuevo producto</Link>
            <Link href="/admin/importar">Importar CSV</Link>
            <Link href="/" target="_blank">
              Ver sitio ↗
            </Link>
          </nav>
          <form action={cerrarSesion} className="admin-logout">
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </>
  );
}
