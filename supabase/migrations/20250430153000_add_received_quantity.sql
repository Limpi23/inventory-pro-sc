-- Añadir columna received_quantity a la tabla purchase_order_items

ALTER TABLE purchase_order_items 
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(10, 2) DEFAULT 0;

-- Añadir comentario a la columna
COMMENT ON COLUMN purchase_order_items.received_quantity IS 'Cantidad de productos recibidos para este ítem de orden de compra'; 