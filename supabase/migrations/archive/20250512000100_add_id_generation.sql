-- Asegurarse de que la tabla users genere UUIDs automáticamente
DO $$
BEGIN
    -- Crear extensión uuid-ossp si no existe
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Verificar si la columna id tiene un default
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'id' 
        AND column_default IS NOT NULL
    ) THEN
        -- Añadir valor default usando uuid_generate_v4()
        ALTER TABLE public.users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
    END IF;
END
$$; 