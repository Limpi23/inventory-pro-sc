import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle } from 'lucide-react';

interface SetupCompleteProps {
  setupData: any;
  onComplete: () => void;
}

const SetupComplete: React.FC<SetupCompleteProps> = ({ setupData, onComplete }) => {
  return (
    <Card className="w-full max-w-md mx-auto text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <CardTitle className="text-2xl">¡Configuración completada!</CardTitle>
        <CardDescription>
          La configuración inicial de tu sistema ha sido completada con éxito.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <h3 className="font-semibold text-lg mb-2">Resumen</h3>
          
          <div className="text-left mb-4">
            <p className="font-medium">Empresa:</p>
            <p>{setupData.company?.name}</p>
          </div>
          
          <div className="text-left">
            <p className="font-medium">Tipo de configuración:</p>
            <p>
              {setupData.database?.setupType === 'new' 
                ? 'Nueva instalación' 
                : 'Conexión a base de datos existente'}
            </p>
          </div>
        </div>
        
        <p className="text-muted-foreground">
          Ya puedes comenzar a utilizar el sistema. Puedes modificar la configuración en cualquier momento desde la sección de ajustes.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={onComplete} className="w-full">
          Iniciar aplicación
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SetupComplete; 