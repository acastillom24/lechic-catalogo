import { getConfigSitio } from "../../../../lib/config";
import { getOpcionesSaga } from "../../../../lib/saga-opciones";
import { getCuentas } from "../../../../lib/saga-sync";
import { getOpcionesVentas } from "../../../../lib/ventas-opciones";
import { getConfigMarcas } from "../../../../lib/marcas-config";
import PestanasWebPanel from "../../../../components/admin/PestanasWebPanel";
import StockConfig from "../../../../components/admin/StockConfig";
import { getConfigStock } from "../../../../lib/stock-config";
import VentasConfig from "../../../../components/admin/VentasConfig";
import { listarUsuariosVentas } from "../../../../lib/ventas";
import { getPermisosGuardados, permisosDe } from "../../../../lib/ventas-permisos";
import { listarColaboradores } from "../../../../lib/asistencias";
import ConfiguracionForm from "../../../../components/admin/ConfiguracionForm";
import SagaPanel from "../../../../components/admin/SagaPanel";
import IntegracionWeb from "../../../../components/admin/IntegracionWeb";
import EquipoPanel from "../../../../components/admin/EquipoPanel";
import { LISTA_DE_CAMPO } from "../../../../lib/campos-web";

export const metadata = { title: "Configuración · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [config, usuarios, colaboradores, opcionesSaga, cuentasSaga, opcionesVentas, cfgMarcas, permisosGuardados, configStock] = await Promise.all([
    getConfigSitio(),
    listarUsuariosVentas(),
    listarColaboradores(),
    getOpcionesSaga(),
    getCuentas(),
    getOpcionesVentas(),
    getConfigMarcas(),
    getPermisosGuardados(),
    getConfigStock(),
  ]);
  const categoriasWeb = cfgMarcas.categorias.map(({ slug, nombre }) => ({ slug, nombre }));
  // Las subpestañas Web y SAGA editan las mismas equivalencias: al cambiar lo guardado se vuelven a montar con los datos nuevos.
  const huella = String(
    [...JSON.stringify([opcionesSaga.equivalencias, opcionesSaga.atributosCategoria, opcionesSaga.catalogoWeb, cfgMarcas.marcas])].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
  );
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Configuración</h1>
      </div>
      <ConfiguracionForm
        inicial={config}
        extras={{
          // Las marcas de la web viven con las pestañas de la web; con qué marca de cada plataforma coinciden se define en esa plataforma.
          pestanasweb: (
            <PestanasWebPanel
              pestanasCrudas={cfgMarcas.pestanasCrudas}
              categorias={cfgMarcas.categorias}
              marcas={cfgMarcas.marcas}
              pestanasMarcas={cfgMarcas.pestanas.map(({ slug, nombre }) => ({ slug, nombre }))}
            />
          ),
          equipo: <EquipoPanel usuarios={usuarios} permisos={Object.fromEntries(usuarios.map((u) => [u.id, permisosDe(permisosGuardados, u.id)]))} colaboradores={colaboradores} />,
          ventas: <VentasConfig opciones={opcionesVentas} />,
          inventario: <StockConfig config={configStock} />,
          // Integraciones: lo que hay que configurar para conectar la web con cada plataforma (Web, SAGA y las que se agreguen).
          integraciones: [
            {
              id: "web",
              nombre: "Web",
              formId: "form-integracion-web",
              contenido: (
                <IntegracionWeb
                  key={`web-${huella}`}
                  categoriasWeb={categoriasWeb}
                  plataformas={opcionesSaga.equivalencias.plataformas}
                  categoriasSaga={opcionesSaga.categorias}
                  equivalencias={opcionesSaga.equivalencias}
                  catalogo={opcionesSaga.catalogoWeb}
                  porCategoria={opcionesSaga.atributosCategoria}
                  listas={Object.fromEntries(Object.values(LISTA_DE_CAMPO).map((k) => [k, opcionesSaga[k] || []]))}
                />
              ),
            },
            {
              id: "saga",
              nombre: "SAGA",
              formId: "form-saga-opciones",
              contenido: (
                <SagaPanel key={`saga-${huella}`} cuentas={cuentasSaga} opciones={opcionesSaga} categoriasWeb={categoriasWeb} marcas={cfgMarcas.marcas} />
              ),
            },
            // Plataformas agregadas: por ahora solo equivalencias (categorías en la subpestaña Web y marcas en la pestaña Marcas).
            ...opcionesSaga.equivalencias.plataformas.slice(1).map((pl) => ({
              id: pl.id,
              nombre: pl.nombre,
              contenido: (
                <section className="admin-card form-grid">
                  <h2>{pl.nombre}</h2>
                  <small style={{ color: "var(--gris)" }}>
                    Las equivalencias de {pl.nombre} se configuran desde aquí cuando se integre (sus categorías elegirán con qué categorías de la web
                    equivalen) y sus marcas. La conexión y el envío de datos a esta
                    plataforma se habilitan cuando se integre.
                  </small>
                </section>
              ),
            })),
          ],
                }}
      />
    </div>
  );
}
