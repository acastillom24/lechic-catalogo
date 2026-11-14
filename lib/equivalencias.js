/**
 * Equivalencias entre la web y las plataformas externas (módulo de datos puros: servidor y cliente).
 *
 * La WEB es la fuente: define sus categorías y sus atributos. Cada plataforma (SAGA hoy, Intercorp mañana) solo aporta
 * equivalencias, guardadas en la clave `equivalencias` de la tabla `configuracion`:
 *
 *   {
 *     plataformas: [{ id: "saga", nombre: "SAGA" }],
 *     categorias:  { "<categoría web>": { saga: ["1735", ...] } },            // varias por plataforma
 *     atributos:   { "<categoría web>": { saga: { "<categoría SAGA>": { "<campo SAGA>": "<atributo web>" } } } }
 *   }
 *
 * El atributo web conserva su propio nombre (Configuración → Integraciones → Web); cada plataforma lo enlaza al campo que
 * en ella signifique lo mismo (en SAGA «Acabado», en otra tal vez «término»).
 */
const { camposDe, camposActivos } = require("./saga-campos");
const { atributosDe, compatible, idDeEtiqueta, camposEnlazables, UBICACIONES } = require("./atributos-categoria");
const { CAMPOS_WEB, CATEGORIAS_PERFUME, porId, esLibre, esReasignable, LISTA_DE_CAMPO } = require("./campos-web");

const PLATAFORMAS_BASE = [{ id: "saga", nombre: "SAGA" }];
const ID_PLATAFORMA = /^[a-z0-9_]{1,30}$/;
const ID_CATEGORIA = /^[A-Za-z0-9_-]{1,40}$/;
const ID_CAMPO = /^[A-Za-z0-9_]{1,60}$/;

const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** Plataformas registradas: SAGA siempre primera, más las que se agreguen (id en minúsculas y nombre). */
function normalizarPlataformas(lista) {
  const salida = PLATAFORMAS_BASE.map((p) => ({ ...p }));
  for (const p of Array.isArray(lista) ? lista : []) {
    const id = String(p?.id || "");
    const nombre = String(p?.nombre || "").trim().slice(0, 40);
    if (!ID_PLATAFORMA.test(id) || !nombre || salida.some((x) => x.id === id)) continue;
    salida.push({ id, nombre });
  }
  return salida;
}

