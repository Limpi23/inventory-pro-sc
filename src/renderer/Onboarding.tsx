import React, { useState, useEffect } from 'react';

interface OnboardingProps {
  onFinish: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (window as any).supabaseConfig.get().then((config: any) => {
      if (config?.url && config?.anonKey) {
        onFinish();
      } else {
        setLoading(false);
      }
    });
  }, [onFinish]);

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
    if (!url || !anonKey) {
      setError('Por favor, completa ambos campos.');
      return;
    }
    if (!validateUrl(url)) {
      setError('La URL de Supabase no es válida.');
      return;
    }
    setSaving(true);
    try {
      await (window as any).supabaseConfig.save({ url, anonKey });
      onFinish();
    } catch (e) {
      setError('Error al guardar la configuración. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{textAlign:'center',marginTop:64}}>Cargando configuración...</div>;

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px #0001', marginTop: 64 }}>
      <h2 style={{textAlign:'center',marginBottom:24}}>Configuración inicial de Supabase</h2>
      <label style={{fontWeight:'bold'}}>Supabase URL</label>
      <input
        type="text"
        placeholder="https://xxxx.supabase.co"
        value={url}
        onChange={e => setUrl(e.target.value)}
        style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        autoFocus
      />
      <label style={{fontWeight:'bold'}}>Supabase ANON KEY</label>
      <input
        type="text"
        placeholder="Clave ANÓNIMA de Supabase"
        value={anonKey}
        onChange={e => setAnonKey(e.target.value)}
        style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
      />
      {error && <div style={{color:'red',marginBottom:12}}>{error}</div>}
      <button onClick={handleSave} style={{ width: '100%', padding: 12, borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', fontSize: 16 }} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar y continuar'}
      </button>
      <div style={{fontSize:12, color:'#888', marginTop:16, textAlign:'center'}}>
        Puedes obtener estos datos desde el panel de tu proyecto en <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>.
      </div>
    </div>
  );
};

export default Onboarding; 