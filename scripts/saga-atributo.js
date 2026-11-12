// Muestra los REQUISITOS completos de los atributos de una categoría de SAGA (solo lectura: GetCategoryAttributes).
// A diferencia de saga:campos (que guarda un resumen en data/saga-campos.json), este script no escribe nada: imprime todo lo
// que SAGA informa de cada atributo (tipo de entrada, obligatorio, largo máximo, lista de valores, y cualquier otro dato que
// venga en la respuesta) para saber qué acepta antes de configurarlo.
//
//   npm run saga:atributo -- 2945                          -> resumen de TODOS los atributos de la categoría (una línea c/u)
//   npm run saga:atributo -- 2945 TipoMaquillajeOjos       -> detalle completo de ese atributo (FeedName exacto)
//   npm run saga:atributo -- 2945 maquillaje               -> detalle de los que contengan ese texto (FeedName o etiqueta)
//   npm run saga:atributo -- 2945 TipoMaquillajeOjos --json -> respuesta cruda de SAGA (útil si falta algún dato)
//   Opciones: --json (crudo), --obligatorios (solo obligatorios en el resumen)
const sc = require("../lib/sellercenter");

const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const TIPOS = { dropdown: "una opción", multiselect: "varias opciones", numberfield: "número", textfield: "texto" };
const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Campos que ya mostramos con formato propio; el resto de lo que traiga SAGA se imprime tal cual.
const CONOCIDOS = new Set(["FeedName", "Label", "InputType", "isMandatory", "MaxLength", "GroupName", "Options"]);

function opcionesDe(a) {
  return lista(a.Options?.Option).filter((o) => o?.Name && o.Name !== "…"); // SAGA agrega "…" de relleno en listas largas
}

function resumen(a) {
  const ops = opcionesDe(a);
  const max = Number(a.MaxLength);
  return [
    a.FeedName,
    TIPOS[a.InputType] || a.InputType,
    a.isMandatory === "1" ? "OBLIGATORIO" : "opcional",
    a.GroupName,
    ops.length ? `${ops.length} opciones` : "",
    max > 0 ? `máx ${max} car.` : "",
  ].filter(Boolean).join(" · ");
}

function detalle(a) {
  const ops = opcionesDe(a);
  const max = Number(a.MaxLength);
  const out = [];
  out.push(`${a.Label}`);
  out.push(`  FeedName:    ${a.FeedName}`);
  out.push(`  Tipo:        ${TIPOS[a.InputType] || a.InputType} (InputType=${a.InputType})`);
  out.push(`  Obligatorio: ${a.isMandatory === "1" ? "sí" : "no"}`);
  out.push(`  Grupo:       ${a.GroupName}${a.GroupName === "Variation" ? " (por variante)" : a.GroupName === "Product Specifications" ? " (por producto)" : ""}`);
  out.push(`  Largo máx.:  ${max > 0 ? `${max} caracteres` : "no informado"}`);
  const extra = Object.entries(a).filter(([k, v]) => !CONOCIDOS.has(k) && v !== "" && v != null && !(typeof v === "object" && !Object.keys(v).length));
  for (const [k, v] of extra) out.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  if (a.InputType === "dropdown" || a.InputType === "multiselect") {
    out.push(`  Valores permitidos (${ops.length}) — deben enviarse EXACTAMENTE así:`);
    for (const o of ops) {
      const otros = Object.entries(o).filter(([k, v]) => k !== "Name" && v !== "" && v != null);
      out.push(`    - ${o.Name}${otros.length ? `   (${otros.map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`);
    }
    if (a.InputType === "multiselect") out.push(`  (varias opciones se envían separadas por coma)`);
  }
  return out.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const banderas = new Set(args.filter((x) => x.startsWith("--")));
  const pos = args.filter((x) => !x.startsWith("--"));
  const [categoria, ...filtro] = pos;
  if (!/^\d+$/.test(categoria || "")) {
    console.error("Uso: npm run saga:atributo -- <idCategoria> [FeedName o texto] [--json] [--obligatorios]");
    process.exit(1);
  }
  const cred = sc.credenciales({
    alias: "env",
    user_id: process.env.SELLERCENTER_USER_ID,
    api_key: process.env.SELLERCENTER_API_KEY,
    base_url: process.env.SELLERCENTER_BASE_URL,
  });
  const respuesta = await sc.atributosCategoria(cred, categoria);
  let atributos = lista(respuesta?.Body?.Attribute);
  if (!atributos.length) {
    console.error(`Categoría ${categoria}: SAGA no devolvió atributos (¿id correcto? ¿es una categoría hoja?).`);
    process.exit(1);
  }
  const texto = norm(filtro.join(" "));
  if (texto) {
    const exactos = atributos.filter((a) => norm(a.FeedName) === texto);
    atributos = exactos.length ? exactos : atributos.filter((a) => norm(a.FeedName).includes(texto) || norm(a.Label).includes(texto));
    if (!atributos.length) {
      console.error(`Ningún atributo de la categoría ${categoria} coincide con «${filtro.join(" ")}».`);
      process.exit(1);
    }
  }
  if (banderas.has("--json")) {
    console.log(JSON.stringify(texto ? atributos : respuesta, null, 2));
    return;
  }
  if (texto) {
    console.log(atributos.map(detalle).join("\n\n"));
    return;
  }
  const lineas = atributos.filter((a) => !banderas.has("--obligatorios") || a.isMandatory === "1");
  console.log(`Categoría ${categoria}: ${atributos.length} atributos (${atributos.filter((a) => a.isMandatory === "1").length} obligatorios)\n`);
  for (const a of lineas) console.log(`${a.Label}\n  ${resumen(a)}`);
  console.log(`\nDetalle de uno: npm run saga:atributo -- ${categoria} <FeedName>`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
