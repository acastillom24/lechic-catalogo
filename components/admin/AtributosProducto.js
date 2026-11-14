"use client";

import SelectUnico from "./SelectUnico";
import SelectMulti from "./SelectMulti";
import CamposExtra from "./CamposExtra";

/** Grupo plegable de atributos (cerrado de entrada). */
function Grupo({ titulo, children, abierto = false, plano = false }) {
  // En el panel «Atributos» del producto todo va seguido, sin desplegables por grupo.
  if (plano) return <div className="pf-atributos-plano">{children}</div>;
  return (
    <details className="saga-seccion pf-sub pf-sub-atributos" open={abierto}>
      <summary>{titulo}</summary>
      <div className="saga-cuerpo pf-atributos-cuerpo">{children}</div>
    </details>
  );
}

const lista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);
const textoDe = (x) => (Array.isArray(x) ? x.join(", ") : x === null || x === undefined ? "" : String(x));

// Campos de la web que SAGA lista por categoría y que se pueden ubicar en «Atributos» o en «Variantes» (Integraciones → Web → Atributos por
// categoría). Por defecto van en Atributos, salvo la Cantidad (CantidadPerfumesVariant), que es una variación.
const MOVIBLES = ["tipoPerfume", "genero", "formatoBelleza", "notasAromaticas", "caracteristicas", "fraganciaPerfume", "cantidadEmpaque", "volumen"];
export const UBICACION_DEFECTO = { volumen: "variantes" };

/**
 * Atributos de un producto o de una variante (mismo conjunto). Con `enVariante` falso es el PRODUCTO: lleva todos
 * los valores y envía sus campos con `name`. Con `enVariante` es una VARIANTE: sus valores son propios de ella
 * (no heredan del producto) y no usan `name`.
 * Los cambios salen por onChange({ clave: valor }) con las mismas claves camelCase (ver lib/atributos-efectivos.js).
 * Cada campo y cada atributo propio se ve en «Atributos» o en «Variación» según lo elegido en la configuración: `soloVariacion` pinta solo
 * la variación (panel Variantes con una sola variante) y `conservarVariacion` guarda oculto el valor del producto cuando la variación
 * se llena en cada variante.
 */
