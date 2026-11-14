import { revalidatePath } from "next/cache";
import { query, transaction } from "./db";
import { subirArchivo } from "./storage";
import { slugify } from "./slug";
import { getMarcaProducto, getPestana, getCategoria } from "./data";
import { optimizarImagen } from "./optimizarImagen";
import { GENERO_POR_CATEGORIA } from "./saga-mapeo";
import { after } from "next/server";
import { sincronizarProducto, sincronizarStockVariante, sincronizarCambiosStock } from "./saga-sync";
import { drenarCola } from "./saga-cola";
import { fijarStock } from "./inventario";
import { adjuntarStockPack, validarComponentes, refrescarDisponibilidad } from "./packs";
import { getOpcionesSaga } from "./saga-opciones";
import { limpiarHtml } from "./html-limpio";
import { limpiarValores, IMAGENES_TOPE } from "./saga-campos";
import { limpiarPropios } from "./atributos-categoria";
import { personalizadosAFila } from "./atributos-efectivos";

// Lógica compartida para crear/editar productos. Sin "use server": las acciones
// que la usan (admin y sales) deciden quién puede llamarla y con qué modo.

export function parseNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// Lista de textos desde un JSON (si no es una lista válida, vacía).
function leerLista(texto) {
  try {
    const l = JSON.parse((texto || "[]").toString());
    return Array.isArray(l) ? [...new Set(l.map((x) => String(x).trim()).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

function leerJson(texto) {
  try {
    return JSON.parse((texto || "{}").toString());
  } catch {
    return {};
  }
}

// Valores generales del producto: { registro_sanitario, variante_extras (heredan las variantes), propios (atributos por categoría) }.
function atributosGenerales(entrada, catalogo, categoria) {
  const reg = (entrada?.registro_sanitario || "").toString().trim().slice(0, 172);
  const propios = limpiarPropios(catalogo, categoria, entrada?.propios);
  return {
    ...(reg ? { registro_sanitario: reg } : {}),
    variante_extras: limpiarValores(entrada?.variante_extras),
    ...(Object.keys(propios).length ? { propios } : {}),
  };
}

export function parseAromas(texto) {
  return (texto || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extensionDe(archivo) {
  const porNombre = (archivo.name || "").split(".").pop();
  if (porNombre && porNombre.length <= 5) return porNombre.toLowerCase();
  const mapa = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return mapa[archivo.type] || "jpg";
}

async function subirImagen(archivo, productoId, indice) {
  const bufferOriginal = Buffer.from(await archivo.arrayBuffer());
  const { buffer } = await optimizarImagen(
    bufferOriginal,
    extensionDe(archivo),
    archivo.type
  );
  const ruta = `${productoId}/${indice}-${Date.now()}`;
  try {
    return await subirArchivo(buffer, ruta);
  } catch (err) {
    throw new Error(`No se pudo subir la imagen: ${err.message}`);
  }
}

/**
 * Valida y guarda un producto con sus variantes.
 * Con `soloCrear` ignora el modo del formulario y nunca modifica productos
 * existentes. Con `restringido` (edición desde /operaciones) fuerza el modo editar y
 * es NO destructivo: no elimina ni desactiva variantes omitidas y conserva
 * costo y stock mínimo (datos de gestión que /operaciones no puede tocar).
 * Devuelve `{ error }` o `{ ok: true }` (tras revalidar rutas).
 */
export async function guardarProductoDesdeForm(formData, { soloCrear = false, restringido = false, usuarioPanel = null } = {}) {
  try {
    const modo = soloCrear ? "crear" : restringido ? "editar" : (formData.get("modo") || "crear").toString();
    const idOriginal = formData.get("idOriginal");
    let id = (formData.get("id") || "").toString().trim();
    const marca = (formData.get("marca") || "").toString();
    const pestana = (formData.get("pestana") || "").toString();
    const categoria = (formData.get("categoria") || "").toString();
    const nombre = (formData.get("nombre") || "").toString().trim();
    // La descripción trae formato (editor de texto enriquecido): se guarda solo el HTML permitido.
    const descripcion = limpiarHtml((formData.get("descripcion") || "").toString());
    const destacado = formData.get("destacado") === "on";

    const texto = (k) => (formData.get(k) || "").toString().trim() || null;
    const opcionesGuardadas = await getOpcionesSaga();
    const usarSkuPadre = formData.get("usarSkuPadre") === "on";
    // Notas aromáticas del producto (texto separado por comas): dato de la web, se guarda siempre.
    const notasProducto = (texto("notasAromaticas") || "").slice(0, 300) || null;
    const datosSaga = {
      saga_categoria: texto("sagaCategoria"),
      sku_padre: usarSkuPadre ? texto("skuPadre") : null,
      sku_padre_web: texto("skuPadre"),
      usar_sku_padre: usarSkuPadre,
      // Medida, cantidad en el empaque, fragancia y notas: ahora también a nivel de producto (las variantes heredan).
      volumen: texto("volumen"),
      cantidad_empaque: texto("cantidadEmpaque"),
      fragancia_perfume: leerLista(formData.get("fraganciaPerfumeJson")),
      contenido_paquete: texto("contenidoPaquete"),
      paquete_ancho: parseNumero(formData.get("paqueteAncho")),
      paquete_largo: parseNumero(formData.get("paqueteLargo")),
      paquete_alto: parseNumero(formData.get("paqueteAlto")),
      paquete_peso: parseNumero(formData.get("paquetePeso")),
      modelo: texto("modelo"),
      tipo_perfume: texto("tipoPerfume"),
      pais_produccion: texto("paisProduccion"),
      genero: texto("genero") || GENERO_POR_CATEGORIA[categoria] || null,
      formato_belleza: texto("formatoBelleza") || "Frasco",
      caracteristicas: texto("caracteristicas"),
      condicion: texto("condicion") || "Nuevo",
      // Campos extra de la categoría SAGA (por producto), como JSON { FeedName: valor }.
      saga_extras: JSON.stringify(limpiarValores(leerJson(formData.get("sagaExtras")))),
      // Valores generales heredados por las variantes: registro sanitario y extras por variante.
      atributos: JSON.stringify(atributosGenerales(leerJson(formData.get("atributosGenerales")), opcionesGuardadas.atributosCategoria, categoria)),
    };
    // Garantía y envío: solo se guardan si el formulario trae el campo (si no, no se pisa lo ya guardado).
    for (const [campo, columna] of [["nameCn", "name_cn"], ["nameEn", "name_en"], ["detalleCondicion", "detalle_condicion"], ["detalleGarantia", "detalle_garantia"], ["garantia", "garantia"]]) {
      if (formData.has(campo)) datosSaga[columna] = texto(campo);
    }
    // Solo los formularios con el panel SAGA envían sagaCampos=1 (admin y /operaciones).
    const conSaga = formData.get("sagaCampos") === "1";
    const cuentasSaga = conSaga ? formData.getAll("sagaCuentas").map(String) : [];
    // Acciones por variante y cuenta (vincular / crear / desvincular), con la posición (orden) de la variante.
    const accionesSaga = [];
    const modosValidos = conSaga ? new Set(["crear", "desvincular", ...(await getOpcionesSaga()).acciones.map((a) => a.id)]) : null;

    if (!nombre) return { error: "El nombre es obligatorio." };
    if (datosSaga.sku_padre && !/^[A-Za-z0-9._-]{1,100}$/.test(datosSaga.sku_padre)) {
      return { error: "SKU padre: solo letras, números, punto, guion y guion bajo (máx. 100), sin espacios." };
    }
    if (!marca || !(await getMarcaProducto(marca))) return { error: "Elige una marca válida." };
    if (!pestana || !(await getPestana(pestana))) return { error: "Elige una pestaña válida." };
    if (!categoria || !(await getCategoria(pestana, categoria))) {
      return { error: "Elige una categoría válida para esa pestaña." };
    }

    let variantesEntrada;
    try {
      variantesEntrada = JSON.parse((formData.get("variantesJson") || "[]").toString());
    } catch {
      return { error: "No se pudieron leer las variantes. Vuelve a intentarlo." };
    }
    if (!Array.isArray(variantesEntrada) || variantesEntrada.length === 0) {
      return { error: "Agrega al menos una variante." };
    }
    // Con una sola variante todo va a nivel de producto: el SKU padre solo aplica con dos o más.
    if (variantesEntrada.length <= 1) {
      datosSaga.usar_sku_padre = false;
      datosSaga.sku_padre = null;
    }
    // Que la categoría admita variantes solo oculta el botón «Agregar variante» del formulario: las variantes que llegan de SAGA se guardan.
    for (const v of variantesEntrada) {
      if (!v.nombre || !v.nombre.toString().trim()) {
        return {
          error:
            'Cada variante necesita un nombre (usa "Único" si el producto no tiene variantes).',
        };
      }
    }

    if (modo === "crear") {
      if (!id) id = nombre;
      id = slugify(id);
      if (!id) return { error: "No se pudo generar un id válido a partir del nombre." };

      const [existente] = await query("select id from productos where id = $1", [id]);
      if (existente) {
        return { error: `Ya existe un producto con el id "${id}". Elige otro id.` };
      }
    } else {
      id = (idOriginal || "").toString();
      if (!id) return { error: "Falta el id del producto a editar." };
      if (restringido) {
        const [existente] = await query("select id from productos where id = $1", [id]);
        if (!existente) return { error: "El producto que intentas editar no existe." };
      }
    }

    // Sube imágenes nuevas (solo para las variantes donde se eligió un archivo).
    const variantesFinal = [];
    for (let i = 0; i < variantesEntrada.length; i++) {
      const v = variantesEntrada[i];
      // Imágenes en orden: cada ranura es una URL ya guardada ({ url }) o un archivo nuevo ({ nuevo: true, campo })
      // que llega en el campo `variante_imagen_…` indicado. Al crear no hay imágenes previas: se ignoran las URL del cliente.
      const ranuras = Array.isArray(v.imagenes) ? v.imagenes.slice(0, IMAGENES_TOPE) : [];
      const imagenes = [];
      for (let k = 0; k < ranuras.length; k++) {
        const r = ranuras[k] || {};
        if (r.nuevo && typeof r.campo === "string" && r.campo.startsWith("variante_imagen_")) {
          const archivo = formData.get(r.campo);
          if (archivo && typeof archivo === "object" && "size" in archivo && archivo.size > 0) {
            imagenes.push(await subirImagen(archivo, id, `${i}-${k}`));
          }
        } else if (modo !== "crear" && typeof r.url === "string" && /^https?:\/\//i.test(r.url)) {
          imagenes.push(r.url);
        }
      }
      // La portada (la primera) también va en `imagen`, que usan la web, el CSV y el inventario.
      const imagen = imagenes[0] || null;
      const stockMinimo = parseNumero(v.stockMinimo) ?? 0;
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
        return { error: `Variante "${v.nombre}": el stock mínimo debe ser un entero desde 0.` };
      }
      const costo = parseNumero(v.costo);
      if (costo !== null && costo < 0) {
        return { error: `Variante "${v.nombre}": el costo no puede ser negativo.` };
      }
      // Stock por cantidad: solo se aplica si el usuario lo cambió (así no pisa ventas hechas mientras editaba).
      const textoStock = v.stockCantidad === null || v.stockCantidad === undefined ? "" : String(v.stockCantidad).trim();
      let stockCantidad = null;
      if (!restringido && textoStock !== "") {
        stockCantidad = Number(textoStock);
        if (!Number.isInteger(stockCantidad) || stockCantidad < 0) {
          return { error: `Variante "${v.nombre}": el stock debe ser un número entero mayor o igual a 0.` };
        }
      }
      // Pack: su stock se calcula con los componentes, así que no admite cantidad propia.
      const esPack = !restringido && v.esPack === true;
      const componentes = esPack && Array.isArray(v.componentes)
        ? v.componentes.map((c) => ({ id: Number(c.id), cantidad: Number(c.cantidad) }))
        : [];
      if (esPack) {
        const errorPack = await validarComponentes(
          modo === "crear" ? null : Number.isInteger(Number(v.id)) ? Number(v.id) : null,
          componentes
        );
        if (errorPack) return { error: `Pack "${v.nombre}": ${errorPack}` };
        stockCantidad = null;
      }
      // Lo que la variante personaliza (vacío = hereda del producto). Los atributos propios se validan con el catálogo.
      const pers = personalizadosAFila(v.attrs);
      const propiosV = limpiarPropios(opcionesGuardadas.atributosCategoria, categoria, pers.atributos.propios);
      if (Object.keys(propiosV).length) pers.atributos.propios = propiosV;
      else delete pers.atributos.propios;
      const stockOriginal = v.stockOriginal === null || v.stockOriginal === undefined || v.stockOriginal === "" ? null : Number(v.stockOriginal);
      if (conSaga && v.acciones && typeof v.acciones === "object") {
        for (const [alias, modo] of Object.entries(v.acciones)) {
          if (cuentasSaga.includes(alias) && modosValidos.has(modo)) accionesSaga.push({ orden: i, alias, modo });
        }
      }
      variantesFinal.push({
        // Al crear nunca se actualizan variantes existentes (podrían ser de otro producto).
        id:
          modo === "crear"
            ? null
            : Number.isInteger(Number(v.id)) && Number(v.id) > 0
              ? Number(v.id)
              : null,
        producto_id: id,
        nombre: v.nombre.toString().trim(),
        precio: parseNumero(v.precio),
        precio_oferta: parseNumero(v.precioOferta),
        stock: v.stock !== false,
        stock_cantidad: stockCantidad,
        stock_original: modo === "crear" ? null : stockOriginal,
        imagen,
        imagenes,
        orden: i,
        sku: (v.sku || "").toString().trim() || null,
        stock_minimo: stockMinimo,
        costo,
        activo: v.activo !== false,
        codigo_barras: (v.codigoBarras || "").toString().trim() || null,
        volumen: pers.columnas.volumen,
        descripcion: pers.columnas.descripcion,
        cantidad_empaque: pers.columnas.cantidad_empaque,
        fragancia_perfume: pers.columnas.fragancia_perfume,
        notas_aromaticas: pers.columnas.notas_aromaticas,
        saga_combinar_nombre: v.sagaCombinarNombre !== false,
        registro_sanitario: pers.columnas.registro_sanitario,
        precios_saga: v.preciosSaga && typeof v.preciosSaga === "object" ? v.preciosSaga : {},
        es_pack: esPack,
        componentes,
        saga_extras: JSON.stringify(pers.columnas.saga_extras),
        atributos: JSON.stringify(pers.atributos),
      });
    }

    const skus = variantesFinal.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      return { error: "Hay SKUs repetidos entre las variantes de este producto." };
    }
    const existentes = variantesFinal.filter((v) => v.id !== null);
    const nuevas = variantesFinal.filter((v) => v.id === null);

    // Columnas de SAGA del producto (nombre en BD → valor). Una vez enviado a SAGA, el SKU padre no cambia.
    const columnasSaga = Object.entries(datosSaga);
    const PROTEGIDAS = new Set(["sku_padre", "usar_sku_padre"]);
    // Misma regla que enviadaASaga (lib/saga-sync.js): un alta que falló sin salir (error sin feed) no cuenta como enviada.
    const yaEnviado = `exists (select 1 from sincronizaciones s join variantes v on v.id = s.variante_id where v.producto_id = $1
      and not (s.estado = 'error' and s.feed_id is null and not s.stock_pendiente and s.origen = 'creado' and s.accion = 'crear'))`;

    // Variantes que ya existían: sirve para avisar a SAGA si se agotan, se desactivan o se quitan.
    const previas = modo === "crear" ? [] : await query("select id, stock, stock_actual, stock_minimo, activo, es_pack from variantes where producto_id = $1", [id]);
    await adjuntarStockPack(previas);
    if (!restringido) {
      const quedan = new Set(existentes.map((v) => String(v.id)));
      for (const p of previas) {
        if (!quedan.has(String(p.id))) await sincronizarStockVariante(Number(p.id), { cero: true }); // antes de que se borre su registro
      }
    }

    // Producto + variantes en una sola transacción (todo o nada).
    try {
      await transaction((t) => [
        modo === "crear"
          ? t.query(
              `insert into productos (id, marca, categoria, nombre, descripcion, notas_aromaticas, destacado, orden,
                 ${columnasSaga.map(([c]) => c).join(", ")})
               values ($1,$2,$3,$4,$5,$6,$7,$8,${columnasSaga.map((_, i) => `$${9 + i}`).join(",")})`,
              [id, marca, categoria, nombre, descripcion, notasProducto, destacado, Date.now(), ...columnasSaga.map(([, v]) => v)]
            )
          : !conSaga
            ? t.query(
                `update productos set marca=$2, categoria=$3, nombre=$4, descripcion=$5, notas_aromaticas=$6, destacado=$7
                 where id = $1`,
                [id, marca, categoria, nombre, descripcion, notasProducto, destacado]
              )
            : t.query(
                `update productos set marca=$2, categoria=$3, nombre=$4, descripcion=$5, notas_aromaticas=$6, destacado=$7,
                   ${columnasSaga
                     .map(([c], i) => (PROTEGIDAS.has(c) ? `${c} = case when ${yaEnviado} then ${c} else $${8 + i} end` : `${c} = $${8 + i}`))
                     .join(", ")}
                 where id = $1`,
                [id, marca, categoria, nombre, descripcion, notasProducto, destacado, ...columnasSaga.map(([, v]) => v)]
              ),
        // Pestaña de la web (independiente de la marca de SAGA).
        t.query("update productos set pestana = $2 where id = $1", [id, pestana]),
        // Las variantes existentes se ACTUALIZAN por id (así no se pierden SKU,
        // stock ni historial de movimientos). `stock` solo se toca si la variante
        // no tiene control de cantidad: si lo tiene, lo manda stock_actual.
        ...existentes.map((v) =>
          t.query(
            `update variantes set nombre=$3, precio=$4, precio_oferta=$5,
               stock = case when stock_actual is null then $6 else stock end,
               imagen=$7, notas_aromaticas=$8, orden=$9, sku=$10,
               stock_minimo = case when $14 then $11 else stock_minimo end,
               costo = case when $14 then $12 else costo end,
               activo=$13,
               codigo_barras = case when $19 then $15 else codigo_barras end,
               volumen       = case when $19 then $16 else volumen end,
               descripcion        = case when $19 then $17 else descripcion end,
               registro_sanitario = case when $19 then $18 else registro_sanitario end,
               cantidad_empaque   = case when $19 then $20 else cantidad_empaque end,
               fragancia_perfume        = case when $19 then $21::text[] else fragancia_perfume end,
               es_pack      = case when $14 then $22 else es_pack end,
               stock_actual = case when $14 and $22 then null else stock_actual end,
               saga_extras  = case when $19 then $23::jsonb else saga_extras end,
               saga_combinar_nombre = case when $19 then $24 else saga_combinar_nombre end,
               imagenes     = $25::text[],
               atributos    = case when $19 then $26::jsonb else atributos end
             where id = $1 and producto_id = $2`,
            [v.id, id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.notas_aromaticas, v.orden,
             v.sku, v.stock_minimo, v.costo, v.activo, !restringido,
             v.codigo_barras, v.volumen, v.descripcion, v.registro_sanitario, conSaga,
             v.cantidad_empaque, v.fragancia_perfume, v.es_pack, v.saga_extras, v.saga_combinar_nombre, v.imagenes, v.atributos]
          )
        ),
        // Variantes quitadas del formulario: se ELIMINAN (con su historial de stock y vínculos). Quien quiera conservarlas
        // sin mostrarlas en el sitio las deja desmarcadas como «Activa». Las que forman parte de un pack lo impiden (FK).
        ...(restringido
          ? []
          : [
              t.query(
                `delete from variantes
                  where producto_id = $1 and id <> all($2::bigint[])`,
                [id, existentes.map((v) => v.id)]
              ),
            ]),
        ...nuevas.map((v) =>
          t.query(
            `insert into variantes (producto_id, nombre, precio, precio_oferta, stock, imagen, notas_aromaticas, orden,
               sku, stock_minimo, costo, activo, codigo_barras, volumen, descripcion, registro_sanitario,
               cantidad_empaque, fragancia_perfume, es_pack, saga_extras, saga_combinar_nombre, imagenes, atributos)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22::text[],$23::jsonb)`,
            [v.producto_id, v.nombre, v.precio, v.precio_oferta, v.stock, v.imagen, v.notas_aromaticas, v.orden,
             v.sku, v.stock_minimo, v.costo, v.activo, v.codigo_barras, v.volumen, v.descripcion, v.registro_sanitario,
             v.cantidad_empaque, v.fragancia_perfume, v.es_pack, v.saga_extras, v.saga_combinar_nombre, v.imagenes, v.atributos]
          )
        ),
      ]);
    } catch (err) {
      if (String(err.message).includes("variantes_sku_uniq")) {
        return { error: "Ese SKU ya lo usa otra variante. Cada SKU debe ser único." };
      }
      if (String(err.message).includes("pack_componentes")) {
        return { error: "Una variante que forma parte de un pack no se puede eliminar: quítala primero del pack." };
      }
      return { error: `No se pudo guardar el producto: ${err.message}` };
    }

    revalidatePath("/", "layout");

    revalidatePath("/api/catalogo");
    revalidatePath(`/marca/${pestana}`);
    revalidatePath(`/producto/${id}`);
    revalidatePath("/admin");
    revalidatePath("/operaciones/productos");

    // Composición de los packs (ya validada arriba): se reemplaza por la del formulario.
    if (!restringido) {
      const filasPack = await query("select id, orden from variantes where producto_id = $1 and activo", [id]);
      const idPackPorOrden = new Map(filasPack.map((f) => [f.orden, f.id]));
      const packsGuardados = [];
      for (const v of variantesFinal) {
        const packId = v.id ?? idPackPorOrden.get(v.orden);
        if (!packId) continue;
        await query("delete from pack_componentes where pack_variante_id = $1", [packId]);
        if (!v.es_pack) continue;
        for (const c of v.componentes) {
          await query(
            "insert into pack_componentes (pack_variante_id, componente_variante_id, cantidad) values ($1,$2,$3)",
            [packId, c.id, c.cantidad]
          );
        }
        packsGuardados.push(Number(packId));
      }
      // El boolean de disponibilidad de la tienda sigue al stock calculado. Si la composición cambió el
      // stock del pack, SAGA se entera en sincronizarCambiosStock (compara con `previas`).
      await refrescarDisponibilidad(packsGuardados);
    }

    // Variantes que cambian de disponibilidad en SAGA (sin stock, desactivada, otro stock mínimo…).
    await sincronizarCambiosStock(previas);

    // Stock por cantidad (alta y edición): pasa por el inventario para dejar historial y avisar a SAGA.
    const cambiosStock = variantesFinal.filter((v) => v.stock_cantidad !== null && v.stock_cantidad !== v.stock_original);
    if (cambiosStock.length) {
      const filas = await query("select id, orden from variantes where producto_id = $1 and activo", [id]);
      const idPorOrden = new Map(filas.map((f) => [f.orden, f.id]));
      for (const v of cambiosStock) {
        const vid = idPorOrden.get(v.orden);
        if (vid) {
          await fijarStock({
            varianteId: Number(vid),
            cantidad: v.stock_cantidad,
            motivo: modo === "crear" ? "Stock inicial (alta de producto)" : "Edición de producto",
          });
        }
      }
    }

    // Precios propios por cuenta (vacío = el de la web). Se guardan antes de enviar a SAGA.
    if (conSaga) {
      const filas = await query("select id, orden from variantes where producto_id = $1 and activo", [id]);
      const idPorOrden = new Map(filas.map((f) => [f.orden, f.id]));
      const cuentas = new Set((await query("select alias from cuentas_saga")).map((c) => c.alias));
      const fechaOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : null);
      for (const v of variantesFinal) {
        const vid = idPorOrden.get(v.orden);
        if (!vid) continue;
        for (const [alias, d] of Object.entries(v.precios_saga)) {
          if (!cuentas.has(alias) || !d || typeof d !== "object") continue;
          const fila = [parseNumero(d.precio), parseNumero(d.precioOferta), fechaOk(d.ofertaInicio), fechaOk(d.ofertaFin)];
          if (fila.every((x) => x === null)) {
            await query("delete from precios_canal where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2", [vid, alias]);
          } else {
            await query(
              `insert into precios_canal (variante_id, sistema, cuenta_alias, precio, precio_oferta, oferta_inicio, oferta_fin)
               values ($1,'saga',$2,$3,$4,$5,$6)
               on conflict (variante_id, sistema, cuenta_alias)
               do update set precio=$3, precio_oferta=$4, oferta_inicio=$5, oferta_fin=$6`,
              [vid, alias, ...fila]
            );
          }
        }
      }
    }

    // Paquete propio por cuenta: solo las cuentas marcadas «personalizar»; el resto vuelve al paquete general.
    if (conSaga) {
      const paquetes = leerJson(formData.get("paquetesJson"));
      const cuentas = (await query("select alias from cuentas_saga")).map((c) => c.alias);
      for (const alias of cuentas) {
        const d = paquetes?.[alias];
        if (!d || typeof d !== "object" || d.personalizar !== true) {
          await query("delete from paquete_plataforma where producto_id = $1 and sistema = 'saga' and cuenta_alias = $2", [id, alias]);
          continue;
        }
        await query(
          `insert into paquete_plataforma (producto_id, sistema, cuenta_alias, contenido_paquete, paquete_ancho, paquete_largo, paquete_alto, paquete_peso)
           values ($1,'saga',$2,$3,$4,$5,$6,$7)
           on conflict (producto_id, sistema, cuenta_alias)
           do update set contenido_paquete=$3, paquete_ancho=$4, paquete_largo=$5, paquete_alto=$6, paquete_peso=$7`,
          [id, alias, (d.contenidoPaquete || "").toString().trim().slice(0, 172) || null,
           parseNumero(d.paqueteAncho), parseNumero(d.paqueteLargo), parseNumero(d.paqueteAlto), parseNumero(d.paquetePeso)]
        );
      }
    }

    // Categoría primaria propia por cuenta: solo las marcadas «personalizar» y con una categoría válida de la lista.
    if (conSaga) {
      const porCuenta = leerJson(formData.get("categoriasCuentaJson"));
      const cuentas = (await query("select alias from cuentas_saga")).map((c) => c.alias);
      const validas = new Set((opcionesGuardadas.categorias || []).map((c) => String(c.id)));
      const personaliza = (d) => d && typeof d === "object" && d.personalizar === true && validas.has(String(d.sagaCategoria || ""));
      try {
        for (const alias of cuentas) {
          const d = porCuenta?.[alias];
          const cat = d && typeof d === "object" && d.personalizar === true ? String(d.sagaCategoria || "") : "";
          if (!cat || !validas.has(cat)) {
            await query("delete from categoria_plataforma where producto_id = $1 and sistema = 'saga' and cuenta_alias = $2", [id, alias]);
            continue;
          }
          await query(
            `insert into categoria_plataforma (producto_id, sistema, cuenta_alias, saga_categoria, saga_extras, variante_extras)
             values ($1,'saga',$2,$3,$4::jsonb,$5::jsonb)
             on conflict (producto_id, sistema, cuenta_alias)
             do update set saga_categoria=$3, saga_extras=$4::jsonb, variante_extras=$5::jsonb`,
            [id, alias, cat, JSON.stringify(limpiarValores(d.extras)), JSON.stringify(limpiarValores(d.varianteExtras))]
          );
        }
      } catch (e) {
        // Sin la tabla nueva solo importa si se pidió personalizar alguna cuenta.
        if (cuentas.some((a) => personaliza(porCuenta?.[a]))) return { error: `El producto se guardó, pero no la categoría por cuenta (¿falta correr neon/schema.sql?): ${e.message}` };
      }
    }

    // Integración SAGA: tras guardar. Si falta algo, el producto queda guardado
    // y se avisa qué completar (el estado de cada variante queda en la tabla).
    // Una cuenta que estaba enlazada y se desmarcó en el formulario equivale a «Dejar de sincronizar» (solo cuentas que el formulario mostró).
    let desmarcadas = [];
    if (conSaga && modo === "editar") {
      let visibles = [];
      try {
        visibles = JSON.parse((formData.get("sagaCuentasVisibles") || "[]").toString()).map(String);
      } catch {
        visibles = [];
      }
      const enlazadas = await query(
        "select s.variante_id, s.cuenta_alias from sincronizaciones s join variantes v on v.id = s.variante_id where v.producto_id = $1 and s.sistema = 'saga'",
        [id]
      );
      desmarcadas = enlazadas.filter((r) => visibles.includes(r.cuenta_alias) && !cuentasSaga.includes(r.cuenta_alias));
    }
    if (cuentasSaga.length || desmarcadas.length) {
      if (!accionesSaga.length && !desmarcadas.length) {
        return { ok: true, aviso: "Guardado. No se envió nada a SAGA: no elegiste ninguna acción para las variantes." };
      }
      const filas = await query("select id, orden from variantes where producto_id = $1 and activo", [id]);
      const idPorOrden = new Map(filas.map((f) => [f.orden, f.id]));
      const acciones = accionesSaga
        .filter((a) => idPorOrden.has(a.orden))
        .map((a) => ({ varianteId: idPorOrden.get(a.orden), alias: a.alias, modo: a.modo }));
      for (const r of desmarcadas) acciones.push({ varianteId: r.variante_id, alias: r.cuenta_alias, modo: "desvincular" });
      const { resultados } = await sincronizarProducto(id, acciones, { usuario: usuarioPanel });
      revalidatePath("/admin");
      const errores = resultados.filter((r) => r.estado === "error");
      const creadas = resultados.filter((r) => r.modo === "crear" && r.estado === "pendiente").length;
      // SAGA solo acepta la imagen con el producto ya creado y exige 2 minutos entre envíos de una cuenta:
      // se envía después, sin hacer esperar al usuario (la cola y «Consultar estado» lo completan si hace falta).
      // El drenador envía solo lo que quedó en cola y las imágenes, y sigue hasta que no quede nada.
      if (resultados.some((r) => r.estado === "pendiente" || r.estado === "en_cola")) after(() => drenarCola());
      const enCola = resultados.filter((r) => r.estado === "en_cola").length;
      const sincronizadas = resultados.filter((r) => !["crear", "desvincular"].includes(r.modo) && ["pendiente", "vinculada"].includes(r.estado)).length;
      const desvinculadas = resultados.filter((r) => r.estado === "desvinculada").length;
      const partes = [
        creadas && `${creadas} creada(s) en SAGA (pendiente de validación)`,
        sincronizadas && `${sincronizadas} sincronizada(s) con SAGA`,
        desvinculadas && `${desvinculadas} desvinculada(s)`,
        enCola && `${enCola} en cola (SAGA permite 1 envío cada 2 minutos por cuenta: se enviarán solas)`,
      ].filter(Boolean);
      const detalle = errores.map((r) => `${r.variante} (${r.alias}): ${r.error}`).join(" · ");
      const avisos = [...new Set(resultados.flatMap((r) => r.avisos || []))];
      return {
        ok: true,
        aviso: `Guardado.${partes.length ? ` ${partes.join(", ")}.` : ""}${errores.length ? ` Con error: ${detalle}` : ""}${avisos.length ? ` Avisos: ${avisos.join(" ")}` : ""}`,
      };
    }
  } catch (err) {
    return { error: err.message || "Error inesperado al guardar el producto." };
  }

  return { ok: true };
}
