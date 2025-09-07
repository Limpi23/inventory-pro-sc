import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import subscriptionService from '../lib/subscriptionService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'react-hot-toast';
const SubscriptionRenew = () => {
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showQR, setShowQR] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user, checkSubscription } = useAuth();
    useEffect(() => {
        fetchPlans();
    }, []);
    const fetchPlans = async () => {
        try {
            setLoading(true);
            const plansData = await subscriptionService.getPlans();
            setPlans(plansData);
            // Seleccionar el plan mensual por defecto
            const monthlyPlan = plansData.find(p => p.name === 'Mensual');
            if (monthlyPlan) {
                setSelectedPlan(monthlyPlan.id);
            }
            else if (plansData.length > 0) {
                setSelectedPlan(plansData[0].id);
            }
        }
        catch (error) {
            console.error('Error al cargar planes:', error);
            toast.error('Error al cargar planes de suscripción');
        }
        finally {
            setLoading(false);
        }
    };
    const handleShowQR = () => {
        if (!selectedPlan) {
            toast.error('Por favor selecciona un plan');
            return;
        }
        setShowQR(true);
    };
    const handleManualRenewal = async () => {
        if (!selectedPlan || !user?.tenant_id) {
            toast.error('Error al procesar la solicitud');
            return;
        }
        try {
            const plan = plans.find(p => p.id === selectedPlan);
            if (!plan) {
                toast.error('Plan no encontrado');
                return;
            }
            // Llamar al servicio para renovar suscripción
            await subscriptionService.renewSubscription(user.tenant_id, plan.duration_days);
            // Actualizar la información de suscripción
            await checkSubscription();
            toast.success('Suscripción renovada correctamente');
            navigate('/');
        }
        catch (error) {
            console.error('Error al renovar suscripción:', error);
            toast.error('Error al procesar la renovación');
        }
    };
    // Formatear precio
    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-BO', {
            style: 'currency',
            currency: 'BOB',
            minimumFractionDigits: 0
        }).format(price);
    };
    if (loading) {
        return (_jsx("div", { className: "flex justify-center items-center h-screen", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" }) }));
    }
    if (showQR) {
        const selectedPlanDetails = plans.find(p => p.id === selectedPlan);
        return (_jsxs("div", { className: "container mx-auto py-10 px-4 max-w-xl", children: [_jsx("h1", { className: "text-2xl font-bold text-center mb-6", children: "Pago mediante QR" }), _jsxs(Card, { className: "mb-6", children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { children: selectedPlanDetails?.name || 'Plan seleccionado' }), _jsx("p", { className: "text-2xl font-bold text-blue-600 mt-2", children: selectedPlanDetails ? formatPrice(selectedPlanDetails.price) : '' })] }), _jsxs(CardContent, { className: "flex flex-col items-center", children: [_jsx("div", { className: "bg-gray-100 w-64 h-64 flex items-center justify-center mb-6 border", children: _jsxs("p", { className: "text-gray-500 text-center p-4", children: ["Funcionalidad de QR en desarrollo.", _jsx("br", {}), "Por ahora, use la renovaci\u00F3n manual."] }) }), _jsxs("div", { className: "text-sm text-gray-600 mb-4 text-center", children: [_jsx("p", { className: "mb-2", children: "Escanea el c\u00F3digo QR con tu aplicaci\u00F3n bancaria para realizar el pago" }), _jsx("p", { children: "Una vez completado el pago, tu suscripci\u00F3n se renovar\u00E1 autom\u00E1ticamente" })] }), _jsxs("div", { className: "flex flex-col w-full space-y-2", children: [_jsx(Button, { onClick: () => setShowQR(false), variant: "outline", children: "Volver a selecci\u00F3n de planes" }), _jsx(Button, { onClick: handleManualRenewal, className: "bg-blue-600 hover:bg-blue-700 text-white", children: "Renovaci\u00F3n manual (para pruebas)" })] })] })] })] }));
    }
    return (_jsxs("div", { className: "container mx-auto py-10 px-4", children: [_jsx("h1", { className: "text-2xl font-bold text-center mb-6", children: "Renovar suscripci\u00F3n" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto", children: plans.map((plan) => (_jsxs(Card, { className: `cursor-pointer transition-all ${selectedPlan === plan.id
                        ? 'border-2 border-blue-500 transform scale-105'
                        : 'hover:shadow-lg'}`, onClick: () => setSelectedPlan(plan.id), children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx(CardTitle, { className: "text-xl font-bold", children: plan.name }), _jsx("p", { className: "text-2xl font-bold text-blue-600 mt-4", children: formatPrice(plan.price) }), _jsx("p", { className: "text-gray-500 mt-1", children: plan.duration_days === 30 ? '1 mes' :
                                        plan.duration_days === 90 ? '3 meses' :
                                            plan.duration_days === 365 ? '1 año' :
                                                `${plan.duration_days} días` })] }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-gray-600 mb-4", children: plan.description || '' }), _jsx("ul", { className: "space-y-2", children: plan.features && plan.features.map((feature, index) => (_jsxs("li", { className: "flex items-center", children: [_jsx("svg", { className: "h-5 w-5 text-green-500 mr-2", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("span", { children: feature })] }, index))) }), _jsx(Button, { className: `w-full mt-6 ${selectedPlan === plan.id
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`, onClick: () => setSelectedPlan(plan.id), children: selectedPlan === plan.id ? 'Seleccionado' : 'Seleccionar' })] })] }, plan.id))) }), _jsxs("div", { className: "mt-10 text-center", children: [_jsx(Button, { onClick: handleShowQR, disabled: !selectedPlan, className: "px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold", children: "Continuar al pago" }), _jsxs("p", { className: "mt-4 text-sm text-gray-500", children: ["Al renovar aceptas nuestros ", _jsx("a", { href: "#", className: "text-blue-600 hover:underline", children: "T\u00E9rminos y Condiciones" })] })] })] }));
};
export default SubscriptionRenew;
