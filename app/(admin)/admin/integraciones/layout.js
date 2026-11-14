import TabsIntegraciones from "../../../../components/admin/TabsIntegraciones";

/** Marco común de las integraciones: título y una pestaña por plataforma. */
export default function IntegracionesLayout({ children }) {
  return (
    <div className="form-grid">
      <h1 className="solo-lector">Integraciones</h1>
      <TabsIntegraciones />
      {children}
    </div>
  );
}
