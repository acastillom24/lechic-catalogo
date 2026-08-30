import { notFound } from "next/navigation";
import {
  getMarcas,
  getMarca,
  getProductosPorMarca,
  contarPorCategoria,
} from "../../../../lib/data";
import BrandView from "../../../../components/BrandView";

// Los productos vienen de la base de datos: refrescamos cada minuto para
// que las altas/ediciones hechas desde /admin aparezcan sin nuevo deploy.
export const revalidate = 60;

// La lista de marcas es estática (data/marcas.js), así que las rutas
// se siguen generando en build time. Los productos de cada marca ahora
// vienen de la base de datos y se leen al pedir la página.
export function generateStaticParams() {
  return getMarcas().map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const marca = getMarca(slug);
  return {
    title: marca ? `${marca.nombre} · Le Chic` : "Catálogo · Le Chic",
  };
}

export default async function MarcaPage({ params }) {
  const { slug } = await params;
  const marca = getMarca(slug);
  if (!marca) notFound();

  const productos = await getProductosPorMarca(marca.slug);
  const conteo = await contarPorCategoria(marca.slug);

  return <BrandView marca={marca} productos={productos} conteo={conteo} />;
}
