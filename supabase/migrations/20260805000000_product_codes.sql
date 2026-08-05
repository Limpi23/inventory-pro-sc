-- Códigos de producto: autogeneración de código de barras / QR
--
-- Regla de negocio: el código de un producto ES su SKU, renderizable como
-- Code128 (1D) o como QR (2D) según lo que se necesite al imprimir la etiqueta.
-- La columna `barcode` sigue siendo editable para productos que traen un
-- EAN-13 impreso de fábrica.
--
-- La autogeneración vive en un trigger y no en el formulario porque los
-- productos se crean desde tres sitios: ProductModal, ProductImport (CSV/Excel)
-- y productService.createBatch.

-- 1. Simbología preferida por producto ---------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode_type TEXT NOT NULL DEFAULT 'CODE128';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_type_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_barcode_type_check
      CHECK (barcode_type IN ('CODE128', 'EAN13', 'QR'));
  END IF;
END
$$;

-- 2. Normalizar cadenas vacías a NULL ----------------------------------------
-- Sin esto el índice único parcial del paso 5 no filtra nada y colisiona.
UPDATE public.products
   SET barcode = NULL
 WHERE barcode IS NOT NULL
   AND btrim(barcode) = '';

-- 3. Autogeneración ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_product_barcode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Un barcode en blanco equivale a "sin código"
  IF NEW.barcode IS NOT NULL AND btrim(NEW.barcode) = '' THEN
    NEW.barcode := NULL;
  END IF;

  -- Si no hay código, el SKU pasa a serlo
  IF NEW.barcode IS NULL
     AND NEW.sku IS NOT NULL
     AND btrim(NEW.sku) <> '' THEN
    NEW.barcode := btrim(NEW.sku);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_product_barcode ON public.products;
CREATE TRIGGER trg_set_product_barcode
  BEFORE INSERT OR UPDATE OF barcode, sku ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_product_barcode();

-- 4. Backfill de los productos existentes ------------------------------------
UPDATE public.products
   SET barcode = btrim(sku)
 WHERE barcode IS NULL
   AND sku IS NOT NULL
   AND btrim(sku) <> '';

-- 5. Unicidad ----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_barcode
  ON public.products (barcode)
  WHERE barcode IS NOT NULL;

COMMENT ON COLUMN public.products.barcode IS
  'Valor del código del producto. Se autocompleta con el SKU si se deja vacío. Se renderiza como Code128 o QR según barcode_type.';
COMMENT ON COLUMN public.products.barcode_type IS
  'Simbología preferida al imprimir: CODE128 (por defecto, desde el SKU), EAN13 (código de fábrica) o QR.';
