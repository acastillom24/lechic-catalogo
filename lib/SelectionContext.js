"use client";

/**
 * ============================================================
 *  CONTEXTO DE "MI SELECCIÓN"
 * ============================================================
 *  Es el "cerebro" de la lista de productos que arma el cliente.
 *  Guarda las líneas seleccionadas, calcula el total y persiste
 *  todo en el navegador (localStorage) para que no se pierda al
 *  navegar o recargar.
 *
 *  Los componentes NUNCA manejan esta lógica directamente:
 *  usan el hook useSeleccion(). Si mañana cambias dónde se
 *  guardan los datos, solo tocas este archivo.
 *
 *  Cada línea de la selección tiene esta forma:
 *  {
 *    key:        identificador único = productoId + "::" + variante
 *    productoId: id del producto
 *    nombre:     nombre del producto
 *    variante:   nombre de la variante elegida
 *    precio:     precio unitario (ya considera oferta)
 *    imagen:     ruta de la imagen
 *    cantidad:   número de unidades
 *  }
 * ============================================================
 */

import { createContext, useContext, useEffect, useState } from "react";

const CLAVE_STORAGE = "lechic_seleccion_v1";

const SeleccionContext = createContext(null);

export function SeleccionProvider({ children }) {
  const [items, setItems] = useState([]);
  const [abierto, setAbierto] = useState(false);
  // Evita "parpadeos" antes de leer el navegador (hidratación).
  const [listo, setListo] = useState(false);

  // Al montar: leer lo guardado en el navegador.
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_STORAGE);
      if (guardado) setItems(JSON.parse(guardado));
    } catch (e) {
      // Si algo falla (modo privado, datos corruptos), arrancamos vacío.
      console.warn("No se pudo leer la selección guardada:", e);
    }
    setListo(true);
  }, []);

  // Cada cambio en items: guardar en el navegador.
  useEffect(() => {
    if (!listo) return;
    try {
      window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(items));
    } catch (e) {
      console.warn("No se pudo guardar la selección:", e);
    }
  }, [items, listo]);

  // --- Acciones ---

  // Agrega una variante. Si ya existe, suma la cantidad.
  function agregar(linea, cantidad = 1) {
    setItems((prev) => {
      const existe = prev.find((i) => i.key === linea.key);
      if (existe) {
        return prev.map((i) =>
          i.key === linea.key
            ? { ...i, cantidad: i.cantidad + cantidad }
            : i
        );
      }
      return [...prev, { ...linea, cantidad }];
    });
    setAbierto(true); // abre el panel al agregar
  }

  function quitar(key) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function cambiarCantidad(key, cantidad) {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad } : i))
        .filter((i) => i.cantidad > 0) // si baja a 0, se elimina
    );
  }

  function vaciar() {
    setItems([]);
  }

  // --- Datos derivados ---
  const totalItems = items.reduce((s, i) => s + i.cantidad, 0);
  const totalPrecio = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const valor = {
    items,
    abierto,
    listo,
    totalItems,
    totalPrecio,
    agregar,
    quitar,
    cambiarCantidad,
    vaciar,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    alternar: () => setAbierto((v) => !v),
  };

  return (
    <SeleccionContext.Provider value={valor}>
      {children}
    </SeleccionContext.Provider>
  );
}

// Hook que usan los componentes para acceder a la selección.
export function useSeleccion() {
  const ctx = useContext(SeleccionContext);
  if (!ctx) {
    throw new Error("useSeleccion debe usarse dentro de <SeleccionProvider>");
  }
  return ctx;
}

// Construye la "key" única de una línea (producto + variante).
export function construirKey(productoId, varianteNombre) {
  return `${productoId}::${varianteNombre}`;
}
