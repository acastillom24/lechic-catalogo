import Link from "next/link";
import { CATEGORIAS_REVISION } from "../../lib/saga-revision";

/**
 * Filtro por categoría de la revisión de SAGA en los pendientes, fijo como en Seller Center (Todos, Contenido,
 * Precio, Multimedia, Compliance, Configuración Seller Center). Siempre se muestran todas; solo el número sale de
 * los datos (`conteo.todos`, `conteo.contenido`, …) y se oculta cuando una categoría no tiene pendientes.
 * `href(clave)` arma el enlace conservando el resto de filtros.
 */
export default function CategoriasRevision({ activa, conteo, href }) {
  const items = [["", "Todos", conteo.todos || 0], ...CATEGORIAS_REVISION.map(([k, t]) => [k, t, conteo[k] || 0])];
  return (
    <nav className="chips-periodo" aria-label="Categoría de la revisión de SAGA">
      {items.map(([clave, texto, n]) => (
        <Link key={clave || "todos"} href={href(clave)} className={activa === clave ? "chip-filtro activo" : "chip-filtro"}>
          {texto}{n > 0 && <> <span className="chip-saga">{n}</span></>}
        </Link>
      ))}
    </nav>
  );
}
