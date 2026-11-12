/**
 * Convierte HTML en texto plano conservando la forma: saltos de línea (<br>, párrafos, listas, bloques),
 * viñetas en los <li> y espacios normales. Quita etiquetas, estilos y scripts, y decodifica entidades.
 * Módulo de datos puros (sin dependencias), usable en servidor y cliente.
 */
const ENTIDADES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·",
  iexcl: "¡", iquest: "¿", deg: "°", reg: "®", copy: "©", trade: "™", euro: "€",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
};

function decodificar(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
      } catch {
        return m;
      }
    }
    return Object.prototype.hasOwnProperty.call(ENTIDADES, e) ? ENTIDADES[e] : m;
  });
}

/** HTML → texto plano con saltos de línea y viñetas. Si no hay HTML, devuelve el texto tal cual (sin espacios a los lados). */
function htmlATexto(html) {
  if (html === null || html === undefined) return "";
  const original = String(html);
  if (!/[<&]/.test(original)) return original.trim();

  const texto = original
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    // Viñetas: los <p> dentro de un <li> no deben partir la línea de la viñeta.
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi, (m, dentro) => `\n• ${dentro.replace(/<\/?p\b[^>]*>/gi, "")}`)
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|h[1-6]|blockquote)\s*>/gi, "\n\n")
    .replace(/<\/(div|li|ul|ol|tr|table|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n")
    .replace(/<(p|div|ul|ol|h[1-6]|table|tr|section|article|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "");

  return decodificar(texto)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = { htmlATexto };
