-- Crear extensión para UUIDs si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de planes de suscripción
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  features JSONB
);

-- Tabla de suscripciones
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL, -- Referencia al cliente/negocio
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status INTEGER DEFAULT 0, -- 0 = activa/operable, 1 = bloqueada/no operable
  payment_reference VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tenants (clientes/negocios)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  business_name VARCHAR(255),
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Relacionar usuarios con tenants
ALTER TABLE public.users ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Crear un tenant predeterminado para migración
INSERT INTO tenants (id, name, contact_email)
VALUES (
  uuid_generate_v4(),
  'Negocio SuitCore',
  'admin@suitcore.com'
);

-- Actualizar usuarios existentes para asignarles el tenant predeterminado
UPDATE users SET tenant_id = (SELECT id FROM tenants LIMIT 1);

-- Insertar planes de suscripción básicos
INSERT INTO subscription_plans (name, description, price, duration_days, features)
VALUES 
('Mensual', 'Plan de suscripción mensual de InventorySuit', 280.00, 30, '["Gestión completa de inventario", "Reportes detallados", "Múltiples almacenes", "Soporte prioritario"]'),
('Trimestral', 'Plan de suscripción trimestral con descuento', 750.00, 90, '["Gestión completa de inventario", "Reportes detallados", "Múltiples almacenes", "Soporte prioritario", "15% de descuento"]'),
('Anual', 'Plan de suscripción anual con descuento', 2800.00, 365, '["Gestión completa de inventario", "Reportes detallados", "Múltiples almacenes", "Soporte prioritario", "25% de descuento"]');

-- Crear una suscripción inicial válida por 30 días para el tenant predeterminado
INSERT INTO subscriptions (tenant_id, start_date, end_date, status)
VALUES (
  (SELECT id FROM tenants LIMIT 1),
  NOW(),
  NOW() + INTERVAL '30 days',
  0
); 