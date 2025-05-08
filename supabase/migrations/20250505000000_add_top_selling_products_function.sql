-- Crear función RPC para obtener los productos más vendidos
CREATE OR REPLACE FUNCTION get_top_selling_products(limit_count integer DEFAULT 5)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    sku text,
    total_quantity numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        COALESCE(SUM(sm.quantity), 0) AS total_quantity
    FROM 
        products p
    LEFT JOIN 
        stock_movements sm ON p.id = sm.product_id
    LEFT JOIN 
        movement_types mt ON sm.movement_type_id = mt.id
    WHERE 
        mt.code LIKE 'OUT%' OR mt.code IS NULL
    GROUP BY 
        p.id, p.name, p.sku
    ORDER BY 
        total_quantity DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql; 