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

-- Pestaña de la web donde se ubica el producto (independiente de la marca, que es la de SAGA).
-- Backfill: scripts/migrar-marcas-pestanas.js (pestana = marca anterior).
alter table productos add column if not exists pestana text;
create index if not exists productos_pestana_categoria_idx
  on productos (pestana, categoria);

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

-- ============================================================
--  PACKS
--  Una variante con es_pack = true se arma con otras variantes
--  (pack_componentes). Su stock NO se guarda: se calcula como
--  min(floor(disponible_componente / cantidad)) (ver lib/packs.js),
--  así que si un componente se agota el pack queda en 0. stock_actual
--  de un pack es siempre NULL y no admite movimientos propios: la venta
--  de un pack descuenta de sus componentes.
-- ============================================================
alter table variantes add column if not exists es_pack boolean not null default false;

create table if not exists pack_componentes (
  pack_variante_id       bigint  not null references variantes(id) on delete cascade,
  componente_variante_id bigint  not null references variantes(id) on delete restrict,
  cantidad               integer not null default 1 check (cantidad > 0),
  primary key (pack_variante_id, componente_variante_id),
  check (pack_variante_id <> componente_variante_id)
);
create index if not exists pack_componentes_comp_idx on pack_componentes (componente_variante_id);

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
-- Datos opcionales del cliente (campos libres) y listas configurables (categoría, entrega, tipo de cliente):
-- las listas ya no se limitan en la base, se validan contra Configuración → Ventas.
alter table ventas add column if not exists distrito        text;
alter table ventas add column if not exists cliente_nombre  text;
alter table ventas drop constraint if exists ventas_categoria_check;
alter table ventas drop constraint if exists ventas_destino_check;
alter table ventas drop constraint if exists ventas_tipo_cliente_check;
create index if not exists ventas_fecha_idx    on ventas (fecha desc);
create index if not exists ventas_telefono_idx on ventas (telefono);
create index if not exists ventas_pendientes_idx on ventas (fecha) where estado = 'pendiente';

-- ============================================================
--  ASISTENCIAS Y PAGO DE COLABORADORES (/admin/asistencias)
--  colaboradores.multiplicador: factor sobre la tarifa por hora para
--  las horas extra aprobadas (ej. 1.25).
--  asistencias guarda una copia (snapshot) de tarifa, multiplicador,
--  horas netas y refrigerio al marcar el ingreso: cambiar la
--  configuración después no altera lo ya registrado.
-- ============================================================
create table if not exists colaboradores (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  cargo          text not null default '',
  jornada        text not null check (jornada in ('MEDIO_TIEMPO','COMPLETO')),
  tipo_pago      text not null check (tipo_pago in ('SEMANAL','QUINCENAL','MENSUAL')),
  multiplicador  numeric(4,2) not null default 1.25 check (multiplicador >= 1),
  tarifa         numeric(10,2) not null check (tarifa >= 0),   -- S/ por hora
  hora_entrada   time not null,
  hora_salida    time not null,
  refrigerio_min integer not null default 0 check (refrigerio_min >= 0),
  activo         boolean not null default true,
  fecha_baja     date,
  created_at     timestamptz not null default now()
);

create table if not exists asistencias (
  id               bigint generated always as identity primary key,
  colaborador_id   bigint not null references colaboradores(id) on delete cascade,
  fecha            date not null default ((now() at time zone 'America/Lima')::date),
  hora_ingreso     time not null,
  hora_salida      time,                       -- null = aún no marca salida
  -- snapshot de la configuración vigente al marcar el ingreso
  tarifa           numeric(10,2) not null,
  multiplicador    numeric(4,2) not null,
  minutos_jornada  integer not null,           -- horas netas programadas, en minutos
  refrigerio_min   integer not null default 0,
  extras_aprobadas boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (colaborador_id, fecha)
);
create index if not exists asistencias_fecha_idx on asistencias (fecha desc);

-- ============================================================
--  INTEGRACIÓN CON SAGA (Seller Center) — fase 1: perfumes
--  Campos extra del producto/variante que exige SAGA, cuentas SAGA
--  (con su API key, guardada en la tabla) y el estado de sincronización
--  por variante/sistema/cuenta.
-- ============================================================
alter table productos add column if not exists saga_categoria     text;  -- id de PrimaryCategory en SAGA
alter table productos add column if not exists modelo             text;
alter table productos add column if not exists tipo_perfume       text;
alter table productos add column if not exists genero             text;
-- (Antes aquí se eliminaba una columna `notas_aromaticas` del producto, de una versión muy antigua. Ya no: ese nombre es ahora el de las notas aromáticas.)
alter table productos add column if not exists caracteristicas    text;
alter table productos add column if not exists condicion          text not null default 'Nuevo';

