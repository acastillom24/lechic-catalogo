# Le Chic — Catálogo

Catálogo web de fragancias y belleza. Construido con **Next.js**, se
despliega **gratis en Vercel**, y los productos viven en una base de datos
real (**Supabase**: Postgres + Storage de imágenes). Se administran desde
un panel web en `/admin` — no hace falta tocar código ni hacer `git push`
para dar de alta un producto.

---

## 🚀 Desplegar en Vercel

1. Crea un repositorio en GitHub y sube esta carpeta.
2. Sigue **"Configurar la base de datos (Supabase)"** más abajo y ten a
   mano `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` y
   `ADMIN_SESSION_SECRET`.
3. Entra a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
4. **Add New → Project** → elige el repositorio.
5. En **Environment Variables**, agrega las 4 variables del paso 2.
6. **Deploy**. En 1–2 minutos tienes tu URL (ej: `lechic.vercel.app`).

A partir de ahí, **cada vez que hagas `git push`, Vercel actualiza el
código del sitio automáticamente** — pero los productos ya no viven en el
código: se administran desde `/admin` y aparecen en el sitio sin
necesidad de un nuevo deploy (la página de cada marca se refresca sola
cada minuto).

---

## 🗄️ Configurar la base de datos (Supabase) — una sola vez

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → pega todo el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Esto crea las
   tablas `productos` y `variantes`, y el bucket de Storage `productos`
   (público) donde se guardan las fotos que subas desde el panel.
3. **Project Settings → API** → copia el **Project URL** y el
   **service_role secret** (no el `anon`/`public`).
4. Copia `.env.local.example` como `.env.local` y completa:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ADMIN_PASSWORD=una-contraseña-tuya
   ADMIN_SESSION_SECRET=(genera una con el comando de abajo)
   ```
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Migra el catálogo actual (94 productos) a la base de datos, una sola
   vez:
   ```bash
   npm install
   npm run migrar-datos
   ```
   Es seguro volver a correrlo — no duplica nada, sobreescribe por id.
6. Define las mismas 4 variables en Vercel (**Settings → Environment
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
  `id_producto` existente reemplaza sus variantes por completo.

Las **marcas y categorías** (`data/marcas.js`) y los **textos generales
del sitio** (`data/config.js`: teléfono, Instagram, envíos, políticas)
siguen editándose en el código, porque cambian muy poco — ver más abajo.

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
│       ├── login/                ← Acceso con contraseña
│       ├── actions.js            ← Server Actions (guardar/eliminar/importar)
│       └── layout.js
├── data/
│   ├── marcas.js          ← Marcas y categorías (editable en código)
│   ├── config.js          ← Datos de contacto, envíos, políticas
│   └── productos.js       ← Ya NO se usa en producción: solo es la
│                             fuente que migró a la base de datos una vez
├── lib/
│   ├── data.js            ← Capa de acceso a datos (marcas/config
│   │                          síncronos; productos vía Supabase, async)
│   ├── supabaseServer.js  ← Cliente de Supabase (solo servidor)
│   ├── auth.js            ← Password + cookie de sesión del panel
│   └── slug.js            ← Genera el "id" de un producto a partir del nombre
├── proxy.js               ← Protege /admin (redirige a /admin/login sin sesión)
├── supabase/schema.sql    ← Esquema de la base de datos (correr una vez)
├── scripts/migrar-datos.js← Migración única de data/productos.js → Supabase
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
`lib/supabaseServer.js`.

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
- La `SUPABASE_SERVICE_ROLE_KEY` tiene permisos totales sobre la base de
  datos: solo se usa en el servidor (nunca llega al navegador) y nunca
  debe subirse al repo (`.env.local` ya está en `.gitignore`).
- Las imágenes se suben a un bucket **público** de Supabase Storage (para
  que se vean en el catálogo sin login); no subas ahí nada que no deba
  ser público.
