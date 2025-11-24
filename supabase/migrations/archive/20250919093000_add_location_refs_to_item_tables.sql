-- Add location references to item-related tables
-- This migration adds a nullable location_id referencing public.locations(id)
-- to multiple tables where items can be associated with a specific bin/shelf.

-- Ensure locations table exists (created in 20250906090000_create_locations_table.sql)
-- and products.location_id was already added there.

-- purchase_order_items
ALTER TABLE IF EXISTS public.purchase_order_items
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_location_id ON public.purchase_order_items(location_id);

-- sales_order_items
ALTER TABLE IF EXISTS public.sales_order_items
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_order_items_location_id ON public.sales_order_items(location_id);

-- inventory_count_items
ALTER TABLE IF EXISTS public.inventory_count_items
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_count_items_location_id ON public.inventory_count_items(location_id);

-- stock_movements (optional but useful for traceability within a warehouse)
ALTER TABLE IF EXISTS public.stock_movements
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_location_id ON public.stock_movements(location_id);

-- invoices & returns items (sale context)
ALTER TABLE IF EXISTS public.invoice_items
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_location_id ON public.invoice_items(location_id);

ALTER TABLE IF EXISTS public.return_items
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_return_items_location_id ON public.return_items(location_id);

-- purchase_receipts may also be tied to a location where received goods were stored
ALTER TABLE IF EXISTS public.purchase_receipts
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_location_id ON public.purchase_receipts(location_id);