alter table productos add column if not exists sku_padre text;  -- ParentSku en SAGA; solo se usa si usar_sku_padre
alter table productos add column if not exists usar_sku_padre boolean not null default false;  -- sin marcar: cada variante es un producto suelto en SAGA
alter table productos add column if not exists sku_padre_web text;  -- SKU padre de la web (siempre editable); sku_padre es el que se envió a SAGA
-- Paquete: un solo juego de medidas por producto.
alter table productos add column if not exists contenido_paquete text;
alter table productos add column if not exists paquete_ancho     numeric;
alter table productos add column if not exists paquete_largo     numeric;
alter table productos add column if not exists paquete_alto      numeric;
alter table productos add column if not exists paquete_peso      numeric;
-- Datos generales de SAGA a nivel de producto.
alter table productos add column if not exists pais_produccion text;  -- "Hecho en"
alter table productos add column if not exists formato_belleza text not null default 'Frasco';
-- Campos extra por categoría primaria (ver lib/saga-campos.js): { FeedName: valor }.
alter table productos add column if not exists saga_extras jsonb not null default '{}'::jsonb;  -- campos por producto
alter table variantes add column if not exists saga_extras jsonb not null default '{}'::jsonb;  -- campos por variante (color, variante…)
-- Valores GENERALES del producto para datos que se piden por variante: { registro_sanitario, variante_extras: {FeedName: valor} }.
-- Cada variante hereda estos valores mientras no tenga uno propio (variantes.registro_sanitario / saga_extras).
alter table productos add column if not exists atributos jsonb not null default '{}'::jsonb;
alter table variantes add column if not exists codigo_barras text;
alter table variantes add column if not exists volumen       text;  -- medida del frasco, ej. "50 ML"
-- Datos de SAGA por variante.
alter table variantes add column if not exists registro_sanitario text;
alter table variantes add column if not exists descripcion        text;    -- si está vacía se usa la del producto
alter table variantes add column if not exists cantidad_empaque   text;    -- CantidadContenidaEnElEmpaque, ej. "100ML"
-- Nombres de la web: «notas_aromaticas» y «fragancia_perfume». Antes se llamaban notas_saga y aromas_saga (o, en un paso intermedio,
-- notas y fragancia): si existen con un nombre antiguo se renombran conservando sus datos. Idempotente.
do $$
declare t text; v text[];
begin
  foreach t in array array['variantes', 'productos'] loop
    foreach v slice 1 in array array[array['notas_saga', 'notas_aromaticas'], array['notas', 'notas_aromaticas'], array['aromas_saga', 'fragancia_perfume'], array['fragancia', 'fragancia_perfume']] loop
      if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = t and column_name = v[1])
         and not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = t and column_name = v[2]) then
        execute format('alter table %I rename column %I to %I', t, v[1], v[2]);
      end if;
    end loop;
  end loop;
end $$;

alter table variantes add column if not exists fragancia_perfume        text[] not null default '{}';  -- fragancia (FraganciaPerfume en SAGA)
alter table variantes add column if not exists notas_aromaticas         text;    -- notas aromáticas (se muestran en la web; NotasAromaticas en SAGA)
-- Varias imágenes por variante (la primera es la portada y también va en `imagen`, que se mantiene para la web, el CSV y el inventario).
alter table variantes add column if not exists imagenes text[] not null default '{}';
update variantes set imagenes = array[imagen] where imagen is not null and imagen <> '' and cardinality(imagenes) = 0;
alter table variantes add column if not exists saga_combinar_nombre boolean not null default true;  -- true: SAGA recibe «producto + variante»; false: solo el nombre del producto

