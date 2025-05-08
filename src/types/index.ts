// Definiciones de tipos completos para la compilación
export interface Category { id: string; name: string; description?: string | null; }
export interface CategoryInput { name: string; description?: string | null; }

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  min_stock?: number | null;
  max_stock?: number | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  tax_rate?: number | null;
  status?: string | null;
  image_url?: string | null;
  description?: string | null;
  category_id?: string | null;
  category?: Category | null;
}
export interface ProductInput {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  min_stock?: number | null;
  max_stock?: number | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  tax_rate?: number | null;
  status?: string | null;
  image_url?: string | null;
  description?: string | null;
  category_id?: string | null;
}
export enum ProductStatus { ACTIVE = 'active', INACTIVE = 'inactive' }

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  description?: string;
}
export interface WarehouseInput {
  name: string;
  location?: string;
  description?: string;
}

export interface CompanySettings {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  footerText: string;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  order_date: string;
  status: string;
  supplier?: Supplier | null;
  warehouse?: Warehouse | null;
  total_amount?: number | null;
}
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price?: number | null;
  subtotal?: number | null;
  received_quantity?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  product?: Product | null;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}
export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
}
export interface RolePermission {
  role_id: number;
  permission_id: number;
  created_at?: string;
}

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
}
export interface CustomerInput {
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
}

export interface Invoice {
  id: string;
  customer_id: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  invoice_number?: string | null;
  customer?: Customer | null;
  due_date?: string | null;
  warehouse?: Warehouse | null;
  payment_method?: string | null;
  subtotal?: number | null;
  discount_amount?: number | null;
  tax_amount?: number | null;
  notes?: string | null;
}
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  price?: number | null;
  subtotal?: number | null;
  product?: Product | null;
  unit_price?: number | null;
}

export interface Return {
  id: string;
  invoice_id: string;
  return_date: string;
  total_amount: number;
  status: string;
  invoice?: Invoice | null;
  reason?: string | null;
  notes?: string | null;
  customer?: Customer | null;
}
export interface ReturnItem {
  id: string;
  return_id: string;
  invoice_item_id: string;
  product_id: string;
  quantity: number;
  price?: number | null;
  subtotal?: number | null;
  product?: Product | null;
  unit_price?: number | null;
  total_price?: number | null;
  reason?: string | null;
}
export interface ReturnInput {
  invoice_id: string;
  return_date: string;
  items: ReturnItemInput[];
  reason?: string | null;
  notes?: string | null;
}
export interface ReturnItemInput {
  invoice_item_id: string;
  product_id: string;
  quantity: number;
  price?: number | null;
  reason?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}
