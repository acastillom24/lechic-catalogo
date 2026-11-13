/**
 * Niveles de stock (módulo de datos puros: servidor y cliente).
 * Se calculan con unidades fijas para todo el catálogo; se editan en Configuración → Inventario
 * (tabla `configuracion`, clave "stock_niveles"). Variantes con `stock_actual` vacío no llevan cantidad
 * ("sin control"): solo se sabe si hay o no hay, así que no tienen nivel numérico.
 *
 *   agotado    stock <= 0                 (o sin control y marcada como no disponible)
 *   muy_bajo   1 .. umbrales.muy_bajo
 *   bajo       .. umbrales.bajo
 *   normal     .. umbrales.normal
 *   alto       .. umbrales.alto
 *   muy_alto   más que umbrales.alto
 *   sin_control
 */
const NIVELES = [
  { id: "agotado", nombre: "Agotado", color: "#c62828" },
  { id: "muy_bajo", nombre: "Muy bajo", color: "#d84315" },
  { id: "bajo", nombre: "Bajo", color: "#ef8f00" },
  { id: "normal", nombre: "Normal", color: "#2e7d32" },
  { id: "alto", nombre: "Alto", color: "#1565c0" },
  { id: "muy_alto", nombre: "Muy alto", color: "#6a1b9a" },
  { id: "sin_control", nombre: "Sin control", color: "#757575" },
];
const IDS = NIVELES.map((n) => n.id);
const CLAVES_UMBRAL = ["muy_bajo", "bajo", "normal", "alto"];

const DEFAULTS = {
  umbrales: { muy_bajo: 2, bajo: 5, normal: 20, alto: 50 },
  alertas: ["agotado", "muy_bajo", "bajo"],
};

/** Deja la configuración con forma válida; lo inválido cae a los valores por defecto. */
function normalizar(guardado) {
  const g = guardado && typeof guardado === "object" ? guardado : {};
  const u = g.umbrales && typeof g.umbrales === "object" ? g.umbrales : {};
  let umbrales = Object.fromEntries(CLAVES_UMBRAL.map((k) => [k, Number(u[k])]));
  const validos = CLAVES_UMBRAL.every((k, i) => Number.isInteger(umbrales[k]) && umbrales[k] >= 1 && umbrales[k] <= 1000000 && (i === 0 || umbrales[k] > umbrales[CLAVES_UMBRAL[i - 1]]));
  if (!validos) umbrales = { ...DEFAULTS.umbrales };
  const alertas = Array.isArray(g.alertas) ? IDS.filter((id) => g.alertas.includes(id)) : [...DEFAULTS.alertas];
  return { umbrales, alertas };
}

/** Nivel de una variante ({ stock_actual, stock }). */
function nivelDe(v, cfg = DEFAULTS) {
  const n = v.stock_actual;
  if (n === null || n === undefined) return v.stock ? "sin_control" : "agotado";
  const u = cfg.umbrales;
  const c = Number(n);
  if (c <= 0) return "agotado";
  if (c <= u.muy_bajo) return "muy_bajo";
  if (c <= u.bajo) return "bajo";
  if (c <= u.normal) return "normal";
  if (c <= u.alto) return "alto";
  return "muy_alto";
}

/** Condición SQL (alias `v`) de un nivel. Los umbrales son enteros validados, por eso van en línea. */
function condicionNivel(id, cfg = DEFAULTS) {
  const u = cfg.umbrales;
  return {
    agotado: "((v.stock_actual is not null and v.stock_actual <= 0) or (v.stock_actual is null and not v.stock))",
    muy_bajo: `(v.stock_actual > 0 and v.stock_actual <= ${u.muy_bajo})`,
    bajo: `(v.stock_actual > ${u.muy_bajo} and v.stock_actual <= ${u.bajo})`,
    normal: `(v.stock_actual > ${u.bajo} and v.stock_actual <= ${u.normal})`,
    alto: `(v.stock_actual > ${u.normal} and v.stock_actual <= ${u.alto})`,
    muy_alto: `(v.stock_actual > ${u.alto})`,
    sin_control: "(v.stock_actual is null and v.stock)",
  }[id];
}

/** Condición SQL de «en alerta»: cualquiera de los niveles marcados para la campana ("false" si no hay ninguno). */
function condicionAlertas(cfg = DEFAULTS) {
  const lista = cfg.alertas.map((id) => condicionNivel(id, cfg)).filter(Boolean);
  return lista.length ? `(${lista.join(" or ")})` : "false";
}

module.exports = { NIVELES, IDS, CLAVES_UMBRAL, DEFAULTS, normalizar, nivelDe, condicionNivel, condicionAlertas };