/** Deja `equivalencias` con la forma válida; lo guardado a mano o antiguo no rompe nada. */
function normalizarEquivalencias(crudo) {
  const g = esObjeto(crudo) ? crudo : {};
  const plataformas = normalizarPlataformas(g.plataformas);
  const ids = new Set(plataformas.map((p) => p.id));

  const categorias = {};
  for (const [web, porPlat] of Object.entries(esObjeto(g.categorias) ? g.categorias : {})) {
    if (!esObjeto(porPlat)) continue;
    for (const [plat, lista] of Object.entries(porPlat)) {
      if (!ids.has(plat)) continue;
      const cats = [...new Set((Array.isArray(lista) ? lista : [lista]).map((x) => String(x ?? "").trim()).filter((x) => ID_CATEGORIA.test(x)))];
      if (cats.length) (categorias[web] ||= {})[plat] = cats;
    }
  }

  const atributos = {};
  for (const [web, porPlat] of Object.entries(esObjeto(g.atributos) ? g.atributos : {})) {
    if (!esObjeto(porPlat)) continue;
    for (const [plat, porCat] of Object.entries(porPlat)) {
      if (!ids.has(plat) || !esObjeto(porCat)) continue;
      for (const [cat, campos] of Object.entries(porCat)) {
        if (!ID_CATEGORIA.test(cat) || !esObjeto(campos)) continue;
        const limpios = {};
        for (const [campo, attr] of Object.entries(campos)) {
          if (ID_CAMPO.test(campo) && ID_CAMPO.test(String(attr || ""))) limpios[campo] = String(attr);
        }
        if (Object.keys(limpios).length) (((atributos[web] ||= {})[plat] ||= {})[cat] = limpios);
      }
    }
  }

  // Equivalencia de los campos propios de la web (los que traen la equivalencia de SAGA marcada): { web: { plat: { campoWeb: campoPlataforma | "" } } }.
  // Ausente = la predeterminada; "" = no enviarlo a esa plataforma.
  const fijos = {};
  for (const [web, porPlat] of Object.entries(esObjeto(g.fijos) ? g.fijos : {})) {
    if (!esObjeto(porPlat)) continue;
    for (const [plat, campos] of Object.entries(porPlat)) {
      if (!ids.has(plat) || !esObjeto(campos)) continue;
      for (const [campoWeb, campoPlat] of Object.entries(campos)) {
        const v = String(campoPlat ?? "");
        if (porId(campoWeb) && (v === "" || ID_CAMPO.test(v))) (((fijos[web] ||= {})[plat] ||= {})[campoWeb] = v);
      }
    }
  }

  // Configuración propia de cada categoría web (hoy: si permite variantes). Ausente = se deduce (ver permiteVariantesWeb).
  // Campos que SAGA lista en el catálogo de una categoría (Características, Género…), activados o no en ella: { catSaga: { campoWeb: boolean } }.
  const camposCategoria = {};
  // Reasignación de campos generales de SAGA a otro campo general de la web: { campoSaga: campoWeb } (ausente = el predeterminado).
  const equivGenerales = {};
  for (const [campoSaga, webId] of Object.entries(esObjeto(g.equivGenerales) ? g.equivGenerales : {})) {
    const destino = porId(String(webId));
    const origen = CAMPOS_WEB.find((c) => c.saga === campoSaga);
    if (origen && esReasignable(origen) && String(webId) === "") equivGenerales[campoSaga] = ""; // sin equivalente: no se envía
    else if (origen && destino && esReasignable(origen) && esReasignable(destino) && origen.tipo === destino.tipo && origen.id !== destino.id) equivGenerales[campoSaga] = destino.id;
  }
  // Nombre con el que la web muestra cada campo general (editable): { campoWeb: { etiqueta } } (ausente = el predeterminado).
  const camposWeb = {};
  for (const [id, c] of Object.entries(esObjeto(g.camposWeb) ? g.camposWeb : {})) {
    const def = porId(id);
    const etiqueta = esObjeto(c) ? String(c.etiqueta || "").trim().slice(0, 60) : "";
    // Opciones (lista de valores válidos) de los campos de tipo lista: se definen en la web y reemplazan a las listas de SAGA guardadas.
    const opciones = def && LISTA_DE_CAMPO[def.id] && esObjeto(c) && Array.isArray(c.opciones)
      ? [...new Set(c.opciones.map((o) => String(o).trim()).filter((o) => o && o.length <= 100))].slice(0, 1000)
      : [];
    if (!def || !def.saga) continue;
    const entrada = {};
    if (etiqueta && etiqueta !== def.etiqueta) entrada.etiqueta = etiqueta;
    if (opciones.length) entrada.opciones = opciones;
    // Dónde va un campo que SAGA lista por categoría: «Atributos» o «Variantes» (la Cantidad va en Variantes por defecto). Solo se guarda si no es el predeterminado.
    if (def.porSaga && esObjeto(c) && UBICACIONES.includes(c.ubicacion) && c.ubicacion !== (def.id === "volumen" ? "variantes" : "atributos")) entrada.ubicacion = c.ubicacion;
    // Largo mínimo/máximo (texto y número) y «obligatorio»: se definen en la web y mandan en las validaciones.
    const entero = (x) => (Number.isInteger(Number(x)) && Number(x) > 0 && Number(x) <= 1000 ? Number(x) : null);
    if (esObjeto(c) && (def.tipo === "texto" || def.tipo === "numero")) {
      const mn = entero(c.min);
      const mx = entero(c.max);
      if (mn && !(mx && mn > mx)) entrada.min = mn;
      // El máximo de la web puede ser más estricto que el de SAGA, nunca más flojo.
      if (mx && mx !== def.max) entrada.max = def.max ? Math.min(mx, def.max) : mx;
    }
    if (esObjeto(c) && c.obligatorio === true && !def.obligatorioSaga) entrada.obligatorio = true;
    if (Object.keys(entrada).length) camposWeb[id] = entrada;
  }
  for (const [cat, campos] of Object.entries(esObjeto(g.camposCategoria) ? g.camposCategoria : {})) {
    if (!ID_CATEGORIA.test(cat) || !esObjeto(campos)) continue;
    for (const [id, v] of Object.entries(campos)) {
      const def = porId(id);
      if (def && def.porSaga && esLibre(def) && typeof v === "boolean") (camposCategoria[cat] ||= {})[id] = v;
    }
  }
  // `generales`: campos generales libres (Modelo, País, Contenido) activados/desactivados en esa categoría web { campoWeb: boolean }.
  const configCategorias = {};
  for (const [web, c] of Object.entries(esObjeto(g.configCategorias) ? g.configCategorias : {})) {
    if (!esObjeto(c)) continue;
    const generales = {};
    for (const [id, v] of Object.entries(esObjeto(c.generales) ? c.generales : {})) {
      const def = porId(id);
      if (!def || !esLibre(def) || typeof v !== "boolean") continue;
      generales[id] = v;
    }
    const salida = {};
    if (typeof c.variantes === "boolean") salida.variantes = c.variantes;
    if (Object.keys(generales).length) salida.generales = generales;
    if (Object.keys(salida).length) configCategorias[web] = salida;
  }
  return { plataformas, categorias, atributos, fijos, configCategorias, camposCategoria, equivGenerales, camposWeb };
}

