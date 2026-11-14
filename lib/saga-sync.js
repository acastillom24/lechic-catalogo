/**
 * Orquestación web → SAGA. Todo es "mejor esfuerzo": nunca lanza hacia
 * quien llama; los fallos quedan en sincronizaciones.estado='error'.
 */
const { query } = require("./db");
const sc = require("./sellercenter");
const { revisionCompleta, resumirVendible } = require("./saga-revision");
const { validarProducto, advertenciasSaga, datosProducto, datosAccion, stockParaSaga, imagenesParaSaga } = require("./saga-mapeo");
const { heredarVariante } = require("./saga-campos");
const { extrasConPropios } = require("./atributos-categoria");
const { renombrarFijos } = require("./equivalencias");
const { efectivoBase } = require("./atributos-efectivos");
const { getOpcionesSaga } = require("./saga-opciones");
const { adjuntarStockPack, sincronizarPacksDe } = require("./packs");

async function getCuentasActivas() {
  return query("select alias, nombre, user_id from cuentas_saga where activo order by alias");
}

/** Todas las cuentas (activas o no) para administrarlas. Nunca incluye la API key. */
async function getCuentas() {
  return query(
    "select alias, nombre, user_id, base_url, operador, activo, (api_key is not null and api_key <> '') as tiene_key from cuentas_saga order by alias"
  );
}

/** Precio efectivo de una variante en una cuenta: el propio de la cuenta o, si está vacío, el de la web. */
const efectivo = (v, o) => ({
  ...v,
  precio: o?.precio ?? v.precio,
  precio_oferta: o?.precio_oferta ?? v.precio_oferta,
  oferta_inicio: o?.oferta_inicio ?? null,
  oferta_fin: o?.oferta_fin ?? null,
});

// `imagen` = { pendiente, feedId } fija el estado del envío de la imagen; sin él se conserva el anterior.
// `accion` = acción con la que se sincroniza (crear, vincular, …); sin ella se conserva la anterior.
async function marcar(varianteId, alias, estado, { feedId = null, error = null, origen = null, imagen = null, accion = null, usuario = null } = {}) {
  await query(
    `insert into sincronizaciones (variante_id, sistema, cuenta_alias, estado, feed_id, error, ultimo_sync, origen, imagen_pendiente, imagen_feed_id, accion, usuario_panel)
     values ($1,'saga',$2,$3,$4,$5, now(), coalesce($6::text, 'creado'), coalesce($7::boolean, false), $8, coalesce($9::text, 'crear'), $10)
     on conflict (variante_id, sistema, cuenta_alias)
     do update set estado=$3, feed_id=$4, error=$5, ultimo_sync=now(), origen=coalesce($6::text, sincronizaciones.origen),
       accion = coalesce($9::text, sincronizaciones.accion),
       cola_modo = null, proximo_envio = null, cola_intentos = null,
       imagen_reintentos = case when $4::text is distinct from sincronizaciones.feed_id then 0 else sincronizaciones.imagen_reintentos end,
       revision_fecha = case when $4::text is distinct from sincronizaciones.feed_id then null else sincronizaciones.revision_fecha end,
       venta_ok = null, venta_detalle = null, venta_fecha = null,
       usuario_panel = coalesce($10::text, sincronizaciones.usuario_panel),
       imagen_pendiente = case when $7::boolean is null then sincronizaciones.imagen_pendiente else $7::boolean end,
       imagen_feed_id   = case when $7::boolean is null then sincronizaciones.imagen_feed_id else $8 end`,
    [varianteId, alias, estado, feedId, error, origen, imagen ? imagen.pendiente : null, imagen ? imagen.feedId : null, accion, usuario]
  );
}

/** Atributos que sincroniza la acción de una fila (crear = stock, precio y oferta; id borrado → vincular). */
function atributosDeAccion(op, id) {
  if (id === "crear") return ["stock", "precio", "oferta"];
  return (op.acciones.find((a) => a.id === id) || op.acciones.find((a) => a.id === "vincular")).atributos;
}

async function cargar(productoId) {
  const [p] = await query("select * from productos where id = $1", [productoId]);
  if (!p) return null;
  const variantes = await query(
    "select * from variantes where producto_id = $1 and activo order by orden, id",
    [productoId]
  );
  await adjuntarStockPack(variantes);
  return { p, variantes };
}

// SAGA permite 1 envío (feed) cada 2 minutos por cuenta. Por eso cada pasada manda como máximo UN feed por tipo y cuenta
// con todas las variantes (y productos) juntos; lo que no cabe se encola y lo envía procesarCola() cuando toca.
const ESPERA_FEEDS = "SAGA permite 1 envío cada 2 minutos por cuenta";
const MAX_INTENTOS_COLA = 30; // rebotes seguidos por el límite antes de darlo por fallido (~1 h)
const MAX_SKU_FEED = 50; // SAGA admite hasta 50 feeds a la vez; se usa el mismo tope de SKU por feed

/**
 * Deja una variante × cuenta "en cola": pendiente, sin feed, con la acción a repetir (`cola_modo`) y la hora a
 * partir de la cual procesarCola() puede enviarla (2 minutos después). `contar` suma un intento cuando SAGA
 * rechazó el envío por su límite (no cuando solo no cupo en el feed de esta pasada); al llegar a MAX_INTENTOS_COLA
 * pasa a error para no quedar en bucle.
 */
async function encolar(varianteId, alias, modo, { usuario = null, motivo = ESPERA_FEEDS, contar = true } = {}) {
  const [fila] = await query(
    `insert into sincronizaciones (variante_id, sistema, cuenta_alias, estado, feed_id, error, ultimo_sync, origen, accion, usuario_panel, cola_modo, proximo_envio, cola_intentos)
     values ($1,'saga',$2,'pendiente',null,$3, now(), $4, $5, $6, $7, now() + interval '2 minutes', $8::int)
     on conflict (variante_id, sistema, cuenta_alias)
     do update set estado='pendiente', feed_id=null, error=$3, ultimo_sync=now(), accion=$5,
       usuario_panel = coalesce($6, sincronizaciones.usuario_panel), cola_modo=$7, proximo_envio=now() + interval '2 minutes',
       cola_intentos = case when sincronizaciones.cola_modo is null then $8::int else coalesce(sincronizaciones.cola_intentos, 0) + $8::int end
     returning cola_intentos`,
    [varianteId, alias, `En cola: ${motivo}. Se enviará solo en unos minutos.`.slice(0, 500), modo === "crear" ? "creado" : "vinculado", modo, usuario, modo, contar ? 1 : 0]
  );
  if (fila && fila.cola_intentos >= MAX_INTENTOS_COLA) {
    await marcar(varianteId, alias, "error", { error: "SAGA siguió limitando los envíos tras muchos intentos: reintenta o revisa Seller Center.", usuario });
  }
}

/** Envía y, si SAGA responde que ese mismo contenido ya se está procesando, usa el feed que indica en vez de fallar. */
async function enviarFeed(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e.feedEnProceso) return { feedId: e.feedEnProceso };
    throw e;
  }
}
const esLimite = (e) => Boolean(e.limiteFeeds || e.limiteConsultas);

/**
 * Aplica las acciones elegidas por variante y cuenta: `[{ varianteId, alias, modo }]` con modo
 *   - "crear":       valida y crea el producto en SAGA, solo si el SKU NO existe allí (no pisa nada);
 *   - un id de acción configurable (vincular, vincular_tecnicos, vincular_todo, actualizar, propias):
 *                    comprueba que el SKU exista, lo enlaza y envía solo los atributos de esa acción;
 *   - "desvincular": borra el enlace en la web (no toca nada en SAGA).
 * Ver sincronizarProductos para el detalle del envío por lotes y la cola.
 */
