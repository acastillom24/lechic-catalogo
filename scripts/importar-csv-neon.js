// Carga los respaldos de public/data/*.csv en Neon conservando los ids.
// Uso: npm run neon:importar
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { Client } = require("pg");

const DIR = path.join(__dirname, "..", "public", "data");

function leer(nombre) {
  const texto = fs.readFileSync(path.join(DIR, nombre), "utf8");
  const r = Papa.parse(texto, { header: true, skipEmptyLines: true });
  if (r.errors.length) throw new Error(`${nombre}: ${r.errors[0].message}`);
  return r.data;
}

const vacioANull = (v) => (v === "" || v === undefined ? null : v);
const aBool = (v) => String(v).trim().toLowerCase() === "true";
const aArreglo = (v) => {
  if (!v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

async function main() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DIRECT_DATABASE_URL en .env.local");

  const productos = leer("productos_rows.csv");
  const variantes = leer("variantes_rows.csv");
  const resenas = leer("resenas_rows.csv");
  console.log(`CSV: ${productos.length} productos, ${variantes.length} variantes, ${resenas.length} reseñas`);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("truncate resenas, variantes, productos restart identity cascade");

    for (const p of productos) {
      await client.query(
        `insert into productos (id, marca, categoria, nombre, descripcion, aromas, destacado, orden, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.id, p.marca, p.categoria, p.nombre, p.descripcion || "", aArreglo(p.aromas),
         aBool(p.destacado), p.orden || 0, vacioANull(p.created_at), vacioANull(p.updated_at)]
      );
    }
    // El trigger de updated_at solo corre en UPDATE, así que se conservan las fechas.

    for (const v of variantes) {
      await client.query(
        `insert into variantes (id, producto_id, nombre, precio, precio_oferta, stock, imagen, aromas, orden)
         overriding system value
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [v.id, v.producto_id, v.nombre || "Único", vacioANull(v.precio), vacioANull(v.precio_oferta),
         vacioANull(v.stock) === null ? true : aBool(v.stock), vacioANull(v.imagen), aArreglo(v.aromas), v.orden || 0]
      );
    }

    for (const r of resenas) {
      await client.query(
        `insert into resenas (id, producto_id, google_sub, nombre, estrellas, comentario, aprobado, ip_hash, created_at)
         overriding system value
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.id, r.producto_id, r.google_sub, r.nombre, r.estrellas, r.comentario || "",
         aBool(r.aprobado), vacioANull(r.ip_hash), vacioANull(r.created_at)]
      );
    }

    for (const tabla of ["variantes", "resenas"]) {
      await client.query(
        `select setval(pg_get_serial_sequence('${tabla}','id'), coalesce((select max(id) from ${tabla}), 1), (select count(*) > 0 from ${tabla}))`
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }

  for (const t of ["productos", "variantes", "resenas"]) {
    const { rows } = await client.query(`select count(*)::int as n from ${t}`);
    console.log(`Neon ${t}: ${rows[0].n}`);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
