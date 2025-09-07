import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();
    // Cargar credenciales guardadas al iniciar
    useEffect(() => {
        const savedEmail = localStorage.getItem('remembered_email');
        const savedPassword = localStorage.getItem('remembered_password');
        if (savedEmail && savedPassword) {
            setEmail(savedEmail);
            setPassword(savedPassword);
            setRememberMe(true);
        }
    }, []);
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validación básica
        if (!email || !password) {
            toast.error('Por favor, ingresa email y contraseña');
            return;
        }
        try {
            setLoading(true);
            // Guardar credenciales si "Recuérdame" está activado
            if (rememberMe) {
                localStorage.setItem('remembered_email', email);
                localStorage.setItem('remembered_password', password);
            }
            else {
                // Eliminar credenciales guardadas si está desactivado
                localStorage.removeItem('remembered_email');
                localStorage.removeItem('remembered_password');
            }
            // Usar el método signIn del contexto de autenticación
            const success = await signIn(email, password);
            if (success) {
                navigate('/');
            }
        }
        catch (error) {
            console.error('Error en inicio de sesión:', error);
            toast.error('Error al iniciar sesión');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gray-100", children: _jsxs("div", { className: "max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg", children: [_jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-3xl font-bold text-primary", children: "Inventario Pro - SC" }), _jsx("h2", { className: "mt-6 text-xl font-semibold text-gray-900", children: "Iniciar Sesi\u00F3n" }), _jsx("p", { className: "mt-2 text-sm text-gray-600", children: "Ingresa tus credenciales para acceder al sistema" }), typeof window.supabaseConfig !== 'undefined' && (_jsx(ConfigNotice, {}))] }), _jsxs("form", { className: "mt-8 space-y-6", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "email", className: "block text-sm font-medium text-gray-700", children: "Email" }), _jsx(Input, { id: "email", name: "email", type: "email", autoComplete: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "mt-1", placeholder: "correo@ejemplo.com" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "password", className: "block text-sm font-medium text-gray-700", children: "Contrase\u00F1a" }), _jsxs("div", { className: "relative mt-1", children: [_jsx(Input, { id: "password", name: "password", type: showPassword ? 'text' : 'password', autoComplete: "current-password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "pr-10", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }), _jsx("button", { type: "button", onClick: () => setShowPassword((v) => !v), className: "absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700", "aria-label": showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña', children: showPassword ? _jsx(EyeOff, { size: 18 }) : _jsx(Eye, { size: 18 }) })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: "rememberMe", checked: rememberMe, onCheckedChange: (checked) => setRememberMe(checked === true), className: "border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx(Label, { htmlFor: "rememberMe", className: "text-sm font-medium text-gray-700 cursor-pointer", children: "Recu\u00E9rdame" })] })] }), _jsx("div", { children: _jsx(Button, { type: "submit", className: "w-full bg-blue-600 hover:bg-blue-700 text-white", disabled: loading, children: loading ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Iniciando sesi\u00F3n..."] })) : ('Iniciar Sesión') }) })] }), _jsx("div", { className: "mt-6 text-center text-sm", children: _jsx("p", { className: "text-gray-600", children: "\u00A92025 Inventario Pro - SC - Todos los derechos reservados" }) })] }) }));
};
export default Login;
// Componente interno para mostrar aviso y botón de configuración
const ConfigNotice = () => {
    const [checking, setChecking] = React.useState(true);
    const [needsConfig, setNeedsConfig] = React.useState(false);
    React.useEffect(() => {
        const api = window.supabaseConfig;
        if (!api || typeof api.get !== 'function') {
            setNeedsConfig(true);
            setChecking(false);
            return;
        }
        api.get().then((cfg) => {
            if (!cfg || !cfg.url || !cfg.anonKey)
                setNeedsConfig(true);
        }).finally(() => setChecking(false));
    }, []);
    if (checking || !needsConfig)
        return null;
    return (_jsxs("div", { className: "mt-4 text-left p-3 rounded-md bg-amber-100 text-amber-900 text-xs border border-amber-300", children: ["Falta configurar la conexi\u00F3n a Supabase.", _jsx("button", { onClick: () => { sessionStorage.setItem('forceOnboarding', '1'); location.reload(); }, className: "ml-2 underline font-semibold", children: "Configurar ahora" })] }));
};
