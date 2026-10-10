import { supabaseServer } from "../../../../lib/supabaseServer";
import { alternarResena, eliminarResena } from "../actions";

export const metadata = { title: "Reseñas · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function AdminResenasPage() {
  const { data } = await supabaseServer()
    .from("resenas")
    .select("id, producto_id, nombre, estrellas, comentario, aprobado, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const resenas = data || [];

  return (
    <div className="form-grid">
      <h1 className="admin-titulo">Reseñas ({resenas.length})</h1>
      <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Autor</th>
              <th>★</th>
              <th>Comentario</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resenas.map((r) => (
              <tr key={r.id} style={r.aprobado ? undefined : { opacity: 0.5 }}>
                <td>{r.producto_id}</td>
                <td>{r.nombre}</td>
                <td>{r.estrellas}</td>
                <td style={{ maxWidth: 360, overflowWrap: "anywhere" }}>{r.comentario}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <form action={alternarResena.bind(null, r.id, !r.aprobado)} style={{ display: "inline" }}>
                    <button className="btn-admin">{r.aprobado ? "Ocultar" : "Mostrar"}</button>
                  </form>{" "}
                  <form action={eliminarResena.bind(null, r.id)} style={{ display: "inline" }}>
                    <button className="btn-admin peligro">Eliminar</button>
                  </form>
                </td>
              </tr>
            ))}
            {resenas.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                  Aún no hay reseñas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
