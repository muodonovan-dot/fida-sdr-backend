# Fida AI SDR — Project README

> **For Claude:** If a new conversation starts and Mike says "pick up where we left off" — read this file FIRST. It has everything needed to resume without asking repeat questions.

---

## Live Deployments

| Service | URL |
|---------|-----|
| Frontend | https://jade-froyo-18a6f5.netlify.app/ |
| Backend | https://fida-sdr-backend.onrender.com |
| GitHub (backend) | https://github.com/muodonovan-dot/fida-sdr-backend |
| GitHub user | muodonovan-dot (muodonovan@gmail.com) |

---

## What This Is

AI-powered SDR tool built by **Mike O'Donovan (LeadGeeks)** for **Fida Bio** outreach. Generates personalized 3-email cold sequences for researchers using protein characterization instruments, introducing the **Fida NEO**. Not limited to SPR — covers multiple application areas.

Mike's territory: MT, WY, CO, NM, ND, SD, NE, KS, OK, TX, MN, IA, MO, AR, LA, WI, IL, IN, MI, KY, TN, MS

---

## Stack

- **Frontend:** Single index.html — vanilla JS, XLSX.js, PDF.js, docx (all CDN, no build step)
- **Backend:** Node.js server.js on Render (Express, node-fetch) — auto-deploys from GitHub main branch
- **AI:** claude-sonnet-4-20250514 (email generation), claude-haiku-4-5-20251001 with web-search tool (LinkedIn/research)
- **Data:** PubMed eUtils API (free, no key needed)
- **Sending:** Instantly.ai v2 API (Growth plan, Bearer token)
- **Email verify:** ZeroBounce API

---

## Fida NEO Value Prop

- Measures Rh, polydispersity, aggregation — 40nL sample
- "Don't waste SPR runs on bad reagents"
- Cytiva/Biacore partner — companion not competitor
- Label-free, native-state, solution-phase measurements

---

## Current Feature Set (v3 + v4 — LIVE)

### SDR Generator Tab

- Step 1: Anthropic + ZeroBounce + Instantly API keys (localStorage, never server-side)
- Application Focus (6 options), Campaign Context, Daily Send Cap (20/30/50/75/100/day)
- Step 2: Fida Knowledge Base PDF upload (up to 8 pages)
- Step 3: SciLeads XLSX upload + DNC suppression list. Auto-tone: .edu=academic, .com/.org=industry
- Step 4: Batch selector 25/50/100/250/500, parallel generation, results table
- lowConfidence flag (yellow row) when no PubMed AND no LinkedIn data found
- Export: CSV, Push to Instantly (auto campaign creation), Word Doc (10 contacts)

### Push to Instantly — Auto Campaign Creation (v4)

Modal fields: Campaign Name (pre-filled), Send From (email accounts from API), Send Window Start/End (30-min increments, default 8am-5pm), Timezone (US-first, default Central), Daily Send Limit

Flow: POST /campaigns (with template placeholders) -> push leads with custom_variables -> POST /campaigns/{id}/activate

Each lead pushed with: email1_subject, email1_body, email2_subject, email2_body, email3_subject, email3_body, matched_app, tone
Campaign sequence uses {{email1_subject}} etc. — Instantly substitutes at send time.

### Campaign Analytics Tab (v4)

- Campaign dropdown, Load Analytics button
- KPI Cards: Contacted, Delivered, Opens (clickable), Replies (clickable), Bounces (clickable)
- Rate Cards: Open Rate, Reply Rate, Bounce Rate with progress bars + industry benchmarks
- Email Step Breakdown table (per-step sent/open/reply)
- Retargeting: CSV export for Opened-No-Reply, Not Opened, Bounced (real Instantly API data)

### Lead Drilldown Drawer (v4)

Clicking Opens/Replies/Bounces KPI cards opens right-side drawer with:
- Contact list: name, company, email, reply snippet
- AI Triage Replies button: batch-classifies via Claude Haiku
- Sentiment badges: Interested / Follow Up / Not Interested / Out of Office / Auto-Reply
- Export CSV with sentiment classifications

