-- Reset/clean inventory and stock movements (safe recipes)
-- Context: Products remain; we remove stock history and, optionally, serialized units.
-- Use one recipe at a time. Read comments and preview sections before running deletes.
-- IMPORTANT:
-- - Make a backup first.
-- - Ensure you run with a role that bypasses RLS or has rights (service_role in Supabase) if needed.
-- - Transactions are used; you can ROLLBACK if previews look wrong.

/*
Sections
1) Global reset (ALL warehouses, ALL products)
2) Reset by warehouse name
3) Reset by SKU (single product)
4) Reset by SKU and warehouse
5) Only remove movements (keep serial units) [optional]
6) Remove recent test data by date range (movements only) [optional]
7) Reset monthly sales (invoices) shown in Dashboard
8) PURGE ALL DATA (transactions + inventory)
*/

-- 1) GLOBAL RESET: Delete all stock movements and all serialized units
BEGIN;

-- Preview
SELECT COUNT(*) AS movements_before FROM public.stock_movements;
SELECT COUNT(*) AS serials_before FROM public.product_serials;
SELECT
  COALESCE(SUM(CASE WHEN mt.code LIKE 'IN%' THEN sm.quantity ELSE -sm.quantity END), 0) AS net_quantity_all
FROM public.stock_movements sm
JOIN public.movement_types mt ON mt.id = sm.movement_type_id;

-- Delete movements (history)
DELETE FROM public.stock_movements;

-- For serialized products: also delete the unit records so nothing remains in stock
DELETE FROM public.product_serials;

-- Post-delete check
SELECT COUNT(*) AS movements_after FROM public.stock_movements;
SELECT COUNT(*) AS serials_after FROM public.product_serials;

COMMIT;

-- NOTE: A WITH (CTE) only lives for the immediate next statement in Postgres.
-- To reuse the warehouse id across multiple statements, we use a TEMP TABLE.
BEGIN;

-- Replace the name below
CREATE TEMP TABLE tmp_wh AS
SELECT id FROM public.warehouses WHERE name = 'ALMACEN PRINCIPAL' LIMIT 1;

-- Preview
SELECT
  (SELECT COUNT(*) FROM public.stock_movements sm WHERE sm.warehouse_id IN (SELECT id FROM tmp_wh)) AS movements_in_wh,
  (SELECT COUNT(*) FROM public.product_serials ps WHERE ps.warehouse_id IN (SELECT id FROM tmp_wh)) AS serials_in_wh;

-- Delete only movements from that warehouse
DELETE FROM public.stock_movements sm
USING tmp_wh t
WHERE sm.warehouse_id = t.id;

-- Delete serialized units located in that warehouse (so no units remain assigned there)
DELETE FROM public.product_serials ps
USING tmp_wh t
WHERE ps.warehouse_id = t.id;

COMMIT;

-- 3) RESET BY SKU (single product)
-- Replace 'SKU-123' with your product SKU
BEGIN;

WITH pr AS (
  SELECT id FROM public.products WHERE sku = 'SKU-123' LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM public.stock_movements sm WHERE sm.product_id IN (SELECT id FROM pr)) AS movements_for_sku,
  (SELECT COUNT(*) FROM public.product_serials ps WHERE ps.product_id IN (SELECT id FROM pr)) AS serials_for_sku;

DELETE FROM public.stock_movements sm
USING (SELECT id FROM pr) t
WHERE sm.product_id = t.id;

DELETE FROM public.product_serials ps
USING (SELECT id FROM pr) t
WHERE ps.product_id = t.id;

COMMIT;

-- 4) RESET BY SKU + WAREHOUSE (narrow deletion)
-- Replace 'SKU-123' and 'ALMACEN PRINCIPAL'
BEGIN;

WITH pr AS (
  SELECT id FROM public.products WHERE sku = 'SKU-123' LIMIT 1
), wh AS (
  SELECT id FROM public.warehouses WHERE name = 'ALMACEN PRINCIPAL' LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM public.stock_movements sm WHERE sm.product_id IN (SELECT id FROM pr) AND sm.warehouse_id IN (SELECT id FROM wh)) AS movements_for_sku_wh,
  (SELECT COUNT(*) FROM public.product_serials ps WHERE ps.product_id IN (SELECT id FROM pr) AND ps.warehouse_id IN (SELECT id FROM wh)) AS serials_for_sku_wh;

