// Búsquedas de solo lectura en la instancia Mirakl de Ripley (equivalente a saga:probar / saga:atributo).
// Usa RIPLEY_BASE_URL y RIPLEY_API_KEY de .env.development. Los textos se buscan sin distinguir mayúsculas ni
// tildes, y varias palabras se combinan con "y" (ej. "perfum mujer").
//
//   npm run ripley:categorias -- perfum            -> categorías cuya ruta contenga "perfum"
//   npm run ripley:categorias -- perfum --hojas    -> solo las hojas (las que aceptan productos)
//   npm run ripley:categorias -- --raices          -> solo las categorías de primer nivel
//   npm run ripley:categorias -- --hijos R300600000000   -> hijos directos de esa categoría
//   npm run ripley:categorias -- --codigo R300601000000  -> una categoría con su ruta completa
//
//   npm run ripley:atributos -- R300601000000              -> atributos de la categoría (una línea c/u)
//   npm run ripley:atributos -- R300601000000 aroma        -> solo los que contengan ese texto (código o etiqueta)
//   npm run ripley:atributos -- R300601000000 --requeridos -> solo los obligatorios
//
//   npm run ripley:atributo -- R300601000000 tipo_perfume  -> detalle completo de un atributo (código exacto) + sus valores
//   npm run ripley:atributo -- R300601000000 tipo_perfume --json -> respuesta cruda de Mirakl
//
//   npm run ripley:lista -- tipo_perfume                   -> valores de una lista
//   npm run ripley:lista -- marca_list yanbal              -> solo los valores que contengan ese texto
//   npm run ripley:lista -- --buscar color                 -> busca listas por código o etiqueta
//
//   npm run ripley:marca -- cavalli                        -> atajo: busca en marca_list (nombre exacto que acepta Ripley)
const mk = require("../lib/mirakl");

const plano = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Todas las palabras del texto deben aparecer en `donde` (sin tildes ni mayúsculas). */
const coincide = (donde, texto) => {
  const d = plano(donde);
  return plano(texto).split(/\s+/).filter(Boolean).every((p) => d.includes(p));
};

function credencialesEnv() {
  const base_url = process.env.RIPLEY_BASE_URL;
  const api_key = process.env.RIPLEY_API_KEY;
  if (!base_url || !api_key) {
    console.error("Define RIPLEY_BASE_URL y RIPLEY_API_KEY en .env.development.");
    process.exit(1);
  }
  return mk.credenciales({ alias: "env", base_url, api_key });
}

/** Separa opciones (--x) de argumentos. `conValor` = opciones que toman el siguiente argumento. */
function leerArgs(argv, conValor = []) {
  const args = [];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) args.push(a);
    else if (conValor.includes(a)) op[a] = argv[++i];
    else op[a] = true;
  }
  return { args, op };
}

// ---------- categorías ----------

async function categorias(cred, argv) {
  const { args, op } = leerArgs(argv, ["--hijos", "--codigo"]);
  const nodos = await mk.jerarquias(cred);
  const porCodigo = new Map(nodos.map((n) => [n.code, n]));
  const conHijos = new Set(nodos.map((n) => n.parent_code).filter(Boolean));
  const ruta = (n) => (n.parent_code && porCodigo.has(n.parent_code) ? `${ruta(porCodigo.get(n.parent_code))} > ${n.label}` : n.label);
  const texto = args.join(" ");

  let filas = nodos;
  if (op["--codigo"]) filas = nodos.filter((n) => n.code === op["--codigo"]);
  else if (op["--hijos"]) filas = nodos.filter((n) => n.parent_code === op["--hijos"]);
  else if (op["--raices"]) filas = nodos.filter((n) => !n.parent_code || !porCodigo.has(n.parent_code));
  if (op["--hojas"]) filas = filas.filter((n) => !conHijos.has(n.code));

  filas = filas.map((n) => ({ n, r: ruta(n) })).filter(({ r, n }) => !texto || coincide(`${n.code} ${r}`, texto));
  if (!filas.length) return console.log("Sin resultados.");
  for (const { n, r } of filas) console.log(`${n.code}\t${conHijos.has(n.code) ? " " : "★"}\t${r}`);
  console.log(`\n${filas.length} categoría(s). ★ = hoja (acepta productos).`);
}

// ---------- atributos ----------

