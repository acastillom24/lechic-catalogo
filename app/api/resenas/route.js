import { NextResponse } from "next/server";
import { crearResena, getResenas } from "../../../lib/resenas";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const producto = searchParams.get("producto") || "";
  const pagina = Math.min(Math.max(parseInt(searchParams.get("pagina"), 10) || 0, 0), 500);
  if (!producto) return NextResponse.json({ resenas: [] });
  return NextResponse.json({ resenas: await getResenas(producto, pagina) });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const r = await crearResena({
    productoId: body.productoId,
    idToken: body.idToken,
    turnstile: body.turnstile,
    estrellas: body.estrellas,
    comentario: body.comentario,
    ip,
  });
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
