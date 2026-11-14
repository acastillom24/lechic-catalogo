/**
 * Tema de los gráficos del dashboard (Recharts). Paleta categórica validada con el validador del skill dataviz
 * (fondo blanco): la marca va primero y los matices se asignan siempre en este orden, nunca ciclados.
 * Más de 5 categorías se agrupan en «Otros» (gris neutro).
 */
export const CATEGORICOS = ["#e8267f", "#2a78d6", "#1baf7a", "#eda100", "#6250d6"];
export const OTROS = "#b9a5b0";
export const COLOR_ACTUAL = "#e8267f";
export const COLOR_PREVIO = "#8c6f7d";

/** Estados (reservados, siempre con su nombre en la leyenda). */
export const ESTADO = { bien: "#2e7d32", aviso: "#eda100", grave: "#c62828", neutro: "#b9a5b0" };

export const TICK = { fontSize: 11, fill: "#8c6f7d" };
export const LINEA = "#ead9d0";

/** S/ 1.2k, S/ 15k, S/ 480 (para ejes, donde el espacio es poco). */
export const solesCorto = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000) return `S/ ${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `S/ ${(v / 1000).toFixed(1).replace(".0", "")}k`;
  return `S/ ${Math.round(v)}`;
};

/**
 * Top `max` categorías; el resto se suma en «Otros». `fijos` ({ NOMBRE: "#hex" }) da un color propio a ciertas
 * categorías (el color sigue a la entidad, no a su posición); las demás toman en orden los colores de la paleta
 * que no estén ya usados por una categoría fija.
 */
export function agruparTop(datos, max = 5, fijos = {}) {
  const orden = [...datos].sort((a, b) => b.monto - a.monto);
  const libres = CATEGORICOS.filter((c) => !Object.values(fijos).includes(c));
  let k = 0;
  const top = orden.slice(0, max).map((d) => ({ ...d, color: fijos[d.nombre] || libres[k++] || OTROS }));
  const resto = orden.slice(max);
  if (resto.length) {
    top.push({
      nombre: `Otros (${resto.length})`,
      monto: resto.reduce((s, d) => s + d.monto, 0),
      n: resto.reduce((s, d) => s + (d.n || 0), 0) || undefined,
      color: OTROS,
    });
  }
  return top;
}
