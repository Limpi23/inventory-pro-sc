-- Enable RLS and add baseline policies for remaining tables flagged by Security Advisor

-- 1) Enable RLS
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;

-- 2) Read policies (allow SELECT to authenticated)
DO $$ BEGIN EXECUTE 'CREATE POLICY suppliers_select_auth ON public.suppliers FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY categories_select_auth ON public.categories FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY warehouses_select_auth ON public.warehouses FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY purchase_orders_select_auth ON public.purchase_orders FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY purchase_order_items_select_auth ON public.purchase_order_items FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY purchase_receipts_select_auth ON public.purchase_receipts FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY sales_orders_select_auth ON public.sales_orders FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY sales_order_items_select_auth ON public.sales_order_items FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY inventory_count_items_select_auth ON public.inventory_count_items FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY role_permissions_select_auth ON public.role_permissions FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY subscription_plans_select_auth ON public.subscription_plans FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY subscriptions_select_auth ON public.subscriptions FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY tenants_select_auth ON public.tenants FOR SELECT TO authenticated USING (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Write policies for app CRUD tables (broad allow to authenticated - tighten later by role if needed)
DO $$ BEGIN EXECUTE 'CREATE POLICY suppliers_write_auth ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY categories_write_auth ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY warehouses_write_auth ON public.warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY purchase_orders_write_auth ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY purchase_order_items_write_auth ON public.purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY purchase_receipts_write_auth ON public.purchase_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY sales_orders_write_auth ON public.sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY sales_order_items_write_auth ON public.sales_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE POLICY inventory_count_items_write_auth ON public.inventory_count_items FOR ALL TO authenticated USING (true) WITH CHECK (true)'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Keep these as read-only via policies created above
-- role_permissions, subscription_plans, subscriptions, tenants
