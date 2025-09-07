import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
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
const DatabaseSetup = ({ onComplete, isFirstRun }) => {
    const [testing, setTesting] = useState(false);
    const form = useForm({
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
        }
        catch (error) {
            toast.error(`Error al conectar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return false;
        }
        finally {
            setTesting(false);
        }
    };
    const onSubmit = async (values) => {
        if (values.setupType === 'existing') {
            const isConnected = await testConnection();
            if (!isConnected)
                return;
        }
        onComplete(values);
    };
    return (_jsxs(Card, { className: "w-full max-w-md mx-auto", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Configuraci\u00F3n de base de datos" }), _jsx(CardDescription, { children: isFirstRun
                            ? 'Configura la base de datos para tu empresa'
                            : 'Conecta con una base de datos existente o crea una nueva' })] }), _jsx(CardContent, { children: _jsx(Form, { ...form, children: _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-6", children: [_jsx(FormField, { control: form.control, name: "setupType", render: ({ field }) => (_jsxs(FormItem, { className: "space-y-3", children: [_jsx(FormLabel, { children: "Tipo de configuraci\u00F3n" }), _jsx(FormControl, { children: _jsxs(RadioGroup, { onValueChange: field.onChange, defaultValue: field.value, className: "flex flex-col space-y-1", children: [_jsxs(FormItem, { className: "flex items-center space-x-3 space-y-0", children: [_jsx(FormControl, { children: _jsx(RadioGroupItem, { value: "new" }) }), _jsx(FormLabel, { className: "font-normal", children: "Nueva instalaci\u00F3n" })] }), _jsxs(FormItem, { className: "flex items-center space-x-3 space-y-0", children: [_jsx(FormControl, { children: _jsx(RadioGroupItem, { value: "existing" }) }), _jsx(FormLabel, { className: "font-normal", children: "Conectar a base de datos existente" })] })] }) }), _jsx(FormDescription, { children: setupType === 'new'
                                                ? 'Se creará una nueva base de datos para tu empresa'
                                                : 'Te conectarás a una base de datos creada previamente' })] })) }), setupType === 'new' && (_jsx(FormField, { control: form.control, name: "companyName", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Nombre de tu empresa" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "Ejemplo: Mi Empresa S.A.", ...field }) }), _jsx(FormDescription, { children: "Este nombre se usar\u00E1 para identificar tu negocio en el sistema" }), _jsx(FormMessage, {})] })) })), setupType === 'existing' && (_jsxs(_Fragment, { children: [_jsx(FormField, { control: form.control, name: "supabaseUrl", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "URL de Supabase" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "https://tu-proyecto.supabase.co", ...field }) }), _jsx(FormDescription, { children: "URL del proyecto Supabase existente" }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "supabaseKey", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Clave an\u00F3nima de Supabase" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "eyJhbGciOiJIUzI1NiIsInR5c...", type: "password", ...field }) }), _jsx(FormDescription, { children: "Clave an\u00F3nima (anon key) del proyecto" }), _jsx(FormMessage, {})] })) }), _jsx(Button, { type: "button", variant: "outline", onClick: testConnection, disabled: testing, className: "w-full", children: testing ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Probando conexi\u00F3n..."] })) : ('Probar conexión') })] })), _jsxs(Button, { type: "submit", className: "w-full", children: [setupType === 'new' ? 'Crear' : 'Conectar', " y continuar"] })] }) }) })] }));
};
export default DatabaseSetup;
