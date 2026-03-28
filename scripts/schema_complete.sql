-- BmailPro Master Database Schema
-- Combined from migrations 001 to 012

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- BmailPro SaaS Database Schema

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'expired')),
  is_admin BOOLEAN DEFAULT FALSE,
  emails_sent_this_month INTEGER NOT NULL DEFAULT 0,
  month_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  smtp_email TEXT,
  smtp_password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_email TEXT, -- Added for consistency
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'paused')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Campaign contacts junction table
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'clicked')),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  tracking_id TEXT UNIQUE,
  UNIQUE(campaign_id, contact_id)
);

-- Tracking events table
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_contact_id UUID NOT NULL REFERENCES public.campaign_contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
  ip_address TEXT,
  user_agent TEXT,
  link_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Campaigns policies
DROP POLICY IF EXISTS "campaigns_select_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update_own" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete_own" ON public.campaigns;
CREATE POLICY "campaigns_select_own" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaigns_insert_own" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaigns_update_own" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campaigns_delete_own" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

-- Contacts policies
DROP POLICY IF EXISTS "contacts_select_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_own" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_own" ON public.contacts;
CREATE POLICY "contacts_select_own" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contacts_insert_own" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_update_own" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contacts_delete_own" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- Campaign contacts policies
DROP POLICY IF EXISTS "campaign_contacts_select_own" ON public.campaign_contacts;
DROP POLICY IF EXISTS "campaign_contacts_insert_own" ON public.campaign_contacts;
DROP POLICY IF EXISTS "campaign_contacts_update_own" ON public.campaign_contacts;
DROP POLICY IF EXISTS "campaign_contacts_delete_own" ON public.campaign_contacts;
CREATE POLICY "campaign_contacts_select_own" ON public.campaign_contacts FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "campaign_contacts_insert_own" ON public.campaign_contacts FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "campaign_contacts_update_own" ON public.campaign_contacts FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "campaign_contacts_delete_own" ON public.campaign_contacts FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()
  ));

-- Tracking events policies (select only for users)
DROP POLICY IF EXISTS "tracking_events_select_own" ON public.tracking_events;
CREATE POLICY "tracking_events_select_own" ON public.tracking_events FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.campaign_contacts cc 
    JOIN public.campaigns c ON c.id = cc.campaign_id 
    WHERE cc.id = campaign_contact_id AND c.user_id = auth.uid()
  ));

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON public.campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_tracking_id ON public.campaign_contacts(tracking_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_campaign_contact_id ON public.tracking_events(campaign_contact_id);
-- Section 2 (Redundant definitions removed)

-- Trigger to automatically create profile on signup (Consolidated in first section)
-- BmailPro Admin Panel Schema Enhancement
-- Adds subscription plans, payment requests, app settings, activity logs

-- Subscription Plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL,
  email_limit INTEGER DEFAULT -1, -- -1 means unlimited
  daily_limit INTEGER DEFAULT -1, -- -1 means unlimited
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Requests table
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL REFERENCES public.subscription_plans(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'nayapay',
  transaction_id TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  notes TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App Settings table (key-value store for admin settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to profiles table if not exists
DO $$
BEGIN
  -- Subscription management columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_plan') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_plan TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_start_date') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_start_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_end_date') THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_end_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'daily_email_limit') THEN
    ALTER TABLE public.profiles ADD COLUMN daily_email_limit INTEGER DEFAULT 5;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'daily_emails_sent') THEN
    ALTER TABLE public.profiles ADD COLUMN daily_emails_sent INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'total_emails_sent') THEN
    ALTER TABLE public.profiles ADD COLUMN total_emails_sent INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_email_date') THEN
    ALTER TABLE public.profiles ADD COLUMN last_email_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'can_send_bulk') THEN
    ALTER TABLE public.profiles ADD COLUMN can_send_bulk BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_verified_at') THEN
    ALTER TABLE public.profiles ADD COLUMN payment_verified_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_verified_by') THEN
    ALTER TABLE public.profiles ADD COLUMN payment_verified_by UUID REFERENCES public.profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notes') THEN
    ALTER TABLE public.profiles ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Subscription Plans policies (public read for active plans)
DROP POLICY IF EXISTS "subscription_plans_select_active" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select_active" ON public.subscription_plans 
  FOR SELECT USING (is_active = true);

-- Payment Requests policies
DROP POLICY IF EXISTS "payment_requests_select_own" ON public.payment_requests;
CREATE POLICY "payment_requests_select_own" ON public.payment_requests 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payment_requests_insert_own" ON public.payment_requests;
CREATE POLICY "payment_requests_insert_own" ON public.payment_requests 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- App Settings policies (public read)
DROP POLICY IF EXISTS "app_settings_select_all" ON public.app_settings;
CREATE POLICY "app_settings_select_all" ON public.app_settings 
  FOR SELECT USING (true);

