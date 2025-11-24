-- Modificar a un archivo ALTER en lugar de CREATE
-- Suponiendo que quieres añadir campos que no están en el esquema inicial

-- Añadir campos adicionales a categories
ALTER TABLE categories 
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Añadir índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Actualizar la función trigger si es necesario
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
  END IF;
END
$$;