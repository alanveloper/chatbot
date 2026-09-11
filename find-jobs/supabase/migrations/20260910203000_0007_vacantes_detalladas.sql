-- 0007_vacantes_detalladas
-- Catálogo de vacantes pensado para matching explicable: separa los datos
-- verificables (sueldo, actividades, horario) de cómo se vive el trabajo.

alter table public.empresas
  add column if not exists sitio_web text,
  add column if not exists mision text,
  add column if not exists vision text,
  add column if not exists proposito text,
  add column if not exists fecha_fundacion date,
  add column if not exists verificada boolean not null default false;

alter table public.vacantes
  add column if not exists codigo_externo text,
  add column if not exists ciudad text,
  add column if not exists estado text,
  add column if not exists tipo_contrato text,
  add column if not exists jornada text,
  add column if not exists zona_horaria text,
  add column if not exists sueldo_moneda text not null default 'MXN',
  add column if not exists sueldo_periodo text not null default 'mensual',
  add column if not exists sueldo_visible boolean not null default true,
  add column if not exists fecha_publicacion timestamptz not null default now(),
  add column if not exists fecha_cierre timestamptz,
  add column if not exists url_postulacion text,
  add column if not exists personas_a_cargo integer not null default 0,
  add column if not exists nivel_autonomia smallint,
  add column if not exists nivel_interaccion smallint,
  add column if not exists nivel_estructura smallint,
  add column if not exists nivel_ritmo smallint,
  add column if not exists resumen_transparencia text;

alter table public.vacantes
  drop constraint if exists vacantes_nivel_autonomia_check,
  drop constraint if exists vacantes_nivel_interaccion_check,
  drop constraint if exists vacantes_nivel_estructura_check,
  drop constraint if exists vacantes_nivel_ritmo_check,
  add constraint vacantes_nivel_autonomia_check check (nivel_autonomia between 1 and 5 or nivel_autonomia is null),
  add constraint vacantes_nivel_interaccion_check check (nivel_interaccion between 1 and 5 or nivel_interaccion is null),
  add constraint vacantes_nivel_estructura_check check (nivel_estructura between 1 and 5 or nivel_estructura is null),
  add constraint vacantes_nivel_ritmo_check check (nivel_ritmo between 1 and 5 or nivel_ritmo is null),
  add constraint vacantes_fecha_cierre_check check (fecha_cierre is null or fecha_cierre >= fecha_publicacion),
  add constraint vacantes_personas_a_cargo_check check (personas_a_cargo >= 0);

create unique index if not exists vacantes_empresa_codigo_externo_uidx
  on public.vacantes (empresa_id, codigo_externo)
  where codigo_externo is not null;

create index if not exists vacantes_busqueda_activa_idx
  on public.vacantes (activa, pais, estado, ciudad, modalidad, seniority);

-- Valores declarados por la organización: misión/visión explican el porqué;
-- esta tabla permite medir cuáles valores se viven y con qué evidencia.
create table if not exists public.empresa_valores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  valor text not null,
  importancia smallint not null default 3 check (importancia between 1 and 5),
  descripcion text,
  evidencia text,
  created_at timestamptz not null default now(),
  unique (empresa_id, valor)
);

-- Dimensiones culturales con escala -2..2. El significado de cada dimensión
-- se mantiene en dimensiones_ref y se compara con condiciones_persona.
create table if not exists public.empresa_cultura_metricas (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  dimension text not null references public.dimensiones_ref(dimension),
  valor smallint not null check (valor between -2 and 2),
  confianza smallint not null default 3 check (confianza between 1 and 5),
  evidencia text,
  fuente text,
  actualizado_at timestamptz not null default now(),
  primary key (empresa_id, dimension)
);

-- Prestaciones y apoyos concretos, con importe opcional. No se fuerza un
-- catálogo cerrado para que puedan registrarse beneficios poco comunes.
create table if not exists public.vacante_prestaciones (
  id uuid primary key default gen_random_uuid(),
  vacante_id uuid not null references public.vacantes(id) on delete cascade,
  categoria text not null,
  nombre text not null,
  descripcion text,
  valor_monetario numeric(14,2) check (valor_monetario is null or valor_monetario >= 0),
  moneda text,
  incluida boolean not null default true,
  unique (vacante_id, categoria, nombre)
);

-- Actividades reales, no sólo un bloque de texto. Permite empatar intereses,
-- habilidades y proporción de tiempo para cada tarea.
create table if not exists public.vacante_responsabilidades (
  id uuid primary key default gen_random_uuid(),
  vacante_id uuid not null references public.vacantes(id) on delete cascade,
  titulo text not null,
  descripcion text,
  porcentaje_tiempo numeric(5,2) check (porcentaje_tiempo between 0 and 100),
  frecuencia text,
  prioridad smallint not null default 3 check (prioridad between 1 and 5),
  entregable text,
  orden smallint not null default 0
);

