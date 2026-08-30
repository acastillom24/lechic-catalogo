import Link from "next/link";
import { getMarcas, getConfig } from "../../lib/data";

export default function Home() {
  const marcas = getMarcas();
  const config = getConfig();
  const b = config.bienvenida;

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="contenedor">
          <p className="hero-eyebrow">{config.instagram}</p>
          <h1 className="hero-titulo serif">{config.marca}</h1>
          <p className="hero-sub serif">
            Donde el lujo y la accesibilidad se combinan
          </p>
          <div className="regla" />
          <div className="hero-cta">
            <Link href="#catalogos" className="btn btn-solido">
              Ver catálogos
            </Link>
            <Link href="/info" className="btn">
              Cómo comprar
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- CATÁLOGOS POR MARCA ---------- */}
      <section id="catalogos" className="marcas-seccion">
        <div className="contenedor">
          <p className="seccion-eyebrow">Elige tu catálogo</p>
          <h2 className="seccion-titulo">Nuestras marcas</h2>
          <div className="regla" />

          <div className="marcas-grid">
            {marcas.map((m) => (
              <Link
                key={m.slug}
                href={`/marca/${m.slug}`}
                className="marca-card"
                style={{ "--acento": m.color }}
              >
                <div className="marca-card-top">
                  <span className="marca-card-cat">
                    {m.categorias.length} categorías
                  </span>
                </div>
                <h3 className="marca-card-nombre serif">{m.nombre}</h3>
                <p className="marca-card-desc">{m.descripcion}</p>
                <span className="marca-card-flecha">Ver catálogo →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- BIENVENIDA / VALORES ---------- */}
      <section className="valores">
        <div className="contenedor valores-inner">
          <p className="valores-intro">{b.titulo}</p>
          <div className="valores-cuerpo">
            <h3 className="valores-sub serif">{b.subtitulo}</h3>
            <p className="valores-parrafo">{b.intro}</p>
            <ul className="valores-lista">
              {b.valores.map((v, i) => (
                <li key={i}>
                  <strong>{v.titulo}:</strong> {v.texto}
                </li>
              ))}
            </ul>
            <p className="valores-parrafo">{b.cierre}</p>
          </div>
        </div>
      </section>

      <style>{`
        .hero {
          text-align: center;
          padding: 84px 0 60px;
        }
        .hero-eyebrow {
          font-size: 0.72rem;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: var(--gris);
          padding-left: 0.4em;
        }
        .hero-titulo {
          font-weight: 600;
          font-size: clamp(3.4rem, 13vw, 6.5rem);
          line-height: 0.9;
          color: var(--rosa);
          margin-top: 14px;
        }
        .hero-sub {
          font-style: italic;
          font-size: clamp(1.05rem, 3.5vw, 1.5rem);
          color: var(--gris);
          margin-top: 12px;
        }
        .hero-cta {
          margin-top: 30px;
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .marcas-seccion {
          padding: 40px 0 20px;
        }
        .marcas-grid {
          margin-top: 34px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
        }
        .marca-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--blanco);
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          padding: 26px 24px 24px;
          overflow: hidden;
          transition: transform 0.35s, box-shadow 0.35s;
        }
        .marca-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 4px;
          background: var(--acento);
        }
        .marca-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--sombra-hover);
        }
        .marca-card-cat {
          font-size: 0.64rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--acento);
          font-weight: 500;
        }
        .marca-card-nombre {
          font-weight: 600;
          font-size: 1.7rem;
          line-height: 1.05;
          margin: 12px 0 8px;
        }
        .marca-card-desc {
          font-size: 0.85rem;
          color: var(--gris);
          flex: 1;
        }
        .marca-card-flecha {
          margin-top: 18px;
          font-size: 0.8rem;
          letter-spacing: 0.04em;
          color: var(--acento);
          font-weight: 400;
        }

        .valores {
          margin-top: 40px;
          background: var(--papel-hondo);
          padding: 60px 0;
        }
        .valores-inner {
          max-width: 820px;
        }
        .valores-intro {
          font-family: var(--sans);
          font-weight: 500;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          line-height: 1.5;
          font-size: clamp(1rem, 2.6vw, 1.3rem);
          color: var(--rosa);
        }
        .valores-cuerpo {
          margin-top: 32px;
        }
        .valores-sub {
          font-weight: 600;
          font-size: 1.5rem;
        }
        .valores-parrafo {
          margin-top: 10px;
          color: var(--tinta);
        }
        .valores-lista {
          margin: 18px 0;
          padding-left: 20px;
          display: grid;
          gap: 12px;
        }
        .valores-lista li {
          color: var(--tinta);
        }
        .valores-lista strong {
          font-weight: 500;
          color: var(--rosa);
        }
      `}</style>
    </>
  );
}
