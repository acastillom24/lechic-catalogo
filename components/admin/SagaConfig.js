"use client";

import { useActionState } from "react";
import { guardarOpcionesSaga, restablecerOpcionesSaga } from "../../app/(admin)/admin/actions";
import AccionesSaga from "./AccionesSaga";
import { imagenesRequeridas, IMAGENES_TOPE } from "../../lib/saga-campos";
import { camposEnlazables, compatible, mapaCampos } from "../../lib/atributos-categoria";

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
export default function SagaConfig({ opciones, categoriasWeb = [] }) {
  const [estado, accion, enviando] = useActionState(guardarOpcionesSaga, {});
  const categoriasTexto = (opciones.categorias || []).map((c) => `${c.id} = ${c.nombre}`).join("\n");

  return (
    <form action={accion} className="form-grid" key={estado?.n || 0} id="form-saga-opciones">
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
            categoría final de SAGA (la más específica, sin subcategorías).
          </small>
        </div>
      </section>

      <section className="admin-card form-grid">
        <h2>Equivalencias por categoría</h2>
        <small style={{ color: "var(--gris)" }}>
          La web manda: cada categoría de SAGA se cruza con las categorías de la web que la usan (se asignan en Integraciones → Web).
          Aquí eliges, para cada atributo de SAGA, a qué atributo de la web equivale. Por defecto se crea en la web un atributo con el
          mismo nombre (puedes renombrarlo allí). «No usar» deja el campo fuera: no se pide ni se envía. Los obligatorios de SAGA
          siempre se usan. En Perfumes (1735) los campos base se llenan en su formulario propio.
        </small>
        {(opciones.categorias || []).map((c) => {
          const campos = camposEnlazables(c.id);
          const eq = opciones.equivalencias;
          const webs = categoriasWeb.filter((w) => (eq?.categorias?.[w.slug]?.saga || []).includes(c.id));
          return (
            <details className="saga-seccion" key={c.id}>
              <summary>
                {c.id} — {c.nombre}
                <em>{webs.length ? `usada por: ${webs.map((w) => w.nombre).join(", ")}` : "ninguna categoría de la web la usa"}</em>
              </summary>
              <div className="saga-cuerpo form-grid">
                <div className="pf-grid-2">
                  <div className="campo">
                    <label>Imágenes mínimas (SAGA)</label>
                    <input type="number" name={`imgMin_${c.id}`} min={1} max={IMAGENES_TOPE} defaultValue={imagenesRequeridas(c.id, opciones.categorias).min} />
                    <small>Con menos imágenes el producto aparece incompleto y no se envía a SAGA.</small>
                  </div>
                  <div className="campo">
                    <label>Imágenes máximas (SAGA)</label>
                    <input type="number" name={`imgMax_${c.id}`} min={1} max={IMAGENES_TOPE} defaultValue={imagenesRequeridas(c.id, opciones.categorias).max} />
                    <small>Cuántas se envían como máximo (SAGA acepta hasta {IMAGENES_TOPE}). La web muestra todas.</small>
                  </div>
                </div>
                {!campos.length ? (
                  <small>Aún no hay campos disponibles para esta categoría. Solicita que se carguen los campos de SAGA para la categoría {c.id}.</small>
                ) : webs.length === 0 ? (
                  <small>
                    Ninguna categoría de la web usa la categoría {c.id}: asígnala en <strong>Integraciones → Web</strong> para enlazar sus atributos.
                  </small>
                ) : (
                  webs.map((w) => {
                    const enlaces = mapaCampos(eq, w.slug, "saga", c.id);
                    const atributosWeb = opciones.atributosCategoria?.[w.slug] || [];
                    return (
                      <div className="pf-eq-bloque" key={w.slug}>
                        <input type="hidden" name={`eqMarca_${c.id}__${w.slug}`} value="1" />
                        <strong>Web: {w.nombre} ↔ SAGA {c.id}</strong>
                        <div className="admin-tabla-wrap">
                          <table className="admin-tabla pf-eq-tabla-campos">
                            <thead>
                              <tr>
                                <th>Atributo de SAGA</th>
                                <th>Atributo de la web</th>
                              </tr>
                            </thead>
                            <tbody>
                              {campos.map((campo) => {
                                const enlace = enlaces[campo.id];
                                const enlazado = atributosWeb.find((a) => a.id === enlace);
                                // Un atributo creado por defecto (aún sin guardar) se muestra como «Crear…».
                                const valor = !enlace ? "" : enlazado?.virtual ? "__crear" : enlace;
                                const existentes = atributosWeb.filter((a) => !a.virtual && compatible(a, campo));
                                return (
                                  <tr key={campo.id}>
                                    <td>
                                      {campo.etiqueta}
                                      <small style={{ display: "block", color: "var(--gris)" }}>
                                        {campo.id} · {campo.tipo === "multi" ? "varias opciones" : campo.tipo === "lista" ? "una opción" : campo.tipo === "numero" ? "número" : "texto"}
                                        {campo.obligatorio ? " · obligatorio" : ""}{campo.nivel === "variante" ? " · por variante" : ""}
                                      </small>
                                    </td>
                                    <td>
                                      <select name={`eq_${c.id}__${w.slug}__${campo.id}`} defaultValue={valor} aria-label={`Atributo de la web para ${campo.etiqueta}`}>
                                        <option value="" disabled={campo.obligatorio}>— No usar —</option>
                                        <option value="__crear">Crear «{campo.etiqueta}» en la web</option>
                                        {existentes.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
                                      </select>
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
            </details>
          );
        })}
      </section>

      <section className="admin-card form-grid">
        <h2>Marcas</h2>
        <small style={{ color: "var(--gris)" }}>
          Las marcas y su nombre exacto en cada plataforma (SAGA y las que agregues) se configuran en la pestaña
          <strong>Marcas</strong> de esta misma página de Configuración.
        </small>
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
