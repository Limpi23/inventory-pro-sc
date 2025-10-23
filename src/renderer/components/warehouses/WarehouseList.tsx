import { useEffect, useState } from "react";
import { Warehouse } from "../../../types";
import { warehousesService } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import WarehouseModal from "./WarehouseModal";

export default function WarehouseList() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
    if (confirm("Estás seguro de que deseas eliminar este almacén?")) {
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

  const filteredWarehouses = warehouses.filter((warehouse) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      warehouse.name.toLowerCase().includes(searchLower) ||
      warehouse.location?.toLowerCase().includes(searchLower) ||
      warehouse.description?.toLowerCase().includes(searchLower)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentWarehouses = filteredWarehouses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredWarehouses.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl md:text-2xl">Almacenes</CardTitle>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
            size="sm"
          >
            <i className="fas fa-plus mr-2"></i>
            Agregar Almacén
          </Button>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-gray-400"></i>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, ubicación o descripción..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentWarehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      {searchTerm ? (
                        <div className="flex flex-col items-center text-gray-500">
                          <i className="fas fa-search text-4xl mb-2 text-gray-300"></i>
                          <p>No se encontraron resultados para "{searchTerm}"</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-gray-500">
                          <i className="fas fa-warehouse text-4xl mb-2 text-gray-300"></i>
                          <p>No hay almacenes registrados</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentWarehouses.map((warehouse) => (
                    <TableRow key={warehouse.id}>
                      <TableCell className="font-medium">{warehouse.name}</TableCell>
                      <TableCell>{warehouse.location || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{warehouse.description || "-"}</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 px-2">
                              <i className="fas fa-ellipsis-v mr-2"></i>
                              Acciones
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[180px]">
                            <DropdownMenuItem onClick={() => handleEdit(warehouse)}>
                              <i className="fas fa-edit text-muted-foreground"></i>
                              <span className="ml-2">Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(warehouse.id)}
                              className="text-red-600 focus:text-red-700"
                            >
                              <i className="fas fa-trash"></i>
                              <span className="ml-2">Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filteredWarehouses.length > itemsPerPage && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredWarehouses.length)} de {filteredWarehouses.length} almacenes
                </div>
                <div className="flex space-x-1">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                    <i className="fas fa-chevron-left"></i>
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) pageNumber = i + 1;
                    else if (currentPage <= 3) pageNumber = i + 1;
                    else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + i;
                    else pageNumber = currentPage - 2 + i;
                    return (
                      <Button key={pageNumber} variant={currentPage === pageNumber ? "default" : "outline"} size="sm" onClick={() => handlePageChange(pageNumber)} className={currentPage === pageNumber ? "bg-blue-600 hover:bg-blue-700" : ""}>
                        {pageNumber}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                    <i className="fas fa-chevron-right"></i>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <WarehouseModal open={isModalOpen} onClose={handleModalClose} warehouse={editingWarehouse} />
    </Card>
  );
}
