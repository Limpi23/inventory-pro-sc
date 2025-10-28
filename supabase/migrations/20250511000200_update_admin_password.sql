-- Actualizar el hash de contraseña del administrador
-- Este hash corresponde a 'Suitcore123' y ha sido generado con bcryptjs
UPDATE public.users
SET password_hash = '$2b$10$T3GFyHy0bz5IjsVQJnLcCOVJ7u1F3Wv5P5uX7hXv/rFIApUtNZeLS'
WHERE email = 'admin@suitcore.com'; 