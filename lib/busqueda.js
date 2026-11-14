/**
 * Búsqueda de productos del catálogo público (módulo puro: lo usan el navegador y el servidor).
 *
 * Buenas prácticas aplicadas:
 *  - Normalización de AMBOS lados (lo escrito y lo guardado): sin tildes ni diéresis, sin mayúsculas y sin signos, de modo
 *    que «pina» encuentra «Piña» y «perfume ámbar» encuentra «Perfume Ambar». La ñ cuenta como n.
 *  - Varias palabras = TODAS deben aparecer (en cualquier orden y en cualquier campo), y la última puede estar incompleta
 *    («perf muj» ya encuentra «Perfume Mujer»).
 *  - Ranking por campo: nombre > variante > marca/categoría > notas aromáticas > descripción; las coincidencias al inicio de
 *    una palabra valen más que las que están dentro de ella.
 *  - Tolerancia a errores de tipeo (hasta 1 error de letra, o 2 en palabras largas; una transposición cuenta como 1) solo para palabras de 4 o más
 *    letras y con la mitad del peso: lo exacto siempre sale primero.
 */

/** Sin tildes, en minúsculas y con solo letras, números y espacios simples. */
function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const palabrasDe = (normalizado) => (normalizado ? normalizado.split(" ") : []);

// Distancia de edición (inserción, borrado, cambio y transposición de letras vecinas = 1) con tope: devuelve tope + 1
// cuando ya se pasó. «labail» → «labial» cuenta como 1 error, no como 2.
function distancia(a, b, tope) {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  const n = a.length;
  const m = b.length;
  let anterior2 = null;
  let anterior = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const fila = [i];
    let minimo = i;
    for (let j = 1; j <= m; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(anterior[j] + 1, fila[j - 1] + 1, anterior[j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, anterior2[j - 2] + 1);
      fila.push(v);
      if (v < minimo) minimo = v;
    }
    if (minimo > tope) return tope + 1;
    anterior2 = anterior;
    anterior = fila;
  }
  return anterior[m];
}

// Peso de cada campo del producto en el ranking.
const { htmlATexto } = require("./html-texto");

const PESOS = { nombre: 10, variantes: 6, etiquetas: 4, notas: 3, descripcion: 1.5 };

/** Prepara un campo para buscar: texto normalizado (con espacios en los bordes) y lista de palabras. */
function campo(texto) {
  const n = normalizar(texto);
  return { texto: ` ${n} `, palabras: palabrasDe(n) };
}

/**
 * Índice de búsqueda para una lista de productos (formato público: nombre, descripcion, aromas, variantes[]).
 * `etiquetas(p)` puede devolver textos extra (marca, categoría…) que también se buscan.
 */
function prepararIndice(productos, etiquetas = () => []) {
  return (productos || []).map((p) => ({
    producto: p,
    campos: {
      nombre: campo(p.nombre),
      variantes: campo((p.variantes || []).map((v) => v.nombre).filter((n) => n && n !== "Único").join(" ")),
      etiquetas: campo([].concat(etiquetas(p) || []).join(" ")),
      notas: campo([...(p.aromas || []), ...(p.variantes || []).flatMap((v) => v.aromas || [])].join(" ")),
      descripcion: campo([p.descripcion, ...(p.variantes || []).map((v) => v.descripcion)].filter(Boolean).map(htmlATexto).join(" ")),
    },
    nombreCompleto: normalizar(p.nombre),
  }));
}

// Puntaje de una palabra buscada en un producto: 0 si no aparece en ningún campo.
function puntajeDePalabra(doc, palabra, esUltima) {
  let mejor = 0;
  for (const [nombre, c] of Object.entries(doc.campos)) {
    const peso = PESOS[nombre];
    if (!c.palabras.length) continue;
    // Palabra completa o comienzo de palabra (la última puede estar a medias).
    if (c.texto.includes(` ${palabra} `)) mejor = Math.max(mejor, peso * 1.3);
    else if (c.texto.includes(` ${palabra}`)) mejor = Math.max(mejor, peso * (esUltima ? 1.1 : 1));
    else if (c.texto.includes(palabra)) mejor = Math.max(mejor, peso * 0.6);
    // Error de tipeo: palabras parecidas (solo si la palabra es de 4+ letras).
    if (mejor === 0 && palabra.length >= 4) {
      const tope = palabra.length >= 8 ? 2 : 1;
      for (const w of c.palabras) {
        if (w.length < 3) continue;
        // Se compara con la palabra completa y, para la última, también con su comienzo.
        const d = Math.min(distancia(w, palabra, tope), esUltima ? distancia(w.slice(0, palabra.length), palabra, tope) : tope + 1);
        if (d <= tope) {
          mejor = Math.max(mejor, peso * 0.5);
          break;
        }
      }
    }
  }
  return mejor;
}

/**
 * Busca en un índice (de prepararIndice). Devuelve los productos que contienen TODAS las palabras, del más al menos
 * relevante. Sin texto devuelve lista vacía.
 */
function buscarEnIndice(indice, consulta, { limite = 0 } = {}) {
  const palabras = palabrasDe(normalizar(consulta));
  if (!palabras.length) return [];
  const completa = palabras.join(" ");
  const resultados = [];
  for (const doc of indice) {
    let total = 0;
    let completo = true;
    for (let i = 0; i < palabras.length; i++) {
      const p = puntajeDePalabra(doc, palabras[i], i === palabras.length - 1);
      if (p === 0) {
        completo = false;
        break;
      }
      total += p;
    }
    if (!completo) continue;
    // Bonus si lo escrito aparece tal cual en el nombre.
    if (palabras.length > 1 && doc.nombreCompleto.includes(completa)) total += PESOS.nombre;
    resultados.push({ producto: doc.producto, puntaje: total });
  }
  resultados.sort((a, b) => b.puntaje - a.puntaje || String(a.producto.nombre).localeCompare(String(b.producto.nombre), "es"));
  const lista = resultados.map((r) => r.producto);
  return limite > 0 ? lista.slice(0, limite) : lista;
}

/** Atajo: indexa y busca en una sola llamada (para listas pequeñas, como los productos de una pestaña). */
function buscarProductos(productos, consulta, opciones) {
  return buscarEnIndice(prepararIndice(productos, opciones?.etiquetas), consulta, opciones);
}

module.exports = { normalizar, prepararIndice, buscarEnIndice, buscarProductos, distancia };
