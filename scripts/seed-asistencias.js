// Genera colaboradores y asistencias de prueba (~45 días hacia atrás).
// SOLO para develop: uso `npm run asistencias:seed:dev`.
// Es idempotente: borra y regenera únicamente los colaboradores marcados
// con el cargo "[demo] ..." (no toca datos reales).
const fs = require("fs");
const { Client } = require("pg");

// Protección: nunca correr contra la base de .env.production (producción).
function host(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
function hostLocal() {
  try {
    const m = /^DATABASE_URL=(.*)$/m.exec(fs.readFileSync(".env.production", "utf8"));
    return m ? host(m[1].trim().replace(/^["']|["']$/g, "")) : null;
  } catch {
    return null;
  }
}

const DEMO = [
  { nombre: "Lucía Paredes", cargo: "[demo] Vendedora", jornada: "COMPLETO", tipo_pago: "QUINCENAL", tarifa: 6.5, mult: 1.25, ent: "09:00", sal: "17:00", ref: 60, baja: false },
  { nombre: "Marco Salazar", cargo: "[demo] Almacén", jornada: "COMPLETO", tipo_pago: "SEMANAL", tarifa: 5.8, mult: 1.5, ent: "08:00", sal: "16:00", ref: 45, baja: false },
  { nombre: "Rosa Quispe", cargo: "[demo] Empaque", jornada: "MEDIO_TIEMPO", tipo_pago: "MENSUAL", tarifa: 6.0, mult: 1.25, ent: "14:00", sal: "18:00", ref: 0, baja: false },
  { nombre: "Diego Ramos", cargo: "[demo] Reparto", jornada: "MEDIO_TIEMPO", tipo_pago: "SEMANAL", tarifa: 7.0, mult: 1.35, ent: "10:00", sal: "14:00", ref: 0, baja: true },
];

const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

async function main() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (usa npm run asistencias:seed:dev).");
  if (host(url) && host(url) === hostLocal()) {
    throw new Error("DATABASE_URL coincide con la de .env.production (producción). Abortado.");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("delete from colaboradores where cargo like '[demo]%'");

  const hoy = (await client.query("select (now() at time zone 'America/Lima')::date::text as d")).rows[0].d;
  let total = 0;

  for (const c of DEMO) {
    const { rows } = await client.query(
      `insert into colaboradores (nombre, cargo, jornada, tipo_pago, multiplicador, tarifa,
         hora_entrada, hora_salida, refrigerio_min, activo, fecha_baja)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11) returning id`,
      [c.nombre, c.cargo, c.jornada, c.tipo_pago, c.mult, c.tarifa, c.ent, c.sal, c.ref, !c.baja,
       c.baja ? (await client.query("select ($1::date - 10)::text d", [hoy])).rows[0].d : null]
    );
    const id = rows[0].id;
    const jornada = min(c.sal) - min(c.ent);

    for (let i = 45; i >= 0; i--) {
      const { rows: f } = await client.query(
        "select ($1::date - $2::int)::text as d, extract(dow from ($1::date - $2::int))::int as dow",
        [hoy, i]
      );
      const { d, dow } = f[0];
      if (dow === 0) continue; // domingo libre
      if (c.baja && i < 10) continue; // dado de baja hace 10 días
      if (Math.random() < 0.07) continue; // falta
      if (i === 0 && c.baja) continue;

      // Llegada: casi siempre puntual, a veces tarde (hasta 25 min).
      const llegada = min(c.ent) + (Math.random() < 0.3 ? rnd(1, 25) : rnd(-8, 0));
      // Salida: a veces se queda extra (15-120 min), a veces sale antes.
      const r = Math.random();
      const delta = r < 0.3 ? rnd(15, 120) : r < 0.4 ? -rnd(10, 40) : rnd(-5, 5);
      const salida = llegada + jornada + c.ref + delta;
      const abierta = i === 0 && !c.baja && c.nombre === "Marco Salazar"; // hoy: ingreso sin salida
      const extra = Math.max(0, salida - llegada - c.ref - jornada);
      const aprobadas = extra > 0 && Math.random() < 0.6;

      await client.query(
        `insert into asistencias (colaborador_id, fecha, hora_ingreso, hora_salida, tarifa,
           multiplicador, minutos_jornada, refrigerio_min, extras_aprobadas)
         values ($1,$2::date,$3,$4,$5,$6,$7,$8,$9)`,
        [id, d, hh(llegada), abierta || (i === 0) ? null : hh(salida), c.tarifa, c.mult, jornada, c.ref, aprobadas && !abierta && i !== 0]
      );
      total++;
    }
  }
  await client.end();
  console.log(`Listo: ${DEMO.length} colaboradores demo y ${total} asistencias generadas.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
