-- Add permissions for Ubicaciones module and assign to roles

-- Create permissions if they don't exist
INSERT INTO permissions (name, description, resource, action)
VALUES
  ('ubicaciones:read', 'Ver ubicaciones', 'ubicaciones', 'read'),
  ('ubicaciones:write', 'Crear/Editar ubicaciones', 'ubicaciones', 'write'),
  ('ubicaciones:delete', 'Eliminar ubicaciones', 'ubicaciones', 'delete')
ON CONFLICT (name) DO NOTHING;

-- Grant all ubicaciones permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin') AS role_id,
  p.id AS permission_id
FROM permissions p
WHERE p.name IN ('ubicaciones:read', 'ubicaciones:write', 'ubicaciones:delete')
ON CONFLICT DO NOTHING;

-- Grant read-only ubicaciones permission to operador role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'operador') AS role_id,
  p.id AS permission_id
FROM permissions p
WHERE p.name = 'ubicaciones:read'
ON CONFLICT DO NOTHING;
