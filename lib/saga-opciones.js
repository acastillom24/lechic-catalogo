/**
 * Listas de SAGA para perfumes (solo servidor). Los valores por defecto están aquí abajo;
 * lo guardado en /admin/configuracion (pestaña SAGA) vive en la tabla `configuracion`,
 * clave "saga_opciones", y los reemplaza lista por lista. Si la tabla falla o no hay
 * nada guardado, se usan los defaults. Valores de la categoría 1735 (GetCategoryAttributes).
 */
const { query } = require("./db");
const { IDS, idsDe } = require("./saga-atributos");
const { getMapaMarcasSaga } = require("./marcas-config");

const { normalizarCatalogo } = require("./atributos-categoria");
const { PREDETERMINADOS, camposDe } = require("./saga-campos");
const { normalizarEquivalencias, migrarDesdeLegado, completarPorDefecto, camposEnlazados } = require("./equivalencias");

const CLAVE = "saga_opciones";
const CLAVE_ATRIBUTOS = "atributos_categoria";
const CLAVE_EQUIVALENCIAS = "equivalencias";
const LISTAS = ["aromas", "cantidades", "tiposPerfume", "condiciones", "urlsBase", "operadores", "categorias",
  "generos", "formatosBelleza", "paises", "caracteristicas"];

// Acciones de vinculación base (no se pueden borrar; sí cambiar sus atributos con clicks en Configuración → SAGA).
const STOCK_PRECIO = ["stock", "precio", "oferta"];
const TECNICOS = idsDe("Datos técnicos");
const CONTENIDO = ["nombre", "descripcion", "imagen"];
const ACCIONES_BASE = [
  { id: "vincular", nombre: "Vincular (stock y precio)", atributos: [...STOCK_PRECIO] },
  { id: "vincular_tecnicos", nombre: "Vincular + datos técnicos", atributos: [...STOCK_PRECIO, ...TECNICOS] },
  { id: "vincular_todo", nombre: "Vincular + todo", atributos: [...STOCK_PRECIO, ...TECNICOS, ...CONTENIDO] },
  { id: "actualizar", nombre: "Actualizar", atributos: [...STOCK_PRECIO, ...TECNICOS, ...CONTENIDO] },
];
const IDS_BASE = ACCIONES_BASE.map((a) => a.id);

