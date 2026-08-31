import SubirImagenesMasivo from "../../../../components/admin/SubirImagenesMasivo";

export const metadata = { title: "Subir imágenes · Panel Le Chic" };

export default function ImagenesPage() {
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Subir imágenes en lote</h1>
      </div>
      <SubirImagenesMasivo />
    </div>
  );
}
