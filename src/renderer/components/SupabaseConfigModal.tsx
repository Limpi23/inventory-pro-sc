import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from './ui/dialog';

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
      const result = await (window as any).supabaseConfig.save({ url, anonKey: accessKey });
      if (result && result.error) {
        setError('Error al guardar: ' + result.error);
        return;
      }
      onFinish();
      window.location.reload();
    } catch (e) {
      setError('Error al guardar la configuración: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
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
            <DialogFooter>
              <button type="submit" style={{ width: '100%', padding: 12, borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', fontSize: 16 }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar y continuar'}
              </button>
              <DialogClose asChild>
                <button style={{ display: 'none' }} />
              </DialogClose>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupabaseConfigModal; 