const defaults = {
  // Qué atributos sincroniza cada acción sobre un SKU que ya existe en SAGA (matriz en Configuración → SAGA).
  acciones: ACCIONES_BASE,
  // Categorías primarias de SAGA que se pueden elegir en el producto (id numérico + descripción).
  // Para buscar ids: npm run saga:probar -- --arbol texto  (usar las marcadas con ★)
  categorias: [{ id: "1735", nombre: "Fragancias|perfumes" }],
  // URLs base de Seller Center que se pueden elegir al registrar una cuenta.
  urlsBase: ["https://sellercenter-api.falabella.com"],
  // Códigos de unidad de negocio (OperatorCode) para stock/precio. Perú = fape.
  operadores: ["fape"],
  // FraganciaPerfume (multiselección)
  aromas: ["Acaramelado", "Acuática", "Acuerado", "Almizclado", "Amaderado", "Ambar", "Aromática", "Atalcado/Polvoso", "Chipre", "Cacao", "Cítrico", "Café", "Dulce", "Especias", "Floral", "Fougere/Helecho", "Fresca", "Frutal", "Gourmand", "Oriental", "Tropical", "Verde/Herbal"],
  // CantidadPerfumesVariant: texto exacto de SAGA (ej. "8ML", "40ML"). SAGA devuelve
  // esta lista truncada (termina en "…"); si falta una medida, agrégala en la configuración.
  cantidades: ["2 ML","2.5 ML","3 ML","4 ML","5 ML","6 ML","7 ML","8ML","9 ML","10 ML","10.5 ML","11 ML","12 ML","13 ML","14 ML","15 ML","16 ML","17 ML","18 ML","19 ML","20 ML","21 ML","22 ML","23 ML","24 ML","25 ML","30 ML","40ML","50 ML","55 ML","60 ML","65 ML","70 ML","75 ML","80 ML","85 ML","90 ML","100 ML","110 ML","120 ML","125 ML","130 ML","135 ML","140 ML","150 ML","160 ML","170 ML","175 ML","180 ML","200 ML","204 ML","207 ML","220 ML","225 ML","230 ML","235 ML","236 ML","237 ML","240 ML","244 ML","250 ML"],
  // TipoDePerfume
  tiposPerfume: ["Body mist", "Body splash", "Eau de cologne", "Eau de fraiche", "Eau de parfum", "Eau de toilette", "Parfum", "Perfume extract", "Set de perfumería"],
  // ConditionType
  condiciones: ["Nuevo", "Open Box", "Reacondicionado excelente (A)", "Reacondicionado detalle estético (B)"],
  // Género (dropdown obligatorio de SAGA)
  generos: ["Bebé", "Hombre", "Mujer", "Niña", "Niño", "Unisex"],
  // FormatoBelleza (dropdown obligatorio de SAGA)
  formatosBelleza: ["Aerosol", "Ampolla", "Blister", "Botella", "Caja", "Cartucho", "Crayon", "Doypack", "Estuche", "Frasco", "Gotero", "Lápiz", "Lata", "Paquete", "Roll-on", "Sachet", "Set", "Stick", "Sobre", "Spray", "Tableta", "Tarro", "Tubo"],
  // ProductionCountry ("Hecho en", dropdown de SAGA)
  paises: ["Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Anguila", "Antártida", "Antigua y Barbuda", "Arabia Saudí", "Argelia", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaiyán", "Bahamas", "Bahréin", "Bangladesh", "Barbados", "Bélgica", "Belice", "Benín", "Bermudas", "Bielorrusia", "Bolivia, Estado Plurinacional de", "Bonaire, Sint Estatus y Saba", "Bosnia-Herzegovina", "Botsuana", "Brasil", "Brunéi Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Bután", "Cabo Verde", "Camboya", "Camerún", "Canadá", "Chad", "Chile", "China", "Chipre", "Colombia", "Comoras", "Congo", "Congo, la República Democrática del", "Corea, República de", "Corea, República Popular Democrática de", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba", "Curasao", "Dinamarca", "Djibouti", "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia", "Eslovenia", "España", "Estados Unidos", "Estonia", "Etiopía", "Federación de Rusia", "Filipinas", "Finlandia", "Fiyi", "Francia", "Gabón", "Gambia", "Georgia", "Georgia del Sur y las Islas Sándwich del Sur", "Ghana", "Gibraltar", "Granada", "Grecia", "Groenlandia", "Guadalupe", "Guam", "Guatemala", "Guayana Francesa", "Guernsey", "Guinea", "Guinea Ecuatorial", "Guinea-Bissau", "Guyana", "Haití", "Honduras", "Hong Kong", "Hungría", "India", "Indonesia", "Irak", "Irán, República Islámica de", "Irán, República Islámica del", "Irlanda", "Isla Bouvet", "Isla de Man", "Isla de Navidad", "Isla Heard e Islas McDonald", "Isla Norfolk", "Islandia", "Islas Åland", "Islas Caimán", "Islas Cocos (Keeling)", "Islas Cook", "Islas Faroe", "Islas Malvinas", "Islas Marianas del Norte", "Islas Marshall", "Islas Salomón", "Islas Turcas y Caicos", "Islas Ultramarinas Menores de los Estados Unidos", "Islas Vírgenes, Británica", "Islas Vírgenes, Estados Unidos", "Israel", "Italia", "Jamahiriya árabe Libia", "Jamaica", "Japón", "Jersey", "Jordania", "Kazajstán", "Kenia", "Kirguizistán", "Kiribati", "Kuwait", "Lesoto", "Letonia", "Líbano", "Liberia", "Liechtenstein", "Lituania", "Luxemburgo", "Macao", "Macedonia, la ex República Yugoslava de", "Madagascar", "Malasia", "Malawi", "Maldivas", "Malí", "Malta", "Marruecos", "Martinica", "Mauricio", "Mauritania", "Mayotte", "México", "Micronesia, Estados Federados de", "Moldavia, República de", "Mónaco", "Mongolia", "Montenegro", "Montserrat", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Nicaragua", "Níger", "Nigeria", "Niue", "Noruega", "Nueva Caledonia", "Nueva Zelanda", "Omán", "Países Bajos", "Pakistán", "Palau", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú", "Pitcairn", "Polinesia Francesa", "Polonia", "Portugal", "Puerto Rico", "Qatar", "Reino Unido", "República árabe de Siria", "República Centroafricana", "República Checa", "República Democrática Popular Lao", "República Dominicana", "Reunión", "Ruanda", "Rumania", "Sahara Occidental", "Samoa", "Samoa Americana", "San Bartolomé", "San Cristóbal y Nieves", "San Marino", "San Martín (parte francesa)", "San Martín (parte holandesa)", "San Pedro y Miquelón", "San Vicente y las Granadinas", "Santa Elena, Ascensión y Tristán da Cunha", "Santa Lucía", "Santa Sede (Estado de la Ciudad del Vaticano)", "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Somalia", "Sri Lanka", "Suazilandia", "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza", "Surinam", "Svalbard y Jan Mayen", "Tailandia", "Taiwán, Provincia de China", "Tanzania, República Unida de", "Tayikistán", "Territorio Británico del Océano Indico", "Territorio Palestino, Ocupado", "Territorios del Sur de Francia", "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad y Tobago", "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistán", "Vanuatu", "Venezuela", "Vietnam", "Wallis y Futuna", "Yemen", "Zambia", "Zimbabue"],
  // Caracteristicas (multiselección opcional de SAGA)
  caracteristicas: ["Alivio del dolor", "Antiinflamatorio", "Antioxidante", "Antiséptico", "Blanqueador dental", "Brillo", "Cicatrizante", "Con color", "Con fragancia", "Crecimiento", "Cuidado del cuero cabelludo", "Degradado suave", "Dermatológicamente probado", "Despigmentante", "Detox", "Duradero", "Exfoliantes", "Fijación", "Fortalecedor", "Hipoalergénico", "Humectante", "Larga duración", "Libre de parabenos", "Ligero", "Luminosidad", "Matificante", "Natural", "No comedogénico", "No probado en animales", "Orgánico", "Perfumado", "Protección del calor", "Protección del color", "Protección UV", "Relajante muscular", "Refrescante", "Resistencia al agua", "Sin alcohol", "Sin azúcar", "Sin colorantes", "Sin enjuague", "Sin flúor", "Sin fragancia", "Sin gluten", "Sin lactosa", "Sin siliconas", "Sin sulfatos", "Suavidad", "Temporizador", "Terapeútico", "reafirmante", "Ultrasónico", "Vegano", "Volumen"],
  // `marcas` (slug de marca -> nombre EXACTO en SAGA) ya no se guarda aquí: se deriva de la
  // configuración de marcas (lib/marcas-config.js, Configuración → Marcas) en getOpcionesSaga().
  // Para ver los nombres reales: npm run saga:probar -- principal --marcas <texto>
  marcas: {},
};

