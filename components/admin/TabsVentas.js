import Link from "next/link";

/** Pestañas de la sección Ventas: todas las ventas / pendientes de cobro (con su conteo). */
export default function TabsVentas({ activo, pendientes }) {
  return (
    <nav className="admin-tabs" aria-label="Secciones de ventas">
      <Link href="/admin/ventas" className={activo === "ventas" ? "admin-tab activo" : "admin-tab"}>
        Ventas
      </Link>
      <Link href="/admin/ventas/pendientes" className={activo === "pendientes" ? "admin-tab activo" : "admin-tab"}>
        Pendientes <span className={`chip-saga ${pendientes ? "aviso" : ""}`}>{pendientes}</span>
      </Link>
    </nav>
  );
}
