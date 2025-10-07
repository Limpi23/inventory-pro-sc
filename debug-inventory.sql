-- Script de diagnóstico para el problema de inventario

-- 1. Ver los tipos de movimiento
SELECT id, code, description 
FROM movement_types 
ORDER BY id;

-- 2. Ver los últimos movimientos del producto DH121038
SELECT 
  sm.id,
  sm.created_at,
  sm.movement_date,
  sm.quantity,
  mt.code as movement_type_code,
  mt.description as movement_type_desc,
  sm.reference,
  sm.notes,
  CASE 
    WHEN mt.code LIKE 'IN%' THEN sm.quantity
    ELSE -sm.quantity
  END as calculated_impact
FROM stock_movements sm
JOIN movement_types mt ON mt.id = sm.movement_type_id
JOIN products p ON p.id = sm.product_id
WHERE p.sku = 'DH121038'
ORDER BY sm.created_at DESC
LIMIT 10;

-- 3. Ver el stock calculado para este producto
SELECT * FROM current_stock 
WHERE sku = 'DH121038';

-- 4. Ver el stock por ubicación
SELECT * FROM current_stock_by_location
WHERE sku = 'DH121038';
