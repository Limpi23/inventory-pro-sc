-- Fix: Corregir el cálculo de inventario en current_stock y current_stock_by_location
-- Fecha: 2025-10-07
-- Problema: La vista current_stock muestra valores incorrectos (duplicados)

-- 1) Revertir a la lógica original de current_stock que funcionaba correctamente
-- Esta vista calcula el stock actual por producto y almacén sin considerar ubicaciones
CREATE OR REPLACE VIEW public.current_stock AS
SELECT 
  p.id as product_id, 
  p.name as product_name,
  p.sku,
  w.id as warehouse_id,
  w.name as warehouse_name,
  COALESCE(SUM(
    CASE 
      WHEN mt.code LIKE 'IN%' THEN sm.quantity 
      ELSE -sm.quantity 
    END
  ), 0) as current_quantity
FROM 
  products p
CROSS JOIN 
  warehouses w
LEFT JOIN 
  stock_movements sm ON p.id = sm.product_id AND w.id = sm.warehouse_id
LEFT JOIN 
  movement_types mt ON sm.movement_type_id = mt.id
GROUP BY 
  p.id, p.name, p.sku, w.id, w.name;

-- 2) Mantener current_stock_by_location para consultas detalladas por ubicación
-- Esta vista sigue funcionando correctamente para ver stock por ubicación específica
CREATE OR REPLACE VIEW public.current_stock_by_location AS
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

-- Comentario explicativo
COMMENT ON VIEW public.current_stock IS 
'Vista que calcula el stock actual por producto y almacén. Usa la lógica original con CROSS JOIN para incluir productos sin movimientos con cantidad 0.';

COMMENT ON VIEW public.current_stock_by_location IS 
'Vista detallada que muestra el stock por producto, almacén y ubicación. Solo muestra combinaciones que tienen movimientos registrados.';
