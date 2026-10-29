# Le Chic — Catálogo

Catálogo web de fragancias y belleza. Construido con **Next.js**, se
despliega **gratis en Vercel**, y los productos viven en una base de datos
real (**Neon**: Postgres, y **Cloudinary** para las imágenes). Se administran desde
un panel web en `/admin` — no hace falta tocar código ni hacer `git push`
para dar de alta un producto.

---

## 🚀 Desplegar en Vercel

1. Crea un repositorio en GitHub y sube esta carpeta.
2. Sigue **"Configurar la base de datos (Neon)"** más abajo y ten a
   mano `DATABASE_URL`, las 3 variables `CLOUDINARY_*`, `ADMIN_PASSWORD` y
   `ADMIN_SESSION_SECRET`.
3. Entra a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
4. **Add New → Project** → elige el repositorio.
5. En **Environment Variables**, agrega las variables del paso 2.
6. **Deploy**. En 1–2 minutos tienes tu URL (ej: `lechic.vercel.app`).

A partir de ahí, **cada vez que hagas `git push`, Vercel actualiza el
código del sitio automáticamente** — pero los productos ya no viven en el
código: se administran desde `/admin` y aparecen en el sitio sin
necesidad de un nuevo deploy (la página de cada marca se refresca sola
cada minuto).

---

## 🗄️ Configurar la base de datos (Neon) e imágenes (Cloudinary) — una sola vez

