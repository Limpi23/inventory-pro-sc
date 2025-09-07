import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './components/ui/dialog';
const Onboarding = ({ onFinish }) => {
    const [url, setUrl] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const win = window;
        const api = win?.supabaseConfig;
        if (api && typeof api.get === 'function') {
            api.get().then((config) => {
                if (config?.url && config?.anonKey) {
                    onFinish();
                }
                else {
                    setLoading(false);
                }
            }).catch((e) => {
                console.warn('[Onboarding] Error obteniendo config', e);
                setLoading(false);
            });
        }
        else {
            console.warn('[Onboarding] supabaseConfig API no disponible');
            setLoading(false);
        }
    }, [onFinish]);
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
        setSaving(true);
        const win = window;
        const api = win?.supabaseConfig;
        if (!api || typeof api.save !== 'function') {
            setError('API de configuración no disponible (preload no cargado). Reinicia la aplicación.');
            return;
        }
        try {
            const result = await api.save({ url, anonKey: accessKey });
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
    return (_jsx(Dialog, { open: true, children: _jsxs(DialogContent, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Configurar conexi\u00F3n" }) }), loading ? (_jsx("div", { style: { textAlign: 'center', marginTop: 32 }, children: "Cargando configuraci\u00F3n..." })) : (_jsxs("form", { onSubmit: e => { e.preventDefault(); handleSave(); }, children: [_jsx("label", { style: { fontWeight: 'bold' }, children: "URL del servicio" }), _jsx("input", { type: "text", placeholder: "https://...", value: url, onChange: e => setUrl(e.target.value), style: { width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }, autoFocus: true }), _jsx("label", { style: { fontWeight: 'bold' }, children: "Clave de acceso" }), _jsx("input", { type: "text", placeholder: "Clave de acceso", value: accessKey, onChange: e => setAccessKey(e.target.value), style: { width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' } }), error && _jsx("div", { style: { color: 'red', marginBottom: 12 }, children: error }), _jsxs(DialogFooter, { children: [_jsx("button", { type: "submit", style: { width: '100%', padding: 12, borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', fontSize: 16 }, disabled: saving, children: saving ? 'Guardando...' : 'Guardar y continuar' }), _jsx(DialogClose, { asChild: true, children: _jsx("button", { style: { display: 'none' } }) })] })] }))] }) }));
};
export default Onboarding;
