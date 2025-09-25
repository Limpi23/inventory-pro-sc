import React from 'react';
import { Link } from 'react-router-dom';

const Sales: React.FC = () => {
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
      title: 'Cotizaciones',
      description: 'Crear y gestionar cotizaciones de venta',
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Gestión de Ventas</h1>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-600 mb-6">
          Esta sección permite gestionar las operaciones de ventas, incluyendo la gestión de clientes, 
          emisión de facturas y procesamiento de devoluciones.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {salesOptions.map((option) => (
            <Link 
              key={option.title}
              to={option.link}
              className="block p-6 border rounded-lg transition duration-300 hover:shadow-md"
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 ${option.color} rounded-full`}>
                  <i className={`fas ${option.icon} text-lg`}></i>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">{option.title}</h3>
                  <p className="text-gray-600">{option.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sales; 