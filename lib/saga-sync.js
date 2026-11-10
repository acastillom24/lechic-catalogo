/**
 * Orquestación web → SAGA. Todo es "mejor esfuerzo": nunca lanza hacia
 * quien llama; los fallos quedan en sincronizaciones.estado='error'.
 */
const { query } = require("./db");
const sc = require("./sellercenter");
const { resumirRevision } = require("./saga-revision");
const { validarProducto, advertenciasSaga, datosProducto, datosAccion, stockParaSaga, urlImagenSaga } = require("./saga-mapeo");
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
       cola_modo = null, proximo_envio = null,
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

// SAGA permite 1 envío (feed) cada 2 minutos por cuenta. Por eso cada guardado manda como máximo UN feed por cuenta
// con todas las variantes juntas; lo que no cabe se encola y lo envía procesarCola() cuando toca.
const ESPERA_FEEDS = "SAGA permite 1 envío cada 2 minutos por cuenta";

/**
 * Deja una variante × cuenta "en cola": pendiente, sin feed, con la acción a repetir (`cola_modo`) y la hora a
 * partir de la cual procesarCola() puede enviarla (2 minutos después).
 */
async function encolar(varianteId, alias, modo, { usuario = null, motivo = ESPERA_FEEDS } = {}) {
  await query(
    `insert into sincronizaciones (variante_id, sistema, cuenta_alias, estado, feed_id, error, ultimo_sync, origen, accion, usuario_panel, cola_modo, proximo_envio)
     values ($1,'saga',$2,'pendiente',null,$3, now(), $4, $5, $6, $7, now() + interval '2 minutes')
     on conflict (variante_id, sistema, cuenta_alias)
     do update set estado='pendiente', feed_id=null, error=$3, ultimo_sync=now(), accion=$5,
       usuario_panel = coalesce($6, sincronizaciones.usuario_panel), cola_modo=$7, proximo_envio=now() + interval '2 minutes'`,
    [varianteId, alias, `En cola: ${motivo}. Se enviará solo en unos minutos.`.slice(0, 500), modo === "crear" ? "creado" : "vinculado", modo, usuario, modo]
  );
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
 * Una consulta de existencia por cuenta (no una por variante) y UN feed por cuenta con todas las variantes juntas;
 * si SAGA limita las consultas o los envíos, las filas quedan en cola (no en error). Un fallo de datos de una
 * variante no frena a las demás.
 * Devuelve { resultados: [{alias, varianteId, variante, modo, estado, error, avisos}] }
 * con estado: pendiente | vinculada | desvinculada | en_cola | error.
 */
async function sincronizarProducto(productoId, acciones, { usuario = null } = {}) {
  const resultados = [];
  const dato = await cargar(productoId);
  if (!dato || !acciones.length) return { resultados };
  // El SKU padre queda guardado desde el primer envío: nuevas variantes se agrupan con el mismo.
  if (dato.p.usar_sku_padre && !dato.p.sku_padre && acciones.some((a) => a.modo === "crear")) {
    dato.p.sku_padre = dato.p.id;
    await query("update productos set sku_padre = $2 where id = $1 and sku_padre is null", [productoId, dato.p.id]);
  }
  const porId = new Map(dato.variantes.map((v) => [String(v.id), v]));
  const cuentas = await query("select * from cuentas_saga where activo and alias = any($1)", [[...new Set(acciones.map((a) => a.alias))]]);
  const op = await getOpcionesSaga();
  const propios = await query(
    "select * from precios_canal where sistema = 'saga' and variante_id = any($1::bigint[])",
    [dato.variantes.map((v) => v.id)]
  );
  const propio = (v, alias) => propios.find((x) => String(x.variante_id) === String(v.id) && x.cuenta_alias === alias);

  for (const cuenta of cuentas) {
    let cred = null, errorCred = null;
    try {
      cred = sc.credenciales(cuenta);
    } catch (e) {
      errorCred = e;
    }
    const lista = acciones.filter((x) => x.alias === cuenta.alias && porId.has(String(x.varianteId)));

    // Una sola consulta con todos los SKU de la cuenta para saber cuáles existen.
    let existentes = null, errorLectura = null;
    const consultables = lista.filter((a) => a.modo !== "desvincular").map((a) => porId.get(String(a.varianteId)).sku).filter(Boolean);
    if (cred && consultables.length) {
      try {
        existentes = await sc.productosPorSku(cred, consultables);
      } catch (e) {
        errorLectura = e;
      }
    }

    const crear = [], actualizar = [], soloImagen = [];
    for (const a of lista) {
      const v = porId.get(String(a.varianteId));
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
        const vv = efectivo(v, propio(v, cuenta.alias));

        if (a.modo === "crear") {
          if (existe) throw new Error(`El SKU "${v.sku}" ya existe en ${cuenta.nombre}: elige Vincular o Actualizar (Crear no pisa lo que ya hay en SAGA).`);
          const faltan = validarProducto(dato.p, vv, op);
          if (faltan.length) throw new Error(`Faltan datos: ${faltan.join(", ")}`);
          // Avisos de calidad (título 20–100, descripción ≥ 50): se envía igual, pero se informa al guardar.
          crear.push({ v, base, datos: datosProducto(dato.p, vv, op), avisos: advertenciasSaga(dato.p, vv), modo: a.modo });
          continue;
        }

        // Acción configurable sobre un SKU existente.
        const accion = op.acciones.find((x) => x.id === a.modo);
        if (!accion) throw new Error(`La acción "${a.modo}" ya no existe en Configuración → SAGA.`);
        if (!existe) throw new Error(`SAGA no tiene el SKU "${v.sku}" en la cuenta ${cuenta.nombre}.`);
        const { datos, avisos } = datosAccion(dato.p, vv, op, accion.atributos);
        const hayCampos = datos.unidad || datos.nombre || datos.descripcion || datos.marca || datos.variacion ||
          datos.categoriaPrimaria || datos.codigoBarras || datos.parentSku || Object.keys(datos.productData).length > 0;
        const item = { v, base, datos, avisos, modo: a.modo };
        if (hayCampos) actualizar.push(item);
        else if (datos.imagenes.length) soloImagen.push(item);
        else {
          await marcar(v.id, cuenta.alias, "publicado", { usuario, feedId: null, origen: "vinculado", accion: a.modo, imagen: { pendiente: false, feedId: null } });
          resultados.push({ ...base, estado: "vinculada", avisos });
        }
      } catch (e) {
        if (esLimite(e)) {
          // SAGA limitó las consultas: no es un fallo de la variante, se reintenta solo.
          await encolar(v.id, cuenta.alias, a.modo, { usuario, motivo: "SAGA limitó temporalmente las consultas" });
          resultados.push({ ...base, estado: "en_cola" });
          continue;
        }
        // Solo "crear" deja registro en error (se puede reintentar); en las demás solo se informa.
        if (a.modo === "crear" && !String(e.message).includes("ya existe en")) {
          await marcar(v.id, cuenta.alias, "error", { error: e.message.slice(0, 500), usuario });
        }
        resultados.push({ ...base, estado: "error", error: e.message });
      }
    }

    // Un feed por cuenta: el primer lote se envía y los demás (si los hay) quedan en cola.
    const lotes = [["crear", crear], ["actualizar", actualizar], ["imagen", soloImagen]].filter(([, items]) => items.length);
    for (const [i, [tipo, items]] of lotes.entries()) {
      if (i > 0) {
        for (const it of items) {
          await encolar(it.v.id, cuenta.alias, it.modo, { usuario });
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
              usuario, feedId: r.feedId, origen: "creado", accion: "crear",
              imagen: { pendiente: it.datos.imagenes.length > 0, feedId: null },
            });
            resultados.push({ ...it.base, estado: "pendiente", avisos: it.avisos });
          }
        } else if (tipo === "actualizar") {
          const r = await enviarFeed(() => sc.actualizarParcialLote(cred, items.map((x) => x.datos)));
          // Las imágenes van en otro feed, 2 minutos después: quedan pendientes para refrescarPendientes.
          for (const it of items) {
            await marcar(it.v.id, cuenta.alias, "pendiente", {
              usuario, feedId: r.feedId, origen: "vinculado", accion: it.modo,
              imagen: { pendiente: it.datos.imagenes.length > 0, feedId: null },
            });
            resultados.push({ ...it.base, estado: "pendiente", avisos: it.avisos });
          }
        } else {
          const r = await enviarFeed(() => sc.enviarImagenesLote(cred, items.map((x) => ({ sku: x.v.sku, urls: x.datos.imagenes }))));
          for (const it of items) {
            await marcar(it.v.id, cuenta.alias, "pendiente", {
              usuario, feedId: r.feedId, origen: "vinculado", accion: it.modo, imagen: { pendiente: false, feedId: null },
            });
            resultados.push({ ...it.base, estado: "pendiente", avisos: it.avisos });
          }
        }
      } catch (e) {
        for (const it of items) {
          if (esLimite(e)) {
            await encolar(it.v.id, cuenta.alias, it.modo, { usuario, motivo: e.limiteFeeds ? ESPERA_FEEDS : "SAGA limitó temporalmente las consultas" });
            resultados.push({ ...it.base, estado: "en_cola" });
            continue;
          }
          if (tipo === "crear") await marcar(it.v.id, cuenta.alias, "error", { error: e.message.slice(0, 500), usuario });
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
            revision_fecha = case when $3::text is null and $4::text is null then null else now() end
      where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2`,
    [varianteId, alias, rev?.categoria || null, rev && rev.motivos.length ? JSON.stringify(rev.motivos) : null, rev?.puntaje ?? null]
  );
}

/** Consulta a SAGA la revisión de calidad de un SKU (con `p` ya leído, si se tiene) y la guarda (nunca lanza). */
async function consultarRevision(cred, f, p) {
  try {
    const prod = p === undefined ? await sc.producto(cred, f.sku) : p;
    // Si ya está aprobado no hay motivos que buscar: se evita la segunda consulta.
    const qc = String(prod?.QCStatus || "").toLowerCase() === "approved" ? null : await sc.estadoQc(cred, f.sku);
    const rev = resumirRevision(prod, qc);
    await guardarRevision(f.variante_id, f.cuenta_alias, rev);
    return { ...rev, producto: prod };
  } catch {
    return null;
  }
}

/**
 * Avanza una fila pendiente un paso (feed de creación → imagen → revisión). Devuelve `{ imagen: url }` cuando la
 * fila necesita enviar su imagen (el envío se hace en lote, un solo feed por cuenta) o null. `memo` evita consultar
 * dos veces el mismo feed o producto en una pasada. Lanza si SAGA no responde.
 */
async function procesarFila(f, { soloImagen = false, memo = new Map() } = {}) {
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

  const principal = await feed(f.feed_id);
  if (!principal.terminado) return null;
  const falloPrincipal = falloDeFila(principal, f.sku);
  if (falloPrincipal) {
    await falla(falloPrincipal);
    return null;
  }
  if (f.imagen_pendiente) {
    const url = f.imagen ? urlImagenSaga(f.imagen) : "";
    if (!url) {
      await falla("La variante no tiene imagen para enviar a SAGA.");
      return null;
    }
    return { imagen: url };
  }
  if (soloImagen) return null;
  if (f.imagen_feed_id) {
    const img = await feed(f.imagen_feed_id);
    if (!img.terminado) return null;
    const falloImg = falloDeFila(img, f.sku);
    if (falloImg) {
      await falla(`Imagen: ${falloImg}`);
      return null;
    }
    const k = `${f.cuenta_alias}|productos`;
    const p = memo.has(k) ? memo.get(k).get(String(f.sku)) || null : undefined;
    const rev = await consultarRevision(cred, f, p);
    const qc = rev?.estado || "";
    const motivos = rev?.motivos?.length ? rev.motivos.map((m) => m.texto).join(" · ").slice(0, 500) : null;
    if (qc === "rejected") {
      await falla(motivos || "SAGA rechazó el producto en su revisión: revisa imágenes y contenido en Seller Center.");
    } else if (qc === "approved") {
      await marcar(f.variante_id, f.cuenta_alias, "publicado", { feedId: f.feed_id, imagen: sinImagen, ...alVinculo });
      await guardarRevision(f.variante_id, f.cuenta_alias, null);
    } else {
      await marcar(f.variante_id, f.cuenta_alias, "pendiente", { feedId: f.feed_id, error: motivos || "En revisión de SAGA" });
    }
    return null;
  }
  await marcar(f.variante_id, f.cuenta_alias, "publicado", { feedId: f.feed_id, ...alVinculo });
  return null;
}

/**
 * Consulta a SAGA el avance de los envíos 'pendiente' y los pasa a publicado/error.
 * Alta de producto en pasos: (1) feed de creación; (2) al terminar bien, se envía la imagen (SAGA no la acepta
 * antes de que el producto exista ni antes de 2 minutos desde el envío anterior), todas las variantes de una
 * cuenta en un solo feed; (3) al terminar la imagen se consulta la revisión (QCStatus + motivos): aprobado →
 * publicado, rechazado → error, en revisión → sigue pendiente con los motivos guardados para el reporte.
 * Opciones: `usuario` (ver filtrosSaga), `claves` (solo esas filas, "varianteId|alias") y `soloImagen`
 * (solo el paso de envío de imagen). Devuelve cuántas filas revisó. NO se llama al abrir una página:
 * solo desde una acción explícita o el envío diferido de imágenes.
 */
async function refrescarPendientes(productoId = null, { usuario = null, claves = null, soloImagen = false } = {}) {
  const filas = await query(
    `select s.variante_id, s.cuenta_alias, s.feed_id, s.accion, s.imagen_pendiente, s.imagen_feed_id,
            c.user_id, c.api_key, c.base_url, c.operador, v.sku, v.imagen
       from sincronizaciones s
       join cuentas_saga c on c.alias = s.cuenta_alias
       join variantes v on v.id = s.variante_id
      where s.estado = 'pendiente' and s.feed_id is not null
        and ($1::text is null or v.producto_id = $1)
        and ($2::text is null or ($2 = '__admin' and s.usuario_panel is null) or s.usuario_panel = $2)
        and ($3::text[] is null or (s.variante_id::text || '|' || s.cuenta_alias) = any($3))
        and ($4::boolean = false or s.imagen_pendiente)`,
    [productoId, usuario, claves, soloImagen]
  );
  const memo = new Map();

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
      const r = await procesarFila(f, { soloImagen, memo });
      if (r?.imagen) imagenes.set(f.cuenta_alias, [...(imagenes.get(f.cuenta_alias) || []), { f, url: r.imagen }]);
    } catch {
      /* se reintenta en la próxima consulta */
    }
  }

  // Un solo feed de imágenes por cuenta. Si SAGA limita los envíos, las filas siguen pendientes y se reintentan.
  for (const [alias, items] of imagenes) {
    const cred = sc.credenciales({ alias, ...items[0].f });
    try {
      const r = await enviarFeed(() => sc.enviarImagenesLote(cred, items.map(({ f, url }) => ({ sku: f.sku, urls: [url] }))));
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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Envío diferido de imágenes tras crear o actualizar un producto: SAGA solo acepta la imagen con el producto ya
 * creado y exige 2 minutos entre envíos de una cuenta, así que espera ~2 minutos (y reintenta un minuto después) y
 * manda la imagen de cada variante cuyo feed ya terminó, todas en un solo feed. Pensado para `after()` de Next:
 * nunca lanza. Si algo queda sin enviar, lo completa procesarCola() o «Consultar estado».
 */
async function enviarImagenesDiferido(productoId, { usuario = null } = {}) {
  try {
    for (const espera of [125000, 60000]) {
      await dormir(espera);
      await refrescarPendientes(productoId, { usuario, soloImagen: true });
      const [{ n }] = await query(
        `select count(*)::int as n from sincronizaciones s join variantes v on v.id = s.variante_id
          where v.producto_id = $1 and s.sistema = 'saga' and s.estado = 'pendiente' and s.imagen_pendiente`,
        [productoId]
      );
      if (!n) return;
    }
  } catch {
    /* queda pendiente: se completa con la cola o con «Consultar estado» */
  }
}

/**
 * Cola de envíos que SAGA no aceptó por su límite (1 feed cada 2 minutos por cuenta): toma, por cuenta, el producto
 * más antiguo cuya hora de reintento ya pasó y repite su acción. Además envía las imágenes pendientes. Barata si no
 * hay nada en cola (una consulta). Nunca lanza; pensada para `after()` de las páginas de integraciones.
 */
async function procesarCola({ usuario = null } = {}) {
  try {
    const filas = await query(
      `select s.variante_id, s.cuenta_alias, s.cola_modo, s.usuario_panel, v.producto_id
         from sincronizaciones s join variantes v on v.id = s.variante_id
        where s.sistema = 'saga' and s.cola_modo is not null and s.proximo_envio <= now()
          and ($1::text is null or ($1 = '__admin' and s.usuario_panel is null) or s.usuario_panel = $1)
        order by s.proximo_envio, s.variante_id`,
      [usuario]
    );
    const elegidos = new Map(); // alias → producto elegido
    for (const f of filas) if (!elegidos.has(f.cuenta_alias)) elegidos.set(f.cuenta_alias, f.producto_id);
    for (const [alias, productoId] of elegidos) {
      const grupo = filas.filter((f) => f.cuenta_alias === alias && f.producto_id === productoId);
      // Se reserva ya (más allá del siguiente reintento) para que otra ejecución simultánea no envíe lo mismo.
      const reservadas = await query(
        `update sincronizaciones set proximo_envio = now() + interval '3 minutes'
          where sistema = 'saga' and cuenta_alias = $1 and variante_id = any($2::bigint[]) and cola_modo is not null and proximo_envio <= now()
          returning variante_id, cola_modo`,
        [alias, grupo.map((f) => f.variante_id)]
      );
      if (!reservadas.length) continue;
      const modos = new Map(grupo.map((f) => [String(f.variante_id), f]));
      const { resultados } = await sincronizarProducto(
        productoId,
        reservadas.map((r) => ({ varianteId: r.variante_id, alias, modo: r.cola_modo })),
        { usuario: grupo[0].usuario_panel }
      );
      // Lo que falló por datos (no por límite) deja de estar en cola y queda como error visible.
      for (const r of resultados.filter((x) => x.estado === "error")) {
        await marcar(r.varianteId, alias, "error", { error: String(r.error).slice(0, 500), usuario: modos.get(String(r.varianteId))?.usuario_panel || null });
      }
    }
    await refrescarPendientes(null, { usuario, soloImagen: true });
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
    `select s.variante_id, s.cuenta_alias, s.estado, v.producto_id
       from sincronizaciones s join variantes v on v.id = s.variante_id
      where s.sistema = 'saga' and (s.variante_id::text || '|' || s.cuenta_alias) = any($1)
        and ($2::text is null or ($2 = '__admin' and s.usuario_panel is null) or s.usuario_panel = $2)`,
    [lista, usuario]
  );
}

/** «Consultar estado» de las filas elegidas: pregunta a SAGA solo por ellas. Devuelve cuántas consultó. */
async function consultarSeleccion(claves, { usuario = null } = {}) {
  const filas = await seleccionPermitida(claves, usuario);
  if (!filas.length) return 0;
  return refrescarPendientes(null, { usuario, claves: filas.map((f) => `${f.variante_id}|${f.cuenta_alias}`) });
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
      and ($${d}::text is null or coalesce(s.revision_categoria, 'otros') = $${d})
      and ($${e}::text is null or s.accion = $${e})
      and ($${g}::text is null or s.origen = $${g})`;
  return { sql, params: [usuario || null, cuenta || null, String(q || "").trim().slice(0, 60), categoria || null, accion || null, origen || null] };
}

const ESTADOS_LISTADO = ["error", "pendiente", "publicado"];

const DESDE_SAGA = `from sincronizaciones s
       join variantes v on v.id = s.variante_id
       join productos p on p.id = v.producto_id
       join cuentas_saga c on c.alias = s.cuenta_alias`;

/** Registros de sincronización (variante × cuenta) en un estado, con filtros opcionales (ver filtrosSaga). */
async function getSincronizacionesSaga({ estado = "error", pagina = 1, usuario = null, cuenta = null, q = "", categoria = null, accion = null, origen = null } = {}) {
  const est = ESTADOS_LISTADO.includes(estado) ? estado : "error";
  const desde = (Math.max(1, Number(pagina) || 1) - 1) * POR_PAGINA_SAGA;
  const f = filtrosSaga({ usuario, cuenta, q, categoria, accion, origen }, 2);
  const [{ n }] = await query(
    `select count(*)::int as n ${DESDE_SAGA} where s.sistema = 'saga' and s.estado = $1 and ${f.sql}`,
    [est, ...f.params]
  );
  const filas = await query(
    `select s.variante_id, s.cuenta_alias, c.nombre as cuenta, s.estado, s.error, s.stock_pendiente, s.intentos,
            s.proximo_intento, s.ultimo_sync, v.sku, v.nombre as variante, v.stock, v.stock_actual, v.stock_minimo, v.activo,
            p.id as producto_id, p.nombre as producto, s.usuario_panel, s.accion,
            s.revision_categoria, s.revision_motivos, s.revision_puntaje, s.revision_fecha
       ${DESDE_SAGA}
      where s.sistema = 'saga' and s.estado = $1 and ${f.sql}
      order by s.ultimo_sync desc nulls last, s.variante_id
      limit ${POR_PAGINA_SAGA} offset ${desde}`,
    [est, ...f.params]
  );
  return { filas, total: n, porPagina: POR_PAGINA_SAGA };
}

/** { error, pendiente, publicado }: cuántos registros hay en cada estado, con los mismos filtros (sin categoría). */
async function contarSincronizacionesSaga({ usuario = null, cuenta = null, q = "" } = {}) {
  const f = filtrosSaga({ usuario, cuenta, q }, 1);
  const filas = await query(
    `select s.estado, count(*)::int as n ${DESDE_SAGA} where s.sistema = 'saga' and ${f.sql} group by s.estado`,
    f.params
  );
  const por = Object.fromEntries(filas.map((r) => [r.estado, r.n]));
  return { error: por.error || 0, pendiente: por.pendiente || 0, publicado: por.publicado || 0 };
}

/** Pendientes por categoría de revisión ({ contenido: 7, compliance: 42, … }), con los filtros de usuario, cuenta y búsqueda. */
async function contarRevisionSaga({ usuario = null, cuenta = null, q = "" } = {}) {
  const f = filtrosSaga({ usuario, cuenta, q }, 1);
  const filas = await query(
    `select coalesce(s.revision_categoria, 'otros') as categoria, count(*)::int as n
       ${DESDE_SAGA} where s.sistema = 'saga' and s.estado = 'pendiente' and ${f.sql} group by 1`,
    f.params
  );
  return Object.fromEntries(filas.map((r) => [r.categoria, r.n]));
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

/** Cuentas marcadas por variante, para pintar la tabla y el formulario. */
async function getSincronizacionesProducto(productoId) {
  return query(
    `select s.variante_id, s.cuenta_alias, s.estado, s.error, s.origen, s.accion
       from sincronizaciones s join variantes v on v.id = s.variante_id
      where v.producto_id = $1`,
    [productoId]
  );
}

module.exports = {
  getCuentasActivas,
  getCuentas,
  sincronizarProducto,
  procesarCola,
  refrescarPendientes,
  enviarImagenesDiferido,
  consultarSeleccion,
  aplicarAccionSeleccion,
  cambiarAccionSeleccion,
  resumirResultados,
  contarRevisionSaga,
  sincronizarStockVariante,
  reintentarStockPendiente,
  sincronizarCambiosStock,
  getSincronizacionesProducto,
  getSincronizacionesSaga,
  contarSincronizacionesSaga,
  getPreciosCanalProducto,
};