async function sincronizarProducto(productoId, acciones, { usuario = null } = {}) {
  return sincronizarProductos([{ productoId, acciones }], { usuario });
}

/**
 * Igual que sincronizarProducto pero para varios productos a la vez: `[{ productoId, acciones }]`. Una acción puede
 * traer su propio `usuario` (la cola lo conserva por fila). Una consulta de existencia por cuenta (no una por
 * variante) y UN feed por tipo y cuenta con todas las variantes de todos los productos (hasta 50 SKU); si SAGA limita
 * las consultas o los envíos, las filas quedan en cola (no en error). Un fallo de datos de una variante no frena a las demás.
 * Devuelve { resultados: [{alias, varianteId, variante, modo, estado, error, avisos}] }
 * con estado: pendiente | vinculada | desvinculada | en_cola | error.
 */
async function sincronizarProductos(entradas, { usuario = null } = {}) {
  const resultados = [];
  const productos = new Map(); // productoId → { p, variantes, porId }
  const todas = [];
  for (const { productoId, acciones } of entradas) {
    if (!acciones.length || productos.has(productoId)) continue;
    const dato = await cargar(productoId);
    if (!dato) continue;
    // El SKU padre de SAGA es el SKU de la primera variante (SAGA reemplaza cualquier otro código). Si lo guardado no es
    // el SKU de ninguna variante (p. ej. un código inventado al crear), se usa el de la primera.
    if (dato.p.usar_sku_padre && !dato.variantes.some((v) => v.sku && v.sku === dato.p.sku_padre)) {
      const primero = dato.variantes.find((v) => v.sku)?.sku;
      if (primero) {
        dato.p.sku_padre = primero;
        await query("update productos set sku_padre = $2 where id = $1", [productoId, primero]);
      }
    }
    const d = { ...dato, porId: new Map(dato.variantes.map((v) => [String(v.id), v])) };
    productos.set(productoId, d);
    for (const a of acciones) if (d.porId.has(String(a.varianteId))) todas.push({ ...a, d });
  }
  if (!todas.length) return { resultados };

  const cuentas = await query("select * from cuentas_saga where activo and alias = any($1)", [[...new Set(todas.map((a) => a.alias))]]);
  const op = await getOpcionesSaga();
  const propios = await query(
    "select * from precios_canal where sistema = 'saga' and variante_id = any($1::bigint[])",
    [[...productos.values()].flatMap((d) => d.variantes.map((v) => v.id))]
  );
  const propio = (v, alias) => propios.find((x) => String(x.variante_id) === String(v.id) && x.cuenta_alias === alias);
  // Paquete propio de una cuenta (si lo personalizó): reemplaza al general del producto solo en esa cuenta.
  const paquetes = await query(
    "select * from paquete_plataforma where sistema = 'saga' and producto_id = any($1::text[])",
    [[...productos.keys()]]
  );
  // Categoría primaria propia de una cuenta (si la personalizó): reemplaza a la general y a sus campos extra solo en esa cuenta.
  let categorias = [];
  try {
    categorias = await query(
      "select * from categoria_plataforma where sistema = 'saga' and producto_id = any($1::text[])",
      [[...productos.keys()]]
    );
  } catch {
    categorias = []; // la tabla aún no existe (falta correr neon/schema.sql)
  }
  const conCategoria = (p, alias) => {
    const o = categorias.find((x) => x.producto_id === p.id && x.cuenta_alias === alias);
    if (!o) return p;
    return {
      ...p,
      saga_categoria: o.saga_categoria,
      saga_extras: o.saga_extras || {},
      atributos: { ...(p.atributos || {}), variante_extras: o.variante_extras || {} },
    };
  };
  const conPaquete = (p, alias) => {
    const o = paquetes.find((x) => x.producto_id === p.id && x.cuenta_alias === alias);
    if (!o) return p;
    const q = { ...p };
    for (const k of ["contenido_paquete", "paquete_ancho", "paquete_largo", "paquete_alto", "paquete_peso"]) q[k] = o[k];
    return q;
  };

  for (const cuenta of cuentas) {
    let cred = null, errorCred = null;
    try {
      cred = sc.credenciales(cuenta);
    } catch (e) {
      errorCred = e;
    }
    const lista = todas.filter((x) => x.alias === cuenta.alias);

    // Una sola consulta con todos los SKU de la cuenta para saber cuáles existen.
    let existentes = null, errorLectura = null;
    const consultables = lista.filter((a) => a.modo !== "desvincular").map((a) => a.d.porId.get(String(a.varianteId)).sku).filter(Boolean);
    if (cred && consultables.length) {
      try {
        existentes = await sc.productosPorSku(cred, consultables);
      } catch (e) {
        errorLectura = e;
      }
    }

    const crear = [], actualizar = [], soloImagen = [];
    for (const a of lista) {
      // Herencia: el producto con lo que esta variante personalizó; luego lo propio de la cuenta (paquete, categoría).
      const ef = efectivoBase(a.d.p, a.d.porId.get(String(a.varianteId)));
      const pCuenta = conCategoria(conPaquete(ef.p, cuenta.alias), cuenta.alias);
      // Los atributos propios del producto pasan a los campos de SAGA equivalentes (Configuración → Atributos por categoría).
      const eq = extrasConPropios(op, pCuenta.categoria, pCuenta.saga_categoria, pCuenta.atributos?.propios, pCuenta.saga_extras, pCuenta.atributos?.variante_extras);
      const p = { ...pCuenta, saga_extras: eq.extras, atributos: { ...(pCuenta.atributos || {}), variante_extras: eq.varianteExtras } };
      // Con una sola variante la descripción es la del producto; la de la variante solo vale si el producto no tiene la suya.
      const unica = a.d.variantes.length <= 1;
      const v = { ...(unica && String(ef.p.descripcion || "").trim() ? { ...ef.v, descripcion: null } : ef.v), es_unica: unica };
      const usu = a.usuario ?? usuario;
      const base = { alias: cuenta.alias, varianteId: v.id, variante: v.nombre, modo: a.modo };
      try {
        if (a.modo === "desvincular") {
          await query("delete from sincronizaciones where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2", [v.id, cuenta.alias]);
          resultados.push({ ...base, estado: "desvinculada" });
          continue;
        }
        if (errorCred) throw errorCred;
        if (!v.sku) throw new Error(`La variante "${v.nombre}" no tiene SKU.`);
        if (errorLectura) throw errorLectura;
        const existe = existentes.has(String(v.sku));
        const vv = efectivo(heredarVariante(p.atributos, v), propio(v, cuenta.alias));

        if (a.modo === "crear") {
          if (existe) throw new Error(`El SKU "${v.sku}" ya existe en ${cuenta.nombre}: elige una acción de sincronizar (Crear no pisa lo que ya hay en SAGA).`);
          const faltan = validarProducto(p, vv, op);
          if (faltan.length) throw new Error(`Faltan datos: ${faltan.join(", ")}`);
          // Avisos de calidad (título 20–100, descripción ≥ 50): se envía igual, pero se informa al guardar.
          crear.push({ v, base, usu, datos: renombrarFijos(datosProducto(p, vv, op), op.equivalencias, p.categoria), avisos: advertenciasSaga(p, vv), modo: a.modo });
          continue;
        }

        // Acción configurable sobre un SKU existente.
        const accion = op.acciones.find((x) => x.id === a.modo);
        if (!accion) throw new Error(`La acción "${a.modo}" ya no existe en Configuración → SAGA.`);
        if (!existe) throw new Error(`SAGA no tiene el SKU "${v.sku}" en la cuenta ${cuenta.nombre}.`);
        const { datos, avisos } = datosAccion(p, vv, op, accion.atributos);
        renombrarFijos(datos, op.equivalencias, p.categoria);
        const hayCampos = datos.unidad || datos.nombre || datos.descripcion || datos.marca || datos.variacion ||
          datos.categoriaPrimaria || datos.codigoBarras || datos.parentSku || Object.keys(datos.productData).length > 0;
        const item = { v, base, usu, datos, avisos, modo: a.modo };
        if (hayCampos) actualizar.push(item);
        else if (datos.imagenes.length) soloImagen.push(item);
        else {
          await marcar(v.id, cuenta.alias, "publicado", { usuario: usu, feedId: null, origen: "vinculado", accion: a.modo, imagen: { pendiente: false, feedId: null } });
          resultados.push({ ...base, estado: "vinculada", avisos });
        }
      } catch (e) {
        if (esLimite(e)) {
          // SAGA limitó las consultas: no es un fallo de la variante, se reintenta solo.
          await encolar(v.id, cuenta.alias, a.modo, { usuario: usu, motivo: "SAGA limitó temporalmente las consultas" });
          resultados.push({ ...base, estado: "en_cola" });
          continue;
        }
        // Solo "crear" deja registro en error (se puede reintentar); en las demás solo se informa.
        if (a.modo === "crear" && !String(e.message).includes("ya existe en")) {
          await marcar(v.id, cuenta.alias, "error", { error: e.message.slice(0, 500), usuario: usu });
        }
        resultados.push({ ...base, estado: "error", error: e.message });
      }
    }

    // Un feed por tipo y cuenta (hasta 50 SKU): el primer lote se envía y los demás quedan en cola para la siguiente pasada.
    const lotes = [];
    for (const [tipo, items] of [["crear", crear], ["actualizar", actualizar], ["imagen", soloImagen]]) {
      for (let i = 0; i < items.length; i += MAX_SKU_FEED) lotes.push([tipo, items.slice(i, i + MAX_SKU_FEED)]);
    }
    for (const [i, [tipo, items]] of lotes.entries()) {
      if (i > 0) {
        for (const it of items) {
          await encolar(it.v.id, cuenta.alias, it.modo, { usuario: it.usu, contar: false });
          resultados.push({ ...it.base, estado: "en_cola" });
        }
        continue;
      }
      try {
        if (tipo === "crear") {
          const r = await enviarFeed(() => sc.crearProductos(cred, items.map((x) => x.datos)));
          // La imagen solo se acepta con el producto ya creado: queda pendiente hasta que termine el feed de
          // creación (ver refrescarPendientes) y pasen los 2 minutos que SAGA exige entre envíos.
          for (const it of items) {
            await marcar(it.v.id, cuenta.alias, "pendiente", {
              usuario: it.usu, feedId: r.feedId, origen: "creado", accion: "crear",
              imagen: { pendiente: it.datos.imagenes.length > 0, feedId: null },
            });
            resultados.push({ ...it.base, estado: "pendiente", avisos: it.avisos });
          }
        } else if (tipo === "actualizar") {
          const r = await enviarFeed(() => sc.actualizarParcialLote(cred, items.map((x) => x.datos)));
          // Las imágenes van en otro feed, 2 minutos después: quedan pendientes para refrescarPendientes.
          for (const it of items) {
            await marcar(it.v.id, cuenta.alias, "pendiente", {
              usuario: it.usu, feedId: r.feedId, origen: "vinculado", accion: it.modo,
              imagen: { pendiente: it.datos.imagenes.length > 0, feedId: null },
            });
            resultados.push({ ...it.base, estado: "pendiente", avisos: it.avisos });
          }
        } else {
          const r = await enviarFeed(() => sc.enviarImagenesLote(cred, items.map((x) => ({ sku: x.v.sku, urls: x.datos.imagenes }))));
          for (const it of items) {
            await marcar(it.v.id, cuenta.alias, "pendiente", {
              usuario: it.usu, feedId: r.feedId, origen: "vinculado", accion: it.modo, imagen: { pendiente: false, feedId: null },
            });
            resultados.push({ ...it.base, estado: "pendiente", avisos: it.avisos });
          }
        }
      } catch (e) {
        for (const it of items) {
          if (esLimite(e)) {
            await encolar(it.v.id, cuenta.alias, it.modo, { usuario: it.usu, motivo: e.limiteFeeds ? ESPERA_FEEDS : "SAGA limitó temporalmente las consultas" });
            resultados.push({ ...it.base, estado: "en_cola" });
            continue;
          }
          if (tipo === "crear") await marcar(it.v.id, cuenta.alias, "error", { error: e.message.slice(0, 500), usuario: it.usu });
          resultados.push({ ...it.base, estado: "error", error: e.message });
        }
      }
    }
  }
  return { resultados };
}

