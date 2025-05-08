import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import subscriptionService from '../lib/subscriptionService';
import { SubscriptionPlan } from '../../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'react-hot-toast';

const SubscriptionRenew: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
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
      } else if (plansData.length > 0) {
        setSelectedPlan(plansData[0].id);
      }
    } catch (error) {
      console.error('Error al cargar planes:', error);
      toast.error('Error al cargar planes de suscripción');
    } finally {
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
    } catch (error) {
      console.error('Error al renovar suscripción:', error);
      toast.error('Error al procesar la renovación');
    }
  };
  
  // Formatear precio
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 0
    }).format(price);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (showQR) {
    const selectedPlanDetails = plans.find(p => p.id === selectedPlan);
    
    return (
      <div className="container mx-auto py-10 px-4 max-w-xl">
        <h1 className="text-2xl font-bold text-center mb-6">Pago mediante QR</h1>
        
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle>
              {selectedPlanDetails?.name || 'Plan seleccionado'}
            </CardTitle>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {selectedPlanDetails ? formatPrice(selectedPlanDetails.price) : ''}
            </p>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center">
            <div className="bg-gray-100 w-64 h-64 flex items-center justify-center mb-6 border">
              {/* Aquí se mostrará el QR en el futuro */}
              <p className="text-gray-500 text-center p-4">
                Funcionalidad de QR en desarrollo.<br/>
                Por ahora, use la renovación manual.
              </p>
            </div>
            
            <div className="text-sm text-gray-600 mb-4 text-center">
              <p className="mb-2">Escanea el código QR con tu aplicación bancaria para realizar el pago</p>
              <p>Una vez completado el pago, tu suscripción se renovará automáticamente</p>
            </div>
            
            <div className="flex flex-col w-full space-y-2">
              <Button 
                onClick={() => setShowQR(false)}
                variant="outline"
              >
                Volver a selección de planes
              </Button>
              
              <Button
                onClick={handleManualRenewal}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Renovación manual (para pruebas)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-center mb-6">Renovar suscripción</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.id}
            className={`cursor-pointer transition-all ${
              selectedPlan === plan.id 
                ? 'border-2 border-blue-500 transform scale-105' 
                : 'hover:shadow-lg'
            }`}
            onClick={() => setSelectedPlan(plan.id)}
          >
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
              <p className="text-2xl font-bold text-blue-600 mt-4">
                {formatPrice(plan.price)}
              </p>
              <p className="text-gray-500 mt-1">
                {plan.duration_days === 30 ? '1 mes' : 
                 plan.duration_days === 90 ? '3 meses' : 
                 plan.duration_days === 365 ? '1 año' : 
                 `${plan.duration_days} días`}
              </p>
            </CardHeader>
            
            <CardContent>
              <p className="text-gray-600 mb-4">{plan.description || ''}</p>
              
              <ul className="space-y-2">
                {plan.features && plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                className={`w-full mt-6 ${
                  selectedPlan === plan.id
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {selectedPlan === plan.id ? 'Seleccionado' : 'Seleccionar'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-10 text-center">
        <Button
          onClick={handleShowQR}
          disabled={!selectedPlan}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold"
        >
          Continuar al pago
        </Button>
        
        <p className="mt-4 text-sm text-gray-500">
          Al renovar aceptas nuestros <a href="#" className="text-blue-600 hover:underline">Términos y Condiciones</a>
        </p>
      </div>
    </div>
  );
};

export default SubscriptionRenew; 