"use client";

import { useActionState, useState } from "react";
import { guardarProducto } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";

function nuevaVariante() {
  return {
    key: Math.random().toString(36).slice(2),
    nombre: "",
    precio: "",
    precioOferta: "",
    stock: true,
    aromas: "",
    imagenExistente: null,
    previewLocal: null,
  };
}

export default function ProductoForm({ modo, marcas, producto }) {
  const [estado, accion, enviando] = useActionState(guardarProducto, {});

  const [id, setId] = useState(producto?.id || "");
  const [idTocadoManualmente, setIdTocadoManualmente] = useState(modo === "editar");
  const [marca, setMarca] = useState(producto?.marca || marcas[0]?.slug || "");
  const marcaObj = marcas.find((m) => m.slug === marca);
  const categorias = marcaObj?.categorias || [];
  const [categoria, setCategoria] = useState(producto?.categoria || categorias[0]?.slug || "");
  const [nombre, setNombre] = useState(producto?.nombre || "");
  const [descripcion, setDescripcion] = useState(producto?.descripcion || "");
  const [destacado, setDestacado] = useState(!!producto?.destacado);
  const [aromasProducto, setAromasProducto] = useState((producto?.aromas || []).join(", "));

  const [variantes, setVariantes] = useState(() =>
    producto?.variantes?.length
      ? producto.variantes.map((v) => ({
          key: Math.random().toString(36).slice(2),
          nombre: v.nombre || "",
          precio: v.precio ?? "",
          precioOferta: v.precioOferta ?? "",
          stock: v.stock !== false,
          aromas: (v.aromas || []).join(", "),
          imagenExistente: v.imagen || null,
          previewLocal: null,
        }))
      : [nuevaVariante()]
  );

  function actualizarVariante(i, cambios) {
    setVariantes((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...cambios } : v)));
  }

  function agregarVariante() {
    setVariantes((prev) => [...prev, nuevaVariante()]);
  }

  function quitarVariante(i) {
    setVariantes((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function alCambiarNombreProducto(valor) {
    setNombre(valor);
    if (modo === "crear" && !idTocadoManualmente) {
      setId(slugify(valor));
    }
  }

  function alCambiarMarca(nuevaMarca) {
    setMarca(nuevaMarca);
    const primeraCategoria = marcas.find((m) => m.slug === nuevaMarca)?.categorias?.[0]?.slug || "";
    setCategoria(primeraCategoria);
  }

  const variantesJson = JSON.stringify(
    variantes.map((v) => ({
      nombre: v.nombre,
      precio: v.precio,
      precioOferta: v.precioOferta,
      stock: v.stock,
      aromas: v.aromas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      imagenExistente: v.imagenExistente,
    }))
  );

  return (
    <form action={accion} className="form-grid admin-card" encType="multipart/form-data">
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}

      <input type="hidden" name="modo" value={modo} />
      {modo === "editar" && <input type="hidden" name="idOriginal" value={producto.id} />}
      <input type="hidden" name="variantesJson" value={variantesJson} />

      <div className="form-fila">
        <div className="campo">
          <label htmlFor="nombre">Nombre del producto</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            value={nombre}
            onChange={(e) => alCambiarNombreProducto(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="id">
            Id (parte de la URL){modo === "editar" ? " — no se puede cambiar" : ""}
          </label>
          <input
            id="id"
            name="id"
            type="text"
            value={id}
            disabled={modo === "editar"}
            onChange={(e) => {
              setIdTocadoManualmente(true);
              setId(e.target.value);
            }}
            placeholder="se genera solo a partir del nombre"
          />
        </div>
      </div>

      <div className="form-fila">
        <div className="campo">
          <label htmlFor="marca">Marca</label>
          <select id="marca" name="marca" value={marca} onChange={(e) => alCambiarMarca(e.target.value)}>
            {marcas.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="categoria">Categoría</label>
          <select
            id="categoria"
            name="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          name="descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <div className="campo">
        <label htmlFor="aromasProducto">
          Aromas / atributos del producto (separados por coma — opcional si cada variante
          tiene los suyos)
        </label>
        <input
          id="aromasProducto"
          name="aromasProducto"
          type="text"
          value={aromasProducto}
          onChange={(e) => setAromasProducto(e.target.value)}
          placeholder="Ej: Floral, Cítrico, Amaderado"
        />
      </div>

      <label className="campo-check">
        <input
          type="checkbox"
          name="destacado"
          checked={destacado}
          onChange={(e) => setDestacado(e.target.checked)}
        />
        Destacado (aparece resaltado en el catálogo)
      </label>

      <div className="form-grid">
        <div className="admin-titulo-fila" style={{ marginBottom: 0 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--tinta)" }}>Variantes</h3>
          <button type="button" className="btn-admin" onClick={agregarVariante}>
            + Agregar variante
          </button>
        </div>

        {variantes.map((v, i) => (
          <div className="variante-card" key={v.key}>
            <div className="variante-card-cabecera">
              <h4>Variante {i + 1}</h4>
              {variantes.length > 1 && (
                <button type="button" className="btn-admin peligro" onClick={() => quitarVariante(i)}>
                  Quitar
                </button>
              )}
            </div>

            <div className="form-fila">
              <div className="campo">
                <label>Nombre de la variante</label>
                <input
                  type="text"
                  value={v.nombre}
                  onChange={(e) => actualizarVariante(i, { nombre: e.target.value })}
                  placeholder='Ej: "Único", "50 ml", "Rosa"'
                />
              </div>
              <label className="campo-check" style={{ marginTop: 22 }}>
                <input
                  type="checkbox"
                  checked={v.stock}
                  onChange={(e) => actualizarVariante(i, { stock: e.target.checked })}
                />
                Con stock disponible
              </label>
            </div>

            <div className="form-fila">
              <div className="campo">
                <label>Precio (S/)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={v.precio}
                  onChange={(e) => actualizarVariante(i, { precio: e.target.value })}
                />
              </div>
              <div className="campo">
                <label>Precio de oferta (opcional)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={v.precioOferta}
                  onChange={(e) => actualizarVariante(i, { precioOferta: e.target.value })}
                />
              </div>
            </div>

            <div className="campo">
              <label>Aromas de esta variante (separados por coma, opcional)</label>
              <input
                type="text"
                value={v.aromas}
                onChange={(e) => actualizarVariante(i, { aromas: e.target.value })}
              />
            </div>

            <div className="campo">
              <label>Imagen</label>
              {v.previewLocal ? (
                <img src={v.previewLocal} alt="" className="imagen-actual" />
              ) : v.imagenExistente ? (
                <img src={v.imagenExistente} alt="" className="imagen-actual" />
              ) : null}
              <input
                type="file"
                name={`variante_imagen_${i}`}
                accept="image/*"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  actualizarVariante(i, {
                    previewLocal: archivo ? URL.createObjectURL(archivo) : null,
                  });
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <button type="submit" className="btn-admin solido" disabled={enviando}>
        {enviando ? "Guardando..." : modo === "crear" ? "Crear producto" : "Guardar cambios"}
      </button>
    </form>
  );
}
