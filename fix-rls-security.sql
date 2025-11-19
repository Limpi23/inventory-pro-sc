-- Fix RLS Security Issues
-- Habilita Row Level Security en todas las tablas públicas

-- Habilitar RLS en las tablas
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar duplicados)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.warehouses;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sales_order_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sales_orders;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.purchase_orders;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.purchase_receipts;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.roles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.role_permissions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.inventory_count_items;

-- Crear políticas para permitir todas las operaciones a usuarios autenticados
-- (Ajusta estas políticas según tus necesidades de seguridad)

-- purchase_order_items
CREATE POLICY "Enable all access for authenticated users" ON public.purchase_order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- warehouses
CREATE POLICY "Enable all access for authenticated users" ON public.warehouses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- sales_order_items
CREATE POLICY "Enable all access for authenticated users" ON public.sales_order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- suppliers
CREATE POLICY "Enable all access for authenticated users" ON public.suppliers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- sales_orders
CREATE POLICY "Enable all access for authenticated users" ON public.sales_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- purchase_orders
CREATE POLICY "Enable all access for authenticated users" ON public.purchase_orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- categories
CREATE POLICY "Enable all access for authenticated users" ON public.categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- purchase_receipts
CREATE POLICY "Enable all access for authenticated users" ON public.purchase_receipts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- roles
CREATE POLICY "Enable all access for authenticated users" ON public.roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- role_permissions
CREATE POLICY "Enable all access for authenticated users" ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- inventory_count_items
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_count_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Si necesitas acceso público de lectura (NO RECOMENDADO para datos sensibles):
-- Descomenta las siguientes líneas solo si es necesario

/*
CREATE POLICY "Enable read access for all users" ON public.purchase_order_items
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable read access for all users" ON public.warehouses
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable read access for all users" ON public.sales_order_items
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable read access for all users" ON public.suppliers
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable read access for all users" ON public.sales_orders
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable read access for all users" ON public.purchase_orders
  FOR SELECT
  TO public
  USING (true);
*/
