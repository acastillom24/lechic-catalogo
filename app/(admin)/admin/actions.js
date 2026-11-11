"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { drenarCola } from "../../../lib/saga-cola";
import Papa from "papaparse";

import {
  NOMBRE_COOKIE,
  DURACION_MS,
  passwordCorrecta,
  crearValorSesion,
} from "../../../lib/auth";
import { query, transaction } from "../../../lib/db";
import { slugify } from "../../../lib/slug";
import { getMarcas, getPestanas } from "../../../lib/data";
import { getConfigMarcas } from "../../../lib/marcas-config";
import { guardarProductoDesdeForm, parseNumero, parseAromas } from "../../../lib/productos-guardar";
import { fijarStock } from "../../../lib/inventario";
import {
  refrescarPendientes, reintentarStockPendiente, sincronizarStockVariante, sincronizarCambiosStock,
  consultarSeleccion, aplicarAccionSeleccion, cambiarAccionSeleccion, resumirResultados,
} from "../../../lib/saga-sync";
import { getOpcionesSaga, IDS_BASE } from "../../../lib/saga-opciones";
import { CLAVE as CLAVE_VENTAS } from "../../../lib/ventas-opciones";
import { IDS as IDS_ATRIBUTOS } from "../../../lib/saga-atributos";
import { camposDe } from "../../../lib/saga-campos";
import { guardarSeguimiento } from "../../../lib/reclamos";
import { credenciales as credencialesSaga, producto as productoSaga } from "../../../lib/sellercenter";
import { desdeSaga } from "../../../lib/saga-mapeo";
import { registrarMovimientoDesdeForm } from "../../../lib/movimiento-form";
import {
  crearUsuarioVentas,
  cambiarPasswordUsuarioVentas,
  eliminarUsuarioVentas,
  cerrarVenta,
  eliminarVentaCerrada,
} from "../../../lib/ventas";
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

export async function eliminarProducto(id) {
  await agotarEnSaga([id]);
  const [producto] = await query("select coalesce(pestana, marca) as pestana from productos where id = $1", [id]);
  await query("delete from productos where id = $1", [id]);

  revalidatePath("/", "layout");
  if (producto?.pestana) revalidatePath(`/marca/${producto.pestana}`);
  revalidatePath("/admin");
  redirect("/admin?eliminado=1");
}

