-- Migration: Inventory Direct Adjustment for Super Root User
-- Permite al usuario admin@suitcore.com ajustar inventario directamente sin generar movimientos

-- 1. Crear tabla para registrar los ajustes (para auditoría)
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  previous_quantity NUMERIC(10,2) NOT NULL,
  new_quantity NUMERIC(10,2) NOT NULL,
  difference NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  adjusted_by UUID NOT NULL REFERENCES public.users(id),
  adjusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON public.inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_warehouse ON public.inventory_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_adjusted_by ON public.inventory_adjustments(adjusted_by);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_adjusted_at ON public.inventory_adjustments(adjusted_at);

-- Habilitar RLS
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Política: Solo los usuarios autenticados pueden ver los ajustes
CREATE POLICY "Users can view inventory adjustments"
  ON public.inventory_adjustments
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Solo se puede insertar a través de la función RPC (no directamente)
CREATE POLICY "Only RPC can insert adjustments"
  ON public.inventory_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 2. Crear función RPC para ajustar inventario directamente
CREATE OR REPLACE FUNCTION public.adjust_inventory_direct(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_location_id UUID,
  p_new_quantity NUMERIC,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_current_quantity NUMERIC;
  v_difference NUMERIC;
  v_adjustment_id UUID;
  v_sum_movements NUMERIC;
  v_tracking_method TEXT;
BEGIN
  -- Obtener el ID y email del usuario actual
  v_user_id := auth.uid();
  
  -- Verificar que el usuario esté autenticado
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  -- Obtener el email del usuario
  SELECT email INTO v_user_email
  FROM public.users
  WHERE id = v_user_id;
  
  -- RESTRICCIÓN: Solo el usuario admin@suitcore.com puede usar esta función
  IF v_user_email != 'admin@suitcore.com' THEN
    RAISE EXCEPTION 'Acceso denegado: Solo el super administrador puede realizar ajustes directos de inventario';
  END IF;
  
  -- Validar que la nueva cantidad sea >= 0
  IF p_new_quantity < 0 THEN
    RAISE EXCEPTION 'La cantidad no puede ser negativa';
  END IF;
  
  -- Validar que se proporcione una razón
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Debe proporcionar una razón para el ajuste';
  END IF;

  -- Verificar que el producto existe y obtener su método de seguimiento
  SELECT tracking_method INTO v_tracking_method
  FROM public.products
  WHERE id = p_product_id;
  
  IF v_tracking_method IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  -- RESTRICCIÓN: No permitir ajustes directos en productos serializados
  IF v_tracking_method = 'serialized' THEN
    RAISE EXCEPTION 'No se puede ajustar directamente el inventario de productos serializados. Use la gestión de seriales.';
  END IF;

  -- Obtener la cantidad actual desde la vista current_stock_by_location
  SELECT COALESCE(current_quantity, 0) INTO v_current_quantity
  FROM public.current_stock_by_location
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND location_id = p_location_id;
  
  -- Si no hay registro en la vista, la cantidad actual es 0
  IF v_current_quantity IS NULL THEN
    v_current_quantity := 0;
  END IF;
  
  -- Calcular la diferencia
  v_difference := p_new_quantity - v_current_quantity;
  
  -- Si no hay diferencia, no hacer nada
  IF v_difference = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No hay cambios en la cantidad',
      'previous_quantity', v_current_quantity,
      'new_quantity', p_new_quantity,
      'difference', 0
    );
  END IF;

  -- Registrar el ajuste en la tabla de auditoría
  INSERT INTO public.inventory_adjustments (
    product_id,
    warehouse_id,
    location_id,
    previous_quantity,
    new_quantity,
    difference,
    reason,
    adjusted_by
  ) VALUES (
    p_product_id,
    p_warehouse_id,
    p_location_id,
    v_current_quantity,
    p_new_quantity,
    v_difference,
    p_reason,
    v_user_id
  ) RETURNING id INTO v_adjustment_id;

  -- Calcular la suma actual de movimientos para este producto/almacén/ubicación
  SELECT COALESCE(SUM(quantity), 0) INTO v_sum_movements
  FROM public.stock_movements
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND location_id = p_location_id;

  -- La nueva suma de movimientos debe ser igual a p_new_quantity
  -- Entonces el ajuste necesario es: p_new_quantity - v_sum_movements
  v_difference := p_new_quantity - v_sum_movements;

  -- Insertar un movimiento de ajuste SOLO si hay diferencia
  -- Este movimiento tiene un tipo especial y referencia al ajuste
  IF v_difference != 0 THEN
    INSERT INTO public.stock_movements (
      product_id,
      warehouse_id,
      location_id,
      movement_type_id,
      quantity,
      movement_date,
      reference,
      notes,
      related_id
    )
    SELECT
      p_product_id,
      p_warehouse_id,
      p_location_id,
      mt.id,
      v_difference,
      NOW(),
      'AJUSTE-' || v_adjustment_id,
      'Ajuste directo de inventario: ' || p_reason,
      v_adjustment_id
    FROM public.movement_types mt
    WHERE mt.code = 'adjustment'
    LIMIT 1;

    -- Si no existe el tipo de movimiento 'adjustment', crearlo
    IF NOT FOUND THEN
      -- Crear tipo de movimiento de ajuste si no existe
      INSERT INTO public.movement_types (code, description)
      VALUES ('adjustment', 'Ajuste de Inventario')
      ON CONFLICT (code) DO NOTHING;

      -- Insertar el movimiento ahora que existe el tipo
      INSERT INTO public.stock_movements (
        product_id,
        warehouse_id,
        location_id,
        movement_type_id,
        quantity,
        movement_date,
        reference,
        notes,
        related_id
      )
      SELECT
        p_product_id,
        p_warehouse_id,
        p_location_id,
        mt.id,
        v_difference,
        NOW(),
        'AJUSTE-' || v_adjustment_id,
        'Ajuste directo de inventario: ' || p_reason,
        v_adjustment_id
      FROM public.movement_types mt
      WHERE mt.code = 'adjustment'
      LIMIT 1;
    END IF;
  END IF;

  -- Retornar resultado exitoso
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ajuste de inventario realizado correctamente',
    'adjustment_id', v_adjustment_id,
    'previous_quantity', v_current_quantity,
    'new_quantity', p_new_quantity,
    'difference', p_new_quantity - v_current_quantity,
    'movement_adjustment', v_difference
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, hacer rollback implícito y retornar error
    RAISE EXCEPTION 'Error al ajustar inventario: %', SQLERRM;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.adjust_inventory_direct IS 
