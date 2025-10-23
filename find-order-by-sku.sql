-- Buscar órdenes que contengan el product con SKU 'DE191033'
SELECT 
    po.id as order_id,
    po.status,
    po.order_date,
    po.total_amount,
    s.name as supplier_name,
    poi.quantity,
    p.name as product_name,
    p.sku
FROM purchase_orders po
JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
JOIN products p ON p.id = poi.product_id
JOIN suppliers s ON s.id = po.supplier_id
WHERE p.sku = 'DE191033'  -- SKU de ABRAZADERA BOMBA DE AGUA
ORDER BY po.created_at DESC;