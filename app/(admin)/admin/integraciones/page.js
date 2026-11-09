import { redirect } from "next/navigation";

// Por ahora la única integración es SAGA; al sumar otras, aquí puede ir un resumen.
export default function IntegracionesIndex() {
  redirect("/admin/integraciones/saga");
}
