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
          color: var(--linea);
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
  return new Date(iso).toLocaleDateString("es-PE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
        const r = await fetch(`/api/resenas?producto=${encodeURIComponent(productoId)}&pagina=0`);
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

  async function verMas() {
    setCargandoMas(true);
    try {
      const sig = pagina + 1;
      const r = await fetch(`/api/resenas?producto=${encodeURIComponent(productoId)}&pagina=${sig}`);
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
      <h2 className="resenas-titulo serif">Opiniones</h2>

      {/* 1. Resumen */}
      {total > 0 ? (
        <div className="resumen">
          <div className="resumen-prom">
            <span className="prom-num serif">{promedio.toFixed(1)}</span>
            <Estrellas valor={promedio} tam="1.2rem" />
            <span className="prom-total">
              {total} {total === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
          <div className="resumen-barras">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="barra-fila">
                <span>{n} ★</span>
                <div className="barra">
                  <div className="barra-lleno" style={{ width: `${(conteo[n - 1] / total) * 100}%` }} />
                </div>
                <span className="barra-n">{conteo[n - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="vacio">Aún no hay reseñas. ¡Sé la primera persona en opinar!</p>
      )}

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
            <p className="calificar-nota">Opinas como <strong>{usuario || "cliente"}</strong></p>
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
            <div className="contador">{comentario.length}/{MAX}</div>
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
      {lista.length > 0 && (
        <ul className="lista">
          {lista.map((r) => (
            <li key={r.id} className="item">
              <div className="item-cab">
                <strong>{r.nombre}</strong>
                <Estrellas valor={r.estrellas} />
                <span className="item-fecha">{fecha(r.created_at)}</span>
              </div>
              {r.comentario && <p className="item-texto">{r.comentario}</p>}
            </li>
          ))}
        </ul>
      )}
      {hayMas && (
        <button className="btn" onClick={verMas} disabled={cargandoMas}>
          {cargandoMas ? "Cargando..." : "Ver más reseñas"}
        </button>
      )}

      <style jsx>{`
        .resenas {
          margin-top: 56px;
          padding-top: 36px;
          border-top: 1px solid var(--linea);
          max-width: 760px;
        }
        .resenas-titulo {
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .resumen {
          display: flex;
          gap: 36px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }
        .resumen-prom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .prom-num {
          font-size: 3.4rem;
          font-weight: 600;
          line-height: 1;
        }
        .prom-total {
          font-size: 0.8rem;
          color: var(--gris);
        }
        .resumen-barras {
          flex: 1;
          min-width: 220px;
          display: grid;
          gap: 6px;
        }
        .barra-fila {
          display: grid;
          grid-template-columns: 34px 1fr 28px;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          color: var(--gris);
        }
        .barra {
          height: 8px;
          border-radius: 999px;
          background: var(--papel-hondo);
          overflow: hidden;
        }
        .barra-lleno {
          height: 100%;
          background: #e8a317;
        }
        .barra-n {
          text-align: right;
        }
        .vacio {
          color: var(--gris);
          margin-bottom: 24px;
        }
        .calificar {
          background: var(--papel-hondo);
          border-radius: var(--radio);
          padding: 22px;
          margin-bottom: 28px;
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
          color: var(--linea);
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
        .gracias {
          color: var(--tinta);
        }
        .lista {
          list-style: none;
          padding: 0;
          margin: 0 0 20px;
        }
        .item {
          padding: 16px 0;
          border-bottom: 1px solid var(--linea);
        }
        .item-cab {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .item-fecha {
          font-size: 0.75rem;
          color: var(--gris);
        }
        .item-texto {
          margin-top: 8px;
          font-size: 0.92rem;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
      `}</style>
    </section>
  );
}
