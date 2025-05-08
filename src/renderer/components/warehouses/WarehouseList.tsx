import { useEffect, useState } from "react";
import { Warehouse } from "../../../types";
import { warehousesService } from "../../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import WarehouseModal from "./WarehouseModal";

export default function WarehouseList() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  async function fetchWarehouses() {
    try {
      setIsLoading(true);
      const data = await warehousesService.getAll();
      setWarehouses(data || []);
    } catch (error) {
      console.error("Error al cargar almacenes:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(warehouse: Warehouse) {
    setEditingWarehouse(warehouse);
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de que deseas eliminar este almacén?")) {
      try {
        await warehousesService.delete(id);
        fetchWarehouses();
      } catch (error) {
        console.error("Error al eliminar almacén:", error);
      }
    }
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingWarehouse(null);
    fetchWarehouses();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Almacenes</CardTitle>
        <Button onClick={() => setIsModalOpen(true)}>
          Agregar Almacén
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Cargando almacenes...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No hay almacenes registrados
                  </TableCell>
                </TableRow>
              ) : (
                warehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell>{warehouse.name}</TableCell>
                    <TableCell>{warehouse.location || "-"}</TableCell>
                    <TableCell>{warehouse.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => handleEdit(warehouse)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(warehouse.id)}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <WarehouseModal
        open={isModalOpen}
        onClose={handleModalClose}
        warehouse={editingWarehouse}
      />
    </Card>
  );
} 