export default function AtributosProducto({
  valores = {},
  onChange,
  enVariante = false,
  prefijo = "ap",
  conSaga,
  sagaGeneral,
  generales,
  etiquetas = {},
  requisitos = {},
  opcionesSaga = {},
  atribCategoria = [],
  omitirGenerales = false,
  soloVariacion = false,
  conservarVariacion = false,
}) {
  const esVar = enVariante;
  // En el panel «Atributos» del producto no van los campos generales (Condición, Modelo, País, paquete…): están en «Producto y garantía».
  const gen = omitirGenerales && !esVar;
  const get = (k) => valores?.[k];
  const pone = (cambios) => onChange(cambios);
  const nm = (n) => (esVar ? undefined : n);
  const id = (k) => `${prefijo}-${k}`;
  const perfume = !sagaGeneral;
  // Campos generales libres activos en la categoría (Integraciones → Web). Sin la lista, vale lo de siempre: los de perfumes solo en perfumes.
  const SOLO_PERFUMES = ["volumen", "notasAromaticas", "tipoPerfume", "genero", "formatoBelleza", "caracteristicas", "fraganciaPerfume", "cantidadEmpaque"];
  const mostrar = (k) => (Array.isArray(generales) ? generales.includes(k) : !SOLO_PERFUMES.includes(k) || perfume);
  // Nombre editado en Integraciones → Web → Campos generales (o el de siempre).
  const et = (k, defecto) => etiquetas[k] || defecto;
  // Dónde va cada campo: «atributos» o «variantes» (lo elegido en la configuración o el predeterminado).
  const ubic = (k) => requisitos?.[k]?.ubicacion || UBICACION_DEFECTO[k] || "atributos";

  const AROMAS_SAGA = opcionesSaga.aromas || [];
  const CANTIDADES = opcionesSaga.cantidades || [];

  const etiqueta = (k, texto, obligatorio) => (
    <label htmlFor={id(k)}>
      {texto} {obligatorio && <em>obligatorio</em>}
    </label>
  );

  // Lista desplegable de selección única (mismo aspecto que Características). En una variante, la opción vacía significa «igual que el producto».
  const selector = (k, texto, opciones, { obligatorio = false, vacioEnProducto = false, nombre } = {}) => {
    const v = textoDe(get(k));
    const vacio = esVar || vacioEnProducto ? "Sin selección" : undefined;
    return (
      <div className="campo" key={k}>
        {etiqueta(k, texto, obligatorio)}
        <SelectUnico id={id(k)} name={nm(nombre || k)} valor={v} opciones={opciones} onChange={(x) => pone({ [k]: x })} vacio={vacio} placeholder="Elegir…" />
      </div>
    );
  };

  const caja = (k, texto, { obligatorio = false, placeholder, nombre, tipo = "text" } = {}) => (
    <div className="campo" key={k}>
      {etiqueta(k, texto, obligatorio)}
      <input
        id={id(k)}
        name={nm(nombre || k)}
        type={tipo}
        {...(tipo === "number" ? { min: "0", step: "0.01" } : {})}
        value={textoDe(get(k))}
        placeholder={placeholder}
        onChange={(e) => pone({ [k]: e.target.value })}
      />
    </div>
  );

  // Atributos propios (Integraciones → Web): los generales por apartado; los de «Atributos» y «Variantes» según su ubicación.
  const propiosDe = (grupo) => atribCategoria.filter((a) => a.general && (a.grupo || "detalles") === grupo && !(gen && a.bloque !== "especificaciones"));
  const propiosUb = (ub) => atribCategoria.filter((a) => !a.general && (a.ubicacion || "atributos") === ub);
  const atributosProp = propiosUb("atributos");
  const variacionProp = propiosUb("variantes");
  const camposPropios = (grupo) =>
    conSaga && propiosDe(grupo).length > 0 && (
      <div className="campo">
        <CamposExtra
          campos={propiosDe(grupo)}
          valores={get("propios") || {}}
          onChange={(propios) => pone({ propios })}
          prefijo={id(`propio-${grupo}`)}
        />
      </div>
    );
  const extra = (campos, clave) => (
    <div className="campo pf-extra-wrap">
      <CamposExtra
        campos={campos}
        valores={get("propios") || {}}
        onChange={(propios) => pone({ propios })}
        prefijo={id(`propio-${clave}`)}
      />
    </div>
  );
  const caracteristicas = lista(get("caracteristicas"));
  const fraganciaPerfume = Array.isArray(get("fraganciaPerfume")) ? get("fraganciaPerfume") : [];

  // ----- Campos movibles: cada uno devuelve su bloque (con su campo oculto cuando lo necesita)
  const campo = {
    tipoPerfume: () => selector("tipoPerfume", et("tipoPerfume", "Tipo de perfume"), opcionesSaga.tiposPerfume || [], { obligatorio: perfume, vacioEnProducto: true }),
    genero: () => selector("genero", et("genero", "Género"), opcionesSaga.generos || [], { obligatorio: perfume, vacioEnProducto: true }),
    formatoBelleza: () => selector("formatoBelleza", et("formatoBelleza", "Formato"), opcionesSaga.formatosBelleza || [], { obligatorio: perfume }),
    volumen: () => selector("volumen", et("volumen", "Medida del frasco"), CANTIDADES, { obligatorio: true, vacioEnProducto: true }),
    cantidadEmpaque: () =>
      caja("cantidadEmpaque", et("cantidadEmpaque", "Cantidad contenida en el empaque"), {
        placeholder: textoDe(get("volumen")) ? `Vacío = ${textoDe(get("volumen")).replace(/\s+/g, "")}` : "Vacío = usa la medida (ej. 100ML)",
      }),
    notasAromaticas: () => (
      <div className="campo" key="notasAromaticas">
        <label htmlFor={id("notasAromaticas")}>
          {et("notasAromaticas", "Notas aromáticas")}
        </label>
        {!esVar && <input type="hidden" name="notasAromaticas" value={textoDe(get("notasAromaticas"))} />}
        <SelectMulti
          id={id("notasAromaticas")}
          libre
          valor={lista(get("notasAromaticas"))}
          opciones={[]}
          onChange={(v) => pone({ notasAromaticas: v.join(", ") })}
          placeholder="Escribir y agregar…"
          buscar="Escribe una nota y presiona Enter…"
        />
        <small>Se muestran en la web como etiquetas; en perfumes también se envían a SAGA.</small>
      </div>
    ),
    caracteristicas: () => (
      <div className="campo" key="caracteristicas">
        <label>{et("caracteristicas", "Características")} <em>opcional</em></label>
        {!esVar && <input type="hidden" name="caracteristicas" value={textoDe(get("caracteristicas"))} />}
        <SelectMulti
          valor={caracteristicas}
          opciones={opcionesSaga.caracteristicas || []}
          onChange={(v) => pone({ caracteristicas: v.join(", ") })}
          placeholder="Elegir características…"
        />
      </div>
    ),
    fraganciaPerfume: () => (
      <div className="campo" key="fraganciaPerfume">
        <label>{et("fraganciaPerfume", "Fragancia")} — solo opciones de la lista <em>obligatorio, al menos una</em></label>
        {!esVar && <input type="hidden" name="fraganciaPerfumeJson" value={JSON.stringify(fraganciaPerfume)} />}
        <SelectMulti valor={fraganciaPerfume} opciones={AROMAS_SAGA} onChange={(v) => pone({ fraganciaPerfume: v })} placeholder="Elegir fragancias…" />
      </div>
    ),
  };

  // ¿Se pinta este campo aquí? (según el apartado: «Atributos» del producto, variación, o ambos dentro de una variante)
  const visibleAqui = (k) => conSaga && mostrar(k) && (esVar ? true : soloVariacion ? ubic(k) === "variantes" : ubic(k) === "atributos");
  // Valor del producto que viaja oculto para no perderlo: campo desactivado en la categoría (lo guarda quien le corresponde) o campo de
  // variación cuando hay varias variantes (se llena en cada una).
  const dueno = (k) => (ubic(k) === "variantes" ? soloVariacion || conservarVariacion : !soloVariacion);
  const ocultoAqui = (k) =>
    !esVar && conSaga && !visibleAqui(k) && ((!mostrar(k) && dueno(k)) || (mostrar(k) && ubic(k) === "variantes" && !soloVariacion && conservarVariacion));
  const ocultos = MOVIBLES.filter(ocultoAqui).map((k) =>
    k === "fraganciaPerfume" ? (
      <input key={k} type="hidden" name="fraganciaPerfumeJson" value={JSON.stringify(fraganciaPerfume)} />
    ) : (
      <input key={k} type="hidden" name={k} value={textoDe(get(k))} />
    )
  );
  // Campos libres no movibles desactivados en la categoría (Modelo, País, Incluye): ya los guarda «Producto y garantía» salvo en una variante.
  const ocultosGenerales =
    !esVar && !gen && !soloVariacion
      ? ["modelo", "paisProduccion", "contenidoPaquete"].filter((k) => conSaga && !mostrar(k)).map((k) => <input key={k} type="hidden" name={k} value={textoDe(get(k))} />)
      : [];

  // Parte «Variación»: lo que se llena en cada variante.
  const enVariacion = MOVIBLES.filter((k) => ubic(k) === "variantes" && (esVar || soloVariacion) && visibleAqui(k));
  const hayVariacion = conSaga && (enVariacion.length > 0 || variacionProp.length > 0);
  const parteVariacion = hayVariacion && (
    <Grupo titulo="Variación" abierto plano={!esVar || soloVariacion}>
      {enVariacion.length > 0 && <div className="pf-grid-auto">{enVariacion.map((k) => campo[k]())}</div>}
      {variacionProp.length > 0 && extra(variacionProp, "variantes")}
    </Grupo>
  );

  if (soloVariacion) {
    return (
      <div className="pf-atributos">
        {ocultos}
        {parteVariacion}
      </div>
    );
  }

  // Parte «Atributos»: los campos ubicados en Atributos, el registro sanitario y los atributos propios de «Atributos».
  const enAtributos = MOVIBLES.filter((k) => ubic(k) === "atributos" && visibleAqui(k));
  const cortos = enAtributos.filter((k) => ["tipoPerfume", "genero", "formatoBelleza"].includes(k));
  const multis = enAtributos.filter((k) => ["notasAromaticas", "caracteristicas"].includes(k));
  const parteAtributos = conSaga && (
    <Grupo titulo="Atributos" abierto plano={!esVar}>
      <div className="pf-grid-auto">
        {cortos.map((k) => campo[k]())}
        {caja("registroSanitario", et("registroSanitario", "Registro sanitario"), { obligatorio: true })}
        {enAtributos.includes("cantidadEmpaque") && campo.cantidadEmpaque()}
      </div>
      {multis.length > 0 && <div className={multis.length > 1 ? "pf-grid-2" : undefined}>{multis.map((k) => campo[k]())}</div>}
      {enAtributos.includes("fraganciaPerfume") && campo.fraganciaPerfume()}
      {atributosProp.length > 0 && extra(atributosProp, "atributos")}
      {camposPropios("detalles")}
    </Grupo>
  );

  return (
    <div className="pf-atributos">
      {ocultos}
      {ocultosGenerales}
      {esVar && parteVariacion}
      {parteAtributos}
    </div>
  );
}
