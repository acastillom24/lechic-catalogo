import { getConfig } from "../../lib/data";

export const metadata = { title: "Cómo comprar · Le Chic" };

export default function InfoPage() {
  const config = getConfig();

  return (
    <div className="contenedor info">
      {/* Dinámica de compra */}
      <section className="bloque">
        <p className="seccion-eyebrow">Fácil y rápido</p>
        <h1 className="seccion-titulo">Dinámica de compra</h1>
        <div className="regla" />
        <ol className="pasos">
          {config.dinamicaCompra.map((paso, i) => (
            <li key={i}>
              <span className="paso-num serif">{i + 1}</span>
              <span className="paso-txt">{paso}</span>
            </li>
          ))}
        </ol>
        <p className="tel">
          Teléfono para comprobantes: <strong>{config.telefono}</strong>
        </p>
      </section>

      {/* Métodos de pago */}
      <section className="bloque">
        <h2 className="seccion-titulo">Métodos de pago</h2>
        <div className="regla" />
        <div className="pagos">
          {config.metodosPago.map((m, i) => (
            <div key={i} className="pago">
              <div className="pago-icono" aria-hidden="true">
                {m.icono === "tarjeta" && "▭"}
                {m.icono === "transferencia" && "⇄"}
                {m.icono === "movil" && "◱"}
                {m.icono === "efectivo" && "$"}
              </div>
              <span>{m.nombre}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Envíos */}
      <section className="bloque">
        <h2 className="seccion-titulo">Envíos</h2>
        <div className="regla" />
        <div className="envios">
          <div className="envio-col">
            <h3 className="envio-titulo">Lima</h3>
            <ul>
              {config.envios.lima.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
          <div className="envio-col">
            <h3 className="envio-titulo">Provincias</h3>
            <ul>
              {config.envios.provincias.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Políticas */}
      <section className="bloque">
        <h2 className="seccion-titulo">Políticas de compra</h2>
        <div className="regla" />
        <div className="politicas">
          {config.politicas.map((pol, i) => (
            <div key={i} className="politica">
              <h3 className="politica-titulo">
                {i + 1}. {pol.titulo}
              </h3>
              <ul>
                {pol.puntos.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Horario */}
      <section className="bloque aviso">
        <h2 className="seccion-titulo">Horario de atención</h2>
        <div className="regla" />
        <p className="aviso-horario serif">{config.horario.texto}</p>
        <p className="aviso-nota">{config.horario.nota}</p>
        <a
          href={config.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-solido"
        >
          Escríbenos en {config.instagram}
        </a>
      </section>

      <style>{`
        .info { padding: 40px 20px 20px; }
        .bloque { margin-bottom: 64px; }
        .pasos {
          list-style: none;
          max-width: 620px;
          margin: 34px auto 0;
          display: grid;
          gap: 18px;
        }
        .pasos li {
          display: flex;
          align-items: center;
          gap: 20px;
          background: var(--blanco);
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          padding: 18px 22px;
        }
        .paso-num {
          font-weight: 600;
          font-size: 2.2rem;
          color: var(--rosa);
          line-height: 1;
          min-width: 34px;
          text-align: center;
        }
        .paso-txt { font-size: 0.95rem; }
        .tel {
          text-align: center;
          margin-top: 24px;
          font-size: 0.9rem;
          color: var(--gris);
        }
        .tel strong { color: var(--rosa); font-weight: 500; }

        .pagos {
          margin-top: 34px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          max-width: 720px;
          margin-left: auto;
          margin-right: auto;
        }
        .pago {
          text-align: center;
          background: var(--blanco);
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          padding: 24px 16px;
        }
        .pago-icono {
          font-size: 1.8rem;
          color: var(--rosa);
          margin-bottom: 10px;
        }
        .pago span {
          font-size: 0.82rem;
          letter-spacing: 0.02em;
        }

        .envios {
          margin-top: 34px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }
        .envio-col {
          background: var(--blanco);
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          padding: 24px;
        }
        .envio-titulo {
          color: var(--rosa);
          font-weight: 500;
          font-size: 1.1rem;
          margin-bottom: 12px;
        }
        .envio-col ul { padding-left: 18px; display: grid; gap: 8px; }
        .envio-col li { font-size: 0.88rem; }

        .politicas {
          margin-top: 34px;
          display: grid;
          gap: 22px;
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }
        .politica-titulo {
          font-weight: 500;
          font-size: 1.05rem;
          margin-bottom: 8px;
        }
        .politica ul { padding-left: 18px; display: grid; gap: 6px; }
        .politica li { font-size: 0.88rem; color: var(--tinta); }

        .aviso { text-align: center; }
        .aviso-horario {
          font-weight: 600;
          font-size: 2rem;
          color: var(--rosa);
          margin-top: 24px;
        }
        .aviso-nota {
          color: var(--gris);
          font-size: 0.92rem;
          margin: 10px 0 24px;
        }

        @media (max-width: 640px) {
          .envios { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