/**
 * Estado de un feed de SAGA: { terminado, fallo, mensaje, errores: [{ sku, mensaje }] }. Un feed puede traer
 * varias variantes: `errores` dice cuáles fallaron (ver falloDeFila).
 */
async function leerFeed(cred, id) {
  const r = await sc.estadoFeed(cred, id);
  const feed = r?.Body?.FeedDetail || r?.Body?.Feed || {};
  const st = String(feed.Status || "").toLowerCase();
  // SAGA devuelve { FeedErrors: { Error: {Code, Message, SellerSku} | [..] } }: se muestra solo el texto.
  const errores = [].concat(feed.FeedErrors?.Error ?? []).map((e) => ({ sku: e.SellerSku ? String(e.SellerSku) : null, mensaje: String(e.Message || "") }));
  const detalle = errores.map((e) => `${e.mensaje}${e.sku ? ` (SKU ${e.sku})` : ""}`).join(" · ");
  if (st === "error" || st === "canceled") return { terminado: true, fallo: true, mensaje: `Feed ${st}`, errores: [] };
  if (st !== "finished") return { terminado: false, fallo: false, mensaje: null, errores: [] };
  const fallo = Number(feed.FailedRecords || 0) > 0;
  return { terminado: true, fallo, mensaje: fallo ? (detalle || "El envío tuvo errores en SAGA").slice(0, 500) : null, errores };
}

/** Error de un SKU dentro de un feed compartido por varias variantes (null = a esa variante le fue bien). */
function falloDeFila(feed, sku) {
  if (!feed.fallo) return null;
  if (!feed.errores.some((e) => e.sku)) return feed.mensaje; // fallo general del feed
  const propios = feed.errores.filter((e) => e.sku === String(sku));
  return propios.length ? propios.map((e) => e.mensaje).join(" · ").slice(0, 500) : null;
}

/** Guarda (o limpia, con `rev` null) la revisión de contenido de SAGA de una fila. */
async function guardarRevision(varianteId, alias, rev) {
  await query(
    `update sincronizaciones set revision_categoria = $3, revision_motivos = $4::jsonb, revision_puntaje = $5,
            revision_fecha = case when $6::boolean then now() else null end
      where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2`,
    [varianteId, alias, rev?.categoria || null, rev && rev.motivos.length ? JSON.stringify(rev.motivos) : null, rev?.puntaje ?? null, Boolean(rev)]
  );
}

/** Guarda el checklist de venta de una fila (venta_ok = vendible). `r` viene de resumirVendible. */
async function guardarVenta(varianteId, alias, r) {
  await query(
    `update sincronizaciones set venta_ok = $3, venta_detalle = $4::jsonb, venta_fecha = now()
      where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2`,
    [varianteId, alias, r.vendible, JSON.stringify({ items: r.items, motivos: r.motivos })]
  );
}

