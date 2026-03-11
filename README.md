# Fida AI SDR — Project README
> **For Claude:** If a new conversation starts and Mike says "pick up where we left off" — read this file FIRST. It has everything needed to resume without asking repeat questions.
>
> ## Live Deployments
> | Service | URL |
> |---|---|
> | Frontend | https://jade-froyo-18a6f5.netlify.app/ |
> | Backend | https://fida-sdr-backend.onrender.com |
> | GitHub | https://github.com/muodonovan-dot/fida-sdr-backend |
>
> ## What This Is
> AI-powered SDR tool built by Mike O'Donovan (LeadGeeks) for Fida Bio Biacore/SPR outreach. Generates personalized 3-email cold sequences for researchers using SPR instruments, introducing the Fida NEO.
>
> Mike covers: MT, WY, CO, NM, ND, SD, NE, KS, OK, TX, MN, IA, MO, AR, LA, WI, IL, IN, MI, KY, TN, MS
>
> ## Stack
> - Frontend: Single index.html — vanilla JS, XLSX.js, PDF.js, docx (all CDN)
> - - Backend: Node.js server.js on Render (Express, node-fetch)
>   - - AI: claude-sonnet-4-20250514 (emails), claude-haiku-4-5-20251001 with web-search (research)
>     - - Data: PubMed eUtils API (free)
>       - - Sending: Instantly.ai (v3 - not yet built)
>         - - Email verify: ZeroBounce or Bouncer (v3 - not yet built)
>          
>           - ## Fida NEO Value Prop
>           - - Measures Rh, polydispersity, aggregation — 40nL sample
>             - - "Don't waste SPR runs on bad reagents"
>               - - Cytiva/Biacore partner — companion not competitor
>                
>                 - ## v2 Features (DONE)
>                 - 1. Anthropic API key + test
>                   2. 2. PDF knowledge base upload (8 pages via PDF.js)
>                      3. 3. SciLeads XLSX upload (First Name, Last Name, Email, Job Title, Organisation, State, Country, Focused Areas)
>                         4. 4. Generate sequences — batch selector (25/50/100/250/500), progress bar, results table
>                            5. 5. Export: CSV for Instantly + Word doc review (10 contacts, docx lib)
>                               6. 6. HubSpot removed
>                                 
>                                  7. ## Backend Key Functions
>                                  8. - searchPubMed(firstName, lastName, institution) — 5 recent papers
>                                     - - searchResearcher() — Claude haiku web search, BUG FIX: use .filter(b => b.type === 'text') + last block + regex /{[\s\S]*}/ to parse JSON
>                                       - - POST /generate — accepts {lead, anthropicKey, knowledgeBase}, returns {emails, research}
>                                         - - POST /test-anthropic — key validation
>                                          
>                                           - ## Branding (v3+)
>                                           - - Orange: #EF4D05, Navy: #171151, Light orange: #FF8210
>                                             - - Fonts: Outfit (headings), Montserrat (body) — Google Fonts
>                                               - - Logo: https://leadgeeksinc.com/wp-content/uploads/2024/06/logo-leadgeeks-1.png
>                                                 - - Nav: "Powered by LeadGeeks · Built for Fida Bio"
>                                                  
>                                                   - ## v3 — TO BUILD (active target)
>                                                   - ### Speed
>                                                   - - Parallel processing (3-5 s#i mFuildtaa nAeIo uSsD Rl e— aPdrso)j
>                                                     - e-c tR eRsEuAmDeM/Er
>                                                     - e>t r*y* Ffoari lCelda uldeea:d*s*
>                                                    
>                                                     -  I#f# #a  Innetwe lcloingveenrcsea
>                                                     -  t-i oAnu tsot atrotnse  adnedt eMcitkieo ns:a y.se d"up i=c ka cuapd ewmhiecr,e  .wceo ml/e.fotr go f=f "i n—d ursetardy  t(hsiesn df itloen eF IfRlSaTg.  tIot  bhaacsk eenvde)r
>                                                     -  y-t hLienagd  nseoeudrecde  ttoo grgelseu:m eS cwiiLtehaodust  /a sLkeiandgG ereekpse alti sqtu e/s tCioonnfse.r
> e
> n#c#e  Laitvtee nDdeepelso y/m eCnotnsf
> e|r eSnecrev iacnen o|u nUcReLm e|n
> t| -/- -G|e-n-e-r|i
> c|
>  -F rFolnatge nldo w|- chotntfpisd:e/n/cjea deem-afirlosy o(-y1e8lal6ofw5 .rnoewt liiff yn.oa pPpu/b M|e
> d|  +B ancok eLnidn k|e dhItnt)p
> s
> :#/#/#f iEdmaa-isld rV-ebraicfkiecnadt.ioonnr e(nddoemra.icno mp r|o
> t|e cGtiitoHnu)b
>  -|  ZhetrtopBso:u/n/cgei tohru bB.ocuonmc/emru oAdPoIn okveayn -idno ts/eftitdian-gssd
> r-- bVaecrkiefnyd  a|l
> l
>  #e#m aWihlast  bTehfiosr eI sg
> eAnIe-rpaotwieorne
> d-  SSDtRa ttuoso:l  Vbauliildt  /b yC aMtickhe- aOl'lD oyneolvlaonw  (/L eIandvGaeleikds )r efdo r( eFxicdlau dBeido  fBrioamc oCrSeV/)S
> P-R  BoouutnrceeaBcahn.  fGoern ecraattcehs- aplelr sroensaolliuzteido n3 -(e.meadiul,  cboilgd  psheaqrumean)c
e
> s# #f#o rD ormeasiena rDcahmeargse  uMsiitnigg aStPiRo ni
n-s tDrauimleyn tsse,n di nctarpo d(udceifnagu ltth e3 0F/iddaay ,N EmOa.x
>
> 1M0i0k ew acromveedr)s
> :-  MWTa,r nW Yi,f  C>O5,0 /NdMa,y  NiDn,  fSiDr,s tN E3,0  KdSa,y sO
> K-,  DTNXC,  lMiNs,t  I(Au,p lMoOa,d  AERx,c eLlA,,  sWkIi,p  ImLa,t cIhNe,s )M
> I-,  OKpYt,- oTuNt,  lMiSn
> e
>  #i#n  Stteamcpkl
> a-t eFsr o(nttoegngdl:e aSbilneg)l
> e-  iWnodredx .dhotcm ls h— ovwasn irlelcao mJmSe,n dXeLdS Xd.ajisl,y  PcDaFp.
> j
> s#,# #d oUcXx
>  -( aIlnll iCnDeN )e
> m-a iBla cekdeintdi:n gN omdoed.ajls
>  -s eCravmepra.ijgsn  ohni sRteonrdye r( l(oEcxaplrSetsosr,a gneo)d
> e-- fDeetdcuhp)l
> i-c aAtIi:o nc
> l
> a#u#d#e -Isnosntnaentt-l4y-.2a0i2 5I0n5t1e4g r(aetmiaoinl
> s-) ,A PcIl akuedye -fhiaeilkdu -(4l-o5c-a2l0S2t5o1r0a0g1e )w
> i-t hF ewtecbh- sceaamrpcahi g(nrse sderaorpcdho)w
> n-
>  -D aPtuas:h  PluebaMdesd  weiUtthi lesm aAiPlI  s(efqrueeen)c
> e-s  Saesn dciunsgt:o mI nvsatrasn
> t-l yA.naail y(tvi3c s-  tnaobt  (yoepte nbsu/icllti)c
> k-s /Ermeapilli evse)r
> i
> f#y#:  BZaecrkoeBnodu nCchea nogre sB ofuonrc evr3
> (-v 3A c-c enpott  tyoente  bfuiielltd)
> (
> "#a#c aFdiedmai cN"E|O" iVnadluuset rPyr"o)p
>
> --  AMcecaesputr ecsa mRpha,i gpnoCloyndtiesxpte rfsiietlyd,
>  -a gFgirxe gLaitnikoend I—n  4J0SnOLN  spaamrpslee
> b-u g" D(oanl'rte awdays tied eSnPtRi friuends)
> o-n  Ebmaadi lr evaegreinftisc"a
> t-i oCny tAiPvIa /cBailalc obreef opraer tgneenre r— actoimopna
> n
> i#o#n  Innostt acnotmlpye.taiit
> o-r
> A
> P#I#  vv22,  FBeeaatruerre sa u(tDhO,N Eh)t
> t1p.s :A/n/tahprio.piincs tAaPnIt lkye.ya i+/ atpeis/tv
> 22/.
>  -P DPFO SkTn o/walpeid/gve2 /blaesaed su p— lcouasdt o(m8  vpaargse:s  svtirai nPgD/Fn.ujmsb)e
> r3/.b oSoclieLaena/dnsu lXlL SoXn luyp
> l-o aGdE T( F/iarpsit/ vN2a/mcea,m pLaaisgtn sN/aamnea,l yEtmiacisl
> ,-  JNoebe dTsi tGlreo,w tOhr gpalnains+a tfioorn ,A PSIt
> a-t eM,i kCeo usnttarryt,i nFgo cwuistehd  GArroewatsh)
> (4$.4 7G/emnoe)r attoe  psielqoute,n ctehse n—  bpaittcchh  sFeildeac tfoorr  (H2y5p/e5r0g/r1o0w0t/h2 5(0$/9570/0m)o,)
> p
> r#o#g rIeTs sP ebramri,s srieosnusl tNse etdaebdl e(
> M5i.c rEoxspoofrtt :3 6C5S)V
>  -f oArd mIinns:t aMnitclryo s+o fWto rAdd mdionc  Creenvtieerw  >( 1U0s ecrosn t>a cAtcst,i vdeo cUxs elrisb )>
>  6M.i kHeu'bsS paoctc oruenmto v>e dM
> a
> i#l#  >B aMcakneangde  Keemya iFlu nacptpiso n>s
> e-n asbelaer cIhMPAuPb M+e dA(uftihresnttNiacmaet,e dl aSsMtTNPa
> m-e ,C NiAnMsEt:i tturtaicokn.)f i—d a5b iroe.cceonmt  -p>a pperrosx
> .-i tsreaacrkclhyR.ecsoema
> r-c hSeirg(n)- o— fCfl afurdoem  hmaainkaug ewre/bV Ps eSaarlcehs,
>
> B#U#G  RFoIaXd:m aups
> e-  .vf1i:l tDeorn(eb  — =b>a sbi.ct ygpeen e=r=a=t i'otne
> x-t 'v)2 :+  Dloanset  —b lWoocrkd  +d orce,g enxo  /H{u[b\Ssp\oSt]
> *-} /v 3t:o  IpNa rPsReO GJRSEOSNS
>  -—  aPlOlS Ta b/ogveen e+r abtrea n— daicncge p+t se m{aliela dv,e rainftyh
> r-o pvi4c:K ePyl,a nknneodw l— eIdngsetBaanstel}y,  arneatluyrtnisc s{ edmaasihlbso,a rrde
> s-e avr5c:h }P
> l-a nPnOeSdT  —/ tEelsetc-tarnotnh rdoepsikct o—p  kaepyp  v(aMliikdea tcioonnf
> i
> r#m#e dB rtahnidsi nogv e(rv 3w+e)b
>  -l oOgriann)g
> e
> :# ## EHFo4wD 0t5o,  RNeasvuym:e  #(1f7o1r1 5C1l,a uLdieg)h
> t1 .o rRaenagde :t h#iFsF 8R2E1A0D
> M-E  Ffounltlsy:
>  2O.u tFfeittc h( hbeaacdkienngds:) ,h tMtopnst:s/e/rrraawt. g(ibtohduyb)u s— eGrocoognltee nFto.nctosm
> /-m uLoodgoon:o vhatnt-pdso:t///fliedaad-gsederk-sbiancck.ecnodm//rwepf-sc/ohnetaednst//muapilno/asdesr/v2e0r2.4j/s0
> 63/.l oAgsok- lMeiakdeg eteok sr-e1-.uppnlgo
> a-d  Nianvd:e x".Photwmelr eOdR  bcyh eLceka d/Gmenetk/su s·e rB-udialtta /foourt pFuitdsa/ iBnidoe"x
> .
> h#t#m lv
> 34 .—  TAOs kB:U I"LWDh i(cahc tpiavret  tfairrgsett )—
> f#r#o#n tSepnede,d
> b-a cPkaernadl,l eolr  pbrootche?s"s
> i5n.g  D(o3 -N5O Ts iamsukl tMainkeeo utso  lreea-desx)p
> l-a iRne stuhmee /prreotjreyc tf
> a
> i*lLeads tl euapddsa
> t
> e#d#:#  MIanrtcehl l2i0g2e6n c—e
> v-3  Aiunt oa cttoinvee  ddeetveecltoipomne:n t.*edu = academic, .com/.org = industry (send tone flag to backend)
> - Lead source toggle: SciLeads / LeadGeeks list / Conference attendees / Conference announcement / Generic
> - - Flag low-confidence emails (yellow row if no PubMed + no LinkedIn)
>  
>   - ### Email Verification (domain protection)
>   - - ZeroBounce or Bouncer API key in settings
>     - - Verify all emails before generation
>       - - Status: Valid / Catch-all yellow / Invalid red (excluded from CSV)
>         - - BounceBan for catch-all resolution (.edu, big pharma)
>          
>           - ### Domain Damage Mitigation
>           - - Daily send cap (default 30/day, max 100 warmed)
>             - - Warn if >50/day in first 30 days
>               - - DNC list (upload Excel, skip matches)
>                 - - Opt-out line in templates (toggleable)
>                   - - Word doc shows recommended daily cap
>                    
>                     - ### UX
>                     - - Inline email editing modal
>                       - - Campaign history (localStorage)
>                         - - Deduplication
>                          
>                           - ### Instantly.ai Integration
>                           - - API key field (localStorage)
>                             - - Fetch campaigns dropdown
>                               - - Push leads with email sequences as custom vars
>                                 - - Analytics tab (opens/clicks/replies)
>                                  
>                                   - ## Backend Changes for v3
>                                   - - Accept tone field ("academic"|"industry")
>                                     - - Accept campaignContext field
>                                       - - Fix LinkedIn JSON parse bug (already identified)
>                                         - - Email verification API call before generation
>                                          
>                                           - ## Instantly.ai
>                                           - - API v2, Bearer auth, https://api.instantly.ai/api/v2/
>                                             - - POST /api/v2/leads — custom vars: string/number/boolean/null only
>                                               - - GET /api/v2/campaigns/analytics
>                                                 - - Needs Growth plan+ for API
>                                                   - - Mike starting with Growth ($47/mo) to pilot, then pitch Fida for Hypergrowth ($97/mo)
>                                                    
>                                                     - ## IT Permissions Needed (Microsoft 365)
>                                                     - - Admin: Microsoft Admin Center > Users > Active Users > Mike's account > Mail > Manage email apps > enable IMAP + Authenticated SMTP
>                                                       - - CNAME: track.fidabio.com -> prox.itrackly.com
>                                                         - - Sign-off from manager/VP Sales
>                                                          
>                                                           - ## Roadmap
>                                                           - - v1: Done — basic generation
>                                                             - - v2: Done — Word doc, no HubSpot
>                                                               - - v3: IN PROGRESS — all above + branding + email verify
>                                                                 - - v4: Planned — Instantly analytics dashboard
>                                                                   - - v5: Planned — Electron desktop app (Mike confirmed this over web login)
>                                                                    
>                                                                     - ## How to Resume (for Claude)
>                                                                     - 1. Read this README fully
>                                                                       2. 2. Fetch backend: https://raw.githubusercontent.com/muodonovan-dot/fida-sdr-backend/refs/heads/main/server.js
>                                                                          3. 3. Ask Mike to re-upload index.html OR check /mnt/user-data/outputs/index.html
>                                                                             4. 4. Ask: "Which part first — frontend, backend, or both?"
>                                                                                5. 5. Do NOT ask Mike to re-explain the project
>                                                                                  
>                                                                                   6. *Last updated: March 2026 — v3 in active development*
