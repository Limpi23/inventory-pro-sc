-- Cierra execute_migration a la app
--
-- execute_migration() ejecuta SQL arbitrario con los privilegios del dueño de
-- las tablas (SECURITY DEFINER). Estaba concedida a anon y authenticated, y la
-- anon key viaja dentro del instalador: cualquiera que la extrajera podía leer,
-- modificar o borrar la base entera.
--
-- A partir de aquí solo la invoca service_role: el administrador, la CLI de
-- Supabase o scripts/migrate-clients.mjs. La app ya no aplica migraciones por
-- su cuenta; al arrancar solo comprueba que el esquema esté al día.
--
-- Postgres concede EXECUTE a PUBLIC por defecto, por eso se revoca también ahí.

REVOKE ALL ON FUNCTION public.execute_migration(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_migration(text) FROM anon;
REVOKE ALL ON FUNCTION public.execute_migration(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_migration(text) TO service_role;
