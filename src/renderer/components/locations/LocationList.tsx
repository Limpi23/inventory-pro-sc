import { useEffect, useState } from 'react';
import { Location } from '../../../types';
import { locationsService } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import LocationModal from './LocationModal';

export default function LocationList() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    try {
      setLoading(true);
      const data = await locationsService.getAll();
      setLocations(data || []);
    } catch (e) {
      console.error('Error cargando ubicaciones', e);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (loc: Location) => { setEditing(loc); setModalOpen(true); };
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar ubicación?')) return;
    try {
      await locationsService.delete(id);
      fetchLocations();
    } catch (e) {
      console.error('Error eliminando ubicación', e);
    }
  };
  const handleClose = () => { setModalOpen(false); setEditing(null); fetchLocations(); };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Ubicaciones</CardTitle>
        <Button onClick={() => setModalOpen(true)}>Agregar Ubicación</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Cargando ubicaciones...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">No hay ubicaciones</TableCell>
                </TableRow>
              ) : (
                locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>{loc.name}</TableCell>
                    <TableCell>{loc.description || '-'}</TableCell>
                    <TableCell>{loc.warehouse_id ? 'Asignado' : '-'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(loc)} className="gap-2">
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(loc.id)} className="gap-2 text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <LocationModal open={modalOpen} onClose={handleClose} location={editing} />
    </Card>
  );
}
