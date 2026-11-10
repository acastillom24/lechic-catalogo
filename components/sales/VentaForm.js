"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registrarVenta } from "../../app/(sales)/operaciones/actions";
import { IconoCerrar } from "../admin/Iconos";

/**
 * Formulario de captura y edición de ventas.
 *  - Nueva: tras guardar se reinicia con los valores por defecto.
 *  - Edición (`venta`): al guardar vuelve a la lista (`volverHref`).
 * Si hay un error se conservan los datos escritos.
 * El estado (pendiente/cerrada) lo elige el usuario; el adelanto puede ser 0.
 */
export default function VentaForm({ hoy, defaults, opciones, venta, volverHref }) {
  const router = useRouter();
  const [estado, accion, enviando] = useActionState(registrarVenta, {});
  const v = estado?.valores;
  const editando = Boolean(venta);

  useEffect(() => {
    if (editando && estado?.editada) router.push(volverHref);
  }, [editando, estado, router, volverHref]);

  // Valor inicial: lo reenviado tras un error > la venta editada > el default.
  const val = (k, def = "") => v?.[k] ?? (venta ? venta[k] ?? def : def);
  const clave = editando ? `editar-${venta.id}` : estado?.n || (v ? JSON.stringify(v) : "nuevo");

  return (
    <form action={accion} key={clave} className="admin-card venta-form">
      <div className="admin-titulo-fila" style={{ marginBottom: 14 }}>
        <h2 className="admin-titulo" style={{ fontSize: "1.3rem" }}>
          {editando ? "Editar venta" : "Registrar venta"}
        </h2>
        <Link href={volverHref} className="btn-ico" title="Cerrar" aria-label="Cerrar formulario">
          <IconoCerrar />
        </Link>
      </div>

      {editando && <input type="hidden" name="id" value={venta.id} />}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}

      <div className="venta-grid">
        <div className="campo">
          <label htmlFor="fecha">Fecha</label>
          <input id="fecha" name="fecha" type="date" required defaultValue={val("fecha", hoy)} max={hoy} />
        </div>

        <div className="campo">
          <label htmlFor="telefono">ID (número de teléfono)</label>
          <input
            id="telefono"
            name="telefono"
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder="999999999 si no se tiene"
            defaultValue={val("telefono")}
          />
        </div>

        <div className="campo">
          <label htmlFor="cliente_nombre">Nombre del cliente (opcional)</label>
          <input id="cliente_nombre" name="cliente_nombre" autoComplete="off" maxLength={120} defaultValue={val("cliente_nombre")} />
        </div>

        <div className="campo">
          <label htmlFor="distrito">Distrito (opcional)</label>
          <input id="distrito" name="distrito" autoComplete="off" maxLength={80} defaultValue={val("distrito")} />
        </div>

        <div className="campo">
          <label htmlFor="categoria">Categoría</label>
          <select id="categoria" name="categoria" required defaultValue={val("categoria", defaults.categoria)}>
            {opciones.categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="monto">Monto comprado (S/)</label>
          <input id="monto" name="monto" inputMode="decimal" required placeholder="0.00" defaultValue={val("monto")} />
        </div>

        <div className="campo">
          <label htmlFor="adelanto">Adelanto (S/)</label>
          <input
            id="adelanto"
            name="adelanto"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={Number(val("adelanto", 0)) > 0 ? val("adelanto") : ""}
          />
          <small>Puede ser 0 si el cliente adelanta después.</small>
        </div>

        <div className="campo">
          <label htmlFor="destino">Entrega</label>
          <select id="destino" name="destino" defaultValue={val("destino", defaults.destino) || ""}>
            {opciones.destinos.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="courier">Courier (opcional)</label>
          <select id="courier" name="courier" defaultValue={val("courier") || ""}>
            <option value="">—</option>
            {opciones.couriers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="tipo_cliente">Cliente</label>
          <select id="tipo_cliente" name="tipo_cliente" defaultValue={val("tipo_cliente") || ""}>
            <option value="">Detectar automáticamente</option>
            {opciones.tiposCliente.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="metodo_pago">Método de pago</label>
          <select id="metodo_pago" name="metodo_pago" defaultValue={val("metodo_pago") || ""}>
            <option value="">—</option>
            {opciones.metodosPago.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="comprobante">Comprobante (opcional)</label>
          <input id="comprobante" name="comprobante" placeholder="B001-123" defaultValue={val("comprobante")} />
        </div>

        <div className="campo venta-ancho">
          <label htmlFor="notas">Notas (opcional)</label>
          <input id="notas" name="notas" defaultValue={val("notas")} />
        </div>

        <div className="campo">
          <label htmlFor="estado">Estado de la venta</label>
          <select id="estado" name="estado" defaultValue={val("estado", "pendiente")}>
            <option value="pendiente">Pendiente</option>
            <option value="cerrada">Cerrada (finalizada)</option>
          </select>
          <small>Déjala pendiente hasta que el cliente complete el pago.</small>
        </div>
      </div>

      <div className="venta-acciones">
        <button type="submit" className="btn-ico-texto primario" disabled={enviando}>
          {enviando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar venta"}
        </button>
        {estado?.duplicado && (
          <button type="submit" name="confirmar" value="1" className="btn-ico-texto peligro" disabled={enviando}>
            Guardar igual
          </button>
        )}
        <Link href={volverHref} className="btn-ico-texto">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
