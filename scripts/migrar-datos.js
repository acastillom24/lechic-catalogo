/**
 * ============================================================
 *  MIGRACIÓN ÚNICA: data/productos.js  →  Supabase
 * ============================================================
 *  Corre este script UNA VEZ, después de crear el proyecto en
 *  Supabase y correr supabase/schema.sql, para cargar el catálogo
 *  actual (94 productos, 246 variantes) en la base de datos.
 *
 *  Uso:
 *    npm run migrar-datos
 *
 *  Requiere que .env.local tenga SUPABASE_URL y
 *  SUPABASE_SERVICE_ROLE_KEY (ver .env.local.example).
 *
 *  Es seguro volver a correrlo: cada producto se sobreescribe
 *  (upsert) por su "id" y sus variantes se reemplazan por completo,
 *  así que no se duplica nada.
 * ============================================================
 */

const productos = require("../data/productos");
const { supabaseServer } = require("../lib/supabaseServer");

async function main() {
  const supabase = supabaseServer();

  console.log(`Migrando ${productos.length} productos...`);

  let ok = 0;
  let fallidos = [];

  for (let i = 0; i < productos.length; i++) {
    const p = productos[i];

    const filaProducto = {
      id: p.id,
      marca: p.marca,
      categoria: p.categoria,
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      aromas: p.aromas || [],
      destacado: !!p.destacado,
      orden: i,
    };

    const { error: errorProducto } = await supabase
      .from("productos")
      .upsert(filaProducto, { onConflict: "id" });

    if (errorProducto) {
      console.error(`✗ ${p.id}: ${errorProducto.message}`);
      fallidos.push(p.id);
      continue;
    }

    // Reemplaza las variantes del producto (borra las viejas e inserta
    // las actuales), así el script se puede correr varias veces sin
    // duplicar variantes.
    const { error: errorBorrar } = await supabase
      .from("variantes")
      .delete()
      .eq("producto_id", p.id);

    if (errorBorrar) {
      console.error(`✗ ${p.id} (borrando variantes): ${errorBorrar.message}`);
      fallidos.push(p.id);
      continue;
    }

    const filasVariantes = (p.variantes || []).map((v, orden) => ({
      producto_id: p.id,
      nombre: v.nombre,
      precio: v.precio ?? null,
      precio_oferta: v.precioOferta ?? null,
      stock: v.stock !== false,
      imagen: v.imagen || null,
      aromas: v.aromas || [],
      orden,
    }));

    if (filasVariantes.length > 0) {
      const { error: errorVariantes } = await supabase
        .from("variantes")
        .insert(filasVariantes);

      if (errorVariantes) {
        console.error(`✗ ${p.id} (variantes): ${errorVariantes.message}`);
        fallidos.push(p.id);
        continue;
      }
    }

    ok++;
    process.stdout.write(`\r✓ ${ok}/${productos.length} productos migrados`);
  }

  console.log("\n");
  if (fallidos.length) {
    console.log(`Terminado con errores en: ${fallidos.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Migración completa. Todos los productos están en Supabase.");
  }
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exitCode = 1;
});
