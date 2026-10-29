import { getConfigSitio } from "../../../../lib/config";
import ConfiguracionForm from "../../../../components/admin/ConfiguracionForm";

export const metadata = { title: "Configuración · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const config = await getConfigSitio();
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Configuración del sitio</h1>
      </div>
      <ConfiguracionForm inicial={config} />
    </div>
  );
}
