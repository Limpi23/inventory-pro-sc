import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { migrationService } from '../lib/migrationService';
import { supabase } from '../lib/supabase';
import MigrationProgressUI from './MigrationProgressUI';
const SupabaseConfigModal = ({ onFinish, onClose }) => {
    const [url, setUrl] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [apiReady, setApiReady] = useState(false);
    const [showMigrationProgress, setShowMigrationProgress] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState(null);
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
            // 1. Guardar la configuración primero
            const result = await window.supabaseConfig.save({ url, anonKey: accessKey });
            if (result && result.error) {
                setError('Error al guardar: ' + result.error);
                setSaving(false);
                return;
            }
            // 2. Forzar recarga de Supabase client con nuevas credenciales
            if (supabase.reinitialize) {
                supabase.reinitialize();
            }
            // 3. Verificar si la base de datos necesita setup inicial
            const needsSetup = await migrationService.needsInitialSetup();
            if (needsSetup) {
                // Mostrar UI de progreso de migración
                setShowMigrationProgress(true);
                setSaving(false);
                // 4. Ejecutar migraciones con reporte de progreso
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
            }
            else {
                // La BD ya está configurada, continuar normalmente
                onFinish();
                window.location.reload();
            }
        }
        catch (e) {
            setError('Error al guardar la configuración: ' + (e?.message || e));
            setSaving(false);
            setShowMigrationProgress(false);
        }
    };
    return (_jsx(Dialog, { open: true, onOpenChange: open => { if (!open)
            onClose(); }, children: _jsx(DialogContent, { className: "max-w-3xl", children: showMigrationProgress && migrationProgress ? (
            // Mostrar progreso de migración
            _jsxs(_Fragment, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Configuraci\u00F3n Inicial" }) }), _jsx(MigrationProgressUI, { progress: migrationProgress })] })) : (
            // Mostrar formulario de configuración
            _jsxs(_Fragment, { children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Configurar conexi\u00F3n a Supabase" }) }), loading ? (_jsx("div", { style: { textAlign: 'center', marginTop: 32 }, children: "Cargando configuraci\u00F3n..." })) : (_jsxs("form", { onSubmit: e => { e.preventDefault(); handleSave(); }, children: [!apiReady && (_jsx("div", { style: { background: '#fff3cd', color: '#856404', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 12 }, children: "No se detect\u00F3 la API de configuraci\u00F3n. Aseg\u00FArate de ejecutar el ejecutable instalado (no solo el .exe suelto) y que el preload se haya construido. Luego reinicia." })), _jsx("label", { style: { fontWeight: 'bold' }, children: "URL del servicio" }), _jsx("input", { type: "text", placeholder: "https://...", value: url, onChange: e => setUrl(e.target.value), onPaste: (e) => {
                                    // Permitir pegado explícitamente
                                    e.stopPropagation();
                                }, onKeyDown: (e) => {
                                    // Permitir Ctrl+V / Cmd+V
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                                        e.stopPropagation();
                                    }
                                }, style: { width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' }, autoFocus: true }), _jsx("label", { style: { fontWeight: 'bold' }, children: "Clave de acceso" }), _jsx("input", { type: "text", placeholder: "Clave de acceso", value: accessKey, onChange: e => setAccessKey(e.target.value), onPaste: (e) => {
                                    // Permitir pegado explícitamente
                                    e.stopPropagation();
                                }, onKeyDown: (e) => {
                                    // Permitir Ctrl+V / Cmd+V
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                                        e.stopPropagation();
                                    }
                                }, style: { width: '100%', marginBottom: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc' } }), error && _jsx("div", { style: { color: 'red', marginBottom: 12 }, children: error }), _jsxs("div", { style: { background: '#e7f3ff', color: '#004085', padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }, children: [_jsx("strong", { children: "\u2139\uFE0F Nota:" }), " Si es una base de datos nueva, el sistema configurar\u00E1 autom\u00E1ticamente todas las tablas y crear\u00E1 el usuario administrador ", _jsx("code", { children: "admin@suitcore.com" }), "."] }), _jsxs(DialogFooter, { children: [_jsx("button", { type: "submit", style: { width: '100%', padding: 12, borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', fontSize: 16 }, disabled: saving, children: saving ? 'Conectando...' : 'Guardar y continuar' }), _jsx(DialogClose, { asChild: true, children: _jsx("button", { style: { display: 'none' } }) })] })] }))] })) }) }));
};
export default SupabaseConfigModal;
