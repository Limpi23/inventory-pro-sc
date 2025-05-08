-- Actualizar el hash de contraseña del administrador
-- Este hash corresponde a 'password123' y ha sido generado con bcryptjs
UPDATE public.users
SET password_hash = NULL
WHERE email = 'admin@ejemplo.com';

-- Establece el password_hash a NULL para permitir que el sistema lo inicialice
-- en el primer inicio de sesión con la contraseña 'password123'
-- Esto asegura que el hash sea generado correctamente por el sistema 