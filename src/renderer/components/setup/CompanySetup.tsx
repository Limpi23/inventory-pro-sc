import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Esquema para validación del formulario
const companySchema = z.object({
  name: z.string().min(2, 'El nombre es demasiado corto'),
  taxId: z.string().min(5, 'El número de identificación fiscal es requerido'),
  address: z.string().min(5, 'La dirección es demasiado corta'),
  phone: z.string().min(5, 'El teléfono es demasiado corto'),
  email: z.string().email('Email no válido').optional().or(z.literal('')),
  website: z.string().url('URL no válida').optional().or(z.literal('')),
  logoUrl: z.string().optional()
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanySetupProps {
  onComplete: (values: CompanyFormValues) => void;
  initialData: string;
}

const CompanySetup: React.FC<CompanySetupProps> = ({ onComplete, initialData }) => {
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: initialData || 'Mi Empresa',
      taxId: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      logoUrl: '',
    }
  });

  const onSubmit = (values: CompanyFormValues) => {
    onComplete(values);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Información de tu empresa</CardTitle>
        <CardDescription>
          Ingresa los datos de tu negocio para la configuración inicial
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Mi Empresa S.A." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIT / Identificación fiscal</FormLabel>
                  <FormControl>
                    <Input placeholder="123456789-0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Calle Principal #123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="(123) 456-7890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="contacto@miempresa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sitio web (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://miempresa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full mt-6">
              Guardar y continuar
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CompanySetup; 