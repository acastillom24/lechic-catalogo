"use client";

import { useEffect, useRef, useState } from "react";

const MAX = 500;
const POR_PAGINA = 10;

function Estrellas({ valor, tam = "1rem" }) {
  return (
    <span className="estrellas" style={{ fontSize: tam }} aria-label={`${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(valor) ? "on" : ""}>
          ★
        </span>
      ))}
      <style jsx>{`
        .estrellas {
          letter-spacing: 2px;
          color: #dcdcdc;
          white-space: nowrap;
        }
        .on {
          color: #e8a317;
        }
      `}</style>
    </span>
  );
}

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function fecha(iso) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias < 1) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  const sem = Math.floor(dias / 7);
  if (dias < 30) return `hace ${sem} ${sem === 1 ? "semana" : "semanas"}`;
  const mes = Math.floor(dias / 30);
  if (dias < 365) return `hace ${mes} ${mes === 1 ? "mes" : "meses"}`;
  const anio = Math.floor(dias / 365);
  return `hace ${anio} ${anio === 1 ? "año" : "años"}`;
}

export default function Resenas({
  productoId,
  resumen,
  iniciales,
  googleClientId,
  turnstileSiteKey,
}) {
  const [lista, setLista] = useState(iniciales);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(iniciales.length === POR_PAGINA);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [visible, setVisible] = useState(true);
  const [orden, setOrden] = useState("recientes");

  const [idToken, setIdToken] = useState(null);
  const [usuario, setUsuario] = useState("");
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [turnstile, setTurnstile] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const botonGoogle = useRef(null);
  const cajaTurnstile = useRef(null);
  const widgetId = useRef(null);

  // Botón de Google (solo hasta que la persona inicia sesión).
  useEffect(() => {
    if (idToken || !googleClientId) return;
    let cancelado = false;
    cargarScript("https://accounts.google.com/gsi/client").then(() => {
      if (cancelado || !window.google || !botonGoogle.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (resp) => {
          try {
            const payload = JSON.parse(
              decodeURIComponent(
                escape(atob(resp.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
              )
            );
            setUsuario((payload.given_name || payload.name || "").split(" ")[0]);
          } catch {}
          setIdToken(resp.credential);
          setError("");
        },
      });
      window.google.accounts.id.renderButton(botonGoogle.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        locale: "es",
      });
    });
    return () => {
      cancelado = true;
    };
  }, [idToken, googleClientId]);

  // Turnstile (una vez que hay sesión de Google).
  useEffect(() => {
    if (!idToken || enviado || !turnstileSiteKey) return;
    let cancelado = false;
    cargarScript("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit").then(() => {
      if (cancelado || !window.turnstile || !cajaTurnstile.current) return;
      if (widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(cajaTurnstile.current, {
        sitekey: turnstileSiteKey,
        callback: (t) => setTurnstile(t),
        "expired-callback": () => setTurnstile(null),
        "error-callback": () => setTurnstile(null),
      });
    });
    return () => {
      cancelado = true;
    };
  }, [idToken, enviado, turnstileSiteKey]);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!estrellas) return setError("Elige de 1 a 5 estrellas.");
    if (!turnstile) return setError("Espera a que termine la verificación.");
    setEnviando(true);
    try {
      const res = await fetch("/api/resenas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId, idToken, turnstile, estrellas, comentario }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setIdToken(null);
        setError(data.error || "No se pudo enviar la reseña.");
        if (window.turnstile && widgetId.current !== null) {
          window.turnstile.reset(widgetId.current);
          setTurnstile(null);
        }
      } else {
        setEnviado(true);
        // Recarga la primera página para mostrar la reseña nueva.
        const r = await fetch(`/api/resenas?producto=${encodeURIComponent(productoId)}&pagina=0&orden=${orden}`);
        const d = await r.json();
        setLista(d.resenas || []);
        setPagina(0);
        setHayMas((d.resenas || []).length === POR_PAGINA);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarOrden(nuevo) {
    setOrden(nuevo);
    const r = await fetch(
      `/api/resenas?producto=${encodeURIComponent(productoId)}&pagina=0&orden=${nuevo}`
    );
    const d = await r.json();
    setLista(d.resenas || []);
    setPagina(0);
    setHayMas((d.resenas || []).length === POR_PAGINA);
  }

  async function verMas() {
    setCargandoMas(true);
    try {
      const sig = pagina + 1;
      const r = await fetch(`/api/resenas?producto=${encodeURIComponent(productoId)}&pagina=${sig}&orden=${orden}`);
      const d = await r.json();
      const nuevas = d.resenas || [];
      setLista((prev) => [...prev, ...nuevas]);
      setPagina(sig);
      setHayMas(nuevas.length === POR_PAGINA);
    } finally {
      setCargandoMas(false);
    }
  }

  const { total, promedio, conteo } = resumen;

  return (
    <section className="resenas" id="resenas">
      <h2 className="resenas-titulo">Opiniones de este producto</h2>

      {/* 1. Resumen */}
      <div className="resumen">
        <div className="resumen-prom">
          <span className="prom-num">
            {total > 0 ? promedio.toFixed(1) : "0"}
            <small>/5</small>
          </span>
          <Estrellas valor={promedio} tam="1.5rem" />
          <span className="prom-total">
            {total} {total === 1 ? "comentario" : "comentarios"}
          </span>
        </div>
        <div className="resumen-barras">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="barra-fila">
              <span className="barra-n">
                {n} <i>★</i>
              </span>
              <div className="barra">
                <div
                  className="barra-lleno"
                  style={{ width: total ? `${(conteo[n - 1] / total) * 100}%` : 0 }}
                />
              </div>
              <span className="barra-c">{conteo[n - 1]}</span>
            </div>
          ))}
        </div>
      </div>

      {visible && (
        <>
          {/* 2. Calificar */}
          <div className="calificar">
            <h3 className="calificar-titulo">Califica este producto</h3>
            {enviado ? (
              <p className="gracias">¡Gracias por tu opinión! Ya aparece en la lista.</p>
            ) : !idToken ? (
              <>
                <p className="calificar-nota">
                  Inicia sesión con Google solo para opinar. No necesitas registrarte para comprar.
                </p>
                <div ref={botonGoogle} />
              </>
            ) : (
              <form onSubmit={enviar}>
                <p className="calificar-nota">
                  Opinas como <strong>{usuario || "cliente"}</strong>
                </p>
                <div className="selector" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={n <= (hover || estrellas) ? "on" : ""}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setEstrellas(n)}
                      aria-label={`${n} estrellas`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value.slice(0, MAX))}
                  placeholder="Cuéntanos tu experiencia (opcional)"
                  rows={4}
                />
                <div className="contador">
                  {comentario.length}/{MAX}
                </div>
                <div ref={cajaTurnstile} />
                {error && <p className="error">{error}</p>}
                <button className="btn btn-solido" type="submit" disabled={enviando}>
                  {enviando ? "Enviando..." : "Publicar reseña"}
                </button>
              </form>
            )}
            {!idToken && error && <p className="error">{error}</p>}
          </div>

          {/* 3. Lista */}
          {lista.length > 1 && (
            <label className="orden">
              Ordenar por:
              <select value={orden} onChange={(e) => cambiarOrden(e.target.value)}>
                <option value="recientes">Más recientes</option>
                <option value="mejores">Mejores evaluaciones</option>
                <option value="peores">Peores evaluaciones</option>
              </select>
            </label>
          )}
          {lista.length > 0 && (
            <ul className="lista">
              {lista.map((r) => (
                <li key={r.id} className="item">
                  <div className="item-cab">
                    <span className="item-nombre">por {r.nombre}</span>
                    <div className="item-der">
                      <Estrellas valor={r.estrellas} tam="1.05rem" />
                      <span className="item-fecha">{fecha(r.created_at)}</span>
                    </div>
                  </div>
                  {r.comentario && <p className="item-texto">{r.comentario}</p>}
                </li>
              ))}
            </ul>
          )}
          {hayMas && (
            <div className="centro">
              <button className="enlace" onClick={verMas} disabled={cargandoMas}>
                {cargandoMas ? "Cargando..." : "Ver más opiniones"}
              </button>
            </div>
          )}
        </>
      )}

      <div className="centro">
        <button className="enlace" onClick={() => setVisible((v) => !v)}>
          {visible ? "Ocultar todas las opiniones" : "Ver todas las opiniones"}
        </button>
      </div>

      <style jsx>{`
        .resenas {
          margin-top: 56px;
        }
        .resenas-titulo {
          font-family: var(--sans);
          font-size: 1.35rem;
          font-weight: 400;
          color: var(--tinta);
          padding-bottom: 14px;
          border-bottom: 2px solid #4a4f57;
          margin-bottom: 28px;
        }
        .resumen {
          display: flex;
          gap: 40px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 32px;
        }
        .resumen-prom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          min-width: 150px;
        }
        .prom-total {
          font-size: 1rem;
          color: var(--tinta);
        }
        .resumen-barras {
          flex: 1;
          min-width: 240px;
          max-width: 420px;
          display: grid;
          gap: 9px;
        }
        .barra-fila {
          display: grid;
          grid-template-columns: 32px 1fr 36px;
          align-items: center;
          gap: 10px;
        }
        .barra-n {
          font-size: 0.78rem;
          font-weight: 600;
          color: #4a4f57;
          text-align: right;
        }
        .barra-c {
          font-size: 0.85rem;
          color: var(--gris);
        }
        .prom-num {
          font-size: 3.6rem;
          line-height: 1;
          font-weight: 400;
        }
        .prom-num small {
          font-size: 1.1rem;
          color: var(--gris);
          margin-left: 2px;
        }
        .orden {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
          color: var(--gris);
        }
        .orden select {
          font-family: var(--sans);
          font-size: 1rem;
          color: var(--tinta);
          border: 0;
          border-bottom: 1px solid var(--linea);
          background: transparent;
          padding: 6px 4px;
          cursor: pointer;
        }
        .barra-n i {
          font-style: normal;
        }
        .barra {
          height: 6px;
          border-radius: 999px;
          background: #e3e3e3;
          overflow: hidden;
        }
        .barra-lleno {
          height: 100%;
          background: #4a4f57;
          border-radius: 999px;
        }
        .calificar {
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          padding: 22px;
          margin-bottom: 28px;
          max-width: 560px;
        }
        .calificar-titulo {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .calificar-nota {
          font-size: 0.85rem;
          color: var(--gris);
          margin-bottom: 12px;
        }
        .selector {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
        }
        .selector button {
          background: none;
          border: 0;
          cursor: pointer;
          font-size: 2rem;
          line-height: 1;
          color: #dcdcdc;
          padding: 0 2px;
        }
        .selector button.on {
          color: #e8a317;
        }
        textarea {
          width: 100%;
          font-family: var(--sans);
          font-size: 0.92rem;
          padding: 12px;
          border: 1px solid var(--linea);
          border-radius: var(--radio);
          resize: vertical;
          background: var(--blanco);
        }
        .contador {
          text-align: right;
          font-size: 0.72rem;
          color: var(--gris);
          margin: 4px 0 12px;
        }
        .error {
          color: #b3261e;
          font-size: 0.85rem;
          margin: 10px 0;
        }
        .lista {
          list-style: none;
          padding: 0;
          margin: 0 0 12px;
          column-count: 3;
          column-gap: 18px;
        }
        .item {
          break-inside: avoid;
          background: var(--blanco);
          border-radius: 8px;
          box-shadow: 0 1px 8px rgba(36, 26, 31, 0.14);
          padding: 20px 22px;
          margin-bottom: 18px;
        }
        .item-cab {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .item-nombre {
          font-size: 1.05rem;
          font-weight: 500;
          overflow-wrap: anywhere;
        }
        .item-der {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }
        .item-fecha {
          font-size: 0.82rem;
          color: var(--tinta);
        }
        .item-texto {
          margin-top: 14px;
          font-size: 0.95rem;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        @media (max-width: 960px) {
          .lista {
            column-count: 2;
          }
        }
        @media (max-width: 600px) {
          .lista {
            column-count: 1;
          }
        }
        .centro {
          text-align: center;
          margin: 18px 0;
        }
        .enlace {
          background: none;
          border: 0;
          border-bottom: 1px solid var(--tinta);
          font-family: var(--sans);
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--tinta);
          padding: 4px 6px;
          cursor: pointer;
        }
        .enlace:disabled {
          opacity: 0.5;
        }
      `}</style>
    </section>
  );
}
