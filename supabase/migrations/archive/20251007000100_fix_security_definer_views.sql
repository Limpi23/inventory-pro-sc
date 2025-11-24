-- Fix Security Definer Views - Use SECURITY INVOKER instead
-- This migration fixes the security warnings about views defined with SECURITY DEFINER

-- 1. Fix current_stock view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.current_stock
WITH (security_invoker = true)
AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  w.id AS warehouse_id,
  w.name AS warehouse_name,
  COALESCE(SUM(
    CASE
      WHEN mt.code LIKE 'IN%' THEN sm.quantity
      ELSE -sm.quantity
    END
  ), 0) AS current_quantity
FROM products p
CROSS JOIN warehouses w
LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.warehouse_id = w.id
LEFT JOIN movement_types mt ON mt.id = sm.movement_type_id
GROUP BY p.id, p.name, p.sku, w.id, w.name;

-- 2. Fix current_stock_by_location view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.current_stock_by_location
WITH (security_invoker = true)
AS
SELECT
  sm.product_id,
  p.name AS product_name,
  p.sku AS sku,
  sm.warehouse_id,
  w.name AS warehouse_name,
  sm.location_id,
  l.name AS location_name,
  COALESCE(SUM(
    CASE
      WHEN mt.code LIKE 'IN%' THEN sm.quantity
      ELSE -sm.quantity
    END
  ), 0) AS current_quantity
FROM public.stock_movements sm
JOIN public.products p ON p.id = sm.product_id
JOIN public.warehouses w ON w.id = sm.warehouse_id
LEFT JOIN public.locations l ON l.id = sm.location_id
JOIN public.movement_types mt ON mt.id = sm.movement_type_id
GROUP BY sm.product_id, p.name, p.sku, sm.warehouse_id, w.name, sm.location_id, l.name;

-- 3. Fix current_serials_in_stock view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.current_serials_in_stock
WITH (security_invoker = true)
AS
SELECT
  ps.id AS serial_id,
  ps.product_id,
  p.name AS product_name,
  p.sku,
  ps.serial_code,
  ps.vin,
  ps.engine_number,
  ps.year,
  ps.color,
  ps.attributes,
  ps.status,
  ps.warehouse_id,
  w.name AS warehouse_name,
  ps.location_id,
  l.name AS location_name,
  ps.acquired_at
FROM public.product_serials ps
JOIN public.products p ON p.id = ps.product_id
LEFT JOIN public.warehouses w ON w.id = ps.warehouse_id
LEFT JOIN public.locations l ON l.id = ps.location_id
WHERE ps.status = 'in_stock';

-- 4. Fix current_stock_serialized view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.current_stock_serialized
WITH (security_invoker = true)
AS
SELECT
  ps.product_id,
  p.name AS product_name,
  p.sku,
  ps.warehouse_id,
  w.name AS warehouse_name,
  ps.location_id,
  l.name AS location_name,
  COUNT(*)::numeric AS current_quantity
FROM public.product_serials ps
JOIN public.products p ON p.id = ps.product_id
LEFT JOIN public.warehouses w ON w.id = ps.warehouse_id
LEFT JOIN public.locations l ON l.id = ps.location_id
WHERE ps.status = 'in_stock'
GROUP BY ps.product_id, p.name, p.sku, ps.warehouse_id, w.name, ps.location_id, l.name;

-- Grant SELECT permissions on these views
GRANT SELECT ON public.current_stock TO authenticated;
GRANT SELECT ON public.current_stock_by_location TO authenticated;
GRANT SELECT ON public.current_serials_in_stock TO authenticated;
GRANT SELECT ON public.current_stock_serialized TO authenticated;

-- Add comments
COMMENT ON VIEW public.current_stock IS 'Vista de inventario actual (SECURITY INVOKER) - Se ejecuta con permisos del usuario que consulta';
COMMENT ON VIEW public.current_stock_by_location IS 'Vista de inventario por ubicación (SECURITY INVOKER) - Se ejecuta con permisos del usuario que consulta';
COMMENT ON VIEW public.current_serials_in_stock IS 'Vista de seriales en stock (SECURITY INVOKER) - Se ejecuta con permisos del usuario que consulta';
COMMENT ON VIEW public.current_stock_serialized IS 'Vista de stock serializado (SECURITY INVOKER) - Se ejecuta con permisos del usuario que consulta';
