"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { drenarCola } from "../../../lib/saga-cola";
import { normalizar, CLAVES_UMBRAL, IDS } from "../../../lib/stock-niveles";
import Papa from "papaparse";

import {
  NOMBRE_COOKIE,
  DURACION_MS,
  passwordCorrecta,
  crearValorSesion,
  cerrarSesionServidor,
  rutaPanelSegura,
} from "../../../lib/auth";
import { comprobar, registrarFallo, limpiar, ipDe } from "../../../lib/login-limite";
import { query, transaction } from "../../../lib/db";
import { slugify } from "../../../lib/slug";
import { getMarcas, getPestanas } from "../../../lib/data";
import { getConfigMarcas } from "../../../lib/marcas-config";
import { guardarProductoDesdeForm, parseNumero, parseAromas } from "../../../lib/productos-guardar";
import { fijarStock } from "../../../lib/inventario";
import {
  refrescarPendientes, reintentarStockPendiente, sincronizarStockVariante, sincronizarCambiosStock, eliminarEnSaga,
  consultarSeleccion, aplicarAccionSeleccion, cambiarAccionSeleccion, resumirResultados,
} from "../../../lib/saga-sync";
import { getOpcionesSaga, getBaseIntegracion, IDS_BASE, CLAVE as CLAVE_SAGA_OPCIONES, CLAVE_ATRIBUTOS, CLAVE_CATALOGO, CLAVE_EQUIVALENCIAS } from "../../../lib/saga-opciones";
import { aplicarFormularioSaga, extrasPorCategoria, normalizarEquivalencias } from "../../../lib/equivalencias";
import { esGrupoValido, GRUPO_PREDETERMINADO, porId as campoWebPorId } from "../../../lib/campos-web";
import { TIPOS as TIPOS_ATRIBUTO, idDeEtiqueta, atributosDe, CLAVE_GENERALES, BLOQUES_GENERALES, UBICACIONES } from "../../../lib/atributos-categoria";
import { IDS as PERMISOS_IDS, guardarPermisosUsuario } from "../../../lib/ventas-permisos";
import { CLAVE as CLAVE_VENTAS } from "../../../lib/ventas-opciones";
import { IDS as IDS_ATRIBUTOS } from "../../../lib/saga-atributos";
import { IMAGENES_TOPE } from "../../../lib/saga-campos";
import { guardarSeguimiento } from "../../../lib/reclamos";
import { credenciales as credencialesSaga, producto as productoSaga, productosPorBusqueda as busquedaSaga, atributosCategoria as atributosCategoriaSaga, marcas as marcasSagaApi } from "../../../lib/sellercenter";
import { desdeSaga } from "../../../lib/saga-mapeo";
import { registrarMovimientoDesdeForm } from "../../../lib/movimiento-form";
import {
  crearUsuarioVentas,
  cambiarPasswordUsuarioVentas,
  eliminarUsuarioVentas,
  cerrarVenta,
  eliminarVentaCerrada,
  actualizarVentaAdmin,
  esClienteExistente,
} from "../../../lib/ventas";
import { ventaDesdeForm, valoresDeForm } from "../../../lib/ventas-form";
import { TELEFONO_SIN_DATO } from "../../../lib/ventas-core";
import {
  crearColaborador,
  actualizarColaborador,
  cambiarEstadoColaborador,
  marcarIngreso,
  marcarSalida,
  reabrirAsistencia,
  fijarExtras,
  eliminarAsistencia,
} from "../../../lib/asistencias";

// ============================================================
//  SESIÓN
// ============================================================

export async function iniciarSesion(prevState, formData) {
  const password = (formData.get("password") || "").toString();
  // Solo se vuelve a una ruta interna del panel (nunca a una URL externa).
  const redirectTo = rutaPanelSegura((formData.get("redirect") || "/admin").toString());

  // Límite de intentos: por IP (5 fallos en 15 min) y global (el panel tiene una sola contraseña, así que
  // quien rote de IP también topa con el límite global).
  const ip = ipDe(await headers());
  const claves = [{ clave: `ip:${ip}`, max: 5 }, { clave: "global", max: 40 }];
  const limite = await comprobar("admin", claves);
  if (limite.bloqueado) {
    return { error: `Demasiados intentos fallidos. Vuelve a intentarlo en ${limite.minutos} minuto(s).` };
  }

  let correcta;
  try {
    correcta = await passwordCorrecta(password);
  } catch {
    return { error: "No se pudo iniciar sesión. Avisa al administrador del sitio." };
  }
  if (!correcta) {
    await registrarFallo("admin", claves.map((c) => c.clave));
    return { error: "Contraseña incorrecta." };
  }
  await limpiar("admin", `ip:${ip}`);

  const valor = await crearValorSesion();
  const cookieStore = await cookies();
  cookieStore.set(NOMBRE_COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DURACION_MS / 1000),
  });

  redirect(redirectTo);
}

export async function cerrarSesion() {
  const cookieStore = await cookies();
  await cerrarSesionServidor(cookieStore.get(NOMBRE_COOKIE)?.value); // revoca la sesión también en el servidor
  cookieStore.delete(NOMBRE_COOKIE);
  redirect("/admin/login");
}

// ============================================================
//  CREAR / EDITAR PRODUCTO (formulario manual)
// ============================================================

export async function guardarProducto(prevState, formData) {
  const r = await guardarProductoDesdeForm(formData);
  if (r.error) return r;
  redirect(r.aviso ? `/admin?guardado=1&saga=${encodeURIComponent(r.aviso)}` : "/admin?guardado=1");
}

// ============================================================
//  ELIMINAR PRODUCTO
// ============================================================

/** Antes de borrar productos de la web: dejar sus variantes en stock 0 en SAGA (después ya no hay registro). */
async function agotarEnSaga(productoIds) {
  const filas = await query(
    "select distinct s.variante_id from sincronizaciones s join variantes v on v.id = s.variante_id where v.producto_id = any($1::text[])",
    [productoIds]
  );
  for (const f of filas) await sincronizarStockVariante(Number(f.variante_id), { cero: true });
}

/**
 * Qué pasa en las plataformas al eliminar de la web. alcance "web": en SAGA solo queda con stock 0 (se conserva allá);
 * alcance "todas": se quita también de SAGA (ProductRemove). Si SAGA no lo quita, no se borra nada de la web.
 * Devuelve un texto de error o "" si todo salió bien.
 */
async function quitarDePlataformas(ids, alcance) {
  if (alcance === "todas") {
    const r = await eliminarEnSaga(ids);
    return r.errores.length ? `No se eliminó nada de la web porque SAGA no quitó el producto. ${r.errores.join(" ")}` : "";
  }
  await agotarEnSaga(ids);
  return "";
}

export async function eliminarProducto(id, alcance = "web") {
  const errorPlataformas = await quitarDePlataformas([id], alcance);
  if (errorPlataformas) redirect(`/admin/productos/${encodeURIComponent(id)}?errorEliminar=${encodeURIComponent(errorPlataformas)}`);
  const [producto] = await query("select coalesce(pestana, marca) as pestana from productos where id = $1", [id]);
  await query("delete from productos where id = $1", [id]);

  revalidatePath("/", "layout");

  revalidatePath("/api/catalogo");
  if (producto?.pestana) revalidatePath(`/marca/${producto.pestana}`);
  revalidatePath("/admin");
  redirect("/admin?eliminado=1");
}