-- Migraciones desde versiones anteriores de este esquema (idempotentes).
do $$
begin
  -- El registro sanitario estaba en productos: pasa a cada variante.
  if exists (select 1 from information_schema.columns
              where table_schema = current_schema() and table_name = 'productos' and column_name = 'registro_sanitario') then
    update variantes v set registro_sanitario = coalesce(v.registro_sanitario, p.registro_sanitario)
      from productos p where p.id = v.producto_id;
    alter table productos drop column registro_sanitario;
  end if;
  -- El paquete estaba por variante: pasa al producto (desde su primera variante).
  if exists (select 1 from information_schema.columns
              where table_schema = current_schema() and table_name = 'variantes' and column_name = 'paquete_ancho') then
    update productos p set
      contenido_paquete = coalesce(p.contenido_paquete, f.contenido_paquete),
      paquete_ancho     = coalesce(p.paquete_ancho, f.paquete_ancho),
      paquete_largo     = coalesce(p.paquete_largo, f.paquete_largo),
      paquete_alto      = coalesce(p.paquete_alto, f.paquete_alto),
      paquete_peso      = coalesce(p.paquete_peso, f.paquete_peso)
    from (select distinct on (producto_id) producto_id, contenido_paquete, paquete_ancho, paquete_largo, paquete_alto, paquete_peso
            from variantes order by producto_id, orden, id) f
    where f.producto_id = p.id;
    alter table variantes
      drop column contenido_paquete, drop column paquete_ancho, drop column paquete_largo,
      drop column paquete_alto, drop column paquete_peso;
  end if;
  -- El país de producción estaba por variante: pasa al producto (desde su primera variante con valor).
  if exists (select 1 from information_schema.columns
              where table_schema = current_schema() and table_name = 'variantes' and column_name = 'pais_produccion') then
    update productos p set pais_produccion = coalesce(p.pais_produccion, f.pais_produccion)
      from (select distinct on (producto_id) producto_id, pais_produccion
              from variantes where pais_produccion is not null order by producto_id, orden, id) f
     where f.producto_id = p.id;
    alter table variantes drop column pais_produccion;
  end if;
end $$;

-- Atributos a nivel de PRODUCTO: la variante hereda los del producto y solo guarda lo que personaliza.
-- Medida, cantidad en el empaque, fragancia y notas pasan a existir también en el producto.
alter table productos add column if not exists volumen          text;
alter table productos add column if not exists cantidad_empaque text;
alter table productos add column if not exists fragancia_perfume      text[] not null default '{}';
alter table productos add column if not exists notas_aromaticas       text;
-- Personalizados de la variante que no tienen columna propia (modelo, país, condición, paquete, extras de producto…):
-- solo las claves presentes se personalizan; el resto usa lo del producto. Ver lib/atributos-efectivos.js.
alter table variantes add column if not exists atributos jsonb not null default '{}'::jsonb;

-- Productos con UNA sola variante: sus datos de SAGA pasan al producto y la variante queda heredando (idempotente).
-- Los productos con varias variantes conservan sus valores como personalizados de cada variante.
with unica as (
  select producto_id, min(id) as vid from variantes group by producto_id having count(*) = 1
)
update productos p set
  volumen          = coalesce(p.volumen, nullif(v.volumen, '')),
  cantidad_empaque = coalesce(p.cantidad_empaque, nullif(v.cantidad_empaque, '')),
  fragancia_perfume      = case when cardinality(p.fragancia_perfume) = 0 then v.fragancia_perfume else p.fragancia_perfume end,
  notas_aromaticas       = coalesce(p.notas_aromaticas, nullif(v.notas_aromaticas, '')),
  atributos        = jsonb_set(
                       jsonb_set(
                         p.atributos,
                         '{registro_sanitario}',
                         to_jsonb(coalesce(nullif(p.atributos->>'registro_sanitario', ''), nullif(v.registro_sanitario, ''), '')),
                         true
                       ),
                       '{variante_extras}',
                       v.saga_extras || coalesce(p.atributos->'variante_extras', '{}'::jsonb),
                       true
                     )
from unica u join variantes v on v.id = u.vid
where p.id = u.producto_id;

-- La variante única deja vacío lo que quedó igual que en el producto (así hereda).
update variantes v set
  volumen          = case when v.volumen = p.volumen then null else v.volumen end,
  cantidad_empaque = case when v.cantidad_empaque = p.cantidad_empaque then null else v.cantidad_empaque end,
  fragancia_perfume      = case when v.fragancia_perfume = p.fragancia_perfume then '{}' else v.fragancia_perfume end,
  notas_aromaticas       = case when v.notas_aromaticas = p.notas_aromaticas then null else v.notas_aromaticas end,
  registro_sanitario = case when v.registro_sanitario = p.atributos->>'registro_sanitario' then null else v.registro_sanitario end,
  saga_extras      = case when v.saga_extras <@ coalesce(p.atributos->'variante_extras', '{}'::jsonb) then '{}'::jsonb else v.saga_extras end
