// Genera/actualiza data/saga-campos.json: los atributos "extra" de cada categoría primaria de SAGA
// (solo lectura: GetCategoryAttributes). Usa las credenciales de .env.development, igual que saga-probar.
//   npm run saga:campos -- 2945 1332 320     -> agrega o actualiza esas categorías en el catálogo
//
// Un atributo es "extra" si no lo cubre ya el formulario (nombre, marca, medidas del paquete, registro
// sanitario…). Por producto = grupo "Product Specifications" (va dentro de ProductData); por variante =
// grupo "Variation" (etiqueta de primer nivel del XML, como CantidadPerfumesVariant).
// Perfumes (1735) tiene su propio formulario y no pasa por aquí.
const fs = require("fs");
const path = require("path");
const sc = require("../lib/sellercenter");

const ARCHIVO = path.join(__dirname, "..", "data", "saga-campos.json");

// FeedName que el formulario/mapeo ya envía por su cuenta.
const CUBIERTOS = new Set([
  "SellerSku", "ParentSku", "ProductId", "Name", "Brand", "Description", "PrimaryCategory", "ConditionType",
  "PackageWidth", "PackageLength", "PackageHeight", "PackageWeight", "PackageContent",
  "Model", "ProductionCountry", "RegistroSanitario",
]);
const GRUPOS = { "Product Specifications": "producto", Variation: "variante" };
const TIPOS = { dropdown: "lista", multiselect: "multi", numberfield: "numero", textfield: "texto" };

const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function convertir(respuesta) {
  const atributos = lista(respuesta?.Body?.Attribute);
  return atributos
    .filter((a) => GRUPOS[a.GroupName] && !CUBIERTOS.has(a.FeedName))
    .map((a) => {
      const opciones = lista(a.Options?.Option).map((o) => o.Name).filter(Boolean); // SAGA agrega "…" al final de listas largas y lo guarda como valor: se conserva como opción
      const max = Number(a.MaxLength);
      return {
        id: a.FeedName,
        etiqueta: a.Label,
        tipo: TIPOS[a.InputType] || "texto",
        nivel: GRUPOS[a.GroupName],
        obligatorio: a.isMandatory === "1",
        ...(opciones.length ? { opciones } : {}),
        ...(max > 0 ? { max } : {}),
      };
    });
}

async function main() {
  const ids = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
  if (!ids.length) {
    console.error("Uso: npm run saga:campos -- <idCategoria> [<idCategoria> …]");
    process.exit(1);
  }
  const cred = sc.credenciales({
    alias: "env",
    user_id: process.env.SELLERCENTER_USER_ID,
    api_key: process.env.SELLERCENTER_API_KEY,
    base_url: process.env.SELLERCENTER_BASE_URL,
  });
  const actual = fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, "utf8")) : {};
  for (const id of ids) {
    const atributos = convertir(await sc.atributosCategoria(cred, id));
    if (!atributos.length) {
      console.error(`Categoría ${id}: SAGA no devolvió atributos (¿id correcto? ¿es una categoría hoja ★?). No se guarda.`);
      continue;
    }
    actual[id] = atributos;
    const obl = atributos.filter((a) => a.obligatorio).map((a) => a.id);
    console.log(`Categoría ${id}: ${atributos.length} campos extra (obligatorios: ${obl.join(", ") || "ninguno"})`);
  }
  const ordenado = Object.fromEntries(Object.entries(actual).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(ARCHIVO, JSON.stringify(ordenado, null, 1) + "\n");
  console.log(`Guardado en data/saga-campos.json`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
}

module.exports = { convertir };
