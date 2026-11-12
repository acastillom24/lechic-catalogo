"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { drenarCola } from "../../../lib/saga-cola";
import { comprobar, registrarFallo, limpiar, ipDe } from "../../../lib/login-limite";

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
import { getPermisosUsuario, rutaInicial } from "../../../lib/ventas-permisos";
import { TELEFONO_SIN_DATO } from "../../../lib/ventas-core";
import { ventaDesdeForm, valoresDeForm } from "../../../lib/ventas-form";
import { guardarProductoDesdeForm } from "../../../lib/productos-guardar";
import { registrarMovimientoDesdeForm } from "../../../lib/movimiento-form";
import { query } from "../../../lib/db";
import {
  sincronizarStockVariante, reintentarStockPendiente,
  consultarSeleccion, aplicarAccionSeleccion, cambiarAccionSeleccion, resumirResultados,
} from "../../../lib/saga-sync";

/**
 * Usuario de la sesión actual, revalidado contra la BD (o redirige al login). Trae sus `permisos` (Configuración → Equipo).
 * Con `vista` ("ventas" | "productos" | "integraciones") además exige tenerla: si no, lo manda a la primera vista permitida
 * o, sin ninguna, a la página de sin acceso.
 */
export async function requerirUsuarioVentas(vista) {
  const store = await cookies();
  const uid = await leerSesionVentas(store.get(NOMBRE_COOKIE_VENTAS)?.value);
  const base = uid ? await getUsuarioVentasActivo(uid) : null;
  if (!base) redirect("/operaciones/login");
  const permisos = await getPermisosUsuario(base.id);
  if (vista && !permisos[vista]) redirect(rutaInicial(permisos) || "/operaciones/sin-acceso");
  return { ...base, permisos };
}

