/**
 * Envío de correo (solo servidor) con la API de Resend, sin dependencias.
 *
 *  RESEND_API_KEY        clave de Resend (sin ella no se envía nada: { omitido: true })
 *  RECLAMOS_EMAIL_FROM   remitente verificado en Resend, ej. "Le Chic <reclamos@tudominio.pe>"
 *  RECLAMOS_EMAIL_TO     correo que recibe los avisos si no hay uno en Configuración
 *
 * Nunca lanza: devuelve { ok, omitido?, error? } para que un fallo de correo no pierda un reclamo.
 */
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function enviarCorreo({ para, asunto, html, responderA }) {
  const clave = process.env.RESEND_API_KEY;
  const de = process.env.RECLAMOS_EMAIL_FROM;
  if (!clave || !de) return { ok: false, omitido: true, error: "Correo no configurado (RESEND_API_KEY / RECLAMOS_EMAIL_FROM)." };
  const destinatarios = [].concat(para).filter(Boolean);
  if (!destinatarios.length) return { ok: false, omitido: true, error: "Sin destinatario." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: de,
        to: destinatarios,
        subject: asunto,
        html,
        ...(responderA ? { reply_to: responderA } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      return { ok: false, error: `Resend respondió ${res.status}: ${detalle.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { enviarCorreo, esc };
