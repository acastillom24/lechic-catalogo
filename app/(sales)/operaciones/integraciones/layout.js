import SalesCabecera from "../../../../components/sales/SalesCabecera";
import TabsIntegraciones from "../../../../components/admin/TabsIntegraciones";
import { requerirUsuarioVentas } from "../actions";

/** Marco de las integraciones del panel: título y una pestaña por plataforma (solo ve lo suyo). */
export default async function IntegracionesOperacionesLayout({ children }) {
  const usuario = await requerirUsuarioVentas("integraciones");
  return (
    <>
      <SalesCabecera usuario={usuario} activa="integraciones" />
      <main className="admin-main">
        <div className="form-grid">
          <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
            <h1 className="admin-titulo">Integraciones</h1>
          </div>
          <TabsIntegraciones base="/operaciones/integraciones" />
          {children}
        </div>
      </main>
    </>
  );
}
