-- Run once in Supabase Dashboard → SQL Editor if live updates (opens/clicks/status) never appear without refresh.
-- Realtime only broadcasts tables that are part of the supabase_realtime publication.
-- If a line errors with "already member of publication", skip that line (table is already enabled).

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_events;
