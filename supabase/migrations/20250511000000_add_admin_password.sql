-- Migración para establecer contraseña para el usuario administrador
-- Hash bcrypt de 'Suitcore123'
UPDATE public.users
SET password_hash = '$2b$10$T3GFyHy0bz5IjsVQJnLcCOVJ7u1F3Wv5P5uX7hXv/rFIApUtNZeLS'
WHERE email = 'admin@suitcore.com'
AND password_hash IS NULL; 