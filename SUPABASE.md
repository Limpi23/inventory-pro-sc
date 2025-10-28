# Configuración de Supabase para Inventario Pro - SC

Este documento explica cómo configurar Supabase para su uso con Inventario Pro - SC.

## 🔐 Usuario Administrador Predeterminado

Al ejecutar las migraciones en una nueva base de datos Supabase, el sistema creará automáticamente un usuario administrador genérico:

- **Email**: `admin@suitcore.com`
- **Contraseña**: `Suitcore123`

**⚠️ Importante**: Por razones de seguridad, debes cambiar estas credenciales inmediatamente después del primer inicio de sesión.

## Creación del proyecto en Supabase

1. Crea una cuenta en [Supabase](https://supabase.com) si aún no la tienes.
2. Crea un nuevo proyecto desde el panel de control.
3. Selecciona una región cercana a tus usuarios para minimizar la latencia.
4. Anota la URL del proyecto y la clave anónima (anon key), que necesitarás para la configuración.

## Configuración de la base de datos

Una vez que hayas creado el proyecto, sigue estos pasos para configurar la base de datos:

### Opción 1: Usando migraciones de Supabase (Recomendado)

1. Instala la CLI de Supabase si aún no la tienes:
```bash
npm install -g supabase
```

2. Vincula tu proyecto local con tu proyecto de Supabase:
```bash
supabase link --project-ref tu-project-ref
```

3. Ejecuta las migraciones:
```bash
supabase db push
```

Esto creará automáticamente todas las tablas, funciones y el **usuario administrador genérico** (`admin@suitcore.com / Suitcore123`).

### Opción 2: Manual desde el SQL Editor

1. Ve a la sección "SQL Editor" en el panel de control de Supabase.
2. Ejecuta los archivos de migración en orden desde la carpeta `supabase/migrations/`.
3. Asegúrate de ejecutar la migración `20251024000000_create_generic_admin_user.sql` para crear el usuario administrador.

El esquema incluye:
- Tablas para productos, categorías, proveedores, clientes, almacenes
- Tablas para órdenes de compra y venta
- Tablas para movimientos de inventario y conteos de inventario
- Una vista para calcular el stock actual por producto y almacén

## Configuración del proyecto local

1. Crea un archivo `.env.local` en la raíz del proyecto con la siguiente estructura:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-supabase
```

2. Reemplaza `tu-proyecto.supabase.co` con la URL de tu proyecto en Supabase y `tu-clave-anon-supabase` con la clave anónima de tu proyecto.

## Autenticación (opcional)

Si deseas implementar autenticación en tu aplicación, puedes configurarla desde el panel de control de Supabase:

1. Ve a la sección "Authentication" en el panel de control.
2. Habilita los proveedores de autenticación que desees (email, social login, etc.).
3. Configura las opciones de autorización según tus necesidades.

Para usar la autenticación en la aplicación, consulta la [documentación oficial de Supabase](https://supabase.com/docs/guides/auth).

## Funciones y triggers (opcional)

Para funcionalidades avanzadas como:
- Actualización automática de stock cuando se registran movimientos
- Cálculo automático de subtotales y totales
- Validaciones de negocio

Puedes crear funciones y triggers adicionales en la base de datos. Aquí hay algunos ejemplos que podrías implementar:

```sql
-- Función para actualizar el campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el campo updated_at en productos
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

## Acceso a la API

Supabase genera automáticamente una API RESTful para todas tus tablas. Puedes acceder a ella utilizando el cliente de Supabase que ya está configurado en el archivo `src/lib/supabase.ts`.

## Seguridad

Para asegurar tus datos, considera implementar Row Level Security (RLS) en las tablas. Por ejemplo:

```sql
-- Habilitar RLS en la tabla de productos
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir a usuarios autenticados ver todos los productos
CREATE POLICY "Permitir lectura a usuarios autenticados" ON products
FOR SELECT
TO authenticated
USING (true);

-- Crear política para permitir solo a administradores crear/editar/eliminar productos
CREATE POLICY "Permitir escritura solo a administradores" ON products
FOR ALL
TO authenticated
USING (auth.uid() IN (SELECT user_id FROM administrators));
```

## Recursos adicionales

- [Documentación oficial de Supabase](https://supabase.com/docs)
- [Guía de Supabase con React](https://supabase.com/docs/guides/with-react)
- [API Reference](https://supabase.com/docs/reference) 