-- Activity Logs policies (users can see own logs)
DROP POLICY IF EXISTS "activity_logs_select_own" ON public.activity_logs;
CREATE POLICY "activity_logs_select_own" ON public.activity_logs 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "activity_logs_insert_own" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_own" ON public.activity_logs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default subscription plans
INSERT INTO public.subscription_plans (id, name, display_name, price, duration_days, email_limit, daily_limit, description, features, sort_order) VALUES
  ('monthly', 'monthly', 'Monthly Pro', 9.99, 30, -1, -1, 'Full access for 30 days', '["Unlimited emails", "Open tracking", "Click tracking", "CSV import", "Analytics dashboard"]'::jsonb, 1),
  ('quarterly', 'quarterly', 'Quarterly Pro', 24.99, 90, -1, -1, 'Full access for 90 days - Save 17%', '["Unlimited emails", "Open tracking", "Click tracking", "CSV import", "Analytics dashboard", "Priority support"]'::jsonb, 2),
  ('yearly', 'yearly', 'Yearly Pro', 79.99, 365, -1, -1, 'Full access for 1 year - Save 33%', '["Unlimited emails", "Open tracking", "Click tracking", "CSV import", "Analytics dashboard", "Priority support", "Early access to features"]'::jsonb, 3)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price = EXCLUDED.price,
  duration_days = EXCLUDED.duration_days,
  description = EXCLUDED.description,
  features = EXCLUDED.features;

-- Insert default app settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('whatsapp_number', '"+923254139900"', 'WhatsApp contact number for payment'),
  ('nayapay_account', '"03254139900"', 'Nayapay account number for payments'),
  ('nayapay_name', '"BmailPro"', 'Account holder name for Nayapay'),
  ('contact_message', '"Hi, I want to subscribe to BmailPro. My email is: {{email}}"', 'Default WhatsApp message template'),
  ('free_email_limit', '5', 'Daily email limit for free users'),
  ('pro_email_limit', '-1', 'Daily email limit for pro users (-1 = unlimited)'),
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('registration_enabled', 'true', 'Enable/disable new user registration')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- Function to check and reset daily email count
CREATE OR REPLACE FUNCTION public.check_and_reset_daily_emails()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_email_date IS NULL OR NEW.last_email_date < CURRENT_DATE THEN
    NEW.daily_emails_sent := 0;
    NEW.last_email_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-reset daily email count
DROP TRIGGER IF EXISTS reset_daily_emails ON public.profiles;
CREATE TRIGGER reset_daily_emails
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_reset_daily_emails();

-- Function to check subscription expiry
CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET 
    subscription_status = 'expired',
    can_send_bulk = FALSE,
    daily_email_limit = 5
  WHERE 
    subscription_status = 'active' 
    AND subscription_end_date < NOW();
END;
$$ LANGUAGE plpgsql;
-- Add dual SMTP support to profiles
-- Preserves existing smtp_email / smtp_password as account 1

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS smtp_email_1    TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password_1 TEXT,
  ADD COLUMN IF NOT EXISTS smtp_label_1    TEXT DEFAULT 'Account 1',
  ADD COLUMN IF NOT EXISTS smtp_verified_1 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS smtp_email_2    TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password_2 TEXT,
  ADD COLUMN IF NOT EXISTS smtp_label_2    TEXT DEFAULT 'Account 2',
  ADD COLUMN IF NOT EXISTS smtp_verified_2 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_smtp     INTEGER DEFAULT 1;

-- Migrate existing single SMTP data into slot 1
UPDATE public.profiles
SET
  smtp_email_1    = smtp_email,
  smtp_password_1 = smtp_password
WHERE smtp_email IS NOT NULL;
-- Migration 005: Rename 'body' column to 'body_html' in campaigns table
-- Ensures consistency with application code which always uses 'body_html'.
-- This is safe to run multiple times (idempotent).

DO $$
BEGIN
  -- Only rename if 'body' exists but 'body_html' does not
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'campaigns'
      AND column_name  = 'body'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'campaigns'
      AND column_name  = 'body_html'
  ) THEN
    ALTER TABLE public.campaigns RENAME COLUMN body TO body_html;
    RAISE NOTICE 'Renamed campaigns.body -> campaigns.body_html';
  ELSE
    RAISE NOTICE 'No rename needed: body_html already exists or body does not exist.';
  END IF;
END $$;
-- Migration 006: Add is_unsubscribed to contacts
-- This column tracks if a contact has unsubscribed from all marketing emails.

-- Add the column with a default value of false
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_unsubscribed BOOLEAN DEFAULT false;

-- Create an index to quickly find unsubscribed contacts
CREATE INDEX IF NOT EXISTS idx_contacts_unsubscribed ON public.contacts(is_unsubscribed) WHERE is_unsubscribed = true;

