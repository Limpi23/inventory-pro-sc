import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// Esquema de validación para el formulario
const dbSetupSchema = z.object({
  setupType: z.enum(['new', 'existing']),
  companyName: z.string().min(2, 'El nombre de la empresa es demasiado corto'),
  // Campos para configuración de Supabase
  supabaseUrl: z.string().url('URL de Supabase no válida').optional(),
  supabaseKey: z.string().min(10, 'Clave de Supabase no válida').optional(),
});

type DbSetupFormValues = z.infer<typeof dbSetupSchema>;

interface DatabaseSetupProps {
  onComplete: (values: DbSetupFormValues) => void;
  isFirstRun: boolean;
}

const DatabaseSetup: React.FC<DatabaseSetupProps> = ({ onComplete, isFirstRun }) => {
  const [testing, setTesting] = useState(false);
  
  const form = useForm<DbSetupFormValues>({
    resolver: zodResolver(dbSetupSchema),
    defaultValues: {
      setupType: isFirstRun ? 'new' : 'existing',
      companyName: '',
      supabaseUrl: '',
      supabaseKey: '',
    },
  });

  const setupType = form.watch('setupType');

  // Función para probar la conexión
  const testConnection = async () => {
    try {
      setTesting(true);
      
      // Aquí añadimos la lógica para probar la conexión
      // Simulando una demora en la prueba
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // En un caso real, aquí verificaríamos la conexión a Supabase
      
      toast.success('Conexión exitosa a la base de datos');
      return true;
    } catch (error) {
      toast.error(`Error al conectar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return false;
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async (values: DbSetupFormValues) => {
    if (values.setupType === 'existing') {
      const isConnected = await testConnection();
      if (!isConnected) return;
    }
    
    onComplete(values);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Configuración de base de datos</CardTitle>
        <CardDescription>
          {isFirstRun 
            ? 'Configura la base de datos para tu empresa' 
            : 'Conecta con una base de datos existente o crea una nueva'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="setupType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de configuración</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="new" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Nueva instalación
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="existing" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Conectar a base de datos existente
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {setupType === 'new' 
                      ? 'Se creará una nueva base de datos para tu empresa' 
                      : 'Te conectarás a una base de datos creada previamente'}
                  </FormDescription>
                </FormItem>
              )}
            />

            {setupType === 'new' && (
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de tu empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Ejemplo: Mi Empresa S.A." {...field} />
                    </FormControl>
                    <FormDescription>
                      Este nombre se usará para identificar tu negocio en el sistema
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {setupType === 'existing' && (
              <>
                <FormField
                  control={form.control}
                  name="supabaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL de Supabase</FormLabel>
                      <FormControl>
                        <Input placeholder="https://tu-proyecto.supabase.co" {...field} />
                      </FormControl>
                      <FormDescription>
                        URL del proyecto Supabase existente
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="supabaseKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave anónima de Supabase</FormLabel>
                      <FormControl>
                        <Input placeholder="eyJhbGciOiJIUzI1NiIsInR5c..." type="password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Clave anónima (anon key) del proyecto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testing}
                  className="w-full"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Probando conexión...
                    </>
                  ) : (
                    'Probar conexión'
                  )}
                </Button>
              </>
            )}
            
            <Button type="submit" className="w-full">
              {setupType === 'new' ? 'Crear' : 'Conectar'} y continuar
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default DatabaseSetup; 