/** Categorías de la plataforma que equivalen a una categoría web. */
const categoriasDePlataforma = (eq, webSlug, plataforma = "saga") => (eq && eq.categorias && eq.categorias[webSlug] && eq.categorias[webSlug][plataforma]) || [];

/** Ids de campos de la plataforma ya enlazados a un atributo web de (categoría web, categoría de la plataforma). */
const camposEnlazados = (eq, webSlug, plataforma, catId) =>
  new Set(Object.keys((eq && eq.atributos && eq.atributos[webSlug] && eq.atributos[webSlug][plataforma] && eq.atributos[webSlug][plataforma][String(catId)]) || {}));

/**
 * Primera lectura tras el cambio de modelo (todavía no hay `equivalencias` guardadas): se toma lo que había en el formato
 * anterior — `saga_opciones.mapaCategorias` (una categoría SAGA por categoría web) y el `sagaCampo` de cada atributo web.
 */
// Categorías de SAGA que se sugieren por categoría web mientras no haya nada guardado (solo las que están en la lista de categorías).
const CATEGORIAS_SUGERIDAS = {
  feminine: ["1735"],
  masculine: ["1735"],
  couples: ["1735"],
  perfumery: ["1735"],
  "make-up": ["2945", "1332", "320"],
  hair: ["770", "3190"],
  "personal-care": ["948", "2257", "3064", "669", "2763", "1937"],
};

