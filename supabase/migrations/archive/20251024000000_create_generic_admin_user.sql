-- Migración para crear usuario administrador genérico
-- Usuario: admin@suitcore.com
-- Contraseña: Suitcore123
-- IMPORTANTE: Esta migración crea el usuario con password_hash en public.users
-- El hash se genera usando pgcrypto (crypt + gen_salt)

-- Habilitar extensión pgcrypto si no está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Primero, asegurar que el rol admin existe
INSERT INTO public.roles (id, name, description)
VALUES (1, 'admin', 'Administrador con acceso completo al sistema')
ON CONFLICT (id) DO NOTHING;

-- Crear el usuario admin SOLO en public.users (no en auth.users)
-- El sistema de login ya soporta autenticación con password_hash en public.users
DO $$
DECLARE
  admin_user_id uuid;
  password_hash_value TEXT;
BEGIN
  -- Generar hash de contraseña usando pgcrypto
  password_hash_value := crypt('Suitcore123', gen_salt('bf', 10));
  
  -- UUID fijo para el usuario admin genérico
  admin_user_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
  
  -- Insertar o actualizar en public.users
  INSERT INTO public.users (
    id,
    email,
    full_name,
    active,
    role_id,
    password_hash,
    created_at,
    updated_at
  )
  VALUES (
    admin_user_id,
    'admin@suitcore.com',
    'Administrador SuitCore',
    true,
    1, -- rol admin
    password_hash_value,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    active = EXCLUDED.active,
    role_id = EXCLUDED.role_id,
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();
  
  RAISE NOTICE 'Usuario administrador genérico creado en public.users: admin@suitcore.com / Suitcore123';
  
END $$;

-- Asignar el usuario admin al tenant predeterminado si la tabla tenants existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    UPDATE public.users 
    SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
    WHERE email = 'admin@suitcore.com' 
    AND tenant_id IS NULL;
  END IF;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Usuario administrador genérico creado: admin@suitcore.com / Suitcore123';
END $$;
