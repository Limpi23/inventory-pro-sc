-- Deshabilitar RLS en todas las tablas porque usamos autenticación con password_hash sin JWT
-- Esto permite que la aplicación funcione correctamente sin tokens de Supabase Auth

-- Tablas críticas que se usan sin JWT
ALTER TABLE IF EXISTS public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_count_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants DISABLE ROW LEVEL SECURITY;

-- No se crean políticas porque RLS está deshabilitado en todas estas tablas
-- Esto permite acceso completo sin necesidad de JWT de Supabase Auth
