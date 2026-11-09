import Link from "next/link";
import { getConfigSitio } from "../lib/config";

export default async function Footer() {
  const config = await getConfigSitio();
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
          <a href={config.tiktokUrl} target="_blank" rel="noopener noreferrer">
            TikTok
          </a>
          {config.facebookUrl && (
            <a href={config.facebookUrl} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
          )}
          <Link href="/info">Cómo comprar</Link>
        </div>
        <Link href="/libro-de-reclamaciones" className="pie-libro" title="Registra un reclamo o una queja">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
            <path d="M4 19a2 2 0 0 1 2-2h13" />
            <path d="M9 8h6M9 11h4" />
          </svg>
          Libro de Reclamaciones
        </Link>
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
        .pie .pie-libro {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 4px 0 14px;
          padding: 8px 16px;
          border: 1px solid var(--rosa);
          border-radius: var(--radio);
          color: var(--rosa);
          font-size: 0.82rem;
          letter-spacing: 0.04em;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .pie .pie-libro:hover {
          background: var(--rosa);
          color: #fff;
        }
        .pie-nota {
          font-size: 0.72rem;
          color: var(--gris);
        }
      `}</style>
    </footer>
  );
}
