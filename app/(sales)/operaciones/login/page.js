import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import SalesLoginForm from "../../../../components/sales/SalesLoginForm";
import { NOMBRE_COOKIE_VENTAS, leerSesionVentas } from "../../../../lib/auth-ventas";

export const metadata = { title: "Ingresar · Le Chic · Operaciones" };

export default async function SalesLoginPage() {
  const store = await cookies();
  if (await leerSesionVentas(store.get(NOMBRE_COOKIE_VENTAS)?.value)) redirect("/operaciones");
  return <SalesLoginForm />;
}
