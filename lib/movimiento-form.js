import { revalidatePath } from "next/cache";
import { aplicarMovimiento, fijarStock } from "./inventario";

// Lógica compartida del formulario de movimiento de stock (admin y sales).
// Sin "use server": las acciones que la usan validan la sesión antes de llamarla.
// operacion: "entrada" | "salida" | "fijar" (conteo físico: deja el stock en la
// cantidad indicada y registra la diferencia como ajuste).
export async function registrarMovimientoDesdeForm(formData, usuario = null) {
  const varianteId = Number(formData.get("varianteId"));
  const operacion = (formData.get("operacion") || "").toString();
  const cantidad = Number(formData.get("cantidad"));
  const motivo = (formData.get("motivo") || "").toString().trim().slice(0, 200);

  if (!Number.isInteger(varianteId) || varianteId <= 0) return { error: "Variante inválida." };
  if (!Number.isInteger(cantidad) || cantidad < 0 || (operacion !== "fijar" && cantidad === 0)) {
    return { error: "Ingresa una cantidad entera válida." };
  }

  let r;
  try {
    if (operacion === "fijar") {
      r = await fijarStock({ varianteId, cantidad, motivo, usuario });
    } else if (operacion === "entrada" || operacion === "salida") {
      r = await aplicarMovimiento({
        varianteId,
        tipo: operacion,
        cantidad,
        motivo: motivo || (operacion === "entrada" ? "Ingreso de mercadería" : "Salida manual"),
        origen: "manual",
        usuario,
      });
    } else {
      return { error: "Operación inválida." };
    }
  } catch (err) {
    return { error: `No se pudo registrar: ${err.message}` };
  }

  if (r.estado === "insuficiente") {
    return { error: `Stock insuficiente (hay ${r.stock ?? 0}).` };
  }
  if (r.estado === "no_encontrada") return { error: "La variante ya no existe." };
  if (r.estado !== "ok") return { error: `No se aplicó el movimiento (${r.estado}).` };

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/sales/productos");
  return { ok: `Stock actualizado: ${r.stock}.` };
}
