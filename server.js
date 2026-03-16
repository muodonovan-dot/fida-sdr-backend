const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }));

// ── Test Anthropic key ───────────────────────────────────────────────────────
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

// ── Test ZeroBounce key ──────────────────────────────────────────────────────
app.post('/test-zerobounce', async (req, res) => {
  const { zeroBounceKey } = req.body;
  try {
    const r = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${zeroBounceKey}`);
    const d = await r.json();
    if (d.Credits !== undefined && d.Credits !== '-1') res.json({ ok: true, credits: d.Credits });
    else res.json({ ok: false, error: 'Invalid key or no credits' });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── Verify emails bulk (ZeroBounce) ─────────────────────────────────────────
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

// ── Claude proxy — for AI Auto-Discover and other frontend Claude calls ──────
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
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Claude API error' });
    res.json({ text: data.content?.[0]?.text || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Generate email sequence ──────────────────────────────────────────────────
app.post('/generate', async (req, res) => {
  const { lead, anthropicKey, knowledgeBase = [], tone = 'industry', campaignContext = 'scileads', applicationFocus = 'general', sequenceLength = 3 } = req.body;

  // Research: get LinkedIn + PubMed context via Claude with web search
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
1. Their recent publications (PubMed) — what specific proteins/systems are they working on?
2. Their LinkedIn profile — current role, recent activity
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
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
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
    general: 'native-state protein characterization — Rh, aggregation, polydispersity in 40nL',
    spr_biacore: 'SPR/Biacore companion — verify reagent quality before runs, orthogonal KD confirmation',
    antibody_dev: 'antibody developability screening — rapid aggregation check with 40nL, no labeling',
    drug_discovery: 'label-free target engagement and fragment binding confirmation in native conditions',
    structural_biology: 'pre-cryo-EM/crystallography screening — confirm monodispersity before committing samples',
    de_novo_proteins: 'solution-phase validation of designed proteins — confirm folding and monodispersity'
  };

  const appDesc = focusDescriptions[researchContext?.application_match || applicationFocus] || focusDescriptions.general;

  // Campaign context
  const contextDescriptions = {
    scileads: 'You found this researcher via SciLeads based on their recent publications.',
    leadgeeks: 'This researcher was identified via LeadGeeks prospecting.',
    conference_attendee: 'This researcher attended a recent conference in your field.',
    conference_announcement: 'Fida Bio will be attending an upcoming conference.',
    generic: 'General cold outreach.'
  };

  const emailCount = Math.min(Math.max(sequenceLength, 3), 7);

  // Generate the email sequence
  const emailPrompt = `You are an expert biotech sales email writer for Fida Bio, selling the Fida Neo instrument.

LEAD INFORMATION:
Name: ${lead.firstName} ${lead.lastName}
Title: ${lead.jobTitle}
Institution: ${lead.organisation}
Location: ${lead.state}, ${lead.country}
Research Focus: ${lead.focusedAreas || 'protein research'}
Tone: ${tone} (academic = collegial/peer-to-peer; industry = professional/ROI-focused)

RESEARCH CONTEXT:
${researchContext ? JSON.stringify(researchContext, null, 2) : 'No specific research found — use general biotech context'}

FIDA NEO VALUE PROPOSITION:
- Measures hydrodynamic radius (Rh), polydispersity, and aggregation in native conditions
- Only 40nL sample needed — no wasted precious material
- Label-free, solution-phase measurements
- Application focus for this lead: ${appDesc}
- Cytiva/Biacore partner — positioned as companion, NOT competitor

CAMPAIGN CONTEXT: ${contextDescriptions[campaignContext] || contextDescriptions.generic}

${kbText ? `FIDA KNOWLEDGE BASE:\n${kbText}` : ''}

Write a ${emailCount}-email cold outreach sequence. Each email should:
- Be concise (150-200 words max)
- Reference their specific research when possible
- Have a clear, non-spammy subject line
- End with a soft CTA (not "buy now" — more like "worth a quick look?")
- Each follow-up should try a different angle

Return ONLY valid JSON in this exact format:
{
  "personalization_note": "1 sentence on the specific angle used",
  "matched_app": "which Fida Neo application was matched",
  "email1": { "subject": "...", "body": "..." },
  "email2": { "subject": "...", "body": "..." },
  "email3": { "subject": "...", "body": "..." }${emailCount >= 5 ? ',\n  "email4": { "subject": "...", "body": "..." },\n  "email5": { "subject": "...", "body": "..." }' : ''}${emailCount >= 7 ? ',\n  "email6": { "subject": "...", "body": "..." },\n  "email7": { "subject": "...", "body": "..." }' : ''}
}`;

  try {
    const genResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: emailPrompt }]
      })
    });

    const genData = await genResp.json();
    if (!genResp.ok) return res.status(genResp.status).json({ error: genData.error?.message || 'Generation failed' });

    const text = genData.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse email JSON from Claude response' });

    const emails = JSON.parse(jsonMatch[0]);
    res.json({ emails, research: researchContext, lowConfidence });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Fida SDR backend running on port ${PORT}`));
