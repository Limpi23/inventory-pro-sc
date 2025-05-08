import { useState, useEffect } from "react";
import { Warehouse, WarehouseInput } from "../../../types";
import { warehousesService } from "../../../lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface WarehouseModalProps {
  open: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
}

export default function WarehouseModal({ open, onClose, warehouse }: WarehouseModalProps) {
  const [formData, setFormData] = useState<WarehouseInput>({
    name: "",
    location: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Actualizar el formulario cuando se edita un almacén existente
  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name,
        location: warehouse.location || "",
        description: warehouse.description || "",
      });
    } else {
      // Reiniciar el formulario al crear un nuevo almacén
      setFormData({
        name: "",
        location: "",
        description: "",
      });
    }
  }, [warehouse, open]);

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

      if (warehouse) {
        // Actualizar almacén existente
        await warehousesService.update(warehouse.id, {
          name: formData.name,
          location: formData.location || undefined,
          description: formData.description || undefined
        });
      } else {
        // Crear nuevo almacén
        await warehousesService.create({
          name: formData.name,
          location: formData.location || undefined,
          description: formData.description || undefined
        });
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al guardar el almacén");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {warehouse ? "Editar Almacén" : "Agregar Almacén"}
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
              placeholder="Nombre del almacén"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              name="location"
              value={formData.location || ""}
              onChange={handleChange}
              placeholder="Ubicación del almacén (opcional)"
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