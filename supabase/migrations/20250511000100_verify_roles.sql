-- Verificar que exista la tabla de roles y crear un rol admin si no existe
DO $$
DECLARE
  admin_role_exists BOOLEAN;
BEGIN
  -- Verificar si ya existe un rol admin (id=1)
  SELECT EXISTS (
    SELECT 1 FROM public.roles WHERE id = 1
  ) INTO admin_role_exists;
  
  -- Si no existe, crear uno
  IF NOT admin_role_exists THEN
    INSERT INTO public.roles (
      id, 
      name,
      description,
      created_at
    ) VALUES (
      1,
      'admin',
      'Administrador del sistema',
      now()
    );
    
    RAISE NOTICE 'Rol de administrador creado';
  END IF;
END $$; 