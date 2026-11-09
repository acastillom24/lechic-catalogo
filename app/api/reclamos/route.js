import { NextResponse } from "next/server";
import { crearReclamo } from "../../../lib/reclamos";

export const dynamic = "force-dynamic";

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
  const r = await crearReclamo(body, { turnstile: body?.turnstile, ip });
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  // Solo lo necesario para mostrar la constancia; no se devuelve nada interno (ip, notas…).
  const { reclamo: x } = r;
  return NextResponse.json({
    ok: true,
    codigo: x.codigo,
    fecha: x.created_at,
    fechaLimite: x.fecha_limite,
    tipo: x.tipo,
    copiaEnviada: r.correo.consumidor,
  });
}