'Ajusta directamente el inventario para un producto en una ubicación específica. 
Solo puede ser ejecutado por el usuario admin@suitcore.com (super root).
No genera movimientos visibles en el historial normal, solo un movimiento técnico de ajuste.
Registra la operación en inventory_adjustments para auditoría.';

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.adjust_inventory_direct TO authenticated;

-- 3. Crear vista para consultar el historial de ajustes
CREATE OR REPLACE VIEW public.inventory_adjustments_history AS
SELECT
  ia.id,
  ia.adjusted_at,
  p.name AS product_name,
  p.sku,
  w.name AS warehouse_name,
  l.name AS location_name,
  ia.previous_quantity,
  ia.new_quantity,
  ia.difference,
  ia.reason,
  u.full_name AS adjusted_by_name,
  u.email AS adjusted_by_email
FROM public.inventory_adjustments ia
JOIN public.products p ON p.id = ia.product_id
JOIN public.warehouses w ON w.id = ia.warehouse_id
JOIN public.locations l ON l.id = ia.location_id
JOIN public.users u ON u.id = ia.adjusted_by
ORDER BY ia.adjusted_at DESC;

-- Otorgar permisos de lectura en la vista
GRANT SELECT ON public.inventory_adjustments_history TO authenticated;

COMMENT ON VIEW public.inventory_adjustments_history IS 
'Vista de historial de ajustes directos de inventario con información completa para auditoría';
