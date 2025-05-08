import { supabase } from './supabase';
import { Subscription, SubscriptionPlan, SubscriptionInfo } from '../../types';

export const subscriptionService = {
  // Obtener la información de suscripción actual para un tenant
  getCurrentSubscription: async (tenantId: string): Promise<SubscriptionInfo> => {
    try {
      // Obtener la suscripción más reciente
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('end_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        return {
          isActive: false,
          endDate: null,
          planName: null,
          daysRemaining: null,
          status: 1 // Por defecto bloqueado si no hay suscripción
        };
      }
      
      const subscription = data as Subscription;
      
      // Verificar si está activa por fecha
      const now = new Date();
      const endDate = new Date(subscription.end_date);
      const isActive = subscription.status === 0 && endDate > now;
      
      // Calcular días restantes
      const diffTime = Math.abs(endDate.getTime() - now.getTime());
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        isActive,
        endDate: subscription.end_date,
        planName: 'Mensual', // Por defecto
        daysRemaining: isActive ? daysRemaining : 0,
        status: subscription.status
      };
    } catch (error) {
      console.error('Error al verificar suscripción:', error);
      throw error;
    }
  },
  
  // Obtener todos los planes disponibles
  getPlans: async (): Promise<SubscriptionPlan[]> => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener planes:', error);
      throw error;
    }
  },
  
  // Renovar suscripción (sin procesar pago, solo actualizar estado)
  renewSubscription: async (
    tenantId: string, 
    durationDays: number
  ): Promise<void> => {
    try {
      // Calcular fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);
      
      // Crear suscripción
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id: tenantId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 0, // Activa
          payment_reference: `manual-${Date.now()}`
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error al renovar suscripción:', error);
      throw error;
    }
  },
  
  // Actualizar status de suscripción (0 = activa, 1 = bloqueada)
  updateSubscriptionStatus: async (
    subscriptionId: string, 
    status: number
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', subscriptionId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error al actualizar estado de suscripción:', error);
      throw error;
    }
  },
  
  // Obtener información básica del tenant
  getTenantInfo: async (tenantId: string) => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al obtener información del tenant:', error);
      throw error;
    }
  }
};

export default subscriptionService; 