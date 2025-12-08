-- Deshabilitar RLS en todas las tablas porque usamos autenticación con password_hash sin JWT
-- Esto permite que la aplicación funcione correctamente sin tokens de Supabase Auth

ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.movement_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_counts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.returns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements DISABLE ROW LEVEL SECURITY;

-- You can enable RLS on more tables if needed
-- ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- No se crean políticas porque RLS está deshabilitado en todas las tablas
-- Esto permite acceso completo sin necesidad de JWT de Supabase Auth

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
