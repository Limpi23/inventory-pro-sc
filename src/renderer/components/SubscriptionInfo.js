import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
const SubscriptionInfo = () => {
    const { subscription } = useAuth();
    const navigate = useNavigate();
    if (!subscription) {
        return null;
    }
    // Determinar color según días restantes
    const getStatusColor = () => {
        if (!subscription.isActive)
            return 'bg-red-100 text-red-800';
        if (!subscription.daysRemaining)
            return 'bg-gray-100 text-gray-800';
        if (subscription.daysRemaining <= 3) {
            return 'bg-red-100 text-red-800';
        }
        else if (subscription.daysRemaining <= 7) {
            return 'bg-yellow-100 text-yellow-800';
        }
        else {
            return 'bg-green-100 text-green-800';
        }
    };
    return (_jsx("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: ["Suscripci\u00F3n: ", subscription.planName || 'Mensual'] }), subscription.isActive ? (_jsxs("div", { className: "flex items-center mt-1", children: [_jsxs("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`, children: [subscription.daysRemaining, " ", subscription.daysRemaining === 1 ? 'día' : 'días', " restante", subscription.daysRemaining !== 1 ? 's' : ''] }), subscription.endDate && (_jsxs("span", { className: "ml-2 text-xs text-gray-500 dark:text-gray-400", children: ["Vence: ", new Date(subscription.endDate).toLocaleDateString()] }))] })) : (_jsx("span", { className: "px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800", children: "Suscripci\u00F3n vencida" }))] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => navigate('/subscription/renew'), className: "text-xs", children: "Renovar" })] }) }));
};
export default SubscriptionInfo;