/** Consulta a SAGA la revisión de calidad de un SKU (con `p` ya leído, si se tiene) y la guarda (nunca lanza). */
async function consultarRevision(cred, f, p) {
  try {
    const prod = p === undefined ? await sc.producto(cred, f.sku) : p;
    // Si ya está aprobado no hay motivos que buscar: se evita la segunda consulta.
    const qc = String(prod?.QCStatus || "").toLowerCase() === "approved" ? null : await sc.estadoQc(cred, f.sku);
    const rev = revisionCompleta(prod, qc);
    await guardarRevision(f.variante_id, f.cuenta_alias, rev);
    // SAGA reemplaza el ParentSku enviado por el SKU de la primera variante: se guarda el real para que las variantes
    // que se agreguen después se agrupen con el mismo padre. Solo aplica si el producto agrupa (usar_sku_padre).
    const padreSaga = String(prod?.ParentSku ?? "").trim();
    if (padreSaga) {
      await query(
        `update productos set sku_padre = $2 where usar_sku_padre and sku_padre is distinct from $2
           and id = (select producto_id from variantes where id = $1)`,
        [f.variante_id, padreSaga],
      );
    }
    return { ...rev, producto: prod, qc };
  } catch {
    return null;
  }
}

/** Imágenes que SAGA tiene de un producto (GetProducts): la lista, o la principal si no trae lista. */
function contarImagenesSaga(producto) {
  const n = [].concat(producto.Images?.Image || []).filter((x) => String(x).trim()).length;
  return n || (String(producto.MainImage || "").trim() ? 1 : 0);
}

/**
 * Avanza una fila pendiente un paso (feed de creación → imagen → revisión). Devuelve `{ imagen: url }` cuando la
 * fila necesita enviar su imagen (el envío se hace en lote, un solo feed por cuenta) o null. `memo` evita consultar
 * dos veces el mismo feed o producto en una pasada. Lanza si SAGA no responde.
 */
async function procesarFila(f, { soloImagen = false, memo = new Map(), op = null } = {}) {
  const sinImagen = { pendiente: false, feedId: null };
  const cred = sc.credenciales({ alias: f.cuenta_alias, ...f });
  // Un producto creado desde la web, ya confirmado en SAGA, pasa a mantenerse como "vincular".
  const alVinculo = f.accion === "crear" ? { accion: "vincular", origen: "vinculado" } : {};
  const falla = (mensaje) => marcar(f.variante_id, f.cuenta_alias, "error", { feedId: f.feed_id, error: mensaje, imagen: sinImagen });
  const feed = (id) => {
    const k = `${f.cuenta_alias}|${id}`;
    if (!memo.has(k)) memo.set(k, leerFeed(cred, id));
    return memo.get(k);
  };

  // SAGA deja de reconocer los feeds viejos (E012 Invalid Feed ID): se sigue con lo siguiente, que lo confirma el producto.
  const vencido = (e) => {
    if (/E012|Invalid Feed/i.test(String(e?.message))) return { terminado: true, fallo: false, mensaje: null, errores: [] };
    throw e;
  };
  const principal = await feed(f.feed_id).catch(vencido);
  if (!principal.terminado) return null;
  const falloPrincipal = falloDeFila(principal, f.sku);
  if (falloPrincipal) {
    await falla(falloPrincipal);
    return null;
  }
  if (f.imagen_pendiente) {
    // Todas las imágenes de la variante (hasta el máximo de su categoría), como JPG de Cloudinary.
    const urls = imagenesParaSaga({ saga_categoria: f.saga_categoria }, f, op);
    if (!urls.length) {
      await falla("La variante no tiene imagen para enviar a SAGA.");
      return null;
    }
    return { imagenes: urls };
  }
  if (soloImagen) return null;
  if (f.imagen_feed_id) {
    const img = await feed(f.imagen_feed_id).catch(vencido);
    if (!img.terminado) return null;
    const falloImg = falloDeFila(img, f.sku);
    if (falloImg) {
      await falla(`Imagen: ${falloImg}`);
      return null;
    }
    const k = `${f.cuenta_alias}|productos`;
    const p = memo.has(k) ? memo.get(k).get(String(f.sku)) || null : undefined;
    const rev = await consultarRevision(cred, f, p);
    // SAGA se quedó con menos imágenes de las que tiene la variante en la web (el aviso «missing images»): se reenvían
    // todas, una sola vez por envío (imagen_reintentos). Si tras el reenvío siguen faltando, queda como está y se informa.
    const urlsWeb = imagenesParaSaga({ saga_categoria: f.saga_categoria }, f, op);
    const enSaga = rev?.producto ? contarImagenesSaga(rev.producto) : null;
    if (enSaga !== null && urlsWeb.length > 1 && enSaga < urlsWeb.length && !(f.imagen_reintentos > 0)) {
      await marcar(f.variante_id, f.cuenta_alias, "pendiente", { feedId: f.feed_id, imagen: { pendiente: true, feedId: null } });
      await query("update sincronizaciones set imagen_reintentos = imagen_reintentos + 1 where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2", [f.variante_id, f.cuenta_alias]);
      return { imagenes: urlsWeb };
    }
    const qc = rev?.estado || "";
    const motivos = rev?.motivos?.length ? rev.motivos.map((m) => m.texto).join(" · ").slice(0, 500) : null;
    if (qc === "approved") {
      // Aprobado: ya es parte del catálogo; si SAGA aún no lo deja vender aparece en «Sin publicar» con el checklist.
      await marcar(f.variante_id, f.cuenta_alias, "publicado", { feedId: f.feed_id, imagen: sinImagen, ...alVinculo });
      await guardarRevision(f.variante_id, f.cuenta_alias, null);
      const venta = resumirVendible(rev.producto, rev.qc);
      if (venta) await guardarVenta(f.variante_id, f.cuenta_alias, venta);
    } else {
      // En revisión o rechazado: es lo que SAGA muestra en «Pendientes», con los motivos guardados para el reporte.
      await marcar(f.variante_id, f.cuenta_alias, "pendiente", { feedId: f.feed_id, error: motivos || "En revisión de SAGA" });
    }
    return null;
  }
  // Una fila ya revisada por SAGA (en Pendientes) solo cambia con «Consultar estado», no al terminar un feed viejo.
  if (f.revision_fecha) return null;
  await marcar(f.variante_id, f.cuenta_alias, "publicado", { feedId: f.feed_id, ...alVinculo });
  return null;
}

/**
 * Consulta a SAGA el avance de los envíos 'pendiente' y los pasa a publicado/error.
 * Alta de producto en pasos: (1) feed de creación; (2) al terminar bien, se envía la imagen (SAGA no la acepta
 * antes de que el producto exista ni antes de 2 minutos desde el envío anterior), todas las variantes de una
 * cuenta en un solo feed; (3) al terminar la imagen se consulta la revisión (QCStatus + motivos): aprobado →
 * publicado, rechazado → error, en revisión → sigue pendiente con los motivos guardados para el reporte.
 * Opciones: `usuario` (ver filtrosSaga), `claves` (solo esas filas, "varianteId|alias"), `soloImagen`
 * (solo el paso de envío de imagen) y `sinRevision` (omite las filas que ya tuvieron su primera lectura de la
 * revisión de SAGA; las que acaban de enviar la imagen y aún no la tienen SÍ se procesan).
 * Devuelve cuántas filas revisó. NO se llama al abrir una página: solo desde una acción explícita o el drenador.
 */
