-- Verificar que el fix funciona correctamente

-- 1. Ver el stock actual según la vista corregida
SELECT 'STOCK CORREGIDO (DH121038):' as info;
SELECT * FROM current_stock WHERE sku = 'DH121038';

-- 2. Comparar con el cálculo manual (debería dar el mismo resultado)
SELECT 'CÁLCULO MANUAL (DH121038):' as info;
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

-- 3. Ver todos los productos para verificar que todo funciona
SELECT 'STOCK DE TODOS LOS PRODUCTOS:' as info;
SELECT 
  product_name,
  sku,
  warehouse_name,
  current_quantity
FROM current_stock
ORDER BY product_name
LIMIT 10;
