import Link from "next/link";
import SalesCabecera from "../../../../components/sales/SalesCabecera";
import Paginacion from "../../../../components/admin/Paginacion";
import TablaProductosVentas from "../../../../components/sales/TablaProductosVentas";
import { IconoBuscar, IconoMas } from "../../../../components/admin/Iconos";
import { requerirUsuarioVentas } from "../actions";
import { getInventario } from "../../../../lib/inventario";
import { contarPendientes } from "../../../../lib/ventas";

export const metadata = { title: "Productos · Ventas Le Chic" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 30;

export default async function ProductosVentasPage({ searchParams }) {
  const usuario = await requerirUsuarioVentas();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim().slice(0, 60) : "";
  const filtro = params?.filtro === "alertas" ? "alertas" : "todas";
  const pedida = Math.max(1, parseInt(params?.pagina, 10) || 1);

  let { variantes, total } = await getInventario({ q, filtro, pagina: pedida, porPagina: POR_PAGINA });
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(pedida, totalPaginas);
  if (pagina !== pedida) ({ variantes } = await getInventario({ q, filtro, pagina, porPagina: POR_PAGINA }));
  const pendientes = await contarPendientes();

  // Solo datos simples (sin costo) hacia el componente cliente.
  const filas = variantes.map((v) => ({
    id: String(v.id),
    producto_id: v.producto_id,
    producto: v.producto,
    variante: v.variante,
    sku: v.sku,
    marca: v.marca,
    imagen: v.imagen,
    activo: v.activo,
    stock: v.stock,
    stock_actual: v.stock_actual === null ? null : Number(v.stock_actual),
    stock_minimo: Number(v.stock_minimo),
    precio: v.precio === null ? null : Number(v.precio),
    precio_oferta: v.precio_oferta === null ? null : Number(v.precio_oferta),
  }));

  const href = (extra = {}) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, filtro: filtro === "alertas" ? "alertas" : "", ...extra })) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `/sales/productos?${s}` : "/sales/productos";
  };

  return (
    <>
      <SalesCabecera usuario={usuario} activa="productos" pendientes={pendientes} />
      <main className="admin-main">
        <div className="form-grid">
          {params?.creado === "1" && <div className="mensaje-ok">Producto creado correctamente.</div>}
          {params?.guardado === "1" && <div className="mensaje-ok">Producto actualizado correctamente.</div>}

          <div className="admin-barra">
            <form method="get" action="/sales/productos" className="admin-barra-buscar">
              <IconoBuscar size={18} />
              <input type="search" name="q" defaultValue={q} placeholder="Buscar por producto, variante o SKU..." />
              {filtro === "alertas" && <input type="hidden" name="filtro" value="alertas" />}
            </form>
            {filtro === "alertas" ? (
              <Link href={href({ filtro: "" })} className="chip-filtro" title="Quitar filtro">
                Stock bajo ✕
              </Link>
            ) : (
              <Link href={href({ filtro: "alertas" })} className="btn-ico-texto">
                Ver stock bajo
              </Link>
            )}
            <div className="admin-barra-der">
              <Link href="/sales/productos/nuevo" className="btn-ico-texto primario">
                <IconoMas /> Agregar producto
              </Link>
            </div>
          </div>

          <h1 className="admin-titulo" style={{ fontSize: "1.4rem" }}>
            Productos ({total}) · más recientes primero
          </h1>

          <TablaProductosVentas filas={filas} />

          <Paginacion
            pagina={pagina}
            totalPaginas={totalPaginas}
            hrefAnterior={href({ pagina: pagina - 1 })}
            hrefSiguiente={href({ pagina: pagina + 1 })}
          />
        </div>
      </main>
    </>
  );
}
