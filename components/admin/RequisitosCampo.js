"use client";

import ConsultaSagaAtributo from "./ConsultaSagaAtributo";
import { LISTA_DE_CAMPO } from "../../lib/campos-web";

// Campos de tipo lista cuyas opciones no se definen aquí.
const NOTA_LISTA = {
  marca: "Las opciones de Marca no son una lista de SAGA: cada marca de la web se empareja con su marca de SAGA en Integraciones → SAGA → Marcas.",
  categoriaPrimaria: "Las categorías se definen en Integraciones → SAGA → Categorías.",
};

/**
 * Requisitos de un campo de la web, definidos AQUÍ (✎ en Integraciones → Web) y usados por el formulario, las validaciones y el envío:
 * opciones (campos de tipo lista), largo mínimo y máximo (texto y número) y si es obligatorio. «Traer requisitos de SAGA» consulta el
 * campo por su código solo como referencia: rellena estos valores para que los revises; nada se guarda hasta «Guardar».
 * `valor` = requisitos actuales { opciones, min, max, obligatorio } (ya con los predeterminados); `onChange(parcial)` = cambios.
 */
export default function RequisitosCampo({ def, valor, onChange, categoriasSaga = [] }) {
  const conLista = Boolean(LISTA_DE_CAMPO[def.id]);
  const conLargo = def.tipo === "texto" || def.tipo === "numero";
  const exigidoPorSaga = Boolean(def.obligatorioSaga);
  const texto = (valor.opciones || []).join("\n");
  const entero = (v) => (v === "" || v == null ? undefined : Number(v) > 0 ? Math.min(1000, Math.trunc(Number(v))) : undefined);

  return (
    <div className="form-grid">
      {conLista && (
        <div className="campo">
          <label>
            Opciones de «{def.etiqueta}» <em>una por línea · {(valor.opciones || []).length} opciones · deben ser exactamente las de SAGA</em>
          </label>
          <textarea
            rows={5}
            value={texto}
            onChange={(e) => onChange({ opciones: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
            aria-label={`Opciones de ${def.etiqueta}`}
          />
        </div>
      )}
      {NOTA_LISTA[def.id] && <small style={{ color: "var(--gris)" }}>{NOTA_LISTA[def.id]}</small>}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
        {conLargo && (
          <>
            <div className="campo">
              <label>Largo mínimo <em>caracteres</em></label>
              <input type="number" min={1} max={1000} value={valor.min ?? ""} onChange={(e) => onChange({ min: entero(e.target.value) })} style={{ maxWidth: 110 }} />
            </div>
            <div className="campo">
              <label>Largo máximo <em>caracteres</em></label>
              <input type="number" min={1} max={def.max || 1000} title={def.max ? `SAGA admite hasta ${def.max}: la web puede ser más estricta, no más flexible` : undefined} value={valor.max ?? ""} onChange={(e) => onChange({ max: entero(e.target.value) })} style={{ maxWidth: 110 }} />
            </div>
          </>
        )}
        <label className="campo-check" title={exigidoPorSaga ? "SAGA lo exige: no se puede quitar" : "Si es obligatorio, el producto no se puede enviar sin este dato"}>
          <input type="checkbox" checked={exigidoPorSaga || Boolean(valor.obligatorio)} disabled={exigidoPorSaga} onChange={(e) => onChange({ obligatorio: e.target.checked })} />
          Obligatorio{exigidoPorSaga ? " (lo exige SAGA)" : ""}
        </label>
      </div>
      {def.saga && !NOTA_LISTA[def.id] && (
        <ConsultaSagaAtributo
          categoriasSaga={categoriasSaga}
          codigoInicial={def.saga}
          etiquetaActual={def.etiqueta}
          onAplicar={({ opciones, crudo }) => {
            const cambios = {};
            if (conLista && opciones && opciones.length) cambios.opciones = opciones;
            if (conLargo && crudo) {
              if (crudo.min) cambios.min = crudo.min;
              if (crudo.max) cambios.max = crudo.max;
            }
            if (crudo && crudo.obligatorio && !exigidoPorSaga) cambios.obligatorio = true;
            if (Object.keys(cambios).length) onChange(cambios);
          }}
        />
      )}
    </div>
  );
}
