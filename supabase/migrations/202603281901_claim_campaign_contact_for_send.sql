-- Run on any environment that does not have the MCP-applied migration yet.
CREATE OR REPLACE FUNCTION public.claim_campaign_contact_for_send(p_contact_id uuid, p_ttl_seconds int DEFAULT 120)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  ttl int := GREATEST(30, LEAST(COALESCE(p_ttl_seconds, 120), 600));
BEGIN
  UPDATE public.campaign_contacts
  SET send_claim_expires_at = timezone('utc', now()) + (ttl || ' seconds')::interval
  WHERE id = p_contact_id
    AND status IN ('pending', 'failed')
    AND (send_claim_expires_at IS NULL OR send_claim_expires_at < timezone('utc', now()));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_contact_for_send(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_campaign_contact_for_send(uuid, int) TO service_role;
