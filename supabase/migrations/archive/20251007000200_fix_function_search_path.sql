-- Fix Function Search Path Mutable warnings
-- This migration adds SET search_path = '' to functions to prevent search path injection attacks

-- 1. Fix enforce_serialized_rules function
CREATE OR REPLACE FUNCTION public.enforce_serialized_rules()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.serial_id IS NOT NULL THEN
    -- Validar que el serial existe
    IF NOT EXISTS (
      SELECT 1 FROM public.product_serials
      WHERE id = NEW.serial_id AND product_id = NEW.product_id
    ) THEN
      RAISE EXCEPTION 'Serial no encontrado o no corresponde al producto';
    END IF;
    -- Para productos serializados, quantity debe ser 1
    IF NEW.quantity != 1 THEN
      RAISE EXCEPTION 'Para movimientos con serial, la cantidad debe ser 1';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 2. Fix apply_serial_side_effects function
CREATE OR REPLACE FUNCTION public.apply_serial_side_effects()
RETURNS TRIGGER AS $$
DECLARE
  movement_code TEXT;
BEGIN
  IF NEW.serial_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT mt.code INTO movement_code
  FROM public.movement_types mt
  WHERE mt.id = NEW.movement_type_id;

  IF movement_code LIKE 'IN%' THEN
    UPDATE public.product_serials
    SET status = 'in_stock',
        warehouse_id = NEW.warehouse_id,
        location_id = NEW.location_id,
        updated_at = now()
    WHERE id = NEW.serial_id;
  ELSIF movement_code = 'OUT_SALE' THEN
    UPDATE public.product_serials
    SET status = 'sold',
        warehouse_id = NULL,
        location_id = NULL,
        updated_at = now()
    WHERE id = NEW.serial_id;
  ELSIF movement_code = 'OUT_LOSS' THEN
    UPDATE public.product_serials
    SET status = 'lost',
        warehouse_id = NULL,
        location_id = NULL,
        updated_at = now()
    WHERE id = NEW.serial_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 3. Fix add_stock function (from serialized_inventory)
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
  IF p_product_id IS NULL OR p_warehouse_id IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;
  
  IF p_type = 'entrada' THEN
    SELECT id INTO v_movement_type_id FROM public.movement_types WHERE code = 'IN_PURCHASE';
  ELSIF p_type = 'salida' THEN
    SELECT id INTO v_movement_type_id FROM public.movement_types WHERE code = 'OUT_SALE';
  ELSIF p_type = 'ajuste_entrada' THEN
    SELECT id INTO v_movement_type_id FROM public.movement_types WHERE code = 'IN_ADJUST';
  ELSIF p_type = 'ajuste_salida' THEN
    SELECT id INTO v_movement_type_id FROM public.movement_types WHERE code = 'OUT_ADJUST';
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento no válido: %', p_type;
  END IF;
  
  IF v_movement_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de movimiento para: %', p_type;
  END IF;
  
  IF p_type IN ('salida', 'ajuste_salida') THEN
    DECLARE
      v_current_stock NUMERIC;
    BEGIN
      SELECT current_quantity INTO v_current_stock
      FROM public.current_stock
      WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
      
      IF v_current_stock IS NULL THEN
        v_current_stock := 0;
      END IF;
      
      IF v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_current_stock, p_quantity;
      END IF;
    END;
  END IF;
  
  INSERT INTO public.stock_movements (
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
$$ LANGUAGE plpgsql
SET search_path = '';

-- 4. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 5. Fix select_one function
CREATE OR REPLACE FUNCTION public.select_one()
RETURNS integer AS $$
BEGIN
  RETURN 1;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 6. Fix get_user_permissions function
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS TABLE (
  permission_name TEXT,
  resource TEXT,
  action TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    p.resource,
    p.action
  FROM 
    public.users u
  JOIN 
    public.roles r ON u.role_id = r.id
  JOIN 
    public.role_permissions rp ON r.id = rp.role_id
  JOIN 
    public.permissions p ON rp.permission_id = p.id
  WHERE 
    u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 7. Fix update_modified_column function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 8. Fix get_top_selling_products function
CREATE OR REPLACE FUNCTION get_top_selling_products(limit_count integer DEFAULT 5)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    sku text,
    total_quantity numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        COALESCE(SUM(sm.quantity), 0) AS total_quantity
    FROM 
        public.products p
    LEFT JOIN 
        public.stock_movements sm ON p.id = sm.product_id
    LEFT JOIN 
        public.movement_types mt ON sm.movement_type_id = mt.id
    WHERE 
        mt.code LIKE 'OUT%' OR mt.code IS NULL
    GROUP BY 
        p.id, p.name, p.sku
    ORDER BY 
        total_quantity DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

COMMENT ON FUNCTION public.enforce_serialized_rules IS 'Valida reglas para productos serializados (con search_path seguro)';
COMMENT ON FUNCTION public.apply_serial_side_effects IS 'Aplica efectos secundarios a seriales según movimiento (con search_path seguro)';
COMMENT ON FUNCTION add_stock(UUID, UUID, NUMERIC, TEXT, TEXT) IS 'Añade stock al inventario (con search_path seguro)';
COMMENT ON FUNCTION public.handle_new_user IS 'Crea usuario en tabla users al registrarse (con search_path seguro)';
COMMENT ON FUNCTION public.select_one IS 'Función de prueba (con search_path seguro)';
COMMENT ON FUNCTION get_user_permissions(UUID) IS 'Obtiene permisos del usuario (con search_path seguro)';
COMMENT ON FUNCTION update_modified_column IS 'Actualiza columna updated_at (con search_path seguro)';
COMMENT ON FUNCTION get_top_selling_products(integer) IS 'Obtiene productos más vendidos (con search_path seguro)';
