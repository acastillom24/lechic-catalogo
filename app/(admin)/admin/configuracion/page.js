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
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Configuración</h1>
      </div>
      <ConfiguracionForm
        inicial={config}
        extras={{
          marcas: <MarcasConfig marcas={cfgMarcas.marcas} pestanas={cfgMarcas.pestanas.map(({ slug, nombre }) => ({ slug, nombre }))} />,
          pestanasweb: <PestanasConfig pestanas={cfgMarcas.pestanasCrudas} categorias={cfgMarcas.categorias} />,
          equipo: (
            <>
              <UsuariosVentas usuarios={usuarios} />
              <Colaboradores colaboradores={colaboradores} />
            </>
          ),
          ventas: <VentasConfig opciones={opcionesVentas} />,
          saga: (
            <>
              <CuentasSaga cuentas={cuentasSaga} opciones={{ urlsBase: opcionesSaga.urlsBase, operadores: opcionesSaga.operadores }} />
              <SagaConfig opciones={opcionesSaga} />
            </>
          ),
        }}
      />
    </div>
  );
}
