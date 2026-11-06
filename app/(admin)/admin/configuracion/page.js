import { getConfigSitio } from "../../../../lib/config";
import { listarUsuariosVentas } from "../../../../lib/ventas";
import ConfiguracionForm from "../../../../components/admin/ConfiguracionForm";
import UsuariosVentas from "../../../../components/admin/UsuariosVentas";

export const metadata = { title: "Configuración · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [config, usuarios] = await Promise.all([getConfigSitio(), listarUsuariosVentas()]);
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Configuración del sitio</h1>
      </div>
      <UsuariosVentas usuarios={usuarios} />
      <ConfiguracionForm inicial={config} />
    </div>
  );
}
