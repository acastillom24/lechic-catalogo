import AdminChrome from "../../../components/admin/AdminChrome";
import { contarReclamos } from "../../../lib/reclamos";

export default async function AdminLayout({ children }) {
  // Contador de reclamos abiertos para el menú (si la tabla aún no existe devuelve ceros).
  const reclamos = await contarReclamos();
  return <AdminChrome reclamos={reclamos}>{children}</AdminChrome>;
}
