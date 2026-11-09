/**
 * ============================================================
 *  LIBRO DE RECLAMACIONES (solo servidor)
 * ============================================================
 *  - Registro público: validación, Turnstile, límite por IP, código LCH-AAAA-NNNNNN.
 *  - Plazo de respuesta: 15 días hábiles desde el registro (Ley 31435). No se descuentan feriados.
 *  - Correos: copia de la hoja al consumidor, aviso a la empresa y respuesta al consumidor.
 *  - Seguimiento desde /admin/reclamos.
 * ============================================================
 */
const { query } = require("./db");
const { verificarTurnstile, hashIp } = require("./resenas");
const { enviarCorreo, esc } = require("./correo");
const { getConfigSitio } = require("./config");

const PLAZO_DIAS_HABILES = 15;
const LIMITE_IP_HORA = 5;
const TIPOS_DOC = ["DNI", "CE", "Pasaporte", "RUC"];
const ESTADOS = ["pendiente", "en_proceso", "atendido"];
const ETIQUETA_ESTADO = { pendiente: "Pendiente", en_proceso: "En proceso", atendido: "Atendido" };

/** Fecha (YYYY-MM-DD) que resulta de sumar `n` días hábiles (lunes a viernes) a `desde`. */
function sumarDiasHabiles(desde, n) {
  const d = new Date(desde);
  let falta = n;
  while (falta > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) falta--;
  }
  return d.toISOString().slice(0, 10);
}

const hoyLima = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
const fechaLarga = (f) =>
  new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

