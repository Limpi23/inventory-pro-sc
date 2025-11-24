-- Función para obtener los productos más vendidos (Top Products)
-- Utilizada en el Dashboard para optimizar el rendimiento
-- Nota: Esta función difiere de get_top_selling_products ya que se basa en facturas (ventas reales)
-- en lugar de movimientos de salida generales.
CREATE OR REPLACE FUNCTION get_top_products(limit_count int)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  sku text,
  total_quantity numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    SUM(ii.quantity) as total_quantity
  FROM invoice_items ii
  JOIN products p ON ii.product_id = p.id
  JOIN invoices i ON ii.invoice_id = i.id
  WHERE i.status IN ('emitida', 'pagada')
  GROUP BY p.id, p.name, p.sku
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$;

-- Índices para optimizar la búsqueda y paginación de productos
-- Nota: Para usar gin_trgm_ops necesitas habilitar la extensión pg_trgm.
-- Si no está habilitada, usa btree normal para búsquedas exactas o prefijos.
-- Aquí usamos índices estándar para compatibilidad.

CREATE INDEX IF NOT EXISTS idx_products_name_search ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

-- Índices para optimizar las consultas del Dashboard (Movimientos y Stock)
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements (movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date_status ON invoices (invoice_date, status);
