-- Migración para crear usuario administrador genérico
-- Usuario: admin@suitcore.com
-- Contraseña: Suitcore123

-- Primero, asegurar que el rol admin existe
INSERT INTO public.roles (id, name, description)
VALUES (1, 'admin', 'Administrador con acceso completo al sistema')
ON CONFLICT (id) DO NOTHING;

-- Crear el usuario en auth.users
-- El hash corresponde a la contraseña 'Suitcore123' en formato bcrypt
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Generar un UUID fijo para el usuario admin genérico
  admin_user_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
  
  -- Insertar en auth.users si no existe
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    admin_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@suitcore.com',
    -- Hash bcrypt de 'Suitcore123': generado con bcrypt
    '$2b$10$T3GFyHy0bz5IjsVQJnLcCOVJ7u1F3Wv5P5uX7hXv/rFIApUtNZeLS',
    NOW(),
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Administrador SuitCore"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insertar en public.users si no existe
  INSERT INTO public.users (
    id,
    email,
    full_name,
    active,
    role_id,
    created_at,
    updated_at
  )
  VALUES (
    admin_user_id,
    'admin@suitcore.com',
    'Administrador SuitCore',
    true,
    1, -- rol admin
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- También mantener el hash en public.users para compatibilidad si existe la columna
  UPDATE public.users
  SET password_hash = '$2b$10$T3GFyHy0bz5IjsVQJnLcCOVJ7u1F3Wv5P5uX7hXv/rFIApUtNZeLS'
  WHERE id = admin_user_id 
  AND password_hash IS NULL;
  
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
