import Link from "next/link";
import { CATEGORIAS_REVISION } from "../../lib/saga-revision";

/**
 * Filtro por categoría de la revisión de SAGA en los pendientes (como en Seller Center: Todos, Contenido,
 * Precio, Multimedia, Compliance, Configuración), con el conteo de cada una. `href(clave)` arma el enlace
 * conservando el resto de filtros; las categorías sin filas no se muestran (salvo la activa).
 */
export default function CategoriasRevision({ activa, conteo, href }) {
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);
  const items = [["", "Todos", total], ...CATEGORIAS_REVISION.map(([k, t]) => [k, t, conteo[k] || 0])].filter(
    ([k, , n]) => k === "" || n > 0 || k === activa
  );
  return (
    <nav className="chips-periodo" aria-label="Categoría de la revisión de SAGA">
      {items.map(([clave, texto, n]) => (
        <Link key={clave || "todos"} href={href(clave)} className={activa === clave ? "chip-filtro activo" : "chip-filtro"}>
          {texto} <span className="chip-saga">{n}</span>
        </Link>
      ))}
    </nav>
  );
}
