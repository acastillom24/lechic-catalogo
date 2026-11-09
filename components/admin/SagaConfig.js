"use client";

import { useActionState } from "react";
import { guardarOpcionesSaga, restablecerOpcionesSaga } from "../../app/(admin)/admin/actions";
import AccionesSaga from "./AccionesSaga";
import { PERFUME, camposDe, camposActivos } from "../../lib/saga-campos";

const aTexto = (arr) => (arr || []).join("\n");

function Lista({ nombre, etiqueta, ayuda, valores, filas = 6 }) {
  return (
    <div className="campo">
      <label htmlFor={`saga-${nombre}`}>{etiqueta}</label>
      <textarea id={`saga-${nombre}`} name={nombre} rows={filas} defaultValue={aTexto(valores)} />
      {ayuda && <small style={{ color: "var(--gris)" }}>{ayuda}</small>}
    </div>
  );
}

// Los valores deben ser EXACTAMENTE los de SAGA (mayúsculas, tildes, espacios).
export default function SagaConfig({ opciones }) {
  const [estado, accion, enviando] = useActionState(guardarOpcionesSaga, {});
  const categoriasTexto = (opciones.categorias || []).map((c) => `${c.id} = ${c.nombre}`).join("\n");
  const marcasTexto = Object.entries(opciones.marcas || {})
    .map(([slug, nombre]) => `${slug} = ${nombre}`)
    .join("\n");

  return (
    <form action={accion} className="form-grid" key={estado?.n || 0}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}

      <AccionesSaga acciones={opciones.acciones} />

      <section className="admin-card form-grid">
        <h2>Conexión</h2>
        <Lista nombre="urlsBase" etiqueta="URLs base de Seller Center" valores={opciones.urlsBase} filas={3}
          ayuda="Una por línea (https://…). Son las que podrás elegir al registrar una cuenta." />
        <Lista nombre="operadores" etiqueta="Códigos de operador (OperatorCode)" valores={opciones.operadores} filas={3}
          ayuda="Uno por línea (ej. fape para Perú). Son los que podrás elegir al registrar una cuenta; se usan al enviar stock y precio." />
      </section>

      <section className="admin-card form-grid">
        <h2>Categorías primarias</h2>
        <div className="campo">
          <label htmlFor="saga-categorias">Categorías de SAGA que se pueden elegir en un producto</label>
          <textarea id="saga-categorias" name="categorias" rows={5} defaultValue={categoriasTexto} />
          <small style={{ color: "var(--gris)" }}>
            Una por línea: <code>id = Descripción</code> (ej. <code>1735 = Fragancias|perfumes</code>). Usa el id de una
            categoría hoja (★). Para buscarlas: <code>npm run saga:probar -- --arbol texto</code>.
          </small>
        </div>
      </section>

      <section className="admin-card form-grid">
        <h2>Campos extra por categoría</h2>
        <small style={{ color: "var(--gris)" }}>
          Marca qué campos de SAGA aparecen en el formulario de producto al elegir cada categoría. Los obligatorios de SAGA
          siempre se muestran. Los campos salen del catálogo de SAGA (<code>npm run saga:campos -- idCategoria</code> agrega o
          actualiza una categoría). Perfumes (1735) usa su propio formulario.
        </small>
        {(opciones.categorias || []).filter((c) => c.id !== PERFUME).map((c) => {
          const campos = camposDe(c.id);
          const activos = new Set(camposActivos(c.id, opciones.categorias).map((x) => x.id));
          return (
            <details className="saga-seccion" key={c.id}>
              <summary>
                {c.id} — {c.nombre}
                <em>{campos.length ? `${activos.size} de ${campos.length} campos visibles` : "sin catálogo"}</em>
              </summary>
              <div className="saga-cuerpo form-grid">
                {!campos.length ? (
                  <small>No hay campos guardados para esta categoría. Ejecuta <code>npm run saga:campos -- {c.id}</code>.</small>
                ) : (
                  <>
                    <input type="hidden" name={`extrasMarca_${c.id}`} value="1" />
                    {[["producto", "Por producto"], ["variante", "Por variante"]].map(([nivel, titulo]) => {
                      const delNivel = campos.filter((x) => x.nivel === nivel);
                      if (!delNivel.length) return null;
                      return (
                        <div className="campo" key={nivel}>
                          <label>{titulo}</label>
                          <div className="chips-grid">
                            {delNivel.map((x) => (
                              <label className="campo-check" key={x.id} title={x.id}>
                                <input
                                  type="checkbox"
                                  name={`extras_${c.id}`}
                                  value={x.id}
                                  defaultChecked={activos.has(x.id)}
                                  disabled={x.obligatorio}
                                />
                                {x.etiqueta}
                                {x.obligatorio && <em> (obligatorio en SAGA)</em>}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </details>
          );
        })}
      </section>

      <section className="admin-card form-grid">
        <h2>Marcas</h2>
        <div className="campo">
          <label htmlFor="saga-marcas">Marca de la web → nombre exacto en SAGA</label>
          <textarea id="saga-marcas" name="marcas" rows={10} defaultValue={marcasTexto} />
          <small style={{ color: "var(--gris)" }}>
            Una por línea: <code>slug = Nombre en SAGA</code> (ej. <code>esika = Esika</code>). Una marca sin
            línea aquí no se envía a SAGA. Para buscar el nombre exacto:{" "}
            <code>npm run saga:probar -- --marcas texto</code>.
          </small>
        </div>
      </section>

      <section className="admin-card form-grid">
        <h2>Datos del perfume</h2>
        <Lista nombre="aromas" etiqueta="Aromas (FraganciaPerfume)" valores={opciones.aromas} filas={8}
          ayuda="Un aroma por línea. Aparecen como casillas en el formulario de producto." />
        <Lista nombre="cantidades" etiqueta="Medidas del frasco (CantidadPerfumesVariant)" valores={opciones.cantidades} filas={8}
          ayuda='Una por línea, tal como las lista SAGA (ej. "50 ML", "8ML"). SAGA entrega esta lista cortada; agrega aquí las que falten.' />
        <Lista nombre="tiposPerfume" etiqueta="Tipos de perfume (TipoDePerfume)" valores={opciones.tiposPerfume} />
        <Lista nombre="condiciones" etiqueta="Condición del producto (ConditionType)" valores={opciones.condiciones} filas={4} />
        <Lista nombre="generos" etiqueta="Géneros (Genero)" valores={opciones.generos} filas={6} />
        <Lista nombre="formatosBelleza" etiqueta="Formatos de belleza (FormatoBelleza)" valores={opciones.formatosBelleza} filas={8}
          ayuda="Frasco, Spray, Botella… Se elige en cada producto." />
        <Lista nombre="caracteristicas" etiqueta="Características (opcional en SAGA)" valores={opciones.caracteristicas} filas={8} />
        <Lista nombre="paises" etiqueta="Países de producción (Hecho en)" valores={opciones.paises} filas={8} />
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar opciones de SAGA"}
        </button>
        <button
          type="submit"
          className="btn-admin peligro"
          formAction={restablecerOpcionesSaga}
          onClick={(e) => {
            if (!confirm("¿Volver a las listas originales de SAGA? Se perderán los cambios guardados.")) e.preventDefault();
          }}
        >
          Restablecer valores originales
        </button>
      </div>
    </form>
  );
}
