/**
 * Integraciones con plataformas de venta (sin acceso a la base: se puede importar desde el navegador).
 * `id` coincide con sincronizaciones.sistema. Para sumar una plataforma: agregarla aquí y cargar sus cuentas en
 * app/(admin)/admin/page.js.
 */
const INTEGRACIONES = [
  { id: "saga", nombre: "SAGA", sigla: "S", href: "/admin/integraciones/saga" },
  { id: "ripley", nombre: "Ripley", sigla: "R", href: "/admin/integraciones/ripley" },
];

const IDS_INTEGRACIONES = INTEGRACIONES.map((i) => i.id);

module.exports = { INTEGRACIONES, IDS_INTEGRACIONES };
