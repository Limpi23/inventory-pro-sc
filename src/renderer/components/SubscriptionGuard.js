import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Navigate, useLocation } from 'react-router-dom';
const SubscriptionGuard = ({ children }) => {
    const { user, subscription, loading, checkSubscription } = useAuth();
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    useEffect(() => {
        const checkStatus = async () => {
            if (user) {
                await checkSubscription();
            }
            setChecking(false);
        };
        checkStatus();
    }, [user, checkSubscription]);
    // Si está cargando o verificando, mostrar un spinner
    if (loading || checking) {
        return (_jsx("div", { className: "flex justify-center items-center h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    // Si no hay usuario, redirigir al login
    if (!user) {
        return _jsx(Navigate, { to: "/login", state: { from: location }, replace: true });
    }
    // Si la ruta es para renovar la suscripción, permitir acceso
    if (location.pathname === '/subscription/renew') {
        return _jsx(_Fragment, { children: children });
    }
    // Si la suscripción no está activa o está bloqueada, mostrar página de suscripción expirada
    if (subscription && (subscription.status === 1 || !subscription.isActive)) {
        return _jsx(Navigate, { to: "/subscription/expired", replace: true });
    }
    // Si todo está bien, mostrar el contenido normal
    return _jsx(_Fragment, { children: children });
};
export default SubscriptionGuard;
