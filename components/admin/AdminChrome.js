"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "../../app/(admin)/admin/actions";

const ENLACES = [
  ["/admin/dashboard", "Dashboard", false],
  ["/admin", "Productos", true],
  ["/admin/ventas", "Ventas", false],
  ["/admin/asistencias", "Asistencias", false],
  ["/admin/resenas", "Reseñas", false],
  ["/admin/reclamos", "Reclamos", false],
  ["/admin/integraciones", "Integraciones", false],
  ["/admin/configuracion", "Configuración", false],
];

/**
 * Envuelve las páginas de /admin con una barra superior (título,
 * navegación y botón de cerrar sesión). En /admin/login no se
 * muestra: esa página tiene su propia pantalla completa y, además,
 * en ese punto todavía no hay sesión que cerrar.
 */
export default function AdminChrome({ children, reclamos = { abiertos: 0, vencidos: 0 } }) {
  const pathname = usePathname();
  const esLogin = pathname === "/admin/login";
  const barraRef = useRef(null);

  // La barra del panel queda fija al hacer scroll; su alto (puede ocupar dos líneas) se publica para que las barras
  // siguientes (menú de Configuración, subpestañas, barra del producto) queden apiladas justo debajo.
  useEffect(() => {
    const el = barraRef.current;
    if (!el) return undefined;
    const publicar = () => document.documentElement.style.setProperty("--admin-topbar-h", `${el.offsetHeight}px`);
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--admin-topbar-h");
    };
  }, [esLogin]);

  if (esLogin) return children;

  // Activo: coincidencia exacta, o prefijo salvo que exista un enlace más específico.
  const activo = (href, exacto) =>
    pathname === href ||
    (!exacto &&
      pathname.startsWith(href + "/") &&
      !ENLACES.some(([h]) => h !== href && h.startsWith(href + "/") && pathname.startsWith(h)));

  return (
    <>
      <header className="admin-topbar" ref={barraRef}>
        <div className="admin-topbar-inner">
          <span className="admin-topbar-marca">Panel Le Chic</span>
          <nav className="admin-nav">
            {ENLACES.map(([href, texto, exacto]) => (
              <Link key={href} href={href} className={activo(href, exacto) ? "activo" : undefined}>
                {texto}
                {href === "/admin/reclamos" && reclamos.abiertos > 0 && (
                  <span
                    className={reclamos.vencidos ? "chip-saga aviso" : "chip-saga ok"}
                    style={{ marginLeft: 6 }}
                    title={reclamos.vencidos ? `${reclamos.vencidos} con plazo vencido` : "Reclamos abiertos"}
                  >
                    {reclamos.abiertos}
                  </span>
                )}
              </Link>
            ))}
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
