import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle } from 'lucide-react';
const SetupComplete = ({ setupData, onComplete }) => {
    return (_jsxs(Card, { className: "w-full max-w-md mx-auto text-center", children: [_jsxs(CardHeader, { children: [_jsx("div", { className: "flex justify-center mb-4", children: _jsx(CheckCircle, { className: "h-16 w-16 text-green-500" }) }), _jsx(CardTitle, { className: "text-2xl", children: "\u00A1Configuraci\u00F3n completada!" }), _jsx(CardDescription, { children: "La configuraci\u00F3n inicial de tu sistema ha sido completada con \u00E9xito." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "p-4 bg-muted rounded-lg", children: [_jsx("h3", { className: "font-semibold text-lg mb-2", children: "Resumen" }), _jsxs("div", { className: "text-left mb-4", children: [_jsx("p", { className: "font-medium", children: "Empresa:" }), _jsx("p", { children: setupData.company?.name })] }), _jsxs("div", { className: "text-left", children: [_jsx("p", { className: "font-medium", children: "Tipo de configuraci\u00F3n:" }), _jsx("p", { children: setupData.database?.setupType === 'new'
                                            ? 'Nueva instalación'
                                            : 'Conexión a base de datos existente' })] })] }), _jsx("p", { className: "text-muted-foreground", children: "Ya puedes comenzar a utilizar el sistema. Puedes modificar la configuraci\u00F3n en cualquier momento desde la secci\u00F3n de ajustes." })] }), _jsx(CardFooter, { children: _jsx(Button, { onClick: onComplete, className: "w-full", children: "Iniciar aplicaci\u00F3n" }) })] }));
};
export default SetupComplete;
