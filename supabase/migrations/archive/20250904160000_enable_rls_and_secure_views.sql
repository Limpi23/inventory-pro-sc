-- Enable RLS on public tables and add minimal policies for the app
-- WARNING: Adjust these policies to your business rules if you need stricter control.

-- 1) Enable RLS where it was disabled
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items ENABLE ROW LEVEL SECURITY;
-- No habilitar RLS en permissions porque se consultan durante login sin JWT
ALTER TABLE IF EXISTS public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_items ENABLE ROW LEVEL SECURITY;
-- No habilitar RLS en roles porque necesitamos acceso público para login
ALTER TABLE IF EXISTS public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements ENABLE ROW LEVEL SECURITY;

-- You can enable RLS on more tables if needed
-- ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- 2) Minimal SELECT policies (allow authenticated users to read)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY products_select_authenticated ON public.products FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY customers_select_authenticated ON public.customers FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY movement_types_select_authenticated ON public.movement_types FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY invoice_items_select_authenticated ON public.invoice_items FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No crear política para permissions porque RLS está deshabilitado
-- DO $$ BEGIN
--   EXECUTE 'CREATE POLICY permissions_select_authenticated ON public.permissions FOR SELECT TO authenticated USING (true)';
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY invoices_select_authenticated ON public.invoices FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY inventory_counts_select_authenticated ON public.inventory_counts FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY returns_select_authenticated ON public.returns FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY return_items_select_authenticated ON public.return_items FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No crear política para roles porque RLS está deshabilitado
-- DO $$ BEGIN
--   EXECUTE 'CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (true)';
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY stock_movements_select_authenticated ON public.stock_movements FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Basic write policies for main app tables (adjust if you need stricter rules)
-- Allow INSERT/UPDATE/DELETE to authenticated users
DO $$ BEGIN
  EXECUTE 'CREATE POLICY products_write_authenticated ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY customers_write_authenticated ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY invoices_write_authenticated ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY invoice_items_write_authenticated ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY returns_write_authenticated ON public.returns FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY return_items_write_authenticated ON public.return_items FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY inventory_counts_write_authenticated ON public.inventory_counts FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY stock_movements_write_authenticated ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep movement_types/roles/permissions as read-only from the app

-- 4) Switch views to security_invoker so they respect the querying user RLS
-- Not all Postgres versions support this attribute; guard with try/catch
DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.current_stock SET (security_invoker = on)';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.user_roles SET (security_invoker = on)';
EXCEPTION WHEN others THEN NULL; END $$;

-- If any of these views are based on SECURITY DEFINER functions, consider rewriting
-- them or replacing with policies/RPCs that only expose necessary data.
