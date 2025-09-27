// Tipos de usuario existentes
export interface User {
  id: string;
  email: string;
  full_name: string;
  active: boolean;
  role_id: number;
  role_name: string;
  role_description?: string;
  tenant_id?: string;
  last_login?: string;
  created_at: string;
}

// Suscripción
export interface Subscription {
  id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: number; // 0 = activa/operable, 1 = bloqueada/no operable
  payment_reference?: string;
  created_at: string;
  updated_at?: string;
}

// Plan de suscripción
export interface SubscriptionPlan {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  features: string[];
}

// Tenant (Cliente/Negocio)
export interface Tenant {
  id: string;
  name: string;
  business_name?: string;
  contact_email: string;
  contact_phone?: string;
  created_at: string;
  updated_at?: string;
}

// Información resumida de suscripción para UI
export interface SubscriptionInfo {
  isActive: boolean;
  endDate: string | null;
  planName: string | null;
  daysRemaining: number | null;
  status: number;
} 

export * from './types/index'; 

// --- Tipos extendidos usados en la UI ---

export interface Customer {
  id: string;
  name: string;
  identification_type?: string;
  identification_number?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  tax_status?: string;
  payment_terms?: string;
  credit_limit?: number;
  is_active?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  invoice_number?: string;
  customer_id: string;
  warehouse_id?: string;
  invoice_date: string;
  due_date?: string;
  payment_method?: string;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  status: string;
  notes?: string;
  sales_order_id?: string | null;
  customer?: Customer;
  warehouse?: { id?: string; name?: string };
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  product?: { id?: string; name?: string; sku?: string };
}

export interface Return {
  id: string;
  invoice_id: string;
  return_date: string;
  total_amount: number;
  status: string;
  reason?: string;
  notes?: string;
  invoice?: Invoice;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  invoice_item_id: string;
  product_id: string;
  quantity: number;
  reason?: string;
  unit_price?: number;
  total_price?: number;
  product?: { id?: string; name?: string; sku?: string };
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Permission {
  id: number;
  // Nombre compuesto opcional (resource_action) usado en UI localStorage
  name?: string;
  action: string;
  resource: string;
  description?: string;
  created_at?: string;
}

export interface RolePermission {
  id?: number;
  role_id: number;
  permission_id: number;
  created_at?: string;
}

export interface InventoryItem {
  product_id: string;
  product_name: string;
  sku?: string;
  warehouse_id: string;
  warehouse_name?: string;
  current_quantity: number;
}

export type TrackingMethod = 'standard' | 'serialized';

export interface ProductSerial {
  id: string;
  product_id: string;
  serial_code: string; // VIN u otro identificador principal
  vin?: string | null;
  engine_number?: string | null;
  year?: number | null;
  color?: string | null;
  attributes?: Record<string, any> | null;
  status: 'in_stock' | 'reserved' | 'sold' | 'returned' | 'maintenance' | 'lost' | 'scrapped' | 'in_transit';
  warehouse_id?: string | null;
  location_id?: string | null;
  acquired_at?: string | null;
  sold_at?: string | null;
  purchase_receipt_id?: string | null;
  invoice_item_id?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

// Extender InventoryItem opcionalmente si se requiere por ubicación (no romper API existente)
export interface InventorySerialItem {
  serial_id: string;
  product_id: string;
  product_name: string;
  sku?: string;
  serial_code: string;
  vin?: string | null;
  engine_number?: string | null;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  acquired_at?: string | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  movement_type_id: number;
  movement_date: string;
  // nuevos campos
  serial_id?: string | null;
  location_id?: string | null;
  product?: { id?: string; name?: string; sku?: string };
  warehouse?: { id?: string; name?: string };
  movement_type?: { id?: number; code?: string; description?: string };
}

export interface TopProduct { name: string; sku: string; totalQuantity: number; }
export interface LowStockProduct { product: { id: string; name: string; sku?: string }; warehouse: { name?: string }; current_quantity: number; }

// ---------------- Form / Input helper interfaces (para formularios UI) ----------------

// Customer form input (sin id)
export interface CustomerInput {
  name: string;
  identification_type?: string;
  identification_number?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  tax_status?: string;
  payment_terms?: string;
  credit_limit?: number | ""; // permitir string vacío en formulario
  is_active?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  created_at?: string;
  updated_at?: string;
}

// Return (devoluciones) inputs
export interface ReturnItemInput {
  invoice_item_id: string;
  product_id: string;
  quantity: number;
  reason?: string; // motivo específico
  unit_price?: number;
  total_price?: number;
}

export interface ReturnInput {
  invoice_id: string;
  return_date: string; // YYYY-MM-DD
  reason: string; // motivo general
  notes?: string;
  items: ReturnItemInput[];
}