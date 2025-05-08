import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from './ui/dialog';
import { Button } from './ui/button';
import { HelpCircle } from 'lucide-react';

const SubscriptionHelpButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-gray-500 hover:text-gray-700 rounded-full"
          aria-label="Información de suscripción"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Información de Suscripción</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section>
            <h3 className="text-lg font-medium text-blue-600">Plan Mensual - 280Bs./Mensual</h3>
            <p className="text-sm text-gray-600 mt-1">
              InventorySuit funciona con un modelo de suscripción mensual que te brinda acceso 
              a todas las funcionalidades del sistema.
            </p>
          </section>
          
          <section>
            <h4 className="font-medium mb-2">Beneficios incluidos:</h4>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Gestión completa de inventario</li>
              <li>Control de múltiples almacenes</li>
              <li>Reportes detallados de ventas y compras</li>
              <li>Gestión de usuarios y permisos</li>
              <li>Exportación de datos a CSV</li>
              <li>Soporte técnico prioritario</li>
              <li>Actualizaciones constantes</li>
            </ul>
          </section>
          
          <section>
            <h4 className="font-medium mb-2">¿Cómo funciona?</h4>
            <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
              <li>La suscripción tiene validez por 30 días</li>
              <li>Recibirás notificaciones cuando esté próxima a vencer</li>
              <li>Puedes renovar fácilmente desde el panel principal</li>
              <li>Si vence, el sistema se bloqueará hasta la renovación</li>
            </ol>
          </section>
          
          <section className="bg-gray-50 p-3 rounded-md">
            <h4 className="font-medium mb-1">Contacto para soporte y renovaciones:</h4>
            <p className="text-sm text-gray-600">
              WhatsApp: +591 73099696<br />
              Email: soporte@inventorysuit.com
            </p>
          </section>
          
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Entendido</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionHelpButton; 