-- Update existing records just in case
-- UPDATE public.contacts SET is_unsubscribed = false WHERE is_unsubscribed IS NULL;
-- Migration 007: Email Templates System
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body_html TEXT NOT NULL,
  body_text TEXT,
  is_public BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'custom',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert 6 professional templates
INSERT INTO public.templates (name, subject, body_html, is_public, category) VALUES
('Welcome Email', 'Welcome to BMail Pro!', '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
  <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 16px;">Welcome aboard, {{name}}!</h1>
  <p style="color: #4b5563; line-height: 1.6;">We''re excited to have you with us. BMail Pro is designed to help you send professional emails easily.</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="#" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started Now</a>
  </div>
  <p style="color: #6b7280; font-size: 14px;">If you have any questions, just reply to this email.</p>
</div>', true, 'welcome'),

('Newsletter', 'Weekly Update from BMail Pro', '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #1e293b; padding: 40px; text-align: center; color: white;">
    <h1 style="margin: 0;">Weekly Digest</h1>
  </div>
  <div style="padding: 40px; background-color: white; border: 1px solid #e5e7eb;">
    <h2 style="color: #111827;">Top Stories This Week</h2>
    <p style="color: #4b5563;">Here are the latest updates and features we''ve added to make your experience better.</p>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <h3 style="color: #111827;">New Queue System</h3>
    <p style="color: #4b5563;">Our new high-performance queue system ensures your emails land in the inbox faster than ever.</p>
  </div>
</div>', true, 'newsletter'),

('Promotional/Sale', 'Big Savings Inside!', '<div style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 12px;">
    <p style="color: #dc2626; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Limited Time Offer</p>
    <h1 style="font-size: 36px; margin: 12px 0;">50% OFF PRO PLAN</h1>
    <p style="color: #4b5563; font-size: 18px;">Upgrade today and unlock unlimited emails, custom templates, and advanced analytics.</p>
    <a href="#" style="display: block; margin-top: 32px; background-color: #000; color: white; padding: 16px; text-decoration: none; font-weight: 700; border-radius: 8px;">Claim Your Discount</a>
  </div>
</div>', true, 'promotion'),

('Product Announcement', 'Coming Soon: Advanced Analytics', '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
  <img src="https://via.placeholder.com/600x300" alt="New Feature" style="width: 100%; border-radius: 12px;" />
  <h1 style="margin-top: 24px;">Advanced Analytics are Here</h1>
  <p style="color: #4b5563;">Track your opens, clicks, and bounces in real-time with our new dashboard.</p>
  <ul style="color: #4b5563; padding-left: 20px;">
    <li>Geographic tracking</li>
    <li>Device statistics</li>
    <li>A/B test results</li>
  </ul>
</div>', true, 'announcement'),

('Follow-up', 'Quick question about {{name}}', '<div style="font-family: sans-serif; line-height: 1.6; color: #374151;">
  <p>Hi {{name}},</p>
  <p>I wanted to follow up on our previous conversation. Have you had a chance to look at the proposal I sent over?</p>
  <p>I''m here to answer any questions you might have.</p>
  <p>Best regards,<br />The BMail Pro Team</p>
</div>', true, 'follow_up'),

('Plain Text Professional', 'Meeting inquiry', '<div style="font-family: monospace; white-space: pre-wrap; font-size: 14px; color: #000;">
Hi {{name}},

This is a plain professional message regarding our upcoming collaboration.

Let me know if you are available for a quick call tomorrow at 10 AM.

Regards,
Admin
</div>', true, 'plain');
-- Migration 008: Contact Tags System
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6', -- Default blue
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON public.contact_tags(tag_id);
-- Migration 009: Scheduled Campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Index for efficient cron lookup
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.campaigns (scheduled_at) 
WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;
-- Migration 010: Webhook System
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT '{open, click}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for user, url, event
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_user_url ON public.webhooks (user_id, url);
-- Migration 011: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON public.campaign_contacts (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON public.campaign_contacts (status);
CREATE INDEX IF NOT EXISTS idx_tracking_events_campaign_contact_id ON public.tracking_events (campaign_contact_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON public.webhooks (user_id);
-- Migration 012: A/B Testing System
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_ab_test BOOLEAN DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS winner_variant_id UUID;

CREATE TABLE IF NOT EXISTS public.campaign_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., 'Variant A', 'Variant B'
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add variant_id to campaign_contacts to track which recipient got which version
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.campaign_variants(id) ON DELETE SET NULL;

-- Per-open event counts (each pixel load increments open_count; campaigns.total_open_events sums all opens)
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_open_events INTEGER NOT NULL DEFAULT 0;

-- Prevent duplicate SMTP for the same row when two send workers overlap (drip + tab, etc.)
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS send_claim_expires_at TIMESTAMPTZ;
