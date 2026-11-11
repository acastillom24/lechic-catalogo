// Pasa los «Atributos (aromas, etc.)» antiguos a «Notas aromáticas» (productos y variantes).
//
//  - Copia `aromas` → `notas_aromaticas` (si ya había notas, agrega solo las que falten, sin repetir).
//  - Si la fragancia de SAGA (`fragancia_perfume`) está vacía, la llena con los aromas que coinciden con la lista de aromas de SAGA
//    (así FraganciaPerfume no pierde el respaldo que antes tomaba de `aromas`).
//  - Las columnas `aromas` NO se borran, salvo con --borrar-columnas (hazlo al final, cuando todo se vea bien).
//
// Uso:   npm run neon:aromas:dev -- --simular     (solo informa, no cambia nada)
//        npm run neon:aromas:dev                  (aplica en la rama de desarrollo)
//        npm run neon:aromas                      (aplica en producción)
//        npm run neon:aromas -- --borrar-columnas (además elimina las columnas `aromas`)
const { Client } = require("pg");
const { OPCIONES_PREDETERMINADAS } = require("../lib/saga-opciones");

const quitarTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const lista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);

async function migrarTabla(client, tabla, fraganciaPerfume) {
  const { rows } = await client.query(`select id, aromas, notas_aromaticas, fragancia_perfume from ${tabla} where cardinality(aromas) > 0`);
  let notas = 0;
  let fragancias = 0;
  for (const r of rows) {
    // Notas: las que ya había + las aromas que falten.
    const partes = lista(r.notas_aromaticas);
    for (const a of r.aromas) if (!partes.some((x) => quitarTildes(x) === quitarTildes(a))) partes.push(String(a).trim());
    const nuevaNotas = partes.join(", ").slice(0, 300) || null;
    // Fragancia de SAGA: solo si estaba vacía y el aroma está en la lista de SAGA.
    let nuevaFragancia = r.fragancia_perfume;
    if (!r.fragancia_perfume || r.fragancia_perfume.length === 0) {
      const validas = [...new Set(r.aromas.map((a) => fraganciaPerfume.find((x) => quitarTildes(x) === quitarTildes(a))).filter(Boolean))];
      if (validas.length) nuevaFragancia = validas;
    }
    const cambiaNotas = nuevaNotas !== (r.notas_aromaticas || null);
    const cambiaFragancia = (nuevaFragancia || []).length !== (r.fragancia_perfume || []).length;
    if (!cambiaNotas && !cambiaFragancia) continue;
    await client.query(`update ${tabla} set notas_aromaticas = $2, fragancia_perfume = $3::text[] where id = $1`, [r.id, nuevaNotas, nuevaFragancia || []]);
    if (cambiaNotas) notas++;
    if (cambiaFragancia) fragancias++;
  }
  return { revisados: rows.length, notas, fragancias };
}

async function main() {
  const simular = process.argv.includes("--simular");
  const borrar = process.argv.includes("--borrar-columnas");
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DIRECT_DATABASE_URL en el archivo de entorno.");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows: cols } = await client.query(
      "select table_name from information_schema.columns where table_schema = current_schema() and column_name = 'aromas' and table_name in ('productos','variantes')"
    );
    if (!cols.length) {
      console.log("Las columnas `aromas` ya no existen: no hay nada que migrar.");
      return;
    }
    // Las columnas de destino las crea neon/schema.sql: si faltan, hay que aplicarlo primero.
    const { rows: destino } = await client.query(
      "select table_name, column_name from information_schema.columns where table_schema = current_schema() and table_name in ('productos','variantes') and column_name in ('notas_aromaticas','fragancia_perfume')"
    );
    const faltan = [];
    for (const tabla of ["productos", "variantes"]) {
      for (const col of ["notas_aromaticas", "fragancia_perfume"]) if (!destino.some((d) => d.table_name === tabla && d.column_name === col)) faltan.push(`${tabla}.${col}`);
    }
    if (faltan.length) {
      throw new Error(`Faltan columnas (${faltan.join(", ")}). Aplica primero el esquema: npm run neon:schema:dev (o neon:schema en producción) y vuelve a correr este script.`);
    }

    const { rows: cfg } = await client.query("select valor from configuracion where clave = 'saga_opciones'");
    const guardada = cfg[0]?.valor?.aromas;
    const fraganciaPerfume = Array.isArray(guardada) && guardada.length ? guardada : OPCIONES_PREDETERMINADAS.aromas;

    await client.query("begin");
    for (const { table_name: tabla } of cols) {
      const r = await migrarTabla(client, tabla, fraganciaPerfume);
      console.log(`${tabla}: ${r.revisados} con aromas · ${r.notas} notas actualizadas · ${r.fragancias} fragancias de SAGA completadas`);
    }
    if (simular) {
      await client.query("rollback");
      console.log("Simulación: no se cambió nada.");
      return;
    }
    if (borrar) {
      for (const { table_name: tabla } of cols) await client.query(`alter table ${tabla} drop column aromas`);
      console.log("Columnas `aromas` eliminadas.");
    }
    await client.query("commit");
    console.log("Migración aplicada.");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
