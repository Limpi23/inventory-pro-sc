-- Precios diferenciados por sucursal
--
-- `products.sale_price` / `products.purchase_price` siguen siendo el precio
-- BASE del catálogo. Esta tabla guarda el precio propio de una sucursal cuando
-- difiere del base.
--
-- Regla de resolución: precio de la sucursal activa si existe, si no el base.

CREATE TABLE IF NOT EXISTS public.product_prices (
  product_id     UUID NOT NULL REFERENCES public.products(id)   ON DELETE CASCADE,
  warehouse_id   UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  sale_price     NUMERIC(10,2),
  purchase_price NUMERIC(10,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  PRIMARY KEY (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_product_prices_warehouse ON public.product_prices(warehouse_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_prices_updated_at') THEN
    CREATE TRIGGER update_product_prices_updated_at
    BEFORE UPDATE ON public.product_prices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_column();
  END IF;
END
$$;

-- Vista de conveniencia: precio ya resuelto por producto y sucursal.
-- Devuelve una fila por cada combinación producto × almacén activo.
CREATE OR REPLACE VIEW public.product_prices_resolved AS
SELECT
  p.id                AS product_id,
  p.sku,
  p.name,
  w.id                AS warehouse_id,
  w.name              AS warehouse_name,
  COALESCE(pp.sale_price,     p.sale_price)     AS sale_price,
  COALESCE(pp.purchase_price, p.purchase_price) AS purchase_price,
  (pp.product_id IS NOT NULL)                   AS tiene_precio_propio
FROM public.products p
CROSS JOIN public.warehouses w
LEFT JOIN public.product_prices pp
       ON pp.product_id = p.id AND pp.warehouse_id = w.id
WHERE w.is_active IS DISTINCT FROM false;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.product_prices_resolved SET (security_invoker = on)';
EXCEPTION WHEN others THEN NULL; END $$;

-- RLS: se replica la política permisiva que ya usan products y warehouses,
-- porque la app opera con la anon key. Conviene endurecerlo junto con el resto.
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY product_prices_select ON public.product_prices FOR SELECT TO anon, authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY product_prices_write ON public.product_prices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.product_prices IS
  'Precio propio de un producto en una sucursal. Si no hay fila, rige el precio base de products.';
