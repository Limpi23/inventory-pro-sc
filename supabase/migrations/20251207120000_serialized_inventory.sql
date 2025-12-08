-- Inventario serializado: productos con identificación única (ej. motos con VIN/chasis y motor)
-- Fecha: 2025-09-19

-- 1) Agregar método de seguimiento al producto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tracking_method TEXT NOT NULL DEFAULT 'standard';

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_tracking_method_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_tracking_method_check CHECK (tracking_method IN ('standard','serialized'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_tracking_method ON public.products(tracking_method);

-- 2) Tabla de seriales por producto (cada unidad = 1 serial)
CREATE TABLE IF NOT EXISTS public.product_serials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_code TEXT NOT NULL, -- identificador principal (para motos: VIN)
  vin TEXT,                  -- alternativo explícito
  engine_number TEXT,        -- nro de motor
  year INTEGER,
  color TEXT,
  attributes JSONB,          -- otros atributos (ej. cilindraje, variante, etc.)

  status TEXT NOT NULL DEFAULT 'in_stock',
  CONSTRAINT product_serials_status_check CHECK (status IN (
    'in_stock','reserved','sold','returned','maintenance','lost','scrapped','in_transit'
  )),

  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,

  acquired_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  purchase_receipt_id UUID REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
  invoice_item_id UUID REFERENCES public.invoice_items(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Unicidad: un serial_code por producto; vin y engine_number únicos si se proveen
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_serials_product_serial_code 
  ON public.product_serials(product_id, serial_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_serials_vin 
  ON public.product_serials(vin) WHERE vin IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_serials_engine_number 
  ON public.product_serials(engine_number) WHERE engine_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_serials_product_id ON public.product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_status ON public.product_serials(status);
CREATE INDEX IF NOT EXISTS idx_product_serials_warehouse_id ON public.product_serials(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_location_id ON public.product_serials(location_id);

-- Trigger updated_at para product_serials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_serials_updated_at'
  ) THEN
    CREATE TRIGGER update_product_serials_updated_at
    BEFORE UPDATE ON public.product_serials
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
  END IF;
END $$;

-- 3) Enlazar movimientos de stock con seriales
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS serial_id UUID REFERENCES public.product_serials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_serial_id ON public.stock_movements(serial_id);

-- 4) Reglas de consistencia para productos serializados
--    Si el producto es 'serialized', todo movimiento debe referenciar un serial_id y la cantidad debe ser +/-1
CREATE OR REPLACE FUNCTION public.enforce_serialized_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_tracking TEXT;
BEGIN
  SELECT tracking_method INTO v_tracking FROM public.products WHERE id = NEW.product_id;

  IF v_tracking = 'serialized' THEN
    IF NEW.serial_id IS NULL THEN
      RAISE EXCEPTION 'Producto serializado requiere serial_id en movimientos.' USING ERRCODE = '23514';
    END IF;
    -- En stock_movements guardamos cantidades positivas; el signo lo da movement_type
    IF NEW.quantity <> 1 THEN
      RAISE EXCEPTION 'Cantidad para producto serializado debe ser exactamente 1.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_serialized_rules'
  ) THEN
    CREATE TRIGGER trg_enforce_serialized_rules
    BEFORE INSERT OR UPDATE ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_serialized_rules();
  END IF;
END $$;

-- 5) Sincronizar estado/ubicación del serial según el tipo de movimiento
--    Esta función actualiza product_serials en cada movimiento (IN/OUT/TRANSFER)
CREATE OR REPLACE FUNCTION public.apply_serial_side_effects()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF NEW.serial_id IS NULL THEN
    RETURN NEW; -- no aplica a no-serializados
  END IF;

  SELECT mt.code INTO v_code FROM public.movement_types mt WHERE mt.id = NEW.movement_type_id;

  -- Asegurarnos de que el serial exista
  PERFORM 1 FROM public.product_serials ps WHERE ps.id = NEW.serial_id AND ps.product_id = NEW.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'serial_id no pertenece al producto indicado.';
  END IF;

  -- Entradas
  IF v_code LIKE 'IN_%' THEN
    UPDATE public.product_serials
    SET status = CASE WHEN v_code = 'IN_TRANSFER' THEN 'in_stock' ELSE 'in_stock' END,
        warehouse_id = NEW.warehouse_id,
        location_id = COALESCE(NEW.location_id, location_id),
        acquired_at = COALESCE(acquired_at, NEW.movement_date),
        updated_at = now()
    WHERE id = NEW.serial_id;
  -- Salidas por venta
  ELSIF v_code = 'OUT_SALE' THEN
    UPDATE public.product_serials
    SET status = 'sold',
        sold_at = COALESCE(sold_at, NEW.movement_date),
        warehouse_id = NULL,
        location_id = NULL,
        updated_at = now()
    WHERE id = NEW.serial_id;
  -- Salidas por transferencia
  ELSIF v_code = 'OUT_TRANSFER' THEN
    UPDATE public.product_serials
    SET status = 'in_transit',
        updated_at = now()
    WHERE id = NEW.serial_id;
  -- Ajustes u otros OUT
  ELSIF v_code LIKE 'OUT_%' THEN
    UPDATE public.product_serials
    SET status = 'lost',
        warehouse_id = NULL,
        location_id = NULL,
        updated_at = now()
    WHERE id = NEW.serial_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_apply_serial_side_effects'
  ) THEN
    CREATE TRIGGER trg_apply_serial_side_effects
    AFTER INSERT ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.apply_serial_side_effects();
  END IF;
