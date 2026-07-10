-- Migración: Soporte de casa matriz y sucursales
-- 1) Los almacenes pasan a representar sucursales: se marca una como "matriz".
-- 2) Cada usuario puede tener una sucursal asignada (users.warehouse_id).
-- 3) Transferencias entre sucursales con documento propio (stock_transfers)
--    y flujo pendiente -> en tránsito -> recibida, generando los movimientos
--    OUT_TRANSFER / IN_TRANSFER al enviar y recibir.

-- =====================================================================
-- 1. Almacenes como sucursales (matriz / sucursal)
-- =====================================================================
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS branch_type TEXT NOT NULL DEFAULT 'sucursal';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.warehouses
    ADD CONSTRAINT warehouses_branch_type_check CHECK (branch_type IN ('matriz', 'sucursal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Solo puede existir una casa matriz
CREATE UNIQUE INDEX IF NOT EXISTS uniq_warehouses_matriz
  ON public.warehouses (branch_type)
  WHERE branch_type = 'matriz';

-- Si aún no hay matriz, marcar el almacén más antiguo como matriz
UPDATE public.warehouses
SET branch_type = 'matriz'
WHERE id = (SELECT id FROM public.warehouses ORDER BY created_at ASC, id ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.warehouses WHERE branch_type = 'matriz');

-- =====================================================================
-- 2. Sucursal asignada al usuario
-- =====================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_warehouse ON public.users(warehouse_id);

-- Exponer la sucursal en la vista usada por el login.
-- CREATE OR REPLACE VIEW permite añadir columnas al final sin romper las existentes.
CREATE OR REPLACE VIEW public.user_roles AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.active,
  r.id AS role_id,
  r.name AS role_name,
  r.description AS role_description,
  u.last_login,
  u.created_at,
  u.warehouse_id,
  w.name AS warehouse_name,
  w.branch_type AS warehouse_branch_type
FROM public.users u
JOIN public.roles r ON u.role_id = r.id
LEFT JOIN public.warehouses w ON w.id = u.warehouse_id;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.user_roles SET (security_invoker = on)';
EXCEPTION WHEN others THEN NULL; END $$;

-- =====================================================================
-- 2b. Devoluciones: sucursal a la que se repone la mercancía
-- =====================================================================
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);
CREATE INDEX IF NOT EXISTS idx_returns_warehouse ON public.returns(warehouse_id);

-- =====================================================================
-- 3. Transferencias entre sucursales
-- =====================================================================
CREATE SEQUENCE IF NOT EXISTS public.stock_transfer_number_seq;

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL UNIQUE
    DEFAULT ('TR-' || LPAD(nextval('public.stock_transfer_number_seq')::TEXT, 6, '0')),
  source_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  destination_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  shipped_at TIMESTAMPTZ,
  shipped_by UUID REFERENCES public.users(id),
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  source_location_id UUID REFERENCES public.locations(id),
  destination_location_id UUID REFERENCES public.locations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_source ON public.stock_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination ON public.stock_transfers(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product ON public.stock_transfer_items(product_id);

-- La app usa autenticación propia (clave anon sin sesión de Supabase Auth),
-- igual que el resto de tablas operativas: políticas permisivas.
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_transfers_all" ON public.stock_transfers;
CREATE POLICY "stock_transfers_all" ON public.stock_transfers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock_transfer_items_all" ON public.stock_transfer_items;
CREATE POLICY "stock_transfer_items_all" ON public.stock_transfer_items
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Crear transferencia (cabecera + líneas) validando stock en origen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_transfer(
  p_source_warehouse_id UUID,
  p_destination_warehouse_id UUID,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id UUID;
  v_transfer_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_available NUMERIC;
  v_product_name TEXT;
BEGIN
  IF p_source_warehouse_id IS NULL OR p_destination_warehouse_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debe indicar sucursal de origen y destino');
  END IF;
  IF p_source_warehouse_id = p_destination_warehouse_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'El origen y el destino no pueden ser la misma sucursal');
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La transferencia no tiene productos');
  END IF;

  INSERT INTO stock_transfers (source_warehouse_id, destination_warehouse_id, notes, created_by)
  VALUES (p_source_warehouse_id, p_destination_warehouse_id, NULLIF(p_notes, ''), p_user_id)
  RETURNING id, transfer_number INTO v_transfer_id, v_transfer_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Producto o cantidad inválida en la transferencia';
    END IF;

    SELECT COALESCE(cs.current_quantity, 0), p.name
    INTO v_available, v_product_name
    FROM products p
    LEFT JOIN current_stock cs ON cs.product_id = p.id AND cs.warehouse_id = p_source_warehouse_id
    WHERE p.id = v_product_id;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado';
    END IF;
    IF COALESCE(v_available, 0) < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" en la sucursal de origen (disponible: %)', v_product_name, COALESCE(v_available, 0);
    END IF;

    INSERT INTO stock_transfer_items (transfer_id, product_id, quantity, source_location_id, destination_location_id)
    VALUES (
      v_transfer_id,
      v_product_id,
      v_quantity,
      NULLIF(v_item->>'source_location_id', '')::UUID,
      NULLIF(v_item->>'destination_location_id', '')::UUID
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id, 'transfer_number', v_transfer_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------
-- Enviar transferencia: genera movimientos OUT_TRANSFER en el origen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ship_stock_transfer(
  p_transfer_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_out_type_id INTEGER;
  v_available NUMERIC;
  v_product_name TEXT;
BEGIN
  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
  END IF;
  IF v_transfer.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden enviar transferencias pendientes');
  END IF;

  SELECT id INTO v_out_type_id FROM movement_types WHERE code = 'OUT_TRANSFER';
  IF v_out_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No existe el tipo de movimiento OUT_TRANSFER');
  END IF;

  FOR v_item IN SELECT sti.*, p.name AS product_name FROM stock_transfer_items sti
                JOIN products p ON p.id = sti.product_id
                WHERE sti.transfer_id = p_transfer_id LOOP
    SELECT COALESCE(current_quantity, 0) INTO v_available
    FROM current_stock
    WHERE product_id = v_item.product_id AND warehouse_id = v_transfer.source_warehouse_id;

    IF COALESCE(v_available, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" en la sucursal de origen (disponible: %)', v_item.product_name, COALESCE(v_available, 0);
    END IF;

    INSERT INTO stock_movements (product_id, warehouse_id, location_id, movement_type_id, quantity, reference, notes, movement_date, created_by)
    VALUES (
      v_item.product_id,
      v_transfer.source_warehouse_id,
      v_item.source_location_id,
      v_out_type_id,
      v_item.quantity,
      v_transfer.transfer_number,
      'Salida por transferencia ' || v_transfer.transfer_number,
      NOW(),
      p_user_id
    );
  END LOOP;

  UPDATE stock_transfers
  SET status = 'in_transit', shipped_at = NOW(), shipped_by = p_user_id, updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'in_transit');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------
-- Recibir transferencia: genera movimientos IN_TRANSFER en el destino
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_stock_transfer(
  p_transfer_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_in_type_id INTEGER;
BEGIN
  SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
  END IF;
  IF v_transfer.status <> 'in_transit' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden recibir transferencias en tránsito');
  END IF;

  SELECT id INTO v_in_type_id FROM movement_types WHERE code = 'IN_TRANSFER';
  IF v_in_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No existe el tipo de movimiento IN_TRANSFER');
  END IF;

  FOR v_item IN SELECT * FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
    INSERT INTO stock_movements (product_id, warehouse_id, location_id, movement_type_id, quantity, reference, notes, movement_date, created_by)
    VALUES (
      v_item.product_id,
      v_transfer.destination_warehouse_id,
      v_item.destination_location_id,
      v_in_type_id,
      v_item.quantity,
      v_transfer.transfer_number,
      'Entrada por transferencia ' || v_transfer.transfer_number,
      NOW(),
      p_user_id
    );
  END LOOP;

  UPDATE stock_transfers
  SET status = 'received', received_at = NOW(), received_by = p_user_id, updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'received');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------
-- Cancelar transferencia (solo pendientes, aún sin movimientos)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_stock_transfer(
  p_transfer_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transferencia no encontrada');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cancelar transferencias pendientes');
  END IF;

  UPDATE stock_transfers
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'cancelled');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT USAGE ON SEQUENCE public.stock_transfer_number_seq TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_items TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer(UUID, UUID, JSONB, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ship_stock_transfer(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_transfer(UUID, UUID) TO anon, authenticated;
