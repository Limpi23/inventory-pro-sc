# Configuración de Supabase para Inventario Pro - SC

Este documento explica cómo configurar Supabase para su uso con Inventario Pro - SC.

## Creación del proyecto en Supabase

1. Crea una cuenta en [Supabase](https://supabase.com) si aún no la tienes.
2. Crea un nuevo proyecto desde el panel de control.
3. Selecciona una región cercana a tus usuarios para minimizar la latencia.
4. Anota la URL del proyecto y la clave anónima (anon key), que necesitarás para la configuración.

## Configuración de la base de datos

Una vez que hayas creado el proyecto, sigue estos pasos para configurar la base de datos:

1. Ve a la sección "SQL Editor" en el panel de control de Supabase.
2. Crea una nueva consulta y copia todo el contenido del archivo `sql/schema.sql` proporcionado en este proyecto.
3. Ejecuta el script SQL para crear todas las tablas necesarias.

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