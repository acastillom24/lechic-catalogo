/**
 * HTML permitido para la descripción de un producto (editor de texto enriquecido). Módulo de datos puros (servidor y cliente).
 * Deja solo etiquetas de formato inofensivas y atributos seguros: sin scripts, eventos (onclick…), estilos peligrosos ni enlaces
 * que no sean http/https/mailto/tel. Se usa al guardar y al mostrar la descripción.
 */
const ETIQUETAS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "sub", "sup", "span", "mark", "ul", "ol", "li",
  "h2", "h3", "h4", "a", "img", "hr", "code", "pre", "blockquote", "div",
]);
const VACIAS = new Set(["br", "hr", "img"]);
const ESTILOS = new Set(["color", "background-color", "text-align", "font-weight", "font-style", "text-decoration"]);
const VALOR_ESTILO = /^[#a-zA-Z0-9(),.%\s-]{1,60}$/;

const atributo = (attrs, nombre) => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
};
const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const desescapar = (t) => String(t).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function estiloSeguro(valor) {
  const salida = [];
  for (const par of String(valor || "").split(";")) {
    const i = par.indexOf(":");
    if (i < 0) continue;
    const k = par.slice(0, i).trim().toLowerCase();
    const v = par.slice(i + 1).trim();
    if (ESTILOS.has(k) && VALOR_ESTILO.test(v) && !/url\s*\(|expression/i.test(v)) salida.push(`${k}: ${v}`);
  }
  return salida.join("; ");
}

/** ¿El texto trae etiquetas HTML? (si no, es una descripción de texto plano antigua). */
const esHtml = (t) => /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(String(t || ""));

/** Texto plano antiguo → HTML (párrafos por línea en blanco, saltos simples como <br>). */
function textoAHtml(t) {
  const limpio = String(t || "").replace(/\r\n?/g, "\n").trim();
  if (!limpio) return "";
  return limpio
    .split(/\n{2,}/)
    .map((p) => `<p>${escapar(p).replace(/&amp;(amp|lt|gt|quot);/g, "&$1;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Deja solo el HTML permitido. Lo que no es HTML (texto plano antiguo) se devuelve tal cual. */
function limpiarHtml(html) {
  const original = String(html ?? "");
  if (!esHtml(original)) return original.trim();
  const sinPeligro = original
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  return sinPeligro
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, nombre, attrs) => {
      const tag = nombre.toLowerCase();
      if (!ETIQUETAS.has(tag)) return "";
      if (m.startsWith("</")) return VACIAS.has(tag) ? "" : `</${tag}>`;
      const partes = [];
      const estilo = atributo(attrs, "style");
      if (estilo !== null && estiloSeguro(desescapar(estilo))) partes.push(`style="${escapar(estiloSeguro(desescapar(estilo)))}"`);
      if (tag === "a") {
        const href = (atributo(attrs, "href") || "").trim();
        if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) partes.push(`href="${escapar(desescapar(href))}"`, 'target="_blank"', 'rel="noopener noreferrer"');
      }
      if (tag === "img") {
        const src = (atributo(attrs, "src") || "").trim();
        if (!/^https:\/\//i.test(src)) return "";
        partes.push(`src="${escapar(desescapar(src))}"`);
        const alt = atributo(attrs, "alt");
        if (alt !== null) partes.push(`alt="${escapar(desescapar(alt).slice(0, 200))}"`);
      }
      return `<${tag}${partes.length ? " " + partes.join(" ") : ""}>`;
    });
}

module.exports = { limpiarHtml, esHtml, textoAHtml };