/** Elimina varios productos a la vez (filas marcadas en la tabla). */
export async function eliminarProductos(ids, alcance = "web") {
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)).filter(Boolean))];
  if (!lista.length || lista.length > 500) redirect("/admin");

  const errorPlataformas = await quitarDePlataformas(lista, alcance);
  if (errorPlataformas) redirect(`/admin?errorEliminar=${encodeURIComponent(errorPlataformas)}`);
  const pestanas = await query("select distinct coalesce(pestana, marca) as pestana from productos where id = any($1::text[])", [lista]);
  const borrados = await query("delete from productos where id = any($1::text[]) returning id", [lista]);

  revalidatePath("/", "layout");

  revalidatePath("/api/catalogo");
  for (const { pestana } of pestanas) revalidatePath(`/marca/${pestana}`);
  revalidatePath("/admin");
  redirect(`/admin?eliminados=${borrados.length}`);
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

  const [marcasCfg, pestanasCfg] = await Promise.all([getMarcas(), getPestanas()]);

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
    let marca = (fila.marca || "").toString().trim();
    let pestana = (fila.pestana || "").toString().trim();
    const categoria = (fila.categoria || "").toString().trim();
    // CSV antiguo (sin columna "pestana"): si la "marca" es en realidad una pestaña (ofertas,
    // importaciones, hogar…), la marca pasa a "otras" y esa pestaña se conserva.
    if (marca && !marcasCfg.some((m) => m.slug === marca) && !pestana && pestanasCfg.some((p) => p.slug === marca) && marcasCfg.some((m) => m.slug === "otras")) {
      pestana = marca;
      marca = "otras";
    }
    const marcaCfg = marcasCfg.find((m) => m.slug === marca);
    if (!marca || !marcaCfg) {
      omitidas.push(`Fila ${numeroFila}: la marca "${marca}" no existe.`);
      return;
    }
    if (!pestana) pestana = marcaCfg.pestanaDefault;
    const pestanaCfg = pestanasCfg.find((p) => p.slug === pestana);
    if (!pestanaCfg) {
      omitidas.push(`Fila ${numeroFila}: la pestaña "${pestana}" no existe.`);
      return;
    }
    if (!categoria || !pestanaCfg.categorias.some((c) => c.slug === categoria)) {
      omitidas.push(`Fila ${numeroFila}: la categoría "${categoria}" no está activa en la pestaña "${pestana}".`);
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
        pestana,
        categoria,
        nombre: nombreProducto,
        descripcion: (fila.descripcion || "").toString().trim(),
        notas: parseAromas((fila.notas_producto ?? fila.aromas_producto ?? "").toString().replaceAll("|", ",")).join(", ") || null,
        destacado: aBooleano(fila.destacado, false),
        variantes: [],
      });
    }

    const producto = productosPorId.get(id);
    const stockCantidad = parseNumero(fila.stock_cantidad);
    const stockMinimo = parseNumero(fila.stock_minimo) ?? 0;
    if (
      (stockCantidad !== null && (!Number.isInteger(stockCantidad) || stockCantidad < 0)) ||
      !Number.isInteger(stockMinimo) ||
      stockMinimo < 0
    ) {
      omitidas.push(`Fila ${numeroFila}: "stock_cantidad" y "stock_minimo" deben ser enteros desde 0.`);
      return;
    }
    producto.variantes.push({
      nombre: (fila.nombre_variante || "Único").toString().trim() || "Único",
      precio: parseNumero(fila.precio),
      precio_oferta: parseNumero(fila.precio_oferta),
      stock: aBooleano(fila.stock, true),
      imagen: (fila.imagen || "").toString().trim() || null,
      notas: parseAromas((fila.notas_variante ?? fila.aromas_variante ?? "").toString().replaceAll("|", ",")).join(", ") || null,
      orden: producto.variantes.length,
      sku: (fila.sku || "").toString().trim() || null,
      stock_cantidad: stockCantidad,
      stock_minimo: stockMinimo,
      costo: parseNumero(fila.costo),
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
      // Estado previo de sus variantes, para avisar a SAGA de lo que se agote, desactive o elimine.
      const previas = await query(
        "select id, nombre, sku, stock, stock_actual, stock_minimo, activo from variantes where producto_id = $1",
        [p.id]
      );
      const nombresCsv = new Set(variantes.map((v) => v.nombre));
      const skusCsv = new Set(variantes.map((v) => v.sku).filter(Boolean));
      const quitadas = previas.filter((x) => !nombresCsv.has(x.nombre) && !skusCsv.has(x.sku || ""));
      for (const x of quitadas) await sincronizarStockVariante(Number(x.id), { cero: true }); // antes de que se borren
      await transaction((t) => [
        t.query(
          `insert into productos (id, marca, pestana, categoria, nombre, descripcion, notas_aromaticas, destacado, orden)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (id) do update set marca=excluded.marca, pestana=excluded.pestana, categoria=excluded.categoria,
             nombre=excluded.nombre, descripcion=excluded.descripcion, notas_aromaticas=excluded.notas_aromaticas,
             destacado=excluded.destacado, orden=excluded.orden`,
          [p.id, p.marca, p.pestana, p.categoria, p.nombre, p.descripcion, p.notas, p.destacado, Date.now()]
        ),
        // Variantes: se actualizan (por SKU o, sin SKU, por nombre) en vez de
        // borrar y reinsertar, para conservar stock e historial.
        ...variantes.flatMap((v) =>
          v.sku
            ? [
                t.query(
                  `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, notas_aromaticas, orden,
                     sku, stock_minimo, costo, activo)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
                   on conflict (sku) where sku is not null do update set
                     producto_id=excluded.producto_id, nombre=excluded.nombre, precio=excluded.precio,
                     precio_oferta=excluded.precio_oferta,
                     stock = case when variantes.stock_actual is null then excluded.stock else variantes.stock end,
                     imagen=excluded.imagen,
                     imagenes = case when excluded.imagen is null then '{}'::text[]
                                     else array[excluded.imagen] || array_remove(variantes.imagenes, excluded.imagen) end,
                     notas_aromaticas=excluded.notas_aromaticas, orden=excluded.orden,
                     stock_minimo=excluded.stock_minimo, costo=excluded.costo, activo=true`,
                  [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.notas, v.orden,
                   v.sku, v.stock_minimo, v.costo]
                ),
              ]
            : [
                t.query(
                  `update variantes set precio=$3, precio_oferta=$4,
                     stock = case when stock_actual is null then $5 else stock end,
                     imagen=$6::text,
                     imagenes = case when $6::text is null then '{}'::text[] else array[$6::text] || array_remove(imagenes, $6::text) end,
                     notas_aromaticas=$7, orden=$8, stock_minimo=$9, costo=$10, activo=true
                   where producto_id = $1 and nombre = $2`,
                  [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.notas, v.orden,
                   v.stock_minimo, v.costo]
                ),
                t.query(
                  `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, notas_aromaticas, orden,
                     stock_minimo, costo, activo)
                   select $1::text, $2::text, $3::numeric, $4::numeric, $5::boolean, $6::text, $7::text, $8::int,
                          $9::int, $10::numeric, true
                   where not exists (select 1 from variantes where producto_id = $1 and nombre = $2)`,
                  [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.notas, v.orden,
                   v.stock_minimo, v.costo]
                ),
              ]
        ),
        // Variantes que ya no vienen en el CSV: con control de cantidad se
        // desactivan (conservan historial); sin control se eliminan.
        t.query(
          `update variantes set activo = false
            where producto_id = $1 and stock_actual is not null
              and not (nombre = any($2::text[]) or coalesce(sku,'') = any($3::text[]))`,
          [p.id, variantes.map((v) => v.nombre), variantes.map((v) => v.sku || "")]
        ),
        t.query(
          `delete from variantes
            where producto_id = $1 and stock_actual is null
              and not (nombre = any($2::text[]) or coalesce(sku,'') = any($3::text[]))`,
          [p.id, variantes.map((v) => v.nombre), variantes.map((v) => v.sku || "")]
        ),
      ]);

      await sincronizarCambiosStock(previas.filter((x) => !quitadas.includes(x)));

      // Cantidades de stock del CSV (columna opcional "stock_cantidad"): se
      // aplican como ajustes con historial (origen "csv").
      for (const v of variantes) {
        if (v.stock_cantidad === null) continue;
        const [fila] = v.sku
          ? await query("select id from variantes where sku = $1", [v.sku])
          : await query("select id from variantes where producto_id = $1 and nombre = $2", [p.id, v.nombre]);
        if (fila) {
          await fijarStock({
            varianteId: Number(fila.id),
            cantidad: v.stock_cantidad,
            motivo: "Importación CSV",
            origen: "csv",
          });
        }
      }
      ok++;
      marcasTocadas.add(p.pestana);
    } catch (err) {
      errores.push(`${p.id}: ${err.message}`);
    }
  }

  revalidatePath("/", "layout");

  revalidatePath("/api/catalogo");
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
//  INVENTARIO: movimientos manuales
// ============================================================
//  operacion: "entrada" | "salida" | "fijar" (conteo físico: deja el stock
//  en la cantidad indicada y registra la diferencia como ajuste).

export async function registrarMovimiento(prevState, formData) {
  return registrarMovimientoDesdeForm(formData);
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
    empresa: {
      razonSocial: txt(c.empresa?.razonSocial, "Razón social", { max: 150 }),
      ruc: (() => {
        const r = txt(c.empresa?.ruc, "RUC", { max: 11 });
        if (r && !/^\d{11}$/.test(r)) throw new Error("RUC: deben ser 11 dígitos.");
        return r;
      })(),
      direccion: txt(c.empresa?.direccion, "Domicilio del proveedor", { max: 200 }),
      email: (() => {
        const e = txt(c.empresa?.email, "Correo de reclamos", { max: 120 });
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Correo de reclamos: formato inválido.");
        return e;
      })(),
    },
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

  revalidatePath("/api/catalogo");
  revalidatePath("/admin/configuracion");
  return { ok: "Configuración guardada. Ya se ve en el sitio." };
}

