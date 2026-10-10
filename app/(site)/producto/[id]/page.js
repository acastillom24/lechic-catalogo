import { notFound } from "next/navigation";
import { getProducto, getMarca, getCategoria } from "../../../../lib/data";
import ProductDetail from "../../../../components/ProductDetail";
import Resenas from "../../../../components/Resenas";
import { getResumen, getResenas } from "../../../../lib/resenas";

// Los productos ahora viven en la base de datos y pueden cambiar sin un
// nuevo deploy (alta/edición desde /admin), así que la página se genera
// bajo demanda y se refresca cada minuto en vez de fijarse en build time.
export const revalidate = 60;

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
