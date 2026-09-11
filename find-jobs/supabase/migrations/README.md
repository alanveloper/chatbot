# Migraciones

El esquema de Enfoca **ya está aplicado** en el proyecto de Supabase
`xhjcweizspfcpjocgtcl`. Estas son las migraciones que corrieron, en orden:

| Versión (prefijo del archivo) | Nombre | SQL |
| --- | --- | --- |
| 20260910190525 | `0001_init_schema` | 12 598 B · obsoleta, la tiró `0002` |
| 20260910192612 | `0002_enfoca_reset` | 20 832 B · 32 tablas, enums, índices HNSW |
| 20260910192651 | `0003_enfoca_triggers_rls` | 5 539 B · triggers, RLS y políticas |
| 20260910192932 | `0004_enfoca_motor_match` | 13 404 B · funciones de encaje y `buscar_vacantes` |
| 20260910193231 | `0005_enfoca_semilla` | 17 775 B · catálogos, 6 empresas y 6 vacantes de ejemplo |
| 20260910195812 | `0006_enfoca_endurecer` | 657 B · revoca `EXECUTE` de las funciones `SECURITY DEFINER` |

En este repo sólo está el archivo de `0006`. Las de `0002` a `0005` se
aplicaron directamente al proyecto y **no se transcribieron a mano a
propósito**: copiar 58 KB de SQL letra por letra es la forma más fácil de
introducir una divergencia silenciosa entre el repo y la base real.

## Cómo materializarlas en el repo (elige una)

### Opción A — desde el SQL Editor, sin Docker

El propio Postgres guarda el texto de cada migración. Corre esto por cada
nombre de la tabla de arriba:

```sql
select array_to_string(statements, E';\n') as sql
from supabase_migrations.schema_migrations
where name = '0002_enfoca_reset';
```

Guarda el resultado en `supabase/migrations/20260910192612_0002_enfoca_reset.sql`
y repite con `0003`, `0004` y `0005`.

**Respeta el prefijo de versión de la tabla.** Si lo haces así, un
`supabase db push` posterior ve esas versiones como ya aplicadas y no las
vuelve a correr. Si inventas otro prefijo, el CLI intentará ejecutarlas de
nuevo y `0002` empieza con `drop`: te llevas el esquema y los datos.

### Opción B — con el CLI (requiere Docker)

```bash
supabase link --project-ref xhjcweizspfcpjocgtcl
supabase db pull
```

Esto genera **una sola** migración con el esquema completo, no las cinco
originales. Sirve igual para levantar el proyecto desde cero.

## Notas

- `0005` es idempotente: se puede volver a correr sin duplicar catálogos.
- Las vacantes sembradas traen `fuente = 'ejemplo'`. Cámbialas por vacantes
  reales antes de mostrarle resultados a alguien.
- Después de cargar vacantes nuevas hay que llenar sus embeddings con la
  función `indexar` (ver `docs/arquitectura.md`).