export async function restablecerConfiguracion() {
  await query("delete from configuracion where clave = 'sitio'");
  revalidatePath("/", "layout");
  revalidatePath("/api/catalogo");
  revalidatePath("/admin/configuracion");
}

// ============================================================
//  VENTAS: usuarios del panel /operaciones y cierre de pendientes
// ============================================================

export async function crearUsuarioVentasAccion(prevState, formData) {
  try {
    await crearUsuarioVentas(
      (formData.get("usuario") || "").toString(),
      (formData.get("password") || "").toString()
    );
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath("/admin/configuracion");
  return { ok: "Usuario creado.", n: Date.now() };
}

export async function cambiarPasswordVentasAccion(id, prevState, formData) {
  try {
    await cambiarPasswordUsuarioVentas(Number(id), (formData.get("password") || "").toString());
  } catch (err) {
    return { error: err.message };
  }
  return { ok: "Contraseña actualizada.", n: Date.now() };
}

/** Vistas de /operaciones que puede usar un usuario (Ventas, Productos, Integraciones) y la columna Sistemas de Productos. */
export async function guardarPermisosVentasAccion(id, prevState, formData) {
  try {
    const permisos = Object.fromEntries(PERMISOS_IDS.map((k) => [k, formData.get(k) === "on"]));
    await guardarPermisosUsuario(Number(id), permisos);
  } catch (err) {
    return { error: err.message || "No se pudieron guardar los permisos." };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/operaciones", "layout");
  return { ok: "Permisos guardados.", n: Date.now() };
}

export async function eliminarUsuarioVentasAccion(id) {
  await eliminarUsuarioVentas(Number(id));
  revalidatePath("/admin/configuracion");
}

export async function cerrarVentaAccion(id) {
  await cerrarVenta(Number(id));
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/ventas/pendientes");
  revalidatePath("/admin/dashboard");
}

/** Edita cualquier venta (cerrada o pendiente) desde el reporte de ventas (admin). */
export async function editarVentaAccion(prevState, formData) {
  const id = Number(formData.get("id")) || null;
  if (!id) return { error: "Venta no encontrada." };

  const { venta, error } = await ventaDesdeForm(formData);
  if (error) return { error, valores: valoresDeForm(formData) };

  try {
    // Si se vació el tipo de cliente, se deduce por el historial del teléfono (igual que al registrar).
    if (!venta.tipo_cliente && venta.telefono !== TELEFONO_SIN_DATO) {
      venta.tipo_cliente = (await esClienteExistente(venta.telefono)) ? "RECOMPRA" : "NUEVO";
    }
    const ok = await actualizarVentaAdmin(id, venta);
    if (!ok) return { error: "La venta ya no existe.", valores: valoresDeForm(formData) };
  } catch (err) {
    return { error: `No se pudo guardar: ${err.message}`, valores: valoresDeForm(formData) };
  }
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/ventas/pendientes");
  revalidatePath("/admin/dashboard");
  return { ok: "Venta actualizada.", n: Date.now(), editada: true };
}

/** Elimina una venta cerrada desde el reporte de ventas (admin). */
export async function eliminarVentaAccion(id) {
  await eliminarVentaCerrada(Number(id));
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/ventas/pendientes");
  revalidatePath("/admin/dashboard");
}

// ============================================================
//  COLABORADORES Y ASISTENCIAS
// ============================================================

const CAMPOS_COLABORADOR = [
  "nombre", "cargo", "jornada", "tipo_pago", "multiplicador",
  "tarifa", "hora_entrada", "hora_salida", "refrigerio_min",
];

/** id = 0 crea un colaborador; id > 0 lo actualiza. */
export async function guardarColaboradorAccion(id, prevState, formData) {
  const datos = {};
  for (const c of CAMPOS_COLABORADOR) datos[c] = (formData.get(c) || "").toString();
  try {
    if (Number(id) > 0) await actualizarColaborador(Number(id), datos);
    else await crearColaborador(datos);
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/asistencias");
  return { ok: Number(id) > 0 ? "Cambios guardados." : "Trabajador agregado.", n: Date.now() };
}

export async function estadoColaboradorAccion(id, activo) {
  await cambiarEstadoColaborador(Number(id), Boolean(activo));
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/asistencias");
}

function revalidarAsistencias() {
  revalidatePath("/admin/asistencias");
  revalidatePath("/admin/asistencias/reporte");
}

export async function marcarIngresoAccion(colaboradorId, fecha, prevState, formData) {
  try {
    await marcarIngreso(Number(colaboradorId), fecha, (formData.get("hora") || "").toString());
  } catch (err) {
    return { error: err.message };
  }
  revalidarAsistencias();
  return { n: Date.now() };
}

export async function marcarSalidaAccion(asistenciaId, prevState, formData) {
  try {
    await marcarSalida(Number(asistenciaId), (formData.get("hora") || "").toString());
  } catch (err) {
    return { error: err.message };
  }
  revalidarAsistencias();
  return { n: Date.now() };
}

export async function extrasAccion(asistenciaId, aprobadas) {
  await fijarExtras(Number(asistenciaId), aprobadas);
  revalidarAsistencias();
}

export async function reabrirAsistenciaAccion(asistenciaId) {
  await reabrirAsistencia(Number(asistenciaId));
  revalidarAsistencias();
}

export async function eliminarAsistenciaAccion(asistenciaId) {
  await eliminarAsistencia(Number(asistenciaId));
  revalidarAsistencias();
}

// ============================================================
//  OPCIONES DE SAGA (aromas, medidas, tipos, condiciones, formato, marcas)
// ============================================================
//  Se guardan en `configuracion` (clave "saga_opciones"). Lo no guardado cae a
//  lib/saga-opciones.js.

function listaOpciones(formData, campo, etiqueta, { max = 500 } = {}) {
  const items = [
    ...new Set(
      (formData.get(campo) || "")
        .toString()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    ),
  ];
  if (!items.length) throw new Error(`"${etiqueta}" no puede quedar vacía.`);
  if (items.length > max) throw new Error(`"${etiqueta}": máximo ${max} elementos.`);
  if (items.some((i) => i.length > 100)) throw new Error(`"${etiqueta}": cada elemento admite hasta 100 caracteres.`);
  return items;
}

export async function guardarOpcionesSaga(prevState, formData) {
  let valor;
  let nuevaBase;
  let marcasNuevas = null;
  try {
    let acciones;
    try {
      acciones = JSON.parse((formData.get("accionesJson") || "[]").toString());
    } catch {
      throw new Error("No se pudieron leer las acciones. Recarga la página e inténtalo de nuevo.");
    }
    if (!Array.isArray(acciones) || acciones.length > 40) throw new Error("Acciones de vinculación inválidas.");
    const ids = new Set();
    acciones = acciones.map((a) => {
      const id = String(a?.id || "");
      const nombre = String(a?.nombre || "").trim();
      if (!/^[a-z0-9_]{1,40}$/.test(id) || ids.has(id) || ["crear", "ninguna", "desvincular"].includes(id)) {
        throw new Error(`Acción con id inválido o repetido: "${id}".`);
      }
      if (!nombre || nombre.length > 60) throw new Error(`La acción "${id}" necesita un nombre (máx. 60 caracteres).`);
      if (!Array.isArray(a.atributos) || a.atributos.some((x) => !IDS_ATRIBUTOS.has(x))) throw new Error(`La acción "${nombre}" tiene atributos no válidos.`);
      ids.add(id);
      return { id, nombre, atributos: [...new Set(a.atributos)] };
    });
    const falta = IDS_BASE.find((b) => !ids.has(b));
    if (falta) throw new Error(`No se puede quitar la acción base "${falta}".`);

    const categorias = [];
    for (const linea of (formData.get("categorias") || "").toString().split("\n")) {
      const l = linea.trim();
      if (!l) continue;
      const i = l.indexOf("=");
      const idCat = i > 0 ? l.slice(0, i).trim() : "";
      const nombreCat = i > 0 ? l.slice(i + 1).trim() : "";
      if (!/^\d{1,6}$/.test(idCat) || !nombreCat || nombreCat.length > 150) {
        throw new Error(`Categoría inválida: "${l}". Usa el formato  id = Descripción  (id numérico de hasta 6 dígitos).`);
      }
      if (categorias.some((c) => c.id === idCat)) throw new Error(`Categoría repetida: ${idCat}.`);
      categorias.push({ id: idCat, nombre: nombreCat });
    }
    if (!categorias.length) throw new Error("Agrega al menos una categoría de SAGA.");
    // «Permitir variantes» ya no se edita aquí (vive en Integraciones → Web): se conserva lo que hubiera guardado.
    const guardadas = await getOpcionesSaga();
    const listaGuardada = (campo, etiqueta, opciones) => (formData.has(campo) ? listaOpciones(formData, campo, etiqueta, opciones) : guardadas[campo]);
    const previas = new Map((guardadas.categorias || []).map((c) => [c.id, c]));
    // Campos extra que se muestran por categoría (casillas de Configuración). Solo se guardan los que SAGA
    // define para esa categoría; sin marcador (categoría recién agregada) rigen los predeterminados.
    for (const c of categorias) {
      // Imágenes mínimas/máximas que SAGA pide en la categoría (solo se guardan si cambian los valores por defecto).
      if (formData.has(`imgMin_${c.id}`)) {
        const entero = (k) => Math.trunc(Number(formData.get(k)));
        const min = entero(`imgMin_${c.id}`);
        const max = entero(`imgMax_${c.id}`);
        if (!(min >= 1 && min <= IMAGENES_TOPE) || !(max >= 1 && max <= IMAGENES_TOPE)) {
          throw new Error(`Categoría ${c.id}: las imágenes mínimas y máximas deben ser un entero de 1 a ${IMAGENES_TOPE}.`);
        }
        if (max < min) throw new Error(`Categoría ${c.id}: las imágenes máximas no pueden ser menos que las mínimas.`);
        c.imagenesMin = min;
        c.imagenesMax = max;
      }
      // ¿La categoría permite varias variantes? (casilla de Configuración)
      if (formData.has(`variantesMarca_${c.id}`)) c.variantes = formData.get(`variantes_${c.id}`) === "on";
      else if (typeof previas.get(c.id)?.variantes === "boolean") c.variantes = previas.get(c.id).variantes;
    }
    valor = {
      mapaCategorias: {}, // las equivalencias de categoría viven ahora en la clave `equivalencias`
      // Listas de valores de SAGA: ya no se editan en esta pantalla (se personalizan en la web con «Consultar SAGA»). Si el formulario
      // no las trae se conserva lo guardado; si las trae (formularios antiguos) se validan como siempre.
      aromas: listaGuardada(formData, "aromas", "Aromas", { max: 100 }),
      cantidades: listaGuardada(formData, "cantidades", "Medidas del frasco"),
      tiposPerfume: listaGuardada(formData, "tiposPerfume", "Tipos de perfume", { max: 100 }),
      condiciones: listaGuardada(formData, "condiciones", "Condiciones", { max: 50 }),
      generos: listaGuardada(formData, "generos", "Géneros", { max: 20 }),
      formatosBelleza: listaGuardada(formData, "formatosBelleza", "Formatos de belleza", { max: 100 }),
      paises: listaGuardada(formData, "paises", "Países", { max: 400 }),
      caracteristicas: listaGuardada(formData, "caracteristicas", "Características", { max: 300 }),
      categorias,
      acciones,
      urlsBase: listaOpciones(formData, "urlsBase", "URLs base de Seller Center", { max: 20 }),
      operadores: listaOpciones(formData, "operadores", "Códigos de operador", { max: 50 }),
    };
    const mala = valor.urlsBase.find((u) => !/^https:\/\/\S+$/.test(u));
    if (mala) throw new Error(`URL base inválida: "${mala}". Debe empezar con https://`);
    // Equivalencias de atributos (SAGA ↔ atributos web): se calculan sobre lo guardado y actualizan los campos usados.
    const { categorias: categoriasWebGuardadas } = await getConfigMarcas();
    nuevaBase = aplicarFormularioSaga(await getBaseIntegracion(), valor.categorias, {
      has: (k) => formData.has(k),
      get: (k) => formData.get(k),
      slugsWeb: new Set(categoriasWebGuardadas.map((c) => c.slug)),
    });
    // Marcas: cada marca de la web se empareja con UNA marca de SAGA (no se puede repetir una marca de SAGA).
    if (formData.has("marcasSagaMarca")) {
      const usadas = new Map();
      marcasNuevas = (await getConfigMarcas()).marcas.map((m) => {
        const k = `marcaSaga_${m.slug}`;
        const nombreSaga = formData.has(k) ? textoConfig(formData.get(k), `Marca "${m.nombre}" (nombre en SAGA)`, 100) : m.nombreSaga;
        if (nombreSaga) {
          const clave = nombreSaga.toLowerCase();
          if (usadas.has(clave)) throw new Error(`La marca de SAGA «${nombreSaga}» está asignada a «${usadas.get(clave)}» y a «${m.nombre}»: cada una solo puede usarse una vez.`);
          usadas.set(clave, m.nombre);
        }
        return { ...m, nombreSaga };
      });
    }
  } catch (err) {
    return { error: err.message || "No se pudo leer el formulario." };
  }

  try {
    await query(
      `insert into configuracion (clave, valor) values ('saga_opciones', $1::jsonb)
       on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
      [JSON.stringify(valor)]
    );
    await guardarClaveConfiguracion(CLAVE_EQUIVALENCIAS, nuevaBase.equivalencias);
    await guardarClaveConfiguracion(CLAVE_ATRIBUTOS, nuevaBase.catalogo);
    if (marcasNuevas) await guardarClaveConfiguracion("marcas", marcasNuevas);
  } catch (err) {
    return { error: `No se pudo guardar: ${err.message}` };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
  return { ok: "Opciones de SAGA guardadas.", n: Date.now() };
}

/**
 * Configuración → Integraciones → Web: atributos de cada categoría de la web (nombre, tipo y opciones) y equivalencias de
 * categoría con cada plataforma (varias por plataforma). Mantiene los enlaces de atributos que siguen siendo válidos.
 */
export async function guardarIntegracionWeb(prevState, formData) {
  try {
    const leer = (campo, vacio, msg) => {
      try {
        return JSON.parse((formData.get(campo) || vacio).toString());
      } catch {
        throw new Error(msg);
      }
    };
    const crudo = leer("atributosJson", "{}", "No se pudieron leer los atributos. Recarga la página e inténtalo de nuevo.");
    const crudoEnlaces = leer("enlacesJson", "{}", "No se pudieron leer las equivalencias de atributos. Recarga la página e inténtalo de nuevo.");
    const crudoFijos = leer("fijosJson", "{}", "No se pudieron leer las equivalencias de los campos de la web. Recarga la página e inténtalo de nuevo.");
    const crudoConfig = leer("configCategoriasJson", "{}", "No se pudo leer la configuración de las categorías. Recarga la página e inténtalo de nuevo.");
    const crudoCamposWeb = leer("camposWebJson", "{}", "No se pudieron leer los campos generales. Recarga la página e inténtalo de nuevo.");
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo) || !Array.isArray(crudo.catalogo)) throw new Error("Atributos inválidos.");
    const { categorias } = await getConfigMarcas();
    const slugs = new Set(categorias.map((c) => c.slug));

    // Catálogo único de atributos de la web (nombre, tipo, opciones y apartado) y cuáles se activan en cada categoría.
    if (crudo.catalogo.length > 80) throw new Error("Máximo 80 atributos en el catálogo de la web.");
    const ids = new Set();
    const lista = crudo.catalogo.map((a, i) => {
      const etiqueta = String(a?.etiqueta || "").trim();
      if (!etiqueta || etiqueta.length > 60) throw new Error(`Atributo ${i + 1}: el nombre es obligatorio (máx. 60 caracteres).`);
      const tipo = String(a?.tipo || "");
      if (!TIPOS_ATRIBUTO.includes(tipo)) throw new Error(`Atributo "${etiqueta}": tipo no válido.`);
      const id = /^[a-z0-9_]{1,40}$/.test(String(a?.id || "")) ? String(a.id) : idDeEtiqueta(etiqueta);
      if (!id || ids.has(id)) throw new Error(`El atributo "${etiqueta}" está repetido.`);
      ids.add(id);
      const sinOpciones = tipo === "texto" || tipo === "numero";
      // «…» es una opción como cualquier otra: SAGA lo guarda como valor, así que se conserva y se envía tal cual.
      const opciones = sinOpciones ? [] : [...new Set((Array.isArray(a.opciones) ? a.opciones : []).map((o) => String(o).trim()).filter(Boolean))];
      if (opciones.some((o) => o.length > 100) || opciones.length > 1000) throw new Error(`Atributo "${etiqueta}": máximo 1000 opciones de hasta 100 caracteres.`);
      if (!sinOpciones && !opciones.length) throw new Error(`Atributo "${etiqueta}": agrega al menos una opción.`);
      // Largo mínimo/máximo solo para texto libre (opcionales).
      const largo = (v) => (v === "" || v == null ? null : Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 1000 ? Number(v) : NaN);
      const min = tipo === "texto" ? largo(a?.min) : null;
      const max = tipo === "texto" ? largo(a?.max) : null;
      if (Number.isNaN(min) || Number.isNaN(max)) throw new Error(`Atributo "${etiqueta}": el largo mínimo y máximo deben ser números enteros entre 1 y 1000.`);
      if (min && max && min > max) throw new Error(`Atributo "${etiqueta}": el largo mínimo no puede ser mayor que el máximo.`);
      // General = vale para todas las categorías (Integraciones → Web → Campos generales); se ubica en un bloque.
      const general = a?.general === true;
      const bloque = general ? (BLOQUES_GENERALES[a?.bloque] ? a.bloque : "especificaciones") : null;
      const grupo = general ? BLOQUES_GENERALES[bloque] : esGrupoValido(a?.grupo) ? a.grupo : GRUPO_PREDETERMINADO;
      return { id, etiqueta, tipo, opciones, grupo, ...(general ? { general: true, bloque } : {}), ...(!general && UBICACIONES.includes(a?.ubicacion) ? { ubicacion: a.ubicacion } : {}), ...(min ? { min } : {}), ...(max ? { max } : {}) };
    });
    // Lo ya guardado no se borra (los productos usan esos atributos); se puede renombrar, cambiar de tipo y ampliar sus opciones.
    // Los valores de productos que no encajen con el nuevo tipo se ignoran al leerlos (limpiarPropios).
    const op = await getOpcionesSaga();
    for (const previo of op.catalogoWeb || []) {
      if (!lista.some((a) => a.id === previo.id)) lista.push({ id: previo.id, etiqueta: previo.etiqueta, tipo: previo.tipo, opciones: previo.opciones, grupo: previo.grupo, ...(previo.general ? { general: true, bloque: previo.bloque } : {}), ...(previo.ubicacion ? { ubicacion: previo.ubicacion } : {}), ...(previo.min ? { min: previo.min } : {}), ...(previo.max ? { max: previo.max } : {}) });
    }
    const activosEnviados = crudo.activos && typeof crudo.activos === "object" && !Array.isArray(crudo.activos) ? crudo.activos : {};
    const catalogo = {};
    for (const [slug, marcados] of Object.entries(activosEnviados)) {
      if (!slugs.has(slug)) throw new Error(`La categoría "${slug}" no existe.`);
      const set = new Set(Array.isArray(marcados) ? marcados.map(String) : []);
      const attrs = lista.filter((a) => set.has(a.id) && !a.general); // en el orden del catálogo (los generales van aparte)
      if (attrs.length > 40) throw new Error(`Categoría "${slug}": máximo 40 atributos activos.`);
      if (attrs.length) catalogo[slug] = attrs;
    }
    // Atributos generales: valen para todas las categorías.
    const atributosGenerales = lista.filter((a) => a.general);
    if (atributosGenerales.length) catalogo[CLAVE_GENERALES] = atributosGenerales;

    // Equivalencias de categoría por plataforma (varias por plataforma). En SAGA solo valen las de su lista de categorías.
    const plataformas = op.equivalencias.plataformas;
    // Las equivalencias de categoría (web ↔ plataforma) se editan desde cada plataforma (Integraciones → SAGA): aquí se conservan las
    // guardadas, solo de categorías de la web que siguen existiendo.
    const categoriasEq = {};
    for (const [web, porPlat] of Object.entries((await getBaseIntegracion()).equivalencias.categorias || {})) {
      if (slugs.has(web)) categoriasEq[web] = porPlat;
    }

    // Enlaces de atributos que siguen siendo válidos: el atributo web existe y la categoría de la plataforma sigue cruzada.
    const eqEnviada = normalizarEquivalencias({ plataformas, categorias: categoriasEq, atributos: crudoEnlaces });
    const atributos = {};
    for (const [web, porPlat] of Object.entries(eqEnviada.atributos)) {
      for (const [plat, porCat] of Object.entries(porPlat)) {
        for (const [cat, campos] of Object.entries(porCat)) {
          if (!(categoriasEq[web]?.[plat] || []).includes(cat)) continue;
          const validos = Object.fromEntries(Object.entries(campos).filter(([, attr]) => atributosDe(catalogo, web).some((a) => a.id === attr)));
          if (Object.keys(validos).length) (((atributos[web] ||= {})[plat] ||= {})[cat] = validos);
        }
      }
    }
    // Equivalencia de los campos propios de la web (solo los que se pueden cambiar) y variantes por categoría web.
    const fijosEnviados = normalizarEquivalencias({ plataformas, fijos: crudoFijos }).fijos;
    const fijos = {};
    for (const [web, porPlat] of Object.entries(fijosEnviados)) {
      if (!slugs.has(web)) continue;
      for (const [plat, campos] of Object.entries(porPlat)) {
        for (const [campoWeb, campoPlat] of Object.entries(campos)) {
          if (campoWebPorId(campoWeb)?.clave) continue;
          (((fijos[web] ||= {})[plat] ||= {})[campoWeb] = campoPlat);
        }
      }
    }
    const configCategorias = normalizarEquivalencias({ plataformas, configCategorias: crudoConfig }).configCategorias;
    for (const web of Object.keys(configCategorias)) if (!slugs.has(web)) delete configCategorias[web];
    // Los campos activos por categoría de SAGA y los equivalentes de los campos generales se editan en Integraciones → SAGA: aquí se conservan (solo de categorías que siguen cruzadas).
    const eqActual = (await getBaseIntegracion()).equivalencias;
    const camposCategoria = {};
    for (const [cat, campos] of Object.entries(eqActual.camposCategoria || {})) {
      if (Object.values(categoriasEq).some((p) => (p.saga || []).includes(cat))) camposCategoria[cat] = campos;
    }
    // Nombres de los campos generales: lo que trae el formulario o, si no, lo guardado. Con qué campo de SAGA se corresponden
    // (equivGenerales) se edita en Integraciones → SAGA: aquí se conserva.
    const camposWeb = formData.has("camposWebJson")
      ? normalizarEquivalencias({ plataformas, camposWeb: crudoCamposWeb?.camposWeb }).camposWeb
      : eqActual.camposWeb || {};
    const equivalencias = { plataformas, categorias: categoriasEq, atributos, fijos, configCategorias, camposCategoria, equivGenerales: eqActual.equivGenerales || {}, camposWeb };

    // Los campos de SAGA que se usan por categoría siguen a los enlaces (quitar un atributo web lo deja de usar).
    const [filaSaga] = await query("select valor from configuracion where clave = $1", [CLAVE_SAGA_OPCIONES]);
    const usados = extrasPorCategoria(equivalencias);
    const guardadoSaga = filaSaga?.valor && typeof filaSaga.valor === "object" ? filaSaga.valor : null;
    if (guardadoSaga && Array.isArray(guardadoSaga.categorias)) {
      guardadoSaga.categorias = guardadoSaga.categorias.map((c) => ({ ...c, extras: usados[c.id] || [] }));
      await guardarClaveConfiguracion(CLAVE_SAGA_OPCIONES, guardadoSaga);
    }

    await guardarClaveConfiguracion(CLAVE_CATALOGO, lista);
    await guardarClaveConfiguracion(CLAVE_ATRIBUTOS, catalogo);
    await guardarClaveConfiguracion(CLAVE_EQUIVALENCIAS, equivalencias);
  } catch (err) {
    return { error: err.message || "No se pudo guardar." };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
  revalidatePath("/operaciones/productos", "layout");
  return { ok: "Equivalencias y atributos de la web guardados.", n: Date.now() };
}

/** Agrega una plataforma al registro de integraciones (equivalencias de categorías, atributos y marcas). */
export async function agregarPlataforma(nombre) {
  try {
    const limpio = String(nombre || "").trim().slice(0, 40);
    const id = slugify(limpio).replace(/-/g, "_").slice(0, 30);
    if (!limpio || !id) return { error: "Escribe el nombre de la plataforma." };
    const base = await getBaseIntegracion();
    if (base.equivalencias.plataformas.some((p) => p.id === id)) return { error: `Ya existe la plataforma "${limpio}".` };
    const equivalencias = { ...base.equivalencias, plataformas: [...base.equivalencias.plataformas, { id, nombre: limpio }] };
    await guardarClaveConfiguracion(CLAVE_EQUIVALENCIAS, equivalencias);
    await guardarClaveConfiguracion(CLAVE_ATRIBUTOS, base.catalogo);
  } catch (err) {
    return { error: err.message || "No se pudo agregar la plataforma." };
  }
  revalidatePath("/admin/configuracion");
  return { ok: `Plataforma «${String(nombre).trim()}» agregada.` };
}

export async function restablecerOpcionesSaga() {
  await query("delete from configuracion where clave = 'saga_opciones'");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
}

// ============================================================
//  MARCAS, PESTAÑAS Y CATEGORÍAS
// ============================================================
//  Se guardan en `configuracion` (claves "marcas", "pestanas", "categorias").
//  Lo no guardado cae a data/marcas.js. Ver lib/marcas-config.js.

const SLUG_CONFIG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function listaJson(formData, campo, etiqueta) {
  let lista;
  try {
    lista = JSON.parse((formData.get(campo) || "[]").toString());
  } catch {
    throw new Error(`No se pudo leer ${etiqueta}. Recarga la página e inténtalo de nuevo.`);
  }
  if (!Array.isArray(lista) || lista.length > 200) throw new Error(`${etiqueta}: lista inválida.`);
  return lista;
}

function slugConfig(valor, etiqueta) {
  const slug = String(valor || "").trim();
  if (!SLUG_CONFIG.test(slug) || slug.length > 60) {
    throw new Error(`${etiqueta}: el identificador "${slug}" solo admite minúsculas, números y guiones (ej. mi-marca).`);
  }
  return slug;
}

function textoConfig(valor, etiqueta, max, { requerido = false } = {}) {
  const t = String(valor ?? "").trim();
  if (requerido && !t) throw new Error(`${etiqueta}: falta el nombre.`);
  if (t.length > max) throw new Error(`${etiqueta}: máximo ${max} caracteres.`);
  return t;
}

async function guardarClaveConfiguracion(clave, valor) {
  await query(
    `insert into configuracion (clave, valor) values ($1, $2::jsonb)
     on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
    [clave, JSON.stringify(valor)]
  );
}

function revalidarMarcasPestanas() {
  revalidatePath("/", "layout");
  revalidatePath("/api/catalogo");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
  revalidatePath("/operaciones/productos", "layout");
}

/** Marcas (las que se envían a SAGA): slug, nombre, nombre exacto en SAGA y pestaña por defecto. */
export async function guardarMarcasConfig(prevState, formData) {
  try {
    const lista = listaJson(formData, "marcasJson", "las marcas");
    const pestanas = await getPestanas();
    const slugsPestana = new Set(pestanas.map((p) => p.slug));
    const idsPlataforma = new Set((await getBaseIntegracion()).equivalencias.plataformas.map((p) => p.id));
    const previas = new Map((await getConfigMarcas()).marcas.map((m) => [m.slug, m]));
    const vistos = new Set();
    const marcas = lista.map((m, i) => {
      const slug = slugConfig(m?.slug, `Marca ${i + 1}`);
      if (vistos.has(slug)) throw new Error(`Marca repetida: "${slug}".`);
      vistos.add(slug);
      const nombre = textoConfig(m.nombre, `Marca "${slug}"`, 60, { requerido: true });
      // El nombre exacto en cada plataforma se empareja desde la plataforma (Integraciones → SAGA → Marcas): aquí se conserva lo guardado.
      const nombreSaga = previas.get(slug)?.nombreSaga || "";
      const pestanaDefault = String(m.pestanaDefault || "");
      if (!slugsPestana.has(pestanaDefault)) throw new Error(`Marca "${nombre}": elige una pestaña por defecto válida.`);
      const nombres = {};
      for (const [plat, valor] of Object.entries(previas.get(slug)?.nombres || {})) if (idsPlataforma.has(plat)) nombres[plat] = valor;
      return { slug, nombre, nombreSaga, nombres, pestanaDefault };
    });
    if (!marcas.length) throw new Error("Agrega al menos una marca.");

    const usadas = await query("select marca, count(*)::int as n from productos group by marca");
    const enUso = usadas.find((u) => !vistos.has(u.marca));
    if (enUso) {
      throw new Error(
        `No puedes quitar la marca "${enUso.marca}": ${enUso.n} producto(s) la usan. Cámbialos de marca primero.`
      );
    }
    await guardarClaveConfiguracion("marcas", marcas);
  } catch (err) {
    return { error: err.message || "No se pudo guardar." };
  }
  revalidarMarcasPestanas();
  return { ok: "Marcas guardadas.", n: Date.now() };
}

/** Catálogo de categorías + pestañas (con las categorías activas de cada una). */
export async function guardarPestanasConfig(prevState, formData) {
  try {
    const categoriasEntrada = listaJson(formData, "categoriasJson", "las categorías");
    const slugsCat = new Set();
    const categorias = categoriasEntrada.map((c, i) => {
      const slug = slugConfig(c?.slug, `Categoría ${i + 1}`);
      if (slugsCat.has(slug)) throw new Error(`Categoría repetida: "${slug}".`);
      slugsCat.add(slug);
      return { slug, nombre: textoConfig(c.nombre, `Categoría "${slug}"`, 60, { requerido: true }) };
    });
    if (!categorias.length) throw new Error("Agrega al menos una categoría.");

    const slugsPest = new Set();
    const pestanas = listaJson(formData, "pestanasJson", "las pestañas").map((p, i) => {
      const slug = slugConfig(p?.slug, `Pestaña ${i + 1}`);
      if (slugsPest.has(slug)) throw new Error(`Pestaña repetida: "${slug}".`);
      slugsPest.add(slug);
      const nombre = textoConfig(p.nombre, `Pestaña "${slug}"`, 60, { requerido: true });
      const color = String(p.color || "");
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`Pestaña "${nombre}": color inválido (formato #RRGGBB).`);
      const activas = [...new Set((Array.isArray(p.categorias) ? p.categorias : []).map(String))];
      const mala = activas.find((s) => !slugsCat.has(s));
      if (mala) throw new Error(`Pestaña "${nombre}": la categoría "${mala}" no existe.`);
      return { slug, nombre, descripcion: textoConfig(p.descripcion, `Pestaña "${nombre}" (descripción)`, 300), color, categorias: activas };
    });
    if (!pestanas.length) throw new Error("Agrega al menos una pestaña.");

    // Las marcas guardadas deben apuntar a una pestaña que siga existiendo.
    const marcasActuales = await getMarcas();
    const huerfana = marcasActuales.find((m) => !slugsPest.has(m.pestanaDefault));
    if (huerfana) throw new Error(`La marca "${huerfana.nombre}" usa la pestaña "${huerfana.pestanaDefault}" por defecto. Cámbiala en Marcas antes de quitar esa pestaña.`);

    // No se puede dejar un producto en una pestaña/categoría que ya no existe o no está activa.
    const usos = await query("select coalesce(pestana, marca) as pestana, categoria, count(*)::int as n from productos group by 1, 2");
    const activasPorPestana = new Map(pestanas.map((p) => [p.slug, new Set(p.categorias)]));
    for (const u of usos) {
      if (!activasPorPestana.has(u.pestana)) {
        throw new Error(`No puedes quitar la pestaña "${u.pestana}": ${u.n} producto(s) están en ella.`);
      }
      if (!activasPorPestana.get(u.pestana).has(u.categoria)) {
        throw new Error(`No puedes desactivar la categoría "${u.categoria}" en la pestaña "${u.pestana}": ${u.n} producto(s) la usan.`);
      }
    }

    await guardarClaveConfiguracion("categorias", categorias);
    await guardarClaveConfiguracion("pestanas", pestanas);
  } catch (err) {
    return { error: err.message || "No se pudo guardar." };
  }
  revalidarMarcasPestanas();
  return { ok: "Pestañas y categorías guardadas.", n: Date.now() };
}

/**
 * Cambia el identificador (slug) de una marca o de una pestaña ya existente y migra los productos
 * que lo usan (productos.marca / productos.pestana) en una sola transacción.
 * tipo: "marca" | "pestana".
 */
export async function renombrarIdentificador(tipo, viejo, nuevo) {
  try {
    if (tipo !== "marca" && tipo !== "pestana") throw new Error("Tipo inválido.");
    const slugNuevo = slugConfig(nuevo, tipo === "marca" ? "Marca" : "Pestaña");
    const slugViejo = String(viejo || "");
    if (slugNuevo === slugViejo) throw new Error("El identificador nuevo es igual al actual.");

    const { marcas, pestanasCrudas } = await getConfigMarcas();
    const lista = tipo === "marca" ? marcas : pestanasCrudas;
    if (!lista.some((x) => x.slug === slugViejo)) throw new Error(`No existe "${slugViejo}". Recarga la página.`);
    if (lista.some((x) => x.slug === slugNuevo)) throw new Error(`Ya existe "${slugNuevo}".`);

    const renombrar = (x) => (x.slug === slugViejo ? { ...x, slug: slugNuevo } : x);
    const upsert = `insert into configuracion (clave, valor) values ($1, $2::jsonb)
                    on conflict (clave) do update set valor = excluded.valor, updated_at = now()`;

    if (tipo === "marca") {
      const nuevas = marcas.map(renombrar);
      await transaction((t) => [
        t.query("update productos set marca = $2 where marca = $1", [slugViejo, slugNuevo]),
        t.query(upsert, ["marcas", JSON.stringify(nuevas)]),
      ]);
    } else {
      const nuevasPestanas = pestanasCrudas.map(renombrar);
      const nuevasMarcas = marcas.map((m) => (m.pestanaDefault === slugViejo ? { ...m, pestanaDefault: slugNuevo } : m));
      await transaction((t) => [
        t.query("update productos set pestana = $2 where pestana = $1", [slugViejo, slugNuevo]),
        t.query(upsert, ["pestanas", JSON.stringify(nuevasPestanas)]),
        t.query(upsert, ["marcas", JSON.stringify(nuevasMarcas)]),
      ]);
    }
  } catch (err) {
    return { error: err.message || "No se pudo cambiar el identificador." };
  }
  revalidarMarcasPestanas();
  return { ok: `Identificador cambiado a "${nuevo}".` };
}

/** Vuelve a los valores de data/marcas.js. */
export async function restablecerMarcasPestanas() {
  await query("delete from configuracion where clave = any($1)", [["marcas", "pestanas", "categorias"]]);
  revalidarMarcasPestanas();
}

/** Consulta a SAGA el estado de todos los envíos pendientes y reintenta ahora los avisos de stock que fallaron (botón de Productos). */
export async function actualizarEstadoSaga() {
  await reintentarStockPendiente({ forzar: true });
  await refrescarPendientes();
  revalidatePath("/admin");
  revalidatePath("/admin/integraciones/saga");
}

/** Consulta a SAGA el estado de las filas elegidas ("varianteId|alias") y guarda los motivos de su revisión. */
export async function consultarEstadoSagaSeleccion(claves) {
  const n = await consultarSeleccion(claves);
  after(() => drenarCola()); // continúa lo que haya quedado en cola o por avanzar
  revalidatePath("/admin");
  revalidatePath("/admin/integraciones/saga");
  return { mensaje: `Se consultó el estado de ${n} envío(s) en SAGA.` };
}

/** Aplica una acción de vinculación (vincular, vincular todo…) a las filas elegidas. */
export async function aplicarAccionSagaSeleccion(claves, modo) {
  const resultados = await aplicarAccionSeleccion(claves, String(modo || ""));
  after(() => drenarCola());
  revalidatePath("/admin");
  revalidatePath("/admin/integraciones/saga");
  return { mensaje: resultados.length ? resumirResultados(resultados) : "No hay filas para aplicar." };
}

/** Cambia el tipo de vinculación de las filas elegidas; con `enviarAhora` además envía esos datos a SAGA. */
export async function cambiarAccionSagaSeleccion(claves, accion, enviarAhora = false) {
  try {
    const n = await cambiarAccionSeleccion(claves, String(accion || ""));
    const resultados = enviarAhora && n ? await aplicarAccionSeleccion(claves, String(accion)) : [];
    if (resultados.length) after(() => drenarCola());
    revalidatePath("/admin/integraciones/saga");
    return { mensaje: `Tipo de vinculación cambiado en ${n} fila(s).${resultados.length ? ` Envío: ${resumirResultados(resultados)}` : ""}` };
  } catch (e) {
    return { mensaje: e.message };
  }
}

/**
 * Crea o edita una cuenta de SAGA (alias, usuario, API key, URL base y operador).
 * En edición, dejar la API key vacía conserva la guardada.
 */
export async function guardarCuentaSaga(prevState, formData) {
  const original = String(formData.get("alias_original") || "").trim();
  const nueva = !original;
  const alias = String(formData.get("alias") || "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") || "").trim();
  const userId = String(formData.get("user_id") || "").trim();
  const apiKey = String(formData.get("api_key") || "").trim();
  const baseUrl = String(formData.get("base_url") || "").trim();
  const operador = String(formData.get("operador") || "").trim();
  const activo = formData.get("activo") === "on";

  if (!/^[a-z0-9_]{2,30}$/.test(alias)) return { error: "Alias: 2 a 30 caracteres, solo minúsculas, números o _." };
  if (!nombre) return { error: "Escribe un nombre para la cuenta." };
  if (nombre.length > 80) return { error: "El nombre es demasiado largo." };
  if (!userId || userId.length > 150) return { error: "Escribe el usuario (UserID) de Seller Center." };
  if (nueva && !apiKey) return { error: "Escribe la API key." };
  if (apiKey.length > 300) return { error: "La API key es demasiado larga." };

  const op = await getOpcionesSaga();
  const [actual] = nueva ? [] : await query("select base_url, operador from cuentas_saga where alias = $1", [original]);
  const urlOk = op.urlsBase.includes(baseUrl) || (actual && actual.base_url === baseUrl);
  const operOk = op.operadores.includes(operador) || (actual && actual.operador === operador);
  if (!urlOk) return { error: "Elige una URL base de la lista." };
  if (!operOk) return { error: "Elige un código de operador de la lista." };

  try {
    if (nueva) {
      await query(
        "insert into cuentas_saga (alias, nombre, user_id, api_key, base_url, operador, activo) values ($1,$2,$3,$4,$5,$6,$7)",
        [alias, nombre, userId, apiKey, baseUrl, operador, activo]
      );
    } else {
      await query(
        `update cuentas_saga set alias=$2, nombre=$3, user_id=$4, api_key=coalesce(nullif($5,''), api_key),
                base_url=$6, operador=$7, activo=$8 where alias=$1`,
        [original, alias, nombre, userId, apiKey, baseUrl, operador, activo]
      );
    }
  } catch (e) {
    if (e.code === "23505") return { error: `Ya existe una cuenta con el alias "${alias}".` };
    return { error: `No se pudo guardar: ${e.message}` };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
  revalidatePath("/admin");
  return { ok: nueva ? "Cuenta agregada." : "Cuenta guardada.", n: Date.now() };
}

/** Elimina la cuenta y su historial de sincronización (no borra nada en SAGA). */
export async function eliminarCuentaSaga(alias) {
  await query("delete from cuentas_saga where alias = $1", [String(alias)]);
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
  revalidatePath("/admin");
}

/**
 * Consulta en SAGA un SKU del vendedor y devuelve los datos propios de SAGA para rellenar el
 * formulario de producto (nunca nombre, descripción, marca, precio web, imagen ni stock).
 */
export async function traerDatosSaga(alias, sku) {
  const codigo = String(sku || "").trim();
  if (!codigo) return { error: "Escribe primero el SKU de la variante." };
  const [cuenta] = await query("select * from cuentas_saga where alias = $1 and activo", [String(alias || "")]);
  if (!cuenta) return { error: "Elige una cuenta SAGA activa." };
  try {
    const raw = await productoSaga(credencialesSaga(cuenta), codigo);
    if (!raw) return { error: `SAGA no tiene el SKU "${codigo}" en la cuenta ${cuenta.nombre}.` };
    return desdeSaga(raw, await getOpcionesSaga(), cuenta);
  } catch (e) {
    return { error: `No se pudo consultar SAGA: ${e.message}` };
  }
}

/**
 * Trae de SAGA un producto por su SKU padre (el SKU de la primera variante): sus datos y, si forma un grupo, los de sus
 * variantes hermanas (mismo ParentSku). Solo lectura. Devuelve { padre, items: [{ sku, nombre, datos }], avisos }.
 */
export async function traerGrupoSaga(alias, sku) {
  const codigo = String(sku || "").trim();
  if (!codigo) return { error: "Escribe primero el SKU de la primera variante." };
  const [cuenta] = await query("select * from cuentas_saga where alias = $1 and activo", [String(alias || "")]);
  if (!cuenta) return { error: "Elige una cuenta SAGA activa." };
  try {
    const cred = credencialesSaga(cuenta);
    const op = await getOpcionesSaga();
    const raiz = await productoSaga(cred, codigo);
    if (!raiz) return { error: `SAGA no tiene el SKU "${codigo}" en la cuenta ${cuenta.nombre}.` };
    const padre = String(raiz.ParentSku || "").trim() || codigo;
    const crudos = new Map([[String(raiz.SellerSku), raiz]]);
    const avisos = [];
    // El padre de SAGA es la primera variante: si se escribió otro SKU del grupo, se trae también el padre.
    if (padre !== String(raiz.SellerSku)) {
      const cabeza = await productoSaga(cred, padre);
      if (cabeza) crudos.set(String(cabeza.SellerSku), cabeza);
    }
    // Hermanas: productos de la cuenta con el mismo ParentSku (se buscan por el nombre, que comparten).
    try {
      for (const x of await busquedaSaga(cred, raiz.Name || codigo)) {
        if (String(x.ParentSku || "").trim() === padre && !crudos.has(String(x.SellerSku))) crudos.set(String(x.SellerSku), x);
      }
    } catch (e) {
      avisos.push(`No se pudieron buscar las otras variantes del grupo (${e.message}); agrégalas con «Agregar variante».`);
    }
    const items = [...crudos.values()]
      .sort((a, b) => (String(a.SellerSku) === padre ? -1 : String(b.SellerSku) === padre ? 1 : String(a.SellerSku).localeCompare(String(b.SellerSku))))
      .map((raw) => ({ sku: String(raw.SellerSku), nombre: String(raw.Name || ""), datos: desdeSaga(raw, op, cuenta) }));
    return { padre, items, avisos };
  } catch (e) {
    return { error: `No se pudo consultar SAGA: ${e.message}` };
  }
}

/**
 * Requisitos de los atributos de una categoría de SAGA (solo lectura) para copiarlos al crear un atributo de la web:
 * tipo equivalente, obligatorio, largo mínimo/máximo, descripción y lista de valores exactos. Usa la primera cuenta activa.
 */
export async function consultarAtributosSaga(categoriaId) {
  const id = String(categoriaId || "").trim();
  if (!/^\d+$/.test(id)) return { error: "Elige una categoría de SAGA." };
  const [cuenta] = await query("select * from cuentas_saga where activo and api_key is not null and api_key <> '' order by alias limit 1");
  if (!cuenta) return { error: "No hay una cuenta SAGA activa con API key (Configuración → Integraciones → SAGA)." };
  try {
    const r = await atributosCategoriaSaga(credencialesSaga(cuenta), id);
    const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
    const TIPOS = { dropdown: "lista", multiselect: "multi", numberfield: "numero", textfield: "texto", datefield: "fecha" };
    const num = (v) => (Number(v) > 0 ? Number(v) : null);
    const atributos = lista(r?.Body?.Attribute).map((a) => ({
      id: a.FeedName,
      etiqueta: a.Label,
      tipo: TIPOS[a.InputType] || "texto",
      obligatorio: a.isMandatory === "1",
      nivel: a.GroupName === "Variation" ? "variante" : "producto",
      grupo: a.GroupName || "", // Main, Garantía y Envío, Price & Tax, Product Specifications, Variation
      descripcion: String(a.Description || "").split("//")[0].trim(),
      min: num(a.MinLength ?? a.MinimumLength),
      max: num(a.MaxLength),
      // "…" también es una opción válida (SAGA lo guarda como valor): se incluye.
      opciones: lista(a.Options?.Option).map((o) => o.Name).filter(Boolean),
    }));
    if (!atributos.length) return { error: `SAGA no devolvió atributos para la categoría ${id}.` };
    return { atributos };
  } catch (e) {
    return { error: `No se pudo consultar SAGA: ${e.message}` };
  }
}

// Marcas de SAGA (GetBrands): la lista es grande, se guarda unos minutos para no consultarla en cada búsqueda.
let cacheMarcasSaga = { t: 0, nombres: [] };

/** Busca marcas de SAGA por texto (solo referencia para emparejar las de la web). Devuelve hasta 30 nombres exactos. */
export async function consultarMarcasSaga(texto) {
  const q = String(texto || "").trim().toLowerCase();
  try {
    if (Date.now() - cacheMarcasSaga.t > 10 * 60 * 1000 || !cacheMarcasSaga.nombres.length) {
      const [cuenta] = await query("select * from cuentas_saga where activo and api_key is not null and api_key <> '' order by alias limit 1");
      if (!cuenta) return { error: "No hay una cuenta SAGA activa con API key (Configuración → Integraciones → SAGA)." };
      const r = await marcasSagaApi(credencialesSaga(cuenta));
      const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
      const nombres = lista(r?.Body?.Brands?.Brand ?? r?.Body?.Brands)
        .map((x) => (x.Brand ?? x).Name)
        .filter((n) => typeof n === "string" && n.trim());
      if (!nombres.length) return { error: "SAGA no devolvió marcas." };
      cacheMarcasSaga = { t: Date.now(), nombres: [...new Set(nombres)].sort((a, b) => a.localeCompare(b)) };
    }
    const todas = cacheMarcasSaga.nombres;
    const coincide = q ? todas.filter((n) => n.toLowerCase().includes(q)) : todas;
    // El nombre exacto primero, luego los que empiezan igual.
    coincide.sort((a, b) => Number(b.toLowerCase() === q) - Number(a.toLowerCase() === q) || Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)));
    return { marcas: coincide.slice(0, 30), total: coincide.length };
  } catch (e) {
    return { error: `No se pudo consultar SAGA: ${e.message}` };
  }
}

/** Reintento manual del aviso de stock de una variante en una cuenta (pestaña SAGA). */
export async function reintentarStockSaga(varianteId, alias) {
  await sincronizarStockVariante(Number(varianteId), { alias: String(alias || "") || null });
  revalidatePath("/admin/integraciones/saga");
  revalidatePath("/admin");
}

/** Reintenta ahora todos los avisos de stock pendientes, sin esperar el siguiente intento automático. */
export async function reintentarTodoStockSaga() {
  await reintentarStockPendiente({ forzar: true, limite: 50 });
  revalidatePath("/admin/integraciones/saga");
  revalidatePath("/admin");
}

// ============================================================
//  LISTAS DE VENTAS (categoría, entrega, tipo de cliente, método de pago, courier)
// ============================================================
//  Se guardan en `configuracion` (clave "ventas_opciones"); alimentan el formulario de /operaciones,
//  los filtros del reporte y el dashboard. Cambiar una lista no modifica ventas ya registradas.

export async function guardarOpcionesVentas(prevState, formData) {
  const CAMPOS = [
    ["categorias", "Categorías"],
    ["destinos", "Entrega"],
    ["tiposCliente", "Tipos de cliente"],
    ["metodosPago", "Métodos de pago"],
    ["couriers", "Couriers"],
  ];
  const valor = {};
  try {
    for (const [campo, etiqueta] of CAMPOS) {
      // En mayúsculas, como el resto de las ventas ya registradas.
      const items = [...new Set(listaOpciones(formData, campo, etiqueta, { max: 50 }).map((x) => x.toUpperCase()))];
      if (items.some((i) => i.length > 40)) throw new Error(`"${etiqueta}": cada elemento admite hasta 40 caracteres.`);
      valor[campo] = items;
    }
  } catch (err) {
    return { error: err.message || "No se pudo leer el formulario." };
  }
  try {
    await query(
      `insert into configuracion (clave, valor) values ($1, $2::jsonb)
       on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
      [CLAVE_VENTAS, JSON.stringify(valor)]
    );
  } catch (err) {
    return { error: `No se pudo guardar: ${err.message}` };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/dashboard");
  revalidatePath("/operaciones");
  return { ok: "Listas de ventas guardadas.", n: Date.now() };
}

export async function restablecerOpcionesVentas() {
  await query("delete from configuracion where clave = $1", [CLAVE_VENTAS]);
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/dashboard");
  revalidatePath("/operaciones");
}

// ============================================================
//  LIBRO DE RECLAMACIONES: seguimiento desde /admin/reclamos
// ============================================================
export async function guardarSeguimientoReclamo(prevState, formData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Reclamo inválido." };
  try {
    const r = await guardarSeguimiento(id, {
      estado: (formData.get("estado") || "").toString(),
      respuesta: (formData.get("respuesta") || "").toString(),
      notaInterna: (formData.get("notaInterna") || "").toString(),
      enviar: formData.get("accion") === "enviar",
    });
    if (r.error) return { error: r.error };
    revalidatePath("/admin/reclamos");
    revalidatePath(`/admin/reclamos/${id}`);
    return { ok: r.ok, n: Date.now() };
  } catch (err) {
    return { error: err.message || "No se pudo guardar." };
  }
}


// ---------------------------------------------------------------
//  Niveles de stock (Configuración → Inventario)
// ---------------------------------------------------------------
//  Se guardan en `configuracion` (clave "stock_niveles"): umbrales en unidades y niveles que avisan en la campana.

export async function guardarNivelesStock(prevState, formData) {
  const umbrales = {};
  for (const k of CLAVES_UMBRAL) umbrales[k] = Number(String(formData.get(`umbral_${k}`) ?? "").trim());
  let previo = 0;
  for (const k of CLAVES_UMBRAL) {
    if (!Number.isInteger(umbrales[k]) || umbrales[k] < 1) return { error: "Los límites deben ser números enteros de 1 en adelante." };
    if (umbrales[k] <= previo) return { error: "Cada límite debe ser mayor que el anterior (Muy bajo < Bajo < Normal < Alto)." };
    previo = umbrales[k];
  }
  const alertas = IDS.filter((id) => formData.get(`alerta_${id}`) === "on");
  const valor = normalizar({ umbrales, alertas });
  try {
    await query(
      `insert into configuracion (clave, valor) values ('stock_niveles', $1::jsonb)
       on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
      [JSON.stringify(valor)]
    );
  } catch (err) {
    return { error: "No se pudo guardar la configuración de inventario." };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin");
  return { ok: "Niveles de stock guardados.", n: Date.now() };
}

export async function restablecerNivelesStock() {
  await query("delete from configuracion where clave = 'stock_niveles'");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin");
}
