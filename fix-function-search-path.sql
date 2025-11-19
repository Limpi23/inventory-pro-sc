-- Fix Function Security Issues
-- Arregla el problema de search_path mutable en las funciones

-- 1. Fix execute_migration function
CREATE OR REPLACE FUNCTION public.execute_migration(migration_sql TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Ejecutar el SQL proporcionado
  EXECUTE migration_sql;
  
  result_data := jsonb_build_object(
    'success', true,
    'message', 'Migración ejecutada correctamente'
  );
  
  RETURN result_data;
EXCEPTION
  WHEN OTHERS THEN
    result_data := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result_data;
END;
$$;

-- 2. Fix add_stock function
CREATE OR REPLACE FUNCTION add_stock(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity NUMERIC,
  p_reference TEXT,
  p_type TEXT DEFAULT 'entrada',
  p_location_id UUID DEFAULT NULL,
  p_serial_id UUID DEFAULT NULL
) RETURNS BOOLEAN 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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
    IF p_quantity <> 1 THEN
      RAISE EXCEPTION 'Cantidad para producto serializado debe ser exactamente 1.';
    END IF;
    IF p_serial_id IS NULL THEN
      RAISE EXCEPTION 'Producto serializado requiere p_serial_id.';
    END IF;
  ELSE
    IF p_type IN ('salida', 'ajuste_salida') THEN
      SELECT current_quantity INTO v_current_stock
      FROM current_stock
      WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
      IF COALESCE(v_current_stock, 0) < ABS(p_quantity) THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', COALESCE(v_current_stock,0), p_quantity;
      END IF;
    END IF;
  END IF;

  -- Insertar movimiento
  INSERT INTO stock_movements(
    product_id,
    warehouse_id,
    movement_type_id,
    quantity,
    reference,
    movement_date,
    notes,
    location_id,
    serial_id
  ) VALUES (
    p_product_id,
    p_warehouse_id,
    v_movement_type_id,
    CASE 
      WHEN p_type IN ('salida', 'ajuste_salida') THEN -ABS(p_quantity)
      ELSE ABS(p_quantity)
    END,
    p_reference,
    now(),
    'Movimiento de stock',
    p_location_id,
    p_serial_id
  );

  RETURN TRUE;
END;
$$;

-- 3. Nota sobre verify_password
-- Si la función verify_password existe y es tuya (no de Supabase Auth),
-- necesitarás recrearla con SET search_path.
-- Si es de Supabase Auth, esta advertencia es normal y no necesitas arreglarla.

-- Para verificar si existe y quién la creó:
-- SELECT proname, pronamespace::regnamespace, prosrc 
-- FROM pg_proc 
-- WHERE proname = 'verify_password';
