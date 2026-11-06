import Link from "next/link";
import { query } from "../../../../lib/db";
import { alternarResena, eliminarResena } from "../actions";
import { IconoBuscar, IconoCerrar, IconoOjo, IconoOjoOculto, IconoPapelera } from "../../../../components/admin/Iconos";

export const metadata = { title: "Reseñas · Panel Le Chic" };
export const dynamic = "force-dynamic";

const FILTROS = [
  ["todas", "Todas"],
  ["visibles", "Visibles"],
  ["ocultas", "Ocultas"],
];

export default async function AdminResenasPage({ searchParams }) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 60) : "";
  const filtro = FILTROS.some(([k]) => k === params?.filtro) ? params.filtro : "todas";

  const where = [];
  const valores = [];
  if (filtro === "visibles") where.push("aprobado");
  if (filtro === "ocultas") where.push("not aprobado");
  if (q) {
    valores.push(`%${q}%`);
    where.push(`(producto_id ilike $1 or nombre ilike $1 or comentario ilike $1)`);
  }
  const resenas = await query(
    `select id, producto_id, nombre, estrellas, comentario, aprobado, created_at
     from resenas ${where.length ? "where " + where.join(" and ") : ""}
     order by created_at desc limit 200`,
    valores
  );

  const href = (extra = {}) => {
    const u = new URLSearchParams();
    const base = { q, filtro: filtro === "todas" ? "" : filtro, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `/admin/resenas?${s}` : "/admin/resenas";
  };

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Reseñas ({resenas.length})</h1>
      </div>

      <div className="admin-barra">
        <form method="get" action="/admin/resenas" className="admin-barra-buscar">
          {filtro !== "todas" && <input type="hidden" name="filtro" value={filtro} />}
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por producto, autor o comentario..." />
        </form>
        <div className="chips-periodo">
          {FILTROS.map(([k, etiqueta]) => (
            <Link key={k} href={href({ filtro: k === "todas" ? "" : k })} className={filtro === k ? "chip-per activo" : "chip-per"}>
              {etiqueta}
            </Link>
          ))}
        </div>
        {q && (
          <Link href={href({ q: "" })} className="chip-filtro" title="Quitar búsqueda">
            &quot;{q}&quot; <IconoCerrar size={14} />
          </Link>
        )}
      </div>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Autor</th>
              <th>★</th>
              <th>Comentario</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resenas.map((r) => (
              <tr key={r.id} style={r.aprobado ? undefined : { opacity: 0.6 }}>
                <td className="celda-producto">{r.producto_id}</td>
                <td>{r.nombre}</td>
                <td>{r.estrellas}</td>
                <td style={{ maxWidth: 360, overflowWrap: "anywhere" }}>{r.comentario}</td>
                <td>
                  <span className={r.aprobado ? "pill" : "pill cerrada"}>{r.aprobado ? "Visible" : "Oculta"}</span>
                </td>
                <td>
                  <div className="acciones-fila">
                    <form action={alternarResena.bind(null, r.id, !r.aprobado)}>
                      <button
                        className="btn-ico"
                        title={r.aprobado ? "Ocultar" : "Mostrar"}
                        aria-label={r.aprobado ? "Ocultar reseña" : "Mostrar reseña"}
                      >
                        {r.aprobado ? <IconoOjoOculto /> : <IconoOjo />}
                      </button>
                    </form>
                    <form action={eliminarResena.bind(null, r.id)}>
                      <button className="btn-ico" title="Eliminar" aria-label="Eliminar reseña">
                        <IconoPapelera />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {resenas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  {q || filtro !== "todas" ? "No hay reseñas que coincidan." : "Aún no hay reseñas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
