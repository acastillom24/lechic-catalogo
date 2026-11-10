"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Una pestaña por integración. Para sumar otra: agregar aquí su ruta y crear su página en
// app/(admin)/admin/integraciones/<nombre>/page.js y app/(sales)/operaciones/integraciones/<nombre>/page.js.
const INTEGRACIONES = [["saga", "SAGA"]];

/** Pestañas de la sección Integraciones (SAGA y las que se agreguen). */
export default function TabsIntegraciones({ base = "/admin/integraciones" }) {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Integraciones">
      {INTEGRACIONES.map(([ruta, texto]) => {
        const href = `${base}/${ruta}`;
        return (
        <Link
          key={href}
          href={href}
          className={pathname === href || pathname.startsWith(href + "/") ? "admin-tab activo" : "admin-tab"}
        >
          {texto}
        </Link>
        );
      })}
    </nav>
  );
}
