import { notFound } from "next/navigation";
import { getProducto, getMarca, getCategoria } from "../../../../lib/data";
import ProductDetail from "../../../../components/ProductDetail";
import Resenas from "../../../../components/Resenas";
import { getResumen, getResenas } from "../../../../lib/resenas";

// Los productos ahora viven en la base de datos y pueden cambiar sin un
// nuevo deploy (alta/edición desde /admin), así que la página se genera
// bajo demanda. Las acciones de /admin llaman revalidatePath() para
// refrescarla al instante; las 24 h son solo una red de seguridad
// (60 s agotaba los límites de ISR Writes / CPU de Vercel Hobby).
export const revalidate = 86400;

// Sin generateStaticParams, Next trata la ruta como 100% dinámica y la
// renderiza (con consultas a Neon) en CADA visita, ignorando `revalidate`.
// Devolver [] no genera nada en build, pero activa ISR: cada producto se
// genera en su primera visita y luego se sirve desde caché.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await getProducto(id);
  return { title: p ? `${p.nombre} · Le Chic` : "Producto · Le Chic" };
}

export default async function ProductoPage({ params }) {
  const { id } = await params;
  const producto = await getProducto(id);
  if (!producto) notFound();

  const marca = getMarca(producto.marca);
  const categoria = getCategoria(producto.marca, producto.categoria);

  const [resumen, iniciales] = await Promise.all([
    getResumen(producto.id),
    getResenas(producto.id, 0),
  ]);

  return (
    <ProductDetail producto={producto} marca={marca} categoria={categoria}>
      <Resenas
        productoId={producto.id}
        resumen={resumen}
        iniciales={iniciales}
        googleClientId={process.env.GOOGLE_CLIENT_ID}
        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY}
      />
    </ProductDetail>
  );
}