---

## Backend API Endpoints

POST /generate — {lead, anthropicKey, knowledgeBase, tone, campaignContext, applicationFocus} -> {emails, research, lowConfidence}
POST /test-anthropic — key validation
POST /test-zerobounce — ZeroBounce key validation
POST /verify-emails-bulk — bulk email verification

Critical backend note: LinkedIn search uses Claude Haiku with web-search tool.
Bug fix: use .filter(b => b.type === 'text') + last block + regex /{[sS]*}/ to parse JSON from responses.
Models: claude-sonnet-4-20250514 for emails, claude-haiku-4-5-20251001 for research.

---

## Instantly.ai API Details

Version: V2 — https://api.instantly.ai/api/v2/ | Auth: Bearer token | Plan: Growth ($47/mo)

GET /campaigns?limit=1 — test key
GET /campaigns?limit=100 — list campaigns
GET /accounts?limit=100 — list sending email accounts
POST /campaigns — create campaign
POST /campaigns/{id}/activate — activate campaign
POST /leads — add lead with custom_variables
POST /leads/list — filter leads by campaign + status
GET /campaigns/analytics?campaign_id=X — campaign stats
GET /campaigns/analytics/steps?campaign_id=X — per-step stats

Lead status codes: 1=active, 2=completed, -1=bounced

---

## Branding

Orange: #EF4D05 | Navy: #171151 | Light orange: #FF8210 | Green: #00c87a
Fonts: Outfit (headings), Montserrat (body) — Google Fonts
LeadGeeks logo: orange circle, base64 transparent PNG embedded in index.html
Nav: LeadGeeks icon | "Fida Neo AI SDR / BUILT FOR FIDA BIO" | "Powered by LeadGeeks"

---

## GitHub Push Method (Confirmed Working)

Backend (server.js): navigate to github.com/muodonovan-dot/fida-sdr-backend/upload/main
JS injection: create File object, add to DataTransfer, set on input[type="file"], dispatch change event, click Commit changes.
Render auto-deploys in ~2 minutes.

Frontend (index.html): drag to app.netlify.com/projects/jade-froyo-18a6f5/deploys (scroll to bottom drop zone) OR app.netlify.com/drop

---

## Application Focus Options

general — Native-state Rh, aggregation, polydispersity
spr_biacore — Biacore/SPR companion: reagent QC + orthogonal KD
antibody_dev — Aggregation screening during developability, 40nL sample
drug_discovery — Label-free target engagement, fragment binding
structural_biology — Pre-screening before cryo-EM grids or crystals
de_novo_proteins — Validate folding and monodispersity in solution

---

## Roadmap

v1 — Done: Basic generation
v2 — Done: Word doc export, no HubSpot
v3 — Done: Branding, email verify, Instantly push, analytics tab, multi application focus
v4 — Done: Auto campaign creation (email account selector, send schedule, timezone), clickable analytics drilldown, reply sentiment triage with Claude Haiku
v5 — In Progress: Beta testing + bug fixes from real usage
v6 — Planned: Electron desktop app (.exe/.dmg) — Mike confirmed Option A preferred

---

## Planned Future Analytics Features (Post-Beta)

- Daily sparkline chart (using /analytics/daily endpoint)
- Campaign comparison table
- Warm leads call prep sheet export (Interested contacts only)
- Email health / domain monitor (Instantly warmup analytics)
- Best-performing step highlight

---

## How to Resume (for Claude)

1. Read this README fully — do NOT ask Mike to re-explain the project
2. Check backend: github.com/muodonovan-dot/fida-sdr-backend/blob/main/server.js
3. Frontend: /mnt/user-data/outputs/index.html (if Mike uploaded this session) or ask
4. Session history: /mnt/transcripts/journal.txt
5. Ask: "Ready to pick up — what are you seeing in beta testing / what needs fixing?"

---

Last updated: March 11, 2026 — v4 deployed, entering beta testing
Built by LeadGeeks for Fida Bio — Not for redistribution