/** Elimina varios productos a la vez (filas marcadas en la tabla). */
export async function eliminarProductos(ids) {
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)).filter(Boolean))];
  if (!lista.length || lista.length > 500) redirect("/admin");

  await agotarEnSaga(lista);
  const pestanas = await query("select distinct coalesce(pestana, marca) as pestana from productos where id = any($1::text[])", [lista]);
  const borrados = await query("delete from productos where id = any($1::text[]) returning id", [lista]);

  revalidatePath("/", "layout");
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
        aromas: parseAromas((fila.aromas_producto || "").toString().replaceAll("|", ",")),
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
      aromas: parseAromas((fila.aromas_variante || "").toString().replaceAll("|", ",")),
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
          `insert into productos (id, marca, pestana, categoria, nombre, descripcion, aromas, destacado, orden)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (id) do update set marca=excluded.marca, pestana=excluded.pestana, categoria=excluded.categoria,
             nombre=excluded.nombre, descripcion=excluded.descripcion, aromas=excluded.aromas,
             destacado=excluded.destacado, orden=excluded.orden`,
          [p.id, p.marca, p.pestana, p.categoria, p.nombre, p.descripcion, p.aromas, p.destacado, Date.now()]
        ),
        // Variantes: se actualizan (por SKU o, sin SKU, por nombre) en vez de
        // borrar y reinsertar, para conservar stock e historial.
        ...variantes.flatMap((v) =>
          v.sku
            ? [
                t.query(
                  `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, aromas, orden,
                     sku, stock_minimo, costo, activo)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
                   on conflict (sku) where sku is not null do update set
                     producto_id=excluded.producto_id, nombre=excluded.nombre, precio=excluded.precio,
                     precio_oferta=excluded.precio_oferta,
                     stock = case when variantes.stock_actual is null then excluded.stock else variantes.stock end,
                     imagen=excluded.imagen, aromas=excluded.aromas, orden=excluded.orden,
                     stock_minimo=excluded.stock_minimo, costo=excluded.costo, activo=true`,
                  [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden,
                   v.sku, v.stock_minimo, v.costo]
                ),
              ]
            : [
                t.query(
                  `update variantes set precio=$3, precio_oferta=$4,
                     stock = case when stock_actual is null then $5 else stock end,
                     imagen=$6, aromas=$7, orden=$8, stock_minimo=$9, costo=$10, activo=true
                   where producto_id = $1 and nombre = $2`,
                  [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden,
                   v.stock_minimo, v.costo]
                ),
                t.query(
                  `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, aromas, orden,
                     stock_minimo, costo, activo)
                   select $1::text, $2::text, $3::numeric, $4::numeric, $5::boolean, $6::text, $7::text[], $8::int,
                          $9::int, $10::numeric, true
                   where not exists (select 1 from variantes where producto_id = $1 and nombre = $2)`,
                  [p.id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.aromas, v.orden,
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
  revalidatePath("/admin/configuracion");
  return { ok: "Configuración guardada. Ya se ve en el sitio." };
}

export async function restablecerConfiguracion() {
  await query("delete from configuracion where clave = 'sitio'");
  revalidatePath("/", "layout");
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
    // Campos extra que se muestran por categoría (casillas de Configuración). Solo se guardan los que SAGA
    // define para esa categoría; sin marcador (categoría recién agregada) rigen los predeterminados.
    for (const c of categorias) {
      if (!formData.has(`extrasMarca_${c.id}`)) continue;
      const validos = new Set(camposDe(c.id).map((x) => x.id));
      c.extras = [...new Set(formData.getAll(`extras_${c.id}`).map(String).filter((x) => validos.has(x)))];
    }
    // Equivalencia categoría web → categoría SAGA (solo ids que están en la lista de categorías).
    const mapaCategorias = {};
    for (const [clave, v] of formData.entries()) {
      if (!clave.startsWith("mapaCat_")) continue;
      const web = clave.slice("mapaCat_".length);
      const idSaga = String(v || "").trim();
      if (!idSaga) continue;
      if (!categorias.some((c) => c.id === idSaga)) throw new Error(`La categoría SAGA ${idSaga} (equivalencia de «${web}») no está en la lista de categorías primarias.`);
      mapaCategorias[web] = idSaga;
    }
    valor = {
      mapaCategorias,
      aromas: listaOpciones(formData, "aromas", "Aromas", { max: 100 }),
      cantidades: listaOpciones(formData, "cantidades", "Medidas del frasco"),
      tiposPerfume: listaOpciones(formData, "tiposPerfume", "Tipos de perfume", { max: 100 }),
      condiciones: listaOpciones(formData, "condiciones", "Condiciones", { max: 50 }),
      generos: listaOpciones(formData, "generos", "Géneros", { max: 20 }),
      formatosBelleza: listaOpciones(formData, "formatosBelleza", "Formatos de belleza", { max: 100 }),
      paises: listaOpciones(formData, "paises", "Países", { max: 400 }),
      caracteristicas: listaOpciones(formData, "caracteristicas", "Características", { max: 300 }),
      categorias,
      acciones,
      urlsBase: listaOpciones(formData, "urlsBase", "URLs base de Seller Center", { max: 20 }),
      operadores: listaOpciones(formData, "operadores", "Códigos de operador", { max: 50 }),
    };
    const mala = valor.urlsBase.find((u) => !/^https:\/\/\S+$/.test(u));
    if (mala) throw new Error(`URL base inválida: "${mala}". Debe empezar con https://`);
  } catch (err) {
    return { error: err.message || "No se pudo leer el formulario." };
  }

  try {
    await query(
      `insert into configuracion (clave, valor) values ('saga_opciones', $1::jsonb)
       on conflict (clave) do update set valor = excluded.valor, updated_at = now()`,
      [JSON.stringify(valor)]
    );
  } catch (err) {
    return { error: `No se pudo guardar: ${err.message}` };
  }
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/productos", "layout");
  return { ok: "Opciones de SAGA guardadas.", n: Date.now() };
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
    const vistos = new Set();
    const marcas = lista.map((m, i) => {
      const slug = slugConfig(m?.slug, `Marca ${i + 1}`);
      if (vistos.has(slug)) throw new Error(`Marca repetida: "${slug}".`);
      vistos.add(slug);
      const nombre = textoConfig(m.nombre, `Marca "${slug}"`, 60, { requerido: true });
      const nombreSaga = textoConfig(m.nombreSaga, `Marca "${slug}" (nombre en SAGA)`, 100);
      const pestanaDefault = String(m.pestanaDefault || "");
      if (!slugsPestana.has(pestanaDefault)) throw new Error(`Marca "${nombre}": elige una pestaña por defecto válida.`);
      return { slug, nombre, nombreSaga, pestanaDefault };
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
