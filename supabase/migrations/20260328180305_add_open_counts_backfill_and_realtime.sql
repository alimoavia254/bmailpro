-- Applied on hosted Supabase via MCP; keep in repo for reference / CLI replay.
-- Per-open counters + campaign aggregate
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_open_events INTEGER NOT NULL DEFAULT 0;

-- Sync open_count from historical tracking_events
UPDATE public.campaign_contacts cc
SET open_count = sub.cnt
FROM (
  SELECT campaign_contact_id, COUNT(*)::integer AS cnt
  FROM public.tracking_events
  WHERE event_type = 'open'
  GROUP BY campaign_contact_id
) sub
WHERE cc.id = sub.campaign_contact_id;

-- Roll up total open events per campaign
UPDATE public.campaigns c
SET total_open_events = COALESCE(
  (SELECT SUM(cc.open_count)::integer FROM public.campaign_contacts cc WHERE cc.campaign_id = c.id),
  0
);

-- Realtime: add tables if not already in publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'campaign_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_contacts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tracking_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_events;
  END IF;
END $$;
