# Data Platform

**Customer Journey Intelligence Engine** — measure and automate every stage from first impression to lifelong loyalty.

## Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind)
- **Auth**: Clerk (email, social, SSO)
- **Database**: Supabase (PostgreSQL + REST + RLS)
- **Deploy**: Vercel (CI/CD from GitHub)

## 7 Journey Stages

| Stage | Expert Agent | Focus |
|-------|-------------|-------|
| Awareness | Marketing Strategist | Brand reach, impressions |
| Education | Content Strategist | Content engagement |
| Acquisition | Growth Analyst | Conversion, signups |
| Onboarding | Onboarding Specialist | Activation, time-to-value |
| Product | Product Analyst | Feature adoption, NPS |
| Support | CX Ops Lead | CSAT, resolution time |
| Retention | Retention Strategist | Churn prevention, LTV |

## Setup

```bash
npm install
cp .env.example .env.local  # fill in your keys
npm run dev
```

## Deploy

Push to `main` → Vercel auto-deploys via CI/CD.
