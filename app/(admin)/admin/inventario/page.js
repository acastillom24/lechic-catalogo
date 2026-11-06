import { redirect } from "next/navigation";

// El inventario ahora vive en la pestaña Productos (/admin).
export default function InventarioRedirect() {
  redirect("/admin");
}
