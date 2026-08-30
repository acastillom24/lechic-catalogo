import { NextResponse } from "next/server";
import { NOMBRE_COOKIE, sesionValida } from "./lib/auth";

/**
 * Protege todo /admin excepto la página y la acción de login.
 * Si no hay una cookie de sesión válida, redirige a /admin/login.
 */
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const esLogin = pathname === "/admin/login";
  if (esLogin) return NextResponse.next();

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
  matcher: ["/admin/:path*"],
};