function migrarDesdeLegado(eq, { mapaCategorias, catalogoCrudo, categoriasDisponibles = [] }) {
  const salida = {
    plataformas: eq.plataformas,
    categorias: JSON.parse(JSON.stringify(eq.categorias)),
    atributos: JSON.parse(JSON.stringify(eq.atributos)),
    fijos: JSON.parse(JSON.stringify(eq.fijos || {})),
    configCategorias: JSON.parse(JSON.stringify(eq.configCategorias || {})),
    camposCategoria: JSON.parse(JSON.stringify(eq.camposCategoria || {})),
    equivGenerales: JSON.parse(JSON.stringify(eq.equivGenerales || {})),
    camposWeb: JSON.parse(JSON.stringify(eq.camposWeb || {})),
  };
  for (const [web, id] of Object.entries(esObjeto(mapaCategorias) ? mapaCategorias : {})) {
    const cats = (Array.isArray(id) ? id : [id]).map((x) => String(x)).filter((x) => ID_CATEGORIA.test(x));
    if (cats.length && !categoriasDePlataforma(salida, web, "saga").length) (salida.categorias[web] ||= {}).saga = cats;
  }
  // Sin nada guardado ni formato anterior: se sugieren las categorías de SAGA habituales (si están en la lista de categorías).
  const disponibles = new Set(categoriasDisponibles.map(String));
  for (const [web, sugeridas] of Object.entries(CATEGORIAS_SUGERIDAS)) {
    const utiles = sugeridas.filter((c) => disponibles.has(c));
    if (utiles.length && !categoriasDePlataforma(salida, web, "saga").length) (salida.categorias[web] ||= {}).saga = utiles;
  }
  for (const [web, attrs] of Object.entries(esObjeto(catalogoCrudo) ? catalogoCrudo : {})) {
    for (const a of Array.isArray(attrs) ? attrs : []) {
      const campo = String(a?.sagaCampo || "");
      const attrId = String(a?.id || idDeEtiqueta(a?.etiqueta));
      if (!campo || !ID_CAMPO.test(attrId)) continue;
      for (const cat of categoriasDePlataforma(salida, web, "saga")) {
        if (!camposDe(cat).some((c) => c.id === campo)) continue;
        const mapa = (((salida.atributos[web] ||= {}).saga ||= {})[cat] ||= {});
        if (!mapa[campo]) mapa[campo] = attrId;
      }
    }
  }
  return salida;
}

/**
 * Enlace por defecto: cada campo de SAGA que se usa en la categoría (obligatorio o marcado) y aún no tiene atributo web
 * equivalente recibe, EN MEMORIA, un atributo web con el mismo nombre (etiqueta, tipo y opciones del campo). Se marca
 * `virtual: true` y se vuelve real cuando se guarda Configuración. Así el formulario nunca queda sin esos campos.
 * Devuelve { catalogo, equivalencias } nuevos (no modifica los recibidos).
 */
function completarPorDefecto(eq, catalogo, categoriasSaga) {
  const cat = JSON.parse(JSON.stringify(catalogo || {}));
  const out = JSON.parse(JSON.stringify(eq));
  for (const web of Object.keys(out.categorias)) {
    for (const catId of categoriasDePlataforma(out, web, "saga")) {
      const enlazados = camposEnlazados(out, web, "saga", catId);
      for (const campo of camposActivos(catId, categoriasSaga)) {
        if (enlazados.has(campo.id)) continue;
        const lista = (cat[web] ||= []);
        let id = idDeEtiqueta(campo.etiqueta) || campo.id.toLowerCase();
        // Si ya hay un atributo web compatible con ese nombre exacto, se enlaza a ese en vez de crear otro.
        const igual = lista.find((a) => idDeEtiqueta(a.etiqueta) === idDeEtiqueta(campo.etiqueta) && compatible(a, campo));
        if (igual) {
          id = igual.id;
        } else {
          while (lista.some((a) => a.id === id)) id = `${id}_2`;
          lista.push({
            id,
            etiqueta: campo.etiqueta,
            tipo: campo.tipo,
            opciones: campo.tipo === "texto" || campo.tipo === "numero" ? [] : [...(campo.opciones || [])],
            grupo: "detalles",
            virtual: true,
          });
        }
        (((out.atributos[web] ||= {}).saga ||= {})[catId] ||= {})[campo.id] = id;
      }
    }
  }
  return { catalogo: cat, equivalencias: out };
}

const clon = (x) => JSON.parse(JSON.stringify(x));

