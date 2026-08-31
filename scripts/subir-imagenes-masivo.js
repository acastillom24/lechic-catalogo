/**
 * ============================================================
 *  SUBIR IMÁGENES EN LOTE (por nombre de archivo)
 * ============================================================
 *  Un CSV solo puede llevar texto, nunca archivos. Este script es el
 *  complemento para adjuntar muchas fotos de una sola vez: subes todas
 *  las imágenes a una carpeta en tu computadora, nombradas con una
 *  convención, y el script las sube a Supabase Storage y las conecta
 *  con la variante correcta.
 *
 *  1) Importa primero los productos por CSV desde /admin/importar
 *     (o créalos manualmente) — este script NO crea productos, solo
 *     les agrega la foto a variantes que ya existen.
 *  2) Junta las fotos en una carpeta, y nombra cada archivo así:
 *
 *         <id_producto>__<nombre_de_la_variante>.jpg
 *
 *     Ejemplos (para el CSV de ejemplo supabase/ejemplo-importacion.csv):
 *         sensuelle__unico.jpg
 *         bloom-collection__jazmin.jpg
 *         bloom-collection__rosa.png
 *         bloom-collection__lavanda.jpg
 *
 *     No importan mayúsculas, tildes ni espacios en el nombre de la
 *     variante dentro del archivo — el script los ignora al comparar
 *     ("Jazmín" y "jazmin" son lo mismo). El id_producto sí debe ser
 *     exacto (es el que ves en la URL /producto/<id> o en /admin).
 *
 *  3) Corre:
 *       npm run subir-imagenes -- ./ruta/a/tu/carpeta
 *
 *  Es seguro volver a correrlo: si repites un archivo, se sobreescribe
 *  la imagen anterior de esa variante (no se duplica).
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const { supabaseServer } = require("../lib/supabaseServer");
const { slugify } = require("../lib/slug");

const EXTENSIONES_VALIDAS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MIME_POR_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function main() {
  const carpeta = process.argv[2];
  if (!carpeta) {
    console.error(
      "Uso: npm run subir-imagenes -- ./ruta/a/tu/carpeta\n" +
        "(la carpeta debe tener archivos nombrados como id_producto__nombre_variante.jpg)"
    );
    process.exit(1);
  }
  if (!fs.existsSync(carpeta) || !fs.statSync(carpeta).isDirectory()) {
    console.error(`No existe la carpeta: ${carpeta}`);
    process.exit(1);
  }

  const archivos = fs
    .readdirSync(carpeta)
    .filter((f) => EXTENSIONES_VALIDAS.includes(path.extname(f).toLowerCase()));

  if (archivos.length === 0) {
    console.log("No hay imágenes en esa carpeta (jpg, jpeg, png, webp, gif).");
    return;
  }

  console.log(`Encontré ${archivos.length} imagen(es). Procesando...\n`);

  const supabase = supabaseServer();
  const cacheProductos = new Map(); // id_producto -> variantes[] (para no repetir consultas)
  let ok = 0;
  const omitidos = [];

  for (const archivo of archivos) {
    const ext = path.extname(archivo).toLowerCase();
    const base = path.basename(archivo, ext);
    const partes = base.split("__");

    if (partes.length !== 2) {
      omitidos.push(`${archivo}: el nombre debe ser "id_producto__nombre_variante${ext}".`);
      continue;
    }

    const [idProducto, parteVariante] = partes;

    if (!cacheProductos.has(idProducto)) {
      const { data, error } = await supabase
        .from("variantes")
        .select("id, nombre")
        .eq("producto_id", idProducto);
      if (error) {
        omitidos.push(`${archivo}: error consultando "${idProducto}": ${error.message}`);
        cacheProductos.set(idProducto, []);
        continue;
      }
      cacheProductos.set(idProducto, data || []);
    }

    const variantes = cacheProductos.get(idProducto);
    if (variantes.length === 0) {
      omitidos.push(`${archivo}: no existe el producto "${idProducto}" (¿ya lo importaste/creaste?).`);
      continue;
    }

    const slugBuscado = slugify(parteVariante);
    const variante = variantes.find((v) => slugify(v.nombre) === slugBuscado);
    if (!variante) {
      const disponibles = variantes.map((v) => slugify(v.nombre)).join(", ");
      omitidos.push(
        `${archivo}: "${idProducto}" no tiene una variante "${parteVariante}". Variantes disponibles: ${disponibles}.`
      );
      continue;
    }

    const buffer = fs.readFileSync(path.join(carpeta, archivo));
    const ruta = `${idProducto}/${slugBuscado}${ext}`;
    const { error: errorSubida } = await supabase.storage
      .from("productos")
      .upload(ruta, buffer, { contentType: MIME_POR_EXT[ext], upsert: true });
    if (errorSubida) {
      omitidos.push(`${archivo}: error subiendo la imagen: ${errorSubida.message}`);
      continue;
    }

    const { data: publica } = supabase.storage.from("productos").getPublicUrl(ruta);
    const { error: errorUpdate } = await supabase
      .from("variantes")
      .update({ imagen: publica.publicUrl })
      .eq("id", variante.id);
    if (errorUpdate) {
      omitidos.push(`${archivo}: se subió la imagen pero no se pudo guardar en la variante: ${errorUpdate.message}`);
      continue;
    }

    ok++;
    console.log(`✓ ${archivo} → ${idProducto} / ${variante.nombre}`);
  }

  console.log(`\n${ok}/${archivos.length} imágenes conectadas correctamente.`);
  if (omitidos.length) {
    console.log("\nOmitidas:");
    omitidos.forEach((linea) => console.log(`  ✗ ${linea}`));
  }
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exitCode = 1;
});
