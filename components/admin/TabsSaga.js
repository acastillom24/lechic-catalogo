import Link from "next/link";

/** Pestañas de la sección SAGA (Errores / Pendientes) con el conteo de cada una. */
export default function TabsSaga({ activo, conteo }) {
  const pestanas = [
    ["error", "Errores", conteo.error],
    ["pendiente", "Pendientes", conteo.pendiente],
  ];
  return (
    <nav className="admin-tabs" aria-label="Estado de la sincronización con SAGA">
      {pestanas.map(([clave, texto, n]) => (
        <Link
          key={clave}
          href={clave === "error" ? "/admin/integraciones/saga" : `/admin/integraciones/saga?estado=${clave}`}
          className={activo === clave ? "admin-tab activo" : "admin-tab"}
        >
          {texto} <span className={`chip-saga ${clave === "error" && n ? "aviso" : ""}`}>{n}</span>
        </Link>
      ))}
    </nav>
  );
}
