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
6. **Deploy**. En 1–2 minutos tienes tu URL.

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

- **Productos** (`/admin`): una sola pantalla con una fila por variante
  (foto, SKU, marca, stock, mínimo y precio), buscador y filtros (stock bajo,
  sin control). Marca filas con la casilla para **Eliminar** o **Exportar**
  seleccionados; el botón **Exportar** también permite descargar los
  resultados de la búsqueda o todo el catálogo; **Importar CSV** abre el
  importador en la misma pantalla. Cada fila tiene **Stock** (movimientos),
  **Historial** y **Editar**.
- **Nuevo producto** (`/admin/productos/nuevo`, botón «+ Agregar producto»): formulario con nombre,
  marca, categoría, descripción, aromas y variantes (cada variante con su
  precio, precio de oferta, stock e imagen — se sube directo desde tu
  computadora o celular, no hace falta subir nada a `public/` a mano).
- **Editar / eliminar**: desde `/admin/productos/[id]`, mismo formulario
  precargado, con botón de eliminar.
- **Importar / exportar CSV** (botones en `/admin`): para cargar o actualizar
  muchos productos de una vez. El archivo exportado usa el mismo formato y se
  puede reimportar. El panel explica el formato exacto de columnas
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

Las **marcas**, las **pestañas de la web** y las **categorías** se
configuran desde `/admin/configuracion` (pestañas «Marcas» y «Pestañas de
la web») — ver más abajo. Los **textos generales del sitio**
(`data/config.js`: teléfono, Instagram, envíos, políticas) también se
editan desde Configuración; el archivo solo aporta los valores iniciales.

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

### Marcas, pestañas y categorías

Son tres conceptos independientes:

- **Marca**: la del producto, la que se envía a SAGA. Cada marca tiene su
  *nombre exacto en SAGA* y una *pestaña por defecto*.
- **Pestaña**: dónde se muestra el producto en la web (menú y catálogo
  `/marca/[slug]`). Cada pestaña tiene nombre, color, descripción y las
  categorías que muestra.
- **Categoría**: catálogo general; cada pestaña activa las que quiera.

Todo se administra desde `/admin/configuracion`, sin tocar el código:

- **Marcas**: agregar, ordenar, quitar y fijar el nombre en SAGA y la pestaña
  por defecto.
- **Pestañas de la web**: agregar/quitar pestañas, cambiar color y
  descripción, activar con un click las categorías que se muestran y crear
  categorías nuevas.

En el formulario de producto se eligen Marca, Pestaña y Categoría. Al elegir
la marca se autoselecciona su pestaña por defecto, pero se puede cambiar
(por ejemplo, un producto de marca «Otras» puede ir en la pestaña «Ofertas»).
No se puede quitar una marca, pestaña o categoría que tenga productos.

`data/marcas.js` solo contiene los valores iniciales (se usan mientras no
haya nada guardado). Los slugs `feminine`, `masculine` y `couples` determinan
el formulario de perfumes y el género en SAGA: no los elimines.

**Migración inicial** (una sola vez, antes de desplegar este cambio): agrega
la columna `pestana`, copia la marca actual a la pestaña y pasa las marcas
`ofertas`, `importaciones` y `hogar` a la marca `otras`.

```bash
npm run neon:migrar-pestanas:dev -- --dry-run   # solo muestra, no guarda (desarrollo)
npm run neon:migrar-pestanas:dev                # aplica en desarrollo
npm run neon:migrar-pestanas                    # aplica en producción
```

**CSV**: ahora incluye la columna `pestana` (después de `marca`). Si falta,
se usa la pestaña por defecto de la marca.

### Inventario

El catálogo también puede llevar el inventario de cada variante. Es opcional
y convive con el «hay / no hay» de siempre.

**Campos por variante**: `sku` (código único, es el que usa facturación para
reconocer el producto), `stock_actual` (cantidad; vacío = sin control de
cantidad, la variante sigue usando solo el interruptor «hay stock»),
`stock_minimo` (umbral de alerta), `costo` y `activo`.

- La cantidad **solo cambia mediante movimientos** (`movimientos_inventario`):
  entrada, salida, ajuste o devolución, cada uno con motivo, origen
  (`manual`, `facturacion`, `csv`), usuario y el stock resultante. Nunca se
  edita a mano sin dejar rastro. Con cantidad definida, «hay stock» se deriva
  solo (`stock_actual > 0`).
- **Inventario** (dentro de `/admin`): filtros (bajo mínimo, agotado, sin
  control), alertas, registro de movimientos y su historial.
- **Importar CSV**: columnas opcionales `sku`, `stock_cantidad`,
  `stock_minimo` y `costo`. Al reimportar, las variantes se actualizan por
  `sku` (o por nombre) en vez de borrarse, para no perder el historial.
- Una variante con control de cantidad que se quita del formulario se
  **desactiva** (deja de verse en la tienda) en lugar de eliminarse.

#### Integración con facturación (opcional)

El inventario puede recibir movimientos de un sistema de facturación mediante un
endpoint firmado. Se activa con una variable de entorno (ver `.env.local.example`);
sin ella, el endpoint permanece cerrado. La documentación del contrato está en la
documentación interna del proyecto.

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

### Probar el admin contra develop

`npm run dev` usa `.env.local` (producción). Para probar el panel contra la
base de datos y Cloudinary de develop, usa `.env.dev` (ignorado por git, con
`DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` y `CLOUDINARY_*`):

```bash
npm run dev:dev  # Next.js cargando .env.dev en vez de .env.local
```

1. Abre http://localhost:3000/admin.
2. Entra con el `ADMIN_PASSWORD` de `.env.dev`.
3. Verifica que `DATABASE_URL` apunte a la rama de develop de Neon antes de
   editar productos o subir fotos.

## 🔐 Notas de seguridad

- El panel está protegido con contraseña y sesión revocable; usa un valor largo y
  único, y cámbialo si sospechas que se filtró.
- `DATABASE_URL` y `CLOUDINARY_API_SECRET` dan acceso total: solo se usan
  en el servidor (nunca llegan al navegador) y nunca deben subirse al repo (`.env.local` ya está en `.gitignore`).
- Las imágenes se suben a Cloudinary con URL **pública** (para
  que se vean en el catálogo sin login); no subas ahí nada que no deba
  ser público.
