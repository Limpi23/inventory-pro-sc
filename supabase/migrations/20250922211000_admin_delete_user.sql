-- Admin RPC to delete a user from auth.users (cascades to public.users)
-- Run with SECURITY DEFINER and guard with is_admin() check

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins may perform this action
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'only admins can delete users';
  END IF;

  -- Optional: avoid self-deletion to prevent lockout from the UI
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete yourself';
  END IF;

  -- Deleting from auth.users will cascade to public.users via FK
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;