async function refrescarPendientes(productoId = null, { usuario = null, claves = null, soloImagen = false, sinRevision = false } = {}) {
  const filas = await query(
    `select s.variante_id, s.cuenta_alias, s.feed_id, s.accion, s.imagen_pendiente, s.imagen_feed_id, s.revision_fecha, s.imagen_reintentos,
            c.user_id, c.api_key, c.base_url, c.operador, v.sku, v.imagen, v.imagenes, p.saga_categoria
       from sincronizaciones s
       join cuentas_saga c on c.alias = s.cuenta_alias
       join variantes v on v.id = s.variante_id
       join productos p on p.id = v.producto_id
      where s.estado = 'pendiente' and s.feed_id is not null
        and ($1::text is null or v.producto_id = $1)
        and ($2::text is null or ($2 = '__admin' and s.usuario_panel is null) or s.usuario_panel = $2)
        and ($3::text[] is null or (s.variante_id::text || '|' || s.cuenta_alias) = any($3))
        and ($4::boolean = false or s.imagen_pendiente)
        and ($5::boolean = false or s.imagen_pendiente or s.imagen_feed_id is null or s.revision_fecha is null)`,
    [productoId, usuario, claves, soloImagen, sinRevision]
  );
  const memo = new Map();
  const op = await getOpcionesSaga();

  // Los SKU que ya enviaron su imagen se revisan juntos: una consulta de productos por cuenta, no una por variante.
  if (!soloImagen) {
    const porCuentaQc = new Map();
    for (const f of filas) if (f.imagen_feed_id && !f.imagen_pendiente) porCuentaQc.set(f.cuenta_alias, [...(porCuentaQc.get(f.cuenta_alias) || []), f]);
    for (const [alias, lista] of porCuentaQc) {
      try {
        memo.set(`${alias}|productos`, await sc.productosPorSku(sc.credenciales({ alias, ...lista[0] }), lista.map((f) => f.sku)));
      } catch {
        /* sin lote: se consulta fila a fila */
      }
    }
  }

  const imagenes = new Map(); // alias → filas que necesitan enviar imagen
  for (const f of filas) {
    try {
      const r = await procesarFila(f, { soloImagen, memo, op });
      if (r?.imagenes) imagenes.set(f.cuenta_alias, [...(imagenes.get(f.cuenta_alias) || []), { f, urls: r.imagenes }]);
    } catch {
      /* se reintenta en la próxima consulta */
    }
  }

  // Un solo feed de imágenes por cuenta (hasta 50 SKU). Si SAGA limita los envíos, las filas siguen pendientes y se reintentan.
  for (const [alias, todos] of imagenes) {
    const items = todos.slice(0, MAX_SKU_FEED);
    const cred = sc.credenciales({ alias, ...items[0].f });
    try {
      const r = await enviarFeed(() => sc.enviarImagenesLote(cred, items.map(({ f, urls }) => ({ sku: f.sku, urls }))));
      for (const { f } of items) {
        await marcar(f.variante_id, alias, "pendiente", { feedId: f.feed_id, imagen: { pendiente: false, feedId: r.feedId } });
      }
    } catch (e) {
      if (esLimite(e)) continue;
      for (const { f } of items) {
        await marcar(f.variante_id, alias, "error", { feedId: f.feed_id, error: `Imagen: ${e.message}`.slice(0, 500), imagen: { pendiente: false, feedId: null } });
      }
    }
  }
  return filas.length;
}

/**
 * Cola de envíos que SAGA no aceptó por su límite (1 feed cada 2 minutos por cuenta): por cada cuenta toma todas las
 * filas cuya hora de reintento ya pasó (hasta 150) y las envía juntas, de todos los productos, en un solo feed por
 * tipo. Lo que no cabe vuelve a la cola. Nunca lanza. La llama el drenador (lib/saga-cola.js).
 */
async function procesarCola() {
  try {
    const filas = await query(
      `select s.variante_id, s.cuenta_alias
         from sincronizaciones s
        where s.sistema = 'saga' and s.cola_modo is not null and s.proximo_envio <= now()
        order by s.proximo_envio, s.variante_id`
    );
    const cuentas = [...new Set(filas.map((f) => f.cuenta_alias))];
    for (const alias of cuentas) {
      const ids = filas.filter((f) => f.cuenta_alias === alias).slice(0, 150).map((f) => f.variante_id);
      // Se reserva ya (más allá del siguiente reintento) para que otra ejecución simultánea no envíe lo mismo.
      const reservadas = await query(
        `update sincronizaciones s set proximo_envio = now() + interval '3 minutes'
           from variantes v
          where v.id = s.variante_id and s.sistema = 'saga' and s.cuenta_alias = $1 and s.variante_id = any($2::bigint[])
            and s.cola_modo is not null and s.proximo_envio <= now()
          returning s.variante_id, s.cola_modo, s.usuario_panel, v.producto_id`,
        [alias, ids]
      );
      if (!reservadas.length) continue;
      const porProducto = new Map();
      for (const r of reservadas) {
        if (!porProducto.has(r.producto_id)) porProducto.set(r.producto_id, []);
        porProducto.get(r.producto_id).push({ varianteId: r.variante_id, alias, modo: r.cola_modo, usuario: r.usuario_panel });
      }
      const { resultados } = await sincronizarProductos([...porProducto].map(([productoId, acciones]) => ({ productoId, acciones })));
      // Lo que falló por datos (no por límite) deja de estar en cola y queda como error visible.
      const usuarios = new Map(reservadas.map((r) => [String(r.variante_id), r.usuario_panel]));
      for (const r of resultados.filter((x) => x.estado === "error")) {
        await marcar(r.varianteId, alias, "error", { error: String(r.error).slice(0, 500), usuario: usuarios.get(String(r.varianteId)) || null });
      }
    }
    await refrescarPendientes(null, { soloImagen: true });
  } catch {
    /* se reintenta en la próxima pasada */
  }
}

/**
 * Filtra una selección de filas ("varianteId|alias") a las que puede tocar `usuario` (null = todas, "__admin" =
 * sin usuario del panel, o el nombre de un usuario) y las devuelve con su producto y estado actual.
 */
async function seleccionPermitida(claves, usuario = null) {
  const lista = [...new Set((claves || []).map(String))].slice(0, 500);
  if (!lista.length) return [];
  return query(
    `select s.variante_id, s.cuenta_alias, s.estado, s.revision_fecha, v.producto_id
       from sincronizaciones s join variantes v on v.id = s.variante_id
      where s.sistema = 'saga' and (s.variante_id::text || '|' || s.cuenta_alias) = any($1)
        and ($2::text is null or ($2 = '__admin' and s.usuario_panel is null) or s.usuario_panel = $2)`,
    [lista, usuario]
  );
}

/**
 * Reclasifica según lo que SAGA tiene hoy de cada fila (`filas`: variante_id, cuenta_alias): errores sin respuesta de
 * SAGA, pendientes ya revisados, publicadas y sin publicar. Con el producto en SAGA:
 *   - QC no aprobado          → «Pendientes» (lo que SAGA muestra en su pestaña Pendientes), con los motivos;
 *   - QC aprobado, no publicado (IsPublished = 0) → «Sin publicar» (ya es parte del catálogo; checklist de lo que falta);
 *   - QC aprobado y publicado  → «Sincronizados».
 * Si SAGA no tiene el SKU no se cambia nada. Una cuenta o un SKU que fallan no frenan al resto. Devuelve cuántas
 * filas consultó.
 */
