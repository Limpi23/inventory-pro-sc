import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const SplashScreen = ({ onFinish }) => {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('Iniciando...');
    useEffect(() => {
        const steps = [
            { progress: 20, status: 'Cargando configuración...', delay: 300 },
            { progress: 40, status: 'Conectando con base de datos...', delay: 500 },
            { progress: 60, status: 'Inicializando módulos...', delay: 400 },
            { progress: 80, status: 'Preparando interfaz...', delay: 300 },
            { progress: 100, status: 'Listo!', delay: 200 }
        ];
        let currentStep = 0;
        const runNextStep = () => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                setProgress(step.progress);
                setStatus(step.status);
                currentStep++;
                setTimeout(runNextStep, step.delay);
            }
            else {
                setTimeout(onFinish, 300);
            }
        };
        runNextStep();
    }, [onFinish]);
    return (_jsx("div", { className: "fixed inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center z-50", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mb-8 animate-bounce", children: _jsx("div", { className: "w-24 h-24 bg-white rounded-2xl shadow-2xl mx-auto flex items-center justify-center", children: _jsx("span", { className: "text-5xl", children: "\uD83D\uDCE6" }) }) }), _jsx("h1", { className: "text-4xl font-bold text-white mb-2", children: "Inventario Pro" }), _jsx("p", { className: "text-blue-200 mb-8 text-sm", children: "Sistema de Gesti\u00F3n de Inventario" }), _jsxs("div", { className: "w-80 mx-auto", children: [_jsx("div", { className: "bg-blue-800 rounded-full h-2 mb-4 overflow-hidden shadow-inner", children: _jsx("div", { className: "bg-gradient-to-r from-blue-400 to-blue-200 h-full rounded-full transition-all duration-500 ease-out shadow-lg", style: { width: `${progress}%` }, children: _jsx("div", { className: "w-full h-full bg-white opacity-30 animate-pulse" }) }) }), _jsx("p", { className: "text-blue-100 text-sm animate-pulse", children: status }), _jsxs("p", { className: "text-blue-300 text-xs mt-2", children: [progress, "%"] })] }), _jsx("div", { className: "mt-12 text-blue-300 text-xs", children: _jsx("p", { children: "\u00A9 2025 SuitCore" }) })] }) }));
};
export default SplashScreen;
