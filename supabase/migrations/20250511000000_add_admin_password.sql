-- Migración para establecer contraseña para el usuario administrador
-- Hash bcrypt de 'password123'
UPDATE public.users
SET password_hash = '$2a$10$gG8sKJ5EVuX8xkf9D5aG8OO.7jQWDSyFgtDZNnGNOAAyCpP9QJh3G'
WHERE email = 'admin@ejemplo.com'
AND password_hash IS NULL; 