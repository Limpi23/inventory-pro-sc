import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
const CompanySetup = ({ onComplete, initialData }) => {
    const form = useForm({
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
    const onSubmit = (values) => {
        onComplete(values);
    };
    return (_jsxs(Card, { className: "w-full max-w-md mx-auto", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Informaci\u00F3n de tu empresa" }), _jsx(CardDescription, { children: "Ingresa los datos de tu negocio para la configuraci\u00F3n inicial" })] }), _jsx(CardContent, { children: _jsx(Form, { ...form, children: _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-4", children: [_jsx(FormField, { control: form.control, name: "name", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Nombre de la empresa" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "Mi Empresa S.A.", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "taxId", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "NIT / Identificaci\u00F3n fiscal" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "123456789-0", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "address", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Direcci\u00F3n" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "Calle Principal #123", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "phone", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Tel\u00E9fono" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "(123) 456-7890", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "email", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Email (opcional)" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "contacto@miempresa.com", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(FormField, { control: form.control, name: "website", render: ({ field }) => (_jsxs(FormItem, { children: [_jsx(FormLabel, { children: "Sitio web (opcional)" }), _jsx(FormControl, { children: _jsx(Input, { placeholder: "https://miempresa.com", ...field }) }), _jsx(FormMessage, {})] })) }), _jsx(Button, { type: "submit", className: "w-full mt-6", children: "Guardar y continuar" })] }) }) })] }));
};
export default CompanySetup;
