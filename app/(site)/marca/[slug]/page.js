import { notFound } from "next/navigation";
import {
  getPestanas,
  getPestana,
  getProductosPorPestana,
  contarPorCategoria,
} from "../../../../lib/data";
import BrandView from "../../../../components/BrandView";

// Los productos vienen de la base de datos. Las altas/ediciones hechas desde
// /admin llaman revalidatePath() y refrescan la página al instante; las 24 h
// son solo una red de seguridad (60 s agotaba los límites de Vercel Hobby).
export const revalidate = 86400;

// Las pestañas son configurables (Configuración → Pestañas). Se generan en build; las que se
// agreguen después se generan en su primera visita (dynamicParams) y al guardar la configuración
// se revalida el layout completo.
export async function generateStaticParams() {
  return (await getPestanas()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const pestana = await getPestana(slug);
  return {
    title: pestana ? `${pestana.nombre} · Le Chic` : "Catálogo · Le Chic",
  };
}

export default async function MarcaPage({ params }) {
  const { slug } = await params;
  const pestana = await getPestana(slug);
  if (!pestana) notFound();

  const productos = await getProductosPorPestana(pestana.slug);
  const conteo = await contarPorCategoria(pestana.slug);

  return <BrandView marca={pestana} productos={productos} conteo={conteo} />;
}
