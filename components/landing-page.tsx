'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Plan {
  id: string
  name: string
  display_name: string
  price: number
  duration_days: number
  description: string
  features: string[]
  is_active: boolean
}

interface LandingPageProps {
  onGetStarted: () => void
  onSignIn: () => void
}

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
    ),
    title: 'Email Campaigns',
    desc: 'Create, design, and send beautiful email campaigns to your entire contact list with just a few clicks.',
    color: '#7c5cfc',
    bg: '#f0edff',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    title: 'Real-time Tracking',
    desc: 'Know exactly when recipients open your emails and which links they click — all in real time.',
    color: '#00c9a7',
    bg: '#e0fdf4',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
    title: 'Analytics Dashboard',
    desc: 'Visualize open rates, click rates, and campaign performance with beautiful charts and reports.',
    color: '#a78bfa',
    bg: '#f0edff',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Contact Management',
    desc: 'Organize your lists, import/export contacts, and manage unsubscribes automatically.',
    color: '#a78bfa',
    bg: '#f0edff',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Scheduled Campaigns',
    desc: 'Schedule emails to send at the perfect moment for maximum engagement with your audience.',
    color: '#7c5cfc',
    bg: '#f0edff',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Secure SMTP',
    desc: 'Use your own SMTP server or Gmail for reliable, authenticated, and secure email delivery.',
    color: '#00c9a7',
    bg: '#e0fdf4',
  },
]

const steps = [
  {
    num: '01',
    title: 'Connect Your Email',
    desc: 'Set up your SMTP server or connect your Gmail account in just a few minutes.',
  },
  {
    num: '02',
    title: 'Import Contacts',
    desc: 'Upload your contact list, organize segments, and get ready to reach your audience.',
  },
  {
    num: '03',
    title: 'Send & Track',
    desc: 'Launch your campaign and watch real-time analytics roll in on your dashboard.',
  },
]

