import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Category } from "../../../types";
import { categoriesService } from "../../../lib/supabase";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import CategoryModal from "./CategoryModal";
import { toast } from "react-hot-toast";

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setIsLoading(true);
      const data = await categoriesService.getAll();
      setCategories(data || []);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
      toast.error("Error al cargar categorías");
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(category: Category) {
    setEditingCategory(category);
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (confirm("¿Estás seguro de que deseas eliminar esta categoría?")) {
      try {
        await categoriesService.delete(id);
        fetchCategories();
        toast.success("Categoría eliminada correctamente");
      } catch (error) {
        console.error("Error al eliminar categoría:", error);
        toast.error("Error al eliminar categoría");
      }
    }
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingCategory(null);
    fetchCategories();
  }

  // Función para manejar la importación de categorías
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar que sea un archivo CSV
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error("Por favor, selecciona un archivo CSV válido");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setIsImporting(true);
      
      // Leer el contenido del archivo
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvContent = event.target?.result as string;
          
          // Importar las categorías desde el CSV
          const result = await categoriesService.importFromCSV(csvContent);
          
          if (result.success > 0) {
            toast.success(`Se importaron ${result.success} categorías correctamente`);
            fetchCategories(); // Actualizar la lista de categorías
          }
          
          if (result.errors > 0) {
            toast.error(`No se pudieron importar ${result.errors} categorías`);
            console.error("Errores de importación:", result.messages);
          }
          
        } catch (error) {
          console.error("Error al procesar el archivo CSV:", error);
          toast.error("Error al procesar el archivo");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      
      reader.readAsText(file);
      
    } catch (error) {
      console.error("Error al importar categorías:", error);
      toast.error("Error al importar categorías");
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Función para exportar categorías a CSV
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const csvContent = await categoriesService.exportToCSV();
      
      // Crear un blob con el contenido CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Crear un enlace para descargar el archivo y hacer clic en él
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `categorias_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Categorías exportadas correctamente");
    } catch (error) {
      console.error("Error al exportar categorías:", error);
      toast.error("Error al exportar categorías");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categorías</CardTitle>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <Button 
            onClick={handleImportClick} 
            variant="outline"
            disabled={isImporting}
          >
            {isImporting ? "Importando..." : "Importar CSV"}
          </Button>
          <Button 
            onClick={handleExport} 
            variant="outline"
            disabled={isExporting || categories.length === 0}
          >
            {isExporting ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            Agregar Categoría
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Cargando categorías...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">
                    No hay categorías registradas
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>{category.description || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => handleEdit(category)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
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

      <CategoryModal
        open={isModalOpen}
        onClose={handleModalClose}
        category={editingCategory}
      />
    </Card>
  );
} 