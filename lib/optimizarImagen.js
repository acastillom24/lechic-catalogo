/**
 * ============================================================
 *  OPTIMIZACIÓN DE IMÁGENES DE PRODUCTOS
 * ============================================================
 *  Las fotos se suben desde el celular/cámara tal cual, sin
 *  redimensionar ni comprimir, y eso es lo que más "Cached Egress"
 *  consume en Supabase Storage (cada visita al catálogo descarga
 *  las fotos completas). Antes de subir cualquier imagen nueva,
 *  la reescalamos y la convertimos a webp comprimido.
 * ============================================================
 */
const sharp = require("sharp");

// 1 año: como el nombre de archivo cambia cada vez que se sube una
// foto nueva (timestamp o mismo slug con upsert), es seguro cachearla
// "para siempre" sin arriesgarse a servir una versión vieja.
const CACHE_CONTROL_IMAGEN = "31536000";
const ANCHO_MAXIMO = 1400;
const CALIDAD_WEBP = 82;

async function optimizarImagen(buffer, extOriginal, tipoOriginal) {
  try {
    const optimizado = await sharp(buffer)
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ quality: CALIDAD_WEBP })
      .toBuffer();
    return { buffer: optimizado, ext: "webp", contentType: "image/webp" };
  } catch {
    // Si sharp no puede procesarla (formato raro, archivo corrupto),
    // se sube igual tal cual para no bloquear al usuario.
    return { buffer, ext: extOriginal, contentType: tipoOriginal || "image/jpeg" };
  }
}

module.exports = { optimizarImagen, CACHE_CONTROL_IMAGEN };
