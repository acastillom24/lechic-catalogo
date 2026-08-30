-- ============================================================
--  ESQUEMA DE BASE DE DATOS — Catálogo Le Chic
-- ============================================================
--  Cómo usarlo:
--   1. Crea un proyecto en https://supabase.com (plan gratis).
--   2. Ve a "SQL Editor" → "New query", pega TODO este archivo
--      y dale a "Run".
--   3. Ve a "Project Settings" → "API" y copia:
--        - Project URL          → SUPABASE_URL
--        - service_role secret  → SUPABASE_SERVICE_ROLE_KEY
--      Pégalos en tu archivo .env.local (ver .env.local.example)
--      y en las variables de entorno del proyecto en Vercel.
--   4. Corre `npm run migrar-datos` una sola vez para cargar el
--      catálogo actual (data/productos.js) dentro de esta base
--      de datos. Después de eso, todo se administra desde /admin.
-- ============================================================

-- ---- Tabla de productos ----
create table if not exists productos (
  id           text primary key,
  marca        text not null,
  categoria    text not null,
  nombre       text not null,
  descripcion  text not null default '',
  aromas       text[] not null default '{}',
  destacado    boolean not null default false,
  orden        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists productos_marca_categoria_idx
  on productos (marca, categoria);

-- ---- Tabla de variantes (cada producto tiene 1 o más) ----
create table if not exists variantes (
  id            bigint generated always as identity primary key,
  producto_id   text not null references productos(id) on delete cascade,
  nombre        text not null default 'Único',
  precio        numeric,
  precio_oferta numeric,
  stock         boolean not null default true,
  imagen        text,
  aromas        text[] not null default '{}',
  orden         integer not null default 0
);

create index if not exists variantes_producto_id_idx
  on variantes (producto_id);

-- ---- updated_at automático al editar un producto ----
create or replace function actualizar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists productos_updated_at on productos;
create trigger productos_updated_at
  before update on productos
  for each row execute function actualizar_updated_at();

-- ---- RLS (defensivo): el sitio y el panel /admin usan la
-- "service role key" desde el servidor, que siempre puede saltarse
-- estas políticas. Las dejamos activadas para que, si alguna vez se
-- usara la clave pública (anon) por error, no se pueda leer ni
-- escribir nada. ----
alter table productos enable row level security;
alter table variantes enable row level security;

-- ---- Storage: bucket público para las imágenes subidas desde /admin ----
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;
