/**
 * Lectura y validación del formulario de ventas, compartida por /operaciones y el panel admin.
 * Devuelve `{ error }` o `{ venta }` (sin deducir el tipo de cliente ni tocar la BD).
 */
const { getOpcionesVentas } = require("./ventas-opciones");
const { normalizarTelefono, parsearMonto, validarVenta, ESTADOS, TELEFONO_SIN_DATO } = require("./ventas-core");

const texto = (fd, k, max = 200) => (fd.get(k) || "").toString().trim().slice(0, max);

async function ventaDesdeForm(formData) {
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
  return { venta };
}

/** Valores del formulario tal como se escribieron, para no perderlos tras un error. */
function valoresDeForm(formData) {
  return Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
}

module.exports = { ventaDesdeForm, valoresDeForm };