/** Atributo web nuevo a partir de un campo de la plataforma (mismo nombre, tipo compatible y opciones); reutiliza uno igual si ya existe. */
function atributoDesdeCampo(lista, campo) {
  const igual = lista.find((a) => idDeEtiqueta(a.etiqueta) === idDeEtiqueta(campo.etiqueta) && compatible(a, campo));
  if (igual) return igual.id;
  let id = idDeEtiqueta(campo.etiqueta) || String(campo.id).toLowerCase();
  while (lista.some((a) => a.id === id)) id = `${id}_2`;
  lista.push({
    id,
    etiqueta: campo.etiqueta,
    tipo: campo.tipo,
    opciones: campo.tipo === "texto" || campo.tipo === "numero" ? [] : [...(campo.opciones || [])],
    grupo: "detalles",
  });
  return id;
}

/**
 * Aplica el formulario de Configuración → Integraciones → SAGA. Las equivalencias se eligen UNA vez por categoría de SAGA
 * (el atributo es único en la web): el atributo elegido para cada campo ("" = no usar) se aplica a todas las categorías web
 * que usan esa categoría de SAGA donde el atributo esté visible. Solo valen atributos visibles en alguna de ellas (no se crean
 * aquí); un obligatorio sin elegir queda pendiente y se avisa en pantalla. Actualiza `categorias[].extras` (campos usados).
 * `form` = { has, get }. Devuelve { equivalencias, catalogo } nuevos; lanza Error con un mensaje para el usuario si algo no es válido.
 */
function aplicarFormularioSaga(base, categorias, form) {
  const eq = clon(base.equivalencias);
  const catalogo = clon(base.catalogo);
  // Campos generales: equivalente elegido para cada campo de SAGA (solo si el formulario trae la sección).
  if (form.has("eqGenMarca")) {
    const nuevo = {};
    for (const def of CAMPOS_WEB.filter(esReasignable)) {
      const v = String(form.get(`eqGen__${def.saga}`) ?? def.id);
      if (v === "") {
        nuevo[def.saga] = "";
        continue;
      }
      const destino = porId(v);
      if (!destino || !esReasignable(destino) || destino.tipo !== def.tipo) throw new Error(`Campos generales, «${def.saga}»: el atributo «${v}» no es válido para ese campo.`);
      if (v !== def.id) nuevo[def.saga] = v;
    }
    eq.equivGenerales = nuevo;
  }
  // Categorías de la web que equivalen a cada categoría de SAGA (se eligen desde SAGA): se actualizan antes de las equivalencias de atributos.
  for (const c of categorias) {
    const clave = `catsWeb_${c.id}`;
    if (!form.has(clave)) continue;
    let lista;
    try {
      lista = JSON.parse(String(form.get(clave) || "[]"));
    } catch {
      throw new Error(`Categoría ${c.id}: no se pudieron leer las categorías de la web.`);
    }
    const elegidas = new Set((Array.isArray(lista) ? lista : []).map(String).filter((x) => !form.slugsWeb || form.slugsWeb.has(x)));
    for (const web of Object.keys(eq.categorias)) {
      if (!(eq.categorias[web].saga || []).includes(c.id) || elegidas.has(web)) continue;
      eq.categorias[web].saga = eq.categorias[web].saga.filter((x) => x !== c.id);
      if (!eq.categorias[web].saga.length) delete eq.categorias[web].saga;
      if (!Object.keys(eq.categorias[web]).length) delete eq.categorias[web];
      if (eq.atributos && eq.atributos[web] && eq.atributos[web].saga) delete eq.atributos[web].saga[c.id]; // ya no se cruza: sus enlaces dejan de valer
    }
    for (const web of elegidas) {
      const o = (eq.categorias[web] ||= {});
      if (!(o.saga || []).includes(c.id)) o.saga = [...(o.saga || []), c.id];
    }
  }
  for (const c of categorias) {
    const campos = camposEnlazables(c.id);
    const webs = Object.keys(eq.categorias).filter((w) => categoriasDePlataforma(eq, w, "saga").includes(c.id));
    const extras = [];
    if (!form.has(`eqMarca_${c.id}`)) {
      for (const web of webs) extras.push(...Object.keys((eq.atributos[web] && eq.atributos[web].saga && eq.atributos[web].saga[c.id]) || {}));
      c.extras = [...new Set(extras)];
      continue;
    }
    if (!webs.length) {
      c.extras = [];
      continue;
    }
    const elegido = {};
    for (const campo of campos) {
      const v = String(form.get(`eq_${c.id}__${campo.id}`) || "");
      if (!v) continue;
      const a = webs.map((w) => atributosDe(catalogo, w).find((x) => x.id === v)).find(Boolean);
      if (!a) throw new Error(`Categoría ${c.id}, «${campo.etiqueta}»: el atributo web «${v}» no está visible en ninguna categoría de la web que use esta categoría.`);
      // Un tipo distinto no bloquea: la pantalla de SAGA avisa y al enviar se omiten los valores que SAGA no aceptaría.
      elegido[campo.id] = v;
    }
    // Campos que SAGA lista en esta categoría (Características, Género…): activos o no. Los obligatorios siempre.
    for (const def of CAMPOS_WEB.filter((d) => d.porSaga && esLibre(d))) {
      if (!camposDe(c.id).some((x) => x.id === def.saga)) continue;
      ((eq.camposCategoria ||= {})[c.id] ||= {})[def.id] = form.get(`gen_${c.id}__${def.id}`) === "1";
    }
    const usados = Object.values(elegido);
    const repetido = usados.find((x, i) => usados.indexOf(x) !== i);
    if (repetido) throw new Error(`Categoría ${c.id}: el atributo web «${repetido}» está enlazado a más de un campo de SAGA.`);
    for (const web of webs) {
      const nuevo = Object.fromEntries(Object.entries(elegido).filter(([, attr]) => atributosDe(catalogo, web).some((x) => x.id === attr)));
      const porPlat = ((eq.atributos[web] ||= {}).saga ||= {});
      if (Object.keys(nuevo).length) porPlat[c.id] = nuevo;
      else delete porPlat[c.id];
      extras.push(...Object.keys(nuevo));
    }
    c.extras = [...new Set(extras)];
  }
  return { equivalencias: eq, catalogo };
}

