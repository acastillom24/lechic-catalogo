"use client";

import { useRef } from "react";
import { IconoMas, IconoPapelera } from "./Iconos";

const MAX_LADO = 1400; // mismo tope que lib/optimizarImagen.js
const aleatorio = () => Math.random().toString(36).slice(2, 9);

/**
 * Reduce la foto en el navegador antes de enviarla: varias fotos de celular juntas superarían el límite
 * de 4 MB del envío del formulario. Si el navegador no puede, se envía la original (el servidor la optimiza igual).
 */
async function comprimir(archivo) {
  try {
    if (!archivo.type.startsWith("image/") || archivo.type === "image/gif") return archivo;
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.82));
    if (!blob || blob.size >= archivo.size) return archivo;
    return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return archivo;
  }
}

/** Pone el archivo en un <input type=file> (así viaja con el formulario aunque la lista se reordene). */
function asignarArchivo(el, archivo) {
  if (!el || !archivo || el.files?.length) return;
  const dt = new DataTransfer();
  dt.items.add(archivo);
  el.files = dt.files;
}

/**
 * Lista de imágenes de una variante. La primera es la portada (la que ve la web en listados).
 * Cada elemento es { key, url } (ya guardada) o { key, archivo, preview, campo } (nueva, viaja en el campo `campo`).
 */
export default function ImagenesVariante({ varianteKey, imagenes, onChange, max = 8, minimo = 0 }) {
  const entrada = useRef(null);

  async function agregar(e) {
    const archivos = [...(e.target.files || [])].slice(0, Math.max(0, max - imagenes.length));
    e.target.value = "";
    const nuevas = [];
    for (const a of archivos) {
      const archivo = await comprimir(a);
      const key = aleatorio();
      nuevas.push({ key, archivo, preview: URL.createObjectURL(archivo), campo: `variante_imagen_${varianteKey}_${key}` });
    }
    if (nuevas.length) onChange([...imagenes, ...nuevas]);
  }

  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= imagenes.length) return;
    const c = [...imagenes];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  const quitar = (i) => onChange(imagenes.filter((_, k) => k !== i));

  return (
    <div className="pf-imagenes">
      <div className="pf-imagenes-lista">
        {imagenes.map((im, i) => (
          <div className="pf-imagen-item" key={im.key}>
            <img src={im.preview || im.url} alt="" className="imagen-actual" />
            {i === 0 && <span className="pf-imagen-principal">Principal</span>}
            <div className="pf-imagen-acciones">
              <button type="button" className="btn-ico" title="Mover antes" aria-label="Mover antes" disabled={i === 0} onClick={() => mover(i, -1)}>‹</button>
              <button type="button" className="btn-ico" title="Mover después" aria-label="Mover después" disabled={i === imagenes.length - 1} onClick={() => mover(i, 1)}>›</button>
              <button type="button" className="btn-ico" title="Quitar imagen" aria-label="Quitar imagen" onClick={() => quitar(i)}><IconoPapelera size={16} /></button>
            </div>
            {im.archivo && <input type="file" name={im.campo} hidden ref={(el) => asignarArchivo(el, im.archivo)} />}
          </div>
        ))}
        {imagenes.length < max && (
          <button type="button" className="pf-imagen-agregar" onClick={() => entrada.current?.click()}>
            <IconoMas size={18} /> Agregar
          </button>
        )}
      </div>
      <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={agregar} />
      <small>
        {imagenes.length} de {max} imágenes. La primera es la principal.
        {minimo > 1 && (
          <span style={{ color: imagenes.length < minimo ? "#b3261e" : undefined }}> SAGA pide al menos {minimo} para esta categoría.</span>
        )}
      </small>
    </div>
  );
}
