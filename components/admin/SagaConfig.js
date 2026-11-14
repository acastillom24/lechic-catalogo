"use client";

import { useActionState, useEffect, useState } from "react";
import { guardarOpcionesSaga } from "../../app/(admin)/admin/actions";
import AccionesSaga from "./AccionesSaga";
import { imagenesRequeridas, IMAGENES_TOPE } from "../../lib/saga-campos";
import { camposEnlazables, mapaCampos, atributosDe } from "../../lib/atributos-categoria";
import EquivalenciasSagaBloque from "./EquivalenciasSagaBloque";
import SelectMulti from "./SelectMulti";
import MarcasSaga from "./MarcasSaga";
import CamposGeneralesSaga from "./CamposGeneralesSaga";

const FORM_ID = "form-saga-opciones";
// Avisa al botón «Guardar» de la barra de pestañas (ConfiguracionForm) del estado del guardado; el resultado se emite desde la
// propia acción porque al guardar la sección se vuelve a montar con los datos nuevos.
const emitir = (detalle) => window.dispatchEvent(new CustomEvent("integracion-estado", { detail: { formId: FORM_ID, ...detalle } }));

/** Categorías de la web que equivalen a una categoría de SAGA (pueden ser varias): la equivalencia se elige desde la plataforma. */
function CategoriasWebDeSaga({ cat, categoriasWeb, inicial }) {
  const [sel, setSel] = useState(inicial);
  return (
    <div className="campo">
      <label>Categorías de la web que equivalen a SAGA {cat}</label>
      <input type="hidden" name={`catsWeb_${cat}`} value={JSON.stringify(sel)} />
      <SelectMulti
        valor={sel}
        opciones={categoriasWeb.map((w) => w.slug)}
        formato={(slug) => categoriasWeb.find((w) => w.slug === slug)?.nombre || slug}
        onChange={setSel}
        placeholder="Elegir categorías de la web…"
        buscar="Buscar categoría…"
      />
    </div>
  );
}

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
export default function SagaConfig({ opciones, categoriasWeb = [], marcas = [], pestana = "categorias" }) {
  const [sucio, setSucio] = useState(false);
  const guardarYAvisar = async (prev, formData) => {
    emitir({ enviando: true });
    let r;
    try {
      r = await guardarOpcionesSaga(prev, formData);
    } catch {
      r = { error: "No se pudo guardar. Inténtalo de nuevo." };
    }
    if (r?.ok) setSucio(false);
    emitir({ enviando: false, resultado: r, ...(r?.ok ? { sinGuardar: false } : {}) });
    return r;
  };
  const [estado, accion] = useActionState(guardarYAvisar, {});
  useEffect(() => {
    emitir({ sinGuardar: sucio });
  }, [sucio]);
  const categorias = opciones.categorias || [];
  const [catSel, setCatSel] = useState(categorias[0]?.id || "");
  const [subCat, setSubCat] = useState("primarias");
  return (
    <form action={accion} className="form-grid" key={estado?.n || 0} id={FORM_ID} onChange={() => setSucio(true)}>
      {/* ---------- Categorías: lista de categorías primarias + equivalencias de cada una ---------- */}
      <div hidden={pestana !== "categorias"} className="form-grid">
        <div className="pf-pestanas pf-subpestanas" role="tablist" aria-label="Categorías de SAGA">
          <button type="button" role="tab" aria-selected={subCat === "primarias"} className="pf-pestana" onClick={() => setSubCat("primarias")}>
            Categorías primarias <span className="pf-pestana-n">{categorias.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={subCat === "equivalencias"} className="pf-pestana" onClick={() => setSubCat("equivalencias")}>
            Equivalencias por categoría
            <span className="pf-pestana-n" title="Categorías de SAGA con categorías de la web asignadas">
              {categorias.filter((c) => categoriasWeb.some((w) => (opciones.equivalencias?.categorias?.[w.slug]?.saga || []).includes(c.id))).length}
            </span>
          </button>
        </div>
        <div className="pf-panel-bloque" hidden={subCat !== "primarias"}>
          <strong>Categorías primarias</strong>
          <small style={{ color: "var(--gris)" }}>
            Las categorías de SAGA que se pueden elegir en un producto (usa el id de una categoría final, la más específica). Las marcas
            se emparejan en la pestaña <strong>Marcas</strong> de esta pantalla.
          </small>
          <TablaCategorias inicial={categorias} />
        </div>

        <div className="pf-panel-bloque" hidden={subCat !== "equivalencias"}>
          <strong>Equivalencias por categoría</strong>
          <small style={{ color: "var(--gris)" }}>
            Elige la categoría de SAGA y define con qué categorías de la web equivale, sus imágenes y, para cada campo, el atributo de la
            web que le corresponde. Cada categoría se configura una sola vez.
          </small>
          <div className="cg-cat">
            <label htmlFor="saga-cat-sel">Categoría de SAGA</label>
            <select id="saga-cat-sel" value={catSel} onChange={(e) => setCatSel(e.target.value)}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.nombre}</option>
              ))}
            </select>
          </div>
          {categorias.map((c) => {
            const campos = camposEnlazables(c.id);
            const eq = opciones.equivalencias;
            const webs = categoriasWeb.filter((w) => (eq?.categorias?.[w.slug]?.saga || []).includes(c.id));
            const img = imagenesRequeridas(c.id, opciones.categorias);
            return (
              <div key={c.id} hidden={c.id !== catSel} className="form-grid">
                <div className="cg-campos">
                  <CategoriasWebDeSaga cat={c.id} categoriasWeb={categoriasWeb} inicial={webs.map((w) => w.slug)} />
                  <div className="campo">
                    <label>Imágenes mín.</label>
                    <input type="number" name={`imgMin_${c.id}`} min={1} max={IMAGENES_TOPE} defaultValue={img.min} title="Con menos imágenes el producto aparece incompleto y no se envía a SAGA" />
                  </div>
                  <div className="campo">
                    <label>Imágenes máx.</label>
                    <input type="number" name={`imgMax_${c.id}`} min={1} max={IMAGENES_TOPE} defaultValue={img.max} title={`Cuántas se envían como máximo (SAGA acepta hasta ${IMAGENES_TOPE}). La web muestra todas.`} />
                  </div>
                </div>
                {!campos.length ? (
                  <small>Aún no hay campos disponibles para esta categoría. Solicita que se carguen los campos de SAGA para la categoría {c.id}.</small>
                ) : webs.length === 0 ? (
                  <small>Ninguna categoría de la web usa la categoría {c.id}: elígelas arriba, guarda y aquí podrás enlazar sus atributos.</small>
                ) : (
                  <EquivalenciasSagaBloque
                    cat={c.id}
                    webs={webs}
                    campos={campos}
                    equivalencias={eq}
                    enlacesPorWeb={Object.fromEntries(webs.map((w) => [w.slug, mapaCampos(eq, w.slug, "saga", c.id)]))}
                    atributosPorWeb={Object.fromEntries(webs.map((w) => [w.slug, atributosDe(opciones.atributosCategoria, w.slug)]))}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Campos generales ---------- */}
      <div hidden={pestana !== "generales"} className="form-grid">
        <small style={{ color: "var(--gris)" }}>
          Cada campo general de SAGA (los que no figuran como obligatorios ni opcionales en una categoría concreta) y el campo general de la
          web que lo alimenta. Todos traen su equivalente por defecto con 🔒 y con ✎ eliges otro campo general de la web del mismo tipo, o
          «sin equivalente». «Ver tipo en SAGA» consulta el tipo real del campo. Los nombres y atributos de la web se manejan en Integraciones → Web.
        </small>
        <CamposGeneralesSaga equivalencias={opciones.equivalencias} categoriaConsulta={String(categorias[0]?.id || "")} />
      </div>

      {/* ---------- Marcas: coincidencia web ↔ SAGA ---------- */}
      <div hidden={pestana !== "marcas"} className="form-grid">
        <MarcasSaga marcas={marcas} />
      </div>

      {/* ---------- Acciones de vinculación ---------- */}
      <div hidden={pestana !== "acciones"} className="form-grid">
        <AccionesSaga acciones={opciones.acciones} />
      </div>

      {/* ---------- Conexión ---------- */}
      <div hidden={pestana !== "conexion"} className="form-grid">
        <div className="pf-panel-bloque">
          <strong>Conexión</strong>
          <div className="cg-listas">
            <Lista nombre="urlsBase" etiqueta="URLs base de Seller Center" valores={opciones.urlsBase} filas={4}
              ayuda="Una por línea (https://…). Son las que podrás elegir al registrar una cuenta." />
            <Lista nombre="operadores" etiqueta="Códigos de operador (OperatorCode)" valores={opciones.operadores} filas={4}
              ayuda="Uno por línea (ej. fape para Perú). Se eligen al registrar una cuenta; se usan al enviar stock y precio." />
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * Tabla de categorías primarias de SAGA (id y descripción), como el resto de tablas: texto plano con ✎ para editar una fila y ✕ para
 * quitarla. Las filas nuevas nacen en edición. Viaja como líneas «id = Descripción» en el campo `categorias`.
 */
function TablaCategorias({ inicial }) {
  const [filas, setFilas] = useState(() => inicial.map((c) => ({ id: String(c.id), nombre: c.nombre, edit: false })));
  const poner = (i, cambios) => setFilas((p) => p.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const valor = filas.filter((f) => f.id.trim() || f.nombre.trim()).map((f) => `${f.id.trim()} = ${f.nombre.trim()}`).join("\n");
  return (
    <>
      <input type="hidden" name="categorias" value={valor} />
      <div className="admin-tabla-wrap">
        <table className="admin-tabla cg-tabla-saga-cat">
          <thead>
            <tr>
              <th>ID</th>
              <th>Descripción</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {f.edit ? (
                  <>
                    <td><input value={f.id} inputMode="numeric" maxLength={6} onChange={(e) => poner(i, { id: e.target.value.replace(/\D/g, "") })} aria-label="ID de la categoría" placeholder="1735" /></td>
                    <td><input value={f.nombre} maxLength={150} onChange={(e) => poner(i, { nombre: e.target.value })} aria-label="Descripción de la categoría" placeholder="Fragancias|perfumes" /></td>
                  </>
                ) : (
                  <>
                    <td><code>{f.id}</code></td>
                    <td>{f.nombre}</td>
                  </>
                )}
                <td className="cg-acc">
                  {f.edit ? (
                    <button type="button" className="btn-admin" onClick={() => poner(i, { edit: false })} title="Listo (se guarda con el botón Guardar)">✓ Listo</button>
                  ) : (
                    <button type="button" className="btn-admin cg-ico" onClick={() => poner(i, { edit: true })} aria-label={`Editar la categoría ${f.id}`} title="Editar">✎</button>
                  )}
                  <button type="button" className="btn-admin cg-ico peligro" title="Quitar la categoría" aria-label={`Quitar la categoría ${f.id}`} onClick={() => setFilas((p) => p.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="btn-admin cg-mas" onClick={() => setFilas((p) => [...p, { id: "", nombre: "", edit: true }])}>+ Agregar categoría</button>
      </div>
    </>
  );
}
