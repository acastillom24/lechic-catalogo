"use client";

import { useState } from "react";
import { consultarAtributosSaga } from "../../app/(admin)/admin/actions";

const ETIQUETA_TIPO = { multi: "varias opciones", lista: "una opción", texto: "texto", numero: "número" };
const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Resultados ya consultados por categoría de SAGA (se comparten entre todos los atributos de la pantalla).
const cache = new Map();

// Requisitos estrictos de SAGA: se resaltan en amarillo.
const AMARILLO = { background: "#fff6cc", border: "1px solid #ecd36a", color: "#6b5200", borderRadius: 8, padding: "6px 10px", fontSize: ".85rem" };

/**
 * Debajo de un atributo propio de la web: consulta en SAGA los requisitos de los atributos de una categoría (tipo, obligatorio,
 * largo mínimo/máximo, lista de valores exactos) y permite APLICARLOS al atributo (tipo, opciones y largos) o copiar sus opciones.
 * `onAplicar({ tipo, opciones, min, max, etiqueta })` actualiza el atributo; no guarda nada hasta «Guardar».
 */
export default function ConsultaSagaAtributo({ categoriasSaga = [], etiquetaActual = "", onAplicar }) {
  const [cat, setCat] = useState(categoriasSaga[0] ? String(categoriasSaga[0].id) : "");
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [q, setQ] = useState("");
  const [aviso, setAviso] = useState("");

  async function consultar(c = cat) {
    setError("");
    setLista(null);
    if (cache.has(c)) return setLista(cache.get(c));
    setCargando(true);
    const r = await consultarAtributosSaga(c);
    setCargando(false);
    if (r?.error) return setError(r.error);
    cache.set(c, r.atributos);
    setLista(r.atributos);
  }

  const texto = norm(q);
  const coincide = (lista || []).filter((a) => !texto || norm(a.etiqueta).includes(texto) || norm(a.id).includes(texto));
  // El código exacto (ej. ColorVariant) va primero.
  const visibles = [...coincide].sort((a, b) => Number(norm(b.id) === texto) - Number(norm(a.id) === texto)).slice(0, 12);

  const copiar = async (a) => {
    try {
      await navigator.clipboard.writeText(a.opciones.join("\n"));
      setAviso(`Opciones de «${a.etiqueta}» copiadas.`);
    } catch {
      setAviso("No se pudo copiar; usa «Aplicar».");
    }
  };
  const aplicar = (a) => {
    // Una lista sin valores definidos por SAGA es libre: se aplica como texto (una lista vacía no se podría guardar).
    const libre = (a.tipo === "lista" || a.tipo === "multi") && !a.opciones.length;
    const tipo = libre ? "texto" : a.tipo;
    onAplicar({
      tipo,
      opciones: a.truncada ? [...a.opciones, "…"] : a.opciones, // «…» = lista abierta: acepta valores libres
      min: tipo === "texto" && a.min ? String(a.min) : "",
      max: tipo === "texto" && a.max ? String(a.max) : "",
      etiqueta: etiquetaActual.trim() ? undefined : a.etiqueta,
    });
    setAviso(`Requisitos de «${a.etiqueta}» aplicados (tipo, opciones y largos)${a.truncada ? "; la lista queda abierta (acepta valores libres)" : ""}. Revisa y guarda.`);
  };

  return (
    <details className="saga-seccion pf-sub">
      <summary>
        Traer requisitos de SAGA <em>tipo, largos y lista de valores</em>
      </summary>
      <div className="saga-cuerpo form-grid">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div className="campo" style={{ minWidth: 220 }}>
            <label>Categoría de SAGA</label>
            <select value={cat} onChange={(e) => { setCat(e.target.value); setLista(null); setError(""); }}>
              {categoriasSaga.map((c) => <option key={c.id} value={String(c.id)}>{c.id} — {c.nombre}</option>)}
            </select>
          </div>
          <div className="campo" style={{ flex: 1, minWidth: 220 }}>
            <label>Código del atributo en SAGA <em>FeedName</em></label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); consultar(); } }}
              placeholder="ej. ColorVariant (o parte del nombre)"
            />
          </div>
          <button type="button" className="btn-admin" disabled={cargando || !cat} onClick={() => consultar()}>
            {cargando ? "Consultando…" : lista ? "Volver a consultar" : "Consultar"}
          </button>
        </div>
        {error && <div className="mensaje-error">{error}</div>}
        {aviso && <small style={{ color: "#1e5b2f" }}>{aviso}</small>}
        {lista && !visibles.length && <small style={{ color: "var(--gris)" }}>Ningún atributo de esta categoría coincide con ese código o nombre.</small>}
        {visibles.map((a) => (
          <div key={a.id} className="pf-eq-bloque" style={{ display: "grid", gap: 4 }}>
            <strong>{a.etiqueta} <small style={{ color: "var(--gris)" }}>{a.id}</small></strong>
            <small>
              {ETIQUETA_TIPO[a.tipo]} · {a.obligatorio ? "obligatorio" : "opcional"} · {a.nivel === "variante" ? "por variante" : "por producto"}
              {a.tipo === "texto" && (a.min || a.max) ? ` · largo ${a.min ? `mín. ${a.min}` : ""}${a.min && a.max ? " / " : ""}${a.max ? `máx. ${a.max}` : ""} caracteres` : ""}
              {a.opciones.length ? ` · ${a.opciones.length} opciones${a.truncada ? " (lista parcial)" : ""}` : ""}
            </small>
            {a.descripcion && <small style={{ color: "var(--gris)" }}>{a.descripcion}</small>}
            {(a.tipo === "lista" || a.tipo === "multi") && a.opciones.length > 0 && a.truncada && (
              <div style={AMARILLO} role="note">
                ⚠ Lista parcial ({a.opciones.length} valores): SAGA la devuelve cortada con «…», así que también acepta otros valores que no aparecen aquí. Los listados son los confirmados; si necesitas otro, agrégalo a las opciones del atributo (escrito tal como lo pide SAGA).
              </div>
            )}
            {(a.tipo === "lista" || a.tipo === "multi") && a.opciones.length > 0 && !a.truncada && (
              <div style={AMARILLO} role="note">
                ⚠ Valores permitidos ({a.opciones.length}): SAGA solo acepta {a.tipo === "multi" ? "opciones de esta lista (se envían separadas por coma)" : "uno de estos valores"}, escritos EXACTAMENTE así (mayúsculas, tildes y espacios). Cualquier otro valor se rechaza o se omite.
              </div>
            )}
            {(a.tipo === "lista" || a.tipo === "multi") && !a.opciones.length && (
              <small style={{ color: "var(--gris)" }}>SAGA no define una lista de valores para este atributo: es libre. Al aplicarlo se creará como texto.</small>
            )}
            {a.tipo === "texto" && (a.min || a.max) && (
              <div style={AMARILLO} role="note">
                ⚠ Largo exigido por SAGA: {a.min ? `mínimo ${a.min}` : ""}{a.min && a.max ? " y " : ""}{a.max ? `máximo ${a.max}` : ""} caracteres.
              </div>
            )}
            {a.opciones.length > 0 && (
              <small style={{ color: "var(--gris)", maxHeight: 64, overflow: "auto" }}>{a.opciones.join(" · ")}</small>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-admin solido" onClick={() => aplicar(a)}>Aplicar a este atributo</button>
              {a.opciones.length > 0 && <button type="button" className="btn-admin" onClick={() => copiar(a)}>Copiar opciones</button>}
            </div>
          </div>
        ))}
        {coincide.length > visibles.length && (
          <small style={{ color: "var(--gris)" }}>Mostrando los primeros {visibles.length}; afina la búsqueda.</small>
        )}
      </div>
    </details>
  );
}
