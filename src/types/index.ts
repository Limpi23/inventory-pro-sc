// Definiciones de tipos temporales para la compilación
export interface Category { id: string; name: string; }
export interface CategoryInput { name: string; }
export interface Product { id: string; name: string; }
export interface ProductInput { name: string; }
export enum ProductStatus { ACTIVE = 'active', INACTIVE = 'inactive' }
export interface Warehouse { id: string; name: string; }
export interface WarehouseInput { name: string; }
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
