/**
 * Drenador de la cola de SAGA: vacía solo, sin que nadie abra una página, lo que SAGA dejó en espera por su límite
 * de 1 feed cada 2 minutos por cuenta, y avanza los envíos pendientes (feed terminado → imagen → revisión).
 *
 *  - Solo trabaja si hay algo en cola o por avanzar (si no, una consulta barata y sale).
 *  - Un solo drenador a la vez (candado en `configuracion`, clave saga_drenador).
 *  - Cada pasada dura como mucho `presupuestoMs`; si aún queda trabajo, se vuelve a invocar a sí mismo
 *    (/api/saga/cola) con un tope diario de encadenados para cuidar los límites del plan gratuito.
 *  - Los disparadores son `after()` de guardar producto/acciones/páginas de SAGA y un cron diario de respaldo.
 */
const { query } = require("./db");
const { procesarCola, refrescarPendientes } = require("./saga-sync");

const PRESUPUESTO_MS = 270000; // por debajo del maxDuration de 300 s
const MAX_ENCADENADOS_DIA = 24; // ≈ 6 h de drenado al día como máximo
const REVISION_CADA_MS = 10 * 60 * 1000; // cada cuánto consultar las filas que esperan la revisión de SAGA

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hoyLima = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

/** Candado: true si este proceso lo obtuvo (nadie más lo tiene vigente). */
async function tomarCandado(ms) {
  const filas = await query(
    `insert into configuracion (clave, valor, updated_at)
     values ('saga_drenador', jsonb_build_object('hasta', (now() + ($1::text || ' milliseconds')::interval)::text), now())
     on conflict (clave) do update set valor = excluded.valor, updated_at = now()
       where (configuracion.valor->>'hasta')::timestamptz < now()
     returning clave`,
    [String(ms)]
  );
  return filas.length > 0;
}

async function soltarCandado() {
  await query("update configuracion set valor = jsonb_build_object('hasta', now()::text), updated_at = now() where clave = 'saga_drenador'");
}

/**
 * Qué falta por hacer: filas en cola (con su próximo vencimiento) y envíos "vivos" (esperan el feed de creación,
 * la imagen, o acaban de enviar la imagen y aún no tienen su primera lectura de la revisión).
 */
async function trabajo() {
  const [r] = await query(
    `select
       (select count(*)::int from sincronizaciones where sistema = 'saga' and cola_modo is not null) as cola,
       (select min(proximo_envio) from sincronizaciones where sistema = 'saga' and cola_modo is not null) as siguiente,
       (select count(*)::int from sincronizaciones
         where sistema = 'saga' and estado = 'pendiente' and cola_modo is null and feed_id is not null
           and (imagen_pendiente or revision_fecha is null)
           and ultimo_sync > now() - interval '30 minutes') as vivos`
  );
  return { cola: r.cola, vivos: r.vivos, siguiente: r.siguiente ? new Date(r.siguiente).getTime() : null };
}

/** Cuenta una invocación encadenada del día; false si ya se llegó al tope. */
async function permitirEncadenado() {
  const [r] = await query(
    `insert into configuracion (clave, valor, updated_at) values ('saga_encadenados', jsonb_build_object('dia', $1::text, 'n', 1), now())
     on conflict (clave) do update set updated_at = now(), valor = case
       when configuracion.valor->>'dia' = $1 then jsonb_build_object('dia', $1::text, 'n', (configuracion.valor->>'n')::int + 1)
       else jsonb_build_object('dia', $1::text, 'n', 1) end
     returning (valor->>'n')::int as n`,
    [hoyLima()]
  );
  return r.n <= MAX_ENCADENADOS_DIA;
}

/** URL propia para continuar el drenado en una función nueva (producción, vista previa o local). */
function urlCola() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const base = host ? `https://${host}` : `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/api/saga/cola`;
}

/**
 * Drena la cola hasta que no quede nada o se agote el presupuesto. Nunca lanza.
 * Devuelve { ocupado } si ya había otro drenador, o { cola, vivos, encadenado } con lo que quedó.
 */
async function drenarCola({ presupuestoMs = PRESUPUESTO_MS } = {}) {
  let tiene = false;
  try {
    let t = await trabajo();
    if (!t.cola && !t.vivos) return { cola: 0, vivos: 0, encadenado: false };
    if (!(await tomarCandado(presupuestoMs + 30000))) return { ocupado: true };
    tiene = true;
    const fin = Date.now() + presupuestoMs;
    let ultimaRevision = 0;
    for (;;) {
      await procesarCola();
      // Avanza los pendientes; las filas que ya esperan la revisión de SAGA se consultan solo de vez en cuando.
      const conRevision = Date.now() - ultimaRevision >= REVISION_CADA_MS;
      await refrescarPendientes(null, { sinRevision: !conRevision });
      if (conRevision) ultimaRevision = Date.now();

      t = await trabajo();
      if (!t.cola && !t.vivos) break;
      // Duerme hasta el próximo vencimiento de la cola (o 30 s para volver a mirar los feeds), sin pasarse del presupuesto.
      const hastaCola = t.siguiente ? Math.max(5000, t.siguiente - Date.now()) : 30000;
      const espera = Math.min(hastaCola, 30000 + (t.cola ? 90000 : 0), fin - Date.now());
      if (espera < 5000) break;
      await dormir(espera);
    }
    await soltarCandado();
    tiene = false;

    // Si aún queda trabajo, continúa en una invocación nueva (con tope diario).
    let encadenado = false;
    t = await trabajo();
    if ((t.cola || t.vivos) && process.env.CRON_SECRET && (await permitirEncadenado())) {
      try {
        await fetch(urlCola(), { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(8000) });
        encadenado = true;
      } catch {
        /* el cron diario o el siguiente guardado lo retoman */
      }
    }
    return { cola: t.cola, vivos: t.vivos, encadenado };
  } catch {
    return { error: true };
  } finally {
    if (tiene) await soltarCandado().catch(() => {});
  }
}

module.exports = { drenarCola };
