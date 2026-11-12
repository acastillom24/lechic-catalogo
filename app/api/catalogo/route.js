import { NextResponse } from "next/server";
import { getCatalogoPublico } from "../../../lib/data";

// Catálogo público liviano para el buscador del inicio. Es una respuesta ESTÁTICA (se genera una vez y se sirve desde la
// CDN): buscar no cuesta una consulta a la base de datos por cada letra. Igual que las páginas del sitio, se actualiza
// con revalidatePath() desde /admin; las 24 h son solo una red de seguridad.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const catalogo = await getCatalogoPublico();
  return NextResponse.json(catalogo);
}