const resumenAtributo = (a) =>
  [a.code, a.type, a.required ? "REQUERIDO" : "", a.variant ? "variante" : "", a.type_parameter || "", a.label].filter(Boolean).join("\t");

async function atributos(cred, argv) {
  const { args, op } = leerArgs(argv);
  const [cat, ...resto] = args;
  if (!cat) return console.error("Indica el código de categoría. Ej.: npm run ripley:atributos -- R300601000000");
  const texto = resto.join(" ");
  let lista = await mk.atributos(cred, { jerarquia: cat });
  if (op["--requeridos"]) lista = lista.filter((a) => a.required);
  if (texto) lista = lista.filter((a) => coincide(`${a.code} ${a.label}`, texto));
  if (!lista.length) return console.log("Sin resultados.");
  for (const a of lista) console.log(resumenAtributo(a));
  console.log(`\n${lista.length} atributo(s). Detalle: npm run ripley:atributo -- ${cat} <codigo>`);
}

async function atributo(cred, argv) {
  const { args, op } = leerArgs(argv);
  const [cat, codigo] = args;
  if (!cat || !codigo) return console.error("Uso: npm run ripley:atributo -- <categoria> <codigo_atributo> [--json]");
  const lista = await mk.atributos(cred, { jerarquia: cat });
  let encontrados = lista.filter((a) => a.code === codigo);
  if (!encontrados.length) encontrados = lista.filter((a) => coincide(`${a.code} ${a.label}`, codigo));
  if (!encontrados.length) return console.log(`La categoría ${cat} no tiene un atributo "${codigo}".`);

  for (const a of encontrados) {
    if (op["--json"]) {
      console.log(JSON.stringify(a, null, 2));
      continue;
    }
    console.log(`\n== ${a.code} — ${a.label} ==`);
    for (const [k, v] of Object.entries(a)) {
      if (["code", "label"].includes(k) || v === null || v === undefined || v === "") continue;
      console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
    if (a.type === "LIST" && a.type_parameter) {
      const listas = await mk.listasValores(cred, { codigo: a.type_parameter });
      const valores = listas.flatMap((l) => l.values || []);
      console.log(`  valores de la lista "${a.type_parameter}" (${valores.length}):`);
      for (const v of valores.slice(0, 60)) console.log(`    - ${v.code}${v.label && v.label !== v.code ? `  (${v.label})` : ""}`);
      if (valores.length > 60) console.log(`    … y ${valores.length - 60} más. Busca con: npm run ripley:lista -- ${a.type_parameter} <texto>`);
    }
  }
}

// ---------- listas de valores ----------

async function lista(cred, argv) {
  const { args, op } = leerArgs(argv, ["--buscar"]);
  if (op["--buscar"]) {
    const todas = await mk.listasValores(cred);
    const f = todas.filter((l) => coincide(`${l.code} ${l.label}`, op["--buscar"]));
    if (!f.length) return console.log("Sin resultados.");
    for (const l of f) console.log(`${l.code}\t${l.label}`);
    return console.log(`\n${f.length} lista(s).`);
  }
  const [codigo, ...resto] = args;
  if (!codigo) return console.error("Indica el código de la lista. Ej.: npm run ripley:lista -- tipo_perfume  (o --buscar <texto>)");
  const texto = resto.join(" ");
  const listas = await mk.listasValores(cred, { codigo });
  const valores = listas.flatMap((l) => l.values || []);
  if (!listas.length) return console.log(`No existe la lista "${codigo}".`);
  const f = valores.filter((v) => !texto || coincide(`${v.code} ${v.label}`, texto));
  for (const v of f) console.log(`${v.code}${v.label && v.label !== v.code ? `\t${v.label}` : ""}`);
  console.log(`\n${f.length} de ${valores.length} valor(es) en "${codigo}".`);
}

// ---------- main ----------

const COMANDOS = { categorias, atributos, atributo, lista, marca: (c, a) => lista(c, ["marca_list", ...a]) };

async function main() {
  const [cmd, ...resto] = process.argv.slice(2);
  const fn = COMANDOS[cmd];
  if (!fn) {
    console.error(`Comando desconocido. Disponibles: ${Object.keys(COMANDOS).join(", ")}. Ver ayuda en el encabezado de scripts/ripley-buscar.js`);
    process.exit(1);
  }
  await fn(credencialesEnv(), resto);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
