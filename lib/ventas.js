/**
 * Acceso a datos de ventas y usuarios de ventas (solo servidor).
 */
const { query } = require("./db");
const { hashPassword, verificarPassword } = require("./password");
const { TELEFONO_SIN_DATO } = require("./ventas-core");
const { sumarDias } = require("./periodos");

const POR_PAGINA = 30;

// ============================================================
//  USUARIOS DE VENTAS
// ============================================================

async function listarUsuariosVentas() {
  return query(
    `select id, usuario, activo, created_at from usuarios_ventas order by lower(usuario)`
  );
}

async function crearUsuarioVentas(usuario, password) {
  const nombre = String(usuario || "").trim();
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(nombre)) {
    throw new Error("Usuario: 3 a 30 caracteres (letras, números, . _ -).");
  }
  if (String(password || "").length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const existe = await query("select 1 from usuarios_ventas where lower(usuario) = lower($1)", [nombre]);
  if (existe.length) throw new Error("Ese usuario ya existe.");
  await query("insert into usuarios_ventas (usuario, password_hash) values ($1, $2)", [
    nombre,
    hashPassword(String(password)),
  ]);
}

async function cambiarPasswordUsuarioVentas(id, password) {
  if (String(password || "").length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const filas = await query("update usuarios_ventas set password_hash = $2 where id = $1 returning id", [
    id,
    hashPassword(String(password)),
  ]);
  if (!filas.length) throw new Error("El usuario ya no existe.");
}

async function eliminarUsuarioVentas(id) {
  await query("delete from usuarios_ventas where id = $1", [id]);
}

/** Devuelve { id, usuario } si las credenciales son correctas, o null. */
async function autenticarUsuarioVentas(usuario, password) {
  const filas = await query(
    "select id, usuario, password_hash from usuarios_ventas where lower(usuario) = lower($1) and activo",
    [String(usuario || "").trim()]
  );
  const u = filas[0];
  // Se verifica siempre (aunque no exista) para no revelar usuarios por tiempo.
  const ok = verificarPassword(password, u ? u.password_hash : "scrypt$00$00");
  return u && ok ? { id: Number(u.id), usuario: u.usuario } : null;
}

async function getUsuarioVentasActivo(id) {
  const filas = await query("select id, usuario from usuarios_ventas where id = $1 and activo", [id]);
  return filas[0] ? { id: Number(filas[0].id), usuario: filas[0].usuario } : null;
}

// ============================================================
//  CAPTURA
// ============================================================

/** Valores más frecuentes de los últimos 30 días (con respaldo fijo). */
async function getDefaultsVenta() {
  const [r] = await query(
    `select
       mode() within group (order by categoria) as categoria,
       mode() within group (order by destino)   as destino
     from ventas
     where fecha >= ((now() at time zone 'America/Lima')::date - 30)`
  );
  return {
    categoria: r?.categoria || "CATALOGOS",
    destino: r?.destino || "LIMA",
  };
}

async function esClienteExistente(telefono) {
  if (!telefono || telefono === TELEFONO_SIN_DATO) return false;
  const filas = await query("select 1 from ventas where telefono = $1 limit 1", [telefono]);
  return filas.length > 0;
}

async function existeDuplicado({ fecha, telefono, monto }) {
  const filas = await query(
    "select 1 from ventas where fecha = $1 and telefono = $2 and monto = $3 limit 1",
    [fecha, telefono, monto]
  );
  return filas.length > 0;
}

async function insertarVenta(v, usuarioId) {
  const [fila] = await query(
    `insert into ventas
       (fecha, telefono, cliente_ref, categoria, monto, adelanto, estado, destino,
        courier, tipo_cliente, metodo_pago, comprobante, notas, registrado_por, origen, cerrada_at,
        distrito, cliente_nombre)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'web',
             case when $7 = 'cerrada' then now() end, $15, $16)
     returning id`,
    [
      v.fecha, v.telefono, v.cliente_ref || null, v.categoria, v.monto, v.adelanto, v.estado,
      v.destino || null, v.courier || null, v.tipo_cliente || null, v.metodo_pago || null,
      v.comprobante || null, v.notas || null, usuarioId, v.distrito || null, v.cliente_nombre || null,
    ]
  );
  return fila.id;
}

const HOY_LIMA = "(now() at time zone 'America/Lima')::date";
const CREADA_HOY = `(v.created_at at time zone 'America/Lima')::date = ${HOY_LIMA}`;
const COLUMNAS_SALES = `
  v.id, v.fecha, v.telefono, v.cliente_ref, v.categoria, v.monto, v.adelanto, v.estado,
  v.destino, v.courier, v.tipo_cliente, v.metodo_pago, v.comprobante, v.notas, v.distrito, v.cliente_nombre,
  v.registrado_por, u.usuario as registrado_por_nombre,
  (v.estado = 'pendiente' or (v.registrado_por = $1 and ${CREADA_HOY})) as editable,
  (v.registrado_por = $1 and ${CREADA_HOY}) as eliminable`;

/**
 * Ventas para la pantalla /operaciones.
 *  filtro "hoy"        -> las que registró el usuario hoy
 *  filtro "pendientes" -> todas las pendientes (de cualquier usuario)
 *  filtro "todas"      -> últimas 100 de todos
 * q busca por teléfono o referencia.
 */
async function getVentasSales({ usuarioId, filtro, q }) {
  const params = [usuarioId];
  const where = [];
  if (filtro === "pendientes") where.push("v.estado = 'pendiente'");
  else if (filtro === "hoy") where.push(`v.registrado_por = $1 and ${CREADA_HOY}`);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(v.telefono like $${params.length} or coalesce(v.cliente_ref,'') ilike $${params.length} or coalesce(v.cliente_nombre,'') ilike $${params.length})`);
  }
  return query(
    `select ${COLUMNAS_SALES}
     from ventas v left join usuarios_ventas u on u.id = v.registrado_por
     ${where.length ? "where " + where.join(" and ") : ""}
     order by ${filtro === "pendientes" ? "v.fecha asc, v.id asc" : "v.created_at desc"}
     limit 100`,
    params
  );
}

async function contarPendientes() {
  const [r] = await query("select count(*)::int as n from ventas where estado = 'pendiente'");
  return r.n;
}

/** Una venta que este usuario puede editar (pendiente, o suya de hoy). */
async function getVentaEditable(id, usuarioId) {
  const filas = await query(
    `select * from (
       select ${COLUMNAS_SALES}
       from ventas v left join usuarios_ventas u on u.id = v.registrado_por
       where v.id = $2
     ) x where editable`,
    [usuarioId, id]
  );
  return filas[0] || null;
}

async function actualizarVenta(id, v, usuarioId) {
  const filas = await query(
    `update ventas set
       fecha = $3, telefono = $4, cliente_ref = $5, categoria = $6, monto = $7, adelanto = $8,
       estado = $9::text, destino = $10, courier = $11, tipo_cliente = $12, metodo_pago = $13,
       comprobante = $14, notas = $15, distrito = $16, cliente_nombre = $17, updated_at = now(),
       cerrada_at = case when $9::text = 'cerrada' then coalesce(cerrada_at, now()) else null end
     where id = $1
       and (estado = 'pendiente'
            or (registrado_por = $2 and (created_at at time zone 'America/Lima')::date = ${HOY_LIMA}))
     returning id`,
    [
      id, usuarioId, v.fecha, v.telefono, v.cliente_ref || null, v.categoria, v.monto, v.adelanto,
      v.estado, v.destino || null, v.courier || null, v.tipo_cliente || null, v.metodo_pago || null,
      v.comprobante || null, v.notas || null, v.distrito || null, v.cliente_nombre || null,
    ]
  );
  return filas.length > 0;
}

/** Una venta cualquiera por id (admin): sin las restricciones de pendiente/propia de hoy. */
async function getVentaPorId(id) {
  const filas = await query("select * from ventas where id = $1", [id]);
  return filas[0] || null;
}

/** Edición desde el panel admin: puede modificar cualquier venta (cerrada o pendiente, de cualquier usuario). */
async function actualizarVentaAdmin(id, v) {
  const filas = await query(
    `update ventas set
       fecha = $2, telefono = $3, cliente_ref = $4, categoria = $5, monto = $6, adelanto = $7,
       estado = $8::text, destino = $9, courier = $10, tipo_cliente = $11, metodo_pago = $12,
       comprobante = $13, notas = $14, distrito = $15, cliente_nombre = $16, updated_at = now(),
       cerrada_at = case when $8::text = 'cerrada' then coalesce(cerrada_at, now()) else null end
     where id = $1
     returning id`,
    [
      id, v.fecha, v.telefono, v.cliente_ref || null, v.categoria, v.monto, v.adelanto,
      v.estado, v.destino || null, v.courier || null, v.tipo_cliente || null, v.metodo_pago || null,
      v.comprobante || null, v.notas || null, v.distrito || null, v.cliente_nombre || null,
    ]
  );
  return filas.length > 0;
}

/** Ventas de una fecha (hoy por defecto) registradas por el usuario. */
async function getVentasDelDia(usuarioId, fecha) {
  return query(
    `select id, fecha, telefono, categoria, monto, adelanto, estado, destino, courier, tipo_cliente
     from ventas
     where registrado_por = $1 and fecha = $2
     order by created_at desc`,
    [usuarioId, fecha]
  );
}

/** Un usuario solo puede eliminar sus propias ventas creadas hoy (hora Lima). */
async function eliminarVentaPropia(id, usuarioId) {
  const filas = await query(
    `delete from ventas
     where id = $1 and registrado_por = $2
       and (created_at at time zone 'America/Lima')::date = (now() at time zone 'America/Lima')::date
     returning id`,
    [id, usuarioId]
  );
  return filas.length > 0;
}

// ============================================================
//  REPORTE (admin)
// ============================================================

function armarFiltro(f = {}) {
  const where = [];
  const params = [];
  const add = (sql, valor) => {
    params.push(valor);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.desde) add("fecha >= ?", f.desde);
  if (f.hasta) add("fecha <= ?", f.hasta);
  if (f.categoria) add("categoria = ?", f.categoria);
  if (f.destino) add("destino = ?", f.destino);
  if (f.estado) add("estado = ?", f.estado);
  if (f.tipo) add("tipo_cliente = ?", f.tipo);
  if (f.distrito) add("coalesce(distrito,'') ilike ?", `%${f.distrito}%`);
  if (f.q) {
    params.push(`%${f.q}%`);
    const n = params.length;
    where.push(`(telefono like $${n} or coalesce(cliente_ref,'') ilike $${n} or coalesce(cliente_nombre,'') ilike $${n})`);
  }
  return { sql: where.length ? "where " + where.join(" and ") : "", params };
}

const filtroVentas = armarFiltro;

async function getVentas(filtros, pagina = 1) {
  const { sql, params } = filtroVentas(filtros);
  const [tot] = await query(
    `select count(*)::int as n, coalesce(sum(monto),0)::float as monto,
            coalesce(sum(adelanto),0)::float as adelanto
     from ventas ${sql}`,
    params
  );
  const offset = (Math.max(1, pagina) - 1) * POR_PAGINA;
  const filas = await query(
    `select v.*, u.usuario as registrado_por_nombre
     from (select * from ventas ${sql} order by fecha desc, id desc limit ${POR_PAGINA} offset ${offset}) v
     left join usuarios_ventas u on u.id = v.registrado_por
     order by v.fecha desc, v.id desc`,
    params
  );
  return { filas, total: tot.n, monto: tot.monto, adelanto: tot.adelanto, porPagina: POR_PAGINA };
}

async function getVentasParaExportar(filtros) {
  const { sql, params } = filtroVentas(filtros);
  return query(
    `select v.*, u.usuario as registrado_por_nombre
     from (select * from ventas ${sql}) v
     left join usuarios_ventas u on u.id = v.registrado_por
     order by v.fecha desc, v.id desc`,
    params
  );
}

async function getPendientes() {
  return query(
    `select id, fecha, telefono, cliente_ref, categoria, monto, adelanto,
            (monto - adelanto) as saldo,
            ((now() at time zone 'America/Lima')::date - fecha) as dias, destino, courier, distrito, cliente_nombre, notas
     from ventas where estado = 'pendiente'
     order by fecha asc, id asc`
  );
}

/** El admin puede eliminar una venta ya cerrada (las pendientes se cierran o se corrigen antes). */
async function eliminarVentaCerrada(id) {
  const filas = await query("delete from ventas where id = $1 and estado = 'cerrada' returning id", [id]);
  return filas.length > 0;
}

async function cerrarVenta(id) {
  await query(
    `update ventas set estado = 'cerrada', cerrada_at = now(), updated_at = now()
     where id = $1 and estado = 'pendiente'`,
    [id]
  );
}

// ============================================================
//  DASHBOARD
// ============================================================

/**
 * Datos del dashboard de ventas para un periodo.
 * `p` viene de resolverPeriodo (lib/periodos.js); categoria/destino son filtros opcionales.
 */
/** Ventas por mes del año en curso vs. el anterior (hora de Lima). Respeta categoría/entrega. */
async function getVentasAnuales({ categoria, destino } = {}) {
  const anio = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }).slice(0, 4));
  const f = armarFiltro({ categoria, destino, desde: `${anio - 1}-01-01`, hasta: `${anio}-12-31` });
  const filas = await query(
    `select extract(year from fecha)::int as anio, extract(month from fecha)::int as mes,
            coalesce(sum(monto),0)::float as monto, count(*)::int as n
     from ventas ${f.sql} group by 1, 2`,
    f.params
  );
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, actual: 0, previo: 0, nActual: 0, nPrevio: 0 }));
  for (const r of filas) {
    const m = meses[r.mes - 1];
    if (r.anio === anio) [m.actual, m.nActual] = [r.monto, r.n];
    else [m.previo, m.nPrevio] = [r.monto, r.n];
  }
  return {
    anio,
    meses,
    totalActual: meses.reduce((s, m) => s + m.actual, 0),
    totalPrevio: meses.reduce((s, m) => s + m.previo, 0),
  };
}

async function getDashboardVentas({ desde, hasta, previo, dias, categoria, destino }) {
  const base = { categoria, destino };
  const f = armarFiltro({ ...base, desde, hasta });
  const fp = armarFiltro({ ...base, desde: previo.desde, hasta: previo.hasta });
  const fpend = armarFiltro({ ...base, estado: "pendiente" });
  const sinTel = `'${TELEFONO_SIN_DATO}'`;

  const [k] = await query(
    `select count(*)::int as n,
            coalesce(sum(monto),0)::float as monto,
            coalesce(sum(adelanto),0)::float as adelantos,
            count(*) filter (where tipo_cliente = 'NUEVO')::int as nuevos,
            count(*) filter (where tipo_cliente = 'RECOMPRA')::int as recompras,
            coalesce(sum(monto) filter (where tipo_cliente = 'NUEVO'),0)::float as monto_nuevos,
            coalesce(sum(monto) filter (where tipo_cliente = 'RECOMPRA'),0)::float as monto_recompras,
            count(*) filter (where telefono = ${sinTel})::int as sin_telefono,
            count(distinct telefono) filter (where telefono <> ${sinTel})::int as clientes
     from ventas ${f.sql}`,
    f.params
  );
  const [prev] = await query(
    `select count(*)::int as n, coalesce(sum(monto),0)::float as monto from ventas ${fp.sql}`,
    fp.params
  );

  // Pendientes: acumulado (no depende del periodo), respeta categoría/entrega.
  const [pend] = await query(
    `select count(*)::int as n, coalesce(sum(monto - adelanto),0)::float as saldo,
            coalesce(sum(monto - adelanto) filter (where ${HOY_LIMA} - fecha <= 7),0)::float as d0_7,
            coalesce(sum(monto - adelanto) filter (where ${HOY_LIMA} - fecha between 8 and 30),0)::float as d8_30,
            coalesce(sum(monto - adelanto) filter (where ${HOY_LIMA} - fecha > 30),0)::float as d31_mas
     from ventas ${fpend.sql}`,
    fpend.params
  );

  const agrupar = (expr, orden = "monto desc", limite = "") =>
    query(
      `select ${expr} as nombre, coalesce(sum(v.monto),0)::float as monto, count(*)::int as n
       from (select * from ventas ${f.sql}) v
       left join usuarios_ventas u on u.id = v.registrado_por
       group by 1 order by ${orden} ${limite}`,
      f.params
    );

  const [porCategoria, porEntrega, porMetodo, porUsuario] = await Promise.all([
    agrupar("v.categoria"),
    agrupar("coalesce(v.courier, v.destino, 'SIN DATO')"),
    agrupar("coalesce(v.metodo_pago, 'SIN DATO')"),
    agrupar("coalesce(u.usuario, case when v.origen = 'csv' then 'Excel (histórico)' else 'SIN DATO' end)"),
  ]);

  // Tendencia: por día (rellenando días sin ventas) o por mes si el rango es largo.
  const porMes = dias > 62;
  const filasTendencia = await query(
    porMes
      ? `select to_char(date_trunc('month', fecha), 'YYYY-MM') as clave,
                sum(monto)::float as monto, count(*)::int as n
         from ventas ${f.sql} group by 1 order by 1`
      : `select to_char(fecha, 'YYYY-MM-DD') as clave, sum(monto)::float as monto, count(*)::int as n
         from ventas ${f.sql} group by 1 order by 1`,
    f.params
  );
  const mapa = new Map(filasTendencia.map((r) => [r.clave, r]));
  let tendencia;
  if (porMes) {
    tendencia = filasTendencia;
  } else {
    tendencia = [];
    for (let i = 0; i < dias; i++) {
      const clave = sumarDias(desde, i);
      const r = mapa.get(clave);
      tendencia.push({ clave, monto: r ? r.monto : 0, n: r ? r.n : 0 });
    }
  }

  const topClientes = await query(
    `select telefono, sum(monto)::float as monto, count(*)::int as n
     from ventas ${f.sql ? f.sql + " and" : "where"} telefono <> ${sinTel}
     group by telefono order by monto desc limit 10`,
    f.params
  );

  const frecuencia = await query(
    `select case when c = 1 then '1 compra' when c = 2 then '2 compras'
                when c <= 4 then '3-4 compras' else '5 o más' end as nombre,
            count(*)::int as n
     from (select telefono, count(*) as c from ventas
           ${f.sql ? f.sql + " and" : "where"} telefono <> ${sinTel} group by telefono) x
     group by 1 order by min(c)`,
    f.params
  );

  // Con un solo día se muestra el detalle de las ventas.
  const detalleDia =
    dias === 1
      ? await query(
          `select v.*, to_char(v.fecha, 'YYYY-MM-DD') as fecha_txt, u.usuario as registrado_por_nombre
           from (select * from ventas ${f.sql}) v
           left join usuarios_ventas u on u.id = v.registrado_por
           order by v.created_at desc limit 200`,
          f.params
        )
      : [];

  return {
    ...k,
    ticket: k.n ? k.monto / k.n : 0,
    previo: { n: prev.n, monto: prev.monto },
    variacion: prev.monto > 0 ? ((k.monto - prev.monto) / prev.monto) * 100 : null,
    pendientes: pend,
    porCategoria,
    porEntrega,
    porMetodo,
    porUsuario,
    tendencia,
    tendenciaPorMes: porMes,
    topClientes,
    frecuencia,
    detalleDia,
  };
}

module.exports = {
  POR_PAGINA,
  listarUsuariosVentas,
  crearUsuarioVentas,
  cambiarPasswordUsuarioVentas,
  eliminarUsuarioVentas,
  autenticarUsuarioVentas,
  getUsuarioVentasActivo,
  getDefaultsVenta,
  esClienteExistente,
  existeDuplicado,
  insertarVenta,
  getVentasDelDia,
  getVentasSales,
  contarPendientes,
  getVentaEditable,
  actualizarVenta,
  actualizarVentaAdmin,
  getVentaPorId,
  eliminarVentaPropia,
  getVentas,
  getVentasParaExportar,
  getPendientes,
  cerrarVenta,
  eliminarVentaCerrada,
  getDashboardVentas,
  getVentasAnuales,
};
