import React from 'react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

const SubscriptionInfo: React.FC = () => {
  const { subscription } = useAuth();
  const navigate = useNavigate();

  if (!subscription) {
    return null;
  }

  // Determinar color según días restantes
  const getStatusColor = () => {
    if (!subscription.isActive) return 'bg-red-100 text-red-800';
    if (!subscription.daysRemaining) return 'bg-gray-100 text-gray-800';
    
    if (subscription.daysRemaining <= 3) {
      return 'bg-red-100 text-red-800';
    } else if (subscription.daysRemaining <= 7) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Suscripción: {subscription.planName || 'Mensual'}
          </h3>
          
          {subscription.isActive ? (
            <div className="flex items-center mt-1">
              <span 
                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
              >
                {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'día' : 'días'} restante{subscription.daysRemaining !== 1 ? 's' : ''}
              </span>
              
              {subscription.endDate && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  Vence: {new Date(subscription.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          ) : (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Suscripción vencida
            </span>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/subscription/renew')}
          className="text-xs"
        >
          Renovar
        </Button>
      </div>
    </div>
  );
};

export default SubscriptionInfo; 