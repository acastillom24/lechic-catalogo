/**
 * ============================================================
 *  MIGRAR FOTOS: respaldo local → Cloudinary (carpeta lechic/)
 * ============================================================
 *  Cruza cada variante de la BD (Neon) con un archivo de
 *  public/images/productos y, solo si cruzan, lo optimiza (sharp)
 *  y lo sube a Cloudinary, actualizando variantes.imagen.
 *
 *  Cruce, por niveles:
 *   1. "exacto": el nombre del archivo en la URL vieja de Supabase (o la
 *      ruta local vieja) coincide con el de un archivo del respaldo
 *      (ignorando mayúsculas, tildes y separadores).
 *   2. "difuso": similitud de palabras entre "producto + variante" y el
 *      nombre del archivo, dentro de la carpeta de la misma marca.
 *
 *  Uso:
 *    npm run fotos:analizar              → solo genera el reporte
 *    npm run fotos:subir                 → sube exactos + difusos seguros
 *    npm run fotos:subir -- --dudosas    → incluye también las dudosas
 *    npm run fotos:subir -- --limite=20  → prueba con pocas fotos
 *  Es reanudable: lo ya subido (neon/reportes/subidas.json) se omite.
 * ============================================================
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const sharp = require("sharp");

const { optimizarImagen } = require("../lib/optimizarImagen");
const { subirArchivo } = require("../lib/storage");
const { slugify } = require("../lib/slug");

const RAIZ = path.join(__dirname, "..");
const DIR_FOTOS = path.join(RAIZ, "public", "images", "productos");
const DIR_REPORTES = path.join(RAIZ, "neon", "reportes");
const ARCHIVO_SUBIDAS = path.join(DIR_REPORTES, "subidas.json");

const UMBRAL_SEGURO = 0.8;
const UMBRAL_DUDOSO = 0.6;
const EXT_IMAGEN = /\.(jpe?g|png|webp|gif|avif)$/i;

const CARPETA_A_MARCA = {
  avon: "avon",
  "bath & body words": "bath-and-body-works",
  caravan: "caravan",
  cyzone: "cyzone",
  dupree: "dupree",
  esika: "esika",
  farmasi: "farmasi",
  importados: "importaciones",
  "l'bel": "lbel",
  natura: "natura",
  ofertas: "ofertas",
  saphir: "saphir",
  "victoria's secret": "victorias-secret",
  yanbal: "yanbal",
};

const args = process.argv.slice(2);
const SUBIR = args.includes("--subir");
const INCLUIR_DUDOSAS = args.includes("--dudosas");
const LIMITE = Number((args.find((a) => a.startsWith("--limite=")) || "").split("=")[1]) || Infinity;

// ---------- normalización ----------
const STOP = new Set(["de", "del", "la", "el", "y", "en", "con", "para", "by", "eau", "unico", "unica", "copia", "1", "x"]);

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(texto) {
  return normalizar(texto)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let comunes = 0;
  for (const t of a) if (b.has(t)) comunes++;
  return (2 * comunes) / (a.size + b.size);
}

function nombreDeUrl(url) {
  if (!url) return null;
  const ultimo = url.split("?")[0].split("/").pop();
  let dec;
  try {
    dec = decodeURIComponent(ultimo);
  } catch {
    dec = ultimo;
  }
  return dec.replace(/\.[a-z0-9]+$/i, "");
}

// Las subidas hechas desde el admin se llamaban "<idx>-<timestamp>" o "<variante>": no sirven de pista.
function esNombreInutil(nombre) {
  return !nombre || /^\d+-\d{8,}$/.test(nombre);
}

// ---------- archivos ----------
function listarFotos(dir, carpetaMarca = null) {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      const marca = carpetaMarca ?? (CARPETA_A_MARCA[e.name.toLowerCase()] || null);
      salida.push(...listarFotos(abs, marca));
    } else if (EXT_IMAGEN.test(e.name)) {
      const base = e.name.replace(/\.[^.]+$/, "");
      salida.push({
        abs,
        rel: path.relative(DIR_FOTOS, abs).replace(/\\/g, "/"),
        marca: carpetaMarca,
        base,
        norm: normalizar(base),
        toks: new Set(tokens(base)),
      });
    }
  }
  return salida;
}

// ---------- cruce ----------
async function cargarVariantes() {
  const client = new Client({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    `select v.id, v.producto_id, v.nombre as variante, v.imagen, p.marca, p.nombre as producto
     from variantes v join productos p on p.id = v.producto_id order by v.id`
  );
  await client.end();
  return rows;
}

function calcularCruces(variantes, fotos) {
  const porNorm = new Map();
  for (const f of fotos) {
    if (!porNorm.has(f.norm)) porNorm.set(f.norm, []);
    porNorm.get(f.norm).push(f);
  }

  const cruces = [];
  const sinExacto = [];

  // Nivel 1: exacto por nombre de archivo heredado.
  for (const v of variantes) {
    const pista = nombreDeUrl(v.imagen);
    const candidatos = !esNombreInutil(pista) ? porNorm.get(normalizar(pista)) : null;
    if (candidatos && candidatos.length) {
      const f = candidatos.find((c) => c.marca === v.marca) || candidatos[0];
      cruces.push({ v, f, score: 1, nivel: "exacto" });
    } else {
      sinExacto.push(v);
    }
  }

  // Nivel 2: difuso, uno a uno, dentro de la misma marca, sin reutilizar archivos ya cruzados.
  const usados = new Set(cruces.map((c) => c.f.abs));
  const propuestas = [];
  const fotosPorMarca = new Map();
  for (const f of fotos) {
    if (usados.has(f.abs)) continue;
    if (!fotosPorMarca.has(f.marca)) fotosPorMarca.set(f.marca, []);
    fotosPorMarca.get(f.marca).push(f);
  }

  for (const v of sinExacto) {
    const nombreVar = normalizar(v.variante) === "unico" ? "" : v.variante;
    const tv = new Set(tokens(`${v.producto} ${nombreVar}`));
    const tvVariante = new Set(tokens(nombreVar));
    for (const f of fotosPorMarca.get(v.marca) || []) {
      let score = dice(tv, f.toks);
      // Si la variante tiene nombre propio, el archivo debe mencionarlo.
      if (tvVariante.size) {
        let cubiertos = 0;
        for (const t of tvVariante) if (f.toks.has(t)) cubiertos++;
        if (cubiertos < tvVariante.size) score *= 0.6;
      }
      if (score >= UMBRAL_DUDOSO) propuestas.push({ v, f, score });
    }
  }
  propuestas.sort((a, b) => b.score - a.score);
  const varianteTomada = new Set();
  const fotoTomada = new Set();
  for (const p of propuestas) {
    if (varianteTomada.has(p.v.id) || fotoTomada.has(p.f.abs)) continue;
    varianteTomada.add(p.v.id);
    fotoTomada.add(p.f.abs);
    cruces.push({ ...p, nivel: p.score >= UMBRAL_SEGURO ? "difuso" : "dudoso" });
  }

  const huerfanasVariantes = variantes.filter((v) => !cruces.some((c) => c.v.id === v.id));
  const todasUsadas = new Set(cruces.map((c) => c.f.abs));
  const huerfanasFotos = fotos.filter((f) => !todasUsadas.has(f.abs));
  return { cruces, huerfanasVariantes, huerfanasFotos };
}

function csv(filas) {
  const esc = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  return filas.map((f) => f.map(esc).join(",")).join("\n");
}

function guardarReportes({ cruces, huerfanasVariantes, huerfanasFotos }) {
  fs.mkdirSync(DIR_REPORTES, { recursive: true });
  fs.writeFileSync(
    path.join(DIR_REPORTES, "cruces.csv"),
    csv([
      ["nivel", "score", "variante_id", "producto", "variante", "archivo"],
      ...cruces.map((c) => [c.nivel, c.score.toFixed(2), c.v.id, c.v.producto, c.v.variante, c.f.rel]),
    ])
  );
  fs.writeFileSync(
    path.join(DIR_REPORTES, "variantes-sin-foto.csv"),
    csv([
      ["variante_id", "marca", "producto", "variante", "imagen_vieja"],
      ...huerfanasVariantes.map((v) => [v.id, v.marca, v.producto, v.variante, v.imagen]),
    ])
  );
  fs.writeFileSync(
    path.join(DIR_REPORTES, "fotos-sin-cruce.csv"),
    csv([["archivo"], ...huerfanasFotos.map((f) => [f.rel])])
  );
}

// ---------- subida ----------
async function subir({ cruces }) {
  const hechas = fs.existsSync(ARCHIVO_SUBIDAS) ? JSON.parse(fs.readFileSync(ARCHIVO_SUBIDAS, "utf8")) : {};
  const guardar = () => fs.writeFileSync(ARCHIVO_SUBIDAS, JSON.stringify(hechas, null, 1));

  const elegibles = cruces.filter((c) => c.nivel !== "dudoso" || INCLUIR_DUDOSAS);
  const porArchivo = new Map();
  for (const c of elegibles) {
    if (!porArchivo.has(c.f.abs)) porArchivo.set(c.f.abs, { f: c.f, variantes: [] });
    porArchivo.get(c.f.abs).variantes.push(c.v);
  }
  const trabajos = [...porArchivo.values()].filter((t) => !hechas[t.f.abs]).slice(0, LIMITE);
  console.log(`A subir: ${trabajos.length} archivos (ya hechos: ${Object.keys(hechas).length})`);

  const client = new Client({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();

  let hecho = 0;
  const fallos = [];
  let cola = trabajos.slice();
  async function trabajador() {
    while (cola.length) {
      const t = cola.shift();
      const primera = t.variantes[0];
      try {
        const original = fs.readFileSync(t.f.abs);
        const ext = path.extname(t.f.abs).slice(1).toLowerCase();
        const { buffer } = await optimizarImagen(original, ext, `image/${ext}`);
        const ruta = `${primera.marca}/${primera.producto_id}/${slugify(primera.variante) || "unico"}-${primera.id}`;
        const url = await subirArchivo(buffer, ruta);
        const ids = t.variantes.map((v) => v.id);
        await client.query("update variantes set imagen = $1 where id = any($2::bigint[])", [url, ids]);
        hechas[t.f.abs] = { url, variantes: ids };
        hecho++;
        if (hecho % 25 === 0) {
          guardar();
          console.log(`  ${hecho}/${trabajos.length}`);
        }
      } catch (err) {
        fallos.push(`${t.f.rel}: ${err.message}`);
      }
    }
  }
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
  guardar();
  await client.end();
  console.log(`Subidas: ${hecho}. Fallos: ${fallos.length}`);
  fallos.slice(0, 10).forEach((f) => console.log("  ✗", f));
}

async function main() {
  const fotos = listarFotos(DIR_FOTOS);
  const variantes = await cargarVariantes();
  const resultado = calcularCruces(variantes, fotos);
  guardarReportes(resultado);

  const cuenta = (n) => resultado.cruces.filter((c) => c.nivel === n).length;
  console.log(`Fotos en respaldo: ${fotos.length} | Variantes: ${variantes.length}`);
  console.log(
    `Cruces → exacto: ${cuenta("exacto")}, difuso: ${cuenta("difuso")}, dudoso: ${cuenta("dudoso")}`
  );
  console.log(
    `Sin foto: ${resultado.huerfanasVariantes.length} variantes | Fotos sin cruce: ${resultado.huerfanasFotos.length}`
  );
  console.log(`Reportes en ${path.relative(RAIZ, DIR_REPORTES)}`);

  if (SUBIR) await subir(resultado);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
