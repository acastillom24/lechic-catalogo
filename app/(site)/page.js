import Link from "next/link";
import { getMarcas, getProductosPorMarca } from "../../lib/data";
import { getConfigSitio } from "../../lib/config";
import OfertasCarousel from "../../components/OfertasCarousel";

// Igual que /marca/[slug] y /producto/[id]: sin esto, la home consulta
// la base de datos en cada visita (render 100% dinámico), lo que dispara mucho
// más tráfico/logs de los necesarios en la página más visitada del sitio.
export const revalidate = 60;

function elegirOfertasAleatorias(productos, cantidad) {
  const disponibles = productos.filter((p) =>
    p.variantes.some((v) => v.stock !== false)
  );
  const mezclados = disponibles.slice();
  for (let i = mezclados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezclados[i], mezclados[j]] = [mezclados[j], mezclados[i]];
  }
  return mezclados.slice(0, cantidad);
}

export default async function Home() {
  const marcas = getMarcas();
  const config = await getConfigSitio();
  const b = config.bienvenida;

  const productosOferta = await getProductosPorMarca("ofertas");
  const ofertasDestacadas = elegirOfertasAleatorias(productosOferta, 6);

  return (
    <>
      {/* ---------- OFERTAS DESTACADAS ---------- */}
      {ofertasDestacadas.length > 0 && (
        <section className="ofertas-seccion">
          <div className="contenedor">
            <div className="ofertas-carrusel-wrap">
              <OfertasCarousel productos={ofertasDestacadas} />
            </div>
          </div>
        </section>
      )}

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
        .marcas-seccion .seccion-titulo {
          color: var(--rosa);
        }
        .ofertas-seccion {
          padding: 10px 0 8px;
        }
        .ofertas-carrusel-wrap {
          margin-top: 16px;
        }

        .marcas-seccion {
          padding: 20px 0 20px;
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
          color: var(--tinta);
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
