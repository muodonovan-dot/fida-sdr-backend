const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// -- Crash logging (so Render shows actual errors) --
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

const app = express();

// Supabase client for resource lookups
const SUPABASE_URL = 'https://cqsdsztzyvxtnzrruxeb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oWLb_blZHL_rayCldsPfMw_OoQs0HMR';

// -- Helper: get relevant Fida resources from Supabase --
async function getRelevantResources(applicationFocus, researchContext) {
  const keywordMap = {
    spr_biacore: ['biacore', 'spr', 'kinetics', 'binding affinity'],
    antibody_dev: ['antibody', 'aggregation', 'developability'],
    drug_discovery: ['small molecule', 'drug discovery', 'fragment', 'binding'],
    structural_biology: ['structural', 'cryo', 'crystallography', 'monodispersity'],
    de_novo_proteins: ['de novo', 'protein design', 'folding'],
    general: ['protein', 'characterization', 'quality']
  };
  const keywords = keywordMap[applicationFocus] || keywordMap.general;
  const matchedApp = researchContext?.application_match;
  const extraKeywords = matchedApp ? (keywordMap[matchedApp] || []) : [];
  const allKeywords = [...new Set([...keywords, ...extraKeywords])];
  const preferredTypes = ['Application Notes', 'Posters', 'Brochures', 'Tech Notes', 'White Papers'];

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/fida_resources?select=type,title,url&order=created_at.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const all = await resp.json();
    const scored = all.map(r => {
      const text = (r.title + ' ' + r.url).toLowerCase();
      const keywordScore = allKeywords.filter(kw => text.includes(kw)).length;
      const typeBonus = preferredTypes.includes(r.type) ? 2 : 0;
      return { ...r, score: keywordScore + typeBonus };
    });
    return scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => `[${r.type}] ${r.title} -- ${r.url}`);
  } catch (e) {
    console.warn('Resource lookup failed:', e.message);
    return [];
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// ====================================================================
// GET /health
// ====================================================================
app.get('/health', (req, res) => res.json({ ok: true }));

// ====================================================================
// GET /list-resources
// ====================================================================
app.get('/list-resources', async (req, res) => {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/fida_resources?select=type,title,url&order=created_at.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Supabase error', details: data });
    }
    res.json({
      resources: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /check-lead
// ====================================================================
app.post('/check-lead', async (req, res) => {
  const { instantlyKey, email } = req.body;
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/leads/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + instantlyKey
      },
      body: JSON.stringify({ email })
    });
    const d = await r.json();
    res.json({ ok: true, lead: d.items?.[0] || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /test-anthropic
// ====================================================================
app.post('/test-anthropic', async (req, res) => {
  const { anthropicKey } = req.body;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    const d = await r.json();
    if (r.ok) res.json({ ok: true });
    else res.json({ ok: false, error: d.error?.message || 'Invalid key' });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ====================================================================
// POST /test-zerobounce
// ====================================================================
app.post('/test-zerobounce', async (req, res) => {
  const { zeroBounceKey } = req.body;
  try {
    const r = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${zeroBounceKey}`);
    const d = await r.json();
    if (d.Credits !== undefined && d.Credits !== '-1') {
      res.json({ ok: true, credits: d.Credits });
    } else {
      res.json({ ok: false, error: 'Invalid key or no credits' });
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ====================================================================
// POST /verify-emails-bulk
// ====================================================================
app.post('/verify-emails-bulk', async (req, res) => {
  const { emails, zeroBounceKey } = req.body;
  if (!emails?.length) return res.json({ verified: [] });
  try {
    const results = await Promise.all(emails.map(async (email) => {
      try {
        const r = await fetch(
          `https://api.zerobounce.net/v2/validate?api_key=${zeroBounceKey}&email=${encodeURIComponent(email)}`
        );
        const d = await r.json();
        const status = d.status?.toLowerCase() || 'unknown';
        let tag = 'unknown';
        if (status === 'valid') tag = 'valid';
        else if (status === 'catch-all') tag = 'catch-all';
        else if (['invalid', 'abuse', 'do_not_mail', 'spamtrap'].includes(status)) tag = 'invalid';
        return { email, status, tag };
      } catch (e) {
        return { email, status: 'error', tag: 'unknown' };
      }
    }));
    res.json({ verified: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /test-instantly
// ====================================================================
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
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ====================================================================
// GET /instantly-accounts
// ====================================================================
app.get('/instantly-accounts', async (req, res) => {
  const key = req.headers['x-instantly-key'];
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/accounts?limit=100', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// GET /instantly-campaigns
// ====================================================================
app.get('/instantly-campaigns', async (req, res) => {
  const key = req.headers['x-instantly-key'];
  if (!key) return res.status(400).json({ error: 'Missing key' });
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /instantly-push  (create campaign + push leads + activate)
// ====================================================================
app.post('/instantly-push', async (req, res) => {
  const {
    instantlyKey, campaignName, leads, emailAccount,
    dailyLimit, campaign_schedule, campaign
  } = req.body;
  if (!instantlyKey) return res.status(400).json({ error: 'Missing key' });

  try {
    // Build campaign body -- support both new format (campaignName) and old (campaign object)
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
      campaign_schedule: campaign_schedule || {
        schedules: [{
          name: 'Business Hours',
          timing: { from: '08:00', to: '17:00' },
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'America/Chicago'
        }]
      }
    };

    // Force valid Instantly timezone on all schedules
    if (campaignBody.campaign_schedule?.schedules) {
      campaignBody.campaign_schedule.schedules.forEach(s => {
        s.timezone = 'America/Chicago';
        // Fix days: if object (old format), convert to array
        if (!Array.isArray(s.days)) {
          if (s.days && typeof s.days === 'object') {
            s.days = Object.entries(s.days)
              .filter(([_, enabled]) => enabled)
              .map(([day]) => day);
          }
          if (!Array.isArray(s.days) || s.days.length === 0) {
            s.days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
          }
        }
      });
    }

    // Auto-fetch first active account if none specified
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
      } catch (e) {
        console.warn('Could not fetch Instantly accounts:', e.message);
      }
    }

    const campResp = await fetch('https://api.instantly.ai/api/v2/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + instantlyKey
      },
      body: JSON.stringify(campaignBody)
    });
    const campData = await campResp.json();

    if (!campResp.ok) {
      console.error('Instantly campaign creation failed:', campResp.status, JSON.stringify(campData));
      return res.status(campResp.status).json({
        error: campData.error || campData.message || JSON.stringify(campData)
      });
    }

    const campaignId = campData.id;

    // Push leads
    let pushed = 0;
    let failed = 0;
    for (const lead of leads) {
      const emails = lead.generatedEmails || lead.emails || {};
      const payload = {
        campaign_id: campaignId,
        email: lead.email,
        first_name: lead.firstName || lead.first_name || '',
        last_name: lead.lastName || lead.last_name || '',
        company_name: lead.organisation || lead.company || '',
        website: lead._linkedinUrl || '',
        phone: '',
        allow_duplicates: true,
        custom_variables: {
          email1_subject: (emails.email1?.subject || '').substring(0, 200),
          email1_body: (emails.email1?.body || '').substring(0, 2000),
          email2_subject: (emails.email2?.subject || '').substring(0, 200),
          email2_body: (emails.email2?.body || '').substring(0, 2000),
          email3_subject: (emails.email3?.subject || '').substring(0, 200),
          email3_body: (emails.email3?.body || '').substring(0, 2000),
        }
      };
      console.log('Pushing lead:', lead.email, 'payload size:', JSON.stringify(payload).length);

      const lr = await fetch('https://api.instantly.ai/api/v2/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + instantlyKey
        },
        body: JSON.stringify(payload)
      });

      if (lr.ok) {
        pushed++;
        const okText = await lr.text();
        console.log('Lead pushed OK:', lead.email, '| response:', okText.substring(0, 150));
      } else {
        failed++;
        const errText = await lr.text();
        console.error('Lead push failed for', lead.email, ':', lr.status, errText.substring(0, 200));
      }
    }

    // Activate campaign
    await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/activate`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + instantlyKey }
    });

    res.json({ ok: true, campaignId, pushed, failed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /claude-proxy  (for AI Auto-Discover and other frontend calls)
// ====================================================================
app.post('/claude-proxy', async (req, res) => {
  const { apiKey, prompt, maxTokens = 800 } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Missing apiKey' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Claude API error'
      });
    }
    res.json({ text: data.content?.[0]?.text || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /generate  (email sequence generation)
// ====================================================================
app.post('/generate', async (req, res) => {
  const {
    lead,
    anthropicKey,
    knowledgeBase = [],
    tone = 'industry',
    campaignContext = 'scileads',
    applicationFocus = 'general',
    sequenceLength = 3,
    senderName = "Mike O'Donovan",
    playbookBrief = '',
    conferenceNotes = '',
    conferenceName = ''
  } = req.body;

  // Step 1: Research via Claude with web search
  let researchContext = '';
  let lowConfidence = false;
  try {
    const researchPrompt = `You are a biotech sales researcher. Find recent research context for this scientist to personalize a cold email.

Scientist: ${lead.firstName} ${lead.lastName}
Institution: ${lead.organisation}
Title: ${lead.jobTitle}
Research Focus: ${lead.focusedAreas || 'protein research'}
Location: ${lead.state}, ${lead.country}

Search for:
1. Their recent publications (PubMed) -- what specific proteins/systems are they working on?
2. Their LinkedIn profile -- current role, recent activity
3. Any recent grants or conference presentations

Return a JSON object with:
{
  "recent_work": "1-2 sentence summary of their most recent research",
  "key_proteins": ["protein1", "protein2"],
  "application_match": "which Fida Neo application fits best: spr_biacore | antibody_dev | drug_discovery | structural_biology | de_novo_proteins | general",
  "personalization_hook": "1 specific hook to open the email with, referencing their actual work",
  "confidence": "high | low"
}

If you cannot find specific information, set confidence to "low" and use general biotech context.
Return ONLY valid JSON, no markdown.`;

    const researchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
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
  } catch (e) {
    lowConfidence = true;
  }

  // Build knowledge base context
  const kbText = knowledgeBase.map(d => d.content).join('\n\n').substring(0, 3000);

  // Application focus descriptions
  const focusDescriptions = {
    general: 'native-state protein characterization -- Rh, aggregation, polydispersity in 40nL',
    spr_biacore: 'SPR/Biacore companion -- verify reagent quality before runs, orthogonal KD confirmation',
    antibody_dev: 'antibody developability screening -- rapid aggregation check with 40nL, no labeling',
    drug_discovery: 'label-free target engagement and fragment binding confirmation in native conditions',
    structural_biology: 'pre-cryo-EM/crystallography screening -- confirm monodispersity before committing samples',
    de_novo_proteins: 'solution-phase validation of designed proteins -- confirm folding and monodispersity'
  };
  const appDesc = focusDescriptions[researchContext?.application_match || applicationFocus] || focusDescriptions.general;

  // Campaign context
  const contextDescriptions = {
    scileads: 'You found this researcher via SciLeads based on their recent publications.',
    leadgeeks: 'This researcher was identified via LeadGeeks prospecting.',
    conference_attendee: 'This researcher attended a recent conference in your field.',
    conference_announcement: 'Fida Bio will be attending an upcoming conference.',
    generic: 'General cold outreach.',
    conference: 'This researcher attended a recent conference.'
  };

  const emailCount = Math.min(Math.max(sequenceLength, 1), 7);

  // Fetch relevant Fida resources from Supabase
  const relevantResources = await getRelevantResources(applicationFocus, researchContext);
  const resourcesText = relevantResources.length > 0
    ? '\nRELEVANT FIDA RESOURCES (use the most appropriate link in one of the emails -- hyperlink it naturally):\n' + relevantResources.join('\n')
    : '';

  // Build the email generation prompt
  const emailPrompt = `You are an expert biotech sales email writer for Fida Bio, selling the Fida Neo instrument.

IMPORTANT RULE: If you include a resource link in an email, embed it naturally as a hyperlink in the body text -- do NOT add it as a bare URL at the end.
Example: "I thought you might find <a href='URL'>this application note on SPR companion workflows</a> relevant to your work."
${resourcesText}

LEAD INFORMATION:
Name: ${lead.firstName} ${lead.lastName}
Title: ${lead.jobTitle}
Institution: ${lead.organisation}
Location: ${lead.state}, ${lead.country}
Research Focus: ${lead.focusedAreas || 'protein research'}
Tone: ${tone} (academic = collegial/peer-to-peer; industry = professional/ROI-focused)

RESEARCH CONTEXT:
${researchContext ? JSON.stringify(researchContext, null, 2) : 'No specific research found -- use general biotech context'}

FIDA NEO VALUE PROPOSITION:
- Measures hydrodynamic radius (Rh), polydispersity, and aggregation in native conditions
- Only 40nL sample needed -- no wasted precious material
- Label-free, solution-phase measurements
- Application focus for this lead: ${appDesc}
- Cytiva/Biacore partner -- positioned as companion, NOT competitor

CAMPAIGN CONTEXT:
${contextDescriptions[campaignContext] || contextDescriptions.generic}

${kbText ? 'FIDA KNOWLEDGE BASE:\n' + kbText : ''}
${playbookBrief ? '\nPLAYBOOK BRIEF (use this to guide your messaging strategy and angles):\n' + playbookBrief : ''}
${conferenceNotes ? '\nCONFERENCE CONTEXT:\nThis lead attended ' + (conferenceName || 'a recent conference') + '. Their notes/interests from the conference: ' + conferenceNotes + '\nIMPORTANT: You (the sender) may NOT have been at this conference personally, but Fida Bio may have had a presence. Reference the conference naturally and connect their stated interest to how Fida Neo could help their work. Do NOT claim you met them or spoke with them unless the notes explicitly say so.' : ''}

Write ${emailCount === 1 ? "a single cold outreach email" : `a ${emailCount}-email cold outreach sequence`}.
Each email should:
- Be concise (150-200 words max)
- Reference their specific research when possible
- Have a clear, non-spammy subject line
- End with a soft CTA (not "buy now" -- more like "worth a quick look?")
- Sign off as: Best,\n${senderName}\nFida Bio
- Each follow-up should try a different angle

Return ONLY valid JSON in this exact format:
{
  "personalization_note": "1 sentence on the specific angle used",
  "matched_app": "which Fida Neo application was matched",
  ${Array.from({ length: emailCount }, (_, i) => `"email${i + 1}": { "subject": "...", "body": "..." }`).join(',\n  ')}
}`;

  try {
    const genResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: emailPrompt }]
      })
    });
    const genData = await genResp.json();
    if (!genResp.ok) {
      return res.status(genResp.status).json({
        error: genData.error?.message || 'Generation failed'
      });
    }
    const text = genData.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse email JSON from Claude response' });
    }
    const emails = JSON.parse(jsonMatch[0]);
    res.json({ emails, research: researchContext, lowConfidence });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /nih-grants-search  (proxy to avoid CORS)
// ====================================================================
app.post('/nih-grants-search', async (req, res) => {
  try {
    const response = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /lookup-pi  (NIH PI direct lookup -- phone, email, department)
// ====================================================================
app.post('/lookup-pi', async (req, res) => {
  const { firstName, lastName, organisation } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Missing name' });
  try {
    const resp = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criteria: {
          pi_names: [{ first_name: firstName, last_name: lastName }]
        },
        offset: 0,
        limit: 5,
        fields: ['principal_investigators', 'organization', 'contact_pi_name']
      })
    });
    const data = await resp.json();
    const grants = data.results || [];
    if (!grants.length) return res.json({ found: false });

    const recent = grants.sort((a, b) => (b.fiscal_year || 0) - (a.fiscal_year || 0))[0];
    const pi = recent?.principal_investigators?.[0] || {};
    const org = recent?.organization || {};
    return res.json({
      found: true,
      phone: pi.contact_telephone || pi.phone || '',
      email: pi.contact_email || pi.email || '',
      title: pi.title || '',
      orgName: org.org_name || '',
      orgCity: org.org_city || '',
      orgState: org.org_state || '',
      orgZip: org.org_zipcode || '',
      department: org.department || ''
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /instantly-create-campaign
// ====================================================================
app.post('/instantly-create-campaign', async (req, res) => {
  const { instantlyKey, name, senderEmail, subject, body, trackingDomain } = req.body;
  if (!instantlyKey) return res.status(400).json({ error: 'Missing key' });
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/campaigns', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + instantlyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email_list: [senderEmail],
        sequences: [{
          steps: [{
            type: 'email',
            delay: 0,
            variants: [{ subject, body }]
          }]
        }],
        daily_limit: 10,
        stop_on_reply: true,
        stop_on_auto_reply: true,
        tracking_domain: trackingDomain || 'inst.fida-connect.com'
      })
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /instantly-add-lead
// ====================================================================
app.post('/instantly-add-lead', async (req, res) => {
  const { instantlyKey, campaignId, email, firstName, lastName } = req.body;
  if (!instantlyKey || !campaignId || !email) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/leads', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + instantlyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        campaign: campaignId,
        email,
        first_name: firstName || '',
        last_name: lastName || ''
      })
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /instantly-launch
// ====================================================================
app.post('/instantly-launch', async (req, res) => {
  const { instantlyKey, campaignId } = req.body;
  if (!instantlyKey || !campaignId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const r = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/activate`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + instantlyKey }
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// POST /find-linkedin  (Google Custom Search -- LinkedIn finder)
// ====================================================================
app.post('/find-linkedin', async (req, res) => {
  const { firstName, lastName, organisation, googleApiKey, googleCseId } = req.body;
  if (!googleApiKey || !googleCseId) {
    return res.status(400).json({ error: 'Missing Google API key or CSE ID' });
  }
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Missing name' });
  }
  try {
    const org = organisation || '';
    const query = `"${firstName} ${lastName}" ${org ? '"' + org + '"' : ''} site:linkedin.com/in`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=${encodeURIComponent(query)}&num=3`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data.error?.message || 'Google API error',
        raw: data
      });
    }
    const items = data.items || [];
    if (!items.length) {
      // Retry with looser query (no org)
      const looseQuery = `"${firstName} ${lastName}" site:linkedin.com/in`;
      const looseUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=${encodeURIComponent(looseQuery)}&num=3`;
      const looseResp = await fetch(looseUrl);
      const looseData = await looseResp.json();
      const looseItems = looseData.items || [];
      if (!looseItems.length) {
        return res.json({ found: false, linkedinUrl: null, location: null, confidence: 0 });
      }
      return res.json(parseLinkedInResult(looseItems, firstName, lastName, org, false));
    }
    return res.json(parseLinkedInResult(items, firstName, lastName, org, true));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -- Helper: parse LinkedIn search results --
function parseLinkedInResult(items, firstName, lastName, org, withOrg) {
  const scored = items.map(item => {
    const titleLower = (item.title || '').toLowerCase();
    const snippetLower = (item.snippet || '').toLowerCase();
    const orgLower = (org || '').toLowerCase();
    let score = 0;
    if (titleLower.includes(firstName.toLowerCase())) score += 3;
    if (titleLower.includes(lastName.toLowerCase())) score += 3;
    const orgWords = orgLower.split(/\s+/).filter(w => w.length > 3);
    orgWords.forEach(word => {
      if (titleLower.includes(word) || snippetLower.includes(word)) score += 2;
    });
    if (item.link?.includes('/company/')) score -= 10;
    return { ...item, _score: score };
  });
  scored.sort((a, b) => b._score - a._score);
  const best = scored[0];
  if (!best || best._score < 2) {
    return { found: false, linkedinUrl: null, location: null, confidence: 0 };
  }
  const snippet = best.snippet || '';
  const location = extractLocationFromSnippet(snippet);
  return {
    found: true,
    linkedinUrl: best.link,
    linkedinTitle: best.title,
    linkedinSnippet: snippet,
    location: location,
    confidence: withOrg ? (best._score >= 6 ? 'high' : 'medium') : 'low',
    confidenceScore: Math.min(100, best._score * 10),
    allResults: scored.slice(0, 3).map(i => ({
      url: i.link, title: i.title, snippet: i.snippet, score: i._score
    }))
  };
}

// -- Helper: extract location from LinkedIn snippet --
function extractLocationFromSnippet(snippet) {
  if (!snippet) return null;

  const stateAbbrs = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
    'VA','WA','WV','WI','WY','DC'
  ];

  const stateNames = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY'
  };

  const s = snippet.toLowerCase();

  // Try "City, State" pattern
  const cityStateMatch = snippet.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  if (cityStateMatch) {
    const possibleState = cityStateMatch[2].toLowerCase();
    if (stateNames[possibleState]) {
      return {
        raw: cityStateMatch[0],
        state: stateNames[possibleState],
        city: cityStateMatch[1],
        country: 'US',
        source: 'linkedin_snippet'
      };
    }
  }

  // Try full state name
  for (const [stateName, abbr] of Object.entries(stateNames)) {
    if (s.includes(stateName)) {
      return { raw: stateName, state: abbr, country: 'US', source: 'linkedin_snippet' };
    }
  }

  // Try abbreviation pattern
  const abbrMatch = snippet.match(/\u00b7\s*([^\u00b7]+),\s+([A-Z]{2})\s*[\u00b7,]/);
  if (abbrMatch && stateAbbrs.includes(abbrMatch[2])) {
    return {
      raw: abbrMatch[0].trim(),
      city: abbrMatch[1].trim(),
      state: abbrMatch[2],
      country: 'US',
      source: 'linkedin_snippet'
    };
  }

  // Try metro area names
  const metroMap = {
    'greater boston': 'MA', 'san francisco bay area': 'CA',
    'greater new york': 'NY', 'new york city': 'NY',
    'greater chicago': 'IL', 'greater los angeles': 'CA',
    'greater seattle': 'WA', 'greater denver': 'CO',
    'greater houston': 'TX', 'greater dallas': 'TX',
    'dallas-fort worth': 'TX', 'greater atlanta': 'GA',
    'greater philadelphia': 'PA', 'greater miami': 'FL',
    'greater detroit': 'MI', 'greater minneapolis': 'MN',
    'greater portland': 'OR', 'greater baltimore': 'MD',
    'greater st. louis': 'MO', 'greater pittsburgh': 'PA',
    'triangle area': 'NC', 'research triangle': 'NC', 'rtp': 'NC',
    'greater san diego': 'CA', 'greater austin': 'TX',
    'greater nashville': 'TN', 'greater columbus': 'OH'
  };

  for (const [metro, state] of Object.entries(metroMap)) {
    if (s.includes(metro)) {
      return { raw: metro, state, country: 'US', source: 'linkedin_snippet' };
    }
  }

  return null;
}

// ====================================================================
// POST /enrich-lead  (NIH + Semantic Scholar + PubMed in parallel)
// ====================================================================
app.post('/enrich-lead', async (req, res) => {
  const { firstName, lastName, organisation } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Missing name' });

  const results = { nih: null, semanticScholar: null, pubmed: null };
  const errors = {};

  await Promise.allSettled([
    // -- NIH Reporter --
    (async () => {
      try {
        const nihResp = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            criteria: {
              pi_names: [{ first_name: firstName, last_name: lastName }]
            },
            offset: 0,
            limit: 25,
            fields: [
              'contact_pi_name', 'organization', 'project_title', 'award_amount',
              'fiscal_year', 'project_start_date', 'project_end_date',
              'direct_cost_amt', 'agency_ic_admin', 'project_num', 'principal_investigators'
            ]
          })
        });
        const nihData = await nihResp.json();
        const grants = nihData.results || [];
        if (grants.length > 0) {
          const orgLower = (organisation || '').toLowerCase();
          const matched = orgLower
            ? grants.filter(g =>
                g.organization?.org_name?.toLowerCase().includes(orgLower.split(' ')[0]) ||
                g.organization?.org_name?.toLowerCase().includes(orgLower.split(' ').slice(-1)[0])
              )
            : grants;
          const finalGrants = matched.length > 0 ? matched : grants;
          const totalFunding = finalGrants.reduce((sum, g) => sum + (g.award_amount || 0), 0);
          const recentGrant = finalGrants.sort((a, b) => (b.fiscal_year || 0) - (a.fiscal_year || 0))[0];
          const org = recentGrant?.organization;
          const piInfo = recentGrant?.principal_investigators?.[0] || null;
          const piPhone = piInfo?.['contact_telephone'] || piInfo?.phone || piInfo?.telephone || '';
          const piEmail = piInfo?.['contact_email'] || piInfo?.email || '';
          const piTitle = piInfo?.title || piInfo?.pi_title || '';
          let department = '';
          const orgNameFull = org?.org_name || '';
          const deptMatch = orgNameFull.match(
            /(?:Department|Dept|Division|School|College|Center|Institute)\s+(?:of\s+)?([^,;|]+)/i
          );
          if (deptMatch) department = deptMatch[0].trim();

          results.nih = {
            grantCount: finalGrants.length,
            totalFunding: totalFunding,
            totalFundingFormatted: totalFunding >= 1000000
              ? `$${(totalFunding / 1000000).toFixed(1)}M`
              : totalFunding >= 1000
                ? `$${Math.round(totalFunding / 1000)}K`
                : `$${totalFunding}`,
            recentGrantTitle: recentGrant?.project_title || '',
            recentGrantAmount: recentGrant?.award_amount || 0,
            recentGrantYear: recentGrant?.fiscal_year || '',
            recentGrantAgency: recentGrant?.agency_ic_admin?.abbreviation || '',
            orgCity: org?.org_city || '',
            orgState: org?.org_state || '',
            orgZip: org?.org_zipcode || '',
            orgCountry: org?.org_country || '',
            orgName: orgNameFull,
            department: department,
            phone: piPhone,
            piEmail: piEmail,
            piTitle: piTitle,
            piProfile: piInfo
          };
        }
      } catch (e) {
        errors.nih = e.message;
      }
    })(),

    // -- Semantic Scholar --
    (async () => {
      try {
        const query = encodeURIComponent(`${firstName} ${lastName}`);
        const ssResp = await fetch(
          `https://api.semanticscholar.org/graph/v1/author/search?query=${query}&fields=authorId,name,affiliations,hIndex,citationCount,paperCount,url,externalIds&limit=5`
        );
        const ssData = await ssResp.json();
        const authors = ssData.data || [];
        const orgWords = (organisation || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const scored = authors.map(a => {
          const aName = a.name?.toLowerCase() || '';
          const aAffils = (a.affiliations || []).map(af => af.name?.toLowerCase() || '').join(' ');
          let score = 0;
          if (aName.includes(firstName.toLowerCase())) score += 3;
          if (aName.includes(lastName.toLowerCase())) score += 3;
          orgWords.forEach(w => {
            if (aAffils.includes(w)) score += 2;
          });
          return { ...a, _score: score };
        }).sort((a, b) => b._score - a._score);

        const best = scored[0];
        if (best && best._score >= 3) {
          let recentPapers = [];
          try {
            const papersResp = await fetch(
              `https://api.semanticscholar.org/graph/v1/author/${best.authorId}/papers?fields=title,year,citationCount,fieldsOfStudy,journal&limit=5&sort=citationCount:desc`
            );
            const papersData = await papersResp.json();
            recentPapers = (papersData.data || []).slice(0, 3).map(p => ({
              title: p.title,
              year: p.year,
              citations: p.citationCount,
              journal: p.journal?.name || '',
              fields: p.fieldsOfStudy || []
            }));
          } catch (e) { /* ignore paper fetch errors */ }

          results.semanticScholar = {
            authorId: best.authorId,
            hIndex: best.hIndex || 0,
            citationCount: best.citationCount || 0,
            paperCount: best.paperCount || 0,
            profileUrl: best.url || '',
            affiliations: (best.affiliations || []).map(a => a.name).filter(Boolean),
            topPapers: recentPapers,
            score: best._score
          };
        }
      } catch (e) {
        errors.semanticScholar = e.message;
      }
    })(),

    // -- PubMed --
    (async () => {
      try {
        const query = encodeURIComponent(
          `${firstName} ${lastName}[Author]${organisation ? ` AND "${organisation.split(' ')[0]}"[Affiliation]` : ''}`
        );
        const searchResp = await fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmax=5&retmode=json&sort=date`
        );
        const searchData = await searchResp.json();
        const ids = searchData.esearchresult?.idlist || [];
        const totalCount = parseInt(searchData.esearchresult?.count || '0');
        let affiliation = '';
        let recentTitles = [];
        let department = '';

        if (ids.length > 0) {
          const summaryResp = await fetch(
            `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
          );
          const summaryData = await summaryResp.json();
          const articles = Object.values(summaryData.result || {}).filter(a => a.uid);
          recentTitles = articles.slice(0, 3).map(a => ({
            title: a.title || '',
            year: a.pubdate?.substring(0, 4) || '',
            journal: a.source || ''
          }));

          if (ids[0]) {
            try {
              const fetchResp = await fetch(
                `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids[0]}&retmode=xml&rettype=abstract`
              );
              const xml = await fetchResp.text();
              const affilMatch = xml.match(/<Affiliation>([^<]+)<\/Affiliation>/);
              if (affilMatch) {
                affiliation = affilMatch[1];
                const deptMatch = affiliation.match(
                  /(?:Department|Dept\.?|Division|Lab(?:oratory)?|School|Center|Centre)\s+(?:of\s+)?([^,;]+)/i
                );
                if (deptMatch) department = deptMatch[0].trim();
              }
            } catch (e) { /* ignore affiliation fetch errors */ }
          }
        }

        results.pubmed = {
          publicationCount: totalCount,
          recentTitles,
          affiliation,
          department,
          labName: ''
        };
      } catch (e) {
        errors.pubmed = e.message;
      }
    })()
  ]);

  res.json({ results, errors });
});

