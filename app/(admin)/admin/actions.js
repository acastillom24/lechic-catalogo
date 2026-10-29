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
import { query, transaction } from "../../../lib/db";
import { subirArchivo } from "../../../lib/storage";
import { slugify } from "../../../lib/slug";
import { getMarca, getCategoria } from "../../../lib/data";
import { optimizarImagen } from "../../../lib/optimizarImagen";

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
        t.query("delete from variantes where producto_id = $1", [id]),
        ...variantesFinal.map((v) =>
          t.query(
            `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, aromas, orden)
             values ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [v.producto_id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden]
          )
        ),
      ]);
    } catch (err) {
      return { error: `No se pudo guardar el producto: ${err.message}` };
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
  const [producto] = await query("select marca from productos where id = $1", [id]);
  await query("delete from productos where id = $1", [id]);

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

  const marcasTocadas = new Set();
  let ok = 0;
  const errores = [];

  for (const producto of productosPorId.values()) {
    const { variantes, ...p } = producto;
    try {
      await transaction((t) => [
        t.query(
          `insert into productos (id, marca, categoria, nombre, descripcion, aromas, destacado, orden)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do update set marca=excluded.marca, categoria=excluded.categoria,
             nombre=excluded.nombre, descripcion=excluded.descripcion, aromas=excluded.aromas,
             destacado=excluded.destacado, orden=excluded.orden`,
          [p.id, p.marca, p.categoria, p.nombre, p.descripcion, p.aromas, p.destacado, Date.now()]
        ),
        t.query("delete from variantes where producto_id = $1", [p.id]),
        ...variantes.map((v) =>
          t.query(
            `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, aromas, orden)
             values ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden]
          )
        ),
      ]);
      ok++;
      marcasTocadas.add(p.marca);
    } catch (err) {
      errores.push(`${p.id}: ${err.message}`);
    }
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

// ============================================================
//  MODERACIÓN DE RESEÑAS
// ============================================================

export async function alternarResena(id, aprobado) {
  await query("update resenas set aprobado = $1 where id = $2", [aprobado, id]);
  revalidatePath("/admin/resenas");
  revalidatePath("/producto/[id]", "page");
}

export async function eliminarResena(id) {
  await query("delete from resenas where id = $1", [id]);
  revalidatePath("/admin/resenas");
  revalidatePath("/producto/[id]", "page");
}

// ============================================================
//  CONFIGURACIÓN GENERAL DEL SITIO
// ============================================================
//  El formulario envía todo el objeto como JSON (`configJson`). Aquí se
//  valida y se guarda en la tabla `configuracion` (clave "sitio"); lo que
//  no esté guardado cae a los valores por defecto de data/config.js.

const ICONOS_PAGO = ["tarjeta", "transferencia", "movil", "efectivo"];

function txt(valor, etiqueta, { max = 200, requerido = false } = {}) {
  const t = (valor ?? "").toString().trim();
  if (requerido && !t) throw new Error(`"${etiqueta}" es obligatorio.`);
  if (t.length > max) throw new Error(`"${etiqueta}" no puede superar ${max} caracteres.`);
  return t;
}

function urlHttps(valor, etiqueta, { requerido = false } = {}) {
  const t = txt(valor, etiqueta, { max: 300, requerido });
  if (t && !/^https:\/\/[^\s]+$/i.test(t)) {
    throw new Error(`"${etiqueta}" debe empezar con https:// y no tener espacios.`);
  }
  return t;
}

function lista(valor, etiqueta, { maxItems = 12, max = 500 } = {}) {
  const items = (Array.isArray(valor) ? valor : [])
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean);
  if (items.length > maxItems) throw new Error(`"${etiqueta}" admite hasta ${maxItems} líneas.`);
  for (const i of items) {
    if (i.length > max) throw new Error(`Una línea de "${etiqueta}" supera ${max} caracteres.`);
  }
  return items;
}

