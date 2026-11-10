"use client";

import { useActionState, useState } from "react";
import { guardarProducto, traerDatosSaga } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";
import { LIMITES, GENERO_POR_CATEGORIA, validarProducto } from "../../lib/saga-mapeo";
import { camposActivos, esCategoriaGeneral } from "../../lib/saga-campos";
import SelectBuscador from "./SelectBuscador";
import CamposExtra from "./CamposExtra";
import PackComponentes from "./PackComponentes";
import ResumenPlataformas from "./ResumenPlataformas";

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
    aromas: "",
    imagenExistente: null,
    previewLocal: null,
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
    sagaExtras: {},
    codigoBarras: "",
    volumen: "",
    registroSanitario: "",
    descripcion: "",
    cantidadEmpaque: "",
    aromasSaga: [],
    notasSaga: "",
    sagaCombinarNombre: true,
    preciosSaga: {},
    acciones: {},
  };
}

export default function ProductoForm({ modo, marcas, pestanas = [], producto, accionGuardar, restringido = false, permitirSaga = false, cuentasSaga = [], sincronizadas = [], variantesSincronizadas = [], estadoSync = {}, preciosCanal = {}, opcionesSaga = {}, variantesPack = [] }) {
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
  const [descripcion, setDescripcion] = useState(producto?.descripcion || "");
  const [destacado, setDestacado] = useState(!!producto?.destacado);
  const [aromasProducto, setAromasProducto] = useState((producto?.aromas || []).join(", "));

  const sg = producto?.saga || {};
  const [saga, setSaga] = useState({
    sagaCategoria: sg.sagaCategoria || "",
    skuPadre: sg.skuPadre || "",
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
  });
  const [cuentasMarcadas, setCuentasMarcadas] = useState(sincronizadas);
  const esPerfume = ["feminine", "masculine", "couples"].includes(categoria);
  const conSaga = (!restringido || permitirSaga) && cuentasSaga.length > 0;
  // Con categoría SAGA elegida manda ella (perfumes = 1735, cualquier otra usa campos extra); sin elegir, la categoría web.
  const sagaGeneral = saga.sagaCategoria ? esCategoriaGeneral(saga.sagaCategoria) : !esPerfume;
  const camposCategoria = camposActivos(saga.sagaCategoria, opcionesSaga.categorias);
  const camposProducto = camposCategoria.filter((c) => c.nivel === "producto");
  const camposVariante = camposCategoria.filter((c) => c.nivel === "variante");
  const skuPadreBloqueado = variantesSincronizadas.length > 0;
  const generoActual = saga.genero || GENERO_POR_CATEGORIA[categoria] || "";
  const lista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);
  const alternarEnLista = (texto, valor, marcado) => {
    const resto = lista(texto).filter((x) => x.toLowerCase() !== valor.toLowerCase());
    return (marcado ? [...resto, valor] : resto).join(", ");
  };
  const AROMAS_SAGA = opcionesSaga.aromas || [];
  // Sugerencias de atributos web según la lista que corresponde: aromas de SAGA solo en perfumes.
  const sugerirAromas = AROMAS_SAGA.length > 0 && (saga.sagaCategoria ? !sagaGeneral : esPerfume);
  const CANTIDADES_SAGA = opcionesSaga.cantidades || [];
  const TIPOS_PERFUME = opcionesSaga.tiposPerfume || [];
  const CONDICIONES = opcionesSaga.condiciones || [];

  const [variantes, setVariantes] = useState(() =>
    producto?.variantes?.length
      ? producto.variantes.map((v) => ({
          key: Math.random().toString(36).slice(2),
          nombre: v.nombre || "",
          precio: v.precio ?? "",
          precioOferta: v.precioOferta ?? "",
          stock: v.stock !== false,
          aromas: (v.aromas || []).join(", "),
          imagenExistente: v.imagen || null,
          previewLocal: null,
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
          sagaExtras: v.sagaExtras || {},
          codigoBarras: v.codigoBarras || "",
          volumen: v.volumen || "",
          registroSanitario: v.registroSanitario || "",
          descripcion: v.descripcion || "",
          cantidadEmpaque: v.cantidadEmpaque || "",
          aromasSaga: v.aromasSaga || [],
          notasSaga: v.notasSaga || "",
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

  function actualizarVariante(i, cambios) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...cambios } : v)));
  }

  const [traer, setTraer] = useState({});
  const [cuentaTraer, setCuentaTraer] = useState("");
  const aliasTraer = cuentaTraer || cuentasMarcadas[0] || cuentasSaga[0]?.alias || "";

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
      notasSaga: "Notas aromáticas", aromasSaga: "Fragancia", descripcion: "Descripción", cantidadEmpaque: "Cantidad en el empaque",
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
        if (skuPadreBloqueado && (k === "skuPadre" || k === "usarSkuPadre")) continue;
        if (k === "usarSkuPadre" ? actuales[k] !== true : vacio(k, actuales[k])) {
          cambios[k] = nuevo;
          llenados.push(ETIQUETA[k] || k);
        } else if (String(actuales[k]) !== String(nuevo)) {
          conValor.push(ETIQUETA[k] || k);
        }
      }
      return cambios;
    };
    const cambVar = elegir(r.variante, v);
    const cambProd = elegir(r.producto, { ...saga, genero: saga.genero });
    const cambPrecios = elegir(r.precios, v.preciosSaga[aliasTraer] || {});
    // Si la variante aún no está registrada en esa cuenta, lo normal es vincularla (ya existe en SAGA).
    const sinRegistro = !estadoSync[v.id]?.[aliasTraer];
    setVariantes((prev) =>
      prev.map((x, idx) =>
        idx === i
          ? {
              ...x,
              ...cambVar,
              preciosSaga: { ...x.preciosSaga, [aliasTraer]: { ...(x.preciosSaga[aliasTraer] || {}), ...cambPrecios } },
              acciones: sinRegistro ? { ...x.acciones, [aliasTraer]: "vincular" } : x.acciones,
            }
          : x
      )
    );
    if (Object.keys(cambProd).length) setSaga((prev) => ({ ...prev, ...cambProd }));
    setTraer((p) => ({ ...p, [v.key]: { llenados, conValor, avisos: r.avisos || [] } }));
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
    setVariantes((prev) => [...prev, nuevaVariante()]);
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
    if (!cats.some((c) => c.slug === categoria)) setCategoria(cats[0]?.slug || "");
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

  // Acción de la variante en una cuenta: la elegida o, por defecto, crear (variantes nuevas o ya enviadas).
  const accionDe = (v, alias) =>
    v.acciones[alias] ?? (v.id && !variantesSincronizadas.map(String).includes(String(v.id)) ? "ninguna" : "crear");

  // Qué le falta a cada variante para publicarse en SAGA (mismas reglas que al enviar).
  function faltantesSaga(v, alias) {
    if (!conSaga) return [];
    const num = (x) => (x === "" || x === null || x === undefined ? null : Number(x));
    const o = (alias && v.preciosSaga[alias]) || {};
    const p = {
      id, nombre, marca, categoria, descripcion,
      saga_categoria: saga.sagaCategoria, modelo: saga.modelo, pais_produccion: saga.paisProduccion,
      tipo_perfume: saga.tipoPerfume, genero: generoActual, formato_belleza: saga.formatoBelleza,
      condicion: saga.condicion, caracteristicas: saga.caracteristicas, contenido_paquete: saga.contenidoPaquete,
      paquete_ancho: num(saga.paqueteAncho), paquete_largo: num(saga.paqueteLargo),
      paquete_alto: num(saga.paqueteAlto), paquete_peso: num(saga.paquetePeso),
      usar_sku_padre: saga.usarSkuPadre, aromas: lista(aromasProducto), saga_extras: saga.extras,
    };
    const vv = {
      nombre: v.nombre, sku: v.sku, descripcion: v.descripcion, volumen: v.volumen,
      cantidad_empaque: v.cantidadEmpaque, registro_sanitario: v.registroSanitario,
      aromas_saga: v.aromasSaga, notas_saga: v.notasSaga, saga_combinar_nombre: v.sagaCombinarNombre, aromas: lista(v.aromas), imagen: v.imagenExistente || v.previewLocal, saga_extras: v.sagaExtras,
      precio: num(o.precio) ?? num(v.precio), precio_oferta: num(o.precioOferta) ?? num(v.precioOferta),
      oferta_inicio: o.ofertaInicio || null, oferta_fin: o.ofertaFin || null,
    };
    return validarProducto(p, vv, opcionesSaga);
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
      nombre: v.nombre,
      precio: v.precio,
      precioOferta: v.precioOferta,
      stock: v.stock,
      stockCantidad: v.stockCantidad,
      stockOriginal: v.stockActual,
      sagaExtras: v.sagaExtras,
      esPack: v.esPack,
      componentes: v.esPack ? v.componentes.map((c) => ({ id: Number(c.id), cantidad: Number(c.cantidad) })) : [],
      aromas: v.aromas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      imagenExistente: v.imagenExistente,
      codigoBarras: v.codigoBarras,
      volumen: v.volumen,
      registroSanitario: v.registroSanitario,
      descripcion: v.descripcion,
      cantidadEmpaque: v.cantidadEmpaque,
      aromasSaga: v.aromasSaga,
      notasSaga: v.notasSaga,
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

  return (
    <form action={accion} className="pf">
      {conSaga && <input type="hidden" name="sagaCampos" value="1" />}
      {conSaga && <input type="hidden" name="sagaExtras" value={JSON.stringify(saga.extras)} />}

      <input type="hidden" name="modo" value={modo} />
      {modo === "editar" && <input type="hidden" name="idOriginal" value={producto.id} />}
      <input type="hidden" name="variantesJson" value={variantesJson} />

      {/* Barra pegajosa: estado, navegación por secciones y Guardar siempre a mano. */}
      <div className="pf-barra">
        <div className="pf-barra-info">
          <strong>{nombre.trim() || (modo === "crear" ? "Nuevo producto" : "Producto")}</strong>
          <span className="chip-saga">{variantes.length} variante{variantes.length === 1 ? "" : "s"}</span>
          {conSaga && estadoSagaChip}
        </div>
        <nav className="pf-nav" aria-label="Secciones del formulario">
          <a href="#pf-web">Web</a>
          <a href="#pf-variantes">Variantes</a>
          {conSaga && <a href="#pf-plataformas">Plataformas</a>}
          {conSaga && <a href="#pf-resumen">Resumen</a>}
        </nav>
        {botonGuardar}
      </div>

      {estado?.error && <div className="mensaje-error">{estado.error}</div>}

      {/* ===== 1. Datos de la web ===== */}
      <section id="pf-web" className="pf-seccion">
        <header className="pf-seccion-cab">
          <h3>Datos de la web</h3>
          <small>Lo que ven tus clientes en el catálogo.</small>
        </header>

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
          </div>
          <div className="campo">
            <label htmlFor="id">
              Id (parte de la URL){modo === "editar" ? " — no se puede cambiar" : ""}
            </label>
            <input
              id="id"
              name="id"
              type="text"
              value={id}
              disabled={modo === "editar"}
              onChange={(e) => {
                setIdTocadoManualmente(true);
                setId(e.target.value);
              }}
              placeholder="se genera solo a partir del nombre"
            />
          </div>
        </div>

        <div className="pf-grid-3">
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
          <div className="campo">
            <label htmlFor="categoria">Categoría</label>
            <select
              id="categoria"
              name="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {categoriasOpc.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="campo">
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="aromasProducto">Atributos del producto (aromas, etc.)</label>
          <input
            id="aromasProducto"
            name="aromasProducto"
            type="text"
            value={aromasProducto}
            onChange={(e) => setAromasProducto(e.target.value)}
            placeholder="Separados por coma. Ej: Floral, Cítrico, Amaderado"
          />
          <small>Opcional si cada variante tiene los suyos. Se muestran en la web.</small>
          {sugerirAromas && (
            <SugerenciasAtributos texto={aromasProducto} opciones={AROMAS_SAGA} onChange={setAromasProducto} alternar={alternarEnLista} lista={lista} />
          )}
        </div>

        <label className="campo-check">
          <input
            type="checkbox"
            name="destacado"
            checked={destacado}
            onChange={(e) => setDestacado(e.target.checked)}
          />
          Destacado (aparece resaltado en el catálogo)
        </label>
      </section>

      {/* ===== 2. Variantes ===== */}
      <section id="pf-variantes" className="pf-seccion">
        <header className="pf-seccion-cab">
          <div>
            <h3>Variantes</h3>
            <small>Cada variante tiene su precio, stock, imagen y, si usas plataformas, sus datos de envío.</small>
          </div>
          <button type="button" className="btn-ico-texto" onClick={agregarVariante}>
            <IconoMas /> Agregar variante
          </button>
        </header>

        {variantes.map((v, i) => (
          <details className="pf-variante" key={v.key} id={`pf-var-${i}`} open={i === 0 || v.id === null}>
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
              <div className="pf-var-opciones">
                <label className="campo-check">
                  <input
                    type="checkbox"
                    checked={v.activo}
                    onChange={(e) => actualizarVariante(i, { activo: e.target.checked })}
                  />
                  Activa (visible en el sitio)
                </label>
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
                {!restringido && variantes.length > 1 && (
                  <button type="button" className="btn-admin peligro pf-var-quitar" onClick={() => quitarVariante(i)}>
                    Quitar variante
                  </button>
                )}
              </div>

              <div className="pf-bloque">
                <h5>Identificación</h5>
                <div className="pf-grid-2">
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
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => actualizarVariante(i, { sku: e.target.value })}
                      placeholder="Ej: YB-ROSA-50"
                    />
                    {conSaga && (
                      <div className="pf-traer">
                        {cuentasSaga.length > 1 && (
                          <select value={aliasTraer} onChange={(e) => setCuentaTraer(e.target.value)} aria-label="Cuenta SAGA">
                            {cuentasSaga.map((c) => <option key={c.alias} value={c.alias}>{c.nombre}</option>)}
                          </select>
                        )}
                        <button
                          type="button"
                          className="btn-ico-texto"
                          disabled={!v.sku.trim() || !aliasTraer || traer[v.key]?.cargando}
                          onClick={() => traerDeSaga(i)}
                          title="Completa los datos de SAGA de esta variante (sin tocar nombre, precio web, imagen ni stock)"
                        >
                          {traer[v.key]?.cargando ? "Consultando SAGA…" : "Traer datos de SAGA"}
                        </button>
                      </div>
                    )}
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
                </div>
              </div>

              <div className="pf-bloque">
                <h5>Precio y stock</h5>
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

              <div className="pf-bloque">
                <h5>Imagen y atributos</h5>
                <div className="pf-imagen-fila">
                  <div className="campo pf-imagen">
                    <label>Imagen</label>
                    {v.previewLocal ? (
                      <img src={v.previewLocal} alt="" className="imagen-actual" />
                    ) : v.imagenExistente ? (
                      <img src={v.imagenExistente} alt="" className="imagen-actual" />
                    ) : null}
                    <input
                      type="file"
                      name={`variante_imagen_${i}`}
                      accept="image/*"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        actualizarVariante(i, {
                          previewLocal: archivo ? URL.createObjectURL(archivo) : null,
                        });
                      }}
                    />
                  </div>
                  <div className="campo">
                    <label>Atributos de esta variante (aromas, etc.)</label>
                    <input
                      type="text"
                      value={v.aromas}
                      onChange={(e) => actualizarVariante(i, { aromas: e.target.value })}
                      placeholder="Separados por coma. Opcional"
                    />
                    <small>Se muestran en la web junto a esta variante.</small>
                    {sugerirAromas && (
                      <SugerenciasAtributos
                        texto={v.aromas}
                        opciones={AROMAS_SAGA}
                        onChange={(aromas) => actualizarVariante(i, { aromas })}
                        alternar={alternarEnLista}
                        lista={lista}
                      />
                    )}
                  </div>
                </div>
              </div>

              {conSaga && (
                <details className="pf-bloque pf-bloque-saga saga-seccion" open={cuentasMarcadas.length > 0}>
                  <summary>
                    <span className="pf-sello">SAGA</span> Datos de esta variante
                    {cuentasMarcadas.length > 0 && (
                      <span className={faltantesPorVariante[i].total ? "chip-saga aviso" : "chip-saga ok"}>
                        {cuentasMarcadas.some((a) => accionDe(v, a) === "crear")
                          ? faltantesPorVariante[i].total ? `Faltan ${faltantesPorVariante[i].total}` : "Completa"
                          : cuentasMarcadas.some((a) => !["ninguna", "crear", "desvincular"].includes(accionDe(v, a))) ? "Vinculada" : "Sin envío"}
                      </span>
                    )}
                  </summary>
                  <div className="form-grid saga-cuerpo">
                    {cuentasMarcadas.length === 0 && (
                      <small>Marca una cuenta en «Plataformas» para elegir qué hacer con esta variante.</small>
                    )}
                    {cuentasSaga
                      .filter((c) => cuentasMarcadas.includes(c.alias))
                      .map((c) => {
                        const modoAccion = accionDe(v, c.alias);
                        const registrada = Boolean(estadoSync[v.id]?.[c.alias]);
                        return (
                          <div className="campo" key={c.alias}>
                            <label>En {c.nombre}</label>
                            <select value={modoAccion} onChange={(e) => actualizarVariante(i, { acciones: { ...v.acciones, [c.alias]: e.target.value } })}>
                              <option value="ninguna">No enviar</option>
                              <option value="crear">Crear en SAGA (SKU nuevo)</option>
                              {(opcionesSaga.acciones || []).map((x) => (
                                <option key={x.id} value={x.id}>{x.nombre}</option>
                              ))}
                              {registrada && <option value="desvincular">Dejar de sincronizar</option>}
                            </select>
                            <small>{ayudaAccion(modoAccion, opcionesSaga.acciones || [])}</small>
                          </div>
                        );
                      })}
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
                      <label className="campo-check">
                        <input
                          type="checkbox"
                          checked={v.sagaCombinarNombre}
                          onChange={(e) => actualizarVariante(i, { sagaCombinarNombre: e.target.checked })}
                        />
                        Combinar nombre del producto + nombre de la variante
                      </label>
                      {(() => {
                        const enSaga = nombreSagaDe(v);
                        const excede = enSaga.length > LIMITES.texto;
                        return (
                          <small style={{ color: excede ? "#b3261e" : "var(--gris)" }}>
                            En SAGA se verá: <strong>{enSaga || "—"}</strong> ({enSaga.length} de {LIMITES.texto} caracteres).
                            {excede ? " Es demasiado largo para SAGA: acórtalo." : ""}
                            {!v.sagaCombinarNombre && " Solo se envía el nombre del producto."}
                          </small>
                        );
                      })()}
                    </div>

                    <div className="campo">
                      <label>Descripción de la variante</label>
                      <textarea
                        rows={3}
                        value={v.descripcion}
                        onChange={(e) => actualizarVariante(i, { descripcion: e.target.value })}
                        placeholder="Vacía = se usa la descripción del producto. Con «Traer datos de SAGA» se llena con la de SAGA."
                      />
                    </div>
                    {!sagaGeneral && (
                      <div className="pf-grid-2">
                        <div className="campo">
                          <label>Medida del frasco <em>obligatorio</em></label>
                          <select value={v.volumen} onChange={(e) => actualizarVariante(i, { volumen: e.target.value })}>
                            <option value="">— Elegir —</option>
                            {v.volumen && !CANTIDADES_SAGA.includes(v.volumen) && <option value={v.volumen}>{v.volumen}</option>}
                            {CANTIDADES_SAGA.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="campo">
                          <label>Cantidad contenida en el empaque <em>obligatorio</em></label>
                          <input
                            type="text"
                            value={v.cantidadEmpaque}
                            onChange={(e) => actualizarVariante(i, { cantidadEmpaque: e.target.value })}
                            placeholder={v.volumen ? `Vacío = ${v.volumen.replace(/\s+/g, "")}` : "Ej: 100ML"}
                          />
                        </div>
                      </div>
                    )}
                    <div className="pf-grid-2">
                      <div className="campo">
                        <label>Registro sanitario <em>obligatorio</em></label>
                        <input type="text" value={v.registroSanitario} onChange={(e) => actualizarVariante(i, { registroSanitario: e.target.value })} />
                      </div>
                      <div className="campo">
                        <label>Código de barras</label>
                        <input type="text" value={v.codigoBarras} onChange={(e) => actualizarVariante(i, { codigoBarras: e.target.value })} />
                      </div>
                    </div>
                    {saga.sagaCategoria && camposVariante.length > 0 && (
                      <div className="campo">
                        <label>Campos extra de la categoría <em>por variante</em></label>
                        <CamposExtra
                          campos={camposVariante}
                          valores={v.sagaExtras}
                          onChange={(sagaExtras) => actualizarVariante(i, { sagaExtras })}
                          prefijo={`extra-var-${i}`}
                        />
                      </div>
                    )}
                    {!sagaGeneral && (
                      <>
                        <div className="campo">
                          <label>Fragancia — solo opciones de la lista de SAGA <em>obligatorio, al menos una</em></label>
                          <div className="chips-grid">
                            {AROMAS_SAGA.map((a) => (
                              <label className="campo-check" key={a}>
                                <input
                                  type="checkbox"
                                  checked={v.aromasSaga.some((x) => x.toLowerCase() === a.toLowerCase())}
                                  onChange={(e) =>
                                    actualizarVariante(i, {
                                      aromasSaga: e.target.checked ? [...v.aromasSaga, a] : v.aromasSaga.filter((x) => x.toLowerCase() !== a.toLowerCase()),
                                    })
                                  }
                                />
                                {a}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="campo">
                          <label>Notas aromáticas</label>
                          <input
                            type="text"
                            value={v.notasSaga}
                            onChange={(e) => actualizarVariante(i, { notasSaga: e.target.value })}
                            placeholder={v.aromas.trim() ? `Vacío = se usan los atributos de la variante (${v.aromas.trim()})` : "Texto libre separado por coma. Opcional"}
                          />
                          <small>Se envía a SAGA como notas aromáticas.</small>
                        </div>
                      </>
                    )}

                    <div className="form-grid pf-precios-plataforma">
                      <strong>Precios por plataforma</strong>
                      <small style={{ color: "var(--gris)" }}>
                        Web: {v.precio === "" ? "—" : v.precio}
                        {v.precioOferta !== "" && ` (oferta ${v.precioOferta})`}. Si dejas un campo vacío, la plataforma usa el precio de la web.
                      </small>
                      {cuentasSaga.map((c) => {
                        const p = v.preciosSaga[c.alias] || {};
                        return (
                          <div key={c.alias} className="form-grid">
                            <small><strong>SAGA — {c.nombre}</strong></small>
                            <div className="pf-grid-4">
                              <div className="campo">
                                <label>Precio</label>
                                <input type="number" min="0" step="0.01" value={p.precio ?? ""} placeholder={v.precio === "" ? "" : `Web: ${v.precio}`} onChange={(e) => actualizarPrecioSaga(i, c.alias, { precio: e.target.value })} />
                              </div>
                              <div className="campo">
                                <label>Precio oferta</label>
                                <input type="number" min="0" step="0.01" value={p.precioOferta ?? ""} placeholder={v.precioOferta === "" ? "" : `Web: ${v.precioOferta}`} onChange={(e) => actualizarPrecioSaga(i, c.alias, { precioOferta: e.target.value })} />
                              </div>
                              <div className="campo">
                                <label>Oferta desde</label>
                                <input type="date" value={p.ofertaInicio ?? ""} onChange={(e) => actualizarPrecioSaga(i, c.alias, { ofertaInicio: e.target.value })} />
                              </div>
                              <div className="campo">
                                <label>Oferta hasta</label>
                                <input type="date" value={p.ofertaFin ?? ""} onChange={(e) => actualizarPrecioSaga(i, c.alias, { ofertaFin: e.target.value })} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              )}
            </div>
          </details>
        ))}
      </section>

      {/* ===== 3. Plataformas (SAGA) ===== */}
      {conSaga && (
        <section id="pf-plataformas" className="pf-seccion pf-seccion-saga">
          <header className="pf-seccion-cab">
            <div>
              <h3><span className="pf-sello">SAGA</span> Plataformas</h3>
              <small>Datos de envío: no se muestran en la web. Los datos propios de cada variante están dentro de la variante.</small>
            </div>
            {estadoSagaChip}
          </header>

          <div className="pf-cuentas">
            {cuentasSaga.map((c) => (
              <label className="campo-check" key={c.alias}>
                <input
                  type="checkbox"
                  name="sagaCuentas"
                  value={c.alias}
                  checked={cuentasMarcadas.includes(c.alias)}
                  onChange={(e) =>
                    setCuentasMarcadas((prev) =>
                      e.target.checked ? [...prev, c.alias] : prev.filter((a) => a !== c.alias)
                    )
                  }
                />
                Publicar en SAGA — {c.nombre}
              </label>
            ))}
          </div>
          {largoNombreSaga > 0 && (
            <small style={{ color: largoNombreSaga > LIMITES.texto ? "#b3261e" : "var(--gris)" }}>
              {largoNombreSaga > LIMITES.texto
                ? `El nombre es muy largo para SAGA: máximo ${LIMITES.texto} caracteres y el peor caso queda en ${largoNombreSaga}. Acórtalo o desmarca «Combinar nombre» en la variante.`
                : `Nombre en SAGA: ${largoNombreSaga} de ${LIMITES.texto} caracteres (variante más larga).`}
            </small>
          )}

          <details className="saga-seccion" open>
            <summary>Datos generales del producto en SAGA</summary>
            <div className="form-grid saga-cuerpo">
              <div className="pf-grid-2">
                <div className="campo">
                  <label htmlFor="sagaCategoria">Categoría primaria <em>obligatorio</em></label>
                  <SelectBuscador
                    id="sagaCategoria"
                    name="sagaCategoria"
                    valor={saga.sagaCategoria}
                    onChange={(v) => cambiarSaga({ sagaCategoria: v })}
                    opciones={(opcionesSaga.categorias || []).map((c) => ({ valor: c.id, etiqueta: `${c.id} — ${c.nombre}` }))}
                    placeholder="Buscar por id o descripción…"
                  />
                </div>
                {!sagaGeneral && (
                  <div className="campo">
                    <label htmlFor="tipoPerfume">Tipo de perfume <em>obligatorio</em></label>
                    <select id="tipoPerfume" name="tipoPerfume" value={saga.tipoPerfume} onChange={(e) => cambiarSaga({ tipoPerfume: e.target.value })}>
                      <option value="">— Elegir —</option>
                      {TIPOS_PERFUME.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="pf-grid-3">
                {!sagaGeneral && (
                  <>
                    <div className="campo">
                      <label htmlFor="genero">Género <em>obligatorio</em></label>
                      <select id="genero" name="genero" value={generoActual} onChange={(e) => cambiarSaga({ genero: e.target.value })}>
                        <option value="">— Elegir —</option>
                        {(opcionesSaga.generos || []).map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="campo">
                      <label htmlFor="formatoBelleza">Formato belleza <em>obligatorio</em></label>
                      <select id="formatoBelleza" name="formatoBelleza" value={saga.formatoBelleza} onChange={(e) => cambiarSaga({ formatoBelleza: e.target.value })}>
                        {(opcionesSaga.formatosBelleza || []).map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div className="campo">
                  <label htmlFor="condicion">Condición <em>obligatorio</em></label>
                  <select id="condicion" name="condicion" value={saga.condicion} onChange={(e) => cambiarSaga({ condicion: e.target.value })}>
                    {CONDICIONES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="pf-grid-2">
                <div className="campo">
                  <label htmlFor="modelo">Modelo</label>
                  <input id="modelo" name="modelo" value={saga.modelo} onChange={(e) => cambiarSaga({ modelo: e.target.value })} />
                </div>
                <div className="campo">
                  <label htmlFor="paisProduccion">País de producción</label>
                  <SelectBuscador
                    id="paisProduccion"
                    name="paisProduccion"
                    valor={saga.paisProduccion}
                    onChange={(v) => cambiarSaga({ paisProduccion: v })}
                    opciones={(opcionesSaga.paises || []).map((p) => ({ valor: p, etiqueta: p }))}
                    placeholder="Buscar país…"
                  />
                </div>
              </div>
              <div className="campo">
                <label className="campo-check">
                  <input
                    type="checkbox"
                    name="usarSkuPadre"
                    checked={saga.usarSkuPadre}
                    disabled={skuPadreBloqueado}
                    onChange={(e) => cambiarSaga({ usarSkuPadre: e.target.checked })}
                  />
                  Usar SKU padre (agrupa las variantes en una sola ficha de SAGA)
                </label>
                <small>
                  {skuPadreBloqueado
                    ? "Ya se envió a SAGA: no se puede cambiar."
                    : "Sin marcar, cada variante se publica en SAGA como un producto suelto, sin SKU padre."}
                </small>
              </div>
              {saga.usarSkuPadre && (
                <div className="campo">
                  <label htmlFor="skuPadre">SKU padre</label>
                  <input
                    id="skuPadre"
                    name="skuPadre"
                    value={skuPadreBloqueado ? saga.skuPadre || producto?.id || "" : saga.skuPadre}
                    disabled={skuPadreBloqueado}
                    onChange={(e) => cambiarSaga({ skuPadre: e.target.value })}
                    placeholder={`Vacío = se usa el id del producto${id ? ` (${id})` : ""}`}
                  />
                  <small>SAGA no lo asigna: lo defines tú. Queda guardado en el primer envío y se reutiliza al agregar variantes.</small>
                </div>
              )}
            </div>
          </details>

          {saga.sagaCategoria && camposProducto.length > 0 && (
            <details className="saga-seccion">
              <summary>Campos extra de la categoría <em>por producto · se eligen en Configuración → SAGA</em></summary>
              <div className="saga-cuerpo">
                <CamposExtra
                  campos={camposProducto}
                  valores={saga.extras}
                  onChange={(extras) => cambiarSaga({ extras })}
                  prefijo="extra-prod"
                />
              </div>
            </details>
          )}

          <details className="saga-seccion">
            <summary>Paquete <em>un solo juego para todas las variantes</em></summary>
            <div className="form-grid saga-cuerpo">
              <div className="pf-grid-4">
                {[["paqueteAncho", "Ancho (cm)"], ["paqueteLargo", "Largo (cm)"], ["paqueteAlto", "Alto (cm)"], ["paquetePeso", "Peso (kg)"]].map(([k, et]) => (
                  <div className="campo" key={k}>
                    <label>{et} <em>obligatorio</em></label>
                    <input type="number" min="0" step="0.01" name={k} value={saga[k]} onChange={(e) => cambiarSaga({ [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="campo">
                <label>Contenido del paquete</label>
                <input name="contenidoPaquete" value={saga.contenidoPaquete} onChange={(e) => cambiarSaga({ contenidoPaquete: e.target.value })} placeholder="Ej: 1 perfume 50 ml" />
              </div>
            </div>
          </details>

          {!sagaGeneral && (
            <details className="saga-seccion">
              <summary>Características <em>opcional</em></summary>
              <div className="saga-cuerpo">
                <input type="hidden" name="caracteristicas" value={saga.caracteristicas} />
                <div className="chips-grid">
                  {(opcionesSaga.caracteristicas || []).map((c) => (
                    <label className="campo-check" key={c}>
                      <input
                        type="checkbox"
                        checked={lista(saga.caracteristicas).some((x) => x.toLowerCase() === c.toLowerCase())}
                        onChange={(e) => cambiarSaga({ caracteristicas: alternarEnLista(saga.caracteristicas, c, e.target.checked) })}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </details>
          )}
        </section>
      )}

      {/* ===== 4. Resumen por plataforma ===== */}
      {conSaga && (
        <ResumenPlataformas
          cuentas={cuentasSaga.filter((c) => cuentasMarcadas.includes(c.alias))}
          filas={variantes.map((v, i) => ({
            i,
            nombre: v.nombre.trim() || "Sin nombre",
            sku: v.sku,
            acciones: Object.fromEntries(cuentasMarcadas.map((a) => [a, etiquetaAccion(accionDe(v, a))])),
            envia: Object.fromEntries(cuentasMarcadas.map((a) => [a, accionDe(v, a) === "crear"])),
            faltantes: faltantesPorVariante[i],
          }))}
        />
      )}

      <div className="pf-pie">{botonGuardar}</div>
    </form>
  );
}

/** Chips con las opciones de la lista que corresponde (p. ej. aromas de SAGA) para completar un texto separado por comas. */
function SugerenciasAtributos({ texto, opciones, onChange, alternar, lista }) {
  const actuales = lista(texto).map((x) => x.toLowerCase());
  return (
    <div className="pf-sugerencias" aria-label="Sugerencias de la lista de SAGA">
      <small>Sugeridos de la lista de SAGA:</small>
      {opciones.map((o) => {
        const activo = actuales.includes(o.toLowerCase());
        return (
          <button
            type="button"
            key={o}
            className={activo ? "pf-chip activo" : "pf-chip"}
            aria-pressed={activo}
            onClick={() => onChange(alternar(texto, o, !activo))}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
