import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';
const DEFAULT_SETTINGS = {
    name: 'Inventario Pro - SC',
    taxId: '123456789-0',
    address: 'Calle Principal #123',
    phone: '(123) 456-7890',
    email: 'info@example.com',
    website: 'www.example.com',
    logoUrl: '',
    footerText: '©2025 - Todos los derechos reservados'
};
const Settings = () => {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const [supabaseConfig, setSupabaseConfig] = useState(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const win = typeof window !== 'undefined' ? window : {};
    // Cargar configuración guardada al iniciar
    useEffect(() => {
        const savedSettings = localStorage.getItem('companySettings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            }
            catch (error) {
                console.error('Error al cargar configuración:', error);
            }
        }
        // cargar supabase
        if (win.supabaseConfig?.get) {
            setLoadingConfig(true);
            win.supabaseConfig.get().then((cfg) => {
                setSupabaseConfig(cfg || null);
            }).finally(() => setLoadingConfig(false));
        }
    }, []);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };
    const handleSave = () => {
        try {
            setSaving(true);
            localStorage.setItem('companySettings', JSON.stringify(settings));
            toast.success('Configuración guardada correctamente');
        }
        catch (error) {
            console.error('Error al guardar configuración:', error);
            toast.error('Error al guardar la configuración');
        }
        finally {
            setSaving(false);
        }
    };
    const handleReset = () => {
        if (confirm('¿Estás seguro de restablecer la configuración a valores predeterminados?')) {
            setSettings(DEFAULT_SETTINGS);
            localStorage.removeItem('companySettings');
            toast.success('Configuración restablecida');
        }
    };
    return (_jsxs("div", { className: "container mx-auto py-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Ajustes" }), _jsxs(Tabs, { defaultValue: "company", children: [_jsxs(TabsList, { className: "mb-6", children: [_jsx(TabsTrigger, { value: "company", children: "Informaci\u00F3n de Empresa" }), _jsx(TabsTrigger, { value: "document", children: "Documentos" }), _jsx(TabsTrigger, { value: "appearance", children: "Apariencia" }), _jsx(TabsTrigger, { value: "connection", children: "Conexi\u00F3n" })] }), _jsx(TabsContent, { value: "company", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Informaci\u00F3n de Empresa" }), _jsx(CardDescription, { children: "Esta informaci\u00F3n se mostrar\u00E1 en las facturas, \u00F3rdenes de compra y otros documentos." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Nombre de la Empresa" }), _jsx(Input, { id: "name", name: "name", value: settings.name, onChange: handleChange, placeholder: "Nombre de la empresa" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "taxId", children: "NIT/RUT" }), _jsx(Input, { id: "taxId", name: "taxId", value: settings.taxId, onChange: handleChange, placeholder: "NIT o identificaci\u00F3n fiscal" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "address", children: "Direcci\u00F3n" }), _jsx(Input, { id: "address", name: "address", value: settings.address, onChange: handleChange, placeholder: "Direcci\u00F3n" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "phone", children: "Tel\u00E9fono" }), _jsx(Input, { id: "phone", name: "phone", value: settings.phone, onChange: handleChange, placeholder: "Tel\u00E9fono" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "Correo Electr\u00F3nico" }), _jsx(Input, { id: "email", name: "email", type: "email", value: settings.email || '', onChange: handleChange, placeholder: "Correo electr\u00F3nico" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "website", children: "Sitio Web" }), _jsx(Input, { id: "website", name: "website", value: settings.website || '', onChange: handleChange, placeholder: "Sitio web" })] })] }) })] }) }), _jsx(TabsContent, { value: "document", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Configuraci\u00F3n de Documentos" }), _jsx(CardDescription, { children: "Personaliza c\u00F3mo se mostrar\u00E1n tus documentos impresos y PDF." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "logoUrl", children: "URL del Logo (opcional)" }), _jsx(Input, { id: "logoUrl", name: "logoUrl", value: settings.logoUrl || '', onChange: handleChange, placeholder: "URL de imagen del logo" }), _jsx("p", { className: "text-sm text-gray-500", children: "Ingresa la URL de una imagen para usar como logo en tus documentos." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "footerText", children: "Texto de Pie de P\u00E1gina" }), _jsx(Textarea, { id: "footerText", name: "footerText", value: settings.footerText, onChange: handleChange, placeholder: "Texto que aparecer\u00E1 en el pie de p\u00E1gina de los documentos", rows: 3 })] }), _jsxs("div", { className: "p-4 bg-gray-100 rounded-md dark:bg-gray-800", children: [_jsx("h3", { className: "font-semibold mb-2", children: "Vista previa del encabezado" }), _jsxs("div", { className: "bg-white p-4 border rounded-md dark:bg-gray-700 dark:border-gray-600", children: [_jsx("h2", { className: "font-bold text-lg", children: settings.name }), _jsxs("p", { children: ["NIT: ", settings.taxId] }), _jsx("p", { children: settings.address }), _jsxs("p", { children: ["Tel: ", settings.phone] }), settings.email && _jsx("p", { children: settings.email }), settings.website && _jsx("p", { children: settings.website })] }), _jsx("h3", { className: "font-semibold mt-4 mb-2", children: "Vista previa del pie de p\u00E1gina" }), _jsx("div", { className: "bg-white p-4 border rounded-md text-center text-sm dark:bg-gray-700 dark:border-gray-600", children: _jsx("p", { children: settings.footerText }) })] })] }) })] }) }), _jsx(TabsContent, { value: "appearance", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Apariencia" }), _jsx(CardDescription, { children: "Personaliza la apariencia de la aplicaci\u00F3n." })] }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { htmlFor: "theme-switch", children: "Tema Oscuro" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Cambia entre el tema claro y oscuro." })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Sun, { className: "h-5 w-5 text-muted-foreground" }), _jsx(Switch, { id: "theme-switch", checked: theme === 'dark', onCheckedChange: toggleTheme }), _jsx(Moon, { className: "h-5 w-5 text-muted-foreground" })] })] }) }) })] }) }), _jsx(TabsContent, { value: "connection", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Conexi\u00F3n Supabase" }), _jsx(CardDescription, { children: "Configurar o restablecer la conexi\u00F3n al backend." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-4", children: [loadingConfig ? (_jsx("p", { children: "Cargando configuraci\u00F3n..." })) : supabaseConfig?.url ? (_jsxs("div", { className: "p-3 border rounded-md bg-gray-50 dark:bg-gray-800 text-sm", children: [_jsxs("p", { children: [_jsx("strong", { children: "URL:" }), " ", supabaseConfig.url] }), _jsxs("p", { className: "truncate", children: [_jsx("strong", { children: "Anon Key:" }), " ", supabaseConfig.anonKey?.slice(0, 20), "..."] })] })) : (_jsx("p", { className: "text-sm text-yellow-600", children: "No hay configuraci\u00F3n guardada." })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { variant: "outline", onClick: async () => {
                                                            if (!win.supabaseConfig?.get)
                                                                return;
                                                            setLoadingConfig(true);
                                                            try {
                                                                setSupabaseConfig(await win.supabaseConfig.get());
                                                            }
                                                            finally {
                                                                setLoadingConfig(false);
                                                            }
                                                        }, children: "Refrescar" }), _jsx(Button, { variant: "destructive", onClick: async () => {
                                                            if (!confirm('¿Eliminar configuración Supabase guardada? Se cerrará la sesión.'))
                                                                return;
                                                            try {
                                                                await win.supabaseConfig.save({ url: '', anonKey: '' });
                                                                localStorage.removeItem('inventory_session');
                                                                setSupabaseConfig(null);
                                                                toast.success('Configuración eliminada. Reinicia o vuelve a abrir para onboarding.');
                                                            }
                                                            catch (e) {
                                                                toast.error('Error eliminando configuración');
                                                            }
                                                        }, children: "Eliminar configuraci\u00F3n" }), _jsx(Button, { onClick: () => {
                                                            // Forzar mostrar Onboarding almacenando un flag y recargando
                                                            localStorage.removeItem('inventory_session');
                                                            sessionStorage.setItem('forceOnboarding', '1');
                                                            location.reload();
                                                        }, children: "Mostrar Onboarding" })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Si instalaste por primera vez y no apareci\u00F3 el asistente, puedes forzarlo aqu\u00ED." })] }) })] }) })] }), _jsxs("div", { className: "mt-6 flex justify-end space-x-4", children: [_jsx(Button, { variant: "outline", onClick: handleReset, children: "Restablecer valores predeterminados" }), _jsx(Button, { onClick: handleSave, disabled: saving, children: saving ? 'Guardando...' : 'Guardar configuración' })] })] }));
};
export default Settings;
