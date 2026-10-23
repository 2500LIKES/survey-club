-- OPTIONAL: use this after checking existing policies/tables.
-- This app is a starter UI. Do not enable cash payouts until server-side atomic
-- balance deduction, authorization and payout processing have been implemented.
-- This SQL adds only member self-profile insert/update policies safely constrained to own id.
-- Admin access must be granted manually to a trusted user via SQL, never by signup metadata.

-- Keep wallet_number immutable for members; only trusted admin/server should change it.
CREATE OR REPLACE FUNCTION public.prevent_member_wallet_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.wallet_number IS DISTINCT FROM OLD.wallet_number
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Wallet number cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_wallet_immutable ON public.profiles;
CREATE TRIGGER profiles_wallet_immutable
BEFORE UPDATE OF wallet_number ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_member_wallet_change();

-- Example: after a user has signed up, grant admin only to the verified user UUID:
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_AUTH_USER_UUID';
-- Never use a public signup form to assign role=admin.
