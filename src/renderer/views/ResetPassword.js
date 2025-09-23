import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'react-hot-toast';
// Vista que maneja dos casos:
// 1) Solicitar email de recuperación (si no hay access_token en URL)
// 2) Establecer nueva contraseña (si Supabase redirige con access_token + type=recovery)
const ResetPassword = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState(() => {
        const params = new URLSearchParams(window.location.hash.replace('#', '?'));
        const type = params.get('type');
        return type === 'recovery' ? 'reset' : 'request';
    });
    const handleRequest = async () => {
        if (!email) {
            toast.error('Ingrese su email');
            return;
        }
        setLoading(true);
        try {
            const client = await supabase.getClient();
            const redirectTo = window.location.origin + '/reset-password';
            const { error } = await client.auth.resetPasswordForEmail(email.toLowerCase(), { redirectTo });
            if (error)
                throw error;
            toast.success('Hemos enviado un email con instrucciones');
        }
        catch (e) {
            toast.error(e?.message || 'No se pudo enviar el correo');
        }
        finally {
            setLoading(false);
        }
    };
    const handleReset = async () => {
        if (!password) {
            toast.error('Ingrese su nueva contraseña');
            return;
        }
        setLoading(true);
        try {
            const client = await supabase.getClient();
            const { error } = await client.auth.updateUser({ password });
            if (error)
                throw error;
            toast.success('Contraseña actualizada. Ya puede iniciar sesión.');
        }
        catch (e) {
            toast.error(e?.message || 'No se pudo actualizar la contraseña');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center p-4", children: _jsx("div", { className: "w-full max-w-md bg-card rounded-md shadow p-6", children: stage === 'request' ? (_jsxs(_Fragment, { children: [_jsx("h1", { className: "text-xl font-semibold mb-4", children: "Recuperar contrase\u00F1a" }), _jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "Ingrese su email y le enviaremos un enlace para restablecer su contrase\u00F1a." }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { htmlFor: "email", children: "Email" }), _jsx(Input, { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsx(Button, { className: "mt-4 w-full", onClick: handleRequest, disabled: loading, children: "Enviar enlace" })] })) : (_jsxs(_Fragment, { children: [_jsx("h1", { className: "text-xl font-semibold mb-4", children: "Establecer nueva contrase\u00F1a" }), _jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "Ingrese su nueva contrase\u00F1a y gu\u00E1rdela." }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { htmlFor: "password", children: "Nueva contrase\u00F1a" }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value) })] }), _jsx(Button, { className: "mt-4 w-full", onClick: handleReset, disabled: loading, children: "Guardar contrase\u00F1a" })] })) }) }));
};
export default ResetPassword;
