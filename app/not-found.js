import Link from "next/link";

export default function NotFound() {
  return (
    <div className="contenedor" style={{ textAlign: "center", padding: "100px 20px" }}>
      <h1 className="serif" style={{ fontSize: "3rem", color: "var(--rosa)" }}>
        Página no encontrada
      </h1>
      <p style={{ color: "var(--gris)", marginTop: 12 }}>
        Lo que buscas no existe o fue movido.
      </p>
      <Link href="/" className="btn btn-solido" style={{ marginTop: 24 }}>
        Volver al inicio
      </Link>
    </div>
  );
}
