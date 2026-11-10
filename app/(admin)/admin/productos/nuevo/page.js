import { connection } from "next/server";
import { getMarcas, getPestanas, getVariantesParaPack } from "../../../../../lib/data";
import { getCuentasActivas } from "../../../../../lib/saga-sync";
import { getOpcionesSaga } from "../../../../../lib/saga-opciones";
import ProductoForm from "../../../../../components/admin/ProductoForm";

export const metadata = { title: "Nuevo producto · Panel Le Chic" };
// Las imágenes se envían a SAGA tras guardar (~2 minutos): necesita más tiempo que una página normal.
export const maxDuration = 300;

export default async function NuevoProductoPage() {
  await connection();
  const [marcas, pestanas] = await Promise.all([getMarcas(), getPestanas()]);
  const opcionesSaga = await getOpcionesSaga();
  const cuentasSaga = (await getCuentasActivas()).map((c) => ({ alias: c.alias, nombre: c.nombre }));

  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Nuevo producto</h1>
      </div>
      <ProductoForm modo="crear" marcas={marcas} pestanas={pestanas} cuentasSaga={cuentasSaga} opcionesSaga={opcionesSaga} variantesPack={await getVariantesParaPack()} />
    </div>
  );
}
