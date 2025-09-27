-- Vincular cotizaciones con órdenes de venta generadas
ALTER TABLE IF EXISTS public.invoices
ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sales_order_id
ON public.invoices(sales_order_id)
WHERE sales_order_id IS NOT NULL;
