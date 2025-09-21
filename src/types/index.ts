// Tipos de dominio
export interface Category {
	id: string;
	name: string;
	description?: string;
}

export interface CategoryInput {
	name: string;
	description?: string;
}

export type ProductStatus = 'active' | 'inactive' | 'discontinued';
export type TrackingMethod = 'standard' | 'serialized';

export interface Product {
	id: string;
	name: string;
	description?: string;
	sku?: string;
	barcode?: string;
	category_id?: string | null;
	location_id?: string | null;
	tracking_method?: TrackingMethod; // cantidad vs serializado
	min_stock: number;
	max_stock: number | null;
	purchase_price: number | null;
	sale_price: number | null;
	tax_rate: number | null;
	status: ProductStatus;
	image_url?: string;
	created_at?: string;
	updated_at?: string;
}

export interface ProductInput {
	name: string;
	description?: string;
	sku?: string;
	barcode?: string;
	category_id?: string | null;
	location_id?: string | null;
	tracking_method?: TrackingMethod; // cantidad vs serializado
	min_stock: number;
	max_stock: number | null;
	purchase_price: number | null;
	sale_price: number | null;
	tax_rate: number | null;
	status: ProductStatus;
	image_url?: string;
}

export interface Location {
	id: string;
	name: string;
	description?: string;
	warehouse_id?: string | null;
	active?: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface LocationInput {
	name: string;
	description?: string;
	warehouse_id?: string | null;
	active?: boolean;
}
export interface Warehouse {
	id: string;
	name: string;
	location?: string;
	description?: string;
	created_at?: string;
	updated_at?: string;
}
export interface WarehouseInput {
	name: string;
	location?: string;
	description?: string;
}
export interface CompanySettings { name: string; taxId: string; address: string; phone: string; email?: string; website?: string; logoUrl?: string; footerText: string; }
export interface PurchaseOrder { id: string; supplier_id: string; order_date: string; status: string; }
export interface OrderItem { id: string; order_id: string; product_id: string; quantity: number; price: number; subtotal: number; }
export interface Role { id: number; name: string; }
export interface Permission { id: number; name: string; resource: string; action: string; }
export interface RolePermission { role_id: number; permission_id: number; }
export interface Customer { id: string; name: string; }
export interface CustomerInput { name: string; }
export interface Invoice { id: string; customer_id: string; invoice_date: string; total_amount: number; status: string; }
export interface InvoiceItem { id: string; invoice_id: string; product_id: string; quantity: number; price: number; subtotal: number; }
export interface Return { id: string; invoice_id: string; return_date: string; total_amount: number; status: string; }
export interface ReturnItem { id: string; return_id: string; invoice_item_id: string; product_id: string; quantity: number; price: number; subtotal: number; }
export interface ReturnInput { invoice_id: string; return_date: string; items: ReturnItemInput[]; }
export interface ReturnItemInput { invoice_item_id: string; product_id: string; quantity: number; price: number; }
