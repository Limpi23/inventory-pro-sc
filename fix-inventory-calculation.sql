-- Script para verificar y corregir el problema de cálculo de inventario

-- 1. Verificar los tipos de movimiento
SELECT 'TIPOS DE MOVIMIENTO:' as info;
SELECT id, code, description 
FROM movement_types 
WHERE code IN ('OUT_SALE', 'IN_PURCHASE')
ORDER BY id;

-- 2. Verificar el último movimiento problemático (DH121038)
SELECT 'ÚLTIMO MOVIMIENTO DH121038:' as info;
SELECT 
  sm.id,
  sm.created_at,
  sm.quantity as qty_stored,
  mt.code as type_code,
  mt.description,
  sm.reference,
  CASE 
    WHEN mt.code LIKE 'IN%' THEN sm.quantity
    ELSE -sm.quantity
  END as impact_on_stock
FROM stock_movements sm
JOIN movement_types mt ON mt.id = sm.movement_type_id
JOIN products p ON p.id = sm.product_id
WHERE p.sku = 'DH121038'
ORDER BY sm.created_at DESC
LIMIT 5;

-- 3. Verificar si hay movimientos duplicados por related_id
SELECT 'MOVIMIENTOS DUPLICADOS POR RELATED_ID:' as info;
SELECT 
  related_id,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as movement_ids
FROM stock_movements
WHERE related_id IS NOT NULL
GROUP BY related_id
HAVING COUNT(*) > 1;

-- 4. Recalcular el stock manualmente para verificar
SELECT 'CÁLCULO MANUAL DE STOCK DH121038:' as info;
SELECT 
  SUM(
    CASE 
      WHEN mt.code LIKE 'IN%' THEN sm.quantity
      ELSE -sm.quantity
    END
  ) as calculated_stock
FROM stock_movements sm
JOIN movement_types mt ON mt.id = sm.movement_type_id
JOIN products p ON p.id = sm.product_id
WHERE p.sku = 'DH121038';

-- 5. Comparar con lo que muestra la vista
SELECT 'STOCK SEGÚN VISTA:' as info;
SELECT * FROM current_stock WHERE sku = 'DH121038';

-- 6. Ver cálculo detallado de current_stock_by_location
SELECT 'STOCK POR UBICACIÓN (DETALLADO):' as info;
SELECT 
  product_id,
  product_name,
  sku,
  warehouse_id,
  warehouse_name,
  location_id,
  location_name,
  current_quantity
FROM current_stock_by_location
WHERE sku = 'DH121038';

-- 7. Ver TODOS los movimientos (sin límite) para detectar duplicados
SELECT 'TODOS LOS MOVIMIENTOS DH121038:' as info;
SELECT 
  sm.id,
  sm.created_at,
  sm.quantity,
  sm.location_id,
  mt.code,
  sm.reference,
  sm.related_id,
  CASE 
    WHEN mt.code LIKE 'IN%' THEN sm.quantity
    ELSE -sm.quantity
  END as impact
FROM stock_movements sm
JOIN movement_types mt ON mt.id = sm.movement_type_id
JOIN products p ON p.id = sm.product_id
WHERE p.sku = 'DH121038'
ORDER BY sm.created_at DESC;

-- 8. Contar movimientos con y sin location_id
SELECT 'CONTEO POR LOCATION_ID:' as info;
SELECT 
  CASE 
    WHEN sm.location_id IS NULL THEN 'SIN UBICACIÓN'
    ELSE 'CON UBICACIÓN'
  END as tiene_ubicacion,
  COUNT(*) as cantidad,
  SUM(CASE WHEN mt.code LIKE 'IN%' THEN sm.quantity ELSE -sm.quantity END) as impacto_total
FROM stock_movements sm
JOIN movement_types mt ON mt.id = sm.movement_type_id
JOIN products p ON p.id = sm.product_id
WHERE p.sku = 'DH121038'
GROUP BY CASE WHEN sm.location_id IS NULL THEN 'SIN UBICACIÓN' ELSE 'CON UBICACIÓN' END;
