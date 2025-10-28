import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from './ui/dialog';
import { migrationService, MigrationProgress } from '../lib/migrationService';
import MigrationProgressUI from './MigrationProgressUI';

interface SupabaseConfigModalProps {
  onFinish: () => void;
  onClose: () => void;
}

const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ onFinish, onClose }) => {
  const [url, setUrl] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [showMigrationProgress, setShowMigrationProgress] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const win: any = typeof window !== 'undefined' ? (window as any) : {};

  useEffect(() => {
    if (win.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
      win.supabaseConfig.get().then((config: any) => {
        setUrl(config?.url || '');
        setAccessKey(config?.anonKey || '');
        setApiReady(true);
        setLoading(false);
      });
    } else {
      console.warn('[SupabaseConfigModal] API supabaseConfig no disponible en preload');
      setLoading(false);
    }
  }, []);

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!url || !accessKey) {
      setError('Por favor, completa ambos campos.');
      return;
    }
    if (!validateUrl(url)) {
      setError('La URL del servicio no es válida.');
      return;
    }
    if (!win.supabaseConfig || typeof win.supabaseConfig.save !== 'function') {
      setError('La API de configuración no está disponible (preload). Reinicia la aplicación.');
      return;
    }
    setSaving(true);
    try {
      // 1. Guardar la configuración primero
      const result = await (window as any).supabaseConfig.save({ url, anonKey: accessKey });
      if (result && result.error) {
        setError('Error al guardar: ' + result.error);
        setSaving(false);
        return;
      }

      // 2. Verificar si la base de datos necesita setup inicial
      const needsSetup = await migrationService.needsInitialSetup();
      
      if (needsSetup) {
        // Mostrar UI de progreso de migración
        setShowMigrationProgress(true);
        setSaving(false);

        // 3. Ejecutar migraciones con reporte de progreso
        await migrationService.runMigrations((progress) => {
          setMigrationProgress(progress);
          
          // Si completó exitosamente, recargar después de un pequeño delay
          if (progress.status === 'success') {
            setTimeout(() => {
              onFinish();
              window.location.reload();
            }, 3000);
          }
        });
      } else {
        // La BD ya está configurada, continuar normalmente
        onFinish();
        window.location.reload();
      }
    } catch (e) {
      console.error('Error en handleSave:', e);
      setError('Error al guardar la configuración: ' + ((e as any)?.message || e));
      setSaving(false);
      setShowMigrationProgress(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        {showMigrationProgress && migrationProgress ? (
          // Mostrar progreso de migración
          <>
            <DialogHeader>
              <DialogTitle>Configuración Inicial</DialogTitle>
            </DialogHeader>
            <MigrationProgressUI progress={migrationProgress} />
          </>
        ) : (
          // Mostrar formulario de configuración
          <>
            <DialogHeader>
              <DialogTitle>Configurar conexión a Supabase</DialogTitle>
            </DialogHeader>
            {loading ? (
              <div style={{textAlign:'center',marginTop:32}}>Cargando configuración...</div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
                {!apiReady && (
                  <div style={{background:'#fff3cd',color:'#856404',padding:8,borderRadius:6,fontSize:12,marginBottom:12}}>
                    No se detectó la API de configuración. Asegúrate de ejecutar el ejecutable instalado (no solo el .exe suelto) y que el preload se haya construido. Luego reinicia.
                  </div>
                )}
                <label style={{fontWeight:'bold'}}>URL del servicio</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  autoFocus
                />
                <label style={{fontWeight:'bold'}}>Clave de acceso</label>
                <input
                  type="text"
                  placeholder="Clave de acceso"
                  value={accessKey}
                  onChange={e => setAccessKey(e.target.value)}
                  style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                />
                {error && <div style={{color:'red',marginBottom:12}}>{error}</div>}
                <div style={{background:'#e7f3ff',color:'#004085',padding:12,borderRadius:6,fontSize:13,marginBottom:16}}>
                  <strong>ℹ️ Nota:</strong> Si es una base de datos nueva, el sistema configurará automáticamente 
                  todas las tablas y creará el usuario administrador <code>admin@suitcore.com</code>.
                </div>
                <DialogFooter>
                  <button 
                    type="submit" 
                    style={{ width: '100%', padding: 12, borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', fontSize: 16 }} 
                    disabled={saving}
                  >
                    {saving ? 'Conectando...' : 'Guardar y continuar'}
                  </button>
                  <DialogClose asChild>
                    <button style={{ display: 'none' }} />
                  </DialogClose>
                </DialogFooter>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupabaseConfigModal; 