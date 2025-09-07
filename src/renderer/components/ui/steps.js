import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { cn } from '../../lib/utils';
export const Steps = ({ children, currentStep, className }) => {
    // Convierte los hijos en un array para manejarlos
    const steps = React.Children.toArray(children);
    return (_jsx("div", { className: cn("flex items-center justify-between w-full", className), children: steps.map((step, index) => {
            // Añade propiedades a cada Step
            return React.cloneElement(step, {
                stepNumber: index,
                isActive: index === currentStep,
                isCompleted: index < currentStep,
                isLast: index === steps.length - 1,
                key: index,
            });
        }) }));
};
export const Step = ({ title, stepNumber = 0, isActive = false, isCompleted = false, isLast = false }) => {
    return (_jsxs("div", { className: "flex flex-col items-center flex-1", children: [_jsxs("div", { className: "flex items-center relative", children: [_jsx("div", { className: cn("flex items-center justify-center w-10 h-10 rounded-full border-2 z-10", isActive && "border-primary bg-primary text-primary-foreground", isCompleted && "border-primary bg-primary text-primary-foreground", !isActive && !isCompleted && "border-muted-foreground"), children: isCompleted ? (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })) : (_jsx("span", { children: stepNumber + 1 })) }), !isLast && (_jsx("div", { className: cn("absolute left-10 w-full h-0.5", isCompleted ? "bg-primary" : "bg-muted-foreground") }))] }), _jsx("div", { className: "mt-2 text-sm text-center", children: _jsx("span", { className: cn("font-medium", isActive && "text-primary", isCompleted && "text-primary", !isActive && !isCompleted && "text-muted-foreground"), children: title }) })] }));
};
