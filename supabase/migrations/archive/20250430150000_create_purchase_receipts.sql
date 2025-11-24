-- Migración para crear la tabla de recepción de órdenes de compra
-- Esta tabla registra cuando los productos son recibidos parcial o totalmente

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  
  -- Asegurar que no se pueda recibir más de lo ordenado
  CONSTRAINT valid_receipt_quantity CHECK (quantity > 0)
);

-- Índices para mejorar el rendimiento en consultas comunes
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_id ON purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_product_id ON purchase_receipts(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_warehouse_id ON purchase_receipts(warehouse_id);

-- Comentarios en la tabla y columnas
COMMENT ON TABLE purchase_receipts IS 'Registros de recepción de mercancía de órdenes de compra';
COMMENT ON COLUMN purchase_receipts.purchase_order_id IS 'ID de la orden de compra';
COMMENT ON COLUMN purchase_receipts.purchase_order_item_id IS 'ID del ítem en la orden de compra';
COMMENT ON COLUMN purchase_receipts.product_id IS 'ID del producto recibido';
COMMENT ON COLUMN purchase_receipts.quantity IS 'Cantidad recibida';
COMMENT ON COLUMN purchase_receipts.warehouse_id IS 'Almacén donde se recibió el producto';
COMMENT ON COLUMN purchase_receipts.received_at IS 'Fecha y hora de recepción'; 