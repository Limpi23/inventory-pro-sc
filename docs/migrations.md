# Guía de Migraciones para Inventario Pro - SC

Esta guía explica cómo manejar cambios en el esquema de la base de datos utilizando el sistema de migraciones de Supabase.

## Estructura

Las migraciones se encuentran en la carpeta `supabase/migrations`. Cada migración está en su propia carpeta con un formato de nombre `{timestamp}_{descripción}` que contiene un archivo `migration.sql`.

## Comandos disponibles

Hemos configurado los siguientes comandos en el `package.json`:

- `npm run db:migration:new -- nombre_descriptivo` - Crea una nueva migración
- `npm run db:migration:apply` - Aplica todas las migraciones pendientes a la base de datos

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

3. **Aplicar la migración**:

   ```bash
   npm run db:migration:apply
   ```

## Consideraciones importantes

- Nunca modificar migraciones que ya han sido aplicadas
- Cada cambio en el esquema debe ser una nueva migración
- Las migraciones se ejecutan en orden cronológico
- Asegúrate de probar las migraciones en un entorno de desarrollo antes de aplicarlas en producción

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