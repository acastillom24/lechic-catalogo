// Separa la MARCA (la de SAGA) de la PESTAÑA (dónde se muestra el producto en la web).
//
//  1. Agrega productos.pestana (si falta) y la rellena con la marca actual (pestana = marca).
//  2. Los productos con marca ofertas / importaciones / hogar pasan a la marca "otras"
//     y conservan su pestaña (ofertas / importaciones / hogar).
//  3. El resto de marcas queda como está y en la misma pestaña.
//  4. Siembra en `configuracion` las claves "marcas", "pestanas" y "categorias" desde data/marcas.js
//     (los nombres de SAGA se toman de saga_opciones.marcas si ya estaban guardados).
//     Si ya existen, NO se sobrescriben.
//
// Es idempotente. Siempre imprime el estado antes/después.
//
// Uso:
//   node --env-file=.env.development   scripts/migrar-marcas-pestanas.js --dry-run   (solo muestra, deshace todo)
//   node --env-file=.env.development   scripts/migrar-marcas-pestanas.js             (aplica en dev)
//   node --env-file=.env.production scripts/migrar-marcas-pestanas.js             (aplica en producción)
const { Client } = require("pg");
const defaults = require("../data/marcas");

const MARCAS_A_OTRAS = ["ofertas", "importaciones", "hogar"];
const MARCA_COMODIN = "otras";
const DRY = process.argv.includes("--dry-run");

async function resumen(client, titulo) {
  const { rows } = await client.query(
    `select marca, coalesce(pestana, '(sin pestaña)') as pestana, count(*)::int as n
       from productos group by 1, 2 order by 1, 2`
  );
  console.log(`\n${titulo}`);
  if (!rows.length) console.log("  (sin productos)");
  for (const r of rows) console.log(`  marca=${r.marca.padEnd(22)} pestaña=${r.pestana.padEnd(22)} ${r.n}`);
}

async function main() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DIRECT_DATABASE_URL (usa --env-file=.env.development o .env.production).");
  const host = new URL(url).host;
  console.log(`Base de datos: ${host}${DRY ? "  [DRY-RUN: no se guardará nada]" : ""}`);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("begin");

    // 1. Columna e índice (mismo contenido que neon/schema.sql).
    await client.query("alter table productos add column if not exists pestana text");
    await client.query("create index if not exists productos_pestana_categoria_idx on productos (pestana, categoria)");
    await resumen(client, "ANTES:");

    // 2. Backfill: la pestaña es la marca anterior.
    const rellenados = await client.query("update productos set pestana = marca where pestana is null");

    // 3. Marcas que no existen en SAGA -> "otras" (la pestaña ya quedó con el slug anterior).
    const aOtras = await client.query(
      "update productos set marca = $1 where marca = any($2::text[])",
      [MARCA_COMODIN, MARCAS_A_OTRAS]
    );

    // 4. Siembra de configuración (sin pisar lo ya guardado).
    const [guardadasSaga] = (await client.query("select valor from configuracion where clave = 'saga_opciones'")).rows;
    const mapaSaga = (guardadasSaga?.valor && guardadasSaga.valor.marcas) || {};
    const slugsPestana = new Set(defaults.pestanas.map((p) => p.slug));
    const marcas = defaults.marcas.map((m) => ({ ...m, nombreSaga: mapaSaga[m.slug] || m.nombreSaga }));
    // Marcas con nombre SAGA guardado que no están en los defaults (agregadas a mano antes).
    for (const [slug, nombreSaga] of Object.entries(mapaSaga)) {
      if (marcas.some((m) => m.slug === slug)) continue;
      marcas.push({ slug, nombre: nombreSaga, nombreSaga, pestanaDefault: slugsPestana.has(slug) ? slug : defaults.pestanas[0].slug });
    }
    const semillas = { marcas, pestanas: defaults.pestanas, categorias: defaults.categorias };
    const sembradas = [];
    for (const [clave, valor] of Object.entries(semillas)) {
      const r = await client.query(
        "insert into configuracion (clave, valor) values ($1, $2::jsonb) on conflict (clave) do nothing",
        [clave, JSON.stringify(valor)]
      );
      if (r.rowCount) sembradas.push(clave);
    }

    // Comprobaciones: todo producto debe tener marca y pestaña conocidas.
    const marcasConfig = (await client.query("select valor from configuracion where clave = 'marcas'")).rows[0].valor.map((m) => m.slug);
    const pestanasConfig = (await client.query("select valor from configuracion where clave = 'pestanas'")).rows[0].valor.map((p) => p.slug);
    const sinMarca = await client.query("select distinct marca from productos where not (marca = any($1::text[]))", [marcasConfig]);
    const sinPestana = await client.query("select distinct pestana from productos where pestana is null or not (pestana = any($1::text[]))", [pestanasConfig]);

    await resumen(client, "DESPUÉS:");
    console.log(`\nPestaña rellenada en ${rellenados.rowCount} producto(s).`);
    console.log(`Marca cambiada a "${MARCA_COMODIN}" en ${aOtras.rowCount} producto(s).`);
    console.log(`Configuración sembrada: ${sembradas.length ? sembradas.join(", ") : "(ya existía, sin cambios)"}.`);
    if (sinMarca.rowCount) console.warn(`AVISO: marcas de productos que no están en la configuración: ${sinMarca.rows.map((r) => r.marca).join(", ")}`);
    if (sinPestana.rowCount) console.warn(`AVISO: pestañas de productos que no están en la configuración: ${sinPestana.rows.map((r) => r.pestana).join(", ")}`);

    if (DRY) {
      await client.query("rollback");
      console.log("\nDRY-RUN: cambios deshechos.");
    } else {
      await client.query("commit");
      console.log("\nMigración aplicada.");
    }
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
