import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
const SupabaseConfigModal = ({ onFinish, onClose }) => {
    const [url, setUrl] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [apiReady, setApiReady] = useState(false);
    const win = typeof window !== 'undefined' ? window : {};
    useEffect(() => {
        if (win.supabaseConfig && typeof win.supabaseConfig.get === 'function') {
            win.supabaseConfig.get().then((config) => {
                setUrl(config?.url || '');
                setAccessKey(config?.anonKey || '');
                setApiReady(true);
                setLoading(false);
            });
        }
        else {
            console.warn('[SupabaseConfigModal] API supabaseConfig no disponible en preload');
            setLoading(false);
        }
    }, []);
    const validateUrl = (url) => {
        try {
            new URL(url);
            return true;
        }
        catch {
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
            const result = await window.supabaseConfig.save({ url, anonKey: accessKey });
            if (result && result.error) {
                setError('Error al guardar: ' + result.error);
                return;
            }
            onFinish();
            window.location.reload();
        }
        catch (e) {
            setError('Error al guardar la configuración: ' + (e?.message || e));
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsx(Dialog, { open: true, onOpenChange: open => { if (!open)
            onClose(); }, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Configurar conexi\u00F3n a Supabase" }) }), loading ? (_jsx("div", { style: { textAlign: 'center', marginTop: 32 }, children: "Cargando configuraci\u00F3n..." })) : (_jsxs("form", { onSubmit: e => { e.preventDefault(); handleSave(); }, children: [!apiReady && (_jsx("div", { style: { background: '#fff3cd', color: '#856404', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 12 }, children: "No se detect\u00F3 la API de configuraci\u00F3n. Aseg\u00FArate de ejecutar el ejecutable instalado (no solo el .exe suelto) y que el preload se haya construido. Luego reinicia." })), _jsx("label", { style: { fontWeight: 'bold' }, children: "URL del servicio" }), _jsx("input", { type: "text", placeholder: "https://...", value: url, onChange: e => setUrl(e.target.value), style: { width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }, autoFocus: true }), _jsx("label", { style: { fontWeight: 'bold' }, children: "Clave de acceso" }), _jsx("input", { type: "text", placeholder: "Clave de acceso", value: accessKey, onChange: e => setAccessKey(e.target.value), style: { width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' } }), error && _jsx("div", { style: { color: 'red', marginBottom: 12 }, children: error }), _jsxs(DialogFooter, { children: [_jsx("button", { type: "submit", style: { width: '100%', padding: 12, borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', fontSize: 16 }, disabled: saving, children: saving ? 'Guardando...' : 'Guardar y continuar' }), _jsx(DialogClose, { asChild: true, children: _jsx("button", { style: { display: 'none' } }) })] })] }))] }) }));
};
export default SupabaseConfigModal;
