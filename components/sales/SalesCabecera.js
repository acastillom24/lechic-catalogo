import Link from "next/link";
import { cerrarSesionVentas } from "../../app/(sales)/sales/actions";

/** Cabecera compartida de /sales con las dos pestañas: Ventas y Productos. */
export default function SalesCabecera({ usuario, activa, pendientes = 0 }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <span className="admin-topbar-marca">Ventas Le Chic</span>
        <nav className="admin-nav">
          <Link href="/sales" className={activa === "ventas" ? "activo" : undefined}>
            Ventas{pendientes > 0 ? ` (${pendientes})` : ""}
          </Link>
          <Link href="/sales/productos" className={activa === "productos" ? "activo" : undefined}>
            Productos
          </Link>
          <span style={{ opacity: 0.7 }}>{usuario.usuario}</span>
        </nav>
        <form action={cerrarSesionVentas} className="admin-logout">
          <button type="submit">Cerrar sesión</button>
        </form>
      </div>
    </header>
  );
}