/** Campos usados por categoría de SAGA según las equivalencias: { catId: [campos] } (lo que va en `categorias[].extras`). */
function extrasPorCategoria(eq) {
  const salida = {};
  for (const porPlat of Object.values(eq.atributos || {})) {
    for (const [cat, campos] of Object.entries((porPlat && porPlat.saga) || {})) (salida[cat] ||= new Set()), Object.keys(campos).forEach((k) => salida[cat].add(k));
  }
  return Object.fromEntries(Object.entries(salida).map(([k, v]) => [k, [...v]]));
}

/**
 * Campo de la plataforma con el que se envía un campo propio de la web: lo elegido o, si no se tocó, la equivalencia ya
 * marcada (hoy solo SAGA). "" = no se envía. Los campos «clave» siempre usan la predeterminada.
 */
function campoFijo(eq, webSlug, plataforma, campoWebId) {
  const def = porId(campoWebId);
  if (!def) return "";
  const base = plataforma === "saga" ? def.saga : "";
  if (def.clave) return base;
  const elegido = eq && eq.fijos && eq.fijos[webSlug] && eq.fijos[webSlug][plataforma] && eq.fijos[webSlug][plataforma][campoWebId];
  return elegido === undefined || elegido === null ? base : elegido;
}

/**
 * ¿La categoría web permite variantes? Se decide en Integraciones → Web. Sin elección: no si todas sus categorías de SAGA
 * lo prohíben (Perfumes 1735 por defecto) o, sin equivalencias, si es perfumería; en otro caso sí.
 */