1. Crea un proyecto gratis en [neon.tech](https://neon.tech) y copia las
   dos cadenas de conexión: la **pooled** (`DATABASE_URL`) y la **direct**
   (`DIRECT_DATABASE_URL`).
2. Crea una cuenta gratis en [cloudinary.com](https://cloudinary.com) y
   copia `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
   `CLOUDINARY_API_SECRET`. Las fotos se guardan en la carpeta `lechic/`.
3. Copia `.env.local.example` como `.env.local` y completa las variables
   (más `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET`):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Crea las tablas y carga el respaldo (`public/data/*.csv`):
   ```bash
   npm install
   npm run neon:schema     # aplica neon/schema.sql
   npm run neon:importar   # carga productos, variantes y reseñas
   ```
5. (Opcional) Sube las fotos del respaldo `public/images/productos` a
   Cloudinary, cruzándolas con las variantes:
   ```bash
   npm run fotos:analizar  # solo genera el reporte en neon/reportes/
   npm run fotos:subir     # optimiza (sharp) y sube las que cruzan
   ```
6. Define las mismas variables en Vercel (**Settings → Environment
   Variables**) antes de desplegar.

---

## ✏️ Cómo administrar el catálogo — panel `/admin`

Entra a `tusitio.com/admin` con la contraseña que definiste en
`ADMIN_PASSWORD`.

- **Productos** (`/admin`): lista con buscador, precio y stock. Cada fila
  tiene un botón **Editar**.
- **Nuevo producto** (`/admin/productos/nuevo`): formulario con nombre,
  marca, categoría, descripción, aromas y variantes (cada variante con su
  precio, precio de oferta, stock e imagen — se sube directo desde tu
  computadora o celular, no hace falta subir nada a `public/` a mano).
- **Editar / eliminar**: desde `/admin/productos/[id]`, mismo formulario
  precargado, con botón de eliminar.
- **Importar CSV** (`/admin/importar`): para cargar o actualizar muchos
  productos de una vez. La página explica el formato exacto de columnas
  (una fila = una variante, aromas separados por `|`). Reimportar un
  `id_producto` existente reemplaza sus variantes por completo. Un CSV
  es solo texto — no puede llevar las fotos adentro, así que la columna
  `imagen` queda vacía a menos que ya tengas una URL externa.
- **Subir imágenes en lote** (`/admin/imagenes`): para poner las fotos de
  muchos productos importados por CSV de una sola vez. Seleccionas todas
  las fotos juntas desde tu computadora o celular, cada una nombrada
  `id_producto__nombre_variante.jpg` (ej. `ccori__cristal.jpg`), y la
  página las sube y conecta una por una, mostrando el progreso y
  cualquier error (producto o variante que no coincide, etc.). El
  producto y la variante deben existir de antes — esta pantalla solo
  agrega la foto. Hay un script equivalente para correr desde tu
  computadora sin pasar por el navegador: ver
  [`scripts/subir-imagenes-masivo.js`](scripts/subir-imagenes-masivo.js)
  (`npm run subir-imagenes -- ./carpeta`).

Las **marcas y categorías** (`data/marcas.js`) y los **textos generales
del sitio** (`data/config.js`: teléfono, Instagram, envíos, políticas)
siguen editándose en el código, porque cambian muy poco — ver más abajo.

### Un límite a tener en cuenta: tamaño de las fotos

Vercel limita a **4.5 MB el cuerpo de una función** (esto no se puede
subir desde la configuración del proyecto). Eso no afecta a "Subir
imágenes en lote" (sube una foto por request), pero si editas un
producto con **varias variantes y le cambias la foto a todas a la vez**
en el mismo formulario, la suma de esas fotos nuevas debe quedar por
debajo de ese límite — en la práctica, alcanza de sobra si las fotos
están optimizadas para web (unos cientos de KB cada una). Si notas un
error al guardar un producto con muchas fotos grandes, guarda las
variantes en dos tandas o comprime las imágenes antes de subirlas.

### Marcas y categorías nuevas

Si necesitas agregar una marca o categoría nueva, edita `data/marcas.js`,
haz `git push`, y ya aparece disponible como opción en el formulario de
`/admin`.

---

## 🗂️ Estructura del proyecto

```
lechic/
├── app/
│   ├── (site)/            ← Sitio público (mismas rutas de siempre)
│   │   ├── page.js         ← Inicio
│   │   ├── marca/[slug]/   ← Catálogo de cada marca
│   │   ├── producto/[id]/  ← Detalle de producto
│   │   ├── info/           ← Cómo comprar, pagos, envíos, políticas
│   │   └── layout.js
│   └── (admin)/admin/      ← Panel de administración (protegido)
│       ├── page.js               ← Lista de productos
│       ├── productos/nuevo/      ← Alta manual
│       ├── productos/[id]/       ← Edición / eliminación
│       ├── importar/             ← Carga masiva por CSV
│       ├── imagenes/             ← Subir fotos en lote (por nombre de archivo)
│       ├── login/                ← Acceso con contraseña
│       ├── actions.js            ← Server Actions (guardar/eliminar/importar/imágenes)
│       └── layout.js
├── data/
│   ├── marcas.js          ← Marcas y categorías (editable en código)
│   ├── config.js          ← Datos de contacto, envíos, políticas
│   └── productos.js       ← Ya NO se usa en producción: solo es la
│                             fuente que migró a la base de datos una vez
├── lib/
│   ├── data.js            ← Capa de acceso a datos (marcas/config
│   │                          síncronos; productos vía Neon, async)
│   ├── db.js              ← Cliente de Neon/Postgres (solo servidor)
│   ├── storage.js         ← Subida de imágenes a Cloudinary (carpeta lechic/)
│   ├── auth.js            ← Password + cookie de sesión del panel
│   └── slug.js            ← Genera el "id" de un producto a partir del nombre
├── proxy.js               ← Protege /admin (redirige a /admin/login sin sesión)
├── neon/schema.sql        ← Esquema de la base de datos (npm run neon:schema)
├── scripts/               ← neon-schema, importar-csv-neon, migrar-fotos
├── components/
│   ├── admin/             ← Formularios y UI del panel
│   └── ...                ← Componentes del sitio público (sin cambios)
└── styles/
    ├── globals.css         ← Colores y tipografías del sitio público
    └── admin.css           ← Estilos del panel
```

**Por qué está así:** el sitio público (`app/(site)/...`) y el panel
(`app/(admin)/admin/...`) son dos "root layouts" separados de Next.js —
por eso el panel no lleva el Navbar/Footer del catálogo. Ambos comparten
la misma capa de datos (`lib/data.js`), así que si el día de mañana
quieres cambiar de proveedor de base de datos, solo tocas `lib/data.js` y
`lib/db.js`.

---

## 💻 Trabajar en local

```bash
npm install
npm run dev      # abre http://localhost:3000 (necesita .env.local)
npm run build    # verifica que todo compile antes de publicar
```

## 🔐 Notas de seguridad

- `/admin` usa **una sola contraseña compartida** (`ADMIN_PASSWORD`),
  pensada para un equipo pequeño de confianza, no para multiusuario.
- `DATABASE_URL` y `CLOUDINARY_API_SECRET` dan acceso total: solo se usan
  en el servidor (nunca llegan al navegador) y nunca deben subirse al repo (`.env.local` ya está en `.gitignore`).
- Las imágenes se suben a Cloudinary con URL **pública** (para
  que se vean en el catálogo sin login); no subas ahí nada que no deba
  ser público.
