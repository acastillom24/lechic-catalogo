"use client";

import { useActionState, useState } from "react";
import { guardarProducto, traerGrupoSaga } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";
import { LIMITES, CALIDAD, GENERO_POR_CATEGORIA, validarProducto } from "../../lib/saga-mapeo";
import { esCategoriaGeneral, camposDe, heredarVariante, imagenesRequeridas, IMAGENES_TOPE } from "../../lib/saga-campos";
import ImagenesVariante from "./ImagenesVariante";
import SelectBuscador from "./SelectBuscador";
import AtributosProducto, { UBICACION_DEFECTO } from "./AtributosProducto";
import GeneralesProducto from "./GeneralesProducto";
import EditorDescripcion from "./EditorDescripcion";
import SelectUnico from "./SelectUnico";
import { atributosDe, extrasConPropios, propiosDesdeSaga, mapaCampos, ubicacionDe } from "../../lib/atributos-categoria";
import { categoriasDePlataforma, permiteVariantesWeb, campoGeneralActivo, sagaAdmite } from "../../lib/equivalencias";
import { CAMPOS_WEB, esLibre } from "../../lib/campos-web";
import { efectivoBase, personalizadosAFila } from "../../lib/atributos-efectivos";
import PackComponentes from "./PackComponentes";

import { IconoMas } from "./Iconos";
import { ATRIBUTOS } from "../../lib/saga-atributos";

// Qué hacer con una variante en una cuenta SAGA. Las acciones de vinculación vienen de Configuración → SAGA.
const AYUDA_FIJA = {
  ninguna: "No se envía ni se cambia nada en este guardado. Si la variante ya estaba sincronizada, el enlace sigue (para cortarlo usa «Dejar de sincronizar»).",
  crear: "Crea el producto en SAGA con todos los datos de la web. Solo si el SKU no existe en esa cuenta: si ya existe, no se pisa nada.",
  desvincular: "Se deja de sincronizar con esta cuenta (no se borra nada en SAGA).",
};
const corto = (x) => x.etiqueta.split(" (")[0];
function ayudaAccion(modo, acciones) {
  if (AYUDA_FIJA[modo]) return AYUDA_FIJA[modo];
  const a = acciones.find((x) => x.id === modo);
  if (!a) return "";
  const envia = ATRIBUTOS.filter((x) => a.atributos.includes(x.id)).map(corto);
  const noToca = ATRIBUTOS.filter((x) => x.grupo === "Sensibles" && !a.atributos.includes(x.id)).map((x) => corto(x).toLowerCase());
  return `El SKU ya debe existir en SAGA. En cada guardado envía: ${envia.join(", ") || "nada"}.${noToca.length ? ` No toca: ${noToca.join(", ")}.` : ""}`;
}

// La clave de la variante inicial es fija (no aleatoria) para que el HTML del servidor y el del navegador coincidan.
function nuevaVariante(key = Math.random().toString(36).slice(2)) {
  return {
    key,
    nombre: "",
    precio: "",
    precioOferta: "",
    stock: true,
    imagenes: [],
    id: null,
    sku: "",
    stockMinimo: 0,
    costo: "",
    activo: true,
    stockActual: null,
    stockCantidad: "",
    esPack: false,
    componentes: [],
    stockPack: 0,
    codigoBarras: "",
    // Atributos que esta variante personaliza (solo claves con valor); el resto lo hereda del producto.
    attrs: {},
    sagaCombinarNombre: true,
    preciosSaga: {},
    acciones: {},
  };
}