DELETE FROM public.stock_movements sm
USING (SELECT id FROM pr) p, (SELECT id FROM wh) w
WHERE sm.product_id = p.id AND sm.warehouse_id = w.id;

DELETE FROM public.product_serials ps
USING (SELECT id FROM pr) p, (SELECT id FROM wh) w
WHERE ps.product_id = p.id AND ps.warehouse_id = w.id;

COMMIT;

-- 5) ONLY REMOVE MOVEMENTS (KEEP SERIAL UNITS) [optional]
-- Use this if you want to keep product_serials records (e.g., for reference) but zero out history/stock.
-- Note: Keeping serials but deleting movements may leave serials with warehouse/location set.
--       If you want them fully unassigned, run the UPDATE below.
BEGIN;

-- Movements only (all)
DELETE FROM public.stock_movements;

-- Optionally, unassign serials (they will not appear as in stock)
UPDATE public.product_serials
SET status = 'lost',
    warehouse_id = NULL,
    location_id = NULL,
    updated_at = now();

COMMIT;

-- 6) REMOVE TEST DATA BY DATE RANGE (MOVEMENTS ONLY)
-- Delete movements in a window; leaves older history intact.
-- Adjust dates as needed.
BEGIN;

SELECT COUNT(*) AS movements_in_range
FROM public.stock_movements sm
WHERE sm.movement_date >= DATE '2025-09-01' AND sm.movement_date < DATE '2025-10-01';

DELETE FROM public.stock_movements sm
WHERE sm.movement_date >= DATE '2025-09-01' AND sm.movement_date < DATE '2025-10-01';

COMMIT;

-- Notes:
-- - Views like current_stock/current_stock_by_location/current_serials_in_stock are derived; no refresh needed.
-- - Triggers enforce rules only on INSERT/UPDATE of stock_movements; deletes are safe.
-- - Deleting product_serials does not affect invoices/purchase_receipts; FKs on serials are SET NULL.

-- 7) RESET MONTHLY SALES ("Ventas del Mes" en el Dashboard)
-- Dashboard computes: SUM(invoices.total_amount) for invoices in current month with status IN ('emitida','pagada')
-- Two approaches below: (A) neutralize by status, (B) delete invoices and their dependent rows.

-- (A) Neutralize by setting status so they are excluded
BEGIN;

-- Preview current month total (should match Dashboard number)
SELECT COALESCE(SUM(total_amount),0) AS monthly_total
FROM public.invoices
WHERE invoice_date >= date_trunc('month', now()::date)
  AND status IN ('emitida','pagada');

-- Update: set to 'borrador' (or 'anulada') to exclude from dashboard
UPDATE public.invoices
SET status = 'borrador'
WHERE invoice_date >= date_trunc('month', now()::date)
  AND status IN ('emitida','pagada');

-- Check
SELECT COALESCE(SUM(total_amount),0) AS monthly_total_after
FROM public.invoices
WHERE invoice_date >= date_trunc('month', now()::date)
  AND status IN ('emitida','pagada');

COMMIT;

-- 8) PURGE ALL DATA (transactions + inventory)
-- This will remove ALL transactional data: invoices/returns, sales orders, purchase orders/receipts,
-- stock movements, inventory counts, and serialized units. Products, warehouses, customers, suppliers,
-- and categories are preserved (master data). Use only if you want a clean slate of movements and docs.
BEGIN;

-- Previews
SELECT
  (SELECT COUNT(*) FROM public.stock_movements) AS c_stock_movements,
  (SELECT COUNT(*) FROM public.product_serials) AS c_product_serials,
  (SELECT COUNT(*) FROM public.invoices) AS c_invoices,
  (SELECT COUNT(*) FROM public.invoice_items) AS c_invoice_items,
  (SELECT COUNT(*) FROM public.returns) AS c_returns,
  (SELECT COUNT(*) FROM public.return_items) AS c_return_items,
  (SELECT COUNT(*) FROM public.sales_orders) AS c_sales_orders,
  (SELECT COUNT(*) FROM public.sales_order_items) AS c_sales_order_items,
  (SELECT COUNT(*) FROM public.purchase_receipts) AS c_purchase_receipts,
  (SELECT COUNT(*) FROM public.purchase_orders) AS c_purchase_orders,
  (SELECT COUNT(*) FROM public.purchase_order_items) AS c_purchase_order_items,
  (SELECT COUNT(*) FROM public.inventory_counts) AS c_inventory_counts,
  (SELECT COUNT(*) FROM public.inventory_count_items) AS c_inventory_count_items;

