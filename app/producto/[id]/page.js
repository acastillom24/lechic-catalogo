import { notFound } from "next/navigation";
import { getProductos, getProducto, getMarca, getCategoria } from "../../../lib/data";
import ProductDetail from "../../../components/ProductDetail";

export function generateStaticParams() {
  return getProductos().map((p) => ({ id: p.id }));
}

export function generateMetadata({ params }) {
  const p = getProducto(params.id);
  return { title: p ? `${p.nombre} · Le Chic` : "Producto · Le Chic" };
}

export default function ProductoPage({ params }) {
  const producto = getProducto(params.id);
  if (!producto) notFound();

  const marca = getMarca(producto.marca);
  const categoria = getCategoria(producto.marca, producto.categoria);

  return (
    <ProductDetail producto={producto} marca={marca} categoria={categoria} />
  );
}
