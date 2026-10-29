/**
 * ============================================================
 *  ALMACENAMIENTO DE IMÁGENES (Cloudinary, solo servidor)
 * ============================================================
 *  Todas las fotos viven en la carpeta "lechic" para no mezclarse
 *  con otros proyectos de la misma cuenta.
 *
 *  Variable de entorno: CLOUDINARY_URL
 *  (o CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET)
 * ============================================================
 */
const { v2: cloudinary } = require("cloudinary");

const CARPETA = "lechic";

let configurado = false;
function cliente() {
  if (!configurado) {
    if (!process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
    cloudinary.config({ secure: true });
    configurado = true;
  }
  return cloudinary;
}

// Sube un buffer a lechic/<ruta> (ruta sin extensión) y devuelve la URL pública.
function subirArchivo(buffer, ruta) {
  const publicId = `${CARPETA}/${ruta}`.replace(/\.[a-z0-9]+$/i, "");
  return new Promise((resolve, reject) => {
    cliente()
      .uploader.upload_stream(
        { public_id: publicId, overwrite: true, invalidate: true, resource_type: "image" },
        (error, res) =>
          error ? reject(new Error(error.message || "Error de Cloudinary")) : resolve(res.secure_url)
      )
      .end(buffer);
  });
}

module.exports = { subirArchivo, CARPETA };
