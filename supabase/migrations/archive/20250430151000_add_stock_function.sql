-- Crear función para añadir stock al inventario

CREATE OR REPLACE FUNCTION add_stock(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity NUMERIC,
  p_reference TEXT,
  p_type TEXT DEFAULT 'entrada'
) RETURNS BOOLEAN AS $$
DECLARE
  v_movement_type_id INTEGER;
BEGIN
  -- Validar parámetros
  IF p_product_id IS NULL OR p_warehouse_id IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Parámetros inválidos: Producto, almacén y cantidad son obligatorios. La cantidad debe ser mayor a 0.';
  END IF;
  
  -- Determinar el tipo de movimiento basado en el parámetro p_type
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
  
  -- Verificar que el tipo de movimiento existe
  IF v_movement_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de movimiento para: %', p_type;
  END IF;
  
  -- Para salidas, verificar que hay suficiente stock
  IF p_type IN ('salida', 'ajuste_salida') THEN
    DECLARE
      v_current_stock NUMERIC;
    BEGIN
      SELECT current_quantity INTO v_current_stock
      FROM current_stock
      WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
      
      IF v_current_stock IS NULL THEN
        v_current_stock := 0;
      END IF;
      
      IF v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_current_stock, p_quantity;
      END IF;
    END;
  END IF;
  
  -- Insertar el movimiento en stock_movements
  INSERT INTO stock_movements (
    product_id,
    warehouse_id,
    quantity,
    movement_type_id,
    reference,
    movement_date,
    created_at
  ) VALUES (
    p_product_id,
    p_warehouse_id,
    p_quantity,
    v_movement_type_id,
    p_reference,
    NOW(),
    NOW()
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Comentario para la función
COMMENT ON FUNCTION add_stock IS 'Función para actualizar el inventario con movimientos de entrada o salida'; 