-- Order matters to respect FKs without disabling constraints
-- 1) Return items -> returns
DELETE FROM public.return_items;
DELETE FROM public.returns;

-- 2) Invoice items (will also be deleted via ON DELETE CASCADE if invoices go first, but explicit is fine)
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;

-- 3) Sales orders and items
DELETE FROM public.sales_order_items;
DELETE FROM public.sales_orders;

-- 4) Purchase receipts, then PO items, then POs
DELETE FROM public.purchase_receipts;
DELETE FROM public.purchase_order_items;
DELETE FROM public.purchase_orders;

-- 5) Inventory counts and items
DELETE FROM public.inventory_count_items;
DELETE FROM public.inventory_counts;

-- 6) Stock movements
DELETE FROM public.stock_movements;

-- 7) Serialized units
DELETE FROM public.product_serials;

-- Post-check
SELECT
  (SELECT COUNT(*) FROM public.stock_movements) AS c_stock_movements_after,
  (SELECT COUNT(*) FROM public.product_serials) AS c_product_serials_after,
  (SELECT COUNT(*) FROM public.invoices) AS c_invoices_after,
  (SELECT COUNT(*) FROM public.invoice_items) AS c_invoice_items_after,
  (SELECT COUNT(*) FROM public.returns) AS c_returns_after,
  (SELECT COUNT(*) FROM public.return_items) AS c_return_items_after,
  (SELECT COUNT(*) FROM public.sales_orders) AS c_sales_orders_after,
  (SELECT COUNT(*) FROM public.sales_order_items) AS c_sales_order_items_after,
  (SELECT COUNT(*) FROM public.purchase_receipts) AS c_purchase_receipts_after,
  (SELECT COUNT(*) FROM public.purchase_orders) AS c_purchase_orders_after,
  (SELECT COUNT(*) FROM public.purchase_order_items) AS c_purchase_order_items_after,
  (SELECT COUNT(*) FROM public.inventory_counts) AS c_inventory_counts_after,
  (SELECT COUNT(*) FROM public.inventory_count_items) AS c_inventory_count_items_after;

COMMIT;

-- If you also want to remove master data (be careful!) uncomment as needed:
-- DELETE FROM public.products;
-- DELETE FROM public.categories;
-- DELETE FROM public.customers;
-- DELETE FROM public.suppliers;
-- DELETE FROM public.warehouses;

-- (B) Delete current-month invoices (and cascade their items, plus returns in the right order)
BEGIN;

-- Identify target invoices for current month and statuses counted by dashboard
CREATE TEMP TABLE tmp_target_invoices AS
SELECT id FROM public.invoices
WHERE invoice_date >= date_trunc('month', now()::date)
  AND status IN ('emitida','pagada');

-- Preview counts
SELECT (SELECT COUNT(*) FROM tmp_target_invoices) AS invoices_to_delete,
       (SELECT COUNT(*) FROM public.invoice_items ii WHERE ii.invoice_id IN (SELECT id FROM tmp_target_invoices)) AS items_to_delete,
       (SELECT COUNT(*) FROM public.returns r WHERE r.invoice_id IN (SELECT id FROM tmp_target_invoices)) AS returns_to_delete,
       (SELECT COUNT(*) FROM public.return_items ri WHERE ri.return_id IN (SELECT id FROM public.returns WHERE invoice_id IN (SELECT id FROM tmp_target_invoices))) AS return_items_to_delete;

-- Delete return items -> returns -> invoices (invoice_items will cascade)
DELETE FROM public.return_items ri
USING public.returns r
WHERE ri.return_id = r.id
  AND r.invoice_id IN (SELECT id FROM tmp_target_invoices);

DELETE FROM public.returns r
WHERE r.invoice_id IN (SELECT id FROM tmp_target_invoices);

DELETE FROM public.invoices i
WHERE i.id IN (SELECT id FROM tmp_target_invoices);

-- Verify dashboard total becomes 0
SELECT COALESCE(SUM(total_amount),0) AS monthly_total_after
FROM public.invoices
WHERE invoice_date >= date_trunc('month', now()::date)
  AND status IN ('emitida','pagada');

COMMIT;