function permiteVariantesWeb(eq, categoriasSaga, webSlug) {
  const elegido = eq && eq.configCategorias && eq.configCategorias[webSlug];
  if (elegido && typeof elegido.variantes === "boolean") return elegido.variantes;
  const cats = categoriasDePlataforma(eq, webSlug, "saga");
  if (!cats.length) return !CATEGORIAS_PERFUME.includes(webSlug);
  const explicitas = cats.map((id) => ((categoriasSaga || []).find((c) => String(c.id) === String(id)) || {}).variantes);
  // Cualquiera que lo permita (explícito o por defecto) basta; solo se prohíbe si todas lo prohíben.
  return cats.some((id, i) => (typeof explicitas[i] === "boolean" ? explicitas[i] : String(id) !== "1735"));
}

/** ¿La categoría web es de perfumería? Por sus categorías de SAGA (1735) o, sin equivalencias, por ser perfumería web. */
function esPerfumeWeb(eq, webSlug, cats = categoriasDePlataforma(eq, webSlug, "saga")) {
  const lista = (cats || []).map(String);
  return lista.includes("1735") || (!lista.length && CATEGORIAS_PERFUME.includes(webSlug));
}

/**
 * ¿Un campo que SAGA lista en el catálogo de una categoría está activo en ella? Lo elegido en Integraciones → SAGA o, sin elección,
 * activo si SAGA lo pide (obligatorio) o la categoría es perfumes (1735). Dejar un obligatorio sin equivalente bloquea el envío (validarProducto). Una categoría que no lo trae no lo usa.
 */
function activoEnCategoriaSaga(eq, cat, def) {
  const campo = camposDe(cat).find((c) => c.id === def.saga);
  if (String(cat) !== "1735" && !campo) return false;
  const elegido = eq && eq.camposCategoria && eq.camposCategoria[String(cat)] && eq.camposCategoria[String(cat)][def.id];
  if (typeof elegido === "boolean") return elegido;
  // Sin elección en SAGA: activo si SAGA lo pide, si es perfumes, o si alguna categoría web cruzada con ésta lo muestra expresamente.
  const visibleEnWeb = Object.entries((eq && eq.categorias) || {}).some(
    ([web, p]) => ((p && p.saga) || []).map(String).includes(String(cat)) && eq.configCategorias && eq.configCategorias[web] && eq.configCategorias[web].generales && eq.configCategorias[web].generales[def.id] === true
  );
  return Boolean(campo && campo.obligatorio) || String(cat) === "1735" || visibleEnWeb;
}

/**
 * ¿Un campo general está activo en la categoría web? Los bloqueados (`clave`) siempre. Los generales libres (Modelo, País,
 * Contenido del paquete): lo elegido en Integraciones → Web o activo. Los que dependen de la categoría de SAGA (`porSaga`):
 * activo si lo está en alguna de sus categorías de SAGA (`cats`, por omisión las equivalentes de la categoría web).
 */
function campoGeneralActivo(eq, webSlug, def, cats) {
  if (!def) return false;
  if (!esLibre(def)) return true;
  const lista = (cats || categoriasDePlataforma(eq, webSlug, "saga")).map(String);
  const elegido = eq && eq.configCategorias && eq.configCategorias[webSlug] && eq.configCategorias[webSlug].generales && eq.configCategorias[webSlug].generales[def.id];
  if (typeof elegido === "boolean") return elegido;
  if (!def.porSaga) return true;
  // Sin elección en la web: se muestra si algún cruce con SAGA lo usa (o, sin cruces, en perfumería).
  return lista.length ? lista.some((c) => activoEnCategoriaSaga(eq, c, def)) : esPerfumeWeb(eq, webSlug, lista);
}

/** Campo general de la web cuyo valor se envía en el campo de SAGA `campoSaga` (el predeterminado, el reasignado o ninguno). */
function destinoGeneral(eq, campoSaga) {
  const o = (eq && eq.equivGenerales) || {};
  if (Object.prototype.hasOwnProperty.call(o, campoSaga)) return o[campoSaga] === "" ? null : porId(o[campoSaga]) || null;
  return CAMPOS_WEB.find((c) => c.saga === campoSaga) || null;
}

