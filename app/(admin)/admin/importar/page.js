import { redirect } from "next/navigation";

// La importación ahora vive en la pestaña Productos (botón "Importar CSV").
export default function ImportarRedirect() {
  redirect("/admin");
}
