import { useEffect } from "react";

/**
 * Publica el alto de una barra fija (buscador/filtros sobre una tabla) en la variable CSS --barra-fija-h, para que el
 * encabezado fijo de la tabla se pegue justo debajo de ella (ver .barra-fija y .tabla-scroll en admin.css).
 */
export default function useBarraFija(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const publicar = () => document.documentElement.style.setProperty("--barra-fija-h", `${el.offsetHeight}px`);
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--barra-fija-h");
    };
  }, [ref]);
}
