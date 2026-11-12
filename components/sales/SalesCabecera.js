import Link from "next/link";
import { cerrarSesionVentas } from "../../app/(sales)/operaciones/actions";

/** Cabecera compartida de /operaciones con las pestañas: Ventas, Productos e Integraciones. */
export default function SalesCabecera({ usuario, activa, pendientes = 0 }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <span className="admin-topbar-marca">Le Chic · Operaciones</span>
        <nav className="admin-nav">
          {(!usuario.permisos || usuario.permisos.ventas) && (
            <Link href="/operaciones" className={activa === "ventas" ? "activo" : undefined}>
              Ventas{pendientes > 0 ? ` (${pendientes})` : ""}
            </Link>
          )}
          {(!usuario.permisos || usuario.permisos.productos) && (
            <Link href="/operaciones/productos" className={activa === "productos" ? "activo" : undefined}>
              Productos
            </Link>
          )}
          {(!usuario.permisos || usuario.permisos.integraciones) && (
            <Link href="/operaciones/integraciones" className={activa === "integraciones" ? "activo" : undefined}>
              Integraciones
            </Link>
          )}
          <span style={{ opacity: 0.7 }}>{usuario.usuario}</span>
        </nav>
        <form action={cerrarSesionVentas} className="admin-logout">
          <button type="submit">Cerrar sesión</button>
        </form>
      </div>
    </header>
  );
}
