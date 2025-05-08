-- Esquema inicial de la base de datos para Inventario Pro - SC

-- Tabla de categorías de productos
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de almacenes
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de tipos de movimientos
CREATE TABLE IF NOT EXISTS movement_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  order_date DATE NOT NULL,
  status TEXT NOT NULL,
  total_amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de items de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(10, 2)
);

-- Tabla de órdenes de venta
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  order_date DATE NOT NULL,
  status TEXT NOT NULL,
  total_amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Tabla de items de órdenes de venta
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(10, 2)
);

-- Tabla de movimientos de stock
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity NUMERIC(10, 2) NOT NULL,
  movement_type_id INTEGER NOT NULL REFERENCES movement_types(id),
  reference TEXT,
  related_id UUID,  -- Puede ser una orden de compra, venta u otro movimiento
  movement_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Tabla de conteos de inventario
CREATE TABLE IF NOT EXISTS inventory_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  count_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by UUID
);

-- Tabla de items de conteos de inventario
CREATE TABLE IF NOT EXISTS inventory_count_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  system_quantity NUMERIC(10, 2) NOT NULL,
  counted_quantity NUMERIC(10, 2) NOT NULL,
  difference NUMERIC(10, 2)
);

-- Poblamos la tabla de tipos de movimientos con valores predefinidos
INSERT INTO movement_types (code, description) VALUES
  ('IN_PURCHASE', 'Entrada por compra'),
  ('OUT_SALE', 'Salida por venta'),
  ('IN_ADJUST', 'Entrada por ajuste'),
  ('OUT_ADJUST', 'Salida por ajuste'),
  ('IN_RETURN', 'Entrada por devolución'),
  ('OUT_LOSS', 'Salida por pérdida/daño'),
  ('IN_TRANSFER', 'Entrada por transferencia'),
  ('OUT_TRANSFER', 'Salida por transferencia')
ON CONFLICT (code) DO NOTHING;

-- Crear una vista para calcular el stock actual por producto y almacén
CREATE OR REPLACE VIEW current_stock AS
SELECT 
  p.id as product_id, 
  p.name as product_name,
  p.sku,
  w.id as warehouse_id,
  w.name as warehouse_name,
  COALESCE(SUM(CASE WHEN mt.code LIKE 'IN%' THEN sm.quantity ELSE -sm.quantity END), 0) as current_quantity
FROM 
  products p
CROSS JOIN 
  warehouses w
LEFT JOIN 
  stock_movements sm ON p.id = sm.product_id AND w.id = sm.warehouse_id
LEFT JOIN 
  movement_types mt ON sm.movement_type_id = mt.id
GROUP BY 
  p.id, p.name, p.sku, w.id, w.name; 