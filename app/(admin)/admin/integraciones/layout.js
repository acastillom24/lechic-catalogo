import TabsIntegraciones from "../../../../components/admin/TabsIntegraciones";

/** Marco común de las integraciones: título y una pestaña por plataforma. */
export default function IntegracionesLayout({ children }) {
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
        <h1 className="admin-titulo">Integraciones</h1>
      </div>
      <TabsIntegraciones />
      {children}
    </div>
  );
}
