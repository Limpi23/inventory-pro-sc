-- Prevenir ventas con stock insuficiente
-- Esta migración agrega una validación para evitar que el inventario quede en negativo

-- 1. Crear función para validar stock suficiente antes de salidas
CREATE OR REPLACE FUNCTION public.validate_stock_before_outbound()
RETURNS TRIGGER AS $$
DECLARE
  v_movement_code TEXT;
  v_current_stock NUMERIC;
  v_product_name TEXT;
  v_warehouse_name TEXT;
BEGIN
  -- Obtener el código del tipo de movimiento
  SELECT mt.code INTO v_movement_code
  FROM public.movement_types mt
  WHERE mt.id = NEW.movement_type_id;

  -- Solo validar para movimientos de salida (OUT)
  IF v_movement_code LIKE 'OUT%' THEN
    -- Obtener el stock actual
    SELECT 
      COALESCE(cs.current_quantity, 0),
      p.name,
      w.name
    INTO 
      v_current_stock,
      v_product_name,
      v_warehouse_name
    FROM public.products p
    CROSS JOIN public.warehouses w
    LEFT JOIN public.current_stock cs ON cs.product_id = p.id AND cs.warehouse_id = w.id
    WHERE p.id = NEW.product_id AND w.id = NEW.warehouse_id;

    -- Validar que hay stock suficiente
    IF v_current_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: % en "%". Solicitado: %',
        v_product_name,
        v_current_stock,
        v_warehouse_name,
        NEW.quantity
      USING HINT = 'Verifique el inventario antes de realizar la venta';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 2. Crear trigger para validar antes de insertar movimientos
DROP TRIGGER IF EXISTS trg_validate_stock_before_outbound ON public.stock_movements;

CREATE TRIGGER trg_validate_stock_before_outbound
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_before_outbound();

-- 3. Agregar comentario
COMMENT ON FUNCTION public.validate_stock_before_outbound IS 'Valida que haya stock suficiente antes de permitir movimientos de salida (ventas, ajustes negativos, etc.)';
COMMENT ON TRIGGER trg_validate_stock_before_outbound ON public.stock_movements IS 'Previene que el inventario quede en negativo validando stock antes de salidas';
