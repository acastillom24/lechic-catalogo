"use client";

import { useActionState, useState } from "react";
import { guardarProducto, traerDatosSaga } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";
import { LIMITES, CALIDAD, GENERO_POR_CATEGORIA, validarProducto, advertenciasSaga } from "../../lib/saga-mapeo";
import { esCategoriaGeneral, heredarVariante, imagenesRequeridas, IMAGENES_TOPE } from "../../lib/saga-campos";
import ImagenesVariante from "./ImagenesVariante";
import SelectBuscador from "./SelectBuscador";
import CamposExtra from "./CamposExtra";
import AtributosProducto from "./AtributosProducto";
import SelectMulti from "./SelectMulti";
import { atributosDe, extrasConPropios, propiosDesdeSaga, mapaCampos } from "../../lib/atributos-categoria";
import { categoriasDePlataforma, permiteVariantesWeb } from "../../lib/equivalencias";
import { efectivoBase, personalizadosAFila } from "../../lib/atributos-efectivos";
import PackComponentes from "./PackComponentes";

import { IconoMas, IconoPapelera, IconoGuardar } from "./Iconos";
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

function nuevaVariante() {
  return {
    key: Math.random().toString(36).slice(2),
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
  const [idTocadoManualmente, setIdTocadoManualmente] = useState(modo === "editar");
  const [marca, setMarca] = useState(producto?.marca || marcas[0]?.slug || "");
  // Pestaña (ubicación en la web): independiente de la marca (la de SAGA). Al elegir marca se
  // autoselecciona su pestaña por defecto, pero se puede cambiar.
  const [pestana, setPestana] = useState(
    producto?.pestana || marcas.find((m) => m.slug === (producto?.marca || marcas[0]?.slug))?.pestanaDefault || pestanas[0]?.slug || ""
  );
  const pestanaObj = pestanas.find((p) => p.slug === pestana);
  const categorias = pestanaObj?.categorias || [];
  const [categoria, setCategoria] = useState(producto?.categoria || categorias[0]?.slug || "");
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
  const [avisoId, setAvisoId] = useState(false);

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
  });
  // Valores generales que heredan las variantes mientras no tengan uno propio.
  const [atributos, setAtributos] = useState({
    registroSanitario: sg.atributos?.registro_sanitario || deVariante.registroSanitario || "",
    varianteExtras: Object.keys(sg.atributos?.variante_extras || {}).length ? sg.atributos.variante_extras : deVariante.varianteExtras || {},
    propios: sg.atributos?.propios || {},
  });
  // Paquete propio por cuenta (solo las que se personalizaron; el resto usa el general del producto).
  const [paquetes, setPaquetes] = useState(() =>
    Object.fromEntries(Object.entries(paquetesCuenta).map(([alias, d]) => [alias, { personalizar: true, ...d }]))
  );
  // Categoría primaria propia por cuenta (solo las personalizadas; el resto usa la general): { alias: { personalizar, sagaCategoria, extras, varianteExtras } }.
  const [catCuenta, setCatCuenta] = useState(() =>
    Object.fromEntries(Object.entries(categoriasCuenta).map(([alias, d]) => [alias, { personalizar: true, ...d }]))
  );
  const [cuentasMarcadas, setCuentasMarcadas] = useState(sincronizadas);
  const esPerfume = ["feminine", "masculine", "couples"].includes(categoria);
  const conSaga = (!restringido || permitirSaga) && cuentasSaga.length > 0;
  // Con categoría SAGA elegida manda ella (perfumes = 1735, cualquier otra usa campos extra); sin elegir, la categoría web.
  const sagaGeneral = saga.sagaCategoria ? esCategoriaGeneral(saga.sagaCategoria) : !esPerfume;
  // Variantes y SKU padre solo si la categoría de la web lo permite (Configuración → Integraciones → Web).
  const permiteVar = permiteVariantesWeb(opcionesSaga.equivalencias, opcionesSaga.categorias, categoria);
  // Atributos propios de la categoría web (Configuración → SAGA → Atributos por categoría).
  const atribCategoria = atributosDe(opcionesSaga.atributosCategoria, categoria);
  const nombreCategoria = (categoriasOpc.find((c) => c.slug === categoria) || {}).nombre || "la categoría";
  const nombreCategoriaWeb = nombreCategoria;
  // Categorías de SAGA que equivalen a la categoría web (Configuración → Integraciones → Web). Solo se ofrecen esas;
  // si el producto ya tenía otra guardada, se conserva visible para no perderla en silencio.
  const idsEquivalentes = categoriasDePlataforma(opcionesSaga.equivalencias, categoria, "saga");
  const categoriasSagaOpc = (opcionesSaga.categorias || []).filter((c) => idsEquivalentes.includes(String(c.id)) || String(c.id) === String(saga.sagaCategoria));
  const skuPadreBloqueado = variantesSincronizadas.length > 0;
  const generoActual = saga.genero || GENERO_POR_CATEGORIA[categoria] || "";
  const lista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);

  const [variantes, setVariantes] = useState(() =>
    producto?.variantes?.length
      ? producto.variantes.map((v) => ({
          key: Math.random().toString(36).slice(2),
          nombre: v.nombre || "",
          precio: v.precio ?? "",
          precioOferta: v.precioOferta ?? "",
          stock: v.stock !== false,
          imagenes: (v.imagenes || []).map((url) => ({ key: Math.random().toString(36).slice(2), url })),
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
      : [nuevaVariante()]
  );

  // Categoría sin variantes: el producto es una sola ficha (si ya tenía varias de antes, se siguen mostrando todas).
  const sinVariantes = variantes.length <= 1;
  const nomV = (v) => (sinVariantes && !v.nombre.trim() ? "Único" : v.nombre);
  // Sin variantes la descripción es una sola (la del producto): la de la variante solo existe cuando hay varias.
  const attrsDe = (v) => (sinVariantes ? {} : v.attrs || {});

  function actualizarVariante(i, cambios) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...cambios } : v)));
  }

  // Atributos del PRODUCTO como un solo objeto (camelCase). Viven repartidos en `saga` y `atributos`.
  const attrsProducto = {
    condicion: saga.condicion, modelo: saga.modelo, paisProduccion: saga.paisProduccion, tipoPerfume: saga.tipoPerfume,
    genero: generoActual, formatoBelleza: saga.formatoBelleza, caracteristicas: saga.caracteristicas,
    contenidoPaquete: saga.contenidoPaquete, paqueteAncho: saga.paqueteAncho, paqueteLargo: saga.paqueteLargo,
    paqueteAlto: saga.paqueteAlto, paquetePeso: saga.paquetePeso,
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
  // «Copiar todo del producto»: la variante pasa a tener como propios todos los valores actuales del producto.
  function copiarTodoDelProducto(i) {
    const copia = JSON.parse(JSON.stringify({ ...attrsProducto, descripcion: descripcion }));
    setVariantes((prev) =>
      prev.map((v, idx) => {
        if (idx !== i) return v;
        const sig = {};
        for (const [k, val] of Object.entries(copia)) if (conValor(val)) sig[k] = val;
        return { ...v, attrs: sig };
      })
    );
  }
  // «Usar los del producto»: la variante vuelve a heredar todo.
  function usarLosDelProducto(i) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, attrs: {} } : v)));
  }

  const [traer, setTraer] = useState({});
  const [cuentaTraer, setCuentaTraer] = useState("");
  // Por defecto se consulta la cuenta de Le Chic; se puede cambiar por otra (Toque Chic u otra que se agregue después).
  const compacto = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const cuentaPorDefecto = cuentasSaga.find((c) => compacto(`${c.nombre}${c.alias}`).includes("lechic"))?.alias || cuentasMarcadas[0] || cuentasSaga[0]?.alias || "";
  const aliasTraer = cuentasSaga.some((c) => c.alias === cuentaTraer) ? cuentaTraer : cuentaPorDefecto;

  // Trae de SAGA los datos propios de SAGA de la variante i y completa SOLO los campos vacíos.
  // Nunca toca nombre, descripción, marca, precio web, imagen ni stock.
  async function traerDeSaga(i) {
    const v = variantes[i];
    setTraer((p) => ({ ...p, [v.key]: { cargando: true } }));
    const r = await traerDatosSaga(aliasTraer, v.sku);
    if (r?.error) {
      setTraer((p) => ({ ...p, [v.key]: { error: r.error } }));
      return;
    }
    const POR_DEFECTO = { paisProduccion: "Perú", condicion: "Nuevo", formatoBelleza: "Frasco" }; // valores precargados: se pueden reemplazar
    const vacio = (k, x) => x === "" || x === null || x === undefined || x === POR_DEFECTO[k] || (Array.isArray(x) && x.length === 0);
    const ETIQUETA = {
      codigoBarras: "Código de barras", volumen: "Medida del frasco", paisProduccion: "País", registroSanitario: "Registro sanitario",
      notasAromaticas: "Notas aromáticas", fraganciaPerfume: "Fragancia", descripcion: "Descripción", cantidadEmpaque: "Cantidad en el empaque",
      genero: "Género", formatoBelleza: "Formato belleza", sagaCategoria: "Categoría", modelo: "Modelo", tipoPerfume: "Tipo de perfume",
      caracteristicas: "Características", condicion: "Condición", contenidoPaquete: "Contenido del paquete", paqueteAncho: "Ancho",
      paqueteLargo: "Largo", paqueteAlto: "Alto", paquetePeso: "Peso", skuPadre: "SKU padre", usarSkuPadre: "Usar SKU padre",
      precio: "Precio SAGA", precioOferta: "Precio oferta SAGA", ofertaInicio: "Oferta desde", ofertaFin: "Oferta hasta",
    };
    const llenados = [];
    const conValor = [];
    const elegir = (nuevos, actuales) => {
      const cambios = {};
      for (const [k, nuevo] of Object.entries(nuevos)) {
        if (nuevo === "" || nuevo === null || nuevo === undefined || (Array.isArray(nuevo) && nuevo.length === 0)) continue;
        if ((skuPadreBloqueado || !permiteVar) && (k === "skuPadre" || k === "usarSkuPadre")) continue;
        if (k === "usarSkuPadre" ? actuales[k] !== true : vacio(k, actuales[k])) {
          cambios[k] = nuevo;
          llenados.push(ETIQUETA[k] || k);
        } else if (String(actuales[k]) !== String(nuevo)) {
          conValor.push(ETIQUETA[k] || k);
        }
      }
      return cambios;
    };
    // Sin variantes todo se llena en el producto. Con variantes, lo propio de la variante (medida, registro, fragancia,
    // descripción…) se llena en sus atributos y lo del producto (modelo, país, paquete…) en el producto.
    const { codigoBarras: sagaBarras, ...deVariante } = r.variante;
    const efectivoActual = sinVariantes ? { ...attrsProducto, descripcion } : { ...attrsProducto, ...v.attrs, descripcion: v.attrs?.descripcion || "" };
    const cambAttrsVar = elegir(deVariante, efectivoActual);
    const cambBarras = elegir({ codigoBarras: sagaBarras }, v);
    const cambVar = { ...cambBarras };
    const cambProd = elegir(r.producto, { ...saga, genero: saga.genero });
    const cambPrecios = elegir(r.precios, v.preciosSaga[aliasTraer] || {});
    // Si la variante aún no está registrada en esa cuenta, lo normal es vincularla (ya existe en SAGA).
    const sinRegistro = !estadoSync[v.id]?.[aliasTraer];
    if (sinVariantes) {
      // La descripción de SAGA llena la descripción del producto (la de la web) si está vacía.
      const { descripcion: descSaga, ...restoVar } = cambAttrsVar;
      if (descSaga !== undefined) setDescripcion(descSaga);
      if (Object.keys(restoVar).length) cambiarAttrsProducto(restoVar);
    }
    setVariantes((prev) =>
      prev.map((x, idx) =>
        idx === i
          ? {
              ...x,
              ...cambVar,
              attrs: !sinVariantes && Object.keys(cambAttrsVar).length ? { ...x.attrs, ...cambAttrsVar } : x.attrs,
              preciosSaga: { ...x.preciosSaga, [aliasTraer]: { ...(x.preciosSaga[aliasTraer] || {}), ...cambPrecios } },
              acciones: sinRegistro ? { ...x.acciones, [aliasTraer]: "vincular" } : x.acciones,
            }
          : x
      )
    );
    if (Object.keys(cambProd).length) setSaga((prev) => ({ ...prev, ...cambProd }));
    // Atributos propios de la categoría: se llenan desde su campo equivalente de SAGA (Configuración → Atributos por categoría).
    const atribsEnlazados = atributosDe(opcionesSaga.atributosCategoria, categoria);
    const mapaTraer = mapaCampos(opcionesSaga.equivalencias, categoria, "saga", r.producto?.sagaCategoria || saga.sagaCategoria);
    const desdeSagaAtribs = propiosDesdeSaga(atribsEnlazados, mapaTraer, r.extras);
    const nuevosPropios = {};
    for (const [aid, valor] of Object.entries(desdeSagaAtribs.valores)) {
      const etq = atribsEnlazados.find((x) => x.id === aid)?.etiqueta || aid;
      const actual = (sinVariantes ? atributos.propios : { ...atributos.propios, ...(v.attrs?.propios || {}) })?.[aid];
      if (actual === undefined || actual === "" || (Array.isArray(actual) && actual.length === 0)) {
        nuevosPropios[aid] = valor;
        llenados.push(etq);
      } else if (JSON.stringify(actual) !== JSON.stringify(valor)) {
        conValor.push(etq);
      }
    }
    if (Object.keys(nuevosPropios).length) {
      if (sinVariantes) setAtributos((prev) => ({ ...prev, propios: { ...prev.propios, ...nuevosPropios } }));
      else setVariantes((prev) => prev.map((x, idx) => (idx === i ? { ...x, attrs: { ...x.attrs, propios: { ...(x.attrs?.propios || {}), ...nuevosPropios } } } : x)));
    }
    setTraer((p) => ({ ...p, [v.key]: { llenados, conValor, avisos: [...(r.avisos || []), ...desdeSagaAtribs.avisos] } }));
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
      const base = prev.length === 1 && !prev[0].nombre.trim() ? [{ ...prev[0], nombre: "Variante 1" }] : prev;
      return [...base, { ...nuevaVariante(), abierta: true }];
    });
    // La sección «Variantes» se muestra al tener más de una: se deja abierta para ver la nueva.
    setTimeout(() => {
      const d = document.getElementById("pf-variantes");
      if (d) d.open = true;
    }, 50);
  }

  function quitarVariante(i) {
    setVariantes((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
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
    if (!cats.some((c) => c.slug === categoria)) elegirCategoria(cats[0]?.slug || "");
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
  const nombreSagaDe = (v) => (v.sagaCombinarNombre !== false && v.nombre && v.nombre !== "Único" ? `${nombre} ${v.nombre}` : nombre);
  const largoNombreSaga = Math.max(0, ...variantes.map((v) => nombreSagaDe(v).length));
  const fueraDeRangoNombre = (n) => n < CALIDAD.tituloMin || n > CALIDAD.tituloMax;
  // Aviso (no impide guardar) bajo el nombre del producto: SAGA pide títulos de 20 a 100 caracteres.
  const avisoNombre =
    !conSaga || nombre.trim() === ""
      ? null
      : largoNombreSaga > LIMITES.texto
        ? { rojo: true, texto: `Muy largo para SAGA: máximo ${LIMITES.texto} caracteres y queda en ${largoNombreSaga}. Acórtalo${sinVariantes ? "" : " o desmarca «Combinar nombre» en la variante"}.` }
        : fueraDeRangoNombre(largoNombreSaga)
          ? { rojo: false, texto: `SAGA pide de ${CALIDAD.tituloMin} a ${CALIDAD.tituloMax} caracteres en el nombre y tiene ${largoNombreSaga}${sinVariantes ? "" : " (la variante más larga)"}; fuera de ese rango baja la calificación.` }
          : null;

  // Avisos de calidad de SAGA (título 20–100, descripción ≥ 50): advierten, no impiden guardar.
  const avisosCalidad = (v) =>
    conSaga
      ? advertenciasSaga({ nombre, descripcion }, { nombre: nomV(v), descripcion: attrsDe(v).descripcion || "", saga_combinar_nombre: v.sagaCombinarNombre })
      : [];
  const avisosPorVariante = variantes.map(avisosCalidad);

  // Acción de la variante en una cuenta: la elegida o, por defecto, crear (variantes nuevas o ya enviadas).
  const accionDe = (v, alias) =>
    v.acciones[alias] ?? (v.id && !variantesSincronizadas.map(String).includes(String(v.id)) ? "ninguna" : "crear");

  function cambiarPaquete(alias, cambios) {
    setPaquetes((prev) => {
      const actual = prev[alias] || { personalizar: false };
      // Al personalizar por primera vez se parte de una copia del general.
      const base = cambios.personalizar && !actual.contenidoPaquete && actual.paqueteAncho === undefined
        ? { contenidoPaquete: saga.contenidoPaquete, paqueteAncho: saga.paqueteAncho, paqueteLargo: saga.paqueteLargo, paqueteAlto: saga.paqueteAlto, paquetePeso: saga.paquetePeso }
        : {};
      return { ...prev, [alias]: { ...base, ...actual, ...cambios } };
    });
  }

  function cambiarCategoriaCuenta(alias, cambios) {
    setCatCuenta((prev) => ({ ...prev, [alias]: { personalizar: false, extras: {}, varianteExtras: {}, ...prev[alias], ...cambios } }));
  }

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
      paquete_ancho: num(saga.paqueteAncho), paquete_largo: num(saga.paqueteLargo),
      paquete_alto: num(saga.paqueteAlto), paquete_peso: num(saga.paquetePeso),
      usar_sku_padre: permiteVar && saga.usarSkuPadre,
      volumen: saga.volumen || null, cantidad_empaque: saga.cantidadEmpaque || null,
      fragancia_perfume: saga.fraganciaPerfume, notas_aromaticas: saga.notasAromaticas || null, saga_extras: saga.extras,
      atributos: { registro_sanitario: atributos.registroSanitario, variante_extras: atributos.varianteExtras, propios: atributos.propios },
    };
    const pers = personalizadosAFila(attrsDe(v));
    const vr = {
      nombre: nomV(v), sku: v.sku, descripcion: pers.columnas.descripcion, volumen: pers.columnas.volumen,
      cantidad_empaque: pers.columnas.cantidad_empaque, registro_sanitario: pers.columnas.registro_sanitario,
      fragancia_perfume: pers.columnas.fragancia_perfume, notas_aromaticas: pers.columnas.notas_aromaticas, saga_combinar_nombre: v.sagaCombinarNombre,
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
    return validarProducto(p, heredarVariante(p.atributos, ef.v), opcionesSaga);
  }
  // Cada cuenta puede tener sus propios precios: se valida por cuenta. Lo que falta en todas se lista una vez.
  function faltantesPorCuenta(v) {
    // Solo se exige todo en las cuentas donde se va a crear; vincular no envía datos.
    const aliases = cuentasMarcadas.filter((a) => accionDe(v, a) === "crear");
    if (!aliases.length) return { comunes: [], propios: [], total: 0 };
    const porCuenta = aliases.map((a) => ({ alias: a, items: faltantesSaga(v, a) }));
    const comunes = porCuenta[0].items.filter((f) => porCuenta.every((c) => c.items.includes(f)));
    const propios = porCuenta
      .map((c) => ({ alias: c.alias, items: c.items.filter((f) => !comunes.includes(f)) }))
      .filter((c) => c.items.length);
    return { comunes, propios, total: comunes.length + propios.reduce((n, c) => n + c.items.length, 0) };
  }
  const nombreCuenta = (alias) => cuentasSaga.find((c) => c.alias === alias)?.nombre || alias;
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
      sagaCombinarNombre: v.sagaCombinarNombre,
      preciosSaga: v.preciosSaga,
      acciones: Object.fromEntries(cuentasMarcadas.map((a) => [a, accionDe(v, a)])),
    }))
  );

  const etiquetaAccion = (modoAccion) =>
    ({ ninguna: "No enviar", crear: "Crear en SAGA", desvincular: "Dejar de sincronizar" })[modoAccion] ||
    (opcionesSaga.acciones || []).find((x) => x.id === modoAccion)?.nombre ||
    modoAccion;

  const estadoSagaChip = cuentasMarcadas.length > 0 && (
    <span className={variantesIncompletas ? "chip-saga aviso" : "chip-saga ok"}>
      {variantesIncompletas
        ? `SAGA: ${variantesIncompletas} variante${variantesIncompletas === 1 ? "" : "s"} con datos pendientes`
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
  const controlTraer = (v, i) =>
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
          disabled={!v.sku.trim() || !aliasTraer || traer[v.key]?.cargando}
          onClick={() => traerDeSaga(i)}
          aria-label="Traer datos de SAGA"
          title={v.sku.trim() ? `Traer datos de SAGA (${cuentasSaga.find((c) => c.alias === aliasTraer)?.nombre || ""}). Solo completa campos vacíos.` : "Escribe el SKU para traer los datos de SAGA"}
        >
          {traer[v.key]?.cargando ? (
            <span aria-hidden="true">…</span>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
            </svg>
          )}
        </button>
      </>
    );
  const mensajesTraer = (v) =>
    conSaga && (traer[v.key]?.error || traer[v.key]?.llenados) ? (
      <div className="pf-traer-panel">
        {traer[v.key]?.error && <small style={{ color: "#b3261e" }}>{traer[v.key].error}</small>}
        {traer[v.key]?.llenados && (
          <small style={{ color: "var(--gris)", display: "block" }}>
            {traer[v.key].llenados.length
              ? `Se completaron: ${traer[v.key].llenados.join(", ")}.`
              : "No había campos vacíos que completar."}
            {traer[v.key].conValor.length > 0 && ` Ya tenían otro valor (no se cambiaron): ${traer[v.key].conValor.join(", ")}.`}
            {traer[v.key].avisos.map((a) => ` ${a}`)}
          </small>
        )}
      </div>
    ) : null;

  // Datos de SAGA de una variante (acciones por cuenta, nombre/descripción, medida y fragancia). Sin variantes va a nivel de producto.
  const bloqueSaga = (v, i, solo = false) => (
                <details className="pf-bloque pf-bloque-saga saga-seccion">
                  <summary>
                    <span className="pf-sello">SAGA</span> {solo ? "Datos de SAGA del producto" : "Datos de esta variante"}
                    {cuentasMarcadas.length > 0 && (
                      <span className={faltantesPorVariante[i].total ? "chip-saga aviso" : "chip-saga ok"}>
                        {cuentasMarcadas.some((a) => accionDe(v, a) === "crear")
                          ? faltantesPorVariante[i].total ? `Faltan ${faltantesPorVariante[i].total}` : "Completa"
                          : cuentasMarcadas.some((a) => !["ninguna", "crear", "desvincular"].includes(accionDe(v, a))) ? "Vinculada" : "Sin envío"}
                      </span>
                    )}
                  </summary>
                  <div className="form-grid saga-cuerpo">
                    {faltantesPorVariante[i].total > 0 && (
                      <ul className="saga-faltantes">
                        {faltantesPorVariante[i].comunes.map((f) => <li key={f}>{f}</li>)}
                        {faltantesPorVariante[i].propios.map((c) => (
                          <li key={c.alias}>
                            <strong>En {nombreCuenta(c.alias)}:</strong> {c.items.join("; ")}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="campo">
                      {!solo && (
                      <label className="campo-check">
                        <input
                          type="checkbox"
                          checked={v.sagaCombinarNombre}
                          onChange={(e) => actualizarVariante(i, { sagaCombinarNombre: e.target.checked })}
                        />
                        Combinar nombre del producto + nombre de la variante
                      </label>
                      )}
                      {(() => {
                        const enSaga = nombreSagaDe(v);
                        const excede = enSaga.length > LIMITES.texto;
                        const aviso = !excede && fueraDeRangoNombre(enSaga.trim().length);
                        return (
                          <small style={{ color: excede ? "#b3261e" : aviso ? "#9a6700" : "var(--gris)" }}>
                            En SAGA se verá: <strong>{enSaga || "—"}</strong> ({enSaga.trim().length} caracteres; SAGA pide de {CALIDAD.tituloMin} a {CALIDAD.tituloMax}).
                            {excede ? " Es demasiado largo para SAGA: acórtalo." : ""}
                            {aviso ? " ⚠ Fuera de ese rango SAGA baja la calificación del producto." : ""}
                            {!v.sagaCombinarNombre && " Solo se envía el nombre del producto."}
                          </small>
                        );
                      })()}
                    </div>

                    {avisosPorVariante[i].some((a) => a.startsWith("Descripción")) && (
                      <small style={{ color: "#9a6700" }}>
                        ⚠ {avisosPorVariante[i].find((a) => a.startsWith("Descripción"))}
                      </small>
                    )}
                  </div>
                </details>
  );

  // Activa / pack / quitar de una variante (en un producto sin variantes van junto a «Destacado»).
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
                  {!restringido && variantes.length > 1 && (
                    <button type="button" className="btn-admin peligro pf-var-quitar" onClick={() => quitarVariante(i)}>
                      Quitar variante
                    </button>
                  )}
    </>
  );
  // Precio, stock, costo y composición de pack de una variante.
  const bloquePrecioStock = (v, i) => (
    <div className="pf-bloque">
      <h5>Precio y stock</h5>
      {!restringido && (
        <label className="campo-check">
          <input
            type="checkbox"
            checked={v.esPack}
            onChange={(e) => actualizarVariante(i, { esPack: e.target.checked })}
          />
          Es un pack (su stock depende de otros productos)
        </label>
      )}
      <div className="pf-grid-4">
        <div className="campo">
          <label>Precio (S/)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={v.precio}
            onChange={(e) => actualizarVariante(i, { precio: e.target.value })}
          />
        </div>
        <div className="campo">
          <label>Precio de oferta (opcional)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={v.precioOferta}
            onChange={(e) => actualizarVariante(i, { precioOferta: e.target.value })}
          />
        </div>
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
                <input
                  type="checkbox"
                  checked={v.stock}
                  onChange={(e) => actualizarVariante(i, { stock: e.target.checked })}
                />
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
            <label>Stock (cantidad)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={v.stockCantidad}
              onChange={(e) => actualizarVariante(i, { stockCantidad: e.target.value })}
              placeholder="Sin control de cantidad"
            />
            {v.stockCantidad === "" && v.stockActual === null ? (
              <label className="campo-check">
                <input
                  type="checkbox"
                  checked={v.stock}
                  onChange={(e) => actualizarVariante(i, { stock: e.target.checked })}
                />
                Con stock disponible
              </label>
            ) : (
              <small>
                Al guardar se registra el ajuste en el historial.{" "}
                {v.stockActual !== null && (
                  <a href={`/admin?q=${encodeURIComponent(v.sku || nombre)}`}>Ver en Inventario</a>
                )}
              </small>
            )}
          </div>
        ) : null}
        {!restringido && !v.esPack && (
          <>
            <div className="campo">
              <label>Stock mínimo (alerta y colchón en SAGA)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={v.stockMinimo}
                onChange={(e) => actualizarVariante(i, { stockMinimo: e.target.value })}
              />
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
            <div className="campo">
              <label>Costo (S/, opcional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={v.costo}
                onChange={(e) => actualizarVariante(i, { costo: e.target.value })}
              />
            </div>
          </>
        )}
      </div>
      {!restringido && v.esPack && (
        <PackComponentes
          componentes={v.componentes}
          onChange={(componentes) => actualizarVariante(i, { componentes })}
          opciones={variantesPack}
          idPropio={v.id}
        />
      )}
    </div>
  );
  // Imágenes de una variante.
  const bloqueImagenes = (v, i) => (
    <div className="pf-bloque">
      <h5>Imágenes</h5>
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
    </div>
  );

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
        <option value="ninguna">No enviar</option>
        <option value="crear">Crear en SAGA (SKU nuevo)</option>
        {(opcionesSaga.acciones || []).map((x) => (
          <option key={x.id} value={x.id}>{x.nombre}</option>
        ))}
        {registrada && <option value="desvincular">Dejar de sincronizar</option>}
      </select>
    );
  };
  // Lo que falta para publicar una variante (comunes a las cuentas y propio de cada una).
  const listaFaltantes = (i) =>
    faltantesPorVariante[i].total > 0 && (
      <ul className="saga-faltantes">
        {faltantesPorVariante[i].comunes.map((f) => <li key={f}>{f}</li>)}
        {faltantesPorVariante[i].propios.map((c) => (
          <li key={c.alias}>
            <strong>En {nombreCuenta(c.alias)}:</strong> {c.items.join("; ")}
          </li>
        ))}
      </ul>
    );

  // Las secciones principales arrancan abiertas y todo lo de adentro minimizado. Al navegar o fallar la validación del navegador se abren las secciones que contienen el campo.
  function abrirContenedores(e) {
    let d = e.target.closest?.("details");
    while (d) {
      d.open = true;
      d = d.parentElement?.closest("details");
    }
  }
  function irASeccion(e) {
    const a = e.target.closest?.("a[href^='#']");
    if (!a) return;
    const destino = document.getElementById(a.getAttribute("href").slice(1));
    if (!destino) return;
    e.preventDefault();
    if (destino.tagName === "DETAILS") destino.open = true;
    abrirContenedores({ target: destino });
    destino.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <form action={accion} className="pf" onInvalidCapture={abrirContenedores}>
      {conSaga && <input type="hidden" name="sagaCampos" value="1" />}
      {conSaga && <input type="hidden" name="sagaExtras" value={JSON.stringify(saga.extras)} />}
      {conSaga && <input type="hidden" name="paquetesJson" value={JSON.stringify(paquetes)} />}
      {conSaga && <input type="hidden" name="categoriasCuentaJson" value={JSON.stringify(catCuenta)} />}
      {conSaga && (
        <input type="hidden" name="atributosGenerales" value={JSON.stringify({ registro_sanitario: atributos.registroSanitario, variante_extras: atributos.varianteExtras, propios: atributos.propios })} />
      )}

      <input type="hidden" name="modo" value={modo} />
      {modo === "editar" && <input type="hidden" name="idOriginal" value={producto.id} />}
      <input type="hidden" name="variantesJson" value={variantesJson} />

      {/* Barra pegajosa: estado, navegación por secciones y Guardar siempre a mano. */}
      <div className="pf-barra">
        <div className="pf-barra-info">
          <strong>{nombre.trim() || (modo === "crear" ? "Nuevo producto" : "Producto")}</strong>
          {!sinVariantes && <span className="chip-saga">{variantes.length} variante{variantes.length === 1 ? "" : "s"}</span>}
          {conSaga && estadoSagaChip}
        </div>
        <nav className="pf-nav" aria-label="Secciones del formulario" onClick={irASeccion}>
          <a href="#pf-web">Web</a>
          {conSaga && <a href="#pf-plataformas">Plataformas</a>}
          {!sinVariantes && <a href="#pf-variantes">Variantes</a>}
          {conSaga && <a href="#pf-precios">Precios</a>}
        </nav>
        {botonGuardar}
      </div>

      {estado?.error && <div className="mensaje-error">{estado.error}</div>}

      {/* ===== 1. Datos de la web ===== */}
      <details id="pf-web" className="pf-seccion pf-seccion-plegable" open>
        <summary className="pf-seccion-cab">
          <div>
            <h3>Datos de la web</h3>
            <small>Lo que ven tus clientes en el catálogo y los atributos del producto.</small>
          </div>
          {nombre.trim() && <span className="pf-seccion-resumen">{nombre.trim()}</span>}
        </summary>

        <div className="pf-subs">
          <details id="pf-ident" className="saga-seccion pf-sub">
            <summary>
              Identificación <em>categoría, marca, nombre y SKU</em>
            </summary>
            <div className="saga-cuerpo pf-sub-cuerpo">
            <div className="pf-grid-3">
              <div className="campo">
                <label htmlFor="categoria">Categoría</label>
                <select
                  id="categoria"
                  name="categoria"
                  value={categoria}
                  onChange={(e) => elegirCategoria(e.target.value)}
                >
                  {categoriasOpc.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="marca">Marca</label>
                <select id="marca" name="marca" value={marca} onChange={(e) => alCambiarMarca(e.target.value)}>
                  {marcasOpc.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="pestana">Pestaña (dónde se muestra en la web)</label>
                <select id="pestana" name="pestana" value={pestana} onChange={(e) => alCambiarPestana(e.target.value)}>
                  {pestanasOpc.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pf-grid-2">
              <div className="campo">
                <label htmlFor="nombre">Nombre del producto</label>
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
              <div className="campo">
                <label htmlFor="id">Id (parte de la URL)</label>
                {modo === "editar" ? (
                  <>
                    <input
                      id="id"
                      name="id"
                      type="text"
                      value={id}
                      readOnly
                      aria-readonly="true"
                      className="pf-id-bloqueado"
                      title="El id es parte de la URL del producto y no se puede cambiar"
                      onFocus={() => setAvisoId(true)}
                      onClick={() => setAvisoId(true)}
                      onBlur={() => setAvisoId(false)}
                    />
                    {avisoId && <small>El id es parte de la URL del producto y no se puede cambiar.</small>}
                  </>
                ) : (
                  <input
                    id="id"
                    name="id"
                    type="text"
                    value={id}
                    onChange={(e) => {
                      setIdTocadoManualmente(true);
                      setId(e.target.value);
                    }}
                    placeholder="se genera solo a partir del nombre"
                  />
                )}
              </div>
              {sinVariantes && (
                <div className="campo">
                  <label htmlFor="skuProducto">SKU del producto</label>
                  <div className="pf-sku-grupo">
                    <input
                      id="skuProducto"
                      type="text"
                      value={variantes[0].sku}
                      onChange={(e) => actualizarVariante(0, { sku: e.target.value })}
                      placeholder="Ej: YB-ROSA-50"
                    />
                    {controlTraer(variantes[0], 0)}
                  </div>
                  {mensajesTraer(variantes[0])}
                </div>
              )}
              {!sinVariantes && (
                <div className="campo">
                  <label htmlFor="skuPadre">SKU padre</label>
                  <input
                    id="skuPadre"
                    name="skuPadre"
                    type="text"
                    value={saga.skuPadre}
                    onChange={(e) => cambiarSaga({ skuPadre: e.target.value })}
                    placeholder="Código que agrupa las variantes"
                  />
                  {!skuPadreBloqueado && (
                    <small>Agrupa las variantes. SAGA lo usa solo si marcas «Usar SKU padre» en Plataformas (vacío = id del producto).</small>
                  )}
                </div>
              )}
              {sinVariantes && conSaga && (
                <div className="campo">
                  <label htmlFor="codigoBarrasProducto">Código de barras</label>
                  <input id="codigoBarrasProducto" type="text" value={variantes[0].codigoBarras} onChange={(e) => actualizarVariante(0, { codigoBarras: e.target.value })} />
                </div>
              )}
            </div>
            </div>
          </details>

          <details id="pf-desc" className="saga-seccion pf-sub">
            <summary>
              Descripción y visibilidad
              {destacado && <span className="chip-saga">Destacado</span>}
              {sinVariantes && !variantes[0].activo && <span className="chip-saga aviso">Inactivo</span>}
            </summary>
            <div className="saga-cuerpo pf-sub-cuerpo">
            <div className="campo">
              <label htmlFor="descripcion">Descripción</label>
              <textarea
                id="descripcion"
                name="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

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
                {sinVariantes && opcionesVariante(variantes[0], 0)}
              </div>
            </div>
          </details>

          {sinVariantes && (
            <details id="pf-precio" className="saga-seccion pf-sub">
              <summary>
                Precio y stock
                <em>
                  {variantes[0].precio === "" ? "sin precio" : `S/ ${variantes[0].precio}`}
                  {" · "}
                  {variantes[0].esPack ? `pack ${variantes[0].stockPack}` : variantes[0].stockCantidad !== "" ? `stock ${variantes[0].stockCantidad}` : variantes[0].stock ? "con stock" : "sin stock"}
                </em>
              </summary>
              <div className="saga-cuerpo pf-sub-cuerpo pf-sub-plano">{bloquePrecioStock(variantes[0], 0)}</div>
            </details>
          )}

          {sinVariantes && (
            <details id="pf-imagenes" className="saga-seccion pf-sub">
              <summary>
                Imágenes
                <em>{variantes[0].imagenes.length ? `${variantes[0].imagenes.length} imagen${variantes[0].imagenes.length === 1 ? "" : "es"}` : "sin imágenes"}</em>
              </summary>
              <div className="saga-cuerpo pf-sub-cuerpo pf-sub-plano">{bloqueImagenes(variantes[0], 0)}</div>
            </details>
          )}

          <details id="pf-atributos" className="saga-seccion pf-sub">
            <summary>
              Atributos del producto <em>{nombreCategoria}</em>
            </summary>
            <div className="saga-cuerpo pf-sub-cuerpo">
            <AtributosProducto
              valores={attrsProducto}
              onChange={cambiarAttrsProducto}
              prefijo="prod"
              conSaga={conSaga}
              sagaGeneral={sagaGeneral}
              opcionesSaga={opcionesSaga}
              atribCategoria={atribCategoria}
              nombreCategoria={nombreCategoria}
              sinVariantes={sinVariantes}
            />
            </div>
          </details>
        </div>

        {/* Variantes: solo en categorías que las permiten (Configuración → SAGA). Cada una repite estos atributos y hereda los del producto. */}
        {sinVariantes && permiteVar && !restringido && (
          <div className="pf-agregar-variante">
            <button type="button" className="btn-ico-texto" onClick={agregarVariante}>
              <IconoMas /> Agregar variante
            </button>
            <small>Cada variante repite estos atributos y hereda los del producto; solo cambias lo que la distingue.</small>
          </div>
        )}
      </details>

      {/* ===== 2. Plataformas (SAGA) ===== */}
      {conSaga && (
        <details id="pf-plataformas" className="pf-seccion pf-seccion-saga pf-seccion-plegable" open>
          <summary className="pf-seccion-cab">
            <div>
              <h3>Plataformas</h3>
              <small>Elige dónde publicar y cómo. Cada plataforma se puede plegar; sus datos no se muestran en la web.</small>
            </div>
          </summary>

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
                        <span className="pf-cuenta-estado">{marcada ? "Se publica aquí" : "No publicar"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Tipo de vinculación o creación */}
              <div className="pf-paso">
                <div className="pf-paso-cab">
                  <span className="pf-paso-n">2</span>
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
                            </td>
                            {cuentasSaga.filter((c) => cuentasMarcadas.includes(c.alias)).map((c) => <td key={c.alias}>{selectorAccion(v, i, c)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sinVariantes && cuentasMarcadas.length > 0 && listaFaltantes(0)}
              </div>

              {/* 3. Categoría primaria */}
              <div className="pf-paso">
                <div className="pf-paso-cab">
                  <span className="pf-paso-n">3</span>
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

              {/* 4. SKU padre */}
              <div className={permiteVar ? "pf-paso" : "pf-paso pf-paso-apagado"}>
                <div className="pf-paso-cab">
                  <span className="pf-paso-n">4</span>
                  <div>
                    <strong>SKU padre</strong>
                    <small>
                      {!permiteVar
                        ? "No disponible: esta categoría no maneja variantes (se activa en Configuración → SAGA)."
                        : skuPadreBloqueado
                          ? "Ya se envió a SAGA: no se puede cambiar."
                          : "Agrupa las variantes en una sola ficha de SAGA. Sin marcar, cada variante es un producto suelto."}
                    </small>
                  </div>
                </div>
                <label className="campo-check">
                  <input
                    type="checkbox"
                    name="usarSkuPadre"
                    checked={permiteVar && saga.usarSkuPadre}
                    disabled={skuPadreBloqueado || !permiteVar}
                    onChange={(e) => cambiarSaga({ usarSkuPadre: e.target.checked })}
                  />
                  Usar SKU padre
                </label>
                {permiteVar && saga.usarSkuPadre && (
                  <div className="campo">
                    <small>
                      SKU padre en SAGA: <strong>{(skuPadreBloqueado ? producto?.saga?.skuPadre || producto?.id : saga.skuPadre) || id || "(id del producto)"}</strong>
                      {skuPadreBloqueado
                        ? " — ya se envió: no cambia aunque edites el de la web."
                        : " — sale del SKU padre de Identificación. Queda guardado en el primer envío y se reutiliza al agregar variantes."}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </details>
        </details>
      )}

      {/* ===== 4. Variantes (solo cuando hay más de una; con una sola, todo va en el producto) ===== */}
      {!sinVariantes && (
      <details id="pf-variantes" className="pf-seccion pf-seccion-plegable" open>
        <summary className="pf-seccion-cab">
          <div>
            <h3>Variantes</h3>
            <small>
              {permiteVar
                ? "Cada variante tiene su precio, stock, imágenes y atributos; lo que no personalices lo hereda del producto."
                : "Esta categoría ya no maneja variantes: no se pueden agregar más (se activa en Configuración → SAGA)."}
            </small>
          </div>
          {permiteVar && (
            <button type="button" className="btn-ico-texto" onClick={agregarVariante}>
              <IconoMas /> Agregar variante
            </button>
          )}
        </summary>

        {variantes.map((v, i) => (
          <details className="pf-variante" key={v.key} id={`pf-var-${i}`} open={v.abierta === true}>
            <summary className="pf-var-resumen">
              <span className="pf-var-n">{i + 1}</span>
              <strong className="pf-var-nombre">{v.nombre.trim() || "Sin nombre"}</strong>
              <span className="pf-var-dato">{v.sku ? `SKU ${v.sku}` : "Sin SKU"}</span>
              <span className="pf-var-dato">{v.precio === "" ? "Sin precio" : `S/ ${v.precio}`}</span>
              <span className="pf-var-dato">
                {v.esPack
                  ? `Pack · ${v.stockPack}`
                  : v.stockCantidad !== ""
                    ? `Stock ${v.stockCantidad}`
                    : v.stock ? "Con stock" : "Sin stock"}
              </span>
              {!v.activo && <span className="chip-saga aviso">Inactiva</span>}
              {v.esPack && <span className="chip-saga">Pack</span>}
              {conSaga && cuentasMarcadas.length > 0 && (
                <span className={faltantesPorVariante[i].total ? "chip-saga aviso" : "chip-saga ok"}>
                  {faltantesPorVariante[i].total ? `SAGA: faltan ${faltantesPorVariante[i].total}` : "SAGA: ok"}
                </span>
              )}
            </summary>

            <div className="pf-var-cuerpo">
              <div className="pf-var-opciones">{opcionesVariante(v, i)}</div>

              {!sinVariantes && (
              <div className="pf-bloque">
                <h5>Identificación</h5>
                <div className="pf-grid-3">
                  <div className="campo">
                    <label>Nombre de la variante</label>
                    <input
                      type="text"
                      value={v.nombre}
                      onChange={(e) => actualizarVariante(i, { nombre: e.target.value })}
                      placeholder='Ej: "Único", "50 ml", "Rosa"'
                    />
                  </div>
                  <div className="campo">
                    <label>SKU (código único, enlaza con facturación)</label>
                    <div className="pf-sku-grupo">
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => actualizarVariante(i, { sku: e.target.value })}
                        placeholder="Ej: YB-ROSA-50"
                      />
                      {controlTraer(v, i)}
                    </div>
                    {mensajesTraer(v)}
                  </div>
                  {conSaga && (
                    <div className="campo">
                      <label>Código de barras</label>
                      <input type="text" value={v.codigoBarras} onChange={(e) => actualizarVariante(i, { codigoBarras: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>
              )}

              {bloquePrecioStock(v, i)}

              {bloqueImagenes(v, i)}

              {!sinVariantes && (
                <details className="pf-bloque saga-seccion pf-var-attrs">
                  <summary>
                    Atributos de esta variante
                    <em>
                      {Object.keys(v.attrs || {}).length
                        ? `${Object.keys(v.attrs).length} personalizado${Object.keys(v.attrs).length === 1 ? "" : "s"}`
                        : "iguales a los del producto"}
                    </em>
                  </summary>
                  <div className="saga-cuerpo form-grid">
                    <div className="pf-var-attrs-acciones">
                      <button type="button" className="btn-ico-texto" onClick={() => copiarTodoDelProducto(i)} title="Llena todos los atributos de esta variante con los valores actuales del producto, para editarlos desde ahí">
                        Copiar todo del producto
                      </button>
                      <button type="button" className="btn-ico-texto" disabled={!Object.keys(v.attrs || {}).length} onClick={() => usarLosDelProducto(i)} title="Quita lo personalizado: la variante vuelve a usar los atributos del producto">
                        Usar los del producto
                      </button>
                      <small>Lo que dejes vacío usa el valor del producto («= producto»); si cambias el producto, la variante lo sigue.</small>
                    </div>
                    <AtributosProducto
                      valores={v.attrs || {}}
                      onChange={(c) => cambiarAttrsVariante(i, c)}
                      heredados={{ ...attrsProducto, descripcion }}
                      prefijo={`var${i}`}
                      conSaga={conSaga}
                      sagaGeneral={sagaGeneral}
                      opcionesSaga={opcionesSaga}
                      atribCategoria={atribCategoria}
                      nombreCategoria={nombreCategoria}
                    />
                  </div>
                </details>
              )}
              {conSaga && !sinVariantes && bloqueSaga(v, i)}
            </div>
          </details>
        ))}
      </details>
      )}

      {/* ===== 5. Precios por plataforma: solo las cuentas marcadas en «Plataformas» ===== */}
      {conSaga && (
        <details id="pf-precios" className="pf-seccion pf-precios pf-seccion-plegable" open>
          <summary className="pf-seccion-cab">
            <div>
              <h3>Precios por plataforma</h3>
              <small>
                Lo que se publica en cada cuenta marcada. Si dejas un campo vacío, la plataforma usa el precio de la web.
              </small>
            </div>
          </summary>

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
        </details>
      )}
      <div className="pf-pie">{botonGuardar}</div>
    </form>
  );
}
