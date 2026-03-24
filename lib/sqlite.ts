// lib/sqlite.ts
// SQLite database layer — replaces Supabase for local development
// Switch to Supabase/PostgreSQL for production by updating lib/db.ts

import Database from 'better-sqlite3'
import path from 'path'
import crypto from 'crypto'

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'bmailpro.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

export function newId(): string {
  return crypto.randomUUID()
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'free',
      subscription_plan TEXT,
      subscription_start_date TEXT,
      subscription_end_date TEXT,
      is_admin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      can_send_bulk INTEGER DEFAULT 0,
      daily_email_limit INTEGER DEFAULT 5,
      daily_emails_sent INTEGER DEFAULT 0,
      last_email_date TEXT,
      emails_sent_this_month INTEGER DEFAULT 0,
      total_emails_sent INTEGER DEFAULT 0,
      smtp_email TEXT,
      smtp_password TEXT,
      smtp_email_1 TEXT,
      smtp_password_1 TEXT,
      smtp_label_1 TEXT,
      smtp_verified_1 INTEGER DEFAULT 0,
      smtp_email_2 TEXT,
      smtp_password_2 TEXT,
      smtp_label_2 TEXT,
      smtp_verified_2 INTEGER DEFAULT 0,
      active_smtp INTEGER DEFAULT 1,
      payment_verified_at TEXT,
      payment_verified_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      total_recipients INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      is_ab_test INTEGER DEFAULT 0,
      winner_variant_id TEXT,
      scheduled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT,
      is_unsubscribed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, email)
    );

    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES contacts(id),
      email TEXT,
      status TEXT DEFAULT 'pending',
      sent_at TEXT,
      opened_at TEXT,
      clicked_at TEXT,
      tracking_id TEXT UNIQUE,
      variant_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tracking_events (
      id TEXT PRIMARY KEY,
      campaign_contact_id TEXT REFERENCES campaign_contacts(id),
      event_type TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      link_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subject TEXT,
      body_html TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_variants (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      sent_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT,
      price REAL DEFAULT 0,
      duration_days INTEGER DEFAULT 30,
      email_limit INTEGER DEFAULT -1,
      daily_limit INTEGER DEFAULT -1,
      description TEXT,
      features TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      plan_name TEXT REFERENCES subscription_plans(id),
      amount REAL DEFAULT 0,
      payment_method TEXT,
      transaction_id TEXT,
      screenshot_url TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      processed_by TEXT,
      processed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id),
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_contacts_tracking_id ON campaign_contacts(tracking_id);
    CREATE INDEX IF NOT EXISTS idx_tracking_events_cc_id ON tracking_events(campaign_contact_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
  `)

  // Seed default settings
  const hasSettings = (db.prepare('SELECT COUNT(*) as c FROM app_settings').get() as { c: number }).c
  if (hasSettings === 0) {
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)
    `)
    insertSetting.run('free_email_limit', '5', 'Daily email limit for free users')
    insertSetting.run('whatsapp_number', '"923254139900"', 'WhatsApp contact number')
    insertSetting.run('daily_send_suggestion', '"500"', 'Daily send suggestion')
  }

  // Seed default subscription plans
  const hasPlans = (db.prepare('SELECT COUNT(*) as c FROM subscription_plans').get() as { c: number }).c
  if (hasPlans === 0) {
    const insertPlan = db.prepare(`
      INSERT OR IGNORE INTO subscription_plans
        (id, name, display_name, price, duration_days, email_limit, daily_limit, description, features, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertPlan.run(
      'monthly', 'monthly', 'Monthly Pro', 999, 30, -1, -1,
      'Unlimited emails per month',
      JSON.stringify(['Unlimited emails', 'Priority support', 'Advanced analytics', 'A/B Testing']),
      1, 1
    )
    insertPlan.run(
      'yearly', 'yearly', 'Yearly Pro', 8999, 365, -1, -1,
      'Best value — save 25%!',
      JSON.stringify(['Everything in Monthly', '25% discount', 'Priority support', 'Dedicated account manager']),
      1, 2
    )
  }
}
