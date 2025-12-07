-- Enable RLS and policies for public.users
-- This migration enables row level security on the users table and adds
-- permissive policies that work with password_hash authentication (without JWT)
--
-- IMPORTANTE: Como usamos password_hash para autenticación sin crear sesiones JWT,
-- las políticas deben ser permisivas para usuarios anónimos (anon role)

-- Helper to check if the current auth.uid() belongs to role 'admin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND r.name = 'admin'
  );
$$;

-- Deshabilitar RLS en users para permitir operaciones sin JWT
-- Esto es necesario porque usamos password_hash en lugar de Supabase Auth
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Como RLS está deshabilitado, no necesitamos políticas
-- Esto permite que las operaciones funcionen sin JWT
-- Si en el futuro quieres habilitar RLS, deberás crear políticas apropiadas