create index if not exists vacante_responsabilidades_vacante_idx
  on public.vacante_responsabilidades (vacante_id, orden);

-- Resultado esperado durante los primeros meses. La claridad de objetivos es
-- una señal de ajuste importante y también útil para la persona postulante.
create table if not exists public.vacante_resultados_esperados (
  id uuid primary key default gen_random_uuid(),
  vacante_id uuid not null references public.vacantes(id) on delete cascade,
  horizonte_dias smallint not null check (horizonte_dias between 1 and 730),
  resultado text not null,
  indicador_exito text,
  orden smallint not null default 0
);

-- Expectativa del puesto para una dimensión de entorno. objetivo usa la misma
-- escala -2..2 del perfil; peso decide cuánto aporta al score de esta vacante.
create table if not exists public.vacante_metricas_match (
  vacante_id uuid not null references public.vacantes(id) on delete cascade,
  dimension text not null references public.dimensiones_ref(dimension),
  objetivo smallint not null check (objetivo between -2 and 2),
  tolerancia smallint not null default 1 check (tolerancia between 0 and 4),
  peso numeric(4,3) not null default 1 check (peso > 0 and peso <= 5),
  indispensable boolean not null default false,
  razon text,
  primary key (vacante_id, dimension)
);

-- Prioridad de cada tipo de evidencia. Estos pesos no reemplazan el algoritmo;
-- documentan qué es crítico en el rol para producir explicaciones auditables.
create table if not exists public.vacante_pesos_match (
  vacante_id uuid primary key references public.vacantes(id) on delete cascade,
  habilidades numeric(4,3) not null default 1 check (habilidades >= 0),
  intereses numeric(4,3) not null default 1 check (intereses >= 0),
  entorno numeric(4,3) not null default 1 check (entorno >= 0),
  valores numeric(4,3) not null default 1 check (valores >= 0),
  compensacion numeric(4,3) not null default 1 check (compensacion >= 0),
  trayectoria numeric(4,3) not null default 1 check (trayectoria >= 0),
  actualizado_at timestamptz not null default now(),
  check (habilidades + intereses + entorno + valores + compensacion + trayectoria > 0)
);

-- Lectura para el matching y la experiencia de candidato. La escritura se deja
-- a service_role o a las políticas de administración que ya tenga el proyecto.
alter table public.empresa_valores enable row level security;
alter table public.empresa_cultura_metricas enable row level security;
alter table public.vacante_prestaciones enable row level security;
alter table public.vacante_responsabilidades enable row level security;
alter table public.vacante_resultados_esperados enable row level security;
alter table public.vacante_metricas_match enable row level security;
alter table public.vacante_pesos_match enable row level security;

drop policy if exists "lectura publica empresa_valores" on public.empresa_valores;
create policy "lectura publica empresa_valores" on public.empresa_valores for select using (true);
drop policy if exists "lectura publica empresa_cultura_metricas" on public.empresa_cultura_metricas;
create policy "lectura publica empresa_cultura_metricas" on public.empresa_cultura_metricas for select using (true);
drop policy if exists "lectura publica vacante_prestaciones" on public.vacante_prestaciones;
create policy "lectura publica vacante_prestaciones" on public.vacante_prestaciones for select using (
  exists (select 1 from public.vacantes v where v.id = vacante_id and v.activa)
);
drop policy if exists "lectura publica vacante_responsabilidades" on public.vacante_responsabilidades;
create policy "lectura publica vacante_responsabilidades" on public.vacante_responsabilidades for select using (
  exists (select 1 from public.vacantes v where v.id = vacante_id and v.activa)
);
drop policy if exists "lectura publica vacante_resultados_esperados" on public.vacante_resultados_esperados;
create policy "lectura publica vacante_resultados_esperados" on public.vacante_resultados_esperados for select using (
  exists (select 1 from public.vacantes v where v.id = vacante_id and v.activa)
);
drop policy if exists "lectura publica vacante_metricas_match" on public.vacante_metricas_match;
create policy "lectura publica vacante_metricas_match" on public.vacante_metricas_match for select using (
  exists (select 1 from public.vacantes v where v.id = vacante_id and v.activa)
);
drop policy if exists "lectura publica vacante_pesos_match" on public.vacante_pesos_match;
create policy "lectura publica vacante_pesos_match" on public.vacante_pesos_match for select using (
  exists (select 1 from public.vacantes v where v.id = vacante_id and v.activa)
);

comment on table public.empresa_valores is 'Valores declarados y evidencia de cómo se viven.';
comment on table public.empresa_cultura_metricas is 'Métricas culturales comparables con condiciones_persona.';
comment on table public.vacante_metricas_match is 'Objetivos y pesos por dimensión para matching explicable.';
comment on table public.vacante_pesos_match is 'Pesos declarados para cada señal del matching de la vacante.';
