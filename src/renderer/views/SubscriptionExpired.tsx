import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';

const SubscriptionExpired: React.FC = () => {
  const { subscription } = useAuth();
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600">Suscripción vencida</h1>
          
          <div className="mt-4">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          
          <p className="mt-4 text-lg text-gray-600">
            Tu suscripción ha expirado. Para continuar usando InventorySuit, necesitas renovar tu plan.
          </p>
          
          {subscription?.endDate && (
            <p className="mt-2 text-sm text-gray-500">
              Expiró el {new Date(subscription.endDate).toLocaleDateString()}
            </p>
          )}

          <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 mb-2 font-medium">Plan actual: Mensual</p>
            <p className="text-sm text-gray-600">Bs. 280 / mes</p>
            <ul className="mt-3 text-xs text-gray-500 space-y-1 text-left">
              <li>• Gestión completa de inventario</li>
              <li>• Reportes detallados</li>
              <li>• Múltiples almacenes</li>
              <li>• Soporte prioritario</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8">
          <Button
            onClick={() => navigate('/subscription/renew')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Renovar suscripción
          </Button>
          
          <Button
            onClick={() => window.open('https://wa.me/59173099696?text=Necesito%20renovar%20mi%20suscripci%C3%B3n%20a%20InventorySuit', '_blank')}
            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white"
          >
            Contactar soporte
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpired; 