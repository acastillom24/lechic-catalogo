import { NextResponse } from "next/server";
import { NOMBRE_COOKIE, sesionValida } from "./lib/auth";
import { NOMBRE_COOKIE_VENTAS, leerSesionVentas } from "./lib/auth-ventas";

/**
 * Protege /admin (excepto su login) y /operaciones (excepto su login).
 * Sin cookie de sesión válida redirige al login correspondiente.
 */
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname === "/operaciones/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/operaciones")) {
    const uid = await leerSesionVentas(request.cookies.get(NOMBRE_COOKIE_VENTAS)?.value);
    if (!uid) {
      const url = request.nextUrl.clone();
      url.pathname = "/operaciones/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(NOMBRE_COOKIE)?.value;
  const valida = await sesionValida(cookie);

  if (!valida) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/operaciones/:path*"],
};
