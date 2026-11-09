"use client";

import { useEffect, useRef, useState } from "react";

const VACIO = {
  tipo: "reclamo",
  nombre: "",
  tipoDocumento: "DNI",
  documento: "",
  domicilio: "",
  telefono: "",
  email: "",
  esMenor: false,
  apoderado: "",
  tipoBien: "producto",
  descripcionBien: "",
  monto: "",
  numeroPedido: "",
  detalle: "",
  pedidoConsumidor: "",
  acepta: false,
};

function cargarScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

const fecha = (f) =>
  new Date(f).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Lima" });
const fechaDia = (f) =>
  new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

export default function ReclamoForm({ turnstileSiteKey, empresa = {}, marca = "" }) {
  const [f, setF] = useState(VACIO);
  const [turnstile, setTurnstile] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [constancia, setConstancia] = useState(null);
  const caja = useRef(null);
  const widgetId = useRef(null);

  const poner = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (constancia || !turnstileSiteKey) return;
    let cancelado = false;
    cargarScript("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit").then(() => {
      if (cancelado || !window.turnstile || !caja.current || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(caja.current, {
        sitekey: turnstileSiteKey,
        callback: (t) => setTurnstile(t),
        "expired-callback": () => setTurnstile(null),
        "error-callback": () => setTurnstile(null),
      });
    });
    return () => {
      cancelado = true;
    };
  }, [constancia, turnstileSiteKey]);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (turnstileSiteKey && !turnstile) return setError("Espera a que termine la verificación.");
    setEnviando(true);
    try {
      const res = await fetch("/api/reclamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, turnstile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo enviar. Intenta de nuevo.");
        if (window.turnstile && widgetId.current !== null) {
          window.turnstile.reset(widgetId.current);
          setTurnstile(null);
        }
      } else {
        setConstancia({ ...data, copia: { ...f } });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    }
    setEnviando(false);
  }

  if (constancia) {
    const c = constancia.copia;
    return (
      <div className="lr-ok">
        <h2 className="serif">Recibimos tu {constancia.tipo === "queja" ? "queja" : "reclamo"}</h2>
        <p className="lr-codigo">
          N.º <strong>{constancia.codigo}</strong>
        </p>
        <p>
          Fecha: {fecha(constancia.fecha)}. Te responderemos a más tardar el <strong>{fechaDia(constancia.fechaLimite)}</strong>.
        </p>
        <p>
          {constancia.copiaEnviada
            ? `Te enviamos una copia a ${c.email}. Si no la ves, revisa la carpeta de spam.`
            : "No pudimos enviarte la copia por correo. Guarda o imprime esta constancia con tu número."}
        </p>
        <dl className="lr-resumen">
          {empresa.razonSocial && (<><dt>Proveedor</dt><dd>{empresa.razonSocial}{empresa.ruc ? ` · RUC ${empresa.ruc}` : ""}</dd></>)}
          <dt>Consumidor</dt><dd>{c.nombre} · {c.tipoDocumento} {c.documento}</dd>
          <dt>Bien</dt><dd>{c.tipoBien === "servicio" ? "Servicio" : "Producto"}: {c.descripcionBien}</dd>
          <dt>Detalle</dt><dd>{c.detalle}</dd>
          <dt>Pedido</dt><dd>{c.pedidoConsumidor}</dd>
        </dl>
        <div className="lr-acciones">
          <button type="button" className="btn btn-solido" onClick={() => window.print()}>Imprimir constancia</button>
        </div>
        <style>{estilos}</style>
      </div>
    );
  }

  const campo = (k, etiqueta, props = {}) => (
    <div className="campo">
      <label htmlFor={`lr-${k}`}>{etiqueta}</label>
      <input id={`lr-${k}`} value={f[k]} onChange={(e) => poner(k, e.target.value)} {...props} />
    </div>
  );

  return (
    <form className="lr-form" onSubmit={enviar}>
      <fieldset>
        <legend>1. Identificación del consumidor</legend>
        {campo("nombre", "Nombre completo *", { required: true, maxLength: 120, autoComplete: "name" })}
        <div className="fila">
          <div className="campo">
            <label htmlFor="lr-tipoDocumento">Tipo de documento *</label>
            <select id="lr-tipoDocumento" value={f.tipoDocumento} onChange={(e) => poner("tipoDocumento", e.target.value)}>
              {["DNI", "CE", "Pasaporte", "RUC"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {campo("documento", "N.º de documento *", { required: true, maxLength: 20, inputMode: "text" })}
        </div>
        {campo("domicilio", "Domicilio *", { required: true, maxLength: 200, autoComplete: "street-address" })}
        <div className="fila">
          {campo("telefono", "Teléfono *", { required: true, maxLength: 20, type: "tel", autoComplete: "tel" })}
          {campo("email", "Correo electrónico *", { required: true, maxLength: 120, type: "email", autoComplete: "email" })}
        </div>
        <label className="chk">
          <input type="checkbox" checked={f.esMenor} onChange={(e) => poner("esMenor", e.target.checked)} />
          Soy menor de edad
        </label>
        {f.esMenor && campo("apoderado", "Nombre de tu padre, madre o apoderado *", { required: true, maxLength: 120 })}
      </fieldset>

      <fieldset>
        <legend>2. Identificación del bien contratado</legend>
        <div className="fila">
          <div className="campo">
            <label htmlFor="lr-tipoBien">Tipo *</label>
            <select id="lr-tipoBien" value={f.tipoBien} onChange={(e) => poner("tipoBien", e.target.value)}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </div>
          {campo("monto", "Monto reclamado (S/, opcional)", { type: "number", min: "0", step: "0.01" })}
        </div>
        {campo("descripcionBien", "Descripción del producto o servicio *", { required: true, maxLength: 300 })}
        {campo("numeroPedido", "N.º de pedido o comprobante (opcional)", { maxLength: 40 })}
      </fieldset>

      <fieldset>
        <legend>3. Detalle del reclamo o queja</legend>
        <div className="tipo">
          <label className="chk">
            <input type="radio" name="tipo" checked={f.tipo === "reclamo"} onChange={() => poner("tipo", "reclamo")} />
            <span><strong>Reclamo</strong> — disconformidad con el producto o servicio</span>
          </label>
          <label className="chk">
            <input type="radio" name="tipo" checked={f.tipo === "queja"} onChange={() => poner("tipo", "queja")} />
            <span><strong>Queja</strong> — malestar por la atención al público</span>
          </label>
        </div>
        <div className="campo">
          <label htmlFor="lr-detalle">Detalle *</label>
          <textarea id="lr-detalle" rows={5} required maxLength={2000} value={f.detalle} onChange={(e) => poner("detalle", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="lr-pedido">Pedido del consumidor (qué solución esperas) *</label>
          <textarea id="lr-pedido" rows={3} required maxLength={1000} value={f.pedidoConsumidor} onChange={(e) => poner("pedidoConsumidor", e.target.value)} />
        </div>
      </fieldset>

      <label className="chk">
        <input type="checkbox" checked={f.acepta} onChange={(e) => poner("acepta", e.target.checked)} required />
        Declaro que los datos son verdaderos y acepto que {marca || "el proveedor"} me responda al correo indicado.
      </label>

      <div ref={caja} />
      {error && <p className="lr-error" role="alert">{error}</p>}
      <button className="btn btn-solido" type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar"}
      </button>
      <style>{estilos}</style>
    </form>
  );
}

const estilos = `
  .lr-form { display: grid; gap: 18px; }
  .lr-form fieldset { border: 1px solid var(--linea); border-radius: var(--radio); background: var(--blanco); padding: 16px; display: grid; gap: 12px; margin: 0; min-width: 0; }
  .lr-form legend { font-weight: 600; color: var(--tinta); padding: 0 6px; }
  .lr-form .fila { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .lr-form .campo { display: grid; gap: 4px; min-width: 0; }
  .lr-form label { font-size: 0.82rem; color: var(--tinta); }
  .lr-form input:not([type="checkbox"]):not([type="radio"]), .lr-form select, .lr-form textarea {
    width: 100%; font: inherit; padding: 9px 10px; border: 1px solid var(--linea); border-radius: var(--radio); background: #fff; color: inherit;
  }
  .lr-form input:focus, .lr-form select:focus, .lr-form textarea:focus { outline: 2px solid var(--rosa-tenue); border-color: var(--rosa); }
  .lr-form .chk { display: flex; gap: 8px; align-items: flex-start; font-size: 0.85rem; cursor: pointer; }
  .lr-form .chk input { margin-top: 3px; }
  .lr-form .tipo { display: grid; gap: 8px; }
  .lr-error { color: #b3261e; font-size: 0.88rem; }
  @media (max-width: 600px) { .lr-form .fila { grid-template-columns: 1fr; } }
  .lr-ok { background: var(--blanco); border: 1px solid var(--linea); border-radius: var(--radio); padding: 22px; display: grid; gap: 10px; }
  .lr-ok h2 { color: var(--rosa); }
  .lr-codigo { font-size: 1.1rem; }
  .lr-resumen { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: 0.88rem; margin: 6px 0; }
  .lr-resumen dt { color: var(--gris); }
  .lr-resumen dd { margin: 0; overflow-wrap: anywhere; }
  .lr-acciones { margin-top: 6px; }
  @media print { .lr-acciones { display: none; } }
`;