from productos p
where p.id = v.producto_id
  and (select count(*) from variantes x where x.producto_id = p.id) = 1;

-- Las fechas de oferta pasan a ser por canal (tabla precios_canal).
alter table variantes drop column if exists oferta_inicio;
alter table variantes drop column if exists oferta_fin;

create table if not exists cuentas_saga (
  alias   text primary key,                -- identifica la cuenta, ej. tienda1
  nombre  text not null,
  user_id text,                            -- UserID de Seller Center
  activo  boolean not null default true
);
alter table cuentas_saga add column if not exists api_key  text;  -- solo servidor; nunca se envía al navegador
alter table cuentas_saga add column if not exists base_url text;  -- elegida de la lista configurable (saga_opciones.urlsBase)
alter table cuentas_saga add column if not exists operador text;  -- código de unidad de negocio (saga_opciones.operadores)

create table if not exists sincronizaciones (
  variante_id  bigint not null references variantes(id) on delete cascade,
  sistema      text   not null default 'saga',
  cuenta_alias text   not null,
  estado       text   not null default 'pendiente' check (estado in ('pendiente','publicado','error')),
  feed_id      text,
  error        text,
  ultimo_sync  timestamptz,
  primary key (variante_id, sistema, cuenta_alias)
);

-- Usuario del panel /operaciones que originó (o tocó por última vez) la fila; null = admin o automático.
alter table sincronizaciones add column if not exists usuario_panel text;

-- Revisión de contenido de SAGA (QC): motivos por los que un producto creado no se publica, su categoría
-- (contenido, precio, multimedia, compliance, configuración, otros) y el puntaje de contenido.
alter table sincronizaciones add column if not exists revision_categoria text;
alter table sincronizaciones add column if not exists revision_motivos jsonb;
alter table sincronizaciones add column if not exists revision_puntaje integer;
alter table sincronizaciones add column if not exists revision_fecha timestamptz;

-- «Sin publicar»: producto ya creado en SAGA pero no vendible (IsPublished = 0 o QC no aprobado). venta_ok null =
-- aún no consultado; venta_detalle = { items: [{ clave, etiqueta, estado, detalle }], motivos: [texto] }.
alter table sincronizaciones add column if not exists venta_ok boolean;
alter table sincronizaciones add column if not exists venta_detalle jsonb;
alter table sincronizaciones add column if not exists venta_fecha timestamptz;

-- Cola de envíos: SAGA permite 1 feed cada 2 minutos por cuenta; lo que no cabe espera aquí (acción a repetir y hora).
alter table sincronizaciones add column if not exists cola_modo text;
alter table sincronizaciones add column if not exists proximo_envio timestamptz;
alter table sincronizaciones add column if not exists cola_intentos integer;

-- Cola de reintentos del stock: si avisar a SAGA falla, la fila queda marcada y se reintenta sola.
alter table sincronizaciones add column if not exists stock_pendiente boolean     not null default false;
alter table sincronizaciones add column if not exists intentos        int         not null default 0;
alter table sincronizaciones add column if not exists proximo_intento timestamptz;

-- Cómo quedó registrada la variante en la cuenta: creada desde la web o vinculada a un SKU que ya existía en SAGA.
alter table sincronizaciones add column if not exists origen text not null default 'creado';
alter table sincronizaciones drop constraint if exists sincronizaciones_origen_check;
alter table sincronizaciones add constraint sincronizaciones_origen_check check (origen in ('creado','vinculado'));

-- Imagen principal: SAGA solo la acepta cuando el producto ya existe, así que se envía al terminar el feed de creación.
alter table sincronizaciones add column if not exists imagen_pendiente boolean not null default false;
alter table sincronizaciones add column if not exists imagen_feed_id   text;

-- Acción con la que se sincroniza la variante en la cuenta: "crear" (alta desde la web) o el id de una acción
-- configurable (vincular, vincular_tecnicos, vincular_todo, actualizar o propias). Una variante creada pasa
-- sola a "vincular" cuando SAGA confirma el alta.
alter table sincronizaciones add column if not exists accion text not null default 'crear';
update sincronizaciones set accion = 'vincular' where origen = 'vinculado' and accion = 'crear';
update sincronizaciones set accion = 'vincular', origen = 'vinculado' where origen = 'creado' and estado = 'publicado' and accion = 'crear';

