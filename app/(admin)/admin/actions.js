"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";

import {
  NOMBRE_COOKIE,
  DURACION_MS,
  passwordCorrecta,
  crearValorSesion,
} from "../../../lib/auth";
import { supabaseServer } from "../../../lib/supabaseServer";
import { slugify } from "../../../lib/slug";
import { getMarca, getCategoria } from "../../../lib/data";

const BUCKET = "productos";

// ============================================================
//  SESIÓN
// ============================================================

export async function iniciarSesion(prevState, formData) {
  const password = (formData.get("password") || "").toString();
  const redirectTo = (formData.get("redirect") || "/admin").toString();

  let correcta;
  try {
    correcta = passwordCorrecta(password);
  } catch (err) {
    return { error: err.message };
  }
  if (!correcta) {
    return { error: "Contraseña incorrecta." };
  }

  const valor = await crearValorSesion();
  const cookieStore = await cookies();
  cookieStore.set(NOMBRE_COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DURACION_MS / 1000),
  });

  redirect(redirectTo.startsWith("/") ? redirectTo : "/admin");
}

export async function cerrarSesion() {
  const cookieStore = await cookies();
  cookieStore.delete(NOMBRE_COOKIE);
  redirect("/admin/login");
}

// ============================================================
//  AYUDANTES
// ============================================================

function parseNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function parseAromas(texto) {
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
  const buffer = Buffer.from(await archivo.arrayBuffer());
  const ruta = `${productoId}/${indice}-${Date.now()}.${extensionDe(archivo)}`;
  const supabase = supabaseServer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, buffer, {
      contentType: archivo.type || "image/jpeg",
      upsert: true,
    });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

// ============================================================
//  CREAR / EDITAR PRODUCTO (formulario manual)
// ============================================================

export async function guardarProducto(prevState, formData) {
  try {
    const modo = (formData.get("modo") || "crear").toString();
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

    const supabase = supabaseServer();

    if (modo === "crear") {
      if (!id) id = nombre;
      id = slugify(id);
      if (!id) return { error: "No se pudo generar un id válido a partir del nombre." };

      const { data: existente } = await supabase
        .from("productos")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (existente) {
        return { error: `Ya existe un producto con el id "${id}". Elige otro id.` };
      }
    } else {
      id = (idOriginal || "").toString();
      if (!id) return { error: "Falta el id del producto a editar." };
    }

    // Sube imágenes nuevas (solo para las variantes donde se eligió un archivo).
    const variantesFinal = [];
    for (let i = 0; i < variantesEntrada.length; i++) {
      const v = variantesEntrada[i];
      const archivo = formData.get(`variante_imagen_${i}`);
      let imagen = v.imagenExistente || null;
      if (archivo && typeof archivo === "object" && "size" in archivo && archivo.size > 0) {
        imagen = await subirImagen(archivo, id, i);
      }
      variantesFinal.push({
        producto_id: id,
        nombre: v.nombre.toString().trim(),
        precio: parseNumero(v.precio),
        precio_oferta: parseNumero(v.precioOferta),
        stock: v.stock !== false,
        imagen,
        aromas: Array.isArray(v.aromas) ? v.aromas.filter(Boolean) : [],
        orden: i,
      });
    }

    const filaProducto = {
      id,
      marca,
      categoria,
      nombre,
      descripcion,
      aromas: aromasProducto,
      destacado,
    };

    if (modo === "crear") {
      const { error } = await supabase
        .from("productos")
        .insert({ ...filaProducto, orden: Date.now() });
      if (error) return { error: `No se pudo crear el producto: ${error.message}` };
    } else {
      const { error } = await supabase.from("productos").update(filaProducto).eq("id", id);
      if (error) return { error: `No se pudo actualizar el producto: ${error.message}` };
    }

    await supabase.from("variantes").delete().eq("producto_id", id);
    if (variantesFinal.length) {
      const { error } = await supabase.from("variantes").insert(variantesFinal);
      if (error) {
        return {
          error: `El producto se guardó, pero hubo un error con las variantes: ${error.message}`,
        };
      }
    }

    revalidatePath("/", "layout");
    revalidatePath(`/marca/${marca}`);
    revalidatePath(`/producto/${id}`);
    revalidatePath("/admin");
  } catch (err) {
    return { error: err.message || "Error inesperado al guardar el producto." };
  }

  redirect("/admin?guardado=1");
}

// ============================================================
//  ELIMINAR PRODUCTO
// ============================================================

export async function eliminarProducto(id) {
  const supabase = supabaseServer();
  const { data: producto } = await supabase
    .from("productos")
    .select("marca")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  if (producto?.marca) revalidatePath(`/marca/${producto.marca}`);
  revalidatePath("/admin");
  redirect("/admin?eliminado=1");
}

