-- Atomic per-recipient send claim (see claim_campaign_contact_for_send in DB migrations).
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS send_claim_expires_at TIMESTAMPTZ;