async function reclasificar(filas) {
  if (!filas.length) return 0;
  const ids = filas.map((f) => `${f.variante_id}|${f.cuenta_alias}`);
  const datos = await query(
    `select s.variante_id, s.cuenta_alias, s.estado, s.feed_id, s.accion, c.user_id, c.api_key, c.base_url, c.operador, v.sku
       from sincronizaciones s
       join cuentas_saga c on c.alias = s.cuenta_alias
       join variantes v on v.id = s.variante_id
      where s.sistema = 'saga' and (s.variante_id::text || '|' || s.cuenta_alias) = any($1)
        and (s.estado in ('publicado', 'pendiente') or (s.estado = 'error' and not s.stock_pendiente))`,
    [ids]
  );
  const porCuenta = new Map();
  for (const f of datos) porCuenta.set(f.cuenta_alias, [...(porCuenta.get(f.cuenta_alias) || []), f]);
  const sinImagen = { pendiente: false, feedId: null };
  let n = 0;
  for (const [alias, lista] of porCuenta) {
    try {
      const cred = sc.credenciales({ alias, ...lista[0] });
      const productos = await sc.productosPorSku(cred, lista.map((f) => f.sku));
      for (const f of lista) {
        const p = productos.get(String(f.sku));
        if (!p) continue; // SAGA no lo encuentra: no se cambia lo guardado
        const aprobado = String(p.QCStatus || "").toLowerCase() === "approved";
        const qc = aprobado ? null : await sc.estadoQc(cred, f.sku);
        if (aprobado) {
          if (f.estado !== "publicado") {
            await marcar(f.variante_id, alias, "publicado", {
              feedId: f.feed_id, imagen: sinImagen, ...(f.accion === "crear" ? { accion: "vincular", origen: "vinculado" } : {}),
            });
          }
          await guardarRevision(f.variante_id, alias, null);
          await guardarVenta(f.variante_id, alias, resumirVendible(p, qc));
        } else {
          const rev = revisionCompleta(p, qc);
          if (f.estado !== "pendiente") {
            const motivos = rev.motivos.map((m) => m.texto).join(" · ").slice(0, 500);
            await marcar(f.variante_id, alias, "pendiente", { feedId: f.feed_id, error: motivos || "En revisión de SAGA", imagen: sinImagen });
          }
          await guardarRevision(f.variante_id, alias, rev);
        }
        n++;
      }
    } catch {
      /* se reintenta en la próxima consulta */
    }
  }
  return n;
}

/**
 * «Consultar estado» de las filas elegidas: pregunta a SAGA solo por ellas. Los envíos que aún están en proceso
 * (feed de creación, imagen, primera revisión) avanzan un paso; el resto se reclasifica según lo que SAGA tiene hoy
 * (ver reclasificar). Devuelve cuántas consultó.
 */
async function consultarSeleccion(claves, { usuario = null } = {}) {
  const filas = await seleccionPermitida(claves, usuario);
  if (!filas.length) return 0;
  const clave = (f) => `${f.variante_id}|${f.cuenta_alias}`;
  const enProceso = filas.filter((f) => f.estado === "pendiente" && !f.revision_fecha);
  const resto = filas.filter((f) => !(f.estado === "pendiente" && !f.revision_fecha));
  const a = enProceso.length ? await refrescarPendientes(null, { usuario, claves: enProceso.map(clave) }) : 0;
  const b = await reclasificar(resto);
  return a + b;
}

/**
 * Aplica una acción de vinculación (vincular, vincular todo…, actualizar o una propia) a las filas elegidas,
 * agrupadas por producto. Devuelve los resultados de sincronizarProducto.
 */
async function aplicarAccionSeleccion(claves, modo, { usuario = null } = {}) {
  // Solo acciones de vinculación configuradas: nunca «crear» ni «desvincular» desde una selección masiva.
  const op = await getOpcionesSaga();
  if (!op.acciones.some((a) => a.id === modo)) return [];
  const filas = await seleccionPermitida(claves, usuario);
  const porProducto = new Map();
  for (const f of filas) {
    if (!porProducto.has(f.producto_id)) porProducto.set(f.producto_id, []);
    porProducto.get(f.producto_id).push({ varianteId: f.variante_id, alias: f.cuenta_alias, modo });
  }
  const resultados = [];
  for (const [productoId, acciones] of porProducto) {
    resultados.push(...(await sincronizarProducto(productoId, acciones, { usuario })).resultados);
  }
  return resultados;
}

/** Texto corto con el resultado de aplicar una acción a varias filas (para mostrar en la tabla). */
function resumirResultados(resultados) {
  const errores = resultados.filter((r) => r.estado === "error");
  const bien = resultados.length - errores.length;
  const detalle = errores.slice(0, 3).map((r) => `${r.variante} (${r.alias}): ${r.error}`).join(" · ");
  return `${bien} aplicada(s)${errores.length ? `, ${errores.length} con error: ${detalle}${errores.length > 3 ? "…" : ""}` : ""}.`;
}

/** Cambia el tipo de vinculación (columna `accion`) de las filas elegidas, sin enviar nada a SAGA. */
async function cambiarAccionSeleccion(claves, accion, { usuario = null } = {}) {
  const op = await getOpcionesSaga();
  if (!op.acciones.some((a) => a.id === accion)) throw new Error("Esa acción ya no existe en Configuración → SAGA.");
  const filas = await seleccionPermitida(claves, usuario);
  if (!filas.length) return 0;
  await query(
    `update sincronizaciones set accion = $3
      where sistema = 'saga' and variante_id = any($1::bigint[]) and cuenta_alias = any($2::text[])
        and (variante_id::text || '|' || cuenta_alias) = any($4)`,
    [filas.map((f) => f.variante_id), [...new Set(filas.map((f) => f.cuenta_alias))], accion, filas.map((f) => `${f.variante_id}|${f.cuenta_alias}`)]
  );
  return filas.length;
}

/**
 * Cambia stock en SAGA (0 al agotarse; cantidad real al reponer) para las cuentas donde
 * la variante está registrada, incluso si un envío anterior quedó en error (así un fallo no
 * deja stock abierto en SAGA). `cero` fuerza 0 (variante o producto que se elimina); `alias`
 * limita el envío a una cuenta. Nunca lanza.
 */
/**
 * Quita de SAGA todas las variantes enlazadas de los productos (ProductRemove, por cuenta). No borra nada de la web.
 * Devuelve { quitadas, errores: [texto] }; con errores no se debe borrar el producto de la web.
 */
async function eliminarEnSaga(productoIds) {
  const filas = await query(
    `select s.cuenta_alias, c.nombre as cuenta_nombre, c.user_id, c.api_key, c.base_url, c.operador, v.sku
       from sincronizaciones s
       join cuentas_saga c on c.alias = s.cuenta_alias
       join variantes v on v.id = s.variante_id
      where s.sistema = 'saga' and v.producto_id = any($1::text[]) and v.sku is not null and v.sku <> ''`,
    [productoIds]
  );
  const porCuenta = new Map();
  for (const f of filas) {
    if (!porCuenta.has(f.cuenta_alias)) porCuenta.set(f.cuenta_alias, { f, skus: [] });
    porCuenta.get(f.cuenta_alias).skus.push(f.sku);
  }
  let quitadas = 0;
  const errores = [];
  for (const { f, skus } of porCuenta.values()) {
    try {
      const cred = sc.credenciales({ alias: f.cuenta_alias, ...f });
      await sc.eliminarProductos(cred, skus);
      quitadas += skus.length;
    } catch (e) {
      errores.push(`${f.cuenta_nombre || f.cuenta_alias}: ${e.message}`);
    }
  }
  return { quitadas, errores };
}

