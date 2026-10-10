-- ============================================================
--  RESEÑAS DE PRODUCTOS
-- ============================================================
--  Pega este archivo en Supabase → SQL Editor → Run.
--  Es idempotente (se puede correr más de una vez).
-- ============================================================

create table if not exists resenas (
  id          bigint generated always as identity primary key,
  producto_id text not null references productos(id) on delete cascade,
  -- ID estable de la cuenta de Google (claim "sub"). No se muestra.
  google_sub  text not null,
  -- Solo el nombre de pila, es lo único que se muestra públicamente.
  nombre      text not null,
  estrellas   smallint not null check (estrellas between 1 and 5),
  comentario  text not null default '' check (char_length(comentario) <= 500),
  aprobado    boolean not null default true,
  -- Hash de la IP (no la IP en claro) para limitar abuso.
  ip_hash     text,
  created_at  timestamptz not null default now(),
  -- Una reseña por cuenta y producto.
  unique (producto_id, google_sub)
);

create index if not exists resenas_producto_idx
  on resenas (producto_id, aprobado, created_at desc);
create index if not exists resenas_sub_idx on resenas (google_sub, created_at);
create index if not exists resenas_ip_idx on resenas (ip_hash, created_at);

-- Sin políticas: solo el servidor (service role) puede leer/escribir.
alter table resenas enable row level security;

-- Resumen: promedio, total y conteo por estrella (solo aprobadas).
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
