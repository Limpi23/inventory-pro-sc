-- Migración: Corrige la función handle_new_user para usar public.roles y evitar errores de visibilidad de esquema
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  operador_id integer;
  nombre_completo text;
BEGIN
  -- Obtener el id del rol operador
  SELECT id INTO operador_id FROM public.roles WHERE name = 'operador';
  IF operador_id IS NULL THEN
    RAISE EXCEPTION 'No existe el rol operador';
  END IF;

  -- Obtener el nombre completo o usar el email
  nombre_completo := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Sin Nombre');

  INSERT INTO public.users (id, email, full_name, active, role_id, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    nombre_completo,
    true,
    operador_id,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 