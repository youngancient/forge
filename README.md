# Forge

AI-assisted proposal generation for the sales team. A salesperson enters call
notes and intake details, Claude drafts a structured client proposal, the
salesperson reviews and revises it, a manager approves it internally, and the
approved proposal is emailed to the client and logged.

## Stack

Next.js (App Router) + TypeScript + Tailwind, Neon (Postgres) via Prisma,
Auth.js (credentials login), Claude (Sonnet 5) for generation, Resend for
email, Vercel Blob for file storage, a Discord bot for failure alerts.

## Setup

1. Copy `.env.example` to `.env` and fill in real values (Neon connection
   string, Anthropic key, Resend key, Vercel Blob token, Discord bot
   token/channel).
2. Install dependencies and set up the database:
   ```
   npm install
   npx prisma migrate dev
   npx prisma db seed
   ```
   The seed script creates three accounts — two salespeople
   (`jude@forge.com`, `tofunmi@forge.com`) and one manager
   (`morgan@forge.com`). Salesperson passwords come from
   `SEED_SALESPERSON_PASSWORD` and the manager's from
   `SEED_MANAGER_PASSWORD` — both required, no default — see
   `.env.example`.
3. Run the dev server:
   ```
   npm run dev
   ```