END $$;

-- 6) Vistas útiles para seriales
-- Seriales actualmente en stock por producto/almacén/ubicación
CREATE OR REPLACE VIEW public.current_serials_in_stock AS
SELECT
  ps.id AS serial_id,
  ps.product_id,
  p.name AS product_name,
  p.sku,
  ps.serial_code,
  ps.vin,
  ps.engine_number,
  ps.year,
  ps.color,
  ps.attributes,
  ps.status,
  ps.warehouse_id,
  w.name AS warehouse_name,
  ps.location_id,
  l.name AS location_name,
  ps.acquired_at
FROM public.product_serials ps
JOIN public.products p ON p.id = ps.product_id
LEFT JOIN public.warehouses w ON w.id = ps.warehouse_id
LEFT JOIN public.locations l ON l.id = ps.location_id
WHERE ps.status = 'in_stock';

-- Conteo de stock para serializados a partir de seriales
-- Nota: la vista current_stock existente suma stock_movements; mantenemos ambas estrategias consistentes
CREATE OR REPLACE VIEW public.current_stock_serialized AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  ps.warehouse_id,
  w.name AS warehouse_name,
  ps.location_id,
  l.name AS location_name,
  COUNT(*)::NUMERIC AS current_quantity
FROM public.products p
JOIN public.product_serials ps ON ps.product_id = p.id AND ps.status = 'in_stock'
LEFT JOIN public.warehouses w ON w.id = ps.warehouse_id
LEFT JOIN public.locations l ON l.id = ps.location_id
WHERE p.tracking_method = 'serialized'
GROUP BY p.id, p.name, p.sku, ps.warehouse_id, w.name, ps.location_id, l.name;

-- 7) Comentarios
COMMENT ON COLUMN public.products.tracking_method IS 'standard = por cantidad, serialized = por unidad con serial único';
COMMENT ON TABLE public.product_serials IS 'Seriales/unidades únicas por producto (ej. motos con VIN y motor).';

-- 8) Actualizar función add_stock para soportar seriales y location
--    Nota: reemplaza la firma anterior añadiendo p_location_id y p_serial_id opcionales
CREATE OR REPLACE FUNCTION add_stock(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity NUMERIC,
  p_reference TEXT,
  p_type TEXT DEFAULT 'entrada',
  p_location_id UUID DEFAULT NULL,
  p_serial_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_movement_type_id INTEGER;
  v_tracking TEXT;
  v_current_stock NUMERIC;
BEGIN
  IF p_product_id IS NULL OR p_warehouse_id IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Parámetros inválidos: Producto y almacén obligatorios; cantidad debe ser > 0.';
  END IF;

  -- Determinar el tipo de movimiento
  IF p_type = 'entrada' THEN
    SELECT id INTO v_movement_type_id FROM movement_types WHERE code = 'IN_PURCHASE';
  ELSIF p_type = 'salida' THEN
    SELECT id INTO v_movement_type_id FROM movement_types WHERE code = 'OUT_SALE';
  ELSIF p_type = 'ajuste_entrada' THEN
    SELECT id INTO v_movement_type_id FROM movement_types WHERE code = 'IN_ADJUST';
  ELSIF p_type = 'ajuste_salida' THEN
    SELECT id INTO v_movement_type_id FROM movement_types WHERE code = 'OUT_ADJUST';
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento no válido: %', p_type;
  END IF;

  IF v_movement_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de movimiento para: %', p_type;
  END IF;

  -- Validación para serializados
  SELECT tracking_method INTO v_tracking FROM products WHERE id = p_product_id;
  IF v_tracking = 'serialized' THEN
    -- Para serializados, forzamos 1 y serial_id obligatorio
    IF p_quantity <> 1 THEN
      RAISE EXCEPTION 'Cantidad para producto serializado debe ser exactamente 1.';
    END IF;
    IF p_serial_id IS NULL THEN
      RAISE EXCEPTION 'Producto serializado requiere p_serial_id.';
    END IF;
  ELSE
    -- Para no serializados y salidas, verificar stock suficiente
    IF p_type IN ('salida', 'ajuste_salida') THEN
      SELECT current_quantity INTO v_current_stock
      FROM current_stock
      WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
      IF COALESCE(v_current_stock, 0) < ABS(p_quantity) THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', COALESCE(v_current_stock,0), p_quantity;
      END IF;
    END IF;
  END IF;

  -- Insertar movimiento (los triggers se encargan de efectos colaterales en seriales)
  INSERT INTO stock_movements (
    product_id,
    warehouse_id,
    location_id,
    quantity,
    movement_type_id,
    reference,
    movement_date,
    created_at,
    serial_id
  ) VALUES (
    p_product_id,
    p_warehouse_id,
    p_location_id,
    p_quantity, -- siempre positiva
    v_movement_type_id,
    p_reference,
    NOW(),
    NOW(),
    p_serial_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 9) Activar RLS en product_serials y políticas básicas para authenticated
ALTER TABLE IF EXISTS public.product_serials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY product_serials_select_authenticated ON public.product_serials FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY product_serials_write_authenticated ON public.product_serials FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
