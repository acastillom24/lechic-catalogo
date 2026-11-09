import { getConfigSitio } from "../../../lib/config";
import { PLAZO_DIAS_HABILES } from "../../../lib/reclamos";
import ReclamoForm from "../../../components/ReclamoForm";

export const metadata = {
  title: "Libro de Reclamaciones · Le Chic",
  description: "Registra un reclamo o una queja sobre un producto o servicio de Le Chic.",
};

export default async function LibroReclamacionesPage() {
  const config = await getConfigSitio();
  const e = config.empresa || {};

  return (
    <div className="contenedor lr">
      <section className="bloque">
        <p className="seccion-eyebrow">Tu opinión nos importa</p>
        <h1 className="seccion-titulo">Libro de Reclamaciones</h1>
        <div className="regla" />

        <div className="lr-proveedor">
          <strong>{e.razonSocial || config.marca}</strong>
          {e.ruc && <span>RUC {e.ruc}</span>}
          {e.direccion && <span>{e.direccion}</span>}
        </div>

        <p className="lr-aviso">
          <strong>Reclamo:</strong> disconformidad con los productos o servicios. <strong>Queja:</strong> malestar
          por la atención al público, sin relación con el producto. Responderemos en un plazo no mayor a{" "}
          {PLAZO_DIAS_HABILES} días hábiles y te enviaremos una copia de esta hoja a tu correo. La formulación del
          reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer
          una denuncia ante el INDECOPI.
        </p>

        <ReclamoForm turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || ""} empresa={e} marca={config.marca} />
      </section>

      <style>{`
        .lr { max-width: 820px; }
        .lr-proveedor {
          display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 4px 0 14px;
          font-size: 0.9rem; color: var(--tinta);
        }
        .lr-aviso {
          font-size: 0.85rem; color: var(--gris); line-height: 1.55; margin-bottom: 22px;
          background: var(--blanco); border: 1px solid var(--linea); border-radius: var(--radio); padding: 14px 16px;
        }
      `}</style>
    </div>
  );
}
