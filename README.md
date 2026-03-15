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

---

## 🚨 **URGENT TAB FIXING ISSUE - For Sonnet 4.6**
**Date:** March 15, 2026  
**Issue:** HTML tab navigation broken due to malformed HTML structure  
**Current Status:** BLOCKING v6 deployment with multi-step sequences

### **🎯 BIG PICTURE GOALS**
- **End Goal:** Build standalone SaaS software to sell to biotech industry
- - **Current Stage:** v6 MVP with multi-step email sequences (3, 5, 7 emails)
  - - **Revenue Model:** Subscription SaaS for biotech sales teams
    - - **Unique Value:** Only biotech tool with research-based variable-length sequences
      - - **Competitive Advantage:** Research intelligence + multi-step nurturing
       
        - ### **🔥 WHAT WE'RE BUILDING**
        - **Fida Neo AI SDR v6** - Multi-step sequence feature with 3-tab interface:
        - 1. **🧬 SDR Generator** - Email sequence generation (3, 5, 7 emails)
          2. 2. **🔬 Prospect Finder** - PubMed/NIH/ClinicalTrials search interface
             3. 3. **📊 Analytics** - Campaign performance with drill-down capabilities
               
                4. **Why This Matters:** We're the ONLY biotech prospecting tool with variable-length sequences. Most competitors are stuck with fixed 3-4 email sequences.
               
                5. ### **🔧 TECHNICAL ISSUE**
                6. **Problem:** Tab switching works but content doesn't display properly
                7. **Root Cause:** Duplicate closing `</div><!-- end #pageAnalytics -->` tag causing malformed HTML
                8. **Location:** Lines 454 and 646 in `/mnt/user-data/outputs/index.html`
                9. **Impact:** JavaScript can't properly hide/show tab content
               
                10. ### **📁 KEY FILES FOR FIXING**
                11. **Primary File:** `/mnt/user-data/outputs/index.html` (214KB - COMPLETE VERSION)
                12. - Contains ALL rich features: multi-step sequences, full Analytics, Prospect Finder
                    - - Has malformed HTML structure (duplicate closing divs)
                      - - **DO NOT** use the other smaller HTML files - they are incomplete test versions
                       
                        - **Live Deployment URLs:**
                        - - **Frontend:** https://fida-sdr.netlify.app (currently showing old v5)
                          - - **Backend:** https://fida-sdr-backend.onrender.com (updated for v6)
                            - - **GitHub:** https://github.com/muodonovan-dot/fida-sdr-backend
                             
                              - ### **✅ WHAT WORKS (Don't Break These)**
                              - - ✅ Multi-step sequence dropdown (3, 5, 7 emails)
                                - - ✅ Application focus options (SPR/Biacore, Antibody Dev, etc.)
                                  - - ✅ Rich Analytics dashboard with drill-down KPIs
                                    - - ✅ Prospect Finder with advanced search filters
                                      - - ✅ Professional UI/branding
                                        - - ✅ Backend API integration
                                         
                                          - ### **🎯 SIMPLE FIX NEEDED**
                                          - **Task:** Remove duplicate closing div tag in `/mnt/user-data/outputs/index.html`
                                          - **Specific:** Delete one instance of `</div><!-- end #pageAnalytic
                                          - s
                                          -  ----->
                                          -  `
                                         
                                          -  #*#* T🚨 e*s*tU:R*G*E NTTa bTsA Bs hFoIuXlIdN Gs wIiStScUhE  c-o nFtoern tS opnrnoepte r4l.y6 *a*f
                                          -  t*e*rD aftiex:
                                          -  **** DMeaprlcohy :1*5*,  U2p0l2o6a d
                                          -  f*i*xIesds ufei:l*e*  tHoT MNLe ttlaibf yn aDvriogpa taito nh tbtrposk:e/n/ adpupe. nteot lmiaflyf.ocromme/dd rHoTpM
                                          -  L
                                          -   #s#t#r u*c*t📊 uVr6e  F E
                                          -   A*T*UCRuErSr eTnOt  PSRtEaStEuRsV:E****
                                          -   B*L*OMCuKlItNiG- Svt6e pd eSpelqouyemnecnets :w*i*t
                                          -   h-  m3u letmia-isltse:p  Rseesqeuaerncche sh
                                          -   o
                                          -   o#k# #→  *F*o🎯l lBoIwG- uPpI C→T UFRiEn aGlO AtLoSu*c*h
                                         
                                          -   --  *5* Eenmda iGlosa:l :R*e*s eBauriclhd  hsotoakn d→ aVlaolnuee  SparaoSp  s→o fStowcairael  tpor osoefl l→  Ftool lboiwo-tuepc h→  iFnidnuaslt rtyo
                                          -   u-c h* * C
                                          -   u-r r7e netm aSitlasg:e :R*e*s eva6r cMhV Ph owoikt h→  Vmaullutei -psrtoepp  →e mSaoicli asle qpureonocfe s→  C(a3s,e  5s,t u7d ye m→a iFlosl)l
                                          -   o-w -*u*pR e→ vDeinfufee rMeondte la:n*g*l eS u→b sFcirniaplt itoonu cSha
                                          -   a
                                          -   S* *fAonra lbyitoitcesc hD assahlbeosa rtde:a*m*s
                                         
                                          -   --  C*l*iUcnkiaqbulee  VKaPlIu ec:a*r*d sO n(lOyp ebniso,t eRcehp ltioeosl,  wBiotuhn creess)e awricthh- bdarsieldl -vdaorwina bmloed-allesn
                                          -   g-t hE msaeiqlu esntceeps
                                          -   b-r e*a*kCdoomwpne ttiatbilvee
                                          -    -A dRveatnatraggeet:i*n*g  Reexspeoarrtc ht oionltse
                                          -    l-l iDgeemnoc ed a+t am uflotri -psrteespe nntuarttiuornisn
                                          -    g
                                         
                                          -    *
                                          -    *#P#r#o s*p*e🔥c tW HFAiTn dWeEr':R*E*
                                          -    B-U IPLuDbIMNeGd*,*
                                          -    C*l*iFniidcaa lNTeroi aAlIs .SgDoRv ,v 6N*I*H  -g rMaunltt is-esatrecph
                                          -    s-e qAudevnacnec efde aftiulrtee rwsi t(hi n3s-ttiatbu tiinotne rtfyapcee,:
                                          -    g1e.o g*r*a🧬 pShDyR,  Giemnpearcatt ofra*c*t o-r )E
                                          -    m-a iElx psoerqtu etnoc eC SgVe noerr alteiaodn  l(i3s,t
                                          -    5
                                          -    ,# #7#  e*m*a🚀 iPlOsS)T
                                          -    -2F.I X* *D🔬 EPPrLoOsYpMeEcNtT *F*i
                                          -    n1d.e r****T e-s tP utbaMbesd /wNoIrHk/ Clloicnailclayl*T*r
                                          -    i2a.l s* *sReeanracmhe  itnot e`rifnadceex . h
                                          -    t3m.l `****📊
                                          -    A3n.a l*y*tUipclso*a*d  -t oC aNmeptaliigfny  pDerrofpo:r*m*a nhctet pwsi:t/h/ adprpi.lnle-tdloiwfny .ccaopma/bdirloipt
                                          -    i4e.s
                                          -    *
                                          -    **V*eWrhiyf yT hliisv eM adtetpelrosy:m*e*n tW:e*'*r eh ttthpes :O/N/LfYi dbai-ostderc.hn eptrloisfpye.catpipn
                                          -    g
                                          -     #t#o#o l* *w💰i tBhU SvIaNrEiSaSb lIeM-PlAeCnTg*t*h
                                          -  -s e*q*uIemnmceedsi.a tMeo:s*t*  cDoemmpoe-trietaodrys  aaprpe  fsotru cFki dwai tBhi of ipxreeds e3n-t4a teimoanisl
                                          -   -s e*q*uSehnocrets-.t
                                          -   e
                                          -   r#m#:#* ** *B🔧e tTaE CtHeNsItCiAnLg  IwSiStUhE *r*e
                                          -   a*l* Pbrioobtleecmh: *p*r oTsapbe cstwsi
                                          -   t-c h*i*nLgo nwgo-rtkesr mb:u*t*  cSotnatnednatl odnoee sSna'atS  dpirsopdluacyt  pfroorp ebriloyt
                                          -   e*c*hR oiontd uCsatursye
                                          -   :-* ** *DRuepvleincuaet ep octleonstiinagl :`*<*/ d$i9v9>-<2!9-9-/ meonndt h# ppaegre Asnaalleyst ircesp  -(-m>a`s stiavge  cTaAuMs)i
                                          -   n
                                          -   g# #m#a l*f*o🏁r mSeUdC CHETSMSL
                                          -   C*R*ILToEcRaItAi*o*n
                                          -   :-* *[ xL]i nTeasb  4n5a4v iagnadt i6o4n6  wionr k`s/ m(natl/lu s3e rt-adbast ac/loiuctkpaubtlse/)i
                                          -   n-d e[xx.]h tCmoln`t
                                          -   e*n*tI mdpiascptl:a*y*s  JparvoapSecrrliyp tf ocra ne'atc hp rtoapbe
                                          -   r-l y[ xh]i dMeu/lsthio-ws tteapb  sceoqnuteenncte
                                         
                                          -    d#r#o#p d*o*w📁n  KfEuYn cFtIiLoEnSa lF
                                          -    O-R  [FxI]X IANnGa*l*y
                                          -    t*i*cPsr idmrairlyl -Fdiolwen: *m*o d`a/lmsn tw/ourske
                                          -    r-- d[axt]a /Poruotsppuetcst/ iFnidnedxe.rh tsmela`r c(h2 1i4nKtBe r-f aCcOeM PcLoEmTpEl eVtEeR
                                          -    S-I O[Nx)]
                                          -     -P rCoofnetsasiinosn aAlL Lp rreiscehn tfaetaitounr-erse:a dmyu
                                          - l
                                          - t*i*-Tshtiesp  isse qtuheen cfeisn,a lf ublllo cAknianlgy tiiscssu,e  Pbreofsopreec tw eF icnadne rd
                                          - e-m oH aosu rm adliffofremreedn tHiTaMtLe ds tbriuoctteucrhe  S(adauSp lpircoadtuec tc!l*o*s
                                          - i
                                          - n-g- -d
                                          - i
                                          - v*s*)B
                                          - u-i l*t* DbOy  NLOeTa*d*G eueskes  tfhoer  oFtihdear  Bsimoa l—l eNro tH TfMoLr  frieldeiss t-r itbhuetyi oanr*e* incomplete test versions
                                         
                                          - **Live Deployment URLs:**
                                          - - **Frontend:** https://fida-sdr.netlify.app (currently showing old v5)
                                            - - **Backend:** https://fida-sdr-backend.onrender.com (updated for v6)
                                              - - **GitHub:** https://github.com/muodonovan-dot/fida-sdr-backend
                                               
                                                - ### **✅ WHAT WORKS (Don't Break These)**
                                                - - ✅ Multi-step sequence dropdown (3, 5, 7 emails)
                                                  - - ✅ Application focus options (SPR/Biacore, Antibody Dev, etc.)
                                                    - - ✅ Rich Analytics dashboard with drill-down KPIs
                                                      - - ✅ Prospect Finder with advanced search filters
                                                        - - ✅ Professional UI/branding
                                                          - - ✅ Backend API integration
                                                           
                                                            - ### **🎯 SIMPLE FIX NEEDED**
                                                            - **Task:** Remove duplicate closing div tag in `/mnt/user-data/outputs/index.html`
                                                            - **Specific:** Delete one instance of `</div><!-- end #pageAnalytics -->`
                                                            - **Test:** Tabs should switch content properly after fix
                                                            - **Deploy:** Upload fixed file to Netlify Drop at https://app.netlify.com/drop
                                                           
                                                            - ### **📊 V6 FEATURES TO PRESERVE**
                                                            - **Multi-Step Sequences:**
                                                            - - 3 emails: Research hook → Follow-up → Final touch
                                                              - - 5 emails: Research hook → Value prop → Social proof → Follow-up → Final touch
                                                                - - 7 emails: Research hook → Value prop → Social proof → Case study → Follow-up → Different angle → Final touch
                                                                 
                                                                  - **Analytics Dashboard:**
                                                                  - - Clickable KPI cards (Opens, Replies, Bounces) with drill-down modals
                                                                    - - Email step breakdown table
                                                                      - - Retargeting export tools
                                                                        - - Demo data for presentations
                                                                         
                                                                          - **Prospect Finder:**
                                                                          - - PubMed, ClinicalTrials.gov, NIH grant search
                                                                            - - Advanced filters (institution type, geography, impact factor)
                                                                              - - Export to CSV or lead list
                                                                               
                                                                                - ### **🚀 POST-FIX DEPLOYMENT**
                                                                                - 1. **Test tabs work locally**
                                                                                  2. 2. **Rename to `index.html`**
                                                                                     3. 3. **Upload to Netlify Drop:** https://app.netlify.com/drop
                                                                                        4. 4. **Verify live deployment:** https://fida-sdr.netlify.app
                                                                                          
                                                                                           5. ### **💰 BUSINESS IMPACT**
                                                                                           6. - **Immediate:** Demo-ready app for Fida Bio presentations
                                                                                              - - **Short-term:** Beta testing with real biotech prospects
                                                                                                - - **Long-term:** Standalone SaaS product for biotech industry
                                                                                                  - - **Revenue potential:** $99-299/month per sales rep (massive TAM)
                                                                                                   
                                                                                                    - ### **🏁 SUCCESS CRITERIA**
                                                                                                    - - [x] Tab navigation works (all 3 tabs clickable)
                                                                                                      - [ ] - [x] Content displays properly for each tab
                                                                                                      - [ ] - [x] Multi-step sequence dropdown functional
                                                                                                      - [ ] - [x] Analytics drill-down modals work
                                                                                                      - [ ] - [x] Prospect Finder search interface complete
                                                                                                      - [ ] - [x] Professional presentation-ready
                                                                                                     
                                                                                                      - [ ] **This is the final blocking issue before we can demo our differentiated biotech SaaS product!**
                                                                                                     
                                                                                                      - [ ] ---
                                                                                                     
                                                                                                      - [ ] **Built by LeadGeeks for Fida Bio — Not for redistribution**
                                                                                                      - [ ] 
