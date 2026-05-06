# 📧 BMailPro

A modern, full-stack email marketing platform built with **Next.js** and **Supabase**.

---

## 🚀 Tech Stack

- **Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (PostgreSQL + Row Level Security)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Error Tracking:** Sentry
- **Deployment:** Vercel

---

## ✨ Features

- User authentication via Supabase Auth
- Email campaign management
- Secure unsubscribe flow
- Cron job support for scheduled emails
- End-to-end encryption for sensitive data

---

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- pnpm (recommended)

### Installation

```bash
# Clone the repo
git clone https://github.com/alimoavia254/bmailpro.git
cd bmailpro

# Install dependencies
pnpm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
CRON_SECRET=replace-with-random-long-secret
ENCRYPTION_KEY=replace-with-random-32-plus-char-secret
UNSUBSCRIBE_SECRET=replace-with-random-long-secret
```

### Database Setup

Apply Supabase migrations:

```bash
supabase db push
```

### Run Locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
bmailpro/
├── app/              # Next.js App Router pages & API routes
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions & Supabase client
├── scripts/          # Helper scripts
├── supabase/
│   └── migrations/   # Database migration files
└── types/            # TypeScript type definitions
```

---

## 🚀 Deployment

This project is optimized for deployment on **Vercel**.

1. Import the repo on [vercel.com](https://vercel.com)
2. Add all environment variables from `.env.example`
3. Deploy!

For secure deployment best practices, see [SECURE_DEPLOY.md](./SECURE_DEPLOY.md).

---

## 📄 License

MIT