function validarConfig(c) {
  const whatsapp = txt(c.whatsapp, "WhatsApp", { max: 20, requerido: true }).replace(/\D/g, "");
  if (whatsapp.length < 8 || whatsapp.length > 15) {
    throw new Error('"WhatsApp" debe tener entre 8 y 15 dígitos, con código de país (ej: 51985219626).');
  }

  const entregas = (Array.isArray(c.entregas) ? c.entregas : []).map((e, i) => {
    const nombre = txt(e.nombre, `Entrega ${i + 1}: nombre`, { max: 60, requerido: true });
    const embalaje = Number(e.embalaje);
    if (!Number.isFinite(embalaje) || embalaje < 0 || embalaje > 1000) {
      throw new Error(`Entrega "${nombre}": el embalaje debe ser un número desde 0.`);
    }
    return {
      id: txt(e.id, "id", { max: 40 }) || slugify(nombre) || `entrega-${i + 1}`,
      nombre,
      embalaje,
      nota: txt(e.nota, `Entrega "${nombre}": nota`, { max: 300 }),
    };
  });
  if (entregas.length < 1 || entregas.length > 6) {
    throw new Error("Debe haber entre 1 y 6 formas de entrega.");
  }

  const metodosPago = (Array.isArray(c.metodosPago) ? c.metodosPago : [])
    .map((m) => ({
      nombre: txt(m.nombre, "Método de pago", { max: 60 }),
      icono: ICONOS_PAGO.includes(m.icono) ? m.icono : "tarjeta",
    }))
    .filter((m) => m.nombre);
  if (metodosPago.length > 10) throw new Error("Máximo 10 métodos de pago.");

  const politicas = (Array.isArray(c.politicas) ? c.politicas : [])
    .map((p) => ({
      titulo: txt(p.titulo, "Título de política", { max: 80 }),
      puntos: lista(p.puntos, "Puntos de política"),
    }))
    .filter((p) => p.titulo && p.puntos.length);
  if (politicas.length > 12) throw new Error("Máximo 12 políticas.");

  const b = c.bienvenida || {};
  const valores = (Array.isArray(b.valores) ? b.valores : [])
    .map((v) => ({
      titulo: txt(v.titulo, "Valor: título", { max: 60 }),
      texto: txt(v.texto, "Valor: texto", { max: 500 }),
    }))
    .filter((v) => v.titulo && v.texto);
  if (valores.length > 6) throw new Error("Máximo 6 valores en la bienvenida.");

  return {
    marca: txt(c.marca, "Nombre de la marca", { max: 60, requerido: true }),
    instagram: txt(c.instagram, "Instagram (usuario)", { max: 60 }),
    instagramUrl: urlHttps(c.instagramUrl, "Instagram (URL)"),
    tiktok: txt(c.tiktok, "TikTok (usuario)", { max: 60 }),
    tiktokUrl: urlHttps(c.tiktokUrl, "TikTok (URL)"),
    facebookUrl: urlHttps(c.facebookUrl, "Facebook (URL)"),
    telefono: txt(c.telefono, "Teléfono", { max: 30, requerido: true }),
    whatsapp,
    moneda: txt(c.moneda, "Moneda", { max: 5, requerido: true }),
    seo: {
      titulo: txt(c.seo?.titulo, "Título SEO", { max: 120, requerido: true }),
      descripcion: txt(c.seo?.descripcion, "Descripción SEO", { max: 300 }),
    },
    entregas,
    bienvenida: {
      titulo: txt(b.titulo, "Bienvenida: título", { max: 400 }),
      subtitulo: txt(b.subtitulo, "Bienvenida: subtítulo", { max: 100 }),
      intro: txt(b.intro, "Bienvenida: introducción", { max: 400 }),
      valores,
      cierre: txt(b.cierre, "Bienvenida: cierre", { max: 400 }),
    },
    horario: {
      texto: txt(c.horario?.texto, "Horario", { max: 100, requerido: true }),
      nota: txt(c.horario?.nota, "Nota del horario", { max: 300 }),
    },
    dinamicaCompra: lista(c.dinamicaCompra, "Dinámica de compra", { max: 200 }),
    metodosPago,
    envios: {
      lima: lista(c.envios?.lima, "Envíos Lima", { maxItems: 10, max: 300 }),
      provincias: lista(c.envios?.provincias, "Envíos provincias", { maxItems: 10, max: 300 }),
    },
    politicas,
  };
}

export async function guardarConfiguracion(prevState, formData) {
  let valor;
  try {
    valor = validarConfig(JSON.parse((formData.get("configJson") || "{}").toString()));
  } catch (err) {
    return { error: err.message || "No se pudo leer el formulario." };
  }

  try {
    await query(
      `insert into configuracion (clave, valor) values ('sitio', $1::jsonb)
       on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
      [JSON.stringify(valor)]
    );
  } catch (err) {
    return { error: `No se pudo guardar: ${err.message}` };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracion");
  return { ok: "Configuración guardada. Ya se ve en el sitio." };
}

export async function restablecerConfiguracion() {
  await query("delete from configuracion where clave = 'sitio'");
  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracion");
}
