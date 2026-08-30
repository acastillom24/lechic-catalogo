import ImportarCsvForm from "../../../../components/admin/ImportarCsvForm";

export const metadata = { title: "Importar CSV · Panel Le Chic" };

export default function ImportarPage() {
  return (
    <div className="form-grid">
      <div className="admin-titulo-fila">
        <h1 className="admin-titulo">Importar productos desde CSV</h1>
      </div>
      <ImportarCsvForm />
    </div>
  );
}
