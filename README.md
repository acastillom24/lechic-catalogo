# Le Chic — Catálogo

Catálogo web de fragancias y belleza. Construido con **Next.js**, se
despliega **gratis en Vercel** y se administra editando archivos de datos,
sin tocar el código de las páginas.

---

## 🚀 Desplegar en Vercel (una sola vez)

1. Crea un repositorio en GitHub y sube esta carpeta.
2. Entra a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
3. **Add New → Project** → elige el repositorio → **Deploy**.
4. Vercel detecta Next.js solo. En 1–2 minutos tienes tu URL
   (ej: `lechic.vercel.app`).

A partir de ahí, **cada vez que hagas `git push`, Vercel actualiza el sitio
automáticamente**.

---

## ✏️ Cómo administrar el catálogo (sin programar)

Todo lo editable vive en la carpeta **`data/`**. Nunca necesitas tocar
`app/` ni `components/`.

| Quiero cambiar...                          | Edito este archivo      |
| ------------------------------------------ | ----------------------- |
| Productos, precios, aromas, variantes      | `data/productos.js`     |
| Marcas y sus categorías                    | `data/marcas.js`        |
| Teléfono, Instagram, envíos, políticas, horario, textos | `data/config.js` |
| Fotos de productos                         | `public/images/productos/` (ver `LEEME.md` ahí) |

### Agregar un producto nuevo

Abre `data/productos.js`, copia un bloque existente y cámbialo:

```js
{
  id: "sensuelle",                 // único, sin espacios
  marca: "importaciones",          // debe existir en marcas.js
  categoria: "perfumeria-mujer",   // debe existir en esa marca
  nombre: "Sensuelle",
  descripcion: "Descripción del producto.",
  variantes: [
    {
      nombre: "Único",
      precio: 45,
      precioOferta: null,          // pon un número para mostrar oferta
      imagen: "/images/productos/importaciones/sensuelle.png",
      aromas: ["Floral", "Amaderado"],
    },
  ],
},
```

Guarda, haz `git push`, y aparece en el sitio.

### Poner una oferta

En la variante, cambia `precioOferta: null` por el precio rebajado.
El catálogo muestra una etiqueta "Oferta" y tacha el precio original.

---

## 🗂️ Estructura del proyecto (modularizado)

```
lechic/
├── data/                 ← LO QUE EDITAS: productos, marcas, config
│   ├── productos.js
│   ├── marcas.js
│   └── config.js
├── lib/
│   └── data.js           ← Capa de acceso a datos (API interna)
├── components/           ← Piezas de interfaz reutilizables
│   ├── Navbar.js
│   ├── Footer.js
│   ├── ProductCard.js    ← Tarjeta con renderizado adaptable de variantes
│   ├── BrandView.js      ← Vista de marca con filtro y buscador
│   └── ProductDetail.js  ← Detalle con selector de variantes
├── app/                  ← Páginas (rutas del sitio)
│   ├── page.js           ← Inicio
│   ├── marca/[slug]/     ← Catálogo de cada marca
│   ├── producto/[id]/    ← Detalle de producto
│   ├── info/             ← Cómo comprar, pagos, envíos, políticas
│   └── layout.js
├── styles/
│   └── globals.css       ← Colores y tipografías (tokens del diseño)
└── public/images/        ← Imágenes
```

**Por qué está así:** los datos (`data/`) están separados de la lógica de
acceso (`lib/`) y de la presentación (`components/`, `app/`). Si algún día
quieres pasar de JSON a una base de datos real (Supabase, Postgres), solo
cambias `lib/data.js` y el resto del sitio sigue funcionando igual.

---

## 💻 Trabajar en local (opcional)

```bash
npm install
npm run dev      # abre http://localhost:3000
npm run build    # verifica que todo compile antes de publicar
```

---

## 📈 Si algún día creces

- **Panel de administración web**: migrar `data/` a Supabase (tiene plan
  gratis) y `lib/data.js` a consultas SQL. El frontend no cambia.
- **Pedidos online / carrito**: se puede añadir sobre esta misma base.

Por ahora, como solo muestras precios y coordinas por WhatsApp/Instagram,
JSON en el repo es la opción más simple, rápida y gratuita.
