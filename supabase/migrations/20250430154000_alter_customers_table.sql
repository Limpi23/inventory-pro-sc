-- Actualización de la tabla de clientes para agregar campos adicionales
ALTER TABLE IF EXISTS customers
ADD COLUMN IF NOT EXISTS identification_type TEXT,
ADD COLUMN IF NOT EXISTS identification_number TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS tax_status TEXT DEFAULT 'Regular',
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Contado',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Modifica el JSONB contact_info para que los datos existentes no se pierdan
-- Este campo se mantendrá por compatibilidad, pero ahora tendremos campos específicos
COMMENT ON COLUMN customers.contact_info IS 'Campo legado. Usar campos específicos en su lugar'; 