export default function ProductoForm({ modo, marcas, pestanas = [], producto, accionGuardar, restringido = false, permitirSaga = false, cuentasSaga = [], sincronizadas = [], variantesSincronizadas = [], estadoSync = {}, preciosCanal = {}, paquetesCuenta = {}, categoriasCuenta = {}, opcionesSaga = {}, variantesPack = [] }) {
  const [estado, accion, enviando] = useActionState(accionGuardar || guardarProducto, {});

  const [id, setId] = useState(producto?.id || "");
  const [idTocadoManualmente] = useState(modo === "editar");
  // Al crear no hay marca elegida (se elige a mano o «Traer de SAGA» la completa).
  const [marca, setMarca] = useState(producto?.marca || "");
  // Pestaña (ubicación en la web): independiente de la marca (la de SAGA). Al elegir marca se
  // autoselecciona su pestaña por defecto, pero se puede cambiar.
  const [pestana, setPestana] = useState(
    producto?.pestana || marcas.find((m) => m.slug === (producto?.marca || marcas[0]?.slug))?.pestanaDefault || pestanas[0]?.slug || ""
  );
  const pestanaObj = pestanas.find((p) => p.slug === pestana);
  const categorias = pestanaObj?.categorias || [];
  // Al crear no hay categoría elegida: es obligatoria y define los atributos.
  const [categoria, setCategoria] = useState(producto?.categoria || "");
  // Si el producto guardado usa una marca/pestaña/categoría que ya no está configurada, se muestra tal cual
  // para no cambiarla en silencio al guardar.
  const marcasOpc = marcas.some((m) => m.slug === marca) || !marca ? marcas : [...marcas, { slug: marca, nombre: `${marca} (no configurada)` }];
  const pestanasOpc = pestanas.some((p) => p.slug === pestana) || !pestana ? pestanas : [...pestanas, { slug: pestana, nombre: `${pestana} (no configurada)` }];
  const categoriasOpc = categorias.some((c) => c.slug === categoria) || !categoria ? categorias : [...categorias, { slug: categoria, nombre: `${categoria} (no activa en esta pestaña)` }];
  const [nombre, setNombre] = useState(producto?.nombre || "");
  // Un producto con una sola variante que aún guardaba su descripción en la variante (antes «Descripción para plataformas») la recupera aquí.
  const [descripcion, setDescripcion] = useState(
    producto?.descripcion || (producto?.variantes?.length === 1 ? producto.variantes[0].attrs?.descripcion : "") || ""
  );
  const [destacado, setDestacado] = useState(!!producto?.destacado);

  const sg = producto?.saga || {};
  // Producto con una sola variante cuyos datos aún estaban en la variante
  // (antes de la migración): se muestran en el producto para que no queden campos vacíos ni valores ocultos.
  const deVariante = producto?.variantes?.length === 1 ? producto.variantes[0].attrs || {} : {};
  const [saga, setSaga] = useState({
    // Producto nuevo: la categoría SAGA se preselecciona con la equivalencia de Configuración para su categoría web.
    // Producto nuevo: si la categoría web tiene una sola equivalente en SAGA (Integraciones → Web) se preselecciona.
    sagaCategoria: sg.sagaCategoria || (modo === "crear" && categoriasDePlataforma(opcionesSaga.equivalencias, categoria, "saga").length === 1 ? categoriasDePlataforma(opcionesSaga.equivalencias, categoria, "saga")[0] : ""),
    skuPadre: sg.skuPadreWeb || "",
    usarSkuPadre: sg.usarSkuPadre === true,
    contenidoPaquete: sg.contenidoPaquete || "",
    paqueteAncho: sg.paqueteAncho ?? "",
    paqueteLargo: sg.paqueteLargo ?? "",
    paqueteAlto: sg.paqueteAlto ?? "",
    paquetePeso: sg.paquetePeso ?? "",
    modelo: sg.modelo || "",
    tipoPerfume: sg.tipoPerfume || "",
    paisProduccion: sg.paisProduccion || "Perú",
    genero: sg.genero || "",
    formatoBelleza: sg.formatoBelleza || "Frasco",
    caracteristicas: sg.caracteristicas || "",
    condicion: sg.condicion || "Nuevo",
    extras: sg.extras || {},
    volumen: sg.volumen || deVariante.volumen || "",
    cantidadEmpaque: sg.cantidadEmpaque || deVariante.cantidadEmpaque || "",
    fraganciaPerfume: sg.fraganciaPerfume?.length ? sg.fraganciaPerfume : deVariante.fraganciaPerfume || [],
    notasAromaticas: sg.notasAromaticas || deVariante.notasAromaticas || "",
    // Garantía y envío (campos generales de SAGA).
    nameCn: sg.nameCn || "",
    nameEn: sg.nameEn || "",
    detalleCondicion: sg.detalleCondicion || "",
    detalleGarantia: sg.detalleGarantia || "",
    garantia: sg.garantia || "",
  });
  // Valores generales que heredan las variantes mientras no tengan uno propio.
  const [atributos, setAtributos] = useState({
    registroSanitario: sg.atributos?.registro_sanitario || deVariante.registroSanitario || "",
    varianteExtras: Object.keys(sg.atributos?.variante_extras || {}).length ? sg.atributos.variante_extras : deVariante.varianteExtras || {},
    propios: sg.atributos?.propios || {},
  });
  // Paquete propio por cuenta (solo las que se personalizaron; el resto usa el general del producto).
  const [paquetes] = useState(() =>
    Object.fromEntries(Object.entries(paquetesCuenta).map(([alias, d]) => [alias, { personalizar: true, ...d }]))
  );
  // Categoría primaria propia por cuenta (solo las personalizadas; el resto usa la general): { alias: { personalizar, sagaCategoria, extras, varianteExtras } }.
  const [catCuenta] = useState(() =>
    Object.fromEntries(Object.entries(categoriasCuenta).map(([alias, d]) => [alias, { personalizar: true, ...d }]))
  );
  const [cuentasMarcadas, setCuentasMarcadas] = useState(sincronizadas);
  // Panel visible (Producto y garantía · Atributos · Variantes · Integraciones) y «solo obligatorios» de Garantía y envío.
  const [panel, setPanel] = useState("producto");
  const [soloObl, setSoloObl] = useState(true);
  // Se activa al intentar guardar con datos pendientes para SAGA (se apaga solo cuando ya no falta nada).
  const [intentoBloqueado, setIntentoBloqueado] = useState(false);
  const esPerfume = ["feminine", "masculine", "couples"].includes(categoria);
  const conSaga = (!restringido || permitirSaga) && cuentasSaga.length > 0;
  // Con categoría SAGA elegida manda ella (perfumes = 1735, cualquier otra usa campos extra); sin elegir, la categoría web.
  const sagaGeneral = saga.sagaCategoria ? esCategoriaGeneral(saga.sagaCategoria) : !esPerfume;
  // Campos generales libres activos en esta categoría (Integraciones → Web) y admitidos por su categoría de SAGA.
  const sagaCatEfectiva = saga.sagaCategoria || (esPerfume ? "1735" : "");
  const generales = CAMPOS_WEB.filter(esLibre)
    .filter((d) => campoGeneralActivo(opcionesSaga.equivalencias, categoria, d, sagaCatEfectiva ? [sagaCatEfectiva] : undefined) && sagaAdmite(d, sagaCatEfectiva))
    .map((d) => d.id);
  // Nombres editados de los campos generales (Integraciones → Web → Campos generales).
  const requisitosCampos = opcionesSaga.equivalencias?.camposWeb || {};
  const etiquetasCampos = Object.fromEntries(Object.entries(opcionesSaga.equivalencias?.camposWeb || {}).map(([id, c]) => [id, c.etiqueta]));
  // Variantes y SKU padre solo si la categoría de la web lo permite (Configuración → Integraciones → Web).
  const permiteVar = permiteVariantesWeb(opcionesSaga.equivalencias, opcionesSaga.categorias, categoria);
  // Atributos propios de la categoría web (Configuración → SAGA → Atributos por categoría).
  // Cada atributo propio va en «Atributos» (a nivel de producto) o en «Variantes» (en cada variante): lo elegido en Integraciones → Web o, sin elegir, lo que dice SAGA.
  const atribCategoria = atributosDe(opcionesSaga.atributosCategoria, categoria).map((a) => (a.general ? a : { ...a, ubicacion: ubicacionDe(a, opcionesSaga.equivalencias) }));
  const nombreCategoria = (categoriasOpc.find((c) => c.slug === categoria) || {}).nombre || "la categoría";
  const nombreCategoriaWeb = nombreCategoria;
  // Categorías de SAGA que equivalen a la categoría web (Configuración → Integraciones → Web). Solo se ofrecen esas;
  // si el producto ya tenía otra guardada, se conserva visible para no perderla en silencio.
  const idsEquivalentes = categoriasDePlataforma(opcionesSaga.equivalencias, categoria, "saga");
  const categoriasSagaOpc = (opcionesSaga.categorias || []).filter((c) => idsEquivalentes.includes(String(c.id)) || String(c.id) === String(saga.sagaCategoria));
  const generoActual = saga.genero || GENERO_POR_CATEGORIA[categoria] || "";

  const [variantes, setVariantes] = useState(() =>
    producto?.variantes?.length
      ? producto.variantes.map((v, idx) => ({
          key: `v${idx}`,
          nombre: v.nombre || "",
          precio: v.precio ?? "",
          precioOferta: v.precioOferta ?? "",
          stock: v.stock !== false,
          imagenes: (v.imagenes || []).map((url, j) => ({ key: `i${idx}-${j}`, url })),
          id: v.id ?? null,
          sku: v.sku || "",
          stockMinimo: v.stockMinimo ?? 0,
          costo: v.costo ?? "",
          activo: v.activo !== false,
          stockActual: v.stockActual ?? null,
          stockCantidad: v.stockActual ?? "",
          esPack: v.esPack === true,
          componentes: v.componentes || [],
          stockPack: v.stockPack ?? 0,
          codigoBarras: v.codigoBarras || "",
          attrs: v.attrs || {},
          sagaCombinarNombre: v.sagaCombinarNombre !== false,
          preciosSaga: preciosCanal[v.id] || {},
          // Lo que ya hay registrado por cuenta: vinculada a un SKU de SAGA o creada desde la web.
          acciones: Object.fromEntries(
            Object.entries(estadoSync[v.id] || {}).map(([a, info]) => [
              a,
              // Creada y pendiente → "No enviar" (no crear dos veces); creada con error → "Crear" (reintento).
              info.accion === "crear"
                ? info.estado === "error" ? "crear" : "ninguna"
                : (opcionesSaga.acciones || []).some((x) => x.id === info.accion) ? info.accion : "vincular",
            ])
          ),
        }))
      : [nuevaVariante("v0")]
  );

  // Categoría sin variantes: el producto es una sola ficha (si ya tenía varias de antes, se siguen mostrando todas).
  const sinVariantes = variantes.length <= 1;
  // El paso «SKU padre» solo aplica con 2 o más variantes en una categoría que las admita.
  // Las variantes se agrupan solas (como en SAGA): el SKU padre es el de la primera variante o, si SAGA ya lo confirmó, el que devolvió.
  const usarPadre = !sinVariantes;
  // El padre de SAGA es el SKU de la primera variante (el código que se escribió al crear no existe allá).
  const skuPadreAuto = variantes[0]?.sku || "";
  const nomV = (v) => (sinVariantes && !v.nombre.trim() ? "Único" : v.nombre);
  // Lo ubicado en «Variantes» (Integraciones → Web) se llena en la variante, también cuando es una sola.
  const attrsDe = (v) => v.attrs || {};

  function actualizarVariante(i, cambios) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...cambios } : v)));
  }

  // Atributos del PRODUCTO como un solo objeto (camelCase). Viven repartidos en `saga` y `atributos`.
  const attrsProducto = {
    condicion: saga.condicion, modelo: saga.modelo, paisProduccion: saga.paisProduccion, tipoPerfume: saga.tipoPerfume,
    genero: generoActual, formatoBelleza: saga.formatoBelleza, caracteristicas: saga.caracteristicas,
    contenidoPaquete: saga.contenidoPaquete, paqueteAncho: saga.paqueteAncho, paqueteLargo: saga.paqueteLargo,
    paqueteAlto: saga.paqueteAlto, paquetePeso: saga.paquetePeso,
    nameCn: saga.nameCn, nameEn: saga.nameEn, detalleCondicion: saga.detalleCondicion, detalleGarantia: saga.detalleGarantia, garantia: saga.garantia,
    volumen: saga.volumen, cantidadEmpaque: saga.cantidadEmpaque, fraganciaPerfume: saga.fraganciaPerfume, notasAromaticas: saga.notasAromaticas,
    extras: saga.extras, registroSanitario: atributos.registroSanitario, varianteExtras: atributos.varianteExtras,
    propios: atributos.propios,
  };
  function cambiarAttrsProducto(cambios) {
    const { registroSanitario, varianteExtras, propios, ...deSaga } = cambios;
    if (Object.keys(deSaga).length) setSaga((prev) => ({ ...prev, ...deSaga }));
    const deAtributos = {};
    if (registroSanitario !== undefined) deAtributos.registroSanitario = registroSanitario;
    if (varianteExtras !== undefined) deAtributos.varianteExtras = varianteExtras;
    if (propios !== undefined) deAtributos.propios = propios;
    if (Object.keys(deAtributos).length) setAtributos((prev) => ({ ...prev, ...deAtributos }));
  }
  // Atributos de una variante: solo se guarda lo que tiene valor (lo vacío vuelve a heredar del producto).
  const conValor = (x) => !(x === undefined || x === null || (typeof x === "string" && x.trim() === "") || (Array.isArray(x) && x.length === 0) || (typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 0));
  function cambiarAttrsVariante(i, cambios) {
    setVariantes((prev) =>
      prev.map((v, idx) => {
        if (idx !== i) return v;
        const sig = { ...v.attrs, ...cambios };
        for (const k of Object.keys(sig)) if (!conValor(sig[k])) delete sig[k];
        return { ...v, attrs: sig };
      })
    );
  }
  const [pestVar, setPestVar] = useState({});
  const pestDe = (v) => pestVar[v.key] || "car";

  const [traer, setTraer] = useState({});
  const [cuentaTraer, setCuentaTraer] = useState("");
  // Por defecto se consulta la cuenta de Le Chic; se puede cambiar por otra (Toque Chic u otra que se agregue después).
  const compacto = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cuentaPorDefecto = cuentasSaga.find((c) => compacto(`${c.nombre}${c.alias}`).includes("lechic"))?.alias || cuentasMarcadas[0] || cuentasSaga[0]?.alias || "";
  const aliasTraer = cuentasSaga.some((c) => c.alias === cuentaTraer) ? cuentaTraer : cuentaPorDefecto;

  // Trae de SAGA los datos propios de SAGA de la variante i y completa SOLO los campos vacíos.
  // Nunca toca nombre, descripción, marca, precio web, imagen ni stock.
  // Llena la variante `v` (posición i) con lo que SAGA devolvió (r). Con `conProducto` también completa los datos del producto
  // (modelo, país, paquete, descripción…); las variantes hermanas solo completan lo suyo. Devuelve qué se llenó.
  function llenarDesdeSaga(v, i, r, conProducto) {
    const POR_DEFECTO = { paisProduccion: "Perú", condicion: "Nuevo", formatoBelleza: "Frasco" }; // valores precargados: se pueden reemplazar
    const vacio = (k, x) => x === "" || x === null || x === undefined || x === POR_DEFECTO[k] || (Array.isArray(x) && x.length === 0);
    const ETIQUETA = {
      codigoBarras: "Código de barras", volumen: "Medida del frasco", paisProduccion: "País", registroSanitario: "Registro sanitario",
      notasAromaticas: "Notas aromáticas", fraganciaPerfume: "Fragancia", descripcion: "Descripción", cantidadEmpaque: "Cantidad en el empaque",
      genero: "Género", formatoBelleza: "Formato belleza", sagaCategoria: "Categoría", modelo: "Modelo", tipoPerfume: "Tipo de perfume",
      caracteristicas: "Características", condicion: "Condición", contenidoPaquete: "Contenido del paquete", paqueteAncho: "Ancho",
      paqueteLargo: "Largo", paqueteAlto: "Alto", paquetePeso: "Peso", skuPadre: "SKU padre", usarSkuPadre: "Usar SKU padre",
      nameCn: "Nombre en chino", nameEn: "Nombre en inglés", detalleCondicion: "Detalle de la condición", detalleGarantia: "Detalle de la garantía", garantia: "Garantía",
      precio: "Precio de venta", precioOferta: "Precio de oferta", ofertaInicio: "Inicio de la oferta", ofertaFin: "Fin de la oferta",
    };
    const llenados = [];
    const conValor = [];
    const elegir = (nuevos, actuales) => {
      const cambios = {};
      for (const [k, nuevo] of Object.entries(nuevos)) {
        if (nuevo === "" || nuevo === null || nuevo === undefined || (Array.isArray(nuevo) && nuevo.length === 0)) continue;
        if (vacio(k, actuales[k])) {
          cambios[k] = nuevo;
          llenados.push(ETIQUETA[k] || k);
        } else if (String(actuales[k]) !== String(nuevo)) {
          conValor.push(ETIQUETA[k] || k);
        }
      }
      return cambios;
    };
    // Siempre se llena en la variante: lo ubicado en «Variantes» va a sus atributos; lo ubicado en «Atributos» y los datos generales, al producto.
    const ubicK = (k) => requisitosCampos[k]?.ubicacion || UBICACION_DEFECTO[k] || "atributos";
    const { codigoBarras: sagaBarras, descripcion: descSaga, imagenes: imagenesSaga = [], ...deVariante } = r.variante;
    const deProducto = { ...r.producto };
    delete deProducto.skuPadre; // el padre de SAGA es la primera variante: se maneja aparte
    delete deProducto.usarSkuPadre;
    // Nombre y marca del producto (no son atributos): se llenan solo si están vacíos, igual que lo demás.
    const nombreSaga = deProducto.nombreProducto, marcaDeSaga = deProducto.marcaSaga;
    delete deProducto.nombreProducto;
    delete deProducto.marcaSaga;
    const avisosMarca = [];
    if (conProducto) {
      if (nombreSaga) {
        if (!nombre.trim()) {
          alCambiarNombreProducto(nombreSaga);
          llenados.push("Nombre del producto");
        } else if (nombre.trim() !== nombreSaga.trim()) conValor.push("Nombre del producto");
      }
      if (marcaDeSaga) {
        const normM = (t) => String(t || "").trim().toLowerCase();
        const deLaWeb = marcas.find((m) => normM(m.nombreSaga) === normM(marcaDeSaga));
        if (!deLaWeb) avisosMarca.push(`La marca «${marcaDeSaga}» de SAGA no está emparejada con ninguna marca de la web (Integraciones → SAGA → Marcas).`);
        else if (!marca) {
          alCambiarMarca(deLaWeb.slug);
          llenados.push("Marca");
        } else if (marca !== deLaWeb.slug) conValor.push("Marca");
      }
    }
    const enVar = {}, enProd = {};
    for (const [k, val] of Object.entries({ ...deVariante, ...deProducto })) (ubicK(k) === "variantes" ? enVar : enProd)[k] = val;
    const cambVar = elegir(enVar, { ...attrsProducto, ...v.attrs });
    const cambBarras = elegir({ codigoBarras: sagaBarras }, v);
    const cambProd = conProducto ? elegir(enProd, { ...saga, ...attrsProducto }) : {};
    const cambDesc = conProducto ? elegir({ descripcion: descSaga }, { descripcion }) : {};
    // Precio de venta, precio de oferta y vigencia: llenan la pestaña Precio de la variante (solo si están vacíos). El stock no se trae:
    // el de la web es el que manda el inventario.
    const cambPrecioWeb = elegir({ precio: r.precios.precio, precioOferta: r.precios.precioOferta }, v);
    const vigActual = vigenciaDe(v);
    const cambVigencia = elegir(
      { ofertaInicio: r.precios.ofertaInicio, ofertaFin: r.precios.ofertaFin },
      { ofertaInicio: vigActual.inicio, ofertaFin: vigActual.fin },
    );
    // Imágenes: solo si la variante aún no tiene ninguna.
    const cambImagenes = v.imagenes.length === 0 ? imagenesSaga.slice(0, IMAGENES_TOPE) : [];
    if (cambImagenes.length) llenados.push("Imágenes");
    // Si la variante aún no está registrada en esa cuenta, lo normal es vincularla (ya existe en SAGA).
    const sinRegistro = !estadoSync[v.id]?.[aliasTraer];
    // La descripción de SAGA llena la de la web si está vacía.
    if (cambDesc.descripcion !== undefined) setDescripcion(cambDesc.descripcion);
    if (Object.keys(cambProd).length) cambiarAttrsProducto(cambProd);
    // Atributos propios de la categoría: se llenan desde su campo equivalente de SAGA (Configuración → Atributos por categoría).
    const atribsEnlazados = atributosDe(opcionesSaga.atributosCategoria, categoria);
    const mapaTraer = mapaCampos(opcionesSaga.equivalencias, categoria, "saga", r.producto?.sagaCategoria || saga.sagaCategoria);
    const desdeSagaAtribs = propiosDesdeSaga(atribsEnlazados, mapaTraer, r.extras);
    const propiosProd = {}, propiosVar = {};
    for (const [aid, valor] of Object.entries(desdeSagaAtribs.valores)) {
      const etq = atribsEnlazados.find((x) => x.id === aid)?.etiqueta || aid;
      const def = atribCategoria.find((x) => x.id === aid);
      const enVariante = def && !def.general && def.ubicacion === "variantes";
      if (!enVariante && !conProducto) continue;
      const actual = (enVariante ? v.attrs?.propios : atributos.propios)?.[aid];
      if (actual === undefined || actual === "" || (Array.isArray(actual) && actual.length === 0)) {
        (enVariante ? propiosVar : propiosProd)[aid] = valor;
        llenados.push(etq);
      } else if (JSON.stringify(actual) !== JSON.stringify(valor)) {
        conValor.push(etq);
      }
    }
    if (Object.keys(propiosProd).length) setAtributos((prev) => ({ ...prev, propios: { ...prev.propios, ...propiosProd } }));
    setVariantes((prev) =>
      prev.map((x, idx) => {
        if (idx !== i) return x;
        const attrs = { ...x.attrs, ...cambVar };
        if (Object.keys(propiosVar).length) attrs.propios = { ...(x.attrs?.propios || {}), ...propiosVar };
        return {
          ...x,
          ...cambBarras,
          ...(cambPrecioWeb.precio !== undefined ? { precio: String(cambPrecioWeb.precio) } : {}),
          ...(cambPrecioWeb.precioOferta !== undefined ? { precioOferta: String(cambPrecioWeb.precioOferta) } : {}),
          ...(cambImagenes.length ? { imagenes: cambImagenes.map((url) => ({ key: Math.random().toString(36).slice(2), url })) } : {}),
          attrs,
          // La vigencia de la oferta se aplica a todas las cuentas (se puede afinar en Integraciones → Precios por plataforma).
          preciosSaga: Object.keys(cambVigencia).length
            ? { ...x.preciosSaga, ...Object.fromEntries(cuentasSaga.map((c) => [c.alias, { ...(x.preciosSaga[c.alias] || {}), ...cambVigencia }])) }
            : x.preciosSaga,
          acciones: sinRegistro ? { ...x.acciones, [aliasTraer]: "vincular" } : x.acciones,
        };
      })
    );
    const nombreSugerido = Object.values(propiosVar).find((x) => typeof x === "string" && x.trim()) || "";
    return { llenados, conValor, avisos: [...(r.avisos || []), ...desdeSagaAtribs.avisos, ...avisosMarca], nombreSugerido };
  }

  // «Traer de SAGA» a nivel del SKU padre (el SKU de la primera variante en SAGA): si es único llena la primera variante; si el
  // grupo tiene más, agrega esas variantes y las llena. Solo completa campos vacíos.
  async function traerDelPadre() {
    const sku = (variantes[0]?.sku || "").trim();
    if (!categoria) return; // sin categoría no se sabe qué atributos completar
    setTraer((p) => ({ ...p, padre: { cargando: true } }));
    const g = await traerGrupoSaga(aliasTraer, sku);
    if (g?.error) {
      setTraer((p) => ({ ...p, padre: { error: g.error } }));
      return;
    }
    const posiciones = new Map(variantes.map((x, idx) => [x.sku.trim(), idx]));
    const avisos = [...(g.avisos || [])];
    const nuevas = [];
    const trabajos = [];
    let total = variantes.length;
    let numero = total;
    for (const it of g.items) {
      let idx = posiciones.get(it.sku);
      let objetivo = idx === undefined ? null : variantes[idx];
      if (idx === undefined) {
        numero += 1;
        objetivo = { ...nuevaVariante(), sku: it.sku, nombre: `Variante ${numero}`, abierta: true };
        nuevas.push(objetivo);
        idx = total++;
      }
      trabajos.push({ v: objetivo, i: idx, nuevo: !variantes.some((x) => x.key === objetivo.key), datos: it.datos });
    }
    if (nuevas.length) {
      // Al pasar de una a varias, la primera necesita un nombre para distinguirla.
      setVariantes((prev) => {
        const base = prev.length === 1 && (!prev[0].nombre.trim() || prev[0].nombre.trim() === "Único") ? [{ ...prev[0], nombre: "Variante 1" }] : prev;
        return [...base, ...nuevas];
      });
    }
    const llenados = [], conValor = [];
    for (const t of trabajos) {
      const res = llenarDesdeSaga(t.v, t.i, t.datos, t.i === 0);
      llenados.push(...res.llenados);
      conValor.push(...res.conValor);
      avisos.push(...res.avisos);
      // El nombre de la variante se propone con el primer atributo de variación que SAGA trae (p. ej. el color).
      // También la que ya existía si su nombre es genérico («Único», «Variante 1», vacío); un nombre que escribiste no se toca.
      const generico = !t.v.nombre.trim() || t.v.nombre.trim() === "Único" || /^variante \d+$/i.test(t.v.nombre.trim());
      if ((t.nuevo || generico) && res.nombreSugerido) actualizarVariante(t.i, { nombre: res.nombreSugerido });
    }
    if (g.padre && g.padre !== sku) avisos.push(`El SKU padre en SAGA es ${g.padre}: ponlo en la primera variante.`);
    const agregadas = trabajos.filter((t) => t.nuevo).length;
    setTraer((p) => ({
      ...p,
      padre: {
        llenados: [...new Set(llenados)],
        conValor: [...new Set(conValor)],
        avisos: [agregadas ? `Se agregaron ${agregadas} variante${agregadas === 1 ? "" : "s"} del grupo de SAGA.` : "Producto único en SAGA: se llenó la primera variante.", ...avisos],
      },
    }));
  }

  function actualizarPrecioSaga(i, alias, cambios) {
    setVariantes((prev) =>
      prev.map((v, idx) =>
        idx === i ? { ...v, preciosSaga: { ...v.preciosSaga, [alias]: { ...(v.preciosSaga[alias] || {}), ...cambios } } } : v
      )
    );
  }

  function cambiarSaga(cambios) {
    setSaga((prev) => ({ ...prev, ...cambios }));
  }

  function agregarVariante() {
    setVariantes((prev) => {
      // Al pasar de una a varias, la primera necesita un nombre para distinguirla (se puede cambiar).
      const base = prev.length === 1 && (!prev[0].nombre.trim() || prev[0].nombre.trim() === "Único") ? [{ ...prev[0], nombre: "Variante 1" }] : prev;
      // La nueva también sale con nombre (se puede cambiar): «Variante N», sin repetir uno existente.
      let n = base.length + 1;
      while (base.some((x) => x.nombre.trim().toLowerCase() === `variante ${n}`)) n++;
      return [...base, { ...nuevaVariante(), nombre: `Variante ${n}`, abierta: true }];
    });
  }

  function quitarVariante(i) {
    const v = variantes[i];
    // Una variante ya guardada se elimina al guardar el producto, con su historial de stock: se pide confirmación.
    if (v?.id && !confirm(`Eliminar «${v.nombre.trim() || "Sin nombre"}»: se eliminará al guardar, junto con su historial de stock, y también se quitará de SAGA si está sincronizada.\n\nSi solo quieres ocultarla del sitio, cancela y desmarca «Activa».\n\n¿Eliminarla?`)) return;
    setVariantes((prev) => {
      if (prev.length <= 1) return prev;
      const quedan = prev.filter((_, idx) => idx !== i);
      // Al quedar una sola, el producto vuelve a ser simple: su única variante se llama «Único» (el nombre ya no se muestra).
      return quedan.length === 1 ? [{ ...quedan[0], nombre: "Único" }] : quedan;
    });
  }

  function alCambiarNombreProducto(valor) {
    setNombre(valor);
    if (modo === "crear" && !idTocadoManualmente) {
      setId(slugify(valor));
    }
  }

  // Cambiar la categoría solo si deja de existir en la nueva pestaña.
  function ajustarCategoria(slugPestana) {
    const cats = pestanas.find((p) => p.slug === slugPestana)?.categorias || [];
    // Si la categoría elegida no existe en la nueva pestaña se vacía: hay que elegir otra.
    if (categoria && !cats.some((c) => c.slug === categoria)) elegirCategoria("");
  }

  // Elegir la categoría web limita la categoría de SAGA a sus equivalentes: se conserva la actual si sigue siendo válida;
  // si no, se toma la única equivalente (o queda sin elegir para que se escoja una).
  function elegirCategoria(slug) {
    const equivalentes = categoriasDePlataforma(opcionesSaga.equivalencias, slug, "saga");
    setCategoria(slug);
    setSaga((prev) => {
      if (prev.sagaCategoria && equivalentes.includes(String(prev.sagaCategoria))) return prev;
      return { ...prev, sagaCategoria: equivalentes.length === 1 ? equivalentes[0] : "" };
    });
  }

  function alCambiarMarca(nuevaMarca) {
    setMarca(nuevaMarca);
    const sugerida = marcas.find((m) => m.slug === nuevaMarca)?.pestanaDefault;
    if (sugerida && pestanas.some((p) => p.slug === sugerida)) {
      setPestana(sugerida);
      ajustarCategoria(sugerida);
    }
  }

  function alCambiarPestana(nuevaPestana) {
    setPestana(nuevaPestana);
    ajustarCategoria(nuevaPestana);
  }

  // Largo del nombre que recibe SAGA (producto + variante, salvo "Único"): se toma el peor caso.
  const nombreSagaDe = () => nombre;
  const largoNombreSaga = Math.max(0, ...variantes.map((v) => nombreSagaDe(v).length));
  const fueraDeRangoNombre = (n) => n < CALIDAD.tituloMin || n > CALIDAD.tituloMax;
  // Aviso (no impide guardar) bajo el nombre del producto: SAGA pide títulos de 20 a 100 caracteres.
  const avisoNombre =
    !conSaga || nombre.trim() === ""
      ? null
      : largoNombreSaga > LIMITES.texto
        ? { rojo: true, texto: `Muy largo para SAGA: máximo ${LIMITES.texto} caracteres y queda en ${largoNombreSaga}. Acórtalo.` }
        : fueraDeRangoNombre(largoNombreSaga)
          ? { rojo: false, texto: `SAGA pide de ${CALIDAD.tituloMin} a ${CALIDAD.tituloMax} caracteres en el nombre y tiene ${largoNombreSaga}; fuera de ese rango baja la calificación.` }
          : null;

  // Acción de la variante en una cuenta: la elegida o, por defecto, crear (variantes nuevas o ya enviadas).
  const accionDe = (v, alias) =>
    v.acciones[alias] ?? (v.id && !variantesSincronizadas.map(String).includes(String(v.id)) ? "ninguna" : "crear");

  // Qué le falta a cada variante para publicarse en SAGA (mismas reglas y misma herencia que al enviar).
  function faltantesSaga(v, alias) {
    if (!conSaga) return [];
    const num = (x) => (x === "" || x === null || x === undefined ? null : Number(x));
    const o = (alias && v.preciosSaga[alias]) || {};
    const pr = {
      id, nombre, marca, categoria, descripcion,
      saga_categoria: saga.sagaCategoria, modelo: saga.modelo || null, pais_produccion: saga.paisProduccion,
      tipo_perfume: saga.tipoPerfume, genero: generoActual, formato_belleza: saga.formatoBelleza,
      condicion: saga.condicion, caracteristicas: saga.caracteristicas, contenido_paquete: saga.contenidoPaquete,
      name_cn: saga.nameCn || null, name_en: saga.nameEn || null, detalle_condicion: saga.detalleCondicion || null,
      detalle_garantia: saga.detalleGarantia || null, garantia: saga.garantia || null,
      paquete_ancho: num(saga.paqueteAncho), paquete_largo: num(saga.paqueteLargo),
      paquete_alto: num(saga.paqueteAlto), paquete_peso: num(saga.paquetePeso),
      usar_sku_padre: usarPadre,
      volumen: saga.volumen || null, cantidad_empaque: saga.cantidadEmpaque || null,
      fragancia_perfume: saga.fraganciaPerfume, notas_aromaticas: saga.notasAromaticas || null, saga_extras: saga.extras,
      atributos: { registro_sanitario: atributos.registroSanitario, variante_extras: atributos.varianteExtras, propios: atributos.propios },
    };
    const pers = personalizadosAFila(attrsDe(v));
    const vr = {
      nombre: nomV(v), sku: v.sku, descripcion: pers.columnas.descripcion, volumen: pers.columnas.volumen,
      cantidad_empaque: pers.columnas.cantidad_empaque, registro_sanitario: pers.columnas.registro_sanitario,
      fragancia_perfume: pers.columnas.fragancia_perfume, notas_aromaticas: pers.columnas.notas_aromaticas, saga_combinar_nombre: false,
      saga_extras: pers.columnas.saga_extras, atributos: pers.atributos,
      codigo_barras: v.codigoBarras,
      // Las imágenes nuevas se subirán a Cloudinary (https) al guardar: aquí solo cuentan como presentes.
      imagenes: v.imagenes.map((im) => im.url || "https://pendiente-de-subir"),
      precio: num(o.precio) ?? num(v.precio), precio_oferta: num(o.precioOferta) ?? num(v.precioOferta),
      oferta_inicio: o.ofertaInicio || null, oferta_fin: o.ofertaFin || null,
    };
    // Herencia del producto y luego lo propio de la cuenta (paquete y categoría), igual que en el envío.
    const ef = efectivoBase(pr, vr);
    const pq = alias && paquetes[alias]?.personalizar ? paquetes[alias] : null;
    const conPaquete = pq
      ? { ...ef.p, contenido_paquete: pq.contenidoPaquete, paquete_ancho: num(pq.paqueteAncho), paquete_largo: num(pq.paqueteLargo), paquete_alto: num(pq.paqueteAlto), paquete_peso: num(pq.paquetePeso) }
      : ef.p;
    const cc = alias && catCuenta[alias]?.personalizar && catCuenta[alias].sagaCategoria ? catCuenta[alias] : null;
    const pCuenta = cc
      ? { ...conPaquete, saga_categoria: cc.sagaCategoria, saga_extras: cc.extras || {}, atributos: { ...conPaquete.atributos, variante_extras: cc.varianteExtras || {} } }
      : conPaquete;
    const eq = extrasConPropios(opcionesSaga, categoria, pCuenta.saga_categoria, pCuenta.atributos.propios, pCuenta.saga_extras, pCuenta.atributos.variante_extras);
    const p = { ...pCuenta, saga_extras: eq.extras, atributos: { ...pCuenta.atributos, variante_extras: eq.varianteExtras } };
    return validarProducto(p, { ...heredarVariante(p.atributos, ef.v), es_unica: sinVariantes }, opcionesSaga);
  }
  // Cada cuenta puede tener sus propios precios: se valida por cuenta. Lo que falta en todas se lista una vez.
  // Con una acción de vincular/actualizar solo importan los datos que ESA acción envía (los vacíos no viajan).
  // A qué dato de la matriz de acciones (Configuración → SAGA) corresponde cada falta. Lo que no coincide con ninguno son los campos
  // extra de la categoría (p. ej. Talla o Color), que viajan con «Campos extra de la categoría».
  const MAPA_FALTANTE = [
    [/^Nombre/, "nombre"], [/^Marca/, "marca"], [/^Categoría primaria/, "categoria"], [/^Descripción/, "descripcion"],
    [/^Im[aá]gen/, "imagen"], [/^Precio/, "precio"], [/^Fechas de oferta/, "oferta"], [/^Registro sanitario/, "registro_sanitario"],
    [/^Tipo de perfume/, "tipo_perfume"], [/^Género/, "genero"], [/^Formato belleza/, "formato_belleza"], [/^Condición/, "condicion"],
    [/^Ancho del paquete/, "paquete_ancho"], [/^Largo del paquete/, "paquete_largo"], [/^Alto del paquete/, "paquete_alto"],
    [/^Peso del paquete/, "paquete_peso"], [/^Contenido del paquete/, "paquete_contenido"], [/^Medida del frasco/, "medida"],
    [/^Cantidad contenida/, "cantidad_empaque"], [/^Fragancia/, "aroma"], [/^Características/, "caracteristicas"],
    [/^País de producción/, "pais"], [/^Modelo/, "modelo"], [/^Notas aromáticas/, "notas"], [/^SKU/, "sku"],
  ];
  const idDeFalta = (t) => MAPA_FALTANTE.find(([re]) => re.test(t))?.[1] || "extras";
  const faltantesDeAccion = (v, a) => {
    const modo = accionDe(v, a);
    if (modo === "crear") return faltantesSaga(v, a);
    const envia = (opcionesSaga.acciones || []).find((x) => x.id === modo)?.atributos;
    if (!envia) return []; // sin acción / desvincular / acción desconocida: no envía datos
    // El SKU siempre se necesita; lo demás solo si la acción lo envía.
    return faltantesSaga(v, a).filter((t) => {
      const id = idDeFalta(t);
      return id === "sku" || envia.includes(id);
    });
  };
  function faltantesPorCuenta(v) {
    // Crear exige todo; las acciones de vincular, solo lo que envían.
    const aliases = cuentasMarcadas.filter((a) => accionDe(v, a) === "crear" || (opcionesSaga.acciones || []).some((x) => x.id === accionDe(v, a)));
    if (!aliases.length) return { comunes: [], propios: [], total: 0 };
    const porCuenta = aliases.map((a) => ({ alias: a, items: faltantesDeAccion(v, a) }));
    const comunes = porCuenta[0].items.filter((f) => porCuenta.every((c) => c.items.includes(f)));
    const propios = porCuenta
      .map((c) => ({ alias: c.alias, items: c.items.filter((f) => !comunes.includes(f)) }))
      .filter((c) => c.items.length);
    return { comunes, propios, total: comunes.length + propios.reduce((n, c) => n + c.items.length, 0) };
  }
  const nombreCuenta = (alias) => cuentasSaga.find((c) => c.alias === alias)?.nombre || alias;
  // Aviso por campo: un dato obligatorio de SAGA que falta porque NO está enlazado a ningún atributo web
  // (Configuración → Integraciones → Web). Distinto de "enlazado pero vacío": ahí solo hay que llenar el atributo.
  const camposSinEnlace = (f) => {
    if (!conSaga) return [];
    const faltan = new Set([...f.comunes, ...f.propios.flatMap((c) => c.items)]);
    const cats = new Set(cuentasMarcadas.map((a) => String((catCuenta[a]?.personalizar && catCuenta[a].sagaCategoria) || saga.sagaCategoria || "")).filter(Boolean));
    const salida = [];
    salida.cats = [];
    for (const c of cats) {
      const enlazados = new Set(Object.keys(mapaCampos(opcionesSaga.equivalencias, categoria, "saga", c)));
      for (const campo of camposDe(c)) {
        if (campo.obligatorio && faltan.has(campo.etiqueta) && !enlazados.has(campo.id) && !salida.includes(campo.etiqueta)) {
          salida.push(campo.etiqueta);
          if (!salida.cats.includes(c)) salida.cats.push(c);
        }
      }
    }
    return salida;
  };
  // Nombre de la(s) categoría(s) primaria(s) de SAGA elegidas en el paso 2, tal como se ven en el selector.
  const nombresCategoriaSaga = (ids) => ids.map((id) => { const c = (opcionesSaga.categorias || []).find((x) => String(x.id) === String(id)); return c ? `${c.id} - ${c.nombre}` : id; }).join(" / ");
  const faltantesPorVariante = variantes.map(faltantesPorCuenta);
  const variantesIncompletas = faltantesPorVariante.filter((f) => f.total).length;

  const variantesJson = JSON.stringify(
    variantes.map((v) => ({
      id: v.id,
      sku: v.sku,
      stockMinimo: v.stockMinimo,
      costo: v.costo,
      activo: v.activo,
      nombre: nomV(v),
      precio: v.precio,
      precioOferta: v.precioOferta,
      stock: v.stock,
      stockCantidad: v.stockCantidad,
      stockOriginal: v.stockActual,
      esPack: v.esPack,
      componentes: v.esPack ? v.componentes.map((c) => ({ id: Number(c.id), cantidad: Number(c.cantidad) })) : [],
      // En orden: URL ya guardada, o archivo nuevo que viaja en el campo `campo` del formulario.
      imagenes: v.imagenes.map((im) => (im.archivo ? { nuevo: true, campo: im.campo } : { url: im.url })),
      codigoBarras: v.codigoBarras,
      // Solo lo que la variante personaliza; lo demás lo hereda del producto.
      attrs: attrsDe(v),
      sagaCombinarNombre: false,
      preciosSaga: v.preciosSaga,
      acciones: Object.fromEntries(cuentasMarcadas.map((a) => [a, accionDe(v, a)])),
    }))
  );

  const estadoSagaChip = cuentasMarcadas.length > 0 && (
    <span className={variantesIncompletas ? "chip-saga aviso" : "chip-saga ok"}>
      {variantesIncompletas
        ? sinVariantes
          ? `SAGA: faltan ${faltantesPorVariante[0].total} dato${faltantesPorVariante[0].total === 1 ? "" : "s"} del producto`
          : `SAGA: ${variantesIncompletas} variante${variantesIncompletas === 1 ? "" : "s"} con datos pendientes`
        : "SAGA: listo para enviar"}
    </span>
  );

  const botonGuardar = (
    <button type="submit" className="btn-admin solido" disabled={enviando}>
      {enviando ? "Guardando..." : modo === "crear" ? "Crear producto" : "Guardar cambios"}
    </button>
  );

  // «Traer datos de SAGA»: botón discreto junto al SKU (ícono). Usa la cuenta de Le Chic por defecto; si hay varias cuentas
  // se puede cambiar con un selector pequeño. Rellena solo campos vacíos.
  const controlTraer = (sku, clave, alClic) =>
    conSaga && (
      <>
        {cuentasSaga.length > 1 && (
          <select
            className="pf-traer-cuenta-sel"
            value={aliasTraer}
            onChange={(e) => setCuentaTraer(e.target.value)}
            aria-label="Cuenta SAGA de donde traer los datos"
            title="Cuenta de SAGA de donde se traen los datos"
          >
            {cuentasSaga.map((c) => <option key={c.alias} value={c.alias}>{c.nombre}</option>)}
          </select>
        )}
        <button
          type="button"
          className="pf-icono-btn"
          disabled={!sku.trim() || !aliasTraer || !categoria || traer[clave]?.cargando}
          onClick={alClic}
          aria-label="Traer datos de SAGA"
          title={!categoria ? "Elige primero la categoría: define qué atributos se completan" : sku.trim() ? `Traer datos de SAGA (${cuentasSaga.find((c) => c.alias === aliasTraer)?.nombre || ""}). Solo completa campos vacíos.` : "Escribe el SKU de la primera variante para traer los datos de SAGA"}
        >
          {traer[clave]?.cargando ? (
            <span aria-hidden="true">…</span>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
            </svg>
          )}
        </button>
      </>
    );
  // Resultado de «Traer de SAGA»: una notificación flotante (no mueve el formulario) que se abre con un clic y se cierra con la ✕.
  const mensajesTraer = (clave) => {
    const t = traer[clave];
    if (!conSaga || !(t?.error || t?.llenados)) return null;
    const cerrar = () => setTraer((p) => { const n = { ...p }; delete n[clave]; return n; });
    const n = t.llenados?.length || 0;
    return (
      <div className={t.error ? "pf-toast error" : "pf-toast"} role="status">
        <button type="button" className="pf-toast-x" aria-label="Cerrar la notificación" title="Cerrar" onClick={cerrar}>✕</button>
        {t.error ? (
          <p>{t.error}</p>
        ) : (
          <details>
            <summary>
              <strong>Traído de SAGA</strong>
              <span>{n ? `${n} campo${n === 1 ? "" : "s"} completado${n === 1 ? "" : "s"}` : "No había campos vacíos que completar"}</span>
            </summary>
            {n > 0 && <p><b>Se completaron:</b> {t.llenados.join(", ")}.</p>}
            {t.conValor.length > 0 && <p><b>Ya tenían otro valor (no se cambiaron):</b> {t.conValor.join(", ")}.</p>}
            {t.avisos.map((a, i) => <p key={i}>{a}</p>)}
          </details>
        )}
      </div>
    );
  };

  // «Activa» y «Eliminar variante» (solo desde la segunda) de una variante.
  const opcionesVariante = (v, i) => (
    <>
                  <label className="campo-check">
                    <input
                      type="checkbox"
                      checked={v.activo}
                      onChange={(e) => actualizarVariante(i, { activo: e.target.checked })}
                    />
                    Activa (visible en el sitio)
                  </label>
                  {!restringido && i > 0 && (
                    <button type="button" className="btn-admin peligro pf-var-quitar" onClick={() => quitarVariante(i)}>
                      Eliminar variante
                    </button>
                  )}
    </>
  );
  // Vigencia de la oferta: SAGA la pide por cuenta; aquí se fija una sola para todas las cuentas
  // (la tabla «Precios por plataforma» de Integraciones permite afinarla por cuenta).
  const vigenciaDe = (v) => {
    const o = cuentasSaga.map((c) => v.preciosSaga[c.alias] || {}).find((x) => x.ofertaInicio || x.ofertaFin) || {};
    return { inicio: o.ofertaInicio || "", fin: o.ofertaFin || "" };
  };
  function fijarVigencia(i, cambios) {
    setVariantes((prev) =>
      prev.map((v, idx) =>
        idx !== i
          ? v
          : { ...v, preciosSaga: { ...v.preciosSaga, ...Object.fromEntries(cuentasSaga.map((c) => [c.alias, { ...(v.preciosSaga[c.alias] || {}), ...cambios }])) } }
      )
    );
  }

  // Pestaña «Características»: nombre de la variante y los atributos ubicados en «Variantes» (Integraciones → Web → Atributos por categoría).
  const panelCaracteristicas = (v, i) => (
    <>
      <div className="pf-var-grid">
        <div className="campo">
          <label htmlFor={`var${i}-nombre`}>Nombre de la variante</label>
          <input
            id={`var${i}-nombre`}
            type="text"
            value={v.nombre}
            onChange={(e) => actualizarVariante(i, { nombre: e.target.value })}
            placeholder={sinVariantes ? "Único" : 'Ej: "50 ml", "Rosa"'}
          />
          {sinVariantes && <small>Con una sola variante SAGA usa solo el nombre del producto.</small>}
        </div>
      </div>
      {conSaga && (
        <AtributosProducto
          soloVariacion
          valores={v.attrs || {}}
          onChange={(c) => cambiarAttrsVariante(i, c)}
          enVariante
          prefijo={`var${i}`}
          conSaga={conSaga}
          sagaGeneral={sagaGeneral}
          generales={generales}
          etiquetas={etiquetasCampos}
          requisitos={requisitosCampos}
          opcionesSaga={opcionesSaga}
          atribCategoria={atribCategoria}
          nombreCategoria={nombreCategoria}
        />
      )}
    </>
  );

  // Pestaña «Precio»: costo, precio de venta, precio de oferta y vigencia de la oferta.
  const panelPrecio = (v, i) => {
    const vig = vigenciaDe(v);
    return (
      <div className="pf-var-grid">
        {!restringido && !v.esPack && (
          <div className="campo">
            <label htmlFor={`var${i}-costo`}>Costo (S/) <em>opcional</em></label>
            <input id={`var${i}-costo`} type="number" min="0" step="0.01" value={v.costo} onChange={(e) => actualizarVariante(i, { costo: e.target.value })} />
          </div>
        )}
        <div className="campo">
          <label htmlFor={`var${i}-precio`}>Precio de venta (S/) <em>*</em></label>
          <input id={`var${i}-precio`} type="number" step="0.1" min="0" value={v.precio} onChange={(e) => actualizarVariante(i, { precio: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor={`var${i}-oferta`}>Precio de oferta (S/) <em>opcional</em></label>
          <input id={`var${i}-oferta`} type="number" step="0.1" min="0" value={v.precioOferta} onChange={(e) => actualizarVariante(i, { precioOferta: e.target.value })} />
        </div>
        {conSaga && cuentasSaga.length > 0 && (
          <div className="campo pf-vigencia">
            <label htmlFor={`var${i}-vig-ini`}>Vigencia de la oferta</label>
            <div className="pf-vigencia-fechas">
              <input id={`var${i}-vig-ini`} type="date" aria-label="Oferta desde" value={vig.inicio} onChange={(e) => fijarVigencia(i, { ofertaInicio: e.target.value })} />
              <span aria-hidden="true">→</span>
              <input type="date" aria-label="Oferta hasta" value={vig.fin} onChange={(e) => fijarVigencia(i, { ofertaFin: e.target.value })} />
            </div>
            {v.precioOferta !== "" && (!vig.inicio || !vig.fin) ? (
              <small style={{ color: "#9a6700" }}>⚠ SAGA exige las dos fechas cuando hay precio de oferta.</small>
            ) : (
              <small>Se aplica a todas las plataformas; puedes afinarla en Integraciones → Precios por plataforma.</small>
            )}
          </div>
        )}
      </div>
    );
  };

  // Pestaña «Inventario»: stock, stock mínimo, SKU del vendedor (con «traer de SAGA») y código de barras.
  const panelInventario = (v, i) => (
    <>
      {!restringido && (
        <label className="campo-check">
          <input type="checkbox" checked={v.esPack} onChange={(e) => actualizarVariante(i, { esPack: e.target.checked })} />
          Es un pack (su stock depende de otros productos)
        </label>
      )}
      <div className="pf-var-grid">
        {restringido ? (
          v.esPack ? (
            <div className="campo">
              <label>Stock</label>
              <strong>Pack · stock calculado: {v.stockPack}</strong>
            </div>
          ) : v.stockActual === null ? (
            <div className="campo">
              <label>Stock</label>
              <label className="campo-check">
                <input type="checkbox" checked={v.stock} onChange={(e) => actualizarVariante(i, { stock: e.target.checked })} />
                Con stock disponible
              </label>
            </div>
          ) : (
            <div className="campo">
              <label>Stock</label>
              <strong>{v.stockActual}</strong>
            </div>
          )
        ) : !v.esPack ? (
          <div className="campo">
            <label htmlFor={`var${i}-stock`}>Stock (cantidad)</label>
            <input
              id={`var${i}-stock`}
              type="number"
              min="0"
              step="1"
              value={v.stockCantidad}
              onChange={(e) => actualizarVariante(i, { stockCantidad: e.target.value })}
              placeholder="Sin control de cantidad"
            />
            {v.stockCantidad === "" && v.stockActual === null ? (
              <label className="campo-check">
                <input type="checkbox" checked={v.stock} onChange={(e) => actualizarVariante(i, { stock: e.target.checked })} />
                Con stock disponible
              </label>
            ) : (
              <small>
                Al guardar se registra el ajuste en el historial.{" "}
                {v.stockActual !== null && <a href={`/admin?q=${encodeURIComponent(v.sku || nombre)}`}>Ver en Inventario</a>}
              </small>
            )}
          </div>
        ) : (
          <div className="campo">
            <label>Stock</label>
            <strong>Pack · stock calculado: {v.stockPack}</strong>
          </div>
        )}
        {!restringido && !v.esPack && (
          <div className="campo">
            <label htmlFor={`var${i}-minimo`}>Stock mínimo <em>alerta y colchón en SAGA</em></label>
            <input id={`var${i}-minimo`} type="number" min="0" step="1" value={v.stockMinimo} onChange={(e) => actualizarVariante(i, { stockMinimo: e.target.value })} />
            {conSaga && (() => {
              // Lo que verá SAGA: con el stock en o bajo el mínimo se publica 0 (colchón).
              const enWeb = v.stockCantidad !== "" ? Number(v.stockCantidad) : v.stockActual;
              if (enWeb === null || enWeb === undefined || Number.isNaN(enWeb)) return null;
              const minimo = Number(v.stockMinimo) || 0;
              const enSaga = enWeb > minimo ? enWeb : 0;
              return (
                <small style={{ color: enWeb > 0 && enSaga === 0 ? "#b3261e" : "var(--gris)" }}>
                  En SAGA se publicará: <strong>{enSaga}</strong>
                  {enWeb > 0 && enSaga === 0 ? ` — el stock (${enWeb}) no supera el mínimo (${minimo}). ¿Pusiste la cantidad en el campo equivocado?` : ""}
                </small>
              );
            })()}
          </div>
        )}
        <div className="campo">
          <label htmlFor={`var${i}-sku`}>SKU vendedor <em>enlaza con facturación</em></label>
          <input id={`var${i}-sku`} type="text" value={v.sku} onChange={(e) => actualizarVariante(i, { sku: e.target.value })} placeholder="Ej: YB-ROSA-50" />
        </div>
        <div className="campo">
          <label htmlFor={`var${i}-barras`}>Código de barras {conSaga && <em>*</em>}</label>
          <input id={`var${i}-barras`} type="text" value={v.codigoBarras} onChange={(e) => actualizarVariante(i, { codigoBarras: e.target.value })} />
        </div>
      </div>
      {!restringido && v.esPack && (
        <PackComponentes componentes={v.componentes} onChange={(componentes) => actualizarVariante(i, { componentes })} opciones={variantesPack} idPropio={v.id} />
      )}
    </>
  );

  // Pestaña «Multimedia»: imágenes de la variante.
  const panelMultimedia = (v, i) => (
    <div className="pf-imagen-fila">
      <div className="campo pf-imagen">
        <ImagenesVariante
          varianteKey={v.key}
          imagenes={v.imagenes}
          onChange={(imagenes) => actualizarVariante(i, { imagenes })}
          max={IMAGENES_TOPE}
          minimo={conSaga && saga.sagaCategoria ? imagenesRequeridas(saga.sagaCategoria, opcionesSaga.categorias).min : 0}
        />
      </div>
    </div>
  );

  // Una variante: cabecera (resumen) y sus 4 pestañas. Todo se llena a nivel de variante, también con una sola.
  const PEST_VAR = [["car", "Características"], ["pre", "Precio"], ["inv", "Inventario"], ["mul", "Multimedia"]];
  const tarjetaVariante = (v, i) => {
    const pestana = pestDe(v);
    const cuerpo = (
      <div className="pf-var-cuerpo">
        <div className="pf-var-opciones">{opcionesVariante(v, i)}</div>
        <div className="pf-vtabs" role="tablist" aria-label="Datos de la variante">
          {PEST_VAR.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              className="pf-vtab"
              onClick={() => setPestVar((p) => ({ ...p, [v.key]: id }))}
            >
              <IconoVariante id={id} /> {texto}
            </button>
          ))}
        </div>
        <div hidden={pestana !== "car"} data-vtab="car" data-vkey={v.key} className="pf-var-panel">{panelCaracteristicas(v, i)}</div>
        <div hidden={pestana !== "pre"} data-vtab="pre" data-vkey={v.key} className="pf-var-panel">{panelPrecio(v, i)}</div>
        <div hidden={pestana !== "inv"} data-vtab="inv" data-vkey={v.key} className="pf-var-panel">{panelInventario(v, i)}</div>
        <div hidden={pestana !== "mul"} data-vtab="mul" data-vkey={v.key} className="pf-var-panel">{panelMultimedia(v, i)}</div>
      </div>
    );
    if (sinVariantes) return <div className="pf-variante pf-var-unica" key={v.key} id={`pf-var-${i}`}>{cuerpo}</div>;
    return (
      <details className="pf-variante" key={v.key} id={`pf-var-${i}`} open={v.abierta === true}>
        <summary className="pf-var-resumen">
          <span className="pf-var-n">{i + 1}</span>
          <strong className="pf-var-nombre">{v.nombre.trim() || "Sin nombre"}</strong>
          <span className="pf-var-dato">{v.sku ? `SKU ${v.sku}` : "Sin SKU"}</span>
          <span className="pf-var-dato">{v.precio === "" ? "Sin precio" : `S/ ${v.precio}`}</span>
          <span className="pf-var-dato">
            {v.esPack ? `Pack · ${v.stockPack}` : v.stockCantidad !== "" ? `Stock ${v.stockCantidad}` : v.stock ? "Con stock" : "Sin stock"}
          </span>
          {!v.activo && <span className="chip-saga aviso">Inactiva</span>}
          {v.esPack && <span className="chip-saga">Pack</span>}
        </summary>
        {cuerpo}
      </details>
    );
  };

  // Qué hacer con una variante en una cuenta (crear, vincular, no enviar…): se elige en el panel de SAGA.
  const selectorAccion = (v, i, c) => {
    const modoAccion = accionDe(v, c.alias);
    const registrada = Boolean(estadoSync[v.id]?.[c.alias]);
    return (
      <select
        value={modoAccion}
        aria-label={`Acción en ${c.nombre}${variantes.length > 1 ? ` para ${v.nombre.trim() || "la variante"}` : ""}`}
        onChange={(e) => actualizarVariante(i, { acciones: { ...v.acciones, [c.alias]: e.target.value } })}
      >
        {/* Sin acción elegida: no se envía nada. No es una acción (para no enviar basta no marcar la cuenta); solo se muestra mientras es el valor actual. */}
        {modoAccion === "ninguna" && <option value="ninguna">{registrada ? "En revisión de SAGA" : "Elegir acción…"}</option>}
        <option value="crear">Crear en SAGA (SKU nuevo)</option>
        {(opcionesSaga.acciones || []).map((x) => (
          <option key={x.id} value={x.id}>{x.nombre}</option>
        ))}
        {registrada && <option value="desvincular">Dejar de sincronizar</option>}
      </select>
    );
  };
  // Estado de una variante para publicar en SAGA, con lo que le falta (se muestra en «¿Qué quieres hacer en cada cuenta?»).
  const estadoDeVariante = (i) => {
    if (faltantesPorVariante[i].total > 0) {
      return (
        <details className="pf-estado-var">
          <summary><span className="chip-saga rojo">Faltan {faltantesPorVariante[i].total}</span></summary>
          {listaFaltantes(i)}
        </details>
      );
    }
    // Con acciones que no envían la ficha (p. ej. vincular) no se exige nada; aun así se informa lo que faltaría para crearla.
    const ficha = [...new Set(cuentasMarcadas.flatMap((a) => faltantesSaga(variantes[i], a)))];
    if (ficha.length > 0) {
      return (
        <details className="pf-estado-var">
          <summary><span className="chip-saga rojo">Ficha incompleta: {ficha.length}</span></summary>
          <small>La acción elegida no envía estos datos, por eso no se exigen; se pedirían al crear el producto en SAGA:</small>
          <ul className="saga-faltantes">{ficha.map((f) => <li key={f}>{f}</li>)}</ul>
        </details>
      );
    }
    return <span className="chip-saga ok">Completa</span>;
  };
  // Lo que falta para publicar una variante (comunes a las cuentas y propio de cada una).
  const listaFaltantes = (i) =>
    faltantesPorVariante[i].total > 0 && (
      <>
        <ul className="saga-faltantes">
          {faltantesPorVariante[i].comunes.map((f) => <li key={f}>{f}</li>)}
          {faltantesPorVariante[i].propios.map((c) => (
            <li key={c.alias}>
              <strong>En {nombreCuenta(c.alias)}:</strong> {c.items.join("; ")}
            </li>
          ))}
        </ul>
        {camposSinEnlace(faltantesPorVariante[i]).length > 0 && (
          <p className="saga-faltantes" style={{ margin: 0 }}>
            <strong>Sin enlazar a un atributo:</strong> {camposSinEnlace(faltantesPorVariante[i]).join(", ")}, ningún atributo de «{nombreCategoriaWeb}» alimenta ese campo de SAGA.
            Enlázalos en Configuración → Integraciones → Equivalencias por categoría → {nombresCategoriaSaga(camposSinEnlace(faltantesPorVariante[i]).cats)}
          </p>
        )}
      </>
    );

  // Las secciones principales arrancan abiertas y todo lo de adentro minimizado. Al navegar o fallar la validación del navegador se abren las secciones que contienen el campo.
  function abrirContenedores(e) {
    const pn = e.target.closest?.("[data-panel]")?.getAttribute("data-panel");
    if (pn) setPanel(pn);
    const vt = e.target.closest?.("[data-vtab]");
    if (vt) setPestVar((p) => ({ ...p, [vt.getAttribute("data-vkey")]: vt.getAttribute("data-vtab") }));
    let d = e.target.closest?.("details");
    while (d) {
      d.open = true;
      d = d.parentElement?.closest("details");
    }
  }
  return (
    <form
      action={accion}
      className="pf"
      onInvalidCapture={abrirContenedores}
      onSubmit={(e) => {
        // No se guarda con datos pendientes para SAGA: hay que completarlos, cambiar la acción o desmarcar la cuenta.
        if (conSaga && variantesIncompletas > 0) {
          e.preventDefault();
          setIntentoBloqueado(true);
          setPanel("integraciones");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      {conSaga && <input type="hidden" name="sagaCampos" value="1" />}
      {conSaga && <input type="hidden" name="sagaCuentasVisibles" value={JSON.stringify(cuentasSaga.map((c) => c.alias))} />}
      {conSaga && <input type="hidden" name="sagaExtras" value={JSON.stringify(saga.extras)} />}
      {conSaga && <input type="hidden" name="paquetesJson" value={JSON.stringify(paquetes)} />}
      {conSaga && <input type="hidden" name="categoriasCuentaJson" value={JSON.stringify(catCuenta)} />}
      {conSaga && (
        <input type="hidden" name="atributosGenerales" value={JSON.stringify({ registro_sanitario: atributos.registroSanitario, variante_extras: atributos.varianteExtras, propios: atributos.propios })} />
      )}

      <input type="hidden" name="modo" value={modo} />
      {/* El id (URL) se genera solo del nombre y no se edita. El SKU padre es el de la primera variante (como en SAGA); si SAGA ya lo confirmó, ese. */}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="skuPadre" value={skuPadreAuto} />
      {usarPadre && <input type="hidden" name="usarSkuPadre" value="on" />}
      {modo === "editar" && <input type="hidden" name="idOriginal" value={producto.id} />}
      <input type="hidden" name="variantesJson" value={variantesJson} />

      {/* Barra pegajosa: estado, navegación por secciones y Guardar siempre a mano. */}
      <div className="pf-barra">
        <div className="pf-barra-info">
          <strong>{nombre.trim() || (modo === "crear" ? "Nuevo producto" : "Producto")}</strong>
          {!sinVariantes && <span className="chip-saga">{variantes.length} variante{variantes.length === 1 ? "" : "s"}</span>}
          {conSaga && estadoSagaChip}
        </div>
        {botonGuardar}
      </div>

      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {intentoBloqueado && conSaga && variantesIncompletas > 0 && (
        <div className="mensaje-error" role="alert">
          No se puede guardar: {variantesIncompletas === 1 ? "una variante tiene" : `${variantesIncompletas} variantes tienen`} datos pendientes para SAGA. Complétalos, cambia la
          acción de {variantesIncompletas === 1 ? "esa variante" : "esas variantes"} o desmarca la cuenta en Integraciones → Plataformas (paso 1).
        </div>
      )}

      <div className="pf-panelcard cg admin-card">
        {/* Arriba del todo: el SKU padre (con «Traer de SAGA», que llena todas las pestañas) y la categoría, que define los atributos. */}
        <div className="pf-top">
          <div className={categoria ? "campo pf-top-cat" : "campo pf-top-cat con-aviso"}>
            <label htmlFor="categoria">Categoría <em>*</em></label>
            <SelectUnico
              id="categoria"
              name="categoria"
              valor={categoria}
              opciones={categoriasOpc.map((c) => c.slug)}
              formato={(sl) => categoriasOpc.find((c) => c.slug === sl)?.nombre || sl}
              onChange={elegirCategoria}
              placeholder="Elegir categoría…"
              buscar="Buscar categoría…"
              requerido
            />
            {!categoria ? (
              <small className="pf-aviso-campo">⚠ Falta elegir la categoría: de ella dependen los atributos que se piden.</small>
            ) : null}
          </div>
          <div className="campo pf-top-sku">
            <label htmlFor="sku-padre-in">SKU padre</label>
            <div className="pf-sku-grupo">
              <input
                id="sku-padre-in"
                type="text"
                value={variantes[0]?.sku || ""}
                onChange={(e) => actualizarVariante(0, { sku: e.target.value })}
                placeholder="SKU de la primera variante"
              />
              {controlTraer(variantes[0]?.sku || "", "padre", traerDelPadre)}
            </div>
            {mensajesTraer("padre")}
          </div>
        </div>
        <div className="pf-pestanas" role="tablist" aria-label="Secciones del producto">
          {[
            ["producto", "Producto y garantía", null, "producto"],
            ["atributos", "Atributos", null, "atributos"],
            ["variantes", "Variantes", variantes.length, "variantes"],
            ...(conSaga ? [["integraciones", "Integraciones", cuentasMarcadas.length, "conexion"]] : []),
          ].map(([id, nombre, n, icono]) => (
            <button key={id} type="button" role="tab" aria-selected={panel === id} className="pf-pestana" onClick={() => setPanel(id)}>
              <IconoPanelProducto id={icono} />
              {nombre}
              {n !== null && <span className="pf-pestana-n">{n}</span>}
            </button>
          ))}
        </div>
        <div hidden={panel !== "producto"} data-panel="producto" className="form-grid">
          <div className="pf-panel-bloque" id="pf-ident">
            <strong>Principal</strong>
            {/* 1. Nombre: ocupa toda la fila */}
            <div className="campo">
              <label htmlFor="nombre">Nombre del producto <em>*</em></label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => alCambiarNombreProducto(e.target.value)}
              />
              {avisoNombre && <small style={{ color: avisoNombre.rojo ? "#b3261e" : "#9a6700" }}>⚠ {avisoNombre.texto}</small>}
            </div>

            {/* 2. Marca, Pestaña y Modelo en la misma fila */}
            <div className="pf-grid-3">
              <div className="campo">
                <label htmlFor="marca">Marca <em>*</em></label>
                <SelectUnico
                  id="marca"
                  name="marca"
                  valor={marca}
                  opciones={marcasOpc.map((m) => m.slug)}
                  formato={(sl) => marcasOpc.find((m) => m.slug === sl)?.nombre || sl}
                  onChange={alCambiarMarca}
                  placeholder="Elegir marca…"
                  buscar="Buscar marca…"
                  requerido
                />
              </div>
              <div className="campo">
                <label htmlFor="pestana">Pestaña (dónde se muestra en la web)</label>
                <SelectUnico
                  id="pestana"
                  name="pestana"
                  valor={pestana}
                  opciones={pestanasOpc.map((p) => p.slug)}
                  formato={(sl) => pestanasOpc.find((p) => p.slug === sl)?.nombre || sl}
                  onChange={alCambiarPestana}
                  placeholder="Elegir pestaña…"
                  buscar="Buscar pestaña…"
                  requerido
                />
              </div>
              <GeneralesProducto
                parte="principal"
                solo={["modelo"]}
                conSaga={conSaga}
                generales={generales}
                etiquetas={etiquetasCampos}
                requisitos={requisitosCampos}
                opcionesSaga={opcionesSaga}
                atribCategoria={atribCategoria}
                valores={attrsProducto}
                onChange={cambiarAttrsProducto}
              />
            </div>

            {/* 3. Descripción */}
            <EditorDescripcion valor={descripcion} onChange={setDescripcion} />

            {/* 4. País de origen */}
            <div className="pf-grid-2">
              <GeneralesProducto
                parte="principal"
                solo={["paisProduccion", "propios"]}
                conSaga={conSaga}
                generales={generales}
                etiquetas={etiquetasCampos}
                requisitos={requisitosCampos}
                opcionesSaga={opcionesSaga}
                atribCategoria={atribCategoria}
                valores={attrsProducto}
                onChange={cambiarAttrsProducto}
              />
            </div>
          </div>

          <div className="pf-panel-bloque" id="pf-garantia">
            <strong>Garantía y envío</strong>
            <label className="campo-check">
              <input type="checkbox" checked={soloObl} onChange={(e) => setSoloObl(e.target.checked)} />
              Mostrar solo atributos obligatorios y que aumentan la calidad del contenido
            </label>
            <GeneralesProducto
              parte="garantia"
              soloObligatorios={soloObl}
              conSaga={conSaga}
              generales={generales}
              etiquetas={etiquetasCampos}
              requisitos={requisitosCampos}
              opcionesSaga={opcionesSaga}
              atribCategoria={atribCategoria}
              valores={attrsProducto}
              onChange={cambiarAttrsProducto}
            />
          </div>

          <div className="pf-panel-bloque" id="pf-desc">
            <strong>Visibilidad</strong>
              <div className="pf-var-opciones">
              <label className="campo-check">
                <input
                  type="checkbox"
                  name="destacado"
                  checked={destacado}
                  onChange={(e) => setDestacado(e.target.checked)}
                />
                Destacado (aparece resaltado en el catálogo)
              </label>
              </div>
          </div>
        </div>

        <div hidden={panel !== "atributos"} data-panel="atributos" className="form-grid">
          <div className="pf-panel-bloque" id="pf-atributos">
            <strong>Atributos del producto · {nombreCategoria}</strong>
            <AtributosProducto
              omitirGenerales
              conservarVariacion
              valores={attrsProducto}
              onChange={cambiarAttrsProducto}
              prefijo="prod"
              conSaga={conSaga}
              sagaGeneral={sagaGeneral}
              generales={generales}
              etiquetas={etiquetasCampos}
              requisitos={requisitosCampos}
              opcionesSaga={opcionesSaga}
              atribCategoria={atribCategoria}
              nombreCategoria={nombreCategoria}
              sinVariantes={sinVariantes}
            />
          </div>
        </div>

        <div hidden={panel !== "variantes"} data-panel="variantes" className="form-grid">
          <div className="pf-panel-bloque" id="pf-variantes">
            <div className="pf-var-cabecera">
              <div>
                <strong>{sinVariantes ? "Variante única" : "Variantes"}</strong>
                <small>
                  {permiteVar
                    ? "Cada variante se llena en sus pestañas: características, precio, inventario y multimedia."
                    : "Esta categoría no admite más variantes: el producto se llena en una sola (se activa en Configuración → Integraciones → Web → Categorías)."}
                </small>
              </div>
              {permiteVar && !restringido && (
                <button type="button" className="btn-ico-texto" onClick={agregarVariante}>
                  <IconoMas /> Agregar variante
                </button>
              )}
            </div>
            {variantes.map((v, i) => tarjetaVariante(v, i))}
          </div>
        </div>

        {conSaga && (
          <div hidden={panel !== "integraciones"} data-panel="integraciones" className="form-grid">
            <div className="pf-panel-bloque" id="pf-plataformas">
              <strong>Plataformas</strong>
              <small>Elige dónde publicar y cómo. Cada plataforma se puede plegar; sus datos no se muestran en la web.</small>

          <details className="saga-seccion pf-plataforma">
            <summary>
              <span className="pf-sello">SAGA</span> {cuentasSaga.map((c) => c.nombre).join(" · ")}
              {estadoSagaChip}
            </summary>
            <div className="saga-cuerpo pf-pasos">
              {/* 1. Cuentas */}
              <div className="pf-paso">
                <div className="pf-paso-cab">
                  <span className="pf-paso-n">1</span>
                  <div>
                    <strong>¿En qué cuenta quieres publicar?</strong>
                    <small>Puedes marcar varias. Sin marcar, no se envía nada a SAGA.</small>
                  </div>
                </div>
                <div className="pf-cuentas-cards">
                  {cuentasSaga.map((c) => {
                    const marcada = cuentasMarcadas.includes(c.alias);
                    return (
                      <label className={marcada ? "pf-cuenta-card activa" : "pf-cuenta-card"} key={c.alias}>
                        <input
                          type="checkbox"
                          name="sagaCuentas"
                          value={c.alias}
                          checked={marcada}
                          onChange={(e) =>
                            setCuentasMarcadas((prev) => (e.target.checked ? [...prev, c.alias] : prev.filter((a) => a !== c.alias)))
                          }
                        />
                        <span className="pf-cuenta-nombre">{c.nombre}</span>
                        <span className="pf-cuenta-estado">{marcada ? "Se publica aquí" : sincronizadas.includes(c.alias) ? "Se dejará de sincronizar al guardar" : "No publicar"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Categoría primaria */}
              <div className="pf-paso">
                <div className="pf-paso-cab">
                  <span className="pf-paso-n">2</span>
                  <div>
                    <label htmlFor="sagaCategoria"><strong>Categoría primaria</strong> <em>obligatorio</em></label>
                    <small>
                      Solo las categorías de SAGA equivalentes a «{nombreCategoriaWeb}». Define qué atributos se piden y se envían.
                    </small>
                  </div>
                </div>
                <SelectBuscador
                  id="sagaCategoria"
                  name="sagaCategoria"
                  valor={saga.sagaCategoria}
                  onChange={(v) => cambiarSaga({ sagaCategoria: v })}
                  opciones={categoriasSagaOpc.map((c) => ({ valor: c.id, etiqueta: `${c.id} — ${c.nombre}` }))}
                  placeholder={categoriasSagaOpc.length ? "Elegir categoría de SAGA…" : "Sin equivalencias para esta categoría"}
                />
                {idsEquivalentes.length === 0 && (
                  <small style={{ color: "#9a6700" }}>
                    ⚠ La categoría «{nombreCategoriaWeb}» aún no tiene equivalencia en SAGA. Asígnala en Configuración → Integraciones → Web.
                  </small>
                )}
              </div>

              {/* 3. Acciones por cuenta */}
              <div className="pf-paso">
                <div className="pf-paso-cab">
                  <span className="pf-paso-n">3</span>
                  <div>
                    <strong>¿Qué quieres hacer en cada cuenta?</strong>
                    <small>Crear un producto nuevo en SAGA o vincular/actualizar uno que ya existe con ese SKU.</small>
                  </div>
                </div>
                {cuentasMarcadas.length === 0 ? (
                  <small className="pf-paso-vacio">Marca una cuenta en el paso 1 para elegir la acción.</small>
                ) : sinVariantes ? (
                  <div className="pf-acciones-lista">
                    {cuentasSaga.filter((c) => cuentasMarcadas.includes(c.alias)).map((c) => (
                      <div className="campo" key={c.alias}>
                        <label>{c.nombre}</label>
                        {selectorAccion(variantes[0], 0, c)}
                        <small>{ayudaAccion(accionDe(variantes[0], c.alias), opcionesSaga.acciones || [])}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-tabla-wrap">
                    <table className="admin-tabla pf-acciones-tabla">
                      <thead>
                        <tr>
                          <th>Variante</th>
                          {cuentasSaga.filter((c) => cuentasMarcadas.includes(c.alias)).map((c) => <th key={c.alias}>{c.nombre}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {variantes.map((v, i) => (
                          <tr key={v.key}>
                            <td>
                              <strong>{v.nombre.trim() || "Sin nombre"}</strong>
                              <small style={{ display: "block", color: "var(--gris)" }}>{v.sku ? `SKU ${v.sku}` : "Sin SKU"}</small>
                              {estadoDeVariante(i)}
                            </td>
                            {cuentasSaga.filter((c) => cuentasMarcadas.includes(c.alias)).map((c) => <td key={c.alias}>{selectorAccion(v, i, c)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sinVariantes && cuentasMarcadas.length > 0 && <div className="pf-estado-unica">{estadoDeVariante(0)}</div>}
              </div>
            </div>
          </details>
            </div>
            <div className="pf-panel-bloque pf-precios" id="pf-precios">
              <strong>Precios por plataforma</strong>
              <small>Lo que se publica en cada cuenta marcada. Si dejas un campo vacío, la plataforma usa el precio de la web.</small>

          {cuentasMarcadas.length === 0 ? (
            <div className="pf-precios-vacio">
              <strong>Aún no publicas en ninguna cuenta</strong>
              <small>Marca una cuenta en «Plataformas» (paso 1) para definir su precio y ofertas.</small>
            </div>
          ) : (
            variantes.map((v, i) => {
              const dinero = (x) => (x === "" || x === null || x === undefined ? null : Number(x));
              return (
                <div className="pf-precios-var" key={v.key}>
                  {!sinVariantes && (
                    <div className="pf-precios-var-cab">
                      <span className="pf-var-n">{i + 1}</span>
                      <strong>{v.nombre.trim() || "Sin nombre"}</strong>
                      {v.sku && <span className="pf-var-dato">SKU {v.sku}</span>}
                    </div>
                  )}
                  <div className="admin-tabla-wrap">
                    <table className="admin-tabla pf-precios-tabla">
                      <thead>
                        <tr>
                          <th>Plataforma</th>
                          <th>Precio (S/)</th>
                          <th>Precio oferta</th>
                          <th>Oferta desde</th>
                          <th>Oferta hasta</th>
                          <th>Se publicará</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="pf-precios-web">
                          <td><strong>Web</strong> <small>precio base</small></td>
                          <td>{v.precio === "" ? "—" : v.precio}</td>
                          <td>{v.precioOferta === "" ? "—" : v.precioOferta}</td>
                          <td>—</td>
                          <td>—</td>
                          <td>{v.precio === "" ? "—" : <strong>S/ {v.precio}</strong>}</td>
                        </tr>
                        {cuentasSaga
                          .filter((c) => cuentasMarcadas.includes(c.alias))
                          .map((c) => {
                            const o = v.preciosSaga[c.alias] || {};
                            const precio = dinero(o.precio) ?? dinero(v.precio);
                            const oferta = dinero(o.precioOferta) ?? dinero(v.precioOferta);
                            const faltanFechas = oferta !== null && (!o.ofertaInicio || !o.ofertaFin);
                            return (
                              <tr key={c.alias}>
                                <td><span className="pf-sello">SAGA</span> {c.nombre}</td>
                                <td>
                                  <input type="number" min="0" step="0.01" aria-label={`Precio en ${c.nombre}`} value={o.precio ?? ""} placeholder={v.precio === "" ? "" : `Web: ${v.precio}`} onChange={(e) => actualizarPrecioSaga(i, c.alias, { precio: e.target.value })} />
                                </td>
                                <td>
                                  <input type="number" min="0" step="0.01" aria-label={`Precio oferta en ${c.nombre}`} value={o.precioOferta ?? ""} placeholder={v.precioOferta === "" ? "" : `Web: ${v.precioOferta}`} onChange={(e) => actualizarPrecioSaga(i, c.alias, { precioOferta: e.target.value })} />
                                </td>
                                <td>
                                  <input type="date" aria-label={`Oferta desde en ${c.nombre}`} value={o.ofertaInicio ?? ""} onChange={(e) => actualizarPrecioSaga(i, c.alias, { ofertaInicio: e.target.value })} />
                                </td>
                                <td>
                                  <input type="date" aria-label={`Oferta hasta en ${c.nombre}`} value={o.ofertaFin ?? ""} onChange={(e) => actualizarPrecioSaga(i, c.alias, { ofertaFin: e.target.value })} />
                                </td>
                                <td>
                                  {precio === null ? (
                                    "—"
                                  ) : (
                                    <>
                                      <strong>S/ {precio}</strong>
                                      {oferta !== null && <span className="pf-precio-oferta"> oferta S/ {oferta}</span>}
                                      {o.precio === undefined || o.precio === "" ? <small className="pf-precio-hereda">usa el precio web</small> : null}
                                      {faltanFechas && <small className="pf-precio-aviso">⚠ SAGA exige las fechas de la oferta</small>}
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
            </div>
          </div>
        )}
      </div>

    </form>
  );
}

/** Iconos de línea de las pestañas del formulario de producto. */
function IconoPanelProducto({ id }) {
  const trazos = {
    producto: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0L12 12m9-4.5L12 12m0 9v-9" />,
    atributos: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    variantes: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />,
    conexion: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}

/** Iconos de línea de las pestañas de cada variante. */
function IconoVariante({ id }) {
  const trazos = {
    car: <path d="M4 20h4l10-10-4-4L4 16v4Zm9-13 4 4M14 20h6" />,
    pre: <path d="M6 8h12l1 12H5L6 8Zm3 0a3 3 0 0 1 6 0" />,
    inv: <path d="M4 7V4h3M20 7V4h-3M4 17v3h3m13-3v3h-3M8 8v8m3-8v8m3-8v8m3-8v8" />,
    mul: <path d="M4 6h16v12H4V6Zm0 9 4-4 4 4 3-3 5 5M15 9.5h.01" />,
  };
  return (
    <svg className="pf-vtab-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}
