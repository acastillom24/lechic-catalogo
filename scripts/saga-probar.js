// Pruebas de solo lectura contra Seller Center (SAGA).
// Usa SELLERCENTER_BASE_URL, SELLERCENTER_USER_ID y SELLERCENTER_API_KEY de .env.development
// (solo para estas consultas; la web usa las cuentas guardadas en Configuración → SAGA).
//   npm run saga:probar                      -> valida firma y credenciales (GetProducts Limit=1)
//   npm run saga:probar -- --arbol           -> lista TODAS las categorías con su id
//   npm run saga:probar -- --arbol perfum    -> solo las que contengan "perfum" (en cualquier nivel de la ruta)
//   npm run saga:probar -- <idCategoria>     -> atributos de esa categoría (GetCategoryAttributes)
//   npm run saga:probar -- --marcas yanbal   -> marcas de SAGA (filtro opcional)
const sc = require("../lib/sellercenter");

const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// Recorre el árbol y devuelve [{ id, ruta, hoja }].
function aplanar(nodos, ruta = [], salida = []) {
  for (const n of lista(nodos)) {
    const nombre = n.Name ?? n.name ?? "?";
    const id = n.CategoryId ?? n.categoryId ?? n.Id;
    const hijos = lista(n.Children?.Category ?? n.Children);
    const actual = [...ruta, nombre];
    salida.push({ id, ruta: actual.join(" > "), hoja: hijos.length === 0 });
    aplanar(hijos, actual, salida);
  }
  return salida;
}

async function main() {
  const [arg, filtro] = process.argv.slice(2);
  const cred = sc.credenciales({
    alias: "env",
    user_id: process.env.SELLERCENTER_USER_ID,
    api_key: process.env.SELLERCENTER_API_KEY,
    base_url: process.env.SELLERCENTER_BASE_URL,
  });
  console.log(`Usuario ${cred.userId} · ${cred.base}`);

  if (arg === "--arbol") {
    const r = await sc.arbolCategorias(cred);
    const filas = aplanar(r?.Body?.Categories?.Category ?? r?.Body?.Categories);
    const txt = (filtro || "").toLowerCase();
    const sel = txt ? filas.filter((f) => f.ruta.toLowerCase().includes(txt)) : filas;
    console.log(`${sel.length} de ${filas.length} categorías${txt ? ` que contienen "${filtro}"` : ""} (★ = hoja, la que se puede usar en un producto):\n`);
    for (const f of sel) console.log(`${f.hoja ? "★" : " "} ${String(f.id).padStart(8)}  ${f.ruta}`);
    if (!filas.length) console.log("Respuesta inesperada:", JSON.stringify(r).slice(0, 500));
    return;
  }

  if (arg === "--marcas") {
    const r = await sc.marcas(cred);
    const b = lista(r?.Body?.Brands?.Brand ?? r?.Body?.Brands);
    const txt = (filtro || "").toLowerCase();
    // Cada elemento llega como { Brand: { BrandId, Name, ... } }.
    const nombres = b.map((x) => (x.Brand ?? x).Name).filter((n) => typeof n === "string");
    const sel = txt ? nombres.filter((n) => n.toLowerCase().includes(txt)) : nombres;
    console.log(`${sel.length} de ${nombres.length} marcas${txt ? ` que contienen "${filtro}"` : ""}:\n`);
    for (const n of sel) console.log(`  ${n}`);
    if (!nombres.length) console.log("Respuesta inesperada:", JSON.stringify(r).slice(0, 500));
    return;
  }

  if (arg) {
    const a = await sc.atributosCategoria(cred, arg);
    console.log(JSON.stringify(a, null, 2));
    return;
  }

  const r = await sc.probarConexion(cred);
  const p = r?.Body?.Products?.Product;
  console.log("Conexión OK. Productos devueltos:", Array.isArray(p) ? p.length : p ? 1 : 0);
}

main().catch((e) => {
  console.error("Error:", e.message);
  if (e.detalle) console.error(JSON.stringify(e.detalle));
  process.exit(1);
});
