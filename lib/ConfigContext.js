"use client";

import { createContext, useContext } from "react";

const ConfigContext = createContext(null);

// El layout (servidor) lee la configuración y la entrega a los componentes de cliente.
export function ConfigProvider({ valor, children }) {
  return <ConfigContext.Provider value={valor}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) throw new Error("useConfig debe usarse dentro de <ConfigProvider>.");
  return config;
}
