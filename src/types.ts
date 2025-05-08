// Tipos de usuario existentes
export interface User {
  id: string;
  email: string;
  full_name: string;
  active: boolean;
  role_id: number;
  role_name: string;
  role_description?: string;
  tenant_id?: string;
  last_login?: string;
  created_at: string;
}

// Suscripción
export interface Subscription {
  id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: number; // 0 = activa/operable, 1 = bloqueada/no operable
  payment_reference?: string;
  created_at: string;
  updated_at?: string;
}

// Plan de suscripción
export interface SubscriptionPlan {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  features: string[];
}

// Tenant (Cliente/Negocio)
export interface Tenant {
  id: string;
  name: string;
  business_name?: string;
  contact_email: string;
  contact_phone?: string;
  created_at: string;
  updated_at?: string;
}

// Información resumida de suscripción para UI
export interface SubscriptionInfo {
  isActive: boolean;
  endDate: string | null;
  planName: string | null;
  daysRemaining: number | null;
  status: number;
} 

export * from './types/index'; 