export async function iniciarSesionVentas(prevState, formData) {
  const usuario = (formData.get("usuario") || "").toString();
  const password = (formData.get("password") || "").toString();

  // Límite de intentos: por IP (10 en 15 min) y por usuario+IP (5), para frenar adivinar contraseñas.
  const ip = ipDe(await headers());
  const claves = [{ clave: `ip:${ip}`, max: 10 }, { clave: `u:${usuario.trim().toLowerCase().slice(0, 60)}|${ip}`, max: 5 }];
  const limite = await comprobar("ventas", claves);
  if (limite.bloqueado) {
    return { error: `Demasiados intentos fallidos. Vuelve a intentarlo en ${limite.minutos} minuto(s).` };
  }

  let u;
  try {
    u = await autenticarUsuarioVentas(usuario, password);
  } catch (err) {
    console.error("[ventas] login:", err.message); // el detalle solo va al log del servidor
    return { error: "No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos." };
  }
  if (!u) {
    await registrarFallo("ventas", claves.map((c) => c.clave));
    return { error: "Usuario o contraseña incorrectos." };
  }
  await limpiar("ventas", claves[1].clave);

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

export async function registrarVenta(prevState, formData) {
  const r = await guardarVenta(formData);
  // Si falla, se devuelven los valores para no perder lo que se escribió.
  if (r.error) r.valores = valoresDeForm(formData);
  return r;
}

/** Crea una venta, o la actualiza si el formulario trae un `id` (edición). */
async function guardarVenta(formData) {
  const usuario = await requerirUsuarioVentas("ventas");
  const id = Number(formData.get("id")) || null;

  const { venta, error } = await ventaDesdeForm(formData);
  if (error) return { error };
  const { monto, estado } = venta;

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
  const usuario = await requerirUsuarioVentas("ventas");
  await eliminarVentaPropia(Number(id), usuario.id);
  revalidatePath("/operaciones");
}

/** Alta de producto desde /operaciones. Solo crea: nunca modifica productos existentes. */
export async function crearProductoVentas(prevState, formData) {
  const usuario = await requerirUsuarioVentas("productos");
  const r = await guardarProductoDesdeForm(formData, { soloCrear: true, usuarioPanel: usuario.usuario });
  if (r.error) return r;
  redirect("/operaciones/productos?creado=1");
}

/**
 * Edición de producto desde /operaciones. Modo restringido: nunca elimina productos
 * ni variantes, y conserva costo y stock mínimo (ver guardarProductoDesdeForm).
 */
export async function editarProductoVentas(prevState, formData) {
  const usuario = await requerirUsuarioVentas("productos");
  const r = await guardarProductoDesdeForm(formData, { restringido: true, usuarioPanel: usuario.usuario });
  if (r.error) return r;
  redirect("/operaciones/productos?guardado=1");
}

/** Movimiento de stock desde /operaciones (entrada, salida o conteo); queda el usuario en el historial. */
export async function registrarMovimientoVentas(prevState, formData) {
  const usuario = await requerirUsuarioVentas("productos");
  return registrarMovimientoDesdeForm(formData, `ventas:${usuario.usuario}`);
}

// ---- Integración SAGA del panel: cada usuario gestiona solo las sincronizaciones que originó ----

/** Reintenta el aviso de stock de una variante/cuenta, solo si la fila es del usuario. */
export async function reintentarStockSagaVentas(varianteId, alias) {
  const usuario = await requerirUsuarioVentas("integraciones");
  const [fila] = await query(
    "select 1 from sincronizaciones where variante_id = $1 and sistema = 'saga' and cuenta_alias = $2 and usuario_panel = $3",
    [Number(varianteId), String(alias || ""), usuario.usuario]
  );
  if (fila) await sincronizarStockVariante(Number(varianteId), { alias: String(alias), usuario: usuario.usuario });
  revalidatePath("/operaciones/integraciones/saga");
}

/** Reintenta ahora todos los avisos de stock pendientes del usuario. */
export async function reintentarTodoStockSagaVentas() {
  const usuario = await requerirUsuarioVentas("integraciones");
  await reintentarStockPendiente({ forzar: true, limite: 50, usuario: usuario.usuario });
  revalidatePath("/operaciones/integraciones/saga");
}

// Acciones sobre filas elegidas: el servidor las limita siempre a las del usuario de la sesión.

/** Consulta a SAGA el estado de las filas elegidas ("varianteId|alias") del usuario. */
export async function consultarEstadoSagaVentas(claves) {
  const usuario = await requerirUsuarioVentas("integraciones");
  const n = await consultarSeleccion(claves, { usuario: usuario.usuario });
  after(() => drenarCola()); // continúa lo que haya quedado en cola o por avanzar
  revalidatePath("/operaciones/integraciones/saga");
  return { mensaje: `Se consultó el estado de ${n} envío(s) en SAGA.` };
}

/** Aplica una acción de vinculación a las filas elegidas del usuario. */
export async function aplicarAccionSagaVentas(claves, modo) {
  const usuario = await requerirUsuarioVentas("integraciones");
  const resultados = await aplicarAccionSeleccion(claves, String(modo || ""), { usuario: usuario.usuario });
  after(() => drenarCola());
  revalidatePath("/operaciones/integraciones/saga");
  return { mensaje: resultados.length ? resumirResultados(resultados) : "No hay filas para aplicar." };
}

/** Cambia el tipo de vinculación de las filas elegidas del usuario; con `enviarAhora` también las envía. */
export async function cambiarAccionSagaVentas(claves, accion, enviarAhora = false) {
  const usuario = await requerirUsuarioVentas("integraciones");
  try {
    const n = await cambiarAccionSeleccion(claves, String(accion || ""), { usuario: usuario.usuario });
    const resultados = enviarAhora && n ? await aplicarAccionSeleccion(claves, String(accion), { usuario: usuario.usuario }) : [];
    if (resultados.length) after(() => drenarCola());
    revalidatePath("/operaciones/integraciones/saga");
    return { mensaje: `Tipo de vinculación cambiado en ${n} fila(s).${resultados.length ? ` Envío: ${resumirResultados(resultados)}` : ""}` };
  } catch (e) {
    return { mensaje: e.message };
  }
}
