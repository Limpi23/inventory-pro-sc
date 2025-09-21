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
import { eventLogService } from '../lib/supabase';
import { useCurrency } from '../hooks/useCurrency';
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
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const win = typeof window !== 'undefined' ? window : {};
    const currency = useCurrency();
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
    useEffect(() => {
        // cargar últimos eventos al abrir ajustes
        (async () => {
            try {
                setLoadingEvents(true);
                const logs = await eventLogService.list({ limit: 200 });
                setEvents(logs);
            }
            catch (e) {
                console.warn('No se pudieron cargar eventos', e);
            }
            finally {
                setLoadingEvents(false);
            }
        })();
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
    return (_jsxs("div", { className: "container mx-auto py-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Ajustes" }), _jsxs(Tabs, { defaultValue: "company", children: [_jsxs(TabsList, { className: "mb-6", children: [_jsx(TabsTrigger, { value: "company", children: "Informaci\u00F3n de Empresa" }), _jsx(TabsTrigger, { value: "document", children: "Documentos" }), _jsx(TabsTrigger, { value: "appearance", children: "Apariencia" }), _jsx(TabsTrigger, { value: "connection", children: "Conexi\u00F3n" }), _jsx(TabsTrigger, { value: "events", children: "Eventos" }), _jsx(TabsTrigger, { value: "currency", children: "Moneda" })] }), _jsx(TabsContent, { value: "currency", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Moneda y Tipo de Cambio" }), _jsx(CardDescription, { children: "Define c\u00F3mo mostrar los precios (Bs.) y el tipo de cambio desde USD." })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Moneda base (almacenamiento)" }), _jsx(Input, { disabled: true, value: currency.settings.baseCurrency }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Los precios se guardan en ", currency.settings.baseCurrency, " por defecto."] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Moneda de visualizaci\u00F3n" }), _jsxs("select", { className: "w-full border rounded-md px-3 py-2", value: currency.settings.displayCurrency, onChange: (e) => currency.set({ displayCurrency: e.target.value }), children: [_jsx("option", { value: "BOB", children: "Bolivianos (Bs.)" }), _jsx("option", { value: "VES", children: "Bol\u00EDvares (Bs.)" }), _jsx("option", { value: "USD", children: "D\u00F3lares (USD)" }), _jsx("option", { value: "COP", children: "Pesos (COP)" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { children: ["Tipo de cambio (1 ", currency.settings.baseCurrency, " \u2192 ", currency.settings.displayCurrency, ")"] }), _jsx(Input, { type: "number", step: "0.0001", min: "0", value: currency.settings.exchangeRate, onChange: (e) => currency.set({ exchangeRate: Number(e.target.value) || 0 }) }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["\u00DAltima actualizaci\u00F3n: ", new Date(currency.settings.lastUpdated || '').toLocaleString('es-BO')] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Formato regional" }), _jsxs("select", { className: "w-full border rounded-md px-3 py-2", value: currency.settings.locale, onChange: (e) => currency.set({ locale: e.target.value }), children: [_jsx("option", { value: "es-BO", children: "es-BO (Bolivia)" }), _jsx("option", { value: "es-VE", children: "es-VE (Venezuela)" }), _jsx("option", { value: "es-CO", children: "es-CO (Colombia)" }), _jsx("option", { value: "es-CL", children: "es-CL (Chile)" }), _jsx("option", { value: "es-PE", children: "es-PE (Per\u00FA)" }), _jsx("option", { value: "es-AR", children: "es-AR (Argentina)" })] })] })] }), _jsxs("div", { className: "mt-6 flex gap-3", children: [_jsx(Button, { variant: "outline", onClick: () => currency.reset(), children: "Restablecer" }), _jsx(Button, { onClick: () => toast.success('Preferencias de moneda guardadas'), children: "Guardar" })] }), _jsxs("div", { className: "mt-6 p-3 border rounded-md text-sm", children: [_jsx("p", { className: "mb-1 font-medium", children: "Vista previa" }), _jsxs("p", { children: ["100 en base \u2192 ", currency.format(100), " mostrados"] })] })] })] }) }), _jsx(TabsContent, { value: "company", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Informaci\u00F3n de Empresa" }), _jsx(CardDescription, { children: "Esta informaci\u00F3n se mostrar\u00E1 en las facturas, \u00F3rdenes de compra y otros documentos." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "name", children: "Nombre de la Empresa" }), _jsx(Input, { id: "name", name: "name", value: settings.name, onChange: handleChange, placeholder: "Nombre de la empresa" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "taxId", children: "NIT/RUT" }), _jsx(Input, { id: "taxId", name: "taxId", value: settings.taxId, onChange: handleChange, placeholder: "NIT o identificaci\u00F3n fiscal" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "address", children: "Direcci\u00F3n" }), _jsx(Input, { id: "address", name: "address", value: settings.address, onChange: handleChange, placeholder: "Direcci\u00F3n" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "phone", children: "Tel\u00E9fono" }), _jsx(Input, { id: "phone", name: "phone", value: settings.phone, onChange: handleChange, placeholder: "Tel\u00E9fono" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "Correo Electr\u00F3nico" }), _jsx(Input, { id: "email", name: "email", type: "email", value: settings.email || '', onChange: handleChange, placeholder: "Correo electr\u00F3nico" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "website", children: "Sitio Web" }), _jsx(Input, { id: "website", name: "website", value: settings.website || '', onChange: handleChange, placeholder: "Sitio web" })] })] }) })] }) }), _jsx(TabsContent, { value: "events", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Eventos de la aplicaci\u00F3n" }), _jsx(CardDescription, { children: "Registros de acciones realizadas por los usuarios (auditor\u00EDa)." })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "flex items-center gap-2 mb-3", children: _jsx(Button, { variant: "outline", onClick: async () => { setLoadingEvents(true); try {
                                                    setEvents(await eventLogService.list({ limit: 200 }));
                                                }
                                                finally {
                                                    setLoadingEvents(false);
                                                } }, children: "Refrescar" }) }), loadingEvents ? (_jsx("p", { children: "Cargando eventos..." })) : events.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "A\u00FAn no hay eventos." })) : (_jsx("div", { className: "overflow-x-auto -mx-4 md:mx-0", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left border-b", children: [_jsx("th", { className: "py-2 px-3", children: "Fecha" }), _jsx("th", { className: "py-2 px-3", children: "Usuario" }), _jsx("th", { className: "py-2 px-3", children: "Acci\u00F3n" }), _jsx("th", { className: "py-2 px-3", children: "Entidad" }), _jsx("th", { className: "py-2 px-3", children: "ID" }), _jsx("th", { className: "py-2 px-3", children: "Detalles" })] }) }), _jsx("tbody", { children: events.map(ev => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "py-2 px-3 whitespace-nowrap", children: new Date(ev.created_at || '').toLocaleString(currency.settings.locale) }), _jsx("td", { className: "py-2 px-3", children: ev.actor_email || '-' }), _jsx("td", { className: "py-2 px-3", children: ev.action }), _jsx("td", { className: "py-2 px-3", children: ev.entity || '-' }), _jsx("td", { className: "py-2 px-3", children: ev.entity_id || '-' }), _jsx("td", { className: "py-2 px-3 max-w-[360px] truncate", title: JSON.stringify(ev.details), children: ev.details ? JSON.stringify(ev.details) : '-' })] }, ev.id || ev.created_at + String(ev.entity_id)))) })] }) }))] })] }) }), _jsx(TabsContent, { value: "document", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Configuraci\u00F3n de Documentos" }), _jsx(CardDescription, { children: "Personaliza c\u00F3mo se mostrar\u00E1n tus documentos impresos y PDF." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "logoUrl", children: "URL del Logo (opcional)" }), _jsx(Input, { id: "logoUrl", name: "logoUrl", value: settings.logoUrl || '', onChange: handleChange, placeholder: "URL de imagen del logo" }), _jsx("p", { className: "text-sm text-gray-500", children: "Ingresa la URL de una imagen para usar como logo en tus documentos." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "footerText", children: "Texto de Pie de P\u00E1gina" }), _jsx(Textarea, { id: "footerText", name: "footerText", value: settings.footerText, onChange: handleChange, placeholder: "Texto que aparecer\u00E1 en el pie de p\u00E1gina de los documentos", rows: 3 })] }), _jsxs("div", { className: "p-4 bg-gray-100 rounded-md dark:bg-gray-800", children: [_jsx("h3", { className: "font-semibold mb-2", children: "Vista previa del encabezado" }), _jsxs("div", { className: "bg-white p-4 border rounded-md dark:bg-gray-700 dark:border-gray-600", children: [_jsx("h2", { className: "font-bold text-lg", children: settings.name }), _jsxs("p", { children: ["NIT: ", settings.taxId] }), _jsx("p", { children: settings.address }), _jsxs("p", { children: ["Tel: ", settings.phone] }), settings.email && _jsx("p", { children: settings.email }), settings.website && _jsx("p", { children: settings.website })] }), _jsx("h3", { className: "font-semibold mt-4 mb-2", children: "Vista previa del pie de p\u00E1gina" }), _jsx("div", { className: "bg-white p-4 border rounded-md text-center text-sm dark:bg-gray-700 dark:border-gray-600", children: _jsx("p", { children: settings.footerText }) })] })] }) })] }) }), _jsx(TabsContent, { value: "appearance", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Apariencia" }), _jsx(CardDescription, { children: "Personaliza la apariencia de la aplicaci\u00F3n." })] }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { htmlFor: "theme-switch", children: "Tema Oscuro" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Cambia entre el tema claro y oscuro." })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Sun, { className: "h-5 w-5 text-muted-foreground" }), _jsx(Switch, { id: "theme-switch", checked: theme === 'dark', onCheckedChange: toggleTheme }), _jsx(Moon, { className: "h-5 w-5 text-muted-foreground" })] })] }) }) })] }) }), _jsx(TabsContent, { value: "connection", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Conexi\u00F3n Supabase" }), _jsx(CardDescription, { children: "Configurar o restablecer la conexi\u00F3n al backend." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-4", children: [loadingConfig ? (_jsx("p", { children: "Cargando configuraci\u00F3n..." })) : supabaseConfig?.url ? (_jsxs("div", { className: "p-3 border rounded-md bg-gray-50 dark:bg-gray-800 text-sm", children: [_jsxs("p", { children: [_jsx("strong", { children: "URL:" }), " ", supabaseConfig.url] }), _jsxs("p", { className: "truncate", children: [_jsx("strong", { children: "Anon Key:" }), " ", supabaseConfig.anonKey?.slice(0, 20), "..."] })] })) : (_jsx("p", { className: "text-sm text-yellow-600", children: "No hay configuraci\u00F3n guardada." })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { variant: "outline", onClick: async () => {
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
