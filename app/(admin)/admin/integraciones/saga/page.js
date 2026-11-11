import { listarUsuariosVentas } from "../../../../../lib/ventas";
import { after } from "next/server";
import { drenarCola } from "../../../../../lib/saga-cola";
import { getCuentas, getSincronizacionesSaga, contarSincronizacionesSaga, contarRevisionSaga } from "../../../../../lib/saga-sync";
import { getOpcionesSaga } from "../../../../../lib/saga-opciones";
import { CATEGORIAS_REVISION } from "../../../../../lib/saga-revision";
import { stockParaSaga } from "../../../../../lib/saga-mapeo";
import CategoriasRevision from "../../../../../components/admin/CategoriasRevision";
import TabsSaga from "../../../../../components/admin/TabsSaga";
import FiltrosSincronizaciones from "../../../../../components/admin/FiltrosSincronizaciones";
import TablaSincronizacionesSaga from "../../../../../components/admin/TablaSincronizacionesSaga";
import Paginacion from "../../../../../components/admin/Paginacion";

export const metadata = { title: "SAGA · Panel Le Chic" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BASE = "/admin/integraciones/saga";
const texto = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : "");

export default async function SagaPage({ searchParams }) {
  const params = await searchParams;
  // Sin demorar la página: envía lo que SAGA dejó en espera por su límite de 1 feed cada 2 minutos por cuenta.
  after(() => drenarCola());
  const estado = ["pendiente", "publicado"].includes(params?.estado) ? params.estado : "error";
  const pagina = Math.max(1, parseInt(params?.pagina, 10) || 1);
  // Filtros: usuario del panel /operaciones (vacío = todos, "__admin" = admin o automático), cuenta y búsqueda.
  const sincronizados = estado === "publicado";
  const filtros = {
    usuario: texto(params?.usuario), cuenta: texto(params?.cuenta), q: texto(params?.q),
    // Vinculación y origen solo se filtran en «Sincronizados».
    accion: sincronizados ? texto(params?.accion) : "", origen: sincronizados && ["creado", "vinculado"].includes(params?.origen) ? params.origen : "",
  };
  const categoria = CATEGORIAS_REVISION.some(([k]) => k === params?.categoria) && estado === "pendiente" ? params.categoria : "";
  const [usuarios, cuentas, op] = await Promise.all([listarUsuariosVentas(), getCuentas(), getOpcionesSaga()]);

  // Solo lee lo guardado: consultar a SAGA es una acción explícita («Consultar estado» sobre filas elegidas).
  const [{ filas, total, porPagina }, conteo, porCategoria] = await Promise.all([
    getSincronizacionesSaga({ estado, pagina, categoria, ...filtros }),
    contarSincronizacionesSaga(filtros),
    estado === "pendiente" ? contarRevisionSaga(filtros) : Promise.resolve({}),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // Fechas como texto y el stock que se publicaría en SAGA (colchón por stock mínimo), calculado aquí.
  const datos = filas.map((f) => ({
    ...f,
    revision_fecha: f.revision_fecha ? new Date(f.revision_fecha).toISOString() : null,
    proximo_envio: f.proximo_envio ? new Date(f.proximo_envio).toISOString() : null,
    variante_id: String(f.variante_id),
    proximo_intento: f.proximo_intento ? new Date(f.proximo_intento).toISOString() : null,
    ultimo_sync: f.ultimo_sync ? new Date(f.ultimo_sync).toISOString() : null,
    stock_saga: stockParaSaga(f),
  }));

  // Enlaces que conservan estado y filtros; `cambios` sobrescribe (un valor vacío quita el filtro).
  const href = (cambios = {}) => {
    const v = { ...filtros, ...cambios };
    const q = new URLSearchParams();
    if (estado !== "error") q.set("estado", estado);
    for (const k of ["q", "cuenta", "usuario", "accion", "origen"]) if (v[k]) q.set(k, v[k]);
    const cat = "categoria" in cambios ? cambios.categoria : categoria;
    if (cat) q.set("categoria", cat);
    if (cambios.pagina > 1) q.set("pagina", String(cambios.pagina));
    const s = q.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };
  const extraTabs = new URLSearchParams(Object.entries(filtros).filter(([k, v]) => v && ["usuario", "cuenta", "q"].includes(k))).toString();

  const opcionesAccion = op.acciones.map((a) => ({ id: a.id, nombre: a.nombre }));
  const nombreAccion = (id) => opcionesAccion.find((a) => a.id === id)?.nombre || id;
  const nombreCuenta = cuentas.find((c) => c.alias === filtros.cuenta)?.nombre || filtros.cuenta;
  const chips = [
    filtros.usuario && { texto: `Usuario: ${filtros.usuario === "__admin" ? "Admin / automático" : filtros.usuario}`, href: href({ usuario: "" }) },
    filtros.accion && { texto: `Vinculación: ${nombreAccion(filtros.accion)}`, href: href({ accion: "" }) },
    filtros.origen && { texto: `Origen: ${filtros.origen === "creado" ? "Creado desde la web" : "Vinculado a SAGA"}`, href: href({ origen: "" }) },
    filtros.cuenta && { texto: `Cuenta: ${nombreCuenta}`, href: href({ cuenta: "" }) },
    filtros.q && { texto: `"${filtros.q}"`, href: href({ q: "" }) },
  ].filter(Boolean);


  return (
    <div className="form-grid">
      <FiltrosSincronizaciones action={BASE} estado={estado} filtros={filtros} cuentas={cuentas} usuarios={usuarios} acciones={sincronizados ? opcionesAccion.map((a) => [a.id, a.nombre]) : null} chips={chips} />
      <TabsSaga activo={estado} conteo={conteo} extra={extraTabs} />
      {estado === "pendiente" && <CategoriasRevision activa={categoria} conteo={porCategoria} href={(c) => href({ categoria: c })} />}
      <TablaSincronizacionesSaga key={estado} filas={datos} estado={estado} mostrarUsuario opcionesAccion={opcionesAccion} />
      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        hrefAnterior={href({ pagina: pagina - 1 })}
        hrefSiguiente={href({ pagina: pagina + 1 })}
      />
    </div>
  );
}