/** Nombre con el que se muestra un campo general de la web (el editado en Integraciones → Web o el predeterminado). */
const etiquetaCampo = (eq, def) => (def && eq && eq.camposWeb && eq.camposWeb[def.id] && eq.camposWeb[def.id].etiqueta) || (def && def.etiqueta) || "";

/** Campo de SAGA que recibe el valor de un campo general de la web ("" si ninguno). */
function referenciaDe(eq, webId) {
  const def = porId(webId);
  if (!def) return "";
  const o = (eq && eq.equivGenerales) || {};
  const explicito = Object.keys(o).find((k) => o[k] === webId);
  if (explicito) return explicito;
  return Object.prototype.hasOwnProperty.call(o, def.saga) ? "" : def.saga;
}

/**
 * Pone el campo de SAGA que recibe un campo general de la web (referencia). Devuelve el `equivGenerales` nuevo. El campo de SAGA que
 * recibía antes su valor queda «sin equivalente» salvo que otro campo de la web lo cubra.
 */
function fijarReferencia(eqGenerales, webId, campoSaga) {
  const def = porId(webId);
  const o = { ...(eqGenerales || {}) };
  if (!def) return o;
  for (const k of Object.keys(o)) if (o[k] === webId) delete o[k];
  const propio = def.saga;
  if (!campoSaga) {
    if (!Object.prototype.hasOwnProperty.call(o, propio)) o[propio] = "";
    return o;
  }
  if (campoSaga === propio) {
    if (o[propio] === "") delete o[propio];
    return o;
  }
  o[campoSaga] = webId;
  if (!Object.prototype.hasOwnProperty.call(o, propio)) o[propio] = "";
  return o;
}

/** ¿SAGA admite el campo general en esa categoría? Los `base` en todas; el resto, en perfumes (1735) o si el catálogo de la categoría lo trae. */
function sagaAdmite(def, sagaCat) {
  if (!def || !def.saga) return false;
  if (def.base || !esLibre(def) || !sagaCat) return true;
  return String(sagaCat) === "1735" || camposDe(sagaCat).some((c) => c.id === def.saga);
}

/**
 * Aplica a un envío ya armado la equivalencia elegida para los campos propios de la web: la clave de ProductData que usa
 * por defecto cada campo pasa al campo elegido, o se quita si se eligió «No enviar». Devuelve el mismo objeto.
 */
function renombrarFijos(datos, eq, webSlug, plataforma = "saga") {
  const pd = datos && datos.productData;
  if (!pd) return datos;
  const destino = {};
  for (const c of CAMPOS_WEB) if (!c.clave && c.saga) destino[c.saga] = campoFijo(eq, webSlug, plataforma, c.id);
  const salida = {};
  for (const [clave, valor] of Object.entries(pd)) {
    const nueva = Object.prototype.hasOwnProperty.call(destino, clave) ? destino[clave] : clave;
    if (nueva) salida[nueva] = valor;
  }
  datos.productData = salida;
  return datos;
}

/** ¿El atributo web está enlazado a algún campo de alguna plataforma? (para avisar antes de quitarlo) */
function atributoEnUso(eq, webSlug, atributoId) {
  for (const porCat of Object.values((eq && eq.atributos && eq.atributos[webSlug]) || {})) {
    for (const campos of Object.values(porCat)) if (Object.values(campos).includes(atributoId)) return true;
  }
  return false;
}

module.exports = {
  PLATAFORMAS_BASE,
  normalizarPlataformas,
  normalizarEquivalencias,
  categoriasDePlataforma,
  camposEnlazados,
  migrarDesdeLegado,
  completarPorDefecto,
  atributoEnUso,
  campoFijo,
  renombrarFijos,
  permiteVariantesWeb,
  esPerfumeWeb,
  activoEnCategoriaSaga,
  destinoGeneral,
  etiquetaCampo,
  referenciaDe,
  fijarReferencia,
  campoGeneralActivo,
  sagaAdmite,
  CAMPOS_WEB,
  atributoDesdeCampo,
  aplicarFormularioSaga,
  extrasPorCategoria,
  atributosDe,
};
