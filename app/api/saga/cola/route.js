import { NextResponse, after } from "next/server";
import { drenarCola } from "../../../../lib/saga-cola";

// El drenado corre en segundo plano (after) hasta 5 minutos; quien llama recibe la respuesta enseguida.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Continúa la cola de envíos a SAGA. Lo invoca el propio drenador cuando aún queda trabajo y el cron diario de
 * Vercel (que manda `Authorization: Bearer $CRON_SECRET`). Sin la variable CRON_SECRET la ruta queda cerrada.
 */
async function manejar(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  after(() => drenarCola());
  return NextResponse.json({ ok: true }, { status: 202 });
}

export const GET = manejar;
export const POST = manejar;
