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
  estadoSegunAdelanto,
  CATEGORIAS,
  DESTINOS,
  TIPOS_CLIENTE,
  TELEFONO_SIN_DATO,
} from "../../../lib/ventas-core";

/** Usuario de la sesión actual, revalidado contra la BD (o redirige al login). */
export async function requerirUsuarioVentas() {
  const store = await cookies();
  const uid = await leerSesionVentas(store.get(NOMBRE_COOKIE_VENTAS)?.value);
  const usuario = uid ? await getUsuarioVentasActivo(uid) : null;
  if (!usuario) redirect("/sales/login");
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
  redirect("/sales");
}

export async function cerrarSesionVentas() {
  const store = await cookies();
  store.delete(NOMBRE_COOKIE_VENTAS);
  redirect("/sales/login");
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

  // Con adelanto parcial la venta queda pendiente. Al editar, "pago completo"
  // la cierra aunque se conserve el adelanto registrado.
  const estado =
    id && formData.get("cerrar") === "1" ? "cerrada" : estadoSegunAdelanto(monto, adelanto);

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
  };

  if (!CATEGORIAS.includes(venta.categoria)) return { error: "Elige una categoría." };
  if (venta.destino && !DESTINOS.includes(venta.destino)) return { error: "Destino inválido." };
  if (venta.tipo_cliente && !TIPOS_CLIENTE.includes(venta.tipo_cliente)) return { error: "Tipo de cliente inválido." };
  const error = validarVenta(venta);
  if (error) return { error };

  try {
    // Si no eligió tipo de cliente, se deduce por el historial del teléfono.
    if (!venta.tipo_cliente && venta.telefono !== TELEFONO_SIN_DATO) {
      venta.tipo_cliente = (await esClienteExistente(venta.telefono)) ? "RECOMPRA" : "NUEVO";
    }

    if (id) {
      const ok = await actualizarVenta(id, venta, usuario.id);
      if (!ok) return { error: "No puedes editar esta venta (ya está cerrada o no es tuya)." };
      revalidatePath("/sales");
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

  revalidatePath("/sales");
  return {
    ok: `Venta registrada (S/ ${monto.toFixed(2)})${estado === "pendiente" ? " como pendiente." : "."}`,
    n: Date.now(),
  };
}

export async function eliminarVentaDelDia(id) {
  const usuario = await requerirUsuarioVentas();
  await eliminarVentaPropia(Number(id), usuario.id);
  revalidatePath("/sales");
}
