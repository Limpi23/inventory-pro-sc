-- Consultas para verificar el count del inventario

-- 1. Count total de registros en current_stock (lo que probablemente está mostrando 1000)
SELECT COUNT(*) as total_current_stock_records
FROM current_stock;

-- 2. Count de productos únicos con stock
SELECT COUNT(DISTINCT sku) as unique_products_with_stock
FROM current_stock 
WHERE current_quantity > 0;

-- 3. Count de todos los productos únicos (incluye los con stock 0)
SELECT COUNT(DISTINCT sku) as all_unique_products
FROM current_stock;

-- 4. Count por almacén
SELECT 
    warehouse_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN current_quantity > 0 THEN 1 END) as records_with_stock
FROM current_stock
GROUP BY warehouse_name
ORDER BY warehouse_name;

-- 5. Verificar si hay duplicados por producto-almacén
SELECT 
    sku,
    warehouse_name,
    COUNT(*) as record_count
FROM current_stock
GROUP BY sku, warehouse_name
HAVING COUNT(*) > 1
ORDER BY record_count DESC;

-- 6. Count total de productos en la tabla products
SELECT COUNT(*) as total_products_in_db
FROM products;

-- 7. Count total de almacenes
SELECT COUNT(*) as total_warehouses
FROM warehouses;

-- 8. Producto cruzado teórico (productos × almacenes)
SELECT 
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM warehouses) as total_warehouses,
    (SELECT COUNT(*) FROM products) * (SELECT COUNT(*) FROM warehouses) as theoretical_cross_join
;

-- 9. Análisis de la distribución de cantidades
SELECT 
    CASE 
        WHEN current_quantity = 0 THEN 'Sin stock'
        WHEN current_quantity > 0 AND current_quantity <= 10 THEN '1-10 unidades'
        WHEN current_quantity > 10 AND current_quantity <= 100 THEN '11-100 unidades'
        WHEN current_quantity > 100 THEN 'Más de 100 unidades'
    END as stock_range,
    COUNT(*) as count
FROM current_stock
GROUP BY 
    CASE 
        WHEN current_quantity = 0 THEN 'Sin stock'
        WHEN current_quantity > 0 AND current_quantity <= 10 THEN '1-10 unidades'
        WHEN current_quantity > 10 AND current_quantity <= 100 THEN '11-100 unidades'
        WHEN current_quantity > 100 THEN 'Más de 100 unidades'
    END
ORDER BY count DESC;

-- 10. Los primeros 10 registros para revisar la estructura
SELECT *
FROM current_stock
LIMIT 10;