// ====================================================================
// POST /find-email  (4-step waterfall: NIH -> OpenAlex/ORCID -> Claude web search -> pattern guess)
// ====================================================================
app.post('/find-email', async (req, res) => {
  const { firstName, lastName, organisation, anthropicKey, s2ProfileUrl, linkedinUrl } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'Missing name' });

  const steps = [];
  let foundEmail = null;
  let foundMethod = null;
  let foundConfidence = null;
  let resolvedDomain = null;

  // STEP 1: NIH Reporter
  try {
    const nihResp = await fetch('https://api.reporter.nih.gov/v2/projects/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criteria: { pi_names: [{ first_name: firstName, last_name: lastName }] },
        offset: 0,
        limit: 10,
        fields: ['principal_investigators', 'organization', 'fiscal_year']
      })
    });
    const nihData = await nihResp.json();
    const grants = nihData.results || [];
    steps.push({ step: 'NIH Reporter', found: false, detail: `${grants.length} grants found` });

    if (grants.length > 0) {
      const orgLower = (organisation || '').toLowerCase();
      for (const grant of grants) {
        const pis = grant.principal_investigators || [];
        for (const pi of pis) {
          if (pi.contact_email || pi.email) {
            const email = pi.contact_email || pi.email;
            if (orgLower && grant.organization?.org_name) {
              const grantOrg = grant.organization.org_name.toLowerCase();
              if (!grantOrg.includes(orgLower.split(' ')[0])) continue;
            }
            foundEmail = email;
            foundMethod = 'NIH Reporter';
            foundConfidence = 'high';
            resolvedDomain = email.split('@')[1];
            steps[steps.length - 1].found = true;
            steps[steps.length - 1].detail = `Found: ${email}`;
            break;
          }
        }
        if (foundEmail) break;
      }
    }
  } catch (e) {
    steps.push({ step: 'NIH Reporter', found: false, detail: `Error: ${e.message}` });
  }

  // STEP 2: OpenAlex / ORCID
  if (!foundEmail) {
    try {
      const query = encodeURIComponent(`${firstName} ${lastName}`);
      const oaResp = await fetch(
        `https://api.openalex.org/authors?search=${query}&per_page=5`
      );
      const oaData = await oaResp.json();
      const authors = oaData.results || [];
      steps.push({ step: 'OpenAlex/ORCID', found: false, detail: `${authors.length} authors found` });

      const orgWords = (organisation || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const author of authors) {
        const lastInst = author.last_known_institutions?.[0];
        const instName = (lastInst?.display_name || '').toLowerCase();
        const nameMatch = (author.display_name || '').toLowerCase().includes(lastName.toLowerCase());

        if (!nameMatch) continue;

        let orgMatch = orgWords.length === 0;
        for (const w of orgWords) {
          if (instName.includes(w)) { orgMatch = true; break; }
        }
        if (!orgMatch) continue;

        // Check ORCID for email
        if (author.orcid) {
          const orcidId = author.orcid.replace('https://orcid.org/', '');
          try {
            const orcidResp = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/email`, {
              headers: { 'Accept': 'application/json' }
            });
            const orcidData = await orcidResp.json();
            const emails = orcidData.email || [];
            if (emails.length > 0) {
              foundEmail = emails[0].email;
              foundMethod = 'ORCID';
              foundConfidence = 'high';
              resolvedDomain = foundEmail.split('@')[1];
              steps[steps.length - 1].found = true;
              steps[steps.length - 1].detail = `Found via ORCID: ${foundEmail}`;
              break;
            }
          } catch (e) { /* continue */ }
        }
      }
    } catch (e) {
      steps.push({ step: 'OpenAlex/ORCID', found: false, detail: `Error: ${e.message}` });
    }
  }

  // STEP 3: Claude web search
  if (!foundEmail && anthropicKey) {
    try {
      const searchPrompt = `Find the professional email address for ${firstName} ${lastName} at ${organisation || 'their institution'}.
Search their institution's website, lab page, faculty directory, or published papers.
Return ONLY a JSON object: {"email": "found@email.com", "source": "where you found it", "confidence": "high|medium|low"}
If you cannot find it, return: {"email": null, "source": "not found", "confidence": "none"}
Return ONLY valid JSON, no other text.`;

      const searchResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: searchPrompt }]
        })
      });
      const searchData = await searchResp.json();
      const textBlocks = (searchData.content || []).filter(b => b.type === 'text');
      const lastText = textBlocks[textBlocks.length - 1]?.text || '';
      const jsonMatch = lastText.match(/\{[\s\S]*\}/);

      steps.push({ step: 'Claude Web Search', found: false, detail: 'Searched' });

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.email && parsed.email.includes('@')) {
          foundEmail = parsed.email;
          foundMethod = 'Claude Web Search';
          foundConfidence = parsed.confidence || 'medium';
          resolvedDomain = foundEmail.split('@')[1];
          steps[steps.length - 1].found = true;
          steps[steps.length - 1].detail = `Found: ${foundEmail} (${parsed.source})`;
        }
      }
    } catch (e) {
      steps.push({ step: 'Claude Web Search', found: false, detail: `Error: ${e.message}` });
    }
  }

  // STEP 4: Pattern guess
  if (!foundEmail && organisation) {
    try {
      let domain = null;
      const orgLower = organisation.toLowerCase();

      // Comprehensive university/institution domain map (200+ entries)
      const domainMap = {
        // Ivy League
        'harvard': 'harvard.edu', 'yale': 'yale.edu', 'princeton': 'princeton.edu',
        'columbia': 'columbia.edu', 'upenn': 'upenn.edu', 'penn ': 'upenn.edu',
        'brown university': 'brown.edu', 'dartmouth': 'dartmouth.edu', 'cornell': 'cornell.edu',
        // Top research
        'stanford': 'stanford.edu', 'mit': 'mit.edu', 'caltech': 'caltech.edu',
        'johns hopkins': 'jhu.edu', 'duke': 'duke.edu', 'uchicago': 'uchicago.edu',
        'university of chicago': 'uchicago.edu', 'northwestern': 'northwestern.edu',
        'wash u': 'wustl.edu', 'washington university in st': 'wustl.edu',
        // UC system
        'uc berkeley': 'berkeley.edu', 'berkeley': 'berkeley.edu', 'ucla': 'ucla.edu',
        'uc san diego': 'ucsd.edu', 'ucsd': 'ucsd.edu', 'ucsf': 'ucsf.edu',
        'uc san francisco': 'ucsf.edu', 'uc davis': 'ucdavis.edu', 'uc irvine': 'uci.edu',
        'uc santa barbara': 'ucsb.edu', 'uc santa cruz': 'ucsc.edu', 'uc riverside': 'ucr.edu',
        // Big state universities
        'university of michigan': 'umich.edu', 'umich': 'umich.edu',
        'university of texas': 'utexas.edu', 'ut austin': 'utexas.edu',
        'md anderson': 'mdanderson.org', 'ut southwestern': 'utsouthwestern.edu',
        'university of washington': 'uw.edu', 'uw madison': 'wisc.edu',
        'university of wisconsin': 'wisc.edu', 'wisc': 'wisc.edu',
        'university of minnesota': 'umn.edu', 'umn': 'umn.edu',
        'ohio state': 'osu.edu', 'penn state': 'psu.edu',
        'university of florida': 'ufl.edu', 'university of north carolina': 'unc.edu',
        'unc chapel hill': 'unc.edu', 'university of virginia': 'virginia.edu',
        'university of maryland': 'umd.edu', 'university of pittsburgh': 'pitt.edu',
        'pitt': 'pitt.edu', 'university of colorado': 'colorado.edu',
        'university of iowa': 'uiowa.edu', 'university of illinois': 'illinois.edu',
        'uiuc': 'illinois.edu', 'purdue': 'purdue.edu',
        'indiana university': 'indiana.edu', 'university of indiana': 'indiana.edu',
        'michigan state': 'msu.edu', 'iowa state': 'iastate.edu',
        'university of nebraska': 'unl.edu', 'university of kansas': 'ku.edu',
        'university of missouri': 'missouri.edu', 'mizzou': 'missouri.edu',
        'university of kentucky': 'uky.edu', 'university of tennessee': 'utk.edu',
        'vanderbilt': 'vanderbilt.edu', 'emory': 'emory.edu',
        'georgia tech': 'gatech.edu', 'georgia institute': 'gatech.edu',
        'university of georgia': 'uga.edu', 'clemson': 'clemson.edu',
        'virginia tech': 'vt.edu', 'nc state': 'ncsu.edu',
        'north carolina state': 'ncsu.edu', 'university of south carolina': 'sc.edu',
        'university of alabama': 'ua.edu', 'auburn': 'auburn.edu',
        'lsu': 'lsu.edu', 'louisiana state': 'lsu.edu',
        'university of arkansas': 'uark.edu', 'university of oklahoma': 'ou.edu',
        'oklahoma state': 'okstate.edu', 'texas a&m': 'tamu.edu', 'tamu': 'tamu.edu',
        'baylor': 'baylor.edu', 'rice': 'rice.edu', 'smu': 'smu.edu',
        'tcu': 'tcu.edu', 'texas tech': 'ttu.edu',
        'university of arizona': 'arizona.edu', 'arizona state': 'asu.edu',
        'university of utah': 'utah.edu', 'byu': 'byu.edu',
        'university of new mexico': 'unm.edu', 'university of nevada': 'unr.edu',
        'unlv': 'unlv.edu', 'colorado state': 'colostate.edu',
        'university of oregon': 'uoregon.edu', 'oregon state': 'oregonstate.edu',
        'washington state': 'wsu.edu',
        // Medical schools (many use different domains)
        'mayo clinic': 'mayo.edu', 'cleveland clinic': 'ccf.org',
        'mount sinai': 'mssm.edu', 'nyu': 'nyu.edu', 'nyu langone': 'nyulangone.org',
        'weill cornell': 'med.cornell.edu', 'memorial sloan': 'mskcc.org',
        'mass general': 'mgh.harvard.edu', 'brigham': 'bwh.harvard.edu',
        'dana-farber': 'dfci.harvard.edu', 'boston university': 'bu.edu',
        'tufts': 'tufts.edu', 'georgetown': 'georgetown.edu',
        'george washington': 'gwu.edu', 'drexel': 'drexel.edu',
        'thomas jefferson': 'jefferson.edu', 'temple': 'temple.edu',
        'rutgers': 'rutgers.edu', 'uconn': 'uconn.edu',
        'university of connecticut': 'uconn.edu',
        'wayne state': 'wayne.edu', 'wayne': 'wayne.edu',
        'case western': 'case.edu', 'cincinnati': 'uc.edu',
        'university of cincinnati': 'uc.edu',
        'university of rochester': 'rochester.edu', 'rochester': 'rochester.edu',
        'university at buffalo': 'buffalo.edu', 'suny': 'buffalo.edu',
        'stony brook': 'stonybrook.edu',
        // Pharma / biotech companies
        'pfizer': 'pfizer.com', 'novartis': 'novartis.com', 'roche': 'roche.com',
        'genentech': 'gene.com', 'amgen': 'amgen.com', 'gilead': 'gilead.com',
        'merck': 'merck.com', 'abbvie': 'abbvie.com', 'bristol': 'bms.com',
        'johnson & johnson': 'jnj.com', 'eli lilly': 'lilly.com', 'lilly': 'lilly.com',
        'astrazeneca': 'astrazeneca.com', 'sanofi': 'sanofi.com',
        'boehringer': 'boehringer-ingelheim.com', 'regeneron': 'regeneron.com',
        'biogen': 'biogen.com', 'moderna': 'modernatx.com',
        'takeda': 'takeda.com', 'bayer': 'bayer.com',
        // Government / national labs
        'nih': 'nih.gov', 'national institutes of health': 'nih.gov',
        'cdc': 'cdc.gov', 'fda': 'fda.hhs.gov',
        'los alamos': 'lanl.gov', 'sandia': 'sandia.gov',
        'argonne': 'anl.gov', 'brookhaven': 'bnl.gov',
        'oak ridge': 'ornl.gov', 'lawrence berkeley': 'lbl.gov',
        'pacific northwest': 'pnnl.gov',
        // International
        'oxford': 'ox.ac.uk', 'cambridge': 'cam.ac.uk', 'imperial college': 'imperial.ac.uk',
        'ucl': 'ucl.ac.uk', 'university college london': 'ucl.ac.uk',
        'eth zurich': 'ethz.ch', 'epfl': 'epfl.ch',
        'max planck': 'mpg.de', 'karolinska': 'ki.se',
        'university of toronto': 'utoronto.ca', 'mcgill': 'mcgill.ca',
        'ubc': 'ubc.ca', 'university of british columbia': 'ubc.ca',
        'university of melbourne': 'unimelb.edu.au',
        'university of sydney': 'sydney.edu.au',
        'kyowa kirin': 'kyowakirin.com', 'kyowa': 'kyowakirin.com',
        // More research institutions
        'scripps': 'scripps.edu', 'salk': 'salk.edu', 'broad institute': 'broadinstitute.org',
        'whitehead': 'wi.mit.edu', 'cold spring harbor': 'cshl.edu',
        'jackson lab': 'jax.org', 'fred hutch': 'fredhutch.org',
        'st. jude': 'stjude.org', 'children\'s hospital': 'chop.edu',
        'institute of technology': 'edu'
      };

      // Try matching against the comprehensive map
      for (const [key, dom] of Object.entries(domainMap)) {
        if (orgLower.includes(key)) { domain = dom; break; }
      }

      // Generic university pattern (if no specific match)
      if (!domain) {
        // Try "University of X" pattern
        const uofMatch = orgLower.match(/university of (\w+)/);
        if (uofMatch) {
          domain = `${uofMatch[1]}.edu`;
        }
      }
      if (!domain) {
        // Try "X University" pattern
        const xuMatch = orgLower.match(/(\w+)\s+university/);
        if (xuMatch && xuMatch[1].length > 2) {
          domain = `${xuMatch[1]}.edu`;
        }
      }
      if (!domain) {
        // Try "X Institute of Technology" pattern
        const xitMatch = orgLower.match(/(\w+)\s+institute/);
        if (xitMatch && xitMatch[1].length > 2) {
          domain = `${xitMatch[1]}.edu`;
        }
      }

      if (domain) {
        // Clean firstName: strip middle initials, take only first part
        const cleanFirst = firstName.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
        const lastLower = lastName.toLowerCase().replace(/[^a-z]/g, '');
        const firstInitial = cleanFirst[0] || '';
        const patterns = [
          `${firstInitial}${lastLower}@${domain}`,
          `${cleanFirst}.${lastLower}@${domain}`,
          `${cleanFirst}${lastLower}@${domain}`,
          `${lastLower}.${cleanFirst}@${domain}`,
          `${lastLower}@${domain}`
        ];

        foundEmail = patterns[0];
        foundMethod = 'Pattern Guess';
        foundConfidence = 'low';
        resolvedDomain = domain;
        steps.push({
          step: 'Pattern Guess',
          found: true,
          detail: `Guessed: ${patterns[0]} (domain: ${domain}, also: ${patterns.slice(1, 3).join(', ')})`
        });
      } else {
        steps.push({ step: 'Pattern Guess', found: false, detail: 'Could not resolve domain from: ' + organisation });
      }
    } catch (e) {
      steps.push({ step: 'Pattern Guess', found: false, detail: `Error: ${e.message}` });
    }
  }

  if (foundEmail) {
    res.json({ email: foundEmail, method: foundMethod, confidence: foundConfidence, domain: resolvedDomain, steps });
  } else {
    res.json({ email: null, method: null, confidence: null, domain: null, steps });
  }
});

// ====================================================================
// POST /api/bug-report
// ====================================================================
app.post('/api/bug-report', async (req, res) => {
  const { description, reporterEmail, debug } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });

  try {
    const body = [
      'FIDA NEO BUG REPORT',
      '===========================',
      '',
      `Description: ${description}`,
      `Reporter: ${reporterEmail || 'anonymous'}`,
      `Time: ${debug?.timestamp || new Date().toISOString()}`,
      '',
      '-- User Info --',
      `User ID: ${debug?.userId || 'unknown'}`,
      `App URL: ${debug?.appUrl || 'unknown'}`,
      `Active Tab: ${debug?.activeTab || 'unknown'}`,
      `Browser: ${debug?.browser || 'unknown'}`,
      '',
      '-- App State --',
      `Supabase Connected: ${debug?.supabaseConnected}`,
      `Total Leads: ${debug?.totalLeads || 0}`,
      `Playbooks: ${JSON.stringify(debug?.playbooks || [])}`,
      '',
      '-- API Keys --',
      `Anthropic: ${debug?.apiKeys?.anthropic}`,
      `ZeroBounce: ${debug?.apiKeys?.zeroBounce}`,
      `Instantly: ${debug?.apiKeys?.instantly}`,
      '',
      '-- Recent JS Errors --',
      JSON.stringify(debug?.recentErrors || [], null, 2),
    ].join('\n');

    const instantlyPayload = {
      api_key: process.env.INSTANTLY_API_KEY || '',
      to: ['odonovan@fidabio.com'],
      from: 'mike@fida-connect.com',
      from_name: 'Fida Neo Bug Reporter',
      subject: `Bug Report: ${description.substring(0, 60)}`,
      body: body.replace(/\n/g, '<br>'),
      reply_to: reporterEmail || 'odonovan@fidabio.com'
    };

    let sent = false;
    if (process.env.INSTANTLY_API_KEY) {
      try {
        const r = await fetch('https://api.instantly.ai/api/v1/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(instantlyPayload)
        });
        sent = r.ok;
      } catch (e) {
        console.error('Instantly send failed:', e.message);
      }
    }

    console.log('=== BUG REPORT ===');
    console.log(body);
    console.log('==================');

    res.json({ ok: true, sent });
  } catch (e) {
    console.error('Bug report error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ====================================================================
// Start server
// ====================================================================
app.listen(PORT, () => {
  console.log(`Fida SDR backend running on port ${PORT}`);
});
