import { supabase } from './supabase';

export interface ProductPrice {
  product_id: string;
  warehouse_id: string;
  sale_price: number | null;
  purchase_price: number | null;
}

export interface ResolvedPrice {
  sale_price: number;
  purchase_price: number;
  /** true si la sucursal tiene precio propio; false si rige el precio base del catálogo. */
  propio: boolean;
}

/** Un producto con precios base, tal como viene de `products`. */
interface ConPrecioBase {
  sale_price?: number | null;
  purchase_price?: number | null;
}

const PAGE = 1000;

export const priceService = {
  /**
   * Precios propios de una sucursal, indexados por producto.
   * Se pagina porque PostgREST corta en 1000 filas y una sucursal grande las supera.
   */
  getMapByWarehouse: async (warehouseId: string): Promise<Map<string, ProductPrice>> => {
    const map = new Map<string, ProductPrice>();
    if (!warehouseId) return map;

    const client = await supabase.getClient();
    let offset = 0;
    for (;;) {
      const { data, error } = await client
        .from('product_prices')
        .select('product_id, warehouse_id, sale_price, purchase_price')
        .eq('warehouse_id', warehouseId)
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      const page = (data || []) as ProductPrice[];
      page.forEach((p) => map.set(p.product_id, p));
      if (page.length < PAGE) break;
      offset += PAGE;
    }
    return map;
  },

  /** Todos los precios propios de un producto, uno por sucursal. */
  getByProduct: async (productId: string): Promise<ProductPrice[]> => {
    if (!productId) return [];
    const client = await supabase.getClient();
    const { data, error } = await client
      .from('product_prices')
      .select('product_id, warehouse_id, sale_price, purchase_price')
      .eq('product_id', productId);
    if (error) throw error;
    return (data || []) as ProductPrice[];
  },

  /** Crea o actualiza precios propios. La clave es (product_id, warehouse_id). */
  upsert: async (rows: ProductPrice[]): Promise<void> => {
    if (!rows.length) return;
    const client = await supabase.getClient();
    const { error } = await client
      .from('product_prices')
      .upsert(rows as any, { onConflict: 'product_id,warehouse_id' });
    if (error) throw error;
  },

  /** Elimina el precio propio: la sucursal vuelve a regirse por el precio base. */
  remove: async (productId: string, warehouseId: string): Promise<void> => {
    const client = await supabase.getClient();
    const { error } = await client
      .from('product_prices')
      .delete()
      .eq('product_id', productId)
      .eq('warehouse_id', warehouseId);
    if (error) throw error;
  },

  /**
   * Regla del negocio: manda el precio de la sucursal; si no tiene uno propio,
   * rige el precio base del catálogo.
   */
  resolve: (product: ConPrecioBase, override?: ProductPrice | null): ResolvedPrice => {
    const base = {
      sale_price: Number(product?.sale_price) || 0,
      purchase_price: Number(product?.purchase_price) || 0,
    };
    if (!override) return { ...base, propio: false };

    const sale = override.sale_price;
    const purchase = override.purchase_price;
    return {
      sale_price: sale === null || sale === undefined ? base.sale_price : Number(sale),
      purchase_price: purchase === null || purchase === undefined ? base.purchase_price : Number(purchase),
      propio: true,
    };
  },
};

export default priceService;
