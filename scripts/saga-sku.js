// Muestra los datos que tiene SAGA de un SKU del vendedor, para compararlos con la web.
//   npm run saga:sku -- 565626          -> campos ordenados (ParentSku, nombre, precios, paquete, atributos…)
//   npm run saga:sku -- 565626 --raw    -> respuesta completa de SAGA (JSON)
// Usa SELLERCENTER_BASE_URL, SELLERCENTER_USER_ID y SELLERCENTER_API_KEY de .env.dev.
const sc = require("../lib/sellercenter");

// Campo de SAGA → etiqueta (equivalente en la web). Model, país y medidas del paquete
// llegan dentro de ProductData; precio y stock dentro de BusinessUnits.
const CAMPOS = [
  ["SellerSku", "SKU de la variante (sku)"],
  ["ParentSku", "SKU padre (sku_padre del producto)"],
  ["ShopSku", "ShopSku (id interno de SAGA)"],
  ["Name", "Nombre (nombre + variante)"],
  ["Brand", "Marca (nombre en SAGA)"],
  ["Model", "Modelo"],
  ["PrimaryCategoryId", "Categoría primaria (id)"],
  ["PrimaryCategory", "Categoría primaria (nombre)"],
  ["ProductId", "Código de barras"],
  ["ProductionCountry", "País de producción"],
  ["RegistroSanitario", "Registro sanitario"],
  ["CantidadPerfumesVariant", "Medida del frasco (volumen)"],
  ["CantidadContenidaEnElEmpaque", "Cantidad contenida en el empaque"],
  ["FraganciaPerfume", "Aroma"],
  ["TipoDePerfume", "Tipo de perfume"],
  ["Genero", "Género"],
  ["NotasAromaticas", "Notas aromáticas"],
  ["Caracteristicas", "Características"],
  ["ConditionType", "Condición"],
  ["FormatoBelleza", "Formato belleza"],
  ["PackageContent", "Contenido del paquete"],
  ["PackageWidth", "Ancho del paquete"],
  ["PackageLength", "Largo del paquete"],
  ["PackageHeight", "Alto del paquete"],
  ["PackageWeight", "Peso del paquete"],
  ["Variation", "Variación"],
  ["Description", "Descripción"],
];
const CAMPOS_UNIDAD = [
  ["OperatorCode", "Operador"],
  ["Price", "Precio"],
  ["SpecialPrice", "Precio oferta"],
  ["SpecialFromDate", "Oferta desde"],
  ["SpecialToDate", "Oferta hasta"],
  ["Stock", "Stock"],
  ["Status", "Estado"],
  ["IsPublished", "Publicado"],
];
// Campos que no aportan a la comparación.
const IGNORAR = new Set(["BusinessUnits", "ProductData", "Images", "MainImage", "Url", "ContentScore", "TaxClass", "QCStatus"]);

const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const texto = (v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const fila = (etiqueta, valor) => console.log(`${etiqueta.padEnd(40)} ${texto(valor)}`);

async function main() {
  const [sku, flag] = process.argv.slice(2);
  if (!sku) {
    console.error("Uso: npm run saga:sku -- <sku del vendedor> [--raw]");
    process.exit(1);
  }
  const cred = sc.credenciales({
    alias: "env",
    user_id: process.env.SELLERCENTER_USER_ID,
    api_key: process.env.SELLERCENTER_API_KEY,
    base_url: process.env.SELLERCENTER_BASE_URL,
  });
  const r = await sc.request(cred, "GetProducts", { SkuSellerList: JSON.stringify([String(sku)]) });
  if (flag === "--raw") {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  const productos = lista(r?.Body?.Products?.Product);
  if (!productos.length) {
    console.log(`SAGA no tiene ningún producto con SellerSku "${sku}".`);
    return;
  }
  for (const p of productos) {
    console.log(`
=== SellerSku ${p.SellerSku} ===`);
    const plano = { ...p, ...(p.ProductData || {}) };
    const mostrados = new Set();
    for (const [k, etiqueta] of CAMPOS) {
      if (k in plano) {
        mostrados.add(k);
        fila(etiqueta, plano[k]);
      }
    }
    const imagenes = lista(p.Images?.Image ?? p.Images);
    if (imagenes.length) fila("Imágenes", imagenes.join("\n" + " ".repeat(41)));

    // Una unidad de negocio por operador (ej. fape): precio, oferta, stock.
    const unidades = lista(p.BusinessUnits?.BusinessUnit);
    for (const u0 of unidades) {
      const u = u0.BusinessUnit && typeof u0.BusinessUnit === "object" ? u0.BusinessUnit : u0;
      console.log(`
-- Precio y stock (${u.OperatorCode || "?"}) --`);
      for (const [k, etiqueta] of CAMPOS_UNIDAD) if (k in u) fila(etiqueta, u[k]);
    }

    const otros = Object.keys(plano).filter(
      (k) => !mostrados.has(k) && !IGNORAR.has(k) && plano[k] !== "" && plano[k] !== null
    );
    if (otros.length) {
      console.log("\n-- Otros campos devueltos --");
      for (const k of otros) fila(k, plano[k]);
    }
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  if (e.detalle) console.error(JSON.stringify(e.detalle));
  process.exit(1);
});
