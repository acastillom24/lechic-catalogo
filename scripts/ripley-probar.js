// Pruebas de solo lectura contra Mirakl (Ripley Perú).
// Usa RIPLEY_BASE_URL y RIPLEY_API_KEY de .env.development (solo para estas consultas; la web usa las
// cuentas guardadas en Integraciones → Ripley).
//   npm run ripley:probar                          -> valida la API key (versión + datos de la tienda)
//   npm run ripley:probar -- --arbol [texto]       -> categorías (jerarquías), opcionalmente filtradas por texto
//   npm run ripley:probar -- --atributos [codigo]  -> atributos de catálogo (todos o de una categoría)
//   npm run ripley:probar -- --listas [codigo]     -> listas de valores (o los valores de una lista)
const mk = require("../lib/mirakl");

async function main() {
  const [opcion, arg] = process.argv.slice(2);
  const datos = { alias: "env", base_url: process.env.RIPLEY_BASE_URL, api_key: process.env.RIPLEY_API_KEY };
  if (!datos.base_url || !datos.api_key) {
    console.error("Define RIPLEY_BASE_URL y RIPLEY_API_KEY en .env.development.");
    process.exit(1);
  }
  const cred = mk.credenciales(datos);

  if (opcion === "--arbol") {
    const nodos = await mk.jerarquias(cred);
    const porCodigo = new Map(nodos.map((n) => [n.code, n]));
    const ruta = (n) => (n.parent_code && porCodigo.has(n.parent_code) ? `${ruta(porCodigo.get(n.parent_code))} > ${n.label}` : n.label);
    const filtro = (arg || "").toLowerCase();
    for (const n of nodos) {
      const r = ruta(n);
      if (!filtro || r.toLowerCase().includes(filtro)) console.log(`${n.code}\t${r}`);
    }
    return;
  }
  if (opcion === "--atributos") {
    const attrs = await mk.atributos(cred, { jerarquia: arg || "" });
    for (const a of attrs) console.log([a.code, a.type, a.required ? "REQUERIDO" : "", a.variant ? "variante" : "", a.type_parameter || "", a.label].filter(Boolean).join("\t"));
    return;
  }
  if (opcion === "--listas") {
    const listas = await mk.listasValores(cred, { codigo: arg || "" });
    for (const l of listas) {
      console.log(`${l.code}\t${l.label}`);
      if (arg && Array.isArray(l.values)) for (const v of l.values) console.log(`  - ${v.code}\t${v.label}`);
    }
    return;
  }
  console.log(JSON.stringify(await mk.probarConexion(cred), null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
