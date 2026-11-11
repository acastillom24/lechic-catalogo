import { getConfigSitio } from "../../../../lib/config";
import { getOpcionesSaga } from "../../../../lib/saga-opciones";
import { getCuentas } from "../../../../lib/saga-sync";
import { getOpcionesVentas } from "../../../../lib/ventas-opciones";
import { getConfigMarcas } from "../../../../lib/marcas-config";
import MarcasConfig from "../../../../components/admin/MarcasConfig";
import PestanasConfig from "../../../../components/admin/PestanasConfig";
import VentasConfig from "../../../../components/admin/VentasConfig";
import { listarUsuariosVentas } from "../../../../lib/ventas";
import { listarColaboradores } from "../../../../lib/asistencias";
import Colaboradores from "../../../../components/admin/Colaboradores";
import ConfiguracionForm from "../../../../components/admin/ConfiguracionForm";
import CuentasSaga from "../../../../components/admin/CuentasSaga";
import SagaConfig from "../../../../components/admin/SagaConfig";
import IntegracionWeb from "../../../../components/admin/IntegracionWeb";
import UsuariosVentas from "../../../../components/admin/UsuariosVentas";

export const metadata = { title: "Configuración · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [config, usuarios, colaboradores, opcionesSaga, cuentasSaga, opcionesVentas, cfgMarcas] = await Promise.all([
    getConfigSitio(),
    listarUsuariosVentas(),
    listarColaboradores(),
    getOpcionesSaga(),
    getCuentas(),
    getOpcionesVentas(),
    getConfigMarcas(),
  ]);
  const categoriasWeb = cfgMarcas.categorias.map(({ slug, nombre }) => ({ slug, nombre }));
  // Las subpestañas Web y SAGA editan las mismas equivalencias: al cambiar lo guardado se vuelven a montar con los datos nuevos.
  const huella = String(
    [...JSON.stringify([opcionesSaga.equivalencias, opcionesSaga.atributosCategoria])].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)
  );
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Configuración</h1>
      </div>
      <ConfiguracionForm
        inicial={config}
        extras={{
          marcas: <MarcasConfig marcas={cfgMarcas.marcas} pestanas={cfgMarcas.pestanas.map(({ slug, nombre }) => ({ slug, nombre }))} plataformas={opcionesSaga.equivalencias.plataformas} />,
          pestanasweb: <PestanasConfig pestanas={cfgMarcas.pestanasCrudas} categorias={cfgMarcas.categorias} />,
          equipo: (
            <>
              <UsuariosVentas usuarios={usuarios} />
              <Colaboradores colaboradores={colaboradores} />
            </>
          ),
          ventas: <VentasConfig opciones={opcionesVentas} />,
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
                  catalogo={opcionesSaga.atributosCategoria}
                />
              ),
            },
            {
              id: "saga",
              nombre: "SAGA",
              formId: "form-saga-opciones",
              contenido: (
                <>
                  <CuentasSaga cuentas={cuentasSaga} opciones={{ urlsBase: opcionesSaga.urlsBase, operadores: opcionesSaga.operadores }} />
                  <SagaConfig key={`saga-${huella}`} opciones={opcionesSaga} categoriasWeb={categoriasWeb} />
                </>
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
                    Las equivalencias de {pl.nombre} se configuran así: sus categorías en <strong>Integraciones → Web</strong> (columna
                    {pl.nombre}) y el nombre exacto de cada marca en la pestaña <strong>Marcas</strong>. La conexión y el envío de datos a
                    esta plataforma se habilitan cuando se integre.
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
