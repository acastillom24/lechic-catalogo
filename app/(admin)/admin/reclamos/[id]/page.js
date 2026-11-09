import Link from "next/link";
import { notFound } from "next/navigation";
import { getReclamo, ETIQUETA_ESTADO } from "../../../../../lib/reclamos";
import SeguimientoReclamo from "../../../../../components/admin/SeguimientoReclamo";

export const metadata = { title: "Reclamo · Panel Le Chic" };
export const dynamic = "force-dynamic";

const fechaHora = (f) => new Date(f).toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" });
const dia = (f) => new Date(String(f instanceof Date ? f.toISOString() : f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

function Fila({ k, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <>
      <dt style={{ color: "var(--gris)" }}>{k}</dt>
      <dd style={{ margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{children}</dd>
    </>
  );
}

export default async function AdminReclamoPage({ params }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const r = await getReclamo(n);
  if (!r) notFound();

  const lista = { display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", margin: 0 };

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">
          {r.tipo === "queja" ? "Queja" : "Reclamo"} {r.codigo}
        </h1>
        <Link href="/admin/reclamos" className="btn-admin">← Volver</Link>
      </div>

      <div className="admin-card form-grid">
        <p>
          <span className={r.estado === "atendido" ? "pill" : "pill cerrada"}>{ETIQUETA_ESTADO[r.estado]}</span>{" "}
          Registrado el {fechaHora(r.created_at)} · Plazo de respuesta: hasta el <strong>{dia(r.fecha_limite)}</strong>
          {" · "}
          Copia al consumidor: {r.copia_enviada ? "enviada" : "no enviada"}
        </p>
      </div>

      <div className="admin-card form-grid">
        <h2>Consumidor</h2>
        <dl style={lista}>
          <Fila k="Nombre">{r.nombre}</Fila>
          <Fila k="Documento">{`${r.tipo_documento} ${r.documento}`}</Fila>
          <Fila k="Domicilio">{r.domicilio}</Fila>
          <Fila k="Teléfono">{r.telefono}</Fila>
          <Fila k="Correo"><a href={`mailto:${r.email}`}>{r.email}</a></Fila>
          {r.es_menor && <Fila k="Padre, madre o apoderado">{r.apoderado}</Fila>}
        </dl>
      </div>

      <div className="admin-card form-grid">
        <h2>Bien contratado</h2>
        <dl style={lista}>
          <Fila k="Tipo">{r.tipo_bien === "servicio" ? "Servicio" : "Producto"}</Fila>
          <Fila k="Descripción">{r.descripcion_bien}</Fila>
          <Fila k="Monto reclamado">{r.monto !== null && r.monto !== undefined ? `S/ ${Number(r.monto).toFixed(2)}` : ""}</Fila>
          <Fila k="N.º de pedido">{r.numero_pedido}</Fila>
        </dl>
      </div>

      <div className="admin-card form-grid">
        <h2>Detalle</h2>
        <dl style={lista}>
          <Fila k="Detalle">{r.detalle}</Fila>
          <Fila k="Pedido del consumidor">{r.pedido_consumidor}</Fila>
        </dl>
      </div>

      <SeguimientoReclamo reclamo={r} />
    </div>
  );
}
