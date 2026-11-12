import TabsSaga from "../../../../../components/admin/TabsSaga";
import CategoriasRevision from "../../../../../components/admin/CategoriasRevision";
import FiltrosSincronizaciones from "../../../../../components/admin/FiltrosSincronizaciones";
import TablaSincronizacionesSaga from "../../../../../components/admin/TablaSincronizacionesSaga";
import Paginacion from "../../../../../components/admin/Paginacion";
import {
  requerirUsuarioVentas, reintentarStockSagaVentas, reintentarTodoStockSagaVentas,
  consultarEstadoSagaVentas, aplicarAccionSagaVentas, cambiarAccionSagaVentas,
} from "../../actions";
import { after } from "next/server";
import { drenarCola } from "../../../../../lib/saga-cola";
import { getCuentas, getSincronizacionesSaga, contarSincronizacionesSaga, contarRevisionSaga } from "../../../../../lib/saga-sync";
import { getOpcionesSaga } from "../../../../../lib/saga-opciones";
import { CATEGORIAS_REVISION } from "../../../../../lib/saga-revision";
import { stockParaSaga } from "../../../../../lib/saga-mapeo";

export const metadata = { title: "SAGA · Le Chic · Operaciones" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BASE = "/operaciones/integraciones/saga";
const texto = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "");

/** Misma vista que /admin/integraciones/saga, limitada a las sincronizaciones que originó el usuario. */
export default async function SagaOperacionesPage({ searchParams }) {
  const usuario = await requerirUsuarioVentas("integraciones");
  const params = await searchParams;
  // Sin demorar la página: envía lo que SAGA dejó en espera por su límite de 1 feed cada 2 minutos por cuenta.
  after(() => drenarCola());
  // «Sincronizados» solo si el usuario lo tiene habilitado (Configuración → Equipo); si no, cae en Errores.
  const verSincronizados = usuario.permisos.sincronizados;
  const estado = ["pendiente", ...(verSincronizados ? ["publicado", "sin_publicar"] : [])].includes(params?.estado) ? params.estado : "error";
  const pagina = Math.max(1, parseInt(params?.pagina, 10) || 1);
  const sincronizados = estado === "publicado";
  const filtros = {
    cuenta: texto(params?.cuenta), q: texto(params?.q),
    // Vinculación y origen solo se filtran en «Sincronizados».
    accion: sincronizados ? texto(params?.accion) : "", origen: sincronizados && ["creado", "vinculado"].includes(params?.origen) ? params.origen : "",
  };
  const categoria = CATEGORIAS_REVISION.some(([k]) => k === params?.categoria) && estado === "pendiente" ? params.categoria : "";
  // El usuario sale siempre de la sesión, nunca de la URL.
  const alcance = { ...filtros, usuario: usuario.usuario };
  const [cuentas, op] = await Promise.all([getCuentas(), getOpcionesSaga()]);

  // Solo lee lo guardado: consultar a SAGA es una acción explícita sobre las filas elegidas.
  const [{ filas, total, porPagina }, conteo, porCategoria] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina, categoria, ...alcance }),
    contarSincronizacionesSaga(alcance),
    estado === "pendiente" ? contarRevisionSaga(alcance) : Promise.resolve({}),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const datos = filas.map((f) => ({
    ...f,
    variante_id: String(f.variante_id),
    proximo_intento: f.proximo_intento ? new Date(f.proximo_intento).toISOString() : null,
    ultimo_sync: f.ultimo_sync ? new Date(f.ultimo_sync).toISOString() : null,
    revision_fecha: f.revision_fecha ? new Date(f.revision_fecha).toISOString() : null,
    venta_fecha: f.venta_fecha ? new Date(f.venta_fecha).toISOString() : null,
    proximo_envio: f.proximo_envio ? new Date(f.proximo_envio).toISOString() : null,
    stock_saga: stockParaSaga(f),
  }));

  const href = (cambios = {}) => {
    const v = { ...filtros, ...cambios };
    const q = new URLSearchParams();
    if (estado !== "error") q.set("estado", estado);
    for (const k of ["q", "cuenta", "accion", "origen"]) if (v[k]) q.set(k, v[k]);
    const cat = "categoria" in cambios ? cambios.categoria : categoria;
    if (cat) q.set("categoria", cat);
    if (cambios.pagina > 1) q.set("pagina", String(cambios.pagina));
    const s = q.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };
  const extraTabs = new URLSearchParams(Object.entries(filtros).filter(([k, v]) => v && ["cuenta", "q"].includes(k))).toString();

  const opcionesAccion = op.acciones.map((a) => ({ id: a.id, nombre: a.nombre }));
  const nombreAccion = (id) => opcionesAccion.find((a) => a.id === id)?.nombre || id;
  const nombreCuenta = cuentas.find((c) => c.alias === filtros.cuenta)?.nombre || filtros.cuenta;
  const chips = [
    filtros.accion && { texto: `Vinculación: ${nombreAccion(filtros.accion)}`, href: href({ accion: "" }) },
    filtros.origen && { texto: `Origen: ${filtros.origen === "creado" ? "Creado desde la web" : "Vinculado a SAGA"}`, href: href({ origen: "" }) },
    filtros.cuenta && { texto: `Cuenta: ${nombreCuenta}`, href: href({ cuenta: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);

  return (
    <div className="form-grid">
      <FiltrosSincronizaciones action={BASE} estado={estado} filtros={filtros} cuentas={cuentas} acciones={sincronizados ? opcionesAccion.map((a) => [a.id, a.nombre]) : null} chips={chips} />
      <TabsSaga activo={estado} conteo={conteo} base={BASE} extra={extraTabs} ocultar={verSincronizados ? [] : ["publicado", "sin_publicar"]} />
      {estado === "pendiente" && <CategoriasRevision activa={categoria} conteo={porCategoria} href={(c) => href({ categoria: c })} />}
      <TablaSincronizacionesSaga
        key={estado}
        filas={datos}
        estado={estado}
        rutaProducto="/operaciones/productos"
        opcionesAccion={opcionesAccion}
        acciones={{
          reintentar: reintentarStockSagaVentas,
          reintentarTodo: reintentarTodoStockSagaVentas,
          consultar: consultarEstadoSagaVentas,
          aplicar: aplicarAccionSagaVentas,
          cambiarTipo: cambiarAccionSagaVentas,
        }}
      />
      <Paginacion pagina={pagina} totalPaginas={totalPaginas} hrefAnterior={href({ pagina: pagina - 1 })} hrefSiguiente={href({ pagina: pagina + 1 })} />
    </div>
  );
}
