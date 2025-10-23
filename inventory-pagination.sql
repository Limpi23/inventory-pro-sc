-- Consulta optimizada para paginación del inventario
-- Usar esta consulta para implementar paginación del lado del servidor

-- 1. Count total (para calcular páginas)
SELECT COUNT(*) as total_count
FROM current_stock
WHERE 
    ($1::text IS NULL OR product_name ILIKE '%' || $1 || '%' OR sku ILIKE '%' || $1 || '%')
    AND ($2::uuid IS NULL OR product_id = $2)
    AND ($3::uuid IS NULL OR warehouse_id = $3);

-- 2. Datos paginados (reemplazar $4 y $5 con offset y limit)
SELECT 
    product_id,
    product_name,
    sku,
    warehouse_id,
    warehouse_name,
    current_quantity
FROM current_stock
WHERE 
    ($1::text IS NULL OR product_name ILIKE '%' || $1 || '%' OR sku ILIKE '%' || $1 || '%')
    AND ($2::uuid IS NULL OR product_id = $2)
    AND ($3::uuid IS NULL OR warehouse_id = $3)
ORDER BY product_name
LIMIT $4 OFFSET $5;

-- Ejemplo de uso:
-- Para página 1, 10 items por página:
-- $1 = término de búsqueda (null si no hay búsqueda)
-- $2 = product_id seleccionado (null si no hay filtro)
-- $3 = warehouse_id seleccionado (null si no hay filtro)
-- $4 = 10 (items por página)
-- $5 = 0 (offset para página 1)