-- Eliminar la restricción de clave foránea que vincula users.id con auth.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Asegurarse de que el id sea la clave primaria
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE public.users ADD PRIMARY KEY (id);

-- Verificar y corregir permisos en la tabla users
GRANT ALL ON public.users TO postgres, anon, authenticated, service_role; 