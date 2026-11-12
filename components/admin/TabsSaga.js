import Link from "next/link";

/** Pestañas de la sección SAGA (Errores / Pendientes) con el conteo de cada una. */
export default function TabsSaga({ activo, conteo, base = "/admin/integraciones/saga", extra = "", ocultar = [] }) {
  const pestanas = [
    ["error", "Errores", conteo.error],
    ["pendiente", "Pendientes", conteo.pendiente],
    ["publicado", "Sincronizados", conteo.publicado ?? 0],
  ].filter(([clave]) => !ocultar.includes(clave)); // `ocultar` quita las pestañas que el usuario no debe ver
  // `extra` = parámetros a conservar (p. ej. "usuario=ana").
  const hrefDe = (clave) => {
    const q = [clave === "error" ? "" : `estado=${clave}`, extra].filter(Boolean).join("&");
    return q ? `${base}?${q}` : base;
  };
  return (
    <nav className="admin-tabs" aria-label="Estado de la sincronización con SAGA">
      {pestanas.map(([clave, texto, n]) => (
        <Link
          key={clave}
          href={hrefDe(clave)}
          className={activo === clave ? "admin-tab activo" : "admin-tab"}
        >
          {texto} <span className={`chip-saga ${clave === "error" && n ? "aviso" : ""}`}>{n}</span>
        </Link>
      ))}
    </nav>
  );
}
