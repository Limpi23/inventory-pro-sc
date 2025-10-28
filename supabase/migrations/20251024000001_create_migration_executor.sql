-- Función administrativa para ejecutar migraciones SQL desde la aplicación
-- IMPORTANTE: Esta función solo debe existir durante el setup inicial
-- y debe ser eliminada o restringida después de la configuración

CREATE OR REPLACE FUNCTION public.execute_migration(migration_sql TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Ejecutar el SQL proporcionado
  EXECUTE migration_sql;
  
  result_data := jsonb_build_object(
    'success', true,
    'message', 'Migración ejecutada correctamente'
  );
  
  RETURN result_data;
EXCEPTION
  WHEN OTHERS THEN
    result_data := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result_data;
END;
$$;

-- Dar permisos de ejecución a usuarios autenticados y anónimos
-- (necesario para el setup inicial cuando no hay usuarios)
GRANT EXECUTE ON FUNCTION public.execute_migration(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_migration(TEXT) TO authenticated;

COMMENT ON FUNCTION public.execute_migration IS 
'Función temporal para ejecutar migraciones durante el setup inicial. 
DEBE SER ELIMINADA O RESTRINGIDA después de la configuración inicial.';