/** Acciones guardadas válidas + las base que falten (siempre existen las 4 base). */
function normalizarAcciones(guardadas) {
  const lista = (Array.isArray(guardadas) ? guardadas : [])
    .filter((a) => a && typeof a.id === "string" && typeof a.nombre === "string" && Array.isArray(a.atributos))
    .map((a) => ({ id: a.id, nombre: a.nombre, atributos: [...new Set(a.atributos.filter((x) => IDS.has(x)))] }));
  for (const base of ACCIONES_BASE) if (!lista.some((a) => a.id === base.id)) lista.push({ ...base, atributos: [...base.atributos] });
  return lista;
}

function combinar(guardado) {
  const g = guardado && typeof guardado === "object" ? guardado : {};
  const salida = { ...defaults, marcas: {} };
  for (const k of LISTAS) if (Array.isArray(g[k]) && g[k].length) salida[k] = g[k];
  salida.acciones = normalizarAcciones(g.acciones);
  // Equivalencia categoría web → categoría SAGA por defecto: { "<categoría web>": "<id SAGA>" }.
  salida.mapaCategorias = {};
  if (g.mapaCategorias && typeof g.mapaCategorias === "object" && !Array.isArray(g.mapaCategorias)) {
    for (const [web, id] of Object.entries(g.mapaCategorias)) if (web && /^\d{1,6}$/.test(String(id))) salida.mapaCategorias[web] = String(id);
  }
  return salida;
}