async function sincronizarStockVariante(varianteId, { cero = false, alias = null, usuario = null } = {}) {
  try {
    const op = await getOpcionesSaga();
    const filas = await query(
      `select s.cuenta_alias, c.user_id, c.api_key, c.base_url, c.operador, s.origen, s.accion, v.sku,
            coalesce(pc.precio, v.precio) as precio, coalesce(pc.precio_oferta, v.precio_oferta) as precio_oferta,
            pc.oferta_inicio, pc.oferta_fin, v.stock, v.stock_actual, v.stock_minimo, v.activo, v.es_pack
         from sincronizaciones s
         join cuentas_saga c on c.alias = s.cuenta_alias and c.activo
         join variantes v on v.id = s.variante_id
         left join precios_canal pc on pc.variante_id = s.variante_id and pc.sistema = 'saga' and pc.cuenta_alias = s.cuenta_alias
        where s.variante_id = $1 and s.sistema = 'saga' and ($2::text is null or s.cuenta_alias = $2)`,
      [varianteId, alias]
    );
    for (const f of filas) f.variante_id = varianteId;
    await adjuntarStockPack(filas);
    for (const f of filas) {
      try {
        if (!f.sku) continue;
        const cred = sc.credenciales({ alias: f.cuenta_alias, ...f });
        // Solo se envía lo que la acción de esta variante sincroniza (Configuración → SAGA).
        const attrs = new Set(atributosDeAccion(op, f.accion));
        if (!cero && !attrs.has("stock")) continue;
        const stock = cero ? 0 : stockParaSaga(f);
        // Vinculada y sin control de cantidad: no se conoce el stock real, así que no se pisa el de SAGA
        // (solo se avisa cuando la variante se agota).
        if (!cero && !f.es_pack && f.origen === "vinculado" && f.stock_actual === null && stock > 0) continue;
        const r = await sc.actualizarPrecioStock(cred, {
          sellerSku: f.sku,
          stock,
          precio: attrs.has("precio") ? f.precio : null,
          precioOferta: attrs.has("oferta") ? f.precio_oferta : null,
          ofertaInicio: attrs.has("oferta") ? f.oferta_inicio : null,
          ofertaFin: attrs.has("oferta") ? f.oferta_fin : null,
        });
        await marcar(varianteId, f.cuenta_alias, "pendiente", { feedId: r.feedId, usuario });
        await query(
          "update sincronizaciones set stock_pendiente = false, intentos = 0, proximo_intento = null where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2",
          [varianteId, f.cuenta_alias]
        );
      } catch (e) {
        await marcar(varianteId, f.cuenta_alias, "error", { error: `${e.message.slice(0, 440)} — se reintentará automáticamente`, usuario });
        // Reintento con espera creciente: 1, 2, 4, 8, 16 y luego cada 30 minutos.
        await query(
          `update sincronizaciones
              set stock_pendiente = true, proximo_intento = now() + make_interval(mins => least(30, power(2, intentos)::int)), intentos = intentos + 1
            where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2`,
          [varianteId, f.cuenta_alias]
        );
      }
    }
  } catch (e) {
    console.error("[saga] stock", varianteId, e.message);
  }
}

/**
 * Reintenta los avisos de stock que fallaron (cola en `sincronizaciones.stock_pendiente`). Cada
 * reintento recalcula el stock actual, así que siempre envía el valor vigente. `forzar` ignora la
 * espera. Se dispara solo: con cada movimiento de inventario, al abrir el panel y con el botón.
 */
// Tras estos intentos seguidos solo se reintenta a mano (evita bucles con SKUs que nunca existieron en SAGA).
const MAX_INTENTOS_AUTO = 12;

async function reintentarStockPendiente({ limite = 10, forzar = false, usuario = null } = {}) {
  try {
    const filas = await query(
      `select variante_id, cuenta_alias from sincronizaciones
        where sistema = 'saga' and stock_pendiente
          and ($1 or (intentos < ${MAX_INTENTOS_AUTO} and (proximo_intento is null or proximo_intento <= now())))
          and ($3::text is null or usuario_panel = $3)
        limit $2`,
      [forzar, limite, usuario]
    );
    for (const f of filas) await sincronizarStockVariante(Number(f.variante_id), { alias: f.cuenta_alias });
    return filas.length;
  } catch (e) {
    console.error("[saga] reintentos", e.message);
    return 0;
  }
}

/**
 * Compara el estado anterior de variantes ({id, stock, stock_actual, stock_minimo, activo}) con el
 * actual y avisa a SAGA de las que cambian de disponibilidad (agotada, repuesta, desactivada o con
 * otro stock mínimo). Nunca lanza.
 */
async function sincronizarCambiosStock(previas) {
  try {
    if (!previas.length) return;
    const ahora = await query(
      "select id, stock, stock_actual, stock_minimo, activo, es_pack from variantes where id = any($1::bigint[])",
      [previas.map((p) => p.id)]
    );
    await adjuntarStockPack(ahora);
    for (const a of ahora) {
      const antes = previas.find((p) => String(p.id) === String(a.id));
      if (antes && stockParaSaga(antes) !== stockParaSaga(a)) {
        await sincronizarStockVariante(Number(a.id));
        // Si es componente de packs (se desactivó, cambió el mínimo…), sus packs también cambian.
        await sincronizarPacksDe(Number(a.id));
      }
    }
  } catch (e) {
    console.error("[saga] cambios de stock", e.message);
  }
}

const POR_PAGINA_SAGA = 50;

/**
 * Condiciones comunes de los listados: `usuario` (null = de todos, "__admin" = sin usuario del panel o
 * el nombre de uno), `cuenta` (alias) y `q` (producto, variante o SKU). Devuelve el SQL y sus parámetros
 * a partir de la posición `desde` ($desde, $desde+1, ...). Usa los alias s (sincronizaciones),
 * v (variantes) y p (productos).
 */
function filtrosSaga({ usuario = null, cuenta = null, q = "", categoria = null, accion = null, origen = null } = {}, desde) {
  const a = desde, b = desde + 1, c = desde + 2, d = desde + 3, e = desde + 4, g = desde + 5;
  const sql = `($${a}::text is null or ($${a} = '__admin' and s.usuario_panel is null) or s.usuario_panel = $${a})
      and ($${b}::text is null or s.cuenta_alias = $${b})
      and ($${c}::text = '' or p.nombre ilike '%' || $${c} || '%' or v.nombre ilike '%' || $${c} || '%' or v.sku ilike '%' || $${c} || '%')
      and ($${d}::text is null or exists (select 1 from jsonb_array_elements(coalesce(s.revision_motivos, '[]'::jsonb)) m where m->>'categoria' = $${d}))
      and ($${e}::text is null or s.accion = $${e})
      and ($${g}::text is null or s.origen = $${g})`;
  return { sql, params: [usuario || null, cuenta || null, String(q || "").trim().slice(0, 60), categoria || null, accion || null, origen || null] };
}

// «sin_publicar» no es un estado guardado: son las filas 'publicado' que SAGA no deja vender (venta_ok = false).
const ESTADOS_LISTADO = ["error", "pendiente", "publicado", "sin_publicar"];
const estadoReal = (est) => (est === "sin_publicar" ? "publicado" : est);
const CONDICION_VENTA = { sin_publicar: "and s.venta_ok = false", publicado: "and s.venta_ok is not false" };

const DESDE_SAGA = `from sincronizaciones s
       join variantes v on v.id = s.variante_id
       join productos p on p.id = v.producto_id
       join cuentas_saga c on c.alias = s.cuenta_alias`;

