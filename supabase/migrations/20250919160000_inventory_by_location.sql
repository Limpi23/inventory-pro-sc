-- Inventory by Location: add location_id to stock_movements and create current_stock_by_location

-- 1) Add column to stock_movements (nullable, FK to locations)
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS location_id uuid NULL REFERENCES public.locations(id) ON DELETE SET NULL;

-- Index to speed up aggregations and filters
CREATE INDEX IF NOT EXISTS idx_stock_movements_location_id ON public.stock_movements(location_id);

-- 2) View: current stock by location (product, warehouse, location)
CREATE OR REPLACE VIEW public.current_stock_by_location AS
SELECT
  sm.product_id,
  p.name AS product_name,
  p.sku AS sku,
  sm.warehouse_id,
  w.name AS warehouse_name,
  sm.location_id,
  l.name AS location_name,
  COALESCE(SUM(sm.quantity), 0) AS current_quantity
FROM public.stock_movements sm
JOIN public.products p ON p.id = sm.product_id
JOIN public.warehouses w ON w.id = sm.warehouse_id
LEFT JOIN public.locations l ON l.id = sm.location_id
GROUP BY sm.product_id, p.name, p.sku, sm.warehouse_id, w.name, sm.location_id, l.name;

-- 3) Keep existing view for current_stock (by product + warehouse), summing across locations
CREATE OR REPLACE VIEW public.current_stock AS
SELECT
  product_id,
  product_name,
  sku,
  warehouse_id,
  warehouse_name,
  SUM(current_quantity) AS current_quantity
FROM public.current_stock_by_location
GROUP BY product_id, product_name, sku, warehouse_id, warehouse_name;

-- 4) RLS for the new view (views use underlying table policies; ensure select is allowed if needed)
-- If you have strict RLS on stock_movements, ensure SELECT is allowed for appropriate roles.