/**
 * Lo que hay GUARDADO de atributos web y equivalencias (sin los enlaces por defecto en memoria). Si todavía no hay
 * equivalencias guardadas, se parte del formato anterior. Lo usan las acciones de guardado de Configuración.
 */
async function getBaseIntegracion(mapaLegado) {
  let crudoCatalogo = null;
  let crudoEq = null;
  let legado = mapaLegado;
  let disponibles = (defaults.categorias || []).map((x) => x.id);
  try {
    const filas = await query("select clave, valor from configuracion where clave = any($1)", [[CLAVE_ATRIBUTOS, CLAVE_EQUIVALENCIAS, CLAVE]]);
    for (const f of filas) {
      if (f.clave === CLAVE_ATRIBUTOS) crudoCatalogo = f.valor;
      if (f.clave === CLAVE_EQUIVALENCIAS) crudoEq = f.valor;
      if (f.clave === CLAVE) {
        const c = combinar(f.valor);
        if (legado === undefined) legado = c.mapaCategorias;
        disponibles = (c.categorias || []).map((x) => x.id);
      }
    }
  } catch {
    crudoCatalogo = null;
    crudoEq = null;
  }
  let eq = normalizarEquivalencias(crudoEq);
  // Aún no hay equivalencias guardadas: se parte del formato anterior (una categoría SAGA por categoría web y `sagaCampo`).
  if (crudoEq === null || crudoEq === undefined) eq = migrarDesdeLegado(eq, { mapaCategorias: legado || {}, catalogoCrudo: crudoCatalogo, categoriasDisponibles: disponibles });
  return { equivalencias: eq, catalogo: normalizarCatalogo(crudoCatalogo) };
}

async function getOpcionesSaga() {
  let salida;
  try {
    const [fila] = await query("select valor from configuracion where clave = $1", [CLAVE]);
    salida = combinar(fila?.valor);
  } catch {
    salida = combinar(null);
  }
  salida.marcas = await getMapaMarcasSaga();
  // Atributos web por categoría (Configuración → Integraciones → Web) y equivalencias con las plataformas.
  const base = await getBaseIntegracion(salida.mapaCategorias);
  const eq = base.equivalencias;
  // Los campos de SAGA que se usan y no tienen atributo web equivalente reciben uno con el mismo nombre (en memoria).
  const completo = completarPorDefecto(eq, base.catalogo, salida.categorias);
  salida.atributosCategoria = completo.catalogo;
  salida.equivalencias = completo.equivalencias;
  // Campos de SAGA que se usan por categoría = los marcados antes + los enlazados a un atributo web.
  salida.categorias = salida.categorias.map((c) => {
    const base = Array.isArray(c.extras) ? c.extras : PREDETERMINADOS[c.id] || [];
    const enlazados = new Set();
    for (const web of Object.keys(completo.equivalencias.categorias)) {
      for (const id of camposEnlazados(completo.equivalencias, web, "saga", c.id)) enlazados.add(id);
    }
    const validos = new Set(camposDe(c.id).map((x) => x.id));
    return { ...c, extras: [...new Set([...base, ...enlazados])].filter((x) => validos.has(x)) };
  });
  // Compatibilidad: primera categoría SAGA equivalente de cada categoría web.
  salida.mapaCategorias = Object.fromEntries(
    Object.entries(completo.equivalencias.categorias).filter(([, p]) => p.saga && p.saga.length).map(([web, p]) => [web, p.saga[0]])
  );
  return salida;
}

module.exports = { getOpcionesSaga, getBaseIntegracion, IDS_BASE, CLAVE, CLAVE_ATRIBUTOS, CLAVE_EQUIVALENCIAS, OPCIONES_PREDETERMINADAS: defaults };
