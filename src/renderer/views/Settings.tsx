import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { CompanySettings } from '../../types';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Database } from 'lucide-react';

const DEFAULT_SETTINGS: CompanySettings = {
  name: 'Inventario Pro - SC',
  taxId: '123456789-0',
  address: 'Calle Principal #123',
  phone: '(123) 456-7890',
  email: 'info@example.com',
  website: 'www.example.com',
  logoUrl: '',
  footerText: '©2025 - Todos los derechos reservados'
};

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [supabaseConfig, setSupabaseConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const win: any = typeof window !== 'undefined' ? (window as any) : {};

  // Cargar configuración guardada al iniciar
  useEffect(() => {
    const savedSettings = localStorage.getItem('companySettings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    }
    // cargar supabase
    if (win.supabaseConfig?.get) {
      setLoadingConfig(true);
      win.supabaseConfig.get().then((cfg: any) => {
        setSupabaseConfig(cfg || null);
      }).finally(() => setLoadingConfig(false));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    try {
      setSaving(true);
      localStorage.setItem('companySettings', JSON.stringify(settings));
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      toast.error('Error al guardar la configuración');
    } finally {
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

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Ajustes</h1>
      
    <Tabs defaultValue="company">
        <TabsList className="mb-6">
          <TabsTrigger value="company">Información de Empresa</TabsTrigger>
          <TabsTrigger value="document">Documentos</TabsTrigger>
          <TabsTrigger value="appearance">Apariencia</TabsTrigger>
      <TabsTrigger value="connection">Conexión</TabsTrigger>
        </TabsList>
        
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Información de Empresa</CardTitle>
              <CardDescription>
                Esta información se mostrará en las facturas, órdenes de compra y otros documentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Empresa</Label>
                  <Input
                    id="name"
                    name="name"
                    value={settings.name}
                    onChange={handleChange}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taxId">NIT/RUT</Label>
                  <Input
                    id="taxId"
                    name="taxId"
                    value={settings.taxId}
                    onChange={handleChange}
                    placeholder="NIT o identificación fiscal"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    name="address"
                    value={settings.address}
                    onChange={handleChange}
                    placeholder="Dirección"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={settings.phone}
                    onChange={handleChange}
                    placeholder="Teléfono"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={settings.email || ''}
                    onChange={handleChange}
                    placeholder="Correo electrónico"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="website">Sitio Web</Label>
                  <Input
                    id="website"
                    name="website"
                    value={settings.website || ''}
                    onChange={handleChange}
                    placeholder="Sitio web"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="document">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Documentos</CardTitle>
              <CardDescription>
                Personaliza cómo se mostrarán tus documentos impresos y PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL del Logo (opcional)</Label>
                  <Input
                    id="logoUrl"
                    name="logoUrl"
                    value={settings.logoUrl || ''}
                    onChange={handleChange}
                    placeholder="URL de imagen del logo"
                  />
                  <p className="text-sm text-gray-500">
                    Ingresa la URL de una imagen para usar como logo en tus documentos.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="footerText">Texto de Pie de Página</Label>
                  <Textarea
                    id="footerText"
                    name="footerText"
                    value={settings.footerText}
                    onChange={handleChange}
                    placeholder="Texto que aparecerá en el pie de página de los documentos"
                    rows={3}
                  />
                </div>
                
                <div className="p-4 bg-gray-100 rounded-md dark:bg-gray-800">
                  <h3 className="font-semibold mb-2">Vista previa del encabezado</h3>
                  <div className="bg-white p-4 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                    <h2 className="font-bold text-lg">{settings.name}</h2>
                    <p>NIT: {settings.taxId}</p>
                    <p>{settings.address}</p>
                    <p>Tel: {settings.phone}</p>
                    {settings.email && <p>{settings.email}</p>}
                    {settings.website && <p>{settings.website}</p>}
                  </div>
                  
                  <h3 className="font-semibold mt-4 mb-2">Vista previa del pie de página</h3>
                  <div className="bg-white p-4 border rounded-md text-center text-sm dark:bg-gray-700 dark:border-gray-600">
                    <p>{settings.footerText}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Apariencia</CardTitle>
              <CardDescription>
                Personaliza la apariencia de la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="theme-switch">Tema Oscuro</Label>
                    <p className="text-sm text-muted-foreground">Cambia entre el tema claro y oscuro.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Sun className="h-5 w-5 text-muted-foreground" />
                    <Switch 
                      id="theme-switch" 
                      checked={theme === 'dark'}
                      onCheckedChange={toggleTheme} 
                    />
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="connection">
          <Card>
            <CardHeader>
              <CardTitle>Conexión Supabase</CardTitle>
              <CardDescription>Configurar o restablecer la conexión al backend.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingConfig ? (
                  <p>Cargando configuración...</p>
                ) : supabaseConfig?.url ? (
                  <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
                    <p><strong>URL:</strong> {supabaseConfig.url}</p>
                    <p className="truncate"><strong>Anon Key:</strong> {supabaseConfig.anonKey?.slice(0,20)}...</p>
                  </div>
                ) : (
                  <p className="text-sm text-yellow-600">No hay configuración guardada.</p>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!win.supabaseConfig?.get) return;
                      setLoadingConfig(true);
                      try { setSupabaseConfig(await win.supabaseConfig.get()); } finally { setLoadingConfig(false); }
                    }}
                  >Refrescar</Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm('¿Eliminar configuración Supabase guardada? Se cerrará la sesión.')) return;
                      try {
                        await win.supabaseConfig.save({ url: '', anonKey: '' });
                        localStorage.removeItem('inventory_session');
                        setSupabaseConfig(null);
                        toast.success('Configuración eliminada. Reinicia o vuelve a abrir para onboarding.');
                      } catch (e:any) {
                        toast.error('Error eliminando configuración');
                      }
                    }}
                  >Eliminar configuración</Button>
                  <Button
                    onClick={() => {
                      // Forzar mostrar Onboarding almacenando un flag y recargando
                      localStorage.removeItem('inventory_session');
                      sessionStorage.setItem('forceOnboarding','1');
                      location.reload();
                    }}
                  >Mostrar Onboarding</Button>
                </div>
                <p className="text-xs text-muted-foreground">Si instalaste por primera vez y no apareció el asistente, puedes forzarlo aquí.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 flex justify-end space-x-4">
        <Button
          variant="outline"
          onClick={handleReset}
        >
          Restablecer valores predeterminados
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
};

export default Settings; 