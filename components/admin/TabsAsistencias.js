import Link from "next/link";

/** Pestañas de la sección Asistencias (Registro / Reporte de pago). */
export default function TabsAsistencias({ activo }) {
  return (
    <nav className="admin-tabs" aria-label="Secciones de asistencias">
      <Link href="/admin/asistencias" className={activo === "registro" ? "admin-tab activo" : "admin-tab"}>
        Registro diario
      </Link>
      <Link href="/admin/asistencias/reporte" className={activo === "reporte" ? "admin-tab activo" : "admin-tab"}>
        Reporte de pago
      </Link>
    </nav>
  );
}
