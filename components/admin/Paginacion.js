import Link from "next/link";

/** Paginación compartida (misma que Productos). Los enlaces llegan calculados. */
export default function Paginacion({ pagina, totalPaginas, hrefAnterior, hrefSiguiente }) {
  if (totalPaginas <= 1) return null;
  return (
    <nav className="admin-paginacion">
      {pagina > 1 ? (
        <Link href={hrefAnterior} className="btn-admin">← Anterior</Link>
      ) : (
        <span className="btn-admin" style={{ opacity: 0.4 }}>← Anterior</span>
      )}
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      {pagina < totalPaginas ? (
        <Link href={hrefSiguiente} className="btn-admin">Siguiente →</Link>
      ) : (
        <span className="btn-admin" style={{ opacity: 0.4 }}>Siguiente →</span>
      )}
    </nav>
  );
}
