import { useState, useEffect } from "react";
import { Category, CategoryInput } from "../../../types";
import { categoriesService } from "../../../lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
}

export default function CategoryModal({ open, onClose, category }: CategoryModalProps) {
  const [formData, setFormData] = useState<CategoryInput>({
    name: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Actualizar el formulario cuando se edita una categoría existente
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      // Reiniciar el formulario al crear una nueva categoría
      setFormData({
        name: "",
        description: "",
      });
    }
  }, [category, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
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

      if (category) {
        // Actualizar categoría existente
        await categoriesService.update(category.id, {
          name: formData.name,
          description: formData.description || undefined
        });
      } else {
        // Crear nueva categoría
        await categoriesService.create({
          name: formData.name,
          description: formData.description || undefined
        });
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar la categoría");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar Categoría" : "Agregar Categoría"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Nombre de la categoría"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              placeholder="Descripción (opcional)"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <DialogFooter className="mt-4">
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