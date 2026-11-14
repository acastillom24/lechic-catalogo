"use client";

import { useEffect, useRef, useState } from "react";
import { limpiarHtml, esHtml, textoAHtml } from "../../lib/html-limpio";

/**
 * Editor de texto enriquecido de la descripción (como el de Seller Center): deshacer/rehacer, párrafo/títulos, negrita, cursiva, subrayado,
 * tachado, subíndice, superíndice, color y resaltado, alineación, listas, enlace, imagen, línea, HTML y quitar formato. Guarda HTML
 * limpio (solo etiquetas y estilos permitidos, ver lib/html-limpio.js) en el campo `name`. La descripción antigua en texto plano se
 * convierte a párrafos al abrirla. `valor` es el HTML actual y `onChange(html)` avisa de cada cambio.
 */
export default function EditorDescripcion({ id = "descripcion", name = "descripcion", valor, onChange, etiqueta = "Descripción" }) {
  const area = useRef(null);
  const [codigo, setCodigo] = useState(false);
  const [html, setHtml] = useState(() => (esHtml(valor) ? limpiarHtml(valor) : textoAHtml(valor)));
  const [vacio, setVacio] = useState(!(valor || "").trim());

  // Contenido inicial del área editable (después se edita directamente: no se vuelve a pisar mientras se escribe).
  useEffect(() => {
    if (area.current) area.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la descripción cambia desde fuera (p. ej. «Traer de SAGA»), el área la muestra; mientras se escribe en ella no se pisa.
  useEffect(() => {
    const nuevo = esHtml(valor) ? limpiarHtml(valor) : textoAHtml(valor);
    if (nuevo === html || (area.current && document.activeElement === area.current)) return;
    setHtml(nuevo);
    setVacio(!(valor || "").trim());
    if (area.current && !codigo) area.current.innerHTML = nuevo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const avisar = (nuevo) => {
    const limpio = limpiarHtml(nuevo);
    setHtml(limpio);
    setVacio(!area.current?.textContent?.trim() && !/<img|<hr/i.test(nuevo));
    onChange?.(limpio);
  };
  const alEscribir = () => avisar(area.current.innerHTML);
  const orden = (cmd, valorCmd = null) => {
    area.current?.focus();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, valorCmd);
    alEscribir();
  };
  const enlace = () => {
    const url = window.prompt("Dirección del enlace (https://…)", "https://");
    if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) orden("createLink", url.trim());
  };
  const imagen = () => {
    const url = window.prompt("Dirección de la imagen (https://…)", "https://");
    if (url && /^https:\/\//i.test(url.trim())) orden("insertImage", url.trim());
  };
  const pegarSinFormato = (e) => {
    // Pegar texto plano: evita arrastrar estilos y etiquetas de otras páginas.
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, t);
  };
  const cambiarCodigo = () => {
    if (codigo && area.current) area.current.innerHTML = html;
    setCodigo(!codigo);
  };

  const Btn = ({ cmd, titulo, children, onClick }) => (
    <button
      type="button"
      className="ed-btn"
      title={titulo}
      aria-label={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick || (() => orden(cmd))}
    >
      {children}
    </button>
  );
  const Sep = () => <span className="ed-sep" aria-hidden="true" />;

  return (
    <div className="campo ed">
      <label htmlFor={id}>{etiqueta}</label>
      <input type="hidden" name={name} value={html} />
      <div className="ed-caja">
        <div className="ed-barra" role="toolbar" aria-label="Formato de la descripción">
          <Btn cmd="undo" titulo="Deshacer">↶</Btn>
          <Btn cmd="redo" titulo="Rehacer">↷</Btn>
          <Sep />
          <select
            className="ed-bloque"
            aria-label="Estilo del párrafo"
            defaultValue="p"
            onChange={(e) => {
              orden("formatBlock", e.target.value);
              e.target.value = "p";
            }}
          >
            <option value="p">Párrafo</option>
            <option value="h2">Título</option>
            <option value="h3">Subtítulo</option>
            <option value="blockquote">Cita</option>
          </select>
          <Sep />
          <Btn cmd="bold" titulo="Negrita"><b>B</b></Btn>
          <Btn cmd="italic" titulo="Cursiva"><i>I</i></Btn>
          <Btn cmd="underline" titulo="Subrayado"><u>U</u></Btn>
          <Btn cmd="strikeThrough" titulo="Tachado"><s>S</s></Btn>
          <Btn cmd="subscript" titulo="Subíndice">x<sub>2</sub></Btn>
          <Btn cmd="superscript" titulo="Superíndice">x<sup>2</sup></Btn>
          <Sep />
          <label className="ed-btn ed-color" title="Color del texto" onMouseDown={(e) => e.stopPropagation()}>
            A
            <input type="color" defaultValue="#c2185b" onChange={(e) => orden("foreColor", e.target.value)} aria-label="Color del texto" />
          </label>
          <label className="ed-btn ed-color" title="Resaltar" onMouseDown={(e) => e.stopPropagation()}>
            ▮
            <input type="color" defaultValue="#fff59d" onChange={(e) => orden("hiliteColor", e.target.value)} aria-label="Color de resaltado" />
          </label>
          <Sep />
          <Btn cmd="justifyLeft" titulo="Alinear a la izquierda">≡</Btn>
          <Btn cmd="justifyCenter" titulo="Centrar">☰</Btn>
          <Btn cmd="justifyRight" titulo="Alinear a la derecha">≣</Btn>
          <Btn cmd="justifyFull" titulo="Justificar">▤</Btn>
          <Sep />
          <Btn cmd="insertUnorderedList" titulo="Lista con viñetas">• ≡</Btn>
          <Btn cmd="insertOrderedList" titulo="Lista numerada">1.≡</Btn>
          <Sep />
          <Btn titulo="Insertar enlace" onClick={enlace}>🔗</Btn>
          <Btn cmd="unlink" titulo="Quitar enlace">⛓</Btn>
          <Btn titulo="Insertar imagen (URL)" onClick={imagen}>🖼</Btn>
          <Btn cmd="insertHorizontalRule" titulo="Línea horizontal">—</Btn>
          <Btn titulo={codigo ? "Volver al editor" : "Ver y editar el HTML"} onClick={cambiarCodigo}>{"</>"}</Btn>
          <Btn cmd="removeFormat" titulo="Quitar formato">Tx</Btn>
        </div>
        <div className="ed-zona">
          <div
            id={id}
            ref={area}
            className="ed-area"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={etiqueta}
            data-vacio={vacio ? "1" : undefined}
            data-placeholder="Escribe la descripción del producto…"
            onInput={alEscribir}
            onBlur={alEscribir}
            onPaste={pegarSinFormato}
            style={codigo ? { display: "none" } : undefined}
          />
          {codigo && (
            <textarea
              className="ed-codigo"
              aria-label="HTML de la descripción"
              value={html}
              spellCheck={false}
              onChange={(e) => {
                setHtml(e.target.value);
                onChange?.(limpiarHtml(e.target.value));
              }}
              onBlur={(e) => {
                const limpio = limpiarHtml(e.target.value);
                setHtml(limpio);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