-- Permite renombrar el alias de una cuenta sin perder su historial.
alter table sincronizaciones drop constraint if exists sincronizaciones_cuenta_alias_fkey;
alter table sincronizaciones add constraint sincronizaciones_cuenta_alias_fkey
  foreign key (cuenta_alias) references cuentas_saga(alias) on update cascade on delete cascade;

-- Precio propio de una variante en una cuenta/plataforma. Cada campo vacío usa el valor de la web.
create table if not exists precios_canal (
  variante_id   bigint  not null references variantes(id) on delete cascade,
  sistema       text    not null default 'saga',
  cuenta_alias  text    not null references cuentas_saga(alias) on update cascade on delete cascade,
  precio        numeric,
  precio_oferta numeric,
  oferta_inicio date,
  oferta_fin    date,
  primary key (variante_id, sistema, cuenta_alias)
);

-- Paquete propio de un producto en una cuenta/plataforma. Sin fila = se usa el paquete general del producto.
create table if not exists paquete_plataforma (
  producto_id      text    not null references productos(id) on delete cascade on update cascade,
  sistema          text    not null default 'saga',
  cuenta_alias     text    not null references cuentas_saga(alias) on update cascade on delete cascade,
  contenido_paquete text,
  paquete_ancho    numeric,
  paquete_largo    numeric,
  paquete_alto     numeric,
  paquete_peso     numeric,
  primary key (producto_id, sistema, cuenta_alias)
);

-- Categoría primaria propia de un producto en una cuenta/plataforma, con sus campos extra. Sin fila = se usa la general del producto.
create table if not exists categoria_plataforma (
  producto_id      text    not null references productos(id) on delete cascade on update cascade,
  sistema          text    not null default 'saga',
  cuenta_alias     text    not null references cuentas_saga(alias) on update cascade on delete cascade,
  saga_categoria   text    not null,
  saga_extras      jsonb   not null default '{}'::jsonb,  -- campos extra por producto de esa categoría
  variante_extras  jsonb   not null default '{}'::jsonb,  -- campos extra generales para las variantes de esa categoría
  primary key (producto_id, sistema, cuenta_alias)
);

-- ============================================================
--  LIBRO DE RECLAMACIONES (formulario público + monitor en /admin/reclamos)
--  codigo: LCH-AAAA-NNNNNN (se asigna al guardar). fecha_limite = 15 días
--  hábiles desde el registro (Ley 31435; sin contar feriados).
-- ============================================================
create table if not exists reclamos (
  id                bigint generated always as identity primary key,
  codigo            text unique,
  tipo              text not null check (tipo in ('reclamo','queja')),
  -- Consumidor
  nombre            text not null,
  tipo_documento    text not null check (tipo_documento in ('DNI','CE','Pasaporte','RUC')),
  documento         text not null,
  domicilio         text not null,
  telefono          text not null,
  email             text not null,
  es_menor          boolean not null default false,
  apoderado         text,                 -- padre, madre o apoderado si es menor de edad
  -- Bien contratado
  tipo_bien         text not null check (tipo_bien in ('producto','servicio')),
  descripcion_bien  text not null,
  monto             numeric,
  numero_pedido     text,
  -- Reclamo o queja
  detalle           text not null,
  pedido_consumidor text not null,
  -- Seguimiento
  estado            text not null default 'pendiente' check (estado in ('pendiente','en_proceso','atendido')),
  fecha_limite      date not null,
  respuesta         text,
  respondido_at     timestamptz,
  respuesta_enviada boolean not null default false,  -- ¿se envió la respuesta al correo del consumidor?
  copia_enviada     boolean not null default false,  -- ¿se envió la hoja de reclamación al consumidor?
  nota_interna      text,
  ip_hash           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists reclamos_created_idx on reclamos (created_at desc);
create index if not exists reclamos_pendientes_idx on reclamos (fecha_limite) where estado <> 'atendido';
create index if not exists reclamos_ip_idx on reclamos (ip_hash, created_at desc);

-- Seguridad del login: sesiones del panel /admin que se pueden revocar (cerrar sesión las invalida en el servidor)
-- y contador de intentos fallidos de login por ámbito (admin / ventas) y clave (IP, usuario o global).
create table if not exists sesiones_admin (
  id      text primary key,
  creada  timestamptz not null default now(),
  expira  timestamptz not null
);
create index if not exists sesiones_admin_expira_idx on sesiones_admin (expira);

create table if not exists login_intentos (
  ambito    text not null,
  clave     text not null,
  intentos  int  not null default 0,
  desde     timestamptz not null default now(),
  primary key (ambito, clave)
);
