-- Migración: Agregar soporte de productos serializados a invoice_items
-- Fecha: 2025-10-10
-- Descripción: Agrega la columna serial_id a invoice_items para soportar
--              productos con tracking_method='serialized'

-- Agregar columna serial_id a invoice_items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS serial_id UUID REFERENCES public.product_serials(id) ON DELETE SET NULL;

-- Crear índice para mejorar performance de búsquedas
CREATE INDEX IF NOT EXISTS idx_invoice_items_serial_id ON public.invoice_items(serial_id);

-- Comentario explicativo
COMMENT ON COLUMN public.invoice_items.serial_id IS 
  'Referencia al número de serie del producto (solo para productos con tracking_method=serialized)';
