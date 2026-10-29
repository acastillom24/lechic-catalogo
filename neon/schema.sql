-- ============================================================
--  ESQUEMA NEON (Postgres) — Catálogo Le Chic
--  Se aplica con: npm run neon:schema
-- ============================================================

create table if not exists productos (
  id           text primary key,
  marca        text not null,
  categoria    text not null,
  nombre       text not null,
  descripcion  text not null default '',
  aromas       text[] not null default '{}',
  destacado    boolean not null default false,
  -- bigint: el código usa Date.now() como orden.
  orden        bigint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists productos_marca_categoria_idx
  on productos (marca, categoria);

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

create table if not exists resenas (
  id          bigint generated always as identity primary key,
  producto_id text not null references productos(id) on delete cascade,
  google_sub  text not null,
  nombre      text not null,
  estrellas   smallint not null check (estrellas between 1 and 5),
  comentario  text not null default '' check (char_length(comentario) <= 500),
  aprobado    boolean not null default true,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  unique (producto_id, google_sub)
);

create index if not exists resenas_producto_idx
  on resenas (producto_id, aprobado, created_at desc);
create index if not exists resenas_sub_idx on resenas (google_sub, created_at);
create index if not exists resenas_ip_idx on resenas (ip_hash, created_at);

create or replace function resumen_resenas(p_producto text)
returns table (total bigint, promedio numeric, c1 bigint, c2 bigint, c3 bigint, c4 bigint, c5 bigint)
language sql stable as $$
  select
    count(*),
    coalesce(round(avg(estrellas)::numeric, 1), 0),
    count(*) filter (where estrellas = 1),
    count(*) filter (where estrellas = 2),
    count(*) filter (where estrellas = 3),
    count(*) filter (where estrellas = 4),
    count(*) filter (where estrellas = 5)
  from resenas
  where producto_id = p_producto and aprobado;
$$;

-- Configuración editable del sitio (clave 'sitio': solo los valores cambiados
-- desde /admin/configuracion; el resto sale de data/config.js).
create table if not exists configuracion (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now()
);
