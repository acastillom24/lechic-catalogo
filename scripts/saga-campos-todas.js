// Recorre TODAS las categorías hoja (★) de SAGA y, para cada una, obtiene sus atributos extra
// (igual que saga:campos) marcando obligatorios y opcionales. Solo lectura (GetCategoryAttributes).
// NO toca data/saga-campos.json: escribe data/saga-campos-todas.json con la MISMA estructura
// ({ "idCategoria": [campos…] }), listo para renombrarlo a saga-campos.json. Se puede reanudar si se corta.
//   npm run saga:campos:todas                       -> todas las hojas
//   npm run saga:campos:todas -- lechic             -> con las credenciales de la cuenta "lechic" (si no, las del .env)
//   npm run saga:campos:todas -- --filtro perfum    -> solo hojas cuya ruta contenga "perfum"
//   npm run saga:campos:todas -- --max 20           -> máximo 20 categorías nuevas (para probar)
//   npm run saga:campos:todas -- --rehacer          -> ignora lo ya guardado y empieza de cero
//   npm run saga:campos:todas -- --convertir        -> pasa un saga-campos-todas.json de la versión anterior
//                                                      ({ruta, campos, error}) a la estructura de saga-campos.json
const fs = require("fs");
const path = require("path");
const sc = require("../lib/sellercenter");
const { convertir } = require("./saga-campos");

const ARCHIVO = path.join(__dirname, "..", "data", "saga-campos-todas.json");
const PAUSA_MS = 300;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function hojas(nodos, ruta = [], salida = []) {
  for (const n of lista(nodos)) {
    const actual = [...ruta, n.Name ?? n.name ?? "?"];
    const hijos = lista(n.Children?.Category ?? n.Children);
    if (hijos.length) hojas(hijos, actual, salida);
    else salida.push({ id: String(n.CategoryId ?? n.categoryId ?? n.Id), ruta: actual.join(" > ") });
  }
  return salida;
}

function opcion(args, nombre) {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
}

// Lee el archivo en cualquier formato y devuelve { id: [campos] } (sin errores ni categorías vacías).
function cargar() {
  if (!fs.existsSync(ARCHIVO)) return {};
  const crudo = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
  const salida = {};
  for (const [id, v] of Object.entries(crudo)) {
    const campos = Array.isArray(v) ? v : v?.campos;
    if (campos?.length) salida[id] = campos;
  }
  return salida;
}

function escribir(datos) {
  const ord = Object.fromEntries(Object.entries(datos).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(ARCHIVO, JSON.stringify(ord, null, 1) + "\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--convertir")) {
    const datos = cargar();
    escribir(datos);
    console.log(`Convertido: ${Object.keys(datos).length} categorías con campos en data/saga-campos-todas.json`);
    return;
  }
  const filtro = (opcion(args, "--filtro") || "").toLowerCase();
  const max = Number(opcion(args, "--max")) || Infinity;
  const rehacer = args.includes("--rehacer");
  const alias = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"))?.toLowerCase();

  let datos = {
    alias: "env",
    user_id: process.env.SELLERCENTER_USER_ID,
    api_key: process.env.SELLERCENTER_API_KEY,
    base_url: process.env.SELLERCENTER_BASE_URL,
  };
  if (alias) {
    const { query } = require("../lib/db");
    const [cuenta] = await query("select * from cuentas_saga where alias = $1", [alias]);
    if (!cuenta) throw new Error(`No existe la cuenta "${alias}".`);
    datos = cuenta;
  }
  const cred = sc.credenciales(datos);
  console.log(`Usuario ${cred.userId} · ${cred.base}`);

  const arbol = await sc.arbolCategorias(cred);
  let todas = hojas(arbol?.Body?.Categories?.Category ?? arbol?.Body?.Categories);
  if (!todas.length) throw new Error("Respuesta inesperada del árbol de categorías.");
  if (filtro) todas = todas.filter((h) => h.ruta.toLowerCase().includes(filtro));
  console.log(`${todas.length} categorías hoja${filtro ? ` con "${filtro}"` : ""}.`);

  const guardado = rehacer ? {} : cargar();
  const pendientes = todas.filter((h) => !guardado[h.id]).slice(0, max);
  console.log(`${todas.length - pendientes.length > 0 ? `Ya guardadas: ${todas.filter((h) => guardado[h.id]).length}. ` : ""}Por consultar: ${pendientes.length}\n`);

  const guardar = () => escribir(guardado);

  let n = 0;
  for (const h of pendientes) {
    n++;
    let atributos;
    for (let intento = 1; intento <= 2; intento++) {
      try {
        atributos = convertir(await sc.atributosCategoria(cred, h.id));
        break;
      } catch (e) {
        if (intento === 2) {
          console.log(`[${n}/${pendientes.length}] ${h.id}  ${h.ruta}  ✗ ${e.message}`);
        } else await dormir(2000);
      }
    }
    if (atributos) {
      if (atributos.length) guardado[h.id] = atributos; // sin campos extra no se guarda, igual que saga:campos
      const obl = atributos.filter((a) => a.obligatorio).map((a) => a.id);
      console.log(`[${n}/${pendientes.length}] ${h.id}  ${h.ruta}  ${atributos.length} campos extra (obligatorios: ${obl.join(", ") || "ninguno"})`);
    }
    if (n % 20 === 0) guardar(); // progreso parcial por si se corta
    await dormir(PAUSA_MS);
  }
  guardar();
  console.log(`\nGuardado en data/saga-campos-todas.json (${Object.keys(guardado).length} categorías con campos extra; las que fallaron o no tienen se reintentan al volver a correr).`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