export default function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [freeLimit, setFreeLimit] = useState(5)
  const [plansLoading, setPlansLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const fetchData = async () => {
      const [{ data: plansData }, { data: settingsData }] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase.from('app_settings').select('*'),
      ])

      if (plansData) {
        setPlans(plansData.map((p: any) => ({
          ...p,
          features: typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || []),
        })))
      }
      if (settingsData) {
        const s: any = {}
        settingsData.forEach((row: any) => {
          try { s[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value }
          catch { s[row.key] = row.value }
        })
        if (s.free_email_limit) setFreeLimit(Number(s.free_email_limit))
      }
      setPlansLoading(false)
    }
    fetchData()
  }, [])

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        /* ── Responsive utilities ─────────────────────────── */
        .lp-nav-links { display: flex; align-items: center; gap: 2rem; }
        .lp-nav-hamburger { display: none; background: transparent; border: none; cursor: pointer; padding: 6px; color: rgba(255,255,255,0.7); }
        .lp-mobile-menu { display: none; }
        .lp-hero-cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .lp-stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); width: 100%; }
        .lp-stats-item { padding: clamp(1rem,3vw,1.5rem) clamp(1rem,3vw,2.5rem); text-align: center; border-right: 1px solid rgba(255,255,255,0.06); }
        .lp-stats-item:last-child { border-right: none; }
        .lp-footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .lp-features-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(310px,100%), 1fr)); gap: clamp(1rem,2vw,1.5rem); }
        .lp-steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px,100%), 1fr)); gap: clamp(2rem,4vw,3rem); }
        .lp-plans-grid { display: grid; gap: 1.25rem; align-items: start; }
        .lp-free-strip { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .lp-payment-badges { display: flex; align-items: center; justify-content: center; gap: 1.5rem; flex-wrap: wrap; }

        @media (max-width: 768px) {
          .lp-nav-links { display: none; }
          .lp-nav-hamburger { display: flex; align-items: center; justify-content: center; }
          .lp-mobile-menu.open {
            display: flex; flex-direction: column; gap: 0;
            position: fixed; top: 64px; left: 0; right: 0; z-index: 99;
            background: rgba(14,14,22,0.98); backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding: 0.5rem 0 1rem;
          }
          .lp-mobile-menu.open a {
            display: block; padding: 0.875rem 1.5rem;
            color: rgba(255,255,255,0.7); font-size: 1rem;
            font-weight: 500; text-decoration: none;
            border-bottom: 1px solid rgba(255,255,255,0.04);
          }
          .lp-mobile-menu.open .lp-mobile-menu-btns {
            display: flex; gap: 0.75rem; padding: 1rem 1.5rem 0;
          }
          .lp-hero-cta { flex-direction: column; align-items: stretch; width: 100%; max-width: 360px; margin: 0 auto; }
          .lp-hero-cta button { width: 100%; justify-content: center; }
          .lp-stats-bar { grid-template-columns: repeat(2, 1fr); }
          .lp-stats-item { border-right: 1px solid rgba(255,255,255,0.06) !important; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .lp-stats-item:nth-child(2n) { border-right: none !important; }
          .lp-stats-item:nth-last-child(-n+2) { border-bottom: none; }
          .lp-footer-inner { flex-direction: column; align-items: center; text-align: center; }
          .lp-free-strip { flex-direction: column; align-items: flex-start; }
          .lp-free-strip-actions { width: 100%; }
          .lp-free-strip-actions button { width: 100%; }
        }

        @media (max-width: 480px) {
          .lp-stats-bar { grid-template-columns: repeat(2, 1fr); }
          .lp-payment-badges { gap: 1rem; }
        }

        @media (min-width: 769px) {
          .lp-mobile-menu { display: none !important; }
        }

        /* Hover states */
        .lp-nav-link:hover { color: rgba(255,255,255,0.9) !important; }
        .lp-feature-card:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(0,0,0,0.08) !important; transition: transform 0.2s, box-shadow 0.2s; }
        .lp-cta-primary:hover { opacity: 0.92; transform: translateY(-1px); transition: opacity 0.15s, transform 0.15s; }
        .lp-cta-secondary:hover { background: rgba(255,255,255,0.09) !important; transition: background 0.15s; }
      `}</style>

      {/* ─── NAVBAR ─────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(14,14,22,0.9)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(1.25rem, 5vw, 3rem)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, #7c5cfc, #00c9a7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <span style={{
            fontFamily: 'var(--font-syne), Syne, sans-serif',
            fontWeight: 800, fontSize: '1.0625rem', color: '#fff', letterSpacing: '-0.02em',
          }}>
            Bmail<span style={{ color: '#7c5cfc' }}>Pro</span>
          </span>
        </div>

        {/* Center links — desktop */}
        <div className="lp-nav-links">
          {['Features', 'How it works', 'Pricing'].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
              className="lp-nav-link"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', fontWeight: 500,
                textDecoration: 'none', letterSpacing: '0.01em',
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Right side: buttons (desktop) + hamburger (mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="lp-nav-links" style={{ gap: 10 }}>
            <button
              onClick={onSignIn}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent', color: 'rgba(255,255,255,0.75)',
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: '#7c5cfc', color: '#fff',
                fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 0 1px rgba(124,92,252,0.5), 0 2px 8px rgba(124,92,252,0.3)',
                letterSpacing: '0.01em',
              }}
            >
              Get Started
            </button>
          </div>

          {/* Hamburger */}
          <button
            className="lp-nav-hamburger"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`lp-mobile-menu${mobileMenuOpen ? ' open' : ''}`}>
        {['Features', 'How it works', 'Pricing'].map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            {label}
          </a>
        ))}
        <div className="lp-mobile-menu-btns">
          <button
            onClick={() => { setMobileMenuOpen(false); onSignIn() }}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: 'rgba(255,255,255,0.75)',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMobileMenuOpen(false); onGetStarted() }}
            style={{
              flex: 1, padding: '10px', borderRadius: 8, border: 'none',
              background: '#7c5cfc', color: '#fff',
              fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Get Started
          </button>
        </div>
      </div>

      {/* ─── HERO ────────────────────────────────────────── */}
      <section style={{
        minHeight: '100dvh',
        background: '#0e0e16',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: '100px clamp(1.25rem, 5vw, 3rem) clamp(6rem, 12vw, 8rem)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Gradient blobs */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 75% 55% at 50% 25%, rgba(124,92,252,0.2), transparent),' +
            'radial-gradient(ellipse 55% 45% at 85% 65%, rgba(0,201,167,0.12), transparent),' +
            'radial-gradient(ellipse 45% 45% at 15% 70%, rgba(124,92,252,0.1), transparent)',
        }} />
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 740, width: '100%' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 100,
            border: '1px solid rgba(124,92,252,0.3)',
            background: 'rgba(124,92,252,0.08)',
            marginBottom: '2rem',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#7c5cfc', display: 'block',
              boxShadow: '0 0 8px rgba(124,92,252,0.9)',
            }} />
            <span style={{
              fontSize: '0.6875rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              Professional Email Tracking Platform
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-syne), Syne, sans-serif',
            fontWeight: 800, color: '#fff',
            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            lineHeight: 1.02, letterSpacing: '-0.04em',
            marginBottom: '1.5rem',
          }}>
            Send. Track.{' '}
            <span style={{
              background: 'linear-gradient(90deg, #a78bfa 0%, #00c9a7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Convert.</span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.3125rem)',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.7,
            maxWidth: 540, margin: '0 auto 2.75rem',
          }}>
            BmailPro gives your team powerful email campaign management with real-time open &amp; click tracking — so you always know what&apos;s working.
          </p>

          {/* CTA */}
          <div className="lp-hero-cta">
            <button
              onClick={onGetStarted}
              className="lp-cta-primary"
              style={{
                padding: '15px 36px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #7c5cfc 0%, #5b21b6 100%)',
                color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 40px rgba(124,92,252,0.45)',
                display: 'flex', alignItems: 'center', gap: 8,
                letterSpacing: '-0.01em',
              }}
            >
              Get Started Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button
              onClick={onSignIn}
              className="lp-cta-secondary"
              style={{
                padding: '15px 36px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.8)', fontSize: '1rem', fontWeight: 600,
                cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}
            >
              Sign In
            </button>
          </div>

          <p style={{
            marginTop: '1.5rem', fontSize: '0.8125rem',
            color: 'rgba(255,255,255,0.25)', fontWeight: 500,
          }}>
            No credit card required &nbsp;·&nbsp; Free plan available
          </p>
        </div>

        {/* Stats bar */}
        <div className="lp-stats-bar" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 1,
        }}>
          {[
            { n: '99.9%', l: 'Delivery Rate' },
            { n: '2M+', l: 'Emails Tracked' },
            { n: '45%', l: 'Avg. Open Rate' },
            { n: '10k+', l: 'Happy Users' },
          ].map((s, i) => (
            <div key={i} className="lp-stats-item">
              <div style={{
                fontFamily: 'var(--font-syne), Syne, sans-serif',
                fontSize: 'clamp(1.25rem, 4vw, 1.875rem)',
                fontWeight: 800, color: '#fff', lineHeight: 1.1,
              }}>{s.n}</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────── */}
      <section id="features" style={{
        background: '#f7f8fc',
        padding: 'clamp(4rem, 10vw, 7rem) clamp(1.25rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem, 6vw, 4rem)' }}>
            <div style={{
              display: 'inline-block', padding: '5px 16px', borderRadius: 100,
              background: '#f0edff', color: '#7c5cfc',
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: '1rem',
            }}>Features</div>
            <h2 style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800, fontSize: 'clamp(1.875rem, 4vw, 2.625rem)',
              color: '#0e0e16', letterSpacing: '-0.035em', marginBottom: '0.875rem',
            }}>Everything you need to succeed</h2>
            <p style={{
              color: '#64748b', fontSize: 'clamp(0.9375rem, 2vw, 1.0625rem)',
              maxWidth: 500, margin: '0 auto', lineHeight: 1.65,
            }}>
              A complete toolkit for professional email marketing, tracking, and analytics.
            </p>
          </div>

          {/* Grid */}
          <div className="lp-features-grid">
            {features.map((f, i) => (
              <div key={i} className="lp-feature-card" style={{
                background: '#ffffff',
                borderRadius: 16, padding: 'clamp(1.5rem, 3vw, 2rem)',
                border: '1px solid #e2e4f0',
                boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: f.bg, color: f.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.125rem',
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-syne), Syne, sans-serif',
                  fontWeight: 700, fontSize: '1.0625rem', color: '#0e0e16',
                  marginBottom: '0.5rem',
                }}>{f.title}</h3>
                <p style={{ color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────── */}
      <section id="how-it-works" style={{
        background: '#0e0e16',
        padding: 'clamp(4rem, 10vw, 7rem) clamp(1.25rem, 5vw, 3rem)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 65% 50% at 50% 50%, rgba(124,92,252,0.09), transparent)',
        }} />

        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem, 6vw, 4rem)' }}>
            <div style={{
              display: 'inline-block', padding: '5px 16px', borderRadius: 100,
              background: 'rgba(124,92,252,0.12)', color: '#a78bfa',
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: '1rem',
              border: '1px solid rgba(124,92,252,0.2)',
            }}>How it works</div>
            <h2 style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800, fontSize: 'clamp(1.875rem, 4vw, 2.625rem)',
              color: '#fff', letterSpacing: '-0.035em',
            }}>Up and running in minutes</h2>
          </div>

          <div className="lp-steps-grid">
            {steps.map((step, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'rgba(124,92,252,0.12)',
                  border: '1px solid rgba(124,92,252,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.375rem',
                  fontFamily: 'var(--font-syne), Syne, sans-serif',
                  fontWeight: 800, fontSize: '0.875rem', color: '#a78bfa',
                  letterSpacing: '-0.02em',
                }}>{step.num}</div>

                <h3 style={{
                  fontFamily: 'var(--font-syne), Syne, sans-serif',
                  fontWeight: 700, fontSize: '1.0625rem', color: '#fff',
                  marginBottom: '0.625rem',
                }}>{step.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────── */}
      <section id="pricing" style={{
        background: '#f7f8fc',
        padding: 'clamp(4rem, 10vw, 7rem) clamp(1.25rem, 5vw, 3rem)',
      }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem, 6vw, 4rem)' }}>
            <div style={{
              display: 'inline-block', padding: '5px 16px', borderRadius: 100,
              background: '#f0edff', color: '#7c5cfc',
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: '1rem',
            }}>Pricing</div>
            <h2 style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800, fontSize: 'clamp(1.875rem, 4vw, 2.625rem)',
              color: '#0e0e16', letterSpacing: '-0.035em', marginBottom: '0.875rem',
            }}>Simple, transparent pricing</h2>
            <p style={{ color: '#64748b', fontSize: 'clamp(0.9375rem, 2vw, 1.0625rem)', maxWidth: 440, margin: '0 auto' }}>
              Start for free, upgrade when you need more power.
            </p>
          </div>

          {/* Free plan strip */}
          <div className="lp-free-strip" style={{
            background: '#fff', borderRadius: 14, padding: '1.25rem 1.5rem',
            border: '1px solid #e2e4f0', marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: '#f0edff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0e0e16' }}>Free Plan</div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  {freeLimit} emails per day &nbsp;·&nbsp; Basic features &nbsp;·&nbsp; No payment required
                </div>
              </div>
            </div>
            <div className="lp-free-strip-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                padding: '4px 12px', borderRadius: 100, background: '#f0edff',
                fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em',
              }}>LIMITED</span>
              <button
                onClick={onGetStarted}
                style={{
                  padding: '9px 20px', borderRadius: 9,
                  border: '1.5px solid #e2e4f0', background: '#f7f8fc',
                  color: '#0e0e16', fontWeight: 700, fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Get started free
              </button>
            </div>
          </div>

          {/* Paid plans — dynamic from DB */}
          {plansLoading ? (
            <div className="lp-plans-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px,100%), 1fr))' }}>
              {[1, 2].map((i) => (
                <div key={i} style={{
                  borderRadius: 20, height: 320,
                  background: 'linear-gradient(90deg, #f0edff 0%, #f7f8fc 50%, #f0edff 100%)',
                  border: '1px solid #e2e4f0',
                }} />
              ))}
            </div>
          ) : plans.length === 0 ? null : (
            <div
              className="lp-plans-grid"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${plans.length === 1 ? '320px' : '260px'}, 100%), 1fr))` }}
            >
              {plans.map((plan, index) => {
                const isBestValue = plans.length >= 2 && index === 0
                const isPopular = plans.length >= 2 && index === plans.length - 1
                const isDark = isPopular

                return (
                  <div key={plan.id} style={{
                    background: isDark ? '#0e0e16' : '#fff',
                    borderRadius: 20,
                    border: isBestValue
                      ? '2px solid #00c9a7'
                      : isDark
                      ? '1px solid rgba(124,92,252,0.35)'
                      : '1px solid #e2e4f0',
                    boxShadow: isDark
                      ? '0 8px 48px rgba(124,92,252,0.2)'
                      : '0 2px 16px rgba(0,0,0,0.04)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {isBestValue && (
                      <div style={{
                        background: '#00c9a7', color: '#fff',
                        textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700,
                        padding: '7px', letterSpacing: '0.06em',
                      }}>BEST VALUE — SAVE 17%</div>
                    )}
                    {isPopular && (
                      <div style={{
                        background: '#7c5cfc', color: '#fff',
                        textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700,
                        padding: '7px', letterSpacing: '0.06em',
                      }}>MOST POPULAR — SAVE 33%</div>
                    )}

                    {isDark && (
                      <div style={{
                        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                        width: '80%', height: '50%',
                        background: 'radial-gradient(ellipse, rgba(124,92,252,0.12), transparent)',
                        pointerEvents: 'none',
                      }} />
                    )}

                    <div style={{ padding: '1.75rem', position: 'relative' }}>
                      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                        <div style={{
                          fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
                          textTransform: 'uppercase', marginBottom: 6,
                          color: isDark ? 'rgba(255,255,255,0.35)' : '#64748b',
                        }}>{plan.duration_days} days</div>
                        <h3 style={{
                          fontFamily: 'var(--font-syne), Syne, sans-serif',
                          fontWeight: 800, fontSize: '1.25rem',
                          color: isDark ? '#fff' : '#0e0e16',
                          marginBottom: 4,
                        }}>{plan.display_name}</h3>
                        <p style={{ fontSize: '0.8125rem', color: isDark ? 'rgba(255,255,255,0.4)' : '#64748b' }}>
                          {plan.description}
                        </p>
                      </div>

                      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                        <span style={{
                          fontFamily: 'var(--font-syne), Syne, sans-serif',
                          fontWeight: 800, fontSize: '2.75rem',
                          color: isDark ? '#fff' : '#0e0e16', lineHeight: 1,
                        }}>${plan.price}</span>
                        <span style={{
                          fontSize: '0.875rem', marginLeft: 4,
                          color: isDark ? 'rgba(255,255,255,0.35)' : '#64748b',
                        }}>one-time</span>
                      </div>

                      <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e4f0', margin: '1.25rem 0' }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
                        {(plan.features || []).map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                              background: isDark ? 'rgba(124,92,252,0.2)' : '#e0fdf4',
                              color: isDark ? '#a78bfa' : '#00c9a7',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.6rem', fontWeight: 700,
                            }}>✓</div>
                            <span style={{ fontSize: '0.875rem', color: isDark ? 'rgba(255,255,255,0.7)' : '#0e0e16', lineHeight: 1.4 }}>
                              {f}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={onGetStarted}
                        style={{
                          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                          background: isBestValue
                            ? 'linear-gradient(135deg, #00c9a7, #00a885)'
                            : isDark
                            ? 'linear-gradient(135deg, #7c5cfc, #5b21b6)'
                            : '#f7f8fc',
                          color: (isBestValue || isDark) ? '#fff' : '#0e0e16',
                          fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                          boxShadow: isBestValue
                            ? '0 4px 20px rgba(0,201,167,0.35)'
                            : isDark
                            ? '0 4px 20px rgba(124,92,252,0.4)'
                            : 'none',
                          outline: (!isBestValue && !isDark) ? '1.5px solid #e2e4f0' : 'none',
                        }}
                      >
                        Get {plan.display_name}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Payment note */}
          <div className="lp-payment-badges" style={{ marginTop: '1.5rem' }}>
            {[
              { icon: '🔒', text: 'Secure Payments' },
              { icon: '⚡', text: '24hr Activation' },
              { icon: '💬', text: 'WhatsApp Support' },
            ].map((b) => (
              <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{b.icon}</span>
                <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────── */}
      <section style={{
        background: '#0e0e16',
        padding: 'clamp(5rem, 12vw, 8rem) clamp(1.25rem, 5vw, 3rem)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(124,92,252,0.14), transparent)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }} />
        <div style={{ position: 'relative', maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'var(--font-syne), Syne, sans-serif',
            fontWeight: 800, fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            color: '#fff', letterSpacing: '-0.04em', marginBottom: '1rem',
          }}>
            Start tracking your emails today
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 'clamp(1rem, 2vw, 1.125rem)',
            lineHeight: 1.65, marginBottom: '2.5rem',
          }}>
            Join thousands of professionals who trust BmailPro for their email campaigns and tracking.
          </p>
          <button
            onClick={onGetStarted}
            className="lp-cta-primary"
            style={{
              padding: '16px 44px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #7c5cfc 0%, #5b21b6 100%)',
              color: '#fff', fontSize: '1.0625rem', fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 8px 40px rgba(124,92,252,0.5)',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              letterSpacing: '-0.01em',
            }}
          >
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────── */}
      <footer style={{
        background: '#0e0e16',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: 'clamp(1.75rem, 4vw, 2.5rem) clamp(1.25rem, 5vw, 3rem)',
      }}>
        <div className="lp-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'linear-gradient(135deg, #7c5cfc, #00c9a7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-syne), Syne, sans-serif',
              fontWeight: 800, fontSize: '0.9375rem', color: '#fff',
            }}>Bmail<span style={{ color: '#7c5cfc' }}>Pro</span></span>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.22)' }}>
            © {new Date().getFullYear()} BmailPro. All rights reserved.
          </div>

          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {['Privacy', 'Terms', 'Contact'].map((link) => (
              <span
                key={link}
                style={{
                  fontSize: '0.8125rem', color: 'rgba(255,255,255,0.32)',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                {link}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
