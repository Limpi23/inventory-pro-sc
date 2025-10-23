-- Consulta para verificar el estado actual de la orden
-- Reemplaza 'ID_DE_LA_ORDEN' con el ID real de tu orden

SELECT 
    id,
    status,
    order_date,
    total_amount,
    created_at,
    updated_at
FROM purchase_orders 
WHERE id = 'ID_DE_LA_ORDEN';  -- Reemplaza con el ID real

-- Si la orden está en 'borrador', cambiar a 'enviada' para poder recibir mercancía
UPDATE purchase_orders 
SET 
    status = 'enviada',
    updated_at = NOW()
WHERE id = 'ID_DE_LA_ORDEN'  -- Reemplaza con el ID real
  AND status = 'borrador';

-- Verificar el cambio
SELECT 
    id,
    status,
    order_date,
    total_amount,
    updated_at
FROM purchase_orders 
WHERE id = 'ID_DE_LA_ORDEN';  -- Reemplaza con el ID real