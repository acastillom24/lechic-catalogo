"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  NOMBRE_COOKIE_VENTAS,
  DURACION_VENTAS_MS,
  crearValorSesionVentas,
  leerSesionVentas,
} from "../../../lib/auth-ventas";
import {
  autenticarUsuarioVentas,
  getUsuarioVentasActivo,
  esClienteExistente,
  existeDuplicado,
  insertarVenta,
  actualizarVenta,
  eliminarVentaPropia,
} from "../../../lib/ventas";
import {
  normalizarTelefono,
  parsearMonto,
  validarVenta,
  ESTADOS,
  TELEFONO_SIN_DATO,
} from "../../../lib/ventas-core";
import { getOpcionesVentas } from "../../../lib/ventas-opciones";
import { guardarProductoDesdeForm } from "../../../lib/productos-guardar";
import { registrarMovimientoDesdeForm } from "../../../lib/movimiento-form";
import { query } from "../../../lib/db";
import {
  sincronizarStockVariante, reintentarStockPendiente,
  consultarSeleccion, aplicarAccionSeleccion, cambiarAccionSeleccion, resumirResultados,
} from "../../../lib/saga-sync";

/** Usuario de la sesión actual, revalidado contra la BD (o redirige al login). */
export async function requerirUsuarioVentas() {
  const store = await cookies();
  const uid = await leerSesionVentas(store.get(NOMBRE_COOKIE_VENTAS)?.value);
  const usuario = uid ? await getUsuarioVentasActivo(uid) : null;
  if (!usuario) redirect("/operaciones/login");
  return usuario;
}

export async function iniciarSesionVentas(prevState, formData) {
  const usuario = (formData.get("usuario") || "").toString();
  const password = (formData.get("password") || "").toString();

  let u;
  try {
    u = await autenticarUsuarioVentas(usuario, password);
  } catch (err) {
    return { error: `No se pudo iniciar sesión: ${err.message}` };
  }
  if (!u) return { error: "Usuario o contraseña incorrectos." };

  const store = await cookies();
  store.set(NOMBRE_COOKIE_VENTAS, await crearValorSesionVentas(u.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DURACION_VENTAS_MS / 1000),
  });
  redirect("/operaciones");
}

export async function cerrarSesionVentas() {
  const store = await cookies();
  store.delete(NOMBRE_COOKIE_VENTAS);
  redirect("/operaciones/login");
}

const texto = (fd, k, max = 200) => (fd.get(k) || "").toString().trim().slice(0, max);

export async function registrarVenta(prevState, formData) {
  const r = await guardarVenta(formData);
  // Si falla, se devuelven los valores para no perder lo que se escribió.
  if (r.error) r.valores = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  return r;
}

/** Crea una venta, o la actualiza si el formulario trae un `id` (edición). */
async function guardarVenta(formData) {
  const usuario = await requerirUsuarioVentas();
  const id = Number(formData.get("id")) || null;
  const op = await getOpcionesVentas();

  const tel = normalizarTelefono(texto(formData, "telefono") || TELEFONO_SIN_DATO);
  if (tel.rechazado) {
    return {
      error:
        "Teléfono inválido: no puede tener los 9 dígitos iguales. Si no se tiene el número, usa 999999999.",
    };
  }

  const monto = parsearMonto(texto(formData, "monto"));
  const adelanto = parsearMonto(texto(formData, "adelanto")) ?? 0;
  if (monto === null) return { error: "Ingresa el monto." };

  // El estado lo elige el usuario (el adelanto puede ser 0 y pagarse después).
  const estadoForm = texto(formData, "estado");
  const estado = ESTADOS.includes(estadoForm) ? estadoForm : "pendiente";

  const venta = {
    fecha: texto(formData, "fecha"),
    telefono: tel.telefono,
    cliente_ref: tel.ref,
    categoria: texto(formData, "categoria"),
    monto,
    adelanto,
    estado,
    destino: texto(formData, "destino") || null,
    courier: texto(formData, "courier").toUpperCase() || null,
    tipo_cliente: texto(formData, "tipo_cliente") || null,
    metodo_pago: texto(formData, "metodo_pago").toUpperCase() || null,
    comprobante: texto(formData, "comprobante", 40) || null,
    notas: texto(formData, "notas", 500) || null,
    distrito: texto(formData, "distrito", 80) || null,
    cliente_nombre: texto(formData, "cliente_nombre", 120) || null,
  };

  if (!op.categorias.includes(venta.categoria)) return { error: "Elige una categoría." };
  if (venta.destino && !op.destinos.includes(venta.destino)) return { error: "Destino inválido." };
  if (venta.tipo_cliente && !op.tiposCliente.includes(venta.tipo_cliente)) return { error: "Tipo de cliente inválido." };
  const error = validarVenta(venta, op);
  if (error) return { error };

  try {
    // Si no eligió tipo de cliente, se deduce por el historial del teléfono.
    if (!venta.tipo_cliente && venta.telefono !== TELEFONO_SIN_DATO) {
      venta.tipo_cliente = (await esClienteExistente(venta.telefono)) ? "RECOMPRA" : "NUEVO";
    }

    if (id) {
      const ok = await actualizarVenta(id, venta, usuario.id);
      if (!ok) return { error: "No puedes editar esta venta (ya está cerrada o no es tuya)." };
      revalidatePath("/operaciones");
      return { ok: "Venta actualizada.", n: Date.now(), editada: true };
    }

    if (formData.get("confirmar") !== "1" && (await existeDuplicado(venta))) {
      return {
        duplicado: true,
        error: "Ya hay una venta con la misma fecha, teléfono y monto. Si es otra venta, confirma para guardarla igual.",
      };
    }
    await insertarVenta(venta, usuario.id);
  } catch (err) {
    return { error: `No se pudo guardar: ${err.message}` };
  }

  revalidatePath("/operaciones");
  return {
    ok: `Venta registrada (S/ ${monto.toFixed(2)})${estado === "pendiente" ? " como pendiente." : "."}`,
    n: Date.now(),
  };
}

export async function eliminarVentaDelDia(id) {
  const usuario = await requerirUsuarioVentas();
  await eliminarVentaPropia(Number(id), usuario.id);
  revalidatePath("/operaciones");
}

/** Alta de producto desde /operaciones. Solo crea: nunca modifica productos existentes. */
export async function crearProductoVentas(prevState, formData) {
  const usuario = await requerirUsuarioVentas();
  const r = await guardarProductoDesdeForm(formData, { soloCrear: true, usuarioPanel: usuario.usuario });
  if (r.error) return r;
  redirect("/operaciones/productos?creado=1");
}

/**
 * Edición de producto desde /operaciones. Modo restringido: nunca elimina productos
 * ni variantes, y conserva costo y stock mínimo (ver guardarProductoDesdeForm).
 */
export async function editarProductoVentas(prevState, formData) {
  const usuario = await requerirUsuarioVentas();
  const r = await guardarProductoDesdeForm(formData, { restringido: true, usuarioPanel: usuario.usuario });
  if (r.error) return r;
  redirect("/operaciones/productos?guardado=1");
}

/** Movimiento de stock desde /operaciones (entrada, salida o conteo); queda el usuario en el historial. */
export async function registrarMovimientoVentas(prevState, formData) {
  const usuario = await requerirUsuarioVentas();
  return registrarMovimientoDesdeForm(formData, `ventas:${usuario.usuario}`);
}

// ---- Integración SAGA del panel: cada usuario gestiona solo las sincronizaciones que originó ----

/** Reintenta el aviso de stock de una variante/cuenta, solo si la fila es del usuario. */
export async function reintentarStockSagaVentas(varianteId, alias) {
  const usuario = await requerirUsuarioVentas();
  const [fila] = await query(
    "select 1 from sincronizaciones where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2 and usuario_panel = $3",
    [Number(varianteId), String(alias || ""), usuario.usuario]
  );
  if (fila) await sincronizarStockVariante(Number(varianteId), { alias: String(alias), usuario: usuario.usuario });
  revalidatePath("/operaciones/integraciones/saga");
}

/** Reintenta ahora todos los avisos de stock pendientes del usuario. */
export async function reintentarTodoStockSagaVentas() {
  const usuario = await requerirUsuarioVentas();
  await reintentarStockPendiente({ forzar: true, limite: 50, usuario: usuario.usuario });
  revalidatePath("/operaciones/integraciones/saga");
}

// Acciones sobre filas elegidas: el servidor las limita siempre a las del usuario de la sesión.

/** Consulta a SAGA el estado de las filas elegidas ("varianteId|alias") del usuario. */
export async function consultarEstadoSagaVentas(claves) {
  const usuario = await requerirUsuarioVentas();
  const n = await consultarSeleccion(claves, { usuario: usuario.usuario });
  revalidatePath("/operaciones/integraciones/saga");
  return { mensaje: `Se consultó el estado de ${n} envío(s) en SAGA.` };
}

/** Aplica una acción de vinculación a las filas elegidas del usuario. */
export async function aplicarAccionSagaVentas(claves, modo) {
  const usuario = await requerirUsuarioVentas();
  const resultados = await aplicarAccionSeleccion(claves, String(modo || ""), { usuario: usuario.usuario });
  revalidatePath("/operaciones/integraciones/saga");
  return { mensaje: resultados.length ? resumirResultados(resultados) : "No hay filas para aplicar." };
}

/** Cambia el tipo de vinculación de las filas elegidas del usuario; con `enviarAhora` también las envía. */
export async function cambiarAccionSagaVentas(claves, accion, enviarAhora = false) {
  const usuario = await requerirUsuarioVentas();
  try {
    const n = await cambiarAccionSeleccion(claves, String(accion || ""), { usuario: usuario.usuario });
    const resultados = enviarAhora && n ? await aplicarAccionSeleccion(claves, String(accion), { usuario: usuario.usuario }) : [];
    revalidatePath("/operaciones/integraciones/saga");
    return { mensaje: `Tipo de vinculación cambiado en ${n} fila(s).${resultados.length ? ` Envío: ${resumirResultados(resultados)}` : ""}` };
  } catch (e) {
    return { mensaje: e.message };
  }
}
