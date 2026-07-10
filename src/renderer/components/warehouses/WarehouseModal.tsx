import { useState, useEffect } from "react";
import { Warehouse, WarehouseInput, BranchType } from "../../../types";
import { warehousesService } from "../../lib/supabase";
import { useBranch } from "../../lib/branch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface WarehouseModalProps {
  open: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
}

export default function WarehouseModal({ open, onClose, warehouse }: WarehouseModalProps) {
  const { refreshWarehouses } = useBranch();
  const [formData, setFormData] = useState<WarehouseInput>({
    name: "",
    location: "",
    description: "",
    branch_type: "sucursal",
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
        branch_type: warehouse.branch_type || "sucursal",
      });
    } else {
      // Reiniciar el formulario al crear un nuevo almacén
      setFormData({
        name: "",
        location: "",
        description: "",
        branch_type: "sucursal",
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

      const payload = {
        name: formData.name,
        location: formData.location || undefined,
        description: formData.description || undefined,
        branch_type: formData.branch_type || "sucursal",
      };

      if (warehouse) {
        await warehousesService.update(warehouse.id, payload);
      } else {
        await warehousesService.create({ ...payload, is_active: true });
      }

      await refreshWarehouses();
      onClose();
    } catch (err: any) {
      const msg = String(err.message || "");
      if (msg.includes("uniq_warehouses_matriz") || (msg.includes("duplicate key") && msg.includes("matriz"))) {
        setError("Ya existe una casa matriz. Solo puede haber una: cambie la actual a sucursal primero.");
      } else if (msg.includes("branch_type")) {
        setError("La base de datos aún no tiene la migración de sucursales. Ejecute las migraciones desde el menú de la aplicación.");
      } else {
        setError(msg || "Error al guardar el almacén");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {warehouse ? "Editar Sucursal/Almacén" : "Agregar Sucursal/Almacén"}
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
              placeholder="Nombre de la sucursal o almacén"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="branch_type">Tipo</Label>
            <Select
              value={formData.branch_type || "sucursal"}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, branch_type: value as BranchType }))
              }
            >
              <SelectTrigger id="branch_type">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matriz">Casa Matriz</SelectItem>
                <SelectItem value="sucursal">Sucursal</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Solo puede existir una casa matriz.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              name="location"
              value={formData.location || ""}
              onChange={handleChange}
              placeholder="Dirección o ciudad (opcional)"
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
