import Link from "next/link";
import { listarReclamos, contarReclamos, ETIQUETA_ESTADO } from "../../../../lib/reclamos";
import Paginacion from "../../../../components/admin/Paginacion";
import { IconoBuscar, IconoCerrar } from "../../../../components/admin/Iconos";

export const metadata = { title: "Reclamos · Panel Le Chic" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 25;
const ESTADOS = [
  ["", "Todos"],
  ["pendiente", "Pendientes"],
  ["en_proceso", "En proceso"],
  ["atendido", "Atendidos"],
  ["vencidos", "Vencidos"],
];
const TIPOS = [
  ["", "Reclamos y quejas"],
  ["reclamo", "Reclamos"],
  ["queja", "Quejas"],
];

const dia = (f) => new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

export default async function AdminReclamosPage({ searchParams }) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 60) : "";
  const estado = ESTADOS.some(([k]) => k && k === params?.estado) ? params.estado : "";
  const tipo = TIPOS.some(([k]) => k && k === params?.tipo) ? params.tipo : "";
  const paginaPedida = Math.max(1, parseInt(params?.pagina, 10) || 1);

  let datos = { reclamos: [], total: 0 };
  let falloTabla = false;
  try {
    datos = await listarReclamos({ estado, tipo, q, pagina: paginaPedida, porPagina: POR_PAGINA });
  } catch {
    falloTabla = true; // la tabla aún no existe: falta aplicar el esquema
  }
  const resumen = await contarReclamos();
  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));
  const pagina = Math.min(paginaPedida, paginas);

  const href = (extra = {}) => {
    const u = new URLSearchParams();
    const base = { q, estado, tipo, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `/admin/reclamos?${s}` : "/admin/reclamos";
  };

  const plazo = (r) => {
    if (r.estado === "atendido") return <span className="pill">Atendido</span>;
    if (r.vencido) return <span className="pill agotado">Vencido hace {Math.abs(r.dias_restantes)} d</span>;
    if (r.dias_restantes <= 3) return <span className="pill agotado">Vence en {r.dias_restantes} d</span>;
    return <span className="pill cerrada">{r.dias_restantes} d restantes</span>;
  };

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="solo-lector">Reclamos ({datos.total})</h1>
        <Link href="/libro-de-reclamaciones" target="_blank" className="btn-admin">Ver formulario público ↗</Link>
      </div>

      {falloTabla && (
        <div className="mensaje-error">
          No se pudo leer la tabla de reclamos. Puede que falte una actualización de la base de datos; contacta a soporte técnico.
        </div>
      )}

      <div className="admin-card" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div><strong style={{ fontSize: "1.4rem" }}>{resumen.abiertos}</strong><br /><small>abiertos</small></div>
        <div>
          <strong style={{ fontSize: "1.4rem", color: resumen.vencidos ? "#b3261e" : undefined }}>{resumen.vencidos}</strong>
          <br /><small>con plazo vencido</small>
        </div>
        <small style={{ color: "var(--gris)", alignSelf: "center" }}>
          El plazo legal de respuesta es de 15 días hábiles desde el registro (no se descuentan feriados).
        </small>
      </div>

      <div className="admin-barra">
        <form method="get" action="/admin/reclamos" className="admin-barra-buscar">
          {estado && <input type="hidden" name="estado" value={estado} />}
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por código, nombre, documento, correo o pedido..." />
        </form>
        <div className="chips-periodo">
          {ESTADOS.map(([k, etiqueta]) => (
            <Link key={k || "todos"} href={href({ estado: k, pagina: "" })} className={estado === k ? "chip-per activo" : "chip-per"}>
              {etiqueta}
            </Link>
          ))}
        </div>
        <div className="chips-periodo">
          {TIPOS.map(([k, etiqueta]) => (
            <Link key={k || "todos"} href={href({ tipo: k, pagina: "" })} className={tipo === k ? "chip-per activo" : "chip-per"}>
              {etiqueta}
            </Link>
          ))}
        </div>
        {q && (
          <Link href={href({ q: "", pagina: "" })} className="chip-filtro" title="Quitar búsqueda">
            &quot;{q}&quot; <IconoCerrar size={14} />
          </Link>
        )}
      </div>

      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Consumidor</th>
              <th>Bien</th>
              <th>Estado</th>
              <th>Plazo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {datos.reclamos.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/reclamos/${r.id}`}><strong>{r.codigo}</strong></Link></td>
                <td>{dia(r.created_at.toISOString ? r.created_at.toISOString() : r.created_at)}</td>
                <td>{r.tipo === "queja" ? "Queja" : "Reclamo"}</td>
                <td style={{ overflowWrap: "anywhere" }}>{r.nombre}<br /><small style={{ color: "var(--gris)" }}>{r.email}</small></td>
                <td style={{ maxWidth: 240, overflowWrap: "anywhere" }}>{r.descripcion_bien}</td>
                <td>{ETIQUETA_ESTADO[r.estado]}</td>
                <td>{plazo(r)}<br /><small style={{ color: "var(--gris)" }}>hasta {dia(r.fecha_limite)}</small></td>
                <td><Link href={`/admin/reclamos/${r.id}`} className="btn-admin">Abrir</Link></td>
              </tr>
            ))}
            {datos.reclamos.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  {q || estado || tipo ? "No hay reclamos que coincidan." : "Aún no hay reclamos registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacion pagina={pagina} totalPaginas={paginas} hrefAnterior={href({ pagina: pagina - 1 })} hrefSiguiente={href({ pagina: pagina + 1 })} />
    </div>
  );
}
