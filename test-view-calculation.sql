-- Test: Reproducir exactamente lo que hace la vista current_stock_by_location

SELECT 
  sm.product_id,
  p.name AS product_name,
  p.sku AS sku,
  sm.warehouse_id,
  w.name AS warehouse_name,
  sm.location_id,
  l.name AS location_name,
  -- Ver cada componente del cálculo
  STRING_AGG(
    CASE
      WHEN mt.code LIKE 'IN%' THEN CONCAT('+', sm.quantity::text)
      ELSE CONCAT('-', sm.quantity::text)
    END, 
    ', ' ORDER BY sm.created_at
  ) as operations,
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
WHERE p.sku = 'DH121038'
GROUP BY sm.product_id, p.name, p.sku, sm.warehouse_id, w.name, sm.location_id, l.name;
