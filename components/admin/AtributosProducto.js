"use client";

import SelectBuscador from "./SelectBuscador";
import SelectMulti from "./SelectMulti";
import CamposExtra from "./CamposExtra";

/** Grupo plegable de atributos (cerrado de entrada). */
function Grupo({ titulo, children }) {
  return (
    <details className="saga-seccion pf-sub pf-sub-atributos">
      <summary>{titulo}</summary>
      <div className="saga-cuerpo pf-atributos-cuerpo">{children}</div>
    </details>
  );
}

const lista = (t) => String(t || "").split(",").map((x) => x.trim()).filter(Boolean);
const textoDe = (x) => (Array.isArray(x) ? x.join(", ") : x === null || x === undefined ? "" : String(x));

/**
 * Atributos de un producto o de una variante (mismo conjunto). Con `heredados` indefinido es el PRODUCTO: lleva todos
 * los valores y envía sus campos con `name`. Con `heredados` (los atributos del producto) es una VARIANTE: `valores`
 * solo trae lo personalizado y cada campo vacío muestra «= producto», porque usa el del producto.
 * Los cambios salen por onChange({ clave: valor }) con las mismas claves camelCase (ver lib/atributos-efectivos.js).
 */
export default function AtributosProducto({
  valores = {},
  onChange,
  heredados,
  prefijo = "ap",
  conSaga,
  sagaGeneral,
  opcionesSaga = {},
  atribCategoria = [],
  nombreCategoria = "la categoría",
  camposProducto = [],
  camposVariante = [],
  sinVariantes = false,
}) {
  const esVar = heredados !== undefined;
  const get = (k) => valores?.[k];
  const her = (k) => textoDe(heredados?.[k]);
  const pone = (cambios) => onChange(cambios);
  const nm = (n) => (esVar ? undefined : n);
  const id = (k) => `${prefijo}-${k}`;
  const perfume = !sagaGeneral;
  const propio = (k) => esVar && textoDe(get(k)).trim() !== "";

  const AROMAS_SAGA = opcionesSaga.aromas || [];
  const CANTIDADES = opcionesSaga.cantidades || [];

  const etiqueta = (k, texto, obligatorio) => (
    <label htmlFor={id(k)}>
      {texto} {obligatorio && <em>obligatorio</em>}
      {propio(k) && <em> personalizado</em>}
    </label>
  );

  // Lista desplegable. En una variante, la primera opción vacía significa «igual que el producto».
  const selector = (k, texto, opciones, { obligatorio = false, vacioEnProducto = false, nombre } = {}) => {
    const v = textoDe(get(k));
    return (
      <div className="campo">
        {etiqueta(k, texto, obligatorio)}
        <select id={id(k)} name={nm(nombre || k)} value={v} onChange={(e) => pone({ [k]: e.target.value })}>
          {esVar ? (
            <option value="">{her(k) ? `= producto (${her(k)})` : "= producto"}</option>
          ) : (
            vacioEnProducto && <option value="">— Elegir —</option>
          )}
          {v && !opciones.includes(v) && <option value={v}>{v}</option>}
          {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  };

  const caja = (k, texto, { obligatorio = false, placeholder, nombre, tipo = "text" } = {}) => (
    <div className="campo">
      {etiqueta(k, texto, obligatorio)}
      <input
        id={id(k)}
        name={nm(nombre || k)}
        type={tipo}
        {...(tipo === "number" ? { min: "0", step: "0.01" } : {})}
        value={textoDe(get(k))}
        placeholder={esVar && her(k) ? `= producto: ${her(k)}` : placeholder}
        onChange={(e) => pone({ [k]: e.target.value })}
      />
    </div>
  );

  // Atributos propios de la categoría web (Integraciones → Web): cada uno en el apartado que se eligió allí.
  const propiosDe = (grupo) => atribCategoria.filter((a) => (a.grupo || "detalles") === grupo);
  const camposPropios = (grupo) =>
    conSaga && propiosDe(grupo).length > 0 && (
      <div className="campo">
        <CamposExtra
          campos={propiosDe(grupo)}
          valores={get("propios") || {}}
          heredados={esVar ? heredados?.propios || {} : undefined}
          onChange={(propios) => pone({ propios })}
          prefijo={id(`propio-${grupo}`)}
        />
      </div>
    );
  const caracteristicas = lista(get("caracteristicas"));
  const fraganciaPerfume = Array.isArray(get("fraganciaPerfume")) ? get("fraganciaPerfume") : [];

  return (
    <div className="pf-atributos">
      {conSaga && (
        <Grupo titulo="Clasificación y registro">
          <div className="pf-grid-auto">
            {selector("condicion", "Condición", opcionesSaga.condiciones || [], { obligatorio: true })}
            {perfume && (
              <>
                {selector("tipoPerfume", "Tipo de perfume", opcionesSaga.tiposPerfume || [], { obligatorio: true, vacioEnProducto: true })}
                {selector("genero", "Género", opcionesSaga.generos || [], { obligatorio: true, vacioEnProducto: true })}
                {selector("formatoBelleza", "Formato", opcionesSaga.formatosBelleza || [], { obligatorio: true })}
              </>
            )}
            {caja("modelo", "Modelo")}
            <div className="campo">
              {etiqueta("paisProduccion", "País de producción")}
              <SelectBuscador
                id={id("paisProduccion")}
                name={nm("paisProduccion") || `${prefijo}-pais`}
                valor={textoDe(get("paisProduccion"))}
                onChange={(v) => pone({ paisProduccion: v })}
                opciones={(opcionesSaga.paises || []).map((p) => ({ valor: p, etiqueta: p }))}
                placeholder={esVar && her("paisProduccion") ? `= producto: ${her("paisProduccion")}` : "Buscar país…"}
              />
            </div>
            {caja("registroSanitario", "Registro sanitario", { obligatorio: true })}
          </div>
          {camposPropios("clasificacion")}
        </Grupo>
      )}

      <Grupo titulo="Perfil del producto">
        <div className={conSaga && perfume ? "pf-grid-2" : undefined}>
          <div className="campo">
            <label htmlFor={id("notasAromaticas")}>
              Notas aromáticas
              {propio("notasAromaticas") && <em> personalizado</em>}
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
            <small>
              {esVar && lista(get("notasAromaticas")).length === 0 && her("notasAromaticas")
                ? `= producto: ${her("notasAromaticas")}`
                : "Se muestran en la web como etiquetas; en perfumes también se envían a SAGA."}
            </small>
          </div>
          {conSaga && perfume && (
            <div className="campo">
              <label>Características <em>opcional</em>{propio("caracteristicas") && <em> personalizado</em>}</label>
              {!esVar && <input type="hidden" name="caracteristicas" value={textoDe(get("caracteristicas"))} />}
              <SelectMulti
                valor={caracteristicas}
                opciones={opcionesSaga.caracteristicas || []}
                onChange={(v) => pone({ caracteristicas: v.join(", ") })}
                placeholder="Elegir características…"
              />
              {esVar && caracteristicas.length === 0 && her("caracteristicas") && <small>= producto: {her("caracteristicas")}</small>}
            </div>
          )}
        </div>
        {conSaga && perfume && (
          <div className="campo">
            <label>Fragancia — solo opciones de la lista <em>obligatorio, al menos una</em>{fraganciaPerfume.length > 0 && esVar && <em> personalizado</em>}</label>
            {!esVar && <input type="hidden" name="fraganciaPerfumeJson" value={JSON.stringify(fraganciaPerfume)} />}
            <SelectMulti valor={fraganciaPerfume} opciones={AROMAS_SAGA} onChange={(v) => pone({ fraganciaPerfume: v })} placeholder="Elegir fragancias…" />
            {esVar && fraganciaPerfume.length === 0 && textoDe(heredados?.fraganciaPerfume) && <small>= producto: {textoDe(heredados.fraganciaPerfume)}</small>}
          </div>
        )}
        {conSaga && perfume && (
          <div className="pf-grid-2">
            {selector("volumen", "Medida del frasco", CANTIDADES, { obligatorio: true, vacioEnProducto: true })}
            {caja("cantidadEmpaque", "Cantidad contenida en el empaque", {
              placeholder: textoDe(get("volumen") || heredados?.volumen) ? `Vacío = ${textoDe(get("volumen") || heredados?.volumen).replace(/\s+/g, "")}` : "Vacío = usa la medida (ej. 100ML)",
            })}
          </div>
        )}
        {camposPropios("aromas")}
      </Grupo>

      {conSaga && (
        <Grupo titulo="Detalles">
          {esVar && (
            <div className="campo">
              <label htmlFor={id("descripcion")}>Descripción de la variante{propio("descripcion") && <em> personalizado</em>} <small>se muestra en la web al elegir esta variante y se envía a las plataformas</small></label>
              <textarea
                id={id("descripcion")}
                rows={3}
                value={textoDe(get("descripcion"))}
                onChange={(e) => pone({ descripcion: e.target.value })}
                placeholder="Vacía = se usa la descripción del producto"
              />
            </div>
          )}
          {camposPropios("detalles")}
        </Grupo>
      )}

      {conSaga && (
        <Grupo titulo="Paquete">
          <div className="pf-grid-4">
            {[["paqueteAncho", "Ancho (cm)"], ["paqueteLargo", "Largo (cm)"], ["paqueteAlto", "Alto (cm)"], ["paquetePeso", "Peso (kg)"]].map(([k, et]) => (
              <div key={k}>{caja(k, et, { obligatorio: true, tipo: "number" })}</div>
            ))}
          </div>
          {caja("contenidoPaquete", "Contenido del paquete", { placeholder: "Ej: 1 perfume 50 ml" })}
          
          {camposPropios("paquete")}
        </Grupo>
      )}
    </div>
  );
}
