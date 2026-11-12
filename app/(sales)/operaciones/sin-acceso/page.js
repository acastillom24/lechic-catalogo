import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { NOMBRE_COOKIE_VENTAS, leerSesionVentas } from "../../../../lib/auth-ventas";
import { cerrarSesionVentas } from "../actions";

export const metadata = { title: "Sin acceso · Le Chic · Operaciones" };
export const dynamic = "force-dynamic";

/** Usuario de operaciones sin ninguna vista habilitada (Configuración → Equipo). */
export default async function SinAccesoPage() {
  const store = await cookies();
  if (!(await leerSesionVentas(store.get(NOMBRE_COOKIE_VENTAS)?.value))) redirect("/operaciones/login");
  return (
    <main className="admin-main">
      <section className="admin-card form-grid" style={{ maxWidth: 480, margin: "48px auto" }}>
        <h1 className="admin-titulo" style={{ fontSize: "1.3rem" }}>Sin vistas habilitadas</h1>
        <p>Tu usuario todavía no tiene vistas habilitadas en Operaciones. Pide a un administrador que las active.</p>
        <form action={cerrarSesionVentas}>
          <button type="submit" className="btn-ico-texto">Cerrar sesión</button>
        </form>
      </section>
    </main>
  );
}
