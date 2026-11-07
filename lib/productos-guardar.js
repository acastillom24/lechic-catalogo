import { revalidatePath } from "next/cache";
import { query, transaction } from "./db";
import { subirArchivo } from "./storage";
import { slugify } from "./slug";
import { getMarca, getCategoria } from "./data";
import { optimizarImagen } from "./optimizarImagen";

// Lógica compartida para crear/editar productos. Sin "use server": las acciones
// que la usan (admin y sales) deciden quién puede llamarla y con qué modo.

export function parseNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function parseAromas(texto) {
  return (texto || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extensionDe(archivo) {
  const porNombre = (archivo.name || "").split(".").pop();
  if (porNombre && porNombre.length <= 5) return porNombre.toLowerCase();
  const mapa = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return mapa[archivo.type] || "jpg";
}

async function subirImagen(archivo, productoId, indice) {
  const bufferOriginal = Buffer.from(await archivo.arrayBuffer());
  const { buffer } = await optimizarImagen(
    bufferOriginal,
    extensionDe(archivo),
    archivo.type
  );
  const ruta = `${productoId}/${indice}-${Date.now()}`;
  try {
    return await subirArchivo(buffer, ruta);
  } catch (err) {
    throw new Error(`No se pudo subir la imagen: ${err.message}`);
  }
}

/**
 * Valida y guarda un producto con sus variantes.
 * Con `soloCrear` ignora el modo del formulario y nunca modifica productos
 * existentes. Con `restringido` (edición desde /sales) fuerza el modo editar y
 * es NO destructivo: no elimina ni desactiva variantes omitidas y conserva
 * costo y stock mínimo (datos de gestión que /sales no puede tocar).
 * Devuelve `{ error }` o `{ ok: true }` (tras revalidar rutas).
 */
export async function guardarProductoDesdeForm(formData, { soloCrear = false, restringido = false } = {}) {
  try {
    const modo = soloCrear ? "crear" : restringido ? "editar" : (formData.get("modo") || "crear").toString();
    const idOriginal = formData.get("idOriginal");
    let id = (formData.get("id") || "").toString().trim();
    const marca = (formData.get("marca") || "").toString();
    const categoria = (formData.get("categoria") || "").toString();
    const nombre = (formData.get("nombre") || "").toString().trim();
    const descripcion = (formData.get("descripcion") || "").toString().trim();
    const destacado = formData.get("destacado") === "on";
    const aromasProducto = parseAromas(formData.get("aromasProducto"));

    if (!nombre) return { error: "El nombre es obligatorio." };
    if (!marca || !getMarca(marca)) return { error: "Elige una marca válida." };
    if (!categoria || !getCategoria(marca, categoria)) {
      return { error: "Elige una categoría válida para esa marca." };
    }

    let variantesEntrada;
    try {
      variantesEntrada = JSON.parse((formData.get("variantesJson") || "[]").toString());
    } catch {
      return { error: "No se pudieron leer las variantes. Vuelve a intentarlo." };
    }
    if (!Array.isArray(variantesEntrada) || variantesEntrada.length === 0) {
      return { error: "Agrega al menos una variante." };
    }
    for (const v of variantesEntrada) {
      if (!v.nombre || !v.nombre.toString().trim()) {
        return {
          error:
            'Cada variante necesita un nombre (usa "Único" si el producto no tiene variantes).',
        };
      }
    }

    if (modo === "crear") {
      if (!id) id = nombre;
      id = slugify(id);
      if (!id) return { error: "No se pudo generar un id válido a partir del nombre." };

      const [existente] = await query("select id from productos where id = $1", [id]);
      if (existente) {
        return { error: `Ya existe un producto con el id "${id}". Elige otro id.` };
      }
    } else {
      id = (idOriginal || "").toString();
      if (!id) return { error: "Falta el id del producto a editar." };
      if (restringido) {
        const [existente] = await query("select id from productos where id = $1", [id]);
        if (!existente) return { error: "El producto que intentas editar no existe." };
      }
    }

    // Sube imágenes nuevas (solo para las variantes donde se eligió un archivo).
    const variantesFinal = [];
    for (let i = 0; i < variantesEntrada.length; i++) {
      const v = variantesEntrada[i];
      const archivo = formData.get(`variante_imagen_${i}`);
      // Al crear no hay imágenes previas: se ignora cualquier valor del cliente.
      let imagen = modo === "crear" ? null : v.imagenExistente || null;
      if (archivo && typeof archivo === "object" && "size" in archivo && archivo.size > 0) {
        imagen = await subirImagen(archivo, id, i);
      }
      const stockMinimo = parseNumero(v.stockMinimo) ?? 0;
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
        return { error: `Variante "${v.nombre}": el stock mínimo debe ser un entero desde 0.` };
      }
      const costo = parseNumero(v.costo);
      if (costo !== null && costo < 0) {
        return { error: `Variante "${v.nombre}": el costo no puede ser negativo.` };
      }
      variantesFinal.push({
        // Al crear nunca se actualizan variantes existentes (podrían ser de otro producto).
        id:
          modo === "crear"
            ? null
            : Number.isInteger(Number(v.id)) && Number(v.id) > 0
              ? Number(v.id)
              : null,
        producto_id: id,
        nombre: v.nombre.toString().trim(),
        precio: parseNumero(v.precio),
        precio_oferta: parseNumero(v.precioOferta),
        stock: v.stock !== false,
        imagen,
        aromas: Array.isArray(v.aromas) ? v.aromas.filter(Boolean) : [],
        orden: i,
        sku: (v.sku || "").toString().trim() || null,
        stock_minimo: stockMinimo,
        costo,
        activo: v.activo !== false,
      });
    }

    const skus = variantesFinal.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      return { error: "Hay SKUs repetidos entre las variantes de este producto." };
    }
    const existentes = variantesFinal.filter((v) => v.id !== null);
    const nuevas = variantesFinal.filter((v) => v.id === null);

    const filaProducto = {
      id,
      marca,
      categoria,
      nombre,
      descripcion,
      aromas: aromasProducto,
      destacado,
    };

    // Producto + variantes en una sola transacción (todo o nada).
    try {
      await transaction((t) => [
        modo === "crear"
          ? t.query(
              `insert into productos (id, marca, categoria, nombre, descripcion, aromas, destacado, orden)
               values ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [id, marca, categoria, nombre, descripcion, aromasProducto, destacado, Date.now()]
            )
          : t.query(
              `update productos set marca=$2, categoria=$3, nombre=$4, descripcion=$5, aromas=$6, destacado=$7
               where id = $1`,
              [id, marca, categoria, nombre, descripcion, aromasProducto, destacado]
            ),
        // Las variantes existentes se ACTUALIZAN por id (así no se pierden SKU,
        // stock ni historial de movimientos). `stock` solo se toca si la variante
        // no tiene control de cantidad: si lo tiene, lo manda stock_actual.
        ...existentes.map((v) =>
          t.query(
            `update variantes set nombre=$3, precio=$4, precio_oferta=$5,
               stock = case when stock_actual is null then $6 else stock end,
               imagen=$7, aromas=$8, orden=$9, sku=$10,
               stock_minimo = case when $14 then $11 else stock_minimo end,
               costo = case when $14 then $12 else costo end,
               activo=$13
             where id = $1 and producto_id = $2`,
            [v.id, id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden,
             v.sku, v.stock_minimo, v.costo, v.activo, !restringido]
          )
        ),
        // Variantes quitadas del formulario: con control de cantidad se desactivan
        // (conservan historial); sin control se eliminan.
        ...(restringido
          ? []
          : [
              t.query(
                `update variantes set activo = false
                  where producto_id = $1 and id <> all($2::bigint[]) and stock_actual is not null`,
                [id, existentes.map((v) => v.id)]
              ),
              t.query(
                `delete from variantes
                  where producto_id = $1 and id <> all($2::bigint[]) and stock_actual is null`,
                [id, existentes.map((v) => v.id)]
              ),
            ]),
        ...nuevas.map((v) =>
          t.query(
            `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, aromas, orden,
               sku, stock_minimo, costo, activo)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [v.producto_id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden,
             v.sku, v.stock_minimo, v.costo, v.activo]
          )
        ),
      ]);
    } catch (err) {
      if (String(err.message).includes("variantes_sku_uniq")) {
        return { error: "Ese SKU ya lo usa otra variante. Cada SKU debe ser único." };
      }
      return { error: `No se pudo guardar el producto: ${err.message}` };
    }

    revalidatePath("/", "layout");
    revalidatePath(`/marca/${marca}`);
    revalidatePath(`/producto/${id}`);
    revalidatePath("/admin");
    revalidatePath("/sales/productos");
  } catch (err) {
    return { error: err.message || "Error inesperado al guardar el producto." };
  }

  return { ok: true };
}
