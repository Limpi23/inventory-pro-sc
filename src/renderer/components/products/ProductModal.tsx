import { useState, useEffect } from "react";
import { Product, ProductInput, ProductStatus, Category } from "../../../types";
import { productsService, categoriesService } from "../../../lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

export default function ProductModal({ open, onClose, product }: ProductModalProps) {
  const [formData, setFormData] = useState<ProductInput>({
    name: "",
    description: "",
    sku: "",
    barcode: "",
    category_id: "",
    min_stock: 0,
    max_stock: null,
    purchase_price: 0,
    sale_price: 0,
    tax_rate: 0,
    status: "active",
    image_url: "",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Cargar categorías
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await categoriesService.getAll();
        setCategories(data || []);
      } catch (error) {
        console.error("Error al cargar categorías:", error);
      }
    }
    
    loadCategories();
  }, []);

  // Actualizar el formulario cuando se edita un producto existente
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
        category_id: product.category_id || "",
        min_stock: product.min_stock,
        max_stock: product.max_stock,
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        tax_rate: product.tax_rate,
        status: product.status,
        image_url: product.image_url || "",
      });
    } else {
      // Reiniciar el formulario al crear un nuevo producto
      setFormData({
        name: "",
        description: "",
        sku: "",
        barcode: "",
        category_id: "",
        min_stock: 0,
        max_stock: null,
        purchase_price: 0,
        sale_price: 0,
        tax_rate: 0,
        status: "active",
        image_url: "",
      });
    }
  }, [product, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Convertir valores numéricos
    if (["min_stock", "max_stock", "purchase_price", "sale_price", "tax_rate"].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" ? null : Number(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      if (product) {
        // Actualizar producto existente
        await productsService.update(product.id, formData);
      } else {
        // Crear nuevo producto
        await productsService.create(formData);
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar el producto");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Producto" : "Agregar Producto"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Nombre del producto */}
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Nombre del producto"
              />
            </div>
            
            {/* Categoría */}
            <div className="grid gap-2">
              <Label htmlFor="category_id">Categoría</Label>
              <Select
                value={formData.category_id?.toString() || "null"}
                onValueChange={(value) => handleSelectChange("category_id", value === "null" ? "" : value)}
              >
                <SelectTrigger id="category_id">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Sin categoría</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* SKU */}
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                name="sku"
                value={formData.sku || ""}
                onChange={handleChange}
                placeholder="Código SKU"
              />
            </div>
            
            {/* Código de barras */}
            <div className="grid gap-2">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input
                id="barcode"
                name="barcode"
                value={formData.barcode || ""}
                onChange={handleChange}
                placeholder="Código de barras"
              />
            </div>
            
            {/* Precio de compra */}
            <div className="grid gap-2">
              <Label htmlFor="purchase_price">Precio de compra</Label>
              <Input
                id="purchase_price"
                name="purchase_price"
                type="number"
                value={formData.purchase_price !== null ? formData.purchase_price : ""}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            
            {/* Precio de venta */}
            <div className="grid gap-2">
              <Label htmlFor="sale_price">Precio de venta</Label>
              <Input
                id="sale_price"
                name="sale_price"
                type="number"
                value={formData.sale_price !== null ? formData.sale_price : ""}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            
            {/* Stock mínimo */}
            <div className="grid gap-2">
              <Label htmlFor="min_stock">Stock mínimo</Label>
              <Input
                id="min_stock"
                name="min_stock"
                type="number"
                value={formData.min_stock !== null ? formData.min_stock : ""}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            
            {/* Stock máximo */}
            <div className="grid gap-2">
              <Label htmlFor="max_stock">Stock máximo</Label>
              <Input
                id="max_stock"
                name="max_stock"
                type="number"
                value={formData.max_stock !== null ? formData.max_stock : ""}
                onChange={handleChange}
                placeholder="Stock máximo (opcional)"
              />
            </div>
            
            {/* Tasa de impuesto */}
            <div className="grid gap-2">
              <Label htmlFor="tax_rate">Tasa de IVA (%)</Label>
              <Input
                id="tax_rate"
                name="tax_rate"
                type="number"
                value={formData.tax_rate !== null ? formData.tax_rate : ""}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            
            {/* Estado */}
            <div className="grid gap-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status || "active"}
                onValueChange={(value) => handleSelectChange("status", value as ProductStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="discontinued">Descontinuado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* URL de imagen */}
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="image_url">URL de imagen</Label>
              <Input
                id="image_url"
                name="image_url"
                value={formData.image_url || ""}
                onChange={handleChange}
                placeholder="URL de la imagen (opcional)"
              />
            </div>
            
            {/* Descripción */}
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                placeholder="Descripción del producto (opcional)"
              />
            </div>
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 