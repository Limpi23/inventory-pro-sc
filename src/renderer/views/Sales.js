import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const Sales = () => {
    // Definimos las opciones del módulo de ventas
    const salesOptions = [
        {
            title: 'Clientes',
            description: 'Gestionar clientes y sus datos de contacto',
            icon: 'fa-users',
            link: '/ventas/clientes',
            color: 'bg-blue-100 text-blue-800'
        },
        {
            title: 'Facturación',
            description: 'Crear y gestionar facturas de venta',
            icon: 'fa-file-invoice-dollar',
            link: '/ventas/facturas',
            color: 'bg-green-100 text-green-800'
        },
        {
            title: 'Devoluciones',
            description: 'Procesar devoluciones de ventas',
            icon: 'fa-exchange-alt',
            link: '/ventas/devoluciones',
            color: 'bg-orange-100 text-orange-800'
        }
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between", children: _jsx("h1", { className: "text-2xl font-semibold", children: "Gesti\u00F3n de Ventas" }) }), _jsxs("div", { className: "bg-white p-6 rounded-lg shadow-md", children: [_jsx("p", { className: "text-gray-600 mb-6", children: "Esta secci\u00F3n permite gestionar las operaciones de ventas, incluyendo la gesti\u00F3n de clientes, emisi\u00F3n de facturas y procesamiento de devoluciones." }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: salesOptions.map((option) => (_jsx(Link, { to: option.link, className: "block p-6 border rounded-lg transition duration-300 hover:shadow-md", children: _jsxs("div", { className: "flex items-start space-x-4", children: [_jsx("div", { className: `p-3 ${option.color} rounded-full`, children: _jsx("i", { className: `fas ${option.icon} text-lg` }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-medium mb-2", children: option.title }), _jsx("p", { className: "text-gray-600", children: option.description })] })] }) }, option.title))) })] })] }));
};
export default Sales;
