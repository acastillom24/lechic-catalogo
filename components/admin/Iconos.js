/** Iconos SVG de trazo (heredan el color del texto con currentColor). */
function Icono({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconoBuscar = (p) => (
  <Icono {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icono>
);

export const IconoFiltro = (p) => (
  <Icono {...p}>
    <path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z" />
  </Icono>
);

export const IconoPapelera = (p) => (
  <Icono {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Icono>
);

/** Flecha saliendo de una bandeja (como "Export" de la imagen). */
export const IconoExportar = (p) => (
  <Icono {...p}>
    <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
    <path d="M4 12h11M11 8l4 4-4 4" />
  </Icono>
);

/** Agregar producto: mismo trazo que IconoExportar (marco abierto) con un «+». */
export const IconoProductoNuevo = (p) => (
  <Icono {...p}>
    <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
    <path d="M12 12h8M16 8v8" />
  </Icono>
);

export const IconoMas = (p) => (
  <Icono {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);

export const IconoPlantilla = (p) => (
  <Icono {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icono>
);

export const IconoStock = (p) => (
  <Icono {...p}>
    <path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </Icono>
);

export const IconoHistorial = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icono>
);

export const IconoEditar = (p) => (
  <Icono {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icono>
);

export const IconoCampana = (p) => (
  <Icono {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icono>
);

export const IconoCerrar = (p) => (
  <Icono {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icono>
);

export const IconoCheck = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.8 2.8L16.5 9.5" />
  </Icono>
);

export const IconoLlave = (p) => (
  <Icono {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 9-9M16 7l3 3M14 9l2 2" />
  </Icono>
);

export const IconoOjo = (p) => (
  <Icono {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icono>
);

export const IconoOjoOculto = (p) => (
  <Icono {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A10.5 10.5 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4.2-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icono>
);

export const IconoUsuario = (p) => (
  <Icono {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1-4 4.5-6 8-6s7 2 8 6" />
  </Icono>
);

export const IconoCalendario = (p) => (
  <Icono {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icono>
);

export const IconoGuardar = (p) => (
  <Icono {...p}>
    <path d="M5 4h11l3 3v13H5V4Z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </Icono>
);