const txt = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Valida el formulario público. Devuelve { error } o { datos }. */
function validar(b) {
  const tipo = b.tipo === "queja" ? "queja" : b.tipo === "reclamo" ? "reclamo" : "";
  const tipoBien = b.tipoBien === "servicio" ? "servicio" : b.tipoBien === "producto" ? "producto" : "";
  const tipoDocumento = TIPOS_DOC.includes(b.tipoDocumento) ? b.tipoDocumento : "";
  const esMenor = b.esMenor === true;
  const d = {
    tipo,
    nombre: txt(b.nombre, 120),
    tipoDocumento,
    documento: txt(b.documento, 20),
    domicilio: txt(b.domicilio, 200),
    telefono: txt(b.telefono, 20),
    email: txt(b.email, 120).toLowerCase(),
    esMenor,
    apoderado: esMenor ? txt(b.apoderado, 120) : "",
    tipoBien,
    descripcionBien: txt(b.descripcionBien, 300),
    numeroPedido: txt(b.numeroPedido, 40),
    detalle: txt(b.detalle, 2000),
    pedidoConsumidor: txt(b.pedidoConsumidor, 1000),
  };
  const monto = b.monto === "" || b.monto === null || b.monto === undefined ? null : Number(b.monto);
  if (monto !== null && (!Number.isFinite(monto) || monto < 0 || monto > 1e7)) return { error: "El monto reclamado no es válido." };
  d.monto = monto;

  if (!tipo) return { error: "Elige si es un reclamo o una queja." };
  if (!d.nombre) return { error: "Escribe tu nombre completo." };
  if (!tipoDocumento || !d.documento) return { error: "Indica tu tipo y número de documento." };
  if (tipoDocumento === "DNI" && !/^\d{8}$/.test(d.documento)) return { error: "El DNI debe tener 8 dígitos." };
  if (tipoDocumento === "RUC" && !/^\d{11}$/.test(d.documento)) return { error: "El RUC debe tener 11 dígitos." };
  if (!/^[A-Za-z0-9-]{4,20}$/.test(d.documento)) return { error: "El número de documento no es válido." };
  if (!d.domicilio) return { error: "Escribe tu domicilio." };
  if (!/^[0-9+() -]{6,20}$/.test(d.telefono)) return { error: "Escribe un teléfono válido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: "Escribe un correo válido: ahí te enviaremos copia de tu reclamo." };
  if (esMenor && !d.apoderado) return { error: "Si eres menor de edad, indica el nombre de tu padre, madre o apoderado." };
  if (!tipoBien) return { error: "Indica si se trata de un producto o un servicio." };
  if (!d.descripcionBien) return { error: "Describe el producto o servicio." };
  if (d.detalle.length < 10) return { error: "Cuéntanos con más detalle qué ocurrió." };
  if (d.pedidoConsumidor.length < 5) return { error: "Indica qué solución esperas." };
  if (b.acepta !== true) return { error: "Debes confirmar que los datos son verdaderos." };
  return { datos: d };
}

function hojaHtml(r, empresa, titulo) {
  const fila = (k, v) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>` : "");
  return `<div style="font-family:Arial,sans-serif;max-width:640px;color:#222">
    <h2 style="color:#7a2d57">${esc(titulo)}</h2>
    <p><strong>Hoja de reclamación N.º ${esc(r.codigo)}</strong><br>Fecha: ${esc(fechaLarga(r.created_at))}</p>
    <h3>Proveedor</h3>
    <table>${fila("Razón social", empresa.razonSocial)}${fila("RUC", empresa.ruc)}${fila("Domicilio", empresa.direccion)}</table>
    <h3>Consumidor</h3>
    <table>${fila("Nombre", r.nombre)}${fila("Documento", `${r.tipo_documento} ${r.documento}`)}${fila("Domicilio", r.domicilio)}${fila("Teléfono", r.telefono)}${fila("Correo", r.email)}${r.es_menor ? fila("Padre, madre o apoderado", r.apoderado) : ""}</table>
    <h3>Bien contratado</h3>
    <table>${fila("Tipo", r.tipo_bien === "servicio" ? "Servicio" : "Producto")}${fila("Descripción", r.descripcion_bien)}${fila("Monto reclamado", r.monto !== null && r.monto !== undefined ? `S/ ${Number(r.monto).toFixed(2)}` : "")}${fila("N.º de pedido", r.numero_pedido)}</table>
    <h3>Detalle de la ${r.tipo === "queja" ? "queja" : "reclamación"}</h3>
    <table>${fila("Tipo", r.tipo === "queja" ? "Queja" : "Reclamo")}${fila("Detalle", r.detalle)}${fila("Pedido del consumidor", r.pedido_consumidor)}</table>
    <p style="font-size:12px;color:#666">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI. El proveedor debe responder en un plazo no mayor a ${PLAZO_DIAS_HABILES} días hábiles${r.fecha_limite ? ` (hasta el ${esc(fechaLarga(r.fecha_limite))})` : ""}.</p>
  </div>`;
}

/** Registra un reclamo. Devuelve { status, error } o { status: 200, reclamo, correo }. */
async function crearReclamo(body, { turnstile, ip }) {
  const v = validar(body || {});
  if (v.error) return { status: 400, error: v.error };
  if (!(await verificarTurnstile(turnstile, ip))) {
    return { status: 400, error: "No pudimos verificar que eres una persona. Intenta de nuevo." };
  }
  const d = v.datos;
  const ipHash = hashIp(ip || "desconocida");
  const desde = new Date(Date.now() - 3600 * 1000).toISOString();
  const [{ n }] = await query("select count(*)::int as n from reclamos where ip_hash = $1 and created_at >= $2", [ipHash, desde]);
  if (n >= LIMITE_IP_HORA) return { status: 429, error: "Demasiados envíos en poco tiempo. Intenta más tarde." };

  const limite = sumarDiasHabiles(hoyLima() + "T12:00:00Z", PLAZO_DIAS_HABILES);
  let fila;
  try {
    [fila] = await query(
      `insert into reclamos (tipo, nombre, tipo_documento, documento, domicilio, telefono, email, es_menor, apoderado,
         tipo_bien, descripcion_bien, monto, numero_pedido, detalle, pedido_consumidor, fecha_limite, ip_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       returning id, created_at`,
      [d.tipo, d.nombre, d.tipoDocumento, d.documento, d.domicilio, d.telefono, d.email, d.esMenor, d.apoderado || null,
       d.tipoBien, d.descripcionBien, d.monto, d.numeroPedido || null, d.detalle, d.pedidoConsumidor, limite, ipHash]
    );
    const anio = new Date(fila.created_at).toLocaleDateString("en-CA", { timeZone: "America/Lima" }).slice(0, 4);
    const codigo = `LCH-${anio}-${String(fila.id).padStart(6, "0")}`;
    await query("update reclamos set codigo = $2 where id = $1", [fila.id, codigo]);
  } catch (e) {
    console.error("[reclamos] crear:", e.message);
    return { status: 500, error: "No se pudo registrar el reclamo. Intenta de nuevo en unos minutos." };
  }

  const reclamo = await getReclamo(fila.id);
  const correo = await enviarCopias(reclamo);
  return { status: 200, reclamo, correo };
}

/** Copia de la hoja al consumidor y aviso a la empresa. Nunca lanza. */
async function enviarCopias(r) {
  const config = await getConfigSitio();
  const empresa = config.empresa || {};
  const aviso = empresa.email || process.env.RECLAMOS_EMAIL_TO || "";
  const alConsumidor = await enviarCorreo({
    para: r.email,
    asunto: `Copia de tu ${r.tipo === "queja" ? "queja" : "reclamo"} ${r.codigo} · ${config.marca}`,
    html: hojaHtml(r, empresa, "Recibimos tu " + (r.tipo === "queja" ? "queja" : "reclamo")),
    responderA: aviso || undefined,
  });
  const alProveedor = aviso
    ? await enviarCorreo({
        para: aviso,
        asunto: `Nuevo ${r.tipo === "queja" ? "queja" : "reclamo"} ${r.codigo}`,
        html: hojaHtml(r, empresa, "Nuevo registro en el Libro de Reclamaciones"),
        responderA: r.email,
      })
    : { ok: false, omitido: true };
  if (alConsumidor.ok) await query("update reclamos set copia_enviada = true where id = $1", [r.id]);
  if (!alConsumidor.ok && !alConsumidor.omitido) console.error("[reclamos] copia al consumidor:", alConsumidor.error);
  if (!alProveedor.ok && !alProveedor.omitido) console.error("[reclamos] aviso a la empresa:", alProveedor.error);
  return { consumidor: alConsumidor.ok, empresa: alProveedor.ok };
}

async function getReclamo(id) {
  const [r] = await query("select * from reclamos where id = $1", [id]);
  return r || null;
}

const FILTROS_ESTADO = ["pendiente", "en_proceso", "atendido", "vencidos"];

/** Lista paginada para el admin. `estado`: pendiente | en_proceso | atendido | vencidos (abiertos con plazo vencido). */
async function listarReclamos({ estado = "", tipo = "", q = "", pagina = 1, porPagina = 25 } = {}) {
  const where = [];
  const valores = [];
  if (estado === "vencidos") where.push(`estado <> 'atendido' and fecha_limite < (now() at time zone 'America/Lima')::date`);
  else if (ESTADOS.includes(estado)) {
    valores.push(estado);
    where.push(`estado = $${valores.length}`);
  }
  if (tipo === "reclamo" || tipo === "queja") {
    valores.push(tipo);
    where.push(`tipo = $${valores.length}`);
  }
  if (q) {
    valores.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const i = valores.length;
    where.push(`(codigo ilike $${i} or nombre ilike $${i} or documento ilike $${i} or email ilike $${i} or numero_pedido ilike $${i})`);
  }
  const cond = where.length ? "where " + where.join(" and ") : "";
  const [{ n }] = await query(`select count(*)::int as n from reclamos ${cond}`, valores);
  const filas = await query(
    `select id, codigo, tipo, nombre, email, tipo_bien, descripcion_bien, estado, fecha_limite, created_at,
            (estado <> 'atendido' and fecha_limite < (now() at time zone 'America/Lima')::date) as vencido,
            (fecha_limite - (now() at time zone 'America/Lima')::date) as dias_restantes
       from reclamos ${cond}
      order by (estado = 'atendido'), fecha_limite asc, created_at desc
      limit ${Number(porPagina)} offset ${(Math.max(1, Number(pagina)) - 1) * Number(porPagina)}`,
    valores
  );
  return { reclamos: filas, total: n };
}

/** Contadores para el menú y las pestañas del admin (nunca lanza: si falta la tabla devuelve ceros). */
async function contarReclamos() {
  try {
    const [r] = await query(
      `select count(*) filter (where estado <> 'atendido')::int as abiertos,
              count(*) filter (where estado <> 'atendido' and fecha_limite < (now() at time zone 'America/Lima')::date)::int as vencidos
         from reclamos`
    );
    return { abiertos: r.abiertos, vencidos: r.vencidos };
  } catch {
    return { abiertos: 0, vencidos: 0 };
  }
}

/**
 * Guarda el seguimiento: estado, nota interna y, si se escribe, la respuesta (se envía al correo del
 * consumidor cuando `enviar` es true). Pasar a "atendido" exige una respuesta.
 */
async function guardarSeguimiento(id, { estado, respuesta, notaInterna, enviar }) {
  const r = await getReclamo(id);
  if (!r) return { error: "El reclamo no existe." };
  if (!ESTADOS.includes(estado)) return { error: "Estado inválido." };
  const texto = txt(respuesta, 4000);
  if (estado === "atendido" && !texto && !r.respuesta) return { error: "Para marcarlo como atendido escribe la respuesta al consumidor." };

  const cambiaRespuesta = texto && texto !== (r.respuesta || "");
  await query(
    `update reclamos set estado = $2, nota_interna = $3, updated_at = now(),
       respuesta = case when $4 then $5 else respuesta end,
       respondido_at = case when $4 then now() else respondido_at end,
       respuesta_enviada = case when $4 then false else respuesta_enviada end
     where id = $1`,
    [id, estado, txt(notaInterna, 2000) || null, Boolean(cambiaRespuesta), texto]
  );

  let aviso = "Guardado.";
  if (enviar && (texto || r.respuesta)) {
    const config = await getConfigSitio();
    const empresa = config.empresa || {};
    const cuerpo = texto || r.respuesta;
    const envio = await enviarCorreo({
      para: r.email,
      asunto: `Respuesta a tu ${r.tipo === "queja" ? "queja" : "reclamo"} ${r.codigo} · ${config.marca}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;color:#222">
        <p>Hola ${esc(r.nombre)},</p>
        <p>Esta es la respuesta a tu ${r.tipo === "queja" ? "queja" : "reclamo"} <strong>${esc(r.codigo)}</strong>:</p>
        <blockquote style="border-left:3px solid #e8267f;margin:12px 0;padding:4px 14px;white-space:pre-wrap">${esc(cuerpo)}</blockquote>
        <p style="font-size:12px;color:#666">${esc(empresa.razonSocial || config.marca)}${empresa.ruc ? ` · RUC ${esc(empresa.ruc)}` : ""}.
        Si no estás conforme con la respuesta puedes acudir al INDECOPI.</p></div>`,
      responderA: empresa.email || process.env.RECLAMOS_EMAIL_TO || undefined,
    });
    if (envio.ok) {
      await query("update reclamos set respuesta_enviada = true where id = $1", [id]);
      aviso = "Guardado y respuesta enviada al correo del consumidor.";
    } else {
      aviso = `Guardado, pero NO se pudo enviar el correo: ${envio.error}`;
    }
  }
  return { ok: aviso };
}

module.exports = {
  crearReclamo,
  getReclamo,
  listarReclamos,
  contarReclamos,
  guardarSeguimiento,
  sumarDiasHabiles,
  PLAZO_DIAS_HABILES,
  ESTADOS,
  ETIQUETA_ESTADO,
  FILTROS_ESTADO,
  TIPOS_DOC,
};
