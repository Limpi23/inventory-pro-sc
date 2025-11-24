-- Migración para agregar soporte de autenticación independiente
-- Agregar campo para almacenar el hash de la contraseña
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Crear índice para búsquedas por email (mejora el rendimiento de login)
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- Asegurar que el rol admin existe antes de crear el usuario admin
INSERT INTO public.roles (id, name, description)
VALUES (1, 'admin', 'Administrador con acceso completo al sistema')
ON CONFLICT (id) DO NOTHING; 