-- Migración: Crear función select_one para health check
CREATE OR REPLACE FUNCTION public.select_one()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT 1;
$$; 