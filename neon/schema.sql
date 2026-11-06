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

-- ============================================================
--  INVENTARIO
--  stock_actual = NULL  -> variante sin control de cantidad (se usa el
--                          boolean `stock` como hasta ahora).
--  stock_actual = N     -> cantidad real; `stock` se mantiene derivado
--                          (N > 0) desde lib/inventario.js.
--  stock_actual solo debe modificarse mediante movimientos_inventario.
-- ============================================================
alter table variantes add column if not exists sku           text;
alter table variantes add column if not exists stock_actual  integer;
alter table variantes add column if not exists stock_minimo  integer not null default 0;
alter table variantes add column if not exists costo         numeric;
alter table variantes add column if not exists activo        boolean not null default true;

-- SKU único cuando existe (permite varias variantes aún sin SKU).
create unique index if not exists variantes_sku_uniq
  on variantes (sku) where sku is not null;

create table if not exists movimientos_inventario (
  id                bigint generated always as identity primary key,
  variante_id       bigint not null references variantes(id) on delete cascade,
  tipo              text not null
                    check (tipo in ('entrada','salida','ajuste','devolucion')),
  cantidad          integer not null check (cantidad <> 0), -- con signo: + entra, - sale
  stock_resultante  integer not null,
  motivo            text not null default '',
  origen            text not null default 'manual'
                    check (origen in ('manual','facturacion','csv')),
  referencia        text,                 -- ej. B001-123
  idempotency_key   text,                 -- ej. facturacion:<comprobante_id>:emitido
  usuario           text,
  created_at        timestamptz not null default now()
);

create unique index if not exists movimientos_idem_uniq
  on movimientos_inventario (idempotency_key) where idempotency_key is not null;
create index if not exists movimientos_variante_idx
  on movimientos_inventario (variante_id, created_at desc);

-- ============================================================
--  VENTAS (panel /sales + reportes en /admin)
--  telefono es obligatorio: 9 dígitos. '999999999' = "sin teléfono"
--  (único valor repetido permitido).
-- ============================================================
create table if not exists usuarios_ventas (
  id            bigint generated always as identity primary key,
  usuario       text not null,
  password_hash text not null,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index if not exists usuarios_ventas_usuario_uniq
  on usuarios_ventas (lower(usuario));

create table if not exists ventas (
  id             bigint generated always as identity primary key,
  fecha          date not null default ((now() at time zone 'America/Lima')::date),
  telefono       text not null
                 check (telefono ~ '^[0-9]{9}$'
                        and (telefono = '999999999' or telefono !~ '^([0-9])\1{8}$')),
  cliente_ref    text,                       -- ID original si era Instagram/nombre
  categoria      text not null check (categoria in ('CATALOGOS','IMPORTADOS')),
  monto          numeric(10,2) not null check (monto >= 0),
  adelanto       numeric(10,2) not null default 0 check (adelanto >= 0),
  estado         text not null default 'cerrada' check (estado in ('pendiente','cerrada')),
  destino        text check (destino in ('LIMA','PROVINCIA','RECOJO')),
  courier        text,
  tipo_cliente   text check (tipo_cliente in ('NUEVO','RECOMPRA')),
  metodo_pago    text,
  comprobante    text,
  notas          text,
  registrado_por bigint references usuarios_ventas(id) on delete set null,
  origen         text not null default 'web' check (origen in ('web','csv')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  cerrada_at     timestamptz
);
create index if not exists ventas_fecha_idx    on ventas (fecha desc);
create index if not exists ventas_telefono_idx on ventas (telefono);
create index if not exists ventas_pendientes_idx on ventas (fecha) where estado = 'pendiente';
