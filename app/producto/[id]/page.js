import { notFound } from "next/navigation";
import { getProductos, getProducto, getMarca, getCategoria } from "../../../lib/data";
import ProductDetail from "../../../components/ProductDetail";

export function generateStaticParams() {
  return getProductos().map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = getProducto(id);
  return { title: p ? `${p.nombre} · Le Chic` : "Producto · Le Chic" };
}

export default async function ProductoPage({ params }) {
  const { id } = await params;
  const producto = getProducto(id);
  if (!producto) notFound();

  const marca = getMarca(producto.marca);
  const categoria = getCategoria(producto.marca, producto.categoria);

  return (
    <ProductDetail producto={producto} marca={marca} categoria={categoria} />
  );
}
