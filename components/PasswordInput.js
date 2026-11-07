"use client";

import { useState } from "react";
import { IconoOjo, IconoOjoOculto } from "./admin/Iconos";

/**
 * Input de contraseña con botón (ojito) para mostrar/ocultar lo escrito.
 * Acepta las mismas props que un <input>; `style` se aplica al input.
 */
export default function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  const etiqueta = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <div className="password-input">
      <input {...props} className={className} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-ojo"
        onClick={() => setVisible((v) => !v)}
        title={etiqueta}
        aria-label={etiqueta}
        aria-pressed={visible}
      >
        {visible ? <IconoOjoOculto size={18} /> : <IconoOjo size={18} />}
      </button>
    </div>
  );
}
