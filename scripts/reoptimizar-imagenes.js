/**
 * ============================================================
 *  REOPTIMIZAR IMÁGENES YA SUBIDAS (bucket "productos")
 * ============================================================
 *  Las fotos que ya están en Supabase Storage se subieron sin
 *  redimensionar ni comprimir, y eso es lo que más "Cached Egress"
 *  consume en el plan Free. Este script recorre el bucket completo,
 *  reoptimiza cada imagen y la vuelve a subir EN LA MISMA RUTA
 *  (mismo nombre, misma extensión), así la URL guardada en la tabla
 *  `variantes` no cambia y no hay que tocar la base de datos.
 *
 *  Es seguro volver a correrlo: si una imagen ya está optimizada
 *  (el resultado no pesa menos que el original), se omite.
 *
 *  Uso: npm run reoptimizar-imagenes
 * ============================================================
 */
const sharp = require("sharp");
const { supabaseServer } = require("../lib/supabaseServer");
const { CACHE_CONTROL_IMAGEN } = require("../lib/optimizarImagen");

const BUCKET = "productos";
const ANCHO_MAXIMO = 1400;

async function listarArchivosRecursivo(supabase, carpeta = "") {
  const { data, error } = await supabase.storage.from(BUCKET).list(carpeta, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`No se pudo listar "${carpeta || "/"}": ${error.message}`);

  const archivos = [];
  for (const item of data || []) {
    const ruta = carpeta ? `${carpeta}/${item.name}` : item.name;
    if (item.id === null) {
      // Sin id => es una carpeta (cada producto tiene la suya): entrar recursivamente.
      archivos.push(...(await listarArchivosRecursivo(supabase, ruta)));
    } else {
      archivos.push({ ruta, mimetype: item.metadata?.mimetype });
    }
  }
  return archivos;
}

// Redimensiona y recomprime SIN cambiar el formato del archivo (para no
// alterar la extensión de la ruta y así mantener la misma URL pública).
// Los .gif se dejan igual: redimensionar un gif animado con seguridad
// requiere tratar cada frame por separado y no vale el riesgo aquí.
async function reoptimizarManteniendoFormato(buffer, ext) {
  const extensionLower = ext.toLowerCase();
  const base = sharp(buffer, { animated: extensionLower === "gif" }).resize({
    width: ANCHO_MAXIMO,
    withoutEnlargement: true,
  });

  if (extensionLower === "gif") return null;
  if (extensionLower === "png") return base.png({ quality: 80, compressionLevel: 9 }).toBuffer();
  if (extensionLower === "webp") return base.webp({ quality: 78 }).toBuffer();
  return base.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
}

async function main() {
  const supabase = supabaseServer();

  console.log("Listando imágenes del bucket...");
  const archivos = await listarArchivosRecursivo(supabase);
  console.log(`Encontré ${archivos.length} archivo(s).\n`);

  let optimizados = 0;
  let bytesAntes = 0;
  let bytesDespues = 0;
  const omitidos = [];

  for (const archivo of archivos) {
    const ext = archivo.ruta.split(".").pop();
    try {
      const { data: descarga, error: errorDescarga } = await supabase.storage
        .from(BUCKET)
        .download(archivo.ruta);
      if (errorDescarga) {
        omitidos.push(`${archivo.ruta}: error al descargar: ${errorDescarga.message}`);
        continue;
      }

      const bufferOriginal = Buffer.from(await descarga.arrayBuffer());
      const bufferOptimizado = await reoptimizarManteniendoFormato(bufferOriginal, ext);

      if (!bufferOptimizado) {
        omitidos.push(`${archivo.ruta}: formato .${ext} no se reoptimiza (se deja igual).`);
        continue;
      }

      if (bufferOptimizado.length >= bufferOriginal.length) {
        console.log(`= ${archivo.ruta} ya está optimizada (${bufferOriginal.length} bytes), se omite.`);
        continue;
      }

      const { error: errorSubida } = await supabase.storage
        .from(BUCKET)
        .upload(archivo.ruta, bufferOptimizado, {
          contentType: archivo.mimetype || `image/${ext === "jpg" ? "jpeg" : ext}`,
          cacheControl: CACHE_CONTROL_IMAGEN,
          upsert: true,
        });
      if (errorSubida) {
        omitidos.push(`${archivo.ruta}: error al resubir: ${errorSubida.message}`);
        continue;
      }

      optimizados++;
      bytesAntes += bufferOriginal.length;
      bytesDespues += bufferOptimizado.length;
      console.log(
        `✓ ${archivo.ruta}: ${(bufferOriginal.length / 1024).toFixed(0)} KB → ${(bufferOptimizado.length / 1024).toFixed(0)} KB`
      );
    } catch (err) {
      omitidos.push(`${archivo.ruta}: error inesperado: ${err.message}`);
    }
  }

  console.log(`\n${optimizados}/${archivos.length} imágenes reoptimizadas.`);
  if (bytesAntes > 0) {
    const ahorro = 1 - bytesDespues / bytesAntes;
    console.log(
      `Peso total optimizado: ${(bytesAntes / 1024 / 1024).toFixed(1)} MB → ${(bytesDespues / 1024 / 1024).toFixed(1)} MB (${(ahorro * 100).toFixed(0)}% menos)`
    );
  }
  if (omitidos.length) {
    console.log("\nOmitidas:");
    omitidos.forEach((linea) => console.log(`  - ${linea}`));
  }
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exitCode = 1;
});