// ============================================================
//  IMPORTAR CSV (alta/edición masiva)
// ============================================================
//  Formato esperado (encabezados exactos, separador de columnas: coma;
//  para listas dentro de una celda —aromas—, separador "|"):
//
//  id_producto,marca,categoria,nombre_producto,descripcion,aromas_producto,
//  destacado,nombre_variante,precio,precio_oferta,stock,imagen,aromas_variante
//
//  - Una fila = una variante. Repite los datos del producto en cada fila
//    de sus variantes (mismo id_producto).
//  - Si id_producto viene vacío, se genera a partir de nombre_producto.
//  - Al reimportar un id_producto, sus variantes se reemplazan por
//    completo con las filas del CSV (no se acumulan).
//  - "destacado" y "stock" aceptan: true/false, si/no, 1/0 (vacío = true
//    para stock, false para destacado).
//  - "imagen" es opcional: pega ahí una URL si ya tienes la foto subida
//    en algún lugar. Si la dejas vacía, agrégala luego editando el
//    producto manualmente desde /admin.

function aBooleano(valor, porDefecto) {
  const v = (valor ?? "").toString().trim().toLowerCase();
  if (!v) return porDefecto;
  return ["true", "1", "si", "sí", "yes"].includes(v);
}

export async function importarCsv(prevState, formData) {
  const archivo = formData.get("archivo");
  if (!archivo || typeof archivo !== "object" || !("size" in archivo) || archivo.size === 0) {
    return { error: "Selecciona un archivo CSV." };
  }

  let texto;
  try {
    texto = await archivo.text();
  } catch {
    return { error: "No se pudo leer el archivo." };
  }

  const resultado = Papa.parse(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (resultado.errors?.length) {
    return {
      error: `El CSV tiene errores de formato: ${resultado.errors[0].message} (fila ${resultado.errors[0].row + 2}).`,
    };
  }

  const filas = resultado.data;
  if (!filas.length) return { error: "El archivo no tiene filas." };

  // Agrupa filas por producto, preservando el orden de aparición.
  const productosPorId = new Map();
  const omitidas = [];

  filas.forEach((fila, i) => {
    const numeroFila = i + 2; // +1 encabezado, +1 base 1
    const nombreProducto = (fila.nombre_producto || "").toString().trim();
    if (!nombreProducto) {
      omitidas.push(`Fila ${numeroFila}: falta "nombre_producto".`);
      return;
    }
    const marca = (fila.marca || "").toString().trim();
    const categoria = (fila.categoria || "").toString().trim();
    if (!marca || !getMarca(marca)) {
      omitidas.push(`Fila ${numeroFila}: la marca "${marca}" no existe.`);
      return;
    }
    if (!categoria || !getCategoria(marca, categoria)) {
      omitidas.push(`Fila ${numeroFila}: la categoría "${categoria}" no existe en "${marca}".`);
      return;
    }

    let id = (fila.id_producto || "").toString().trim();
    id = id ? slugify(id) : slugify(nombreProducto);
    if (!id) {
      omitidas.push(`Fila ${numeroFila}: no se pudo generar un id.`);
      return;
    }

    if (!productosPorId.has(id)) {
      productosPorId.set(id, {
        id,
        marca,
        categoria,
        nombre: nombreProducto,
        descripcion: (fila.descripcion || "").toString().trim(),
        aromas: parseAromas((fila.aromas_producto || "").toString().replaceAll("|", ",")),
        destacado: aBooleano(fila.destacado, false),
        variantes: [],
      });
    }

    const producto = productosPorId.get(id);
    producto.variantes.push({
      nombre: (fila.nombre_variante || "Único").toString().trim() || "Único",
      precio: parseNumero(fila.precio),
      precio_oferta: parseNumero(fila.precio_oferta),
      stock: aBooleano(fila.stock, true),
      imagen: (fila.imagen || "").toString().trim() || null,
      aromas: parseAromas((fila.aromas_variante || "").toString().replaceAll("|", ",")),
      orden: producto.variantes.length,
    });
  });

  if (productosPorId.size === 0) {
    return {
      error: "Ninguna fila pudo procesarse.",
      detalle: omitidas,
    };
  }

  const supabase = supabaseServer();
  const marcasTocadas = new Set();
  let ok = 0;
  const errores = [];

  for (const producto of productosPorId.values()) {
    const { variantes, ...filaProducto } = producto;
    const { error: errorProducto } = await supabase
      .from("productos")
      .upsert({ ...filaProducto, orden: Date.now() }, { onConflict: "id" });
    if (errorProducto) {
      errores.push(`${producto.id}: ${errorProducto.message}`);
      continue;
    }

    await supabase.from("variantes").delete().eq("producto_id", producto.id);
    const filasVariantes = variantes.map((v) => ({ ...v, producto_id: producto.id }));
    const { error: errorVariantes } = await supabase.from("variantes").insert(filasVariantes);
    if (errorVariantes) {
      errores.push(`${producto.id} (variantes): ${errorVariantes.message}`);
      continue;
    }

    ok++;
    marcasTocadas.add(producto.marca);
  }

  revalidatePath("/", "layout");
  for (const marca of marcasTocadas) revalidatePath(`/marca/${marca}`);
  revalidatePath("/admin");

  return {
    resumen: {
      procesados: ok,
      totalProductos: productosPorId.size,
      filasOmitidas: omitidas,
      errores,
    },
  };
}
