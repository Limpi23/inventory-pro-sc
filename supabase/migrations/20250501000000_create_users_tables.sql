-- Esquema para gestión de usuarios y roles para Inventario Pro - SC

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Poblar la tabla de roles con valores predefinidos
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrador con acceso completo al sistema'),
  ('operador', 'Operador con acceso limitado a funciones específicas')
ON CONFLICT (name) DO NOTHING;

-- Tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Poblar la tabla de permisos con valores predefinidos
INSERT INTO permissions (name, description, resource, action) VALUES
  ('productos:read', 'Ver productos', 'productos', 'read'),
  ('productos:write', 'Crear/Editar productos', 'productos', 'write'),
  ('productos:delete', 'Eliminar productos', 'productos', 'delete'),
  
  ('categorias:read', 'Ver categorías', 'categorias', 'read'),
  ('categorias:write', 'Crear/Editar categorías', 'categorias', 'write'),
  ('categorias:delete', 'Eliminar categorías', 'categorias', 'delete'),
  
  ('almacenes:read', 'Ver almacenes', 'almacenes', 'read'),
  ('almacenes:write', 'Crear/Editar almacenes', 'almacenes', 'write'),
  ('almacenes:delete', 'Eliminar almacenes', 'almacenes', 'delete'),
  
  ('proveedores:read', 'Ver proveedores', 'proveedores', 'read'),
  ('proveedores:write', 'Crear/Editar proveedores', 'proveedores', 'write'),
  ('proveedores:delete', 'Eliminar proveedores', 'proveedores', 'delete'),
  
  ('ordenes-compra:read', 'Ver órdenes de compra', 'ordenes-compra', 'read'),
  ('ordenes-compra:write', 'Crear/Editar órdenes de compra', 'ordenes-compra', 'write'),
  ('ordenes-compra:delete', 'Eliminar órdenes de compra', 'ordenes-compra', 'delete'),
  ('ordenes-compra:receive', 'Recibir órdenes de compra', 'ordenes-compra', 'receive'),
  
  ('inventario:read', 'Ver inventario', 'inventario', 'read'),
  ('inventario:adjust', 'Ajustar inventario', 'inventario', 'adjust'),
  
  ('ventas:read', 'Ver ventas', 'ventas', 'read'),
  ('ventas:write', 'Crear/Editar ventas', 'ventas', 'write'),
  ('ventas:delete', 'Eliminar ventas', 'ventas', 'delete'),
  
  ('reportes:read', 'Ver reportes', 'reportes', 'read'),
  ('reportes:export', 'Exportar reportes', 'reportes', 'export'),
  
  ('users:read', 'Ver usuarios', 'users', 'read'),
  ('users:write', 'Crear/Editar usuarios', 'users', 'write'),
  ('users:delete', 'Eliminar usuarios', 'users', 'delete')
ON CONFLICT (name) DO NOTHING;

-- Asignar permisos a roles (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- Asignar todos los permisos al rol de administrador
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions
ON CONFLICT DO NOTHING;

-- Asignar permisos de solo lectura al rol de operador
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'operador'),
  id
FROM permissions 
WHERE name LIKE '%:read' OR name IN ('inventario:adjust', 'reportes:export')
ON CONFLICT DO NOTHING;

-- Tabla de usuarios (extendiendo la tabla auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Función para crear un usuario automáticamente después del registro
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role_id)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    (SELECT id FROM roles WHERE name = 'operador') -- Rol por defecto
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para insertar un nuevo usuario cuando se registra en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  
-- Vista para obtener usuarios con sus roles
CREATE OR REPLACE VIEW user_roles AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.active,
  r.id as role_id,
  r.name as role_name,
  r.description as role_description,
  u.last_login,
  u.created_at
FROM 
  users u
JOIN 
  roles r ON u.role_id = r.id;

-- Función para obtener permisos de un usuario
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS TABLE (
  permission_name TEXT,
  resource TEXT,
  action TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    p.resource,
    p.action
  FROM 
    users u
  JOIN 
    roles r ON u.role_id = r.id
  JOIN 
    role_permissions rp ON r.id = rp.role_id
  JOIN 
    permissions p ON rp.permission_id = p.id
  WHERE 
    u.id = user_id;
END;
$$ LANGUAGE plpgsql; 