# Guía de Migraciones para Inventario Pro - SC

Esta guía explica cómo manejar cambios en el esquema de la base de datos utilizando el sistema de migraciones de Supabase.

## Estructura

Las migraciones se encuentran en la carpeta `supabase/migrations`. Cada migración está en su propia carpeta con un formato de nombre `{timestamp}_{descripción}` que contiene un archivo `migration.sql`.

## Comandos disponibles

Hemos configurado los siguientes comandos en el `package.json`:

- `npm run db:migration:new -- nombre_descriptivo` - Crea una nueva migración
- `npm run db:migration:apply` - Aplica todas las migraciones pendientes a la base de datos LOCAL (requiere `supabase start` corriendo)
- `npm run db:link` - Enlaza el repo al proyecto remoto de Supabase (una sola vez por máquina)
- `npm run db:migration:apply:remote` - Aplica migraciones directamente al proyecto REMOTO (usa `supabase db push`)

## Proceso para añadir un nuevo campo o tabla

1. **Crear una nueva migración**:

   ```bash
   npm run db:migration:new -- add_price_to_products
   ```

   Esto creará una nueva carpeta en `supabase/migrations` con un timestamp único.

2. **Editar el archivo de migración**:

   Abrir el archivo `migration.sql` dentro de la carpeta recién creada y añadir los comandos SQL necesarios:

   ```sql
   -- Añadir campo precio a la tabla de productos
   ALTER TABLE products ADD COLUMN price NUMERIC(10, 2);
   ```

3. **Aplicar la migración (elige una opción)**:

   Opción A - Local (desarrollo rápido, requiere stack local):
   ```bash
   supabase start           # levanta contenedores locales (db en 127.0.0.1:54322)
   npm run db:migration:apply
   ```

   Opción B - Remoto (aplica en tu proyecto de Supabase Cloud):
   ```bash
   npm run db:link                # solo la primera vez en esta máquina
   npm run db:migration:apply:remote
   ```

   Nota: Si ves el error `dial tcp 127.0.0.1:54322: connect: connection refused`, significa que estás usando el flujo local (`supabase migration up`) sin tener el stack local levantado. Usa Opción A con `supabase start` o usa Opción B para aplicar directo al remoto.

## Consideraciones importantes

- Nunca modificar migraciones que ya han sido aplicadas
- Cada cambio en el esquema debe ser una nueva migración
- Las migraciones se ejecutan en orden cronológico
- Asegúrate de probar las migraciones en un entorno de desarrollo antes de aplicarlas en producción

### Local vs Remoto en Supabase CLI

- `supabase migration up` aplica migraciones al entorno LOCAL definido en `supabase/config.toml` (db en puerto 54322). Úsalo cuando desarrollas con `supabase start`.
- `supabase db push` compara tu estado local de archivos con el proyecto REMOTO y aplica los cambios allá. Requiere haber hecho `supabase link` al proyecto remoto y tener sesión iniciada (`supabase login`).

### Nota sobre carpetas "legacy"

En algunos repositorios puede existir una carpeta de migraciones antiguas (por ejemplo `supabase/migrations-legacy/` o `legacy/`). Estas carpetas no forman parte del flujo estándar de Supabase y son IGNORADAS por `supabase db push`. Mantén todas las migraciones activas únicamente dentro de `supabase/migrations/` con el formato `{timestamp}_{descripcion}.sql`.

Si necesitas conservar SQL históricos a modo de referencia, puedes dejarlos en una carpeta `legacy`, pero recuerda que:

- `supabase migration up` y `supabase db push` no ejecutarán esos archivos
- No edites migraciones ya aplicadas; crea nuevas en `supabase/migrations/`

## Rollback de migraciones

Para hacer rollback de una migración, se debe crear una nueva migración que revierta los cambios:

```sql
-- Ejemplo de migración para revertir la adición del campo price
ALTER TABLE products DROP COLUMN price;
```

## Ejemplo completo

1. Crear migración:
   ```bash
   npm run db:migration:new -- add_inventory_fields
   ```

2. Editar el archivo `migration.sql` generado:
   ```sql
   -- Añadir campos de control de inventario
   ALTER TABLE products ADD COLUMN min_stock NUMERIC(10, 2) DEFAULT 0;
   ALTER TABLE products ADD COLUMN max_stock NUMERIC(10, 2);
   ```

3. Aplicar la migración:
   ```bash
   npm run db:migration:apply
   ```

4. Verificar en Supabase Studio que los cambios se hayan aplicado correctamente. 