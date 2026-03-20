const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

const SUPABASE_URL = 'https://cqsdsztzyvxtnzrruxeb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oWLb_blZHL_rayCldsPfMw_OoQs0HMR';

async function getRelevantResources(applicationFocus, researchContext) {
  const keywordMap = {
    spr_biacore: ['biacore','spr','kinetics','binding affinity'],
    antibody_dev: ['antibody','aggregation','developability'],
    drug_discovery: ['small molecule','drug discovery','fragment','binding'],
    structural_biology: ['structural','cryo','crystallography','monodispersity'],
    de_novo_proteins: ['de novo','protein design','folding'],
    general: ['protein','characterization','quality']
  };
  const keywords = keywordMap[applicationFocus] || keywordMap.general;
  const matchedApp = researchContext?.application_match;
  const extraKeywords = matchedApp ? (keywordMap[matchedApp] || []) : [];
  const allKeywords = [...new Set([...keywords, ...extraKeywords])];
  const preferredTypes = ['Application Notes', 'Posters', 'Brochures', 'Tech Notes', 'White Papers'];
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/fida_resources?select=type,title,url&order=created_at.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const all = await resp.json();
    const scored = all.map(r => {
      const text = (r.title + ' ' + r.url).toLowerCase();
      const keywordScore = allKeywords.filter(kw => text.includes(kw)).length;
      const typeBonus = preferredTypes.includes(r.type) ? 2 : 0;
      return { ...r, score: keywordScore + typeBonus };
    });
    return scored.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)
      .map(r => `[${r.type}] ${r.title} — ${r.url}`);
  } catch(e) {
    console.warn('Resource lookup failed:', e.message);
    return [];
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/check-lead', async (req, res) => {
  const { instantlyKey, email } = req.body;
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/leads/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + instantlyKey },
      body: JSON.stringify({ email })
    });
    const d = await r.json();
    res.json({ ok: true, lead: d.items?.[0] || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/test-anthropic', async (req, res) => {
  const { anthropicKey } = req.body;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] })
    });
    const d = await r.json();
    if (r.ok) res.json({ ok: true });
    else res.json({ ok: false, error: d.error?.message || 'Invalid key' });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/test-zerobounce', async (req, res) => {
  const { zeroBounceKey } = req.body;
  try {
    const r = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${zeroBounceKey}`);
    const d = await r.json();
    if (d.Credits !== undefined && d.Credits !== '-1') res.json({ ok: true, credits: d.Credits });
    else res.json({ ok: false, error: 'Invalid key or no credits' });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/verify-emails-bulk', async (req, res) => {
  const { emails, zeroBounceKey } = req.body;
  if (!emails?.length) return res.json({ verified: [] });
  try {
    const results = await Promise.all(emails.map(async (email) => {
      try {
        const r = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${zeroBounceKey}&email=${encodeURIComponent(email)}`);
        const d = await r.json();
        const status = d.status?.toLowerCase() || 'unknown';
        let tag = 'unknown';
        if (status === 'valid') tag = 'valid';
        else if (status === 'catch-all') tag = 'catch-all';
        else if (['invalid', 'abuse', 'do_not_mail', 'spamtrap'].includes(status)) tag = 'invalid';
        return { email, status, tag };
      } catch (e) { return { email, status: 'error', tag: 'unknown' }; }
    }));
    res.json({ verified: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/test-instantly', async (req, res) => {
  const { instantlyKey } = req.body;
  if (!instantlyKey) return res.status(400).json({ ok: false, error: 'Missing key' });
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=1', {
      headers: { 'Authorization': 'Bearer ' + instantlyKey }
    });
    const d = await r.json();
    if (r.ok) res.json({ ok: true, message: 'Instantly V2 connected' });
    else res.json({ ok: false, error: d.error || d.message || 'Invalid key' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/instantly-accounts', async (req, res) => {
  const key = req.headers['x-instantly-key'];
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/accounts?limit=100', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/instantly-campaigns', async (req, res) => {
  const key = req.headers['x-instantly-key'];
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/instantly-push', async (req, res) => {
  const { instantlyKey, campaignName, leads, emailAccount, dailyLimit, campaign_schedule, campaign } = req.body;
  if (!instantlyKey) return res.status(400).json({ error: 'Missing key' });
  try {
    // Build schedule — Instantly API requires days as an OBJECT {monday: true/false, ...}
    const normalizeSchedule = (sched) => {
      if (!sched) return {
        schedules: [{
          name: 'Business Hours',
          timing: { from: '08:00', to: '17:00' },
          days: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
          timezone: 'America/Chicago'
        }]
      };
      if (sched.schedules) {
        sched.schedules.forEach(s => {
          s.timezone = 'America/Chicago';
          // Convert array format to object if needed
          if (Array.isArray(s.days)) {
            const all = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
            const obj = {};
            all.forEach(d => obj[d] = s.days.includes(d));
            s.days = obj;
          } else if (!s.days || typeof s.days !== 'object') {
            s.days = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
          }
        });
      }
      return sched;
    };

    const campaignBody = campaign || {
      name: campaignName || 'Fida SDR Campaign',
      email_list: emailAccount ? [emailAccount] : [],
      daily_limit: dailyLimit || 30,
      daily_max_leads: dailyLimit || 30,
      stop_on_reply: true,
      open_tracking: true,
      link_tracking: true,
      sequences: [{
        steps: [
          { type: 'email', delay: 0, variants: [{ subject: '{{email1_subject}}', body: '{{email1_body}}' }] },
          { type: 'email', delay: 3, variants: [{ subject: '{{email2_subject}}', body: '{{email2_body}}' }] },
          { type: 'email', delay: 5, variants: [{ subject: '{{email3_subject}}', body: '{{email3_body}}' }] }
        ]
      }],
      campaign_schedule: normalizeSchedule(campaign_schedule)
    };

    // If schedule was passed separately, normalize it on the body too
    if (campaignBody.campaign_schedule) {
      campaignBody.campaign_schedule = normalizeSchedule(campaignBody.campaign_schedule);
    }

    // Auto-fetch sending account if not set
    if (!campaignBody.email_list || campaignBody.email_list.length === 0) {
      try {
        const acctResp = await fetch('https://api.instantly.ai/api/v2/accounts?limit=5&status=1', {
          headers: { 'Authorization': 'Bearer ' + instantlyKey }
        });
        const acctData = await acctResp.json();
        const firstAccount = acctData.items?.[0]?.email;
        if (firstAccount) {
          campaignBody.email_list = [firstAccount];
          console.log('Auto-selected sending account:', firstAccount);
        }
      } catch(e) { console.warn('Could not fetch Instantly accounts:', e.message); }
    }

    const campResp = await fetch('https://api.instantly.ai/api/v2/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + instantlyKey },
      body: JSON.stringify(campaignBody)
    });
    const campData = await campResp.json();
    if (!campResp.ok) {
      console.error('Instantly campaign creation failed:', campResp.status, JSON.stringify(campData));
      return res.status(campResp.status).json({ error: campData.error || campData.message || JSON.stringify(campData) });
    }

    const campaignId = campData.id;
    let pushed = 0, failed = 0;

    // Instantly V2 correct flow per support:
    // Step 1: POST /leads to create in CRM (no campaign field needed)
    // Step 2: POST /leads/move-to-campaign to attach to campaign
    for (const lead of leads) {
      const emails = lead.generatedEmails || lead.emails || {};
      const createPayload = {
        email: lead.email,
        first_name: lead.firstName || lead.first_name || '',
        last_name: lead.lastName || lead.last_name || '',
        company_name: lead.organisation || lead.company || '',
        website: lead._linkedinUrl || '',
        phone: lead.phone || '',
        custom_variables: {
          email1_subject: (emails.email1?.subject || '').substring(0, 200),
          email1_body:    (emails.email1?.body    || '').substring(0, 2000),
          email2_subject: (emails.email2?.subject || '').substring(0, 200),
          email2_body:    (emails.email2?.body    || '').substring(0, 2000),
          email3_subject: (emails.email3?.subject || '').substring(0, 200),
          email3_body:    (emails.email3?.body    || '').substring(0, 2000),
          email4_subject: (emails.email4?.subject || '').substring(0, 200),
          email4_body:    (emails.email4?.body    || '').substring(0, 2000),
          email5_subject: (emails.email5?.subject || '').substring(0, 200),
          email5_body:    (emails.email5?.body    || '').substring(0, 2000),
          email6_subject: (emails.email6?.subject || '').substring(0, 200),
          email6_body:    (emails.email6?.body    || '').substring(0, 2000),
          email7_subject: (emails.email7?.subject || '').substring(0, 200),
          email7_body:    (emails.email7?.body    || '').substring(0, 2000),
        }
      };

      console.log('Step 1: Creating lead in CRM:', lead.email);
      const createRes = await fetch('https://api.instantly.ai/api/v2/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + instantlyKey },
        body: JSON.stringify(createPayload)
      });

      let leadId = null;
      if (createRes.ok) {
        const createData = await createRes.json();
        leadId = createData.id;
        console.log('Lead created in CRM:', lead.email, '| id:', leadId);
      } else {
        const errText = await createRes.text();
        console.error('Lead create failed:', lead.email, createRes.status, errText.substring(0, 200));
        // Try to find existing lead by email
        const listRes = await fetch('https://api.instantly.ai/api/v2/leads/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + instantlyKey },
          body: JSON.stringify({ email: lead.email, limit: 1 })
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          leadId = listData.items?.[0]?.id;
          if (leadId) console.log('Found existing lead:', lead.email, '| id:', leadId);
        }
      }

      if (!leadId) { failed++; continue; }

      // Step 2: Move lead to campaign
      console.log('Step 2: Moving lead to campaign:', leadId, '->', campaignId);
      const moveRes = await fetch('https://api.instantly.ai/api/v2/leads/move-to-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + instantlyKey },
        body: JSON.stringify({
          ids: [leadId],
          to_campaign_id: campaignId,
          in_campaign: true,
          in_list: false
        })
      });
      if (moveRes.ok) {
        pushed++;
        const moveData = await moveRes.json();
        console.log('Lead moved to campaign OK:', lead.email, '| job:', moveData.id || JSON.stringify(moveData).substring(0,100));
      } else {
        failed++;
        const errText = await moveRes.text();
        console.error('Move to campaign failed:', lead.email, moveRes.status, errText.substring(0, 200));
      }
    }

    await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/activate`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + instantlyKey }
    });

    res.json({ ok: true, campaignId, pushed, failed });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/claude-proxy', async (req, res) => {
  const { apiKey, prompt, maxTokens = 800 } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Missing apiKey' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Claude API error' });
    res.json({ text: data.content?.[0]?.text || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/generate', async (req, res) => {
  const { lead, anthropicKey, knowledgeBase = [], tone = 'industry', campaignContext = 'scileads',
    applicationFocus = 'general', sequenceLength = 3, senderName = "Mike O'Donovan" } = req.body;

  let researchContext = '';
  let lowConfidence = false;
  try {
    const researchPrompt = `You are a biotech sales researcher. Find recent research context for this scientist to personalize a cold email.
Scientist: ${lead.firstName} ${lead.lastName}
Institution: ${lead.organisation}
Title: ${lead.jobTitle}
Research Focus: ${lead.focusedAreas || 'protein research'}
Location: ${lead.state}, ${lead.country}
Return a JSON object with: { "recent_work": "1-2 sentence summary", "key_proteins": ["protein1"], "application_match": "spr_biacore|antibody_dev|drug_discovery|structural_biology|de_novo_proteins|general", "personalization_hook": "1 specific hook", "confidence": "high|low" }
If no info found, set confidence to "low". Return ONLY valid JSON.`;

    const researchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: researchPrompt }]
      })
    });
    const researchData = await researchResp.json();
    const textBlocks = (researchData.content || []).filter(b => b.type === 'text');
    const lastText = textBlocks[textBlocks.length - 1]?.text || '';
    const jsonMatch = lastText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      researchContext = parsed;
      lowConfidence = parsed.confidence === 'low';
    }
  } catch (e) { lowConfidence = true; }

  const kbText = knowledgeBase.map(d => d.content).join('\n\n').substring(0, 3000);
  const focusDescriptions = {
    general: 'native-state protein characterization — Rh, aggregation, polydispersity in 40nL',
    spr_biacore: 'SPR/Biacore companion — verify reagent quality before runs, orthogonal KD confirmation',
    antibody_dev: 'antibody developability screening — rapid aggregation check with 40nL, no labeling',
    drug_discovery: 'label-free target engagement and fragment binding confirmation in native conditions',
    structural_biology: 'pre-cryo-EM/crystallography screening — confirm monodispersity before committing samples',
    de_novo_proteins: 'solution-phase validation of designed proteins — confirm folding and monodispersity'
  };
  const appDesc = focusDescriptions[researchContext?.application_match || applicationFocus] || focusDescriptions.general;
  const contextDescriptions = {
    scileads: 'You found this researcher via SciLeads based on their recent publications.',
    leadgeeks: 'This researcher was identified via LeadGeeks prospecting.',
    conference_attendee: 'This researcher attended a recent conference in your field.',
    conference_announcement: 'Fida Bio will be attending an upcoming conference.',
    generic: 'General cold outreach.'
  };
  const emailCount = Math.min(Math.max(sequenceLength, 1), 7);
  const relevantResources = await getRelevantResources(applicationFocus, researchContext);
  const resourcesText = relevantResources.length > 0
    ? `\nRELEVANT FIDA RESOURCES (hyperlink naturally in body):\n${relevantResources.join('\n')}`
    : '';

  const emailPrompt = `You are an expert biotech sales email writer for Fida Bio, selling the Fida Neo instrument.
IMPORTANT: If you include a resource link, embed it as a hyperlink in the body text — do NOT add bare URLs at the end.
${resourcesText}
LEAD: ${lead.firstName} ${lead.lastName}, ${lead.jobTitle} at ${lead.organisation}, ${lead.state} ${lead.country}
Research: ${lead.focusedAreas || 'protein research'}
Tone: ${tone}
RESEARCH CONTEXT: ${researchContext ? JSON.stringify(researchContext) : 'No specific research — use general biotech context'}
FIDA NEO: 40nL sample, label-free, measures Rh/polydispersity/aggregation in native conditions. ${appDesc}. Cytiva/Biacore partner.
CAMPAIGN: ${contextDescriptions[campaignContext] || contextDescriptions.generic}
${kbText ? `KNOWLEDGE BASE:\n${kbText}` : ''}
Write a ${emailCount}-email sequence. Each email: concise (150-200 words), reference their research, non-spammy subject, soft CTA, sign off as: Best,\n${senderName}\nFida Bio. Each follow-up uses a different angle.
Return ONLY valid JSON: { "personalization_note": "...", "matched_app": "...", ${Array.from({length: emailCount}, (_, i) => `"email${i+1}": { "subject": "...", "body": "..." }`).join(', ')} }`;

  try {
    const genResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: emailPrompt }] })
    });
    const genData = await genResp.json();
    if (!genResp.ok) return res.status(genResp.status).json({ error: genData.error?.message || 'Generation failed' });
    const text = genData.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse email JSON from Claude response' });
    const emails = JSON.parse(jsonMatch[0]);
    res.json({ emails, research: researchContext, lowConfidence });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/nih-grants-search', async (req, res) => {
  try {
    const response = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body)
    });
    res.json(await response.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/lookup-pi', async (req, res) => {
  const { firstName, lastName } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Missing name' });
  try {
    const resp = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria: { pi_names: [{ first_name: firstName, last_name: lastName }] }, offset: 0, limit: 5, fields: ['principal_investigators','organization','contact_pi_name'] })
    });
    const data = await resp.json();
    const grants = data.results || [];
    if (!grants.length) return res.json({ found: false });
    const recent = grants.sort((a,b) => (b.fiscal_year||0) - (a.fiscal_year||0))[0];
    const pi = recent?.principal_investigators?.[0] || {};
    const org = recent?.organization || {};
    res.json({ found: true, phone: pi.contact_telephone || '', email: pi.contact_email || '', title: pi.title || '', orgName: org.org_name || '', orgCity: org.org_city || '', orgState: org.org_state || '' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/find-linkedin', async (req, res) => {
  const { firstName, lastName, organisation, googleApiKey, googleCseId } = req.body;
  if (!googleApiKey || !googleCseId) return res.status(400).json({ error: 'Missing Google API key or CSE ID' });
  if (!firstName || !lastName) return res.status(400).json({ error: 'Missing name' });
  try {
    const org = organisation || '';
    const query = `"${firstName} ${lastName}" ${org ? '"' + org + '"' : ''} site:linkedin.com/in`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=${encodeURIComponent(query)}&num=3`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data.error?.message || 'Google API error' });
    const items = data.items || [];
    if (!items.length) {
      const looseQuery = `"${firstName} ${lastName}" site:linkedin.com/in`;
      const looseResp = await fetch(`https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=${encodeURIComponent(looseQuery)}&num=3`);
      const looseData = await looseResp.json();
      const looseItems = looseData.items || [];
      if (!looseItems.length) return res.json({ found: false, linkedinUrl: null, location: null, confidence: 0 });
      return res.json(parseLinkedInResult(looseItems, firstName, lastName, org, false));
    }
    return res.json(parseLinkedInResult(items, firstName, lastName, org, true));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function parseLinkedInResult(items, firstName, lastName, org, withOrg) {
  const scored = items.map(item => {
    const titleLower = (item.title || '').toLowerCase();
    const snippetLower = (item.snippet || '').toLowerCase();
    const orgLower = (org || '').toLowerCase();
    let score = 0;
    if (titleLower.includes(firstName.toLowerCase())) score += 3;
    if (titleLower.includes(lastName.toLowerCase())) score += 3;
    orgLower.split(/\s+/).filter(w => w.length > 3).forEach(word => {
      if (titleLower.includes(word) || snippetLower.includes(word)) score += 2;
    });
    if (item.link?.includes('/company/')) score -= 10;
    return { ...item, _score: score };
  }).sort((a, b) => b._score - a._score);
  const best = scored[0];
  if (!best || best._score < 2) return { found: false, linkedinUrl: null, location: null, confidence: 0 };
  const snippet = best.snippet || '';
  return {
    found: true, linkedinUrl: best.link, linkedinTitle: best.title, linkedinSnippet: snippet,
    location: extractLocationFromSnippet(snippet),
    confidence: withOrg ? (best._score >= 6 ? 'high' : 'medium') : 'low',
    confidenceScore: Math.min(100, best._score * 10),
    allResults: scored.slice(0, 3).map(i => ({ url: i.link, title: i.title, snippet: i.snippet, score: i._score }))
  };
}

