import { notFound } from "next/navigation";
import {
  getMarcas,
  getMarca,
  getProductosPorMarca,
  contarPorCategoria,
} from "../../../lib/data";
import BrandView from "../../../components/BrandView";

// Genera las rutas estáticas de cada marca en build time (rápido y gratis).
export function generateStaticParams() {
  return getMarcas().map((m) => ({ slug: m.slug }));
}

export function generateMetadata({ params }) {
  const marca = getMarca(params.slug);
  return {
    title: marca ? `${marca.nombre} · Le Chic` : "Catálogo · Le Chic",
  };
}

export default function MarcaPage({ params }) {
  const marca = getMarca(params.slug);
  if (!marca) notFound();

  const productos = getProductosPorMarca(marca.slug);
  const conteo = contarPorCategoria(marca.slug);

  return <BrandView marca={marca} productos={productos} conteo={conteo} />;
}
