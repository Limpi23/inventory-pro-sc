-- Modificar a un archivo ALTER en lugar de CREATE

-- Añadir campos adicionales a products
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS min_stock NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_stock NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD CONSTRAINT products_status_check CHECK (status IN ('active', 'inactive', 'discontinued'));

-- Añadir índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Crear el trigger si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_products_updated_at'
  ) THEN
    CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
  END IF;
END
$$;