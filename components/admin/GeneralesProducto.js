"use client";

import SelectUnico from "./SelectUnico";
import CamposExtra from "./CamposExtra";
import { CAMPOS_WEB, PANELES } from "../../lib/campos-web";

const textoDe = (x) => (x === null || x === undefined ? "" : String(x));

/**
 * Producto y garantía: los campos GENERALES de la web (los de Integraciones → Web → Campos generales), en el orden de SAGA.
 *  - parte="principal": Modelo y País de origen (más los atributos generales propios del bloque «Principal»). El nombre, la marca y la
 *    descripción los pone el formulario.
 *  - parte="garantia": Condición, nombre en chino/inglés, detalle de condición y de garantía, garantía, Incluye y medidas del paquete
 *    (más los atributos generales propios de «Garantía y envío»). Con `soloObligatorios` marcado solo salen los obligatorios.
 * Nombres, opciones, largos y «obligatorio» salen de lo definido en la web (`requisitos` = camposWeb). Los campos desactivados en la
 * categoría no se ven, pero su valor viaja oculto para no borrar lo ya guardado.
 */
export default function GeneralesProducto({
  parte,
  valores = {},
  onChange,
  conSaga,
  generales,
  etiquetas = {},
  requisitos = {},
  opcionesSaga = {},
  atribCategoria = [],
  soloObligatorios = false,
  solo,
}) {
  const get = (k) => valores?.[k];
  const pone = (cambios) => onChange(cambios);
  const bloque = PANELES.flatMap((p) => p.bloques).find((b) => b.id === (parte === "principal" ? "principal" : "garantia"));
  // Campo activo en la categoría: los bloqueados siempre; los libres según Integraciones → Web.
  const activo = (def) => !conSaga || !def.saga || !Array.isArray(generales) || def.clave || generales.includes(def.id);
  const obligatorio = (def) => Boolean(def.obligatorioSaga || requisitos[def.id]?.obligatorio);
  const etiqueta = (def) => etiquetas[def.id] || def.etiqueta;
  const maximo = (def) => requisitos[def.id]?.max || def.max;

  const rotulo = (def) => (
    <label htmlFor={`g-${def.id}`}>
      {etiqueta(def)}
      {obligatorio(def) && <em> *</em>}
    </label>
  );
  const ayuda = (def) => {
    const r = requisitos[def.id] || {};
    const partes = [];
    if (r.min) partes.push(`mín. ${r.min} caracteres`);
    if (r.max && def.tipo === "texto") partes.push(`máx. ${r.max}`);
    return partes.length ? <small>{partes.join(" · ")}</small> : null;
  };

  const caja = (def, { tipo = "text" } = {}) => (
    <div className="campo" key={def.id}>
      {rotulo(def)}
      <input
        id={`g-${def.id}`}
        name={def.id}
        type={tipo}
        {...(tipo === "number" ? { min: "0", step: "0.01" } : {})}
        {...(def.tipo === "texto" && maximo(def) ? { maxLength: maximo(def) } : {})}
        value={textoDe(get(def.id))}
        onChange={(e) => pone({ [def.id]: e.target.value })}
      />
      {ayuda(def)}
    </div>
  );
  const lista = (def, opciones, { vacio = false } = {}) => (
    <div className="campo" key={def.id}>
      {rotulo(def)}
      <SelectUnico
        id={`g-${def.id}`}
        name={def.id}
        valor={textoDe(get(def.id))}
        opciones={opciones}
        onChange={(v) => pone({ [def.id]: v })}
        vacio={vacio ? "Sin selección" : undefined}
        placeholder="Elegir…"
        requerido={obligatorio(def)}
      />
    </div>
  );
  const pais = (def) => (
    <div className="campo" key={def.id}>
      {rotulo(def)}
      <SelectUnico
        id={`g-${def.id}`}
        name={def.id}
        valor={textoDe(get(def.id))}
        onChange={(v) => pone({ [def.id]: v })}
        opciones={opcionesSaga.paises || []}
        placeholder="Elegir país…"
        buscar="Buscar país…"
      />
    </div>
  );

  const pintar = (def) => {
    if (def.id === "paisProduccion") return pais(def);
    if (def.id === "condicion") return lista(def, opcionesSaga.condiciones || []);
    if (def.id === "garantia") return lista(def, opcionesSaga.garantias || [], { vacio: true });
    if (def.tipo === "numero") return caja(def, { tipo: "number" });
    return caja(def);
  };

  const defs = bloque.campos.map((id) => CAMPOS_WEB.find((c) => c.id === id)).filter((d) => d && d.id !== "nombre" && d.id !== "marca" && d.id !== "descripcion");
  const visibles = defs.filter((d) => (!solo || solo.includes(d.id)) && activo(d) && (parte !== "garantia" || !soloObligatorios || obligatorio(d)));
  // Los desactivados en la categoría (y los ocultos por «solo obligatorios») conservan su valor al guardar.
  const ocultos = defs.filter((d) => !visibles.includes(d) && (!solo || solo.includes(d.id)));

  // Atributos generales propios (creados en Integraciones → Web → Campos generales) de este bloque.
  const propios = atribCategoria.filter((a) => a.general && a.bloque === bloque.id);
  const verPropios = propios.length > 0 && conSaga && (!solo || solo.includes("propios")) && (parte !== "garantia" || !soloObligatorios);

  return (
    <div className="pf-atributos">
      {ocultos.map((d) => (
        <input key={d.id} type="hidden" name={d.id} value={textoDe(get(d.id))} />
      ))}
      <div className="pf-grid-auto">{visibles.map((d) => pintar(d))}</div>
      {verPropios && (
        <div className="campo pf-extra-wrap">
          <CamposExtra
            campos={propios}
            valores={get("propios") || {}}
            onChange={(p) => pone({ propios: p })}
            prefijo={`gen-${parte}-propio`}
          />
        </div>
      )}
    </div>
  );
}
