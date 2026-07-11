import Link from "next/link";
import { getConfig } from "../lib/data";

export default function Footer() {
  const config = getConfig();
  return (
    <footer className="pie">
      <div className="contenedor">
        <p className="pie-marca serif">{config.marca}</p>
        <p className="pie-linea">
          Horario de atención: {config.horario.texto}
        </p>
        <div className="pie-enlaces">
          <a href={config.instagramUrl} target="_blank" rel="noopener noreferrer">
            {config.instagram}
          </a>
          <Link href="/info">Cómo comprar</Link>
        </div>
        <p className="pie-nota">
          Precios en soles. Sujeto a disponibilidad de stock.
        </p>
      </div>

      <style>{`
        .pie {
          margin-top: 40px;
          border-top: 1px solid var(--linea);
          padding: 40px 0 56px;
          text-align: center;
        }
        .pie-marca {
          font-size: 1.6rem;
          color: var(--rosa);
          font-style: italic;
        }
        .pie-linea {
          font-size: 0.82rem;
          color: var(--gris);
          margin-top: 6px;
        }
        .pie-enlaces {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin: 18px 0 12px;
        }
        .pie-enlaces a {
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          color: var(--rosa);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .pie-nota {
          font-size: 0.72rem;
          color: var(--gris);
        }
      `}</style>
    </footer>
  );
}