function extractLocationFromSnippet(snippet) {
  if (!snippet) return null;
  const stateNames = { 'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY' };
  const stateAbbrs = Object.values(stateNames);
  const s = snippet.toLowerCase();
  const cityStateMatch = snippet.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  if (cityStateMatch && stateNames[cityStateMatch[2].toLowerCase()]) {
    return { raw: cityStateMatch[0], state: stateNames[cityStateMatch[2].toLowerCase()], city: cityStateMatch[1], country: 'US', source: 'linkedin_snippet' };
  }
  for (const [name, abbr] of Object.entries(stateNames)) {
    if (s.includes(name)) return { raw: name, state: abbr, country: 'US', source: 'linkedin_snippet' };
  }
  const abbrMatch = snippet.match(/·\s*([^·]+),\s+([A-Z]{2})\s*[·,]/);
  if (abbrMatch && stateAbbrs.includes(abbrMatch[2])) {
    return { raw: abbrMatch[0].trim(), city: abbrMatch[1].trim(), state: abbrMatch[2], country: 'US', source: 'linkedin_snippet' };
  }
  return null;
}

app.post('/enrich-lead', async (req, res) => {
  const { firstName, lastName, organisation } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Missing name' });
  const results = { nih: null, semanticScholar: null, pubmed: null };
  const errors = {};
  await Promise.allSettled([
    (async () => {
      try {
        const nihResp = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria: { pi_names: [{ first_name: firstName, last_name: lastName }] }, offset: 0, limit: 25, fields: ['contact_pi_name','organization','project_title','award_amount','fiscal_year','agency_ic_admin','principal_investigators'] })
        });
        const nihData = await nihResp.json();
        const grants = nihData.results || [];
        if (grants.length > 0) {
          const orgLower = (organisation || '').toLowerCase();
          const matched = orgLower ? grants.filter(g => g.organization?.org_name?.toLowerCase().includes(orgLower.split(' ')[0])) : grants;
          const finalGrants = matched.length > 0 ? matched : grants;
          const totalFunding = finalGrants.reduce((sum, g) => sum + (g.award_amount || 0), 0);
          const recentGrant = finalGrants.sort((a,b) => (b.fiscal_year||0) - (a.fiscal_year||0))[0];
          const org = recentGrant?.organization;
          const piInfo = recentGrant?.principal_investigators?.[0] || null;
          const orgNameFull = org?.org_name || '';
          const deptMatch = orgNameFull.match(/(?:Department|Dept|Division|School|College|Center|Institute)\s+(?:of\s+)?([^,;|]+)/i);
          results.nih = {
            grantCount: finalGrants.length, totalFunding,
            totalFundingFormatted: totalFunding >= 1000000 ? `$${(totalFunding/1000000).toFixed(1)}M` : totalFunding >= 1000 ? `$${Math.round(totalFunding/1000)}K` : `$${totalFunding}`,
            recentGrantTitle: recentGrant?.project_title || '', recentGrantYear: recentGrant?.fiscal_year || '',
            recentGrantAgency: recentGrant?.agency_ic_admin?.abbreviation || '',
            orgCity: org?.org_city || '', orgState: org?.org_state || '', orgName: orgNameFull,
            department: deptMatch ? deptMatch[0].trim() : '',
            phone: piInfo?.contact_telephone || '', piEmail: piInfo?.contact_email || '', piTitle: piInfo?.title || '', piProfile: piInfo
          };
        }
      } catch(e) { errors.nih = e.message; }
    })(),
    (async () => {
      try {
        const query = encodeURIComponent(`${firstName} ${lastName}`);
        const ssResp = await fetch(`https://api.semanticscholar.org/graph/v1/author/search?query=${query}&fields=authorId,name,affiliations,hIndex,citationCount,paperCount,url&limit=5`);
        const ssData = await ssResp.json();
        const authors = ssData.data || [];
        const orgWords = (organisation || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const scored = authors.map(a => {
          const aName = a.name?.toLowerCase() || '';
          const aAffils = (a.affiliations || []).map(af => af.name?.toLowerCase() || '').join(' ');
          let score = 0;
          if (aName.includes(firstName.toLowerCase())) score += 3;
          if (aName.includes(lastName.toLowerCase())) score += 3;
          orgWords.forEach(w => { if (aAffils.includes(w)) score += 2; });
          return { ...a, _score: score };
        }).sort((a,b) => b._score - a._score);
        const best = scored[0];
        if (best && best._score >= 3) {
          let recentPapers = [];
          try {
            const papersResp = await fetch(`https://api.semanticscholar.org/graph/v1/author/${best.authorId}/papers?fields=title,year,citationCount,journal&limit=5&sort=citationCount:desc`);
            const papersData = await papersResp.json();
            recentPapers = (papersData.data || []).slice(0, 3).map(p => ({ title: p.title, year: p.year, citations: p.citationCount, journal: p.journal?.name || '' }));
          } catch(e) {}
          results.semanticScholar = { authorId: best.authorId, hIndex: best.hIndex || 0, citationCount: best.citationCount || 0, paperCount: best.paperCount || 0, profileUrl: best.url || '', affiliations: (best.affiliations || []).map(a => a.name).filter(Boolean), topPapers: recentPapers };
        }
      } catch(e) { errors.semanticScholar = e.message; }
    })(),
    (async () => {
      try {
        const query = encodeURIComponent(`${firstName} ${lastName}[Author]${organisation ? ` AND "${organisation.split(' ')[0]}"[Affiliation]` : ''}`);
        const searchResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmax=5&retmode=json&sort=date`);
        const searchData = await searchResp.json();
        const ids = searchData.esearchresult?.idlist || [];
        const totalCount = parseInt(searchData.esearchresult?.count || '0');
        let affiliation = '', recentTitles = [], department = '';
        if (ids.length > 0) {
          const summaryResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
          const summaryData = await summaryResp.json();
          const articles = Object.values(summaryData.result || {}).filter(a => a.uid);
          recentTitles = articles.slice(0, 3).map(a => ({ title: a.title || '', year: a.pubdate?.substring(0, 4) || '', journal: a.source || '' }));
          if (ids[0]) {
            try {
              const fetchResp = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids[0]}&retmode=xml&rettype=abstract`);
              const xml = await fetchResp.text();
              const affilMatch = xml.match(/<Affiliation>([^<]+)<\/Affiliation>/);
              if (affilMatch) {
                affiliation = affilMatch[1];
                const deptMatch = affiliation.match(/(?:Department|Dept\.?|Division|Lab(?:oratory)?|School|Center|Centre)\s+(?:of\s+)?([^,;]+)/i);
                if (deptMatch) department = deptMatch[0].trim();
              }
            } catch(e) {}
          }
        }
        results.pubmed = { publicationCount: totalCount, recentTitles, affiliation, department, labName: '' };
      } catch(e) { errors.pubmed = e.message; }
    })()
  ]);
  res.json({ results, errors });
});

app.post('/api/bug-report', async (req, res) => {
  const { description, reporterEmail, debug } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  try {
    const body = [
      '🐛 FIDA NEO BUG REPORT', '═══════════════════════════════', '',
      `📝 Description: ${description}`, `📧 Reporter: ${reporterEmail || 'anonymous'}`,
      `🕐 Time: ${debug?.timestamp || new Date().toISOString()}`, '',
      `User ID: ${debug?.userId || 'unknown'}`, `App URL: ${debug?.appUrl || 'unknown'}`,
      `Total Leads: ${debug?.totalLeads || 0}`,
      `Anthropic: ${debug?.apiKeys?.anthropic}`, `ZeroBounce: ${debug?.apiKeys?.zeroBounce}`,
      `Instantly: ${debug?.apiKeys?.instantly}`,
      JSON.stringify(debug?.recentErrors || [], null, 2),
    ].join('\n');
    console.log('=== BUG REPORT ===');
    console.log(body);
    console.log('==================');
    res.json({ ok: true, sent: false });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`Fida SDR backend running on port ${PORT}`));