/** Registros de sincronización (variante × cuenta) en un estado, con filtros opcionales (ver filtrosSaga). */
async function getSincronizacionesSaga({ estado = "error", pagina = 1, usuario = null, cuenta = null, q = "", categoria = null, accion = null, origen = null } = {}) {
  const est = ESTADOS_LISTADO.includes(estado) ? estado : "error";
  const desde = (Math.max(1, Number(pagina) || 1) - 1) * POR_PAGINA_SAGA;
  const f = filtrosSaga({ usuario, cuenta, q, categoria, accion, origen }, 2);
  const venta = CONDICION_VENTA[est] || "";
  const [{ n }] = await query(
    `select count(*)::int as n ${DESDE_SAGA} where s.sistema = 'saga' and s.estado = $1 ${venta} and ${f.sql}`,
    [estadoReal(est), ...f.params]
  );
  const filas = await query(
    `select s.variante_id, s.cuenta_alias, c.nombre as cuenta, s.estado, s.error, s.stock_pendiente, s.intentos,
            s.proximo_intento, s.ultimo_sync, v.sku, v.nombre as variante, v.stock, v.stock_actual, v.stock_minimo, v.activo,
            p.id as producto_id, p.nombre as producto, s.usuario_panel, s.accion,
            s.revision_categoria, s.revision_motivos, s.revision_puntaje, s.revision_fecha,
            s.cola_modo, s.cola_intentos, s.proximo_envio, s.venta_ok, s.venta_detalle, s.venta_fecha,
            s.imagen_pendiente, s.imagen_feed_id, cardinality(v.imagenes) as imagenes_web
       ${DESDE_SAGA}
      where s.sistema = 'saga' and s.estado = $1 ${venta} and ${f.sql}
      order by s.ultimo_sync desc nulls last, s.variante_id
      limit ${POR_PAGINA_SAGA} offset ${desde}`,
    [estadoReal(est), ...f.params]
  );
  return { filas, total: n, porPagina: POR_PAGINA_SAGA };
}

/** { error, pendiente, publicado, sin_publicar }: cuántos registros hay en cada estado, con los mismos filtros (sin categoría). */
async function contarSincronizacionesSaga({ usuario = null, cuenta = null, q = "" } = {}) {
  const f = filtrosSaga({ usuario, cuenta, q }, 1);
  const filas = await query(
    `select s.estado, (s.venta_ok = false) as sin_publicar, count(*)::int as n
       ${DESDE_SAGA} where s.sistema = 'saga' and ${f.sql} group by 1, 2`,
    f.params
  );
  const suma = (fn) => filas.filter(fn).reduce((a, r) => a + r.n, 0);
  return {
    error: suma((r) => r.estado === "error"),
    pendiente: suma((r) => r.estado === "pendiente"),
    publicado: suma((r) => r.estado === "publicado" && !r.sin_publicar),
    sin_publicar: suma((r) => r.estado === "publicado" && r.sin_publicar),
  };
}

/**
 * Pendientes por categoría de revisión ({ todos: 7, contenido: 4, multimedia: 3, … }), con los filtros de usuario,
 * cuenta y búsqueda. Un producto con motivos de varias categorías cuenta en cada una; `todos` cuenta cada fila una vez.
 */
async function contarRevisionSaga({ usuario = null, cuenta = null, q = "" } = {}) {
  const f = filtrosSaga({ usuario, cuenta, q }, 1);
  const filas = await query(
    `select m.categoria, count(distinct s.variante_id::text || '|' || s.cuenta_alias)::int as n
       ${DESDE_SAGA}
       left join lateral (
         select distinct x->>'categoria' as categoria from jsonb_array_elements(coalesce(s.revision_motivos, '[]'::jsonb)) x
       ) m on true
      where s.sistema = 'saga' and s.estado = 'pendiente' and ${f.sql}
      group by rollup (m.categoria)`,
    f.params
  );
  // rollup deja una fila con categoría null: el total de filas (los pendientes sin motivos también cuentan aquí).
  const salida = Object.fromEntries(filas.filter((r) => r.categoria).map((r) => [r.categoria, r.n]));
  salida.todos = filas.find((r) => !r.categoria)?.n || 0;
  return salida;
}

/** Precios propios por cuenta de las variantes del producto, para el formulario. */
async function getPreciosCanalProducto(productoId) {
  return query(
    `select pc.variante_id, pc.cuenta_alias, pc.precio, pc.precio_oferta, pc.oferta_inicio, pc.oferta_fin
       from precios_canal pc join variantes v on v.id = pc.variante_id
      where v.producto_id = $1 and pc.sistema = 'saga'`,
    [productoId]
  );
}

/** Paquete propio por cuenta del producto, para el formulario: { alias: { contenidoPaquete, paqueteAncho, … } }. */
async function getPaquetesCuentaProducto(productoId) {
  const filas = await query("select * from paquete_plataforma where sistema = 'saga' and producto_id = $1", [productoId]);
  return Object.fromEntries(
    filas.map((r) => [
      r.cuenta_alias,
      {
        contenidoPaquete: r.contenido_paquete || "",
        paqueteAncho: r.paquete_ancho ?? "",
        paqueteLargo: r.paquete_largo ?? "",
        paqueteAlto: r.paquete_alto ?? "",
        paquetePeso: r.paquete_peso ?? "",
      },
    ])
  );
}

/** Categoría primaria propia por cuenta, para el formulario: { alias: { sagaCategoria, extras, varianteExtras } }. */
async function getCategoriasCuentaProducto(productoId) {
  try {
    const filas = await query("select * from categoria_plataforma where sistema = 'saga' and producto_id = $1", [productoId]);
    return Object.fromEntries(
      filas.map((r) => [r.cuenta_alias, { sagaCategoria: r.saga_categoria, extras: r.saga_extras || {}, varianteExtras: r.variante_extras || {} }])
    );
  } catch {
    return {}; // la tabla aún no existe
  }
}

/** Cuentas marcadas por variante, para pintar la tabla y el formulario. */
async function getSincronizacionesProducto(productoId) {
  return query(
    `select s.variante_id, s.cuenta_alias, s.estado, s.error, s.origen, s.accion, s.feed_id, s.stock_pendiente
       from sincronizaciones s join variantes v on v.id = s.variante_id
      where v.producto_id = $1`,
    [productoId]
  );
}

/**
 * ¿La fila (variante × cuenta) llegó a enviarse a SAGA? No cuenta un alta que falló sin salir (error, sin feed, sin
 * aviso de stock pendiente), p. ej. «Faltan datos»: SAGA no tiene nada de ese producto, así que el SKU padre aún se
 * puede cambiar. Debe coincidir con la condición SQL `yaEnviado` de lib/productos-guardar.js.
 */
const enviadaASaga = (x) => !(x.estado === "error" && !x.feed_id && !x.stock_pendiente && x.origen === "creado" && x.accion === "crear");

module.exports = {
  getCuentasActivas,
  getCuentas,
  sincronizarProducto,
  procesarCola,
  sincronizarProductos,
  refrescarPendientes,
  consultarSeleccion,
  aplicarAccionSeleccion,
  cambiarAccionSeleccion,
  resumirResultados,
  contarRevisionSaga,
  sincronizarStockVariante,
  eliminarEnSaga,
  reintentarStockPendiente,
  sincronizarCambiosStock,
  getSincronizacionesProducto,
  enviadaASaga,
  getSincronizacionesSaga,
  contarSincronizacionesSaga,
  getPreciosCanalProducto,
  getPaquetesCuentaProducto,
  getCategoriasCuentaProducto,
};
