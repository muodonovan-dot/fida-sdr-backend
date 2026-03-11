// Fida AI SDR Backend v3 — generalized, tone + application focus + ZeroBounce
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'Fida AI SDR backend v3 running' }));

async function searchPubMed(firstName, lastName, institution) {
  try {
    const query = encodeURIComponent(`${firstName} ${lastName}[Author] ${institution}[Affiliation]`);
    const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmax=5&sort=date&retmode=json`);
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (!ids.length) return [];
    const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
    const summaryData = await summaryRes.json();
    const uids = summaryData.result?.uids || [];
    return uids.map(uid => {
      const pub = summaryData.result[uid];
      return { title: pub.title || '', journal: pub.fulljournalname || pub.source || '', date: pub.pubdate || '' };
    }).filter(p => p.title);
  } catch (e) { return []; }
}

async function searchLinkedIn(firstName, lastName, institution, anthropicKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Search for "${firstName} ${lastName}" at "${institution}". Return ONLY JSON: {"title":"","lab_focus":"","notable":""}. Empty strings if not found.` }]
      })
    });
    const data = await response.json();
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    if (!textBlocks.length) return {};
    const match = textBlocks[textBlocks.length - 1].text.match(/{[\s\S]*}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  } catch (e) { return {}; }
}

const APPLICATION_FOCUS = {
  general: { product: 'FIDA NEO measures hydrodynamic radius (Rh), polydispersity, and aggregation in 40nL under native conditions.', angle: 'Position Fida Neo as a powerful protein characterization tool connecting to the contact published work.' },
  spr_biacore: { product: 'FIDA NEO: official Cytiva/Biacore companion. Use for reagent QC before SPR, then orthogonal KD verification after. Catches aggregation SPR misses.', angle: 'Position Fida NEO as the essential SPR companion. Confirm binding partners are monomeric before SPR runs. Emphasize Cytiva partnership.' },
  antibody_dev: { product: 'FIDA NEO measures Rh, polydispersity, aggregation of antibodies in 40nL under native conditions. Critical for developability screening.', angle: 'Rapid aggregation screening during developability. 40nL means screening without sacrificing precious candidate material.' },
  drug_discovery: { product: 'FIDA NEO: label-free, native-condition Rh measurement in 40nL. Detects binding-induced size changes without labels.', angle: 'Rapid target characterization and binding confirmation under native conditions. No labels, no immobilization.' },
  structural_biology: { product: 'FIDA NEO confirms monodispersity before cryo-EM, crystallography, or NMR in 40nL.', angle: 'Pre-screening for structural biology: confirm monodispersity before committing to cryo-EM grids or crystallization.' },
  de_novo_proteins: { product: 'FIDA NEO measures Rh and polydispersity of designed proteins in 40nL under native conditions. Confirms whether a computationally designed sequence folds into the intended compact structure.', angle: 'For de novo protein design, Fida Neo is the fast experimental reality-check. Reference their specific design methodology (RFdiffusion, ProteinMPNN, hallucination) and position Fida as solution-phase confirmation that the designed protein folds as intended — before investing in cryo-EM, activity assays, or crystallization.' }
};

function buildPrompt(lead, publications, linkedIn, knowledgeBase, tone, campaignContext, applicationFocus) {
  const focusAreas = lead.focusedAreas ? lead.focusedAreas.split(';').slice(0,4).map(s => s.split('#')[0].trim()).join(', ') : 'protein characterization, biophysics';
  const pubContext = publications.length ? publications.map(p => `- "${p.title}" (${p.journal}, ${p.date})`).join('\n') : '- No PubMed publications found; use focus areas only';
  const linkedInContext = linkedIn.title ? `- Title: ${linkedIn.title}\n- Lab focus: ${linkedIn.lab_focus}\n- Notable: ${linkedIn.notable}` : '- LinkedIn data not found';
  const kbContext = knowledgeBase && knowledgeBase.length ? '\n\nFIDA KNOWLEDGE BASE:\n' + knowledgeBase.map((doc,i) => `[Doc ${i+1}: ${doc.name}]\n${doc.content.substring(0,2500)}`).join('\n---\n') : '';
  const appInfo = APPLICATION_FOCUS[applicationFocus] || APPLICATION_FOCUS.general;
  const toneGuide = tone === 'academic' ? 'TONE - ACADEMIC: Peer scientist voice. Reference papers by name. No sales buzzwords.' : 'TONE - INDUSTRY: Results-focused. Throughput, reproducibility, time savings.';
  const ctx = { scileads: 'SciLeads — reference their work directly.', leadgeeks: 'Curated researcher list — reference published research.', conference_attendee: 'Conference attendee — reference recent activity.', conference_announcement: 'Fida attending conference — offer to meet in person.', generic: 'General outreach — frame around published research.' };
  return `You are a B2B sales email writer for Fida Bio.

PRODUCT: ${appInfo.product}${kbContext}

APPLICATION FOCUS: ${appInfo.angle}

${toneGuide}
LEAD SOURCE: ${ctx[campaignContext] || ctx.generic}
SALES REP: Mike O'Donovan, Fida Bio

CONTACT:
- Name: ${lead.firstName} ${lead.lastName}
- Institution: ${lead.organisation}
- Title: ${lead.jobTitle}
- Location: ${lead.state}, ${lead.country}
- Research focus: ${focusAreas}

Publications:
${pubContext}

LinkedIn: ${linkedInContext}

Write a 3-email cold outreach sequence:
- Reference SPECIFIC papers or research by name
- Apply tone and focus above — no placeholder text
- Email 1 (Day 1): 5 sentences max
- Email 2 (Day 4): 4 sentences max
- Email 3 (Day 8): 3 sentences max
- Each ends with soft ask for 20-min call

Respond ONLY in valid JSON (no markdown):
{"email1":{"subject":"...","body":"..."},"email2":{"subject":"...","body":"..."},"email3":{"subject":"...","body":"..."},"personalization_note":"...","matched_app":"..."}

matched_app = KB doc name or "General Fida Neo characterization"`;
}

app.post('/generate', async (req, res) => {
  const { lead, anthropicKey, knowledgeBase, tone, campaignContext, applicationFocus } = req.body;
  if (!lead || !anthropicKey) return res.status(400).json({ error: 'Missing lead or anthropicKey' });
  try {
    const [publications, linkedIn] = await Promise.all([searchPubMed(lead.firstName, lead.lastName, lead.organisation), searchLinkedIn(lead.firstName, lead.lastName, lead.organisation, anthropicKey)]);
    const lowConfidence = !publications.length && !linkedIn.title;
    const effectiveTone = tone || (((lead.email||'').includes('.edu') || (lead.email||'').includes('.ac.')) ? 'academic' : 'industry');
    const prompt = buildPrompt(lead, publications, linkedIn, knowledgeBase, effectiveTone, campaignContext || 'scileads', applicationFocus || 'general');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const emails = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim());
    res.json({ emails, research: { publications: publications.slice(0,3), linkedIn }, lowConfidence });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/test-anthropic', async (req, res) => {
  const { anthropicKey } = req.body;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }) });
    const d = await r.json();
    if (d.error) return res.status(401).json({ error: d.error.message });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/test-zerobounce', async (req, res) => {
  const { zeroBounceKey } = req.body;
  if (!zeroBounceKey) return res.status(400).json({ error: 'Missing zeroBounceKey' });
  try {
    const r = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${zeroBounceKey}`);
    const d = await r.json();
    if (d.Credits === undefined || d.Credits < 0) return res.status(401).json({ error: 'Invalid ZeroBounce key' });
    res.json({ ok: true, credits: d.Credits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/verify-emails-bulk', async (req, res) => {
  const { emails, zeroBounceKey } = req.body;
  if (!emails?.length || !zeroBounceKey) return res.status(400).json({ error: 'Missing emails or zeroBounceKey' });
  try {
    const payload = { api_key: zeroBounceKey, email_batch: emails.map(email => ({ email_address: email })) };
    const r = await fetch('https://bulkapi.zerobounce.net/v2/validatebatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (d.errors?.length && !d.email_batch?.length) return res.status(400).json({ error: d.errors[0]?.error || 'ZeroBounce error' });
    const verified = (d.email_batch || []).map(item => {
      const status = item.ZB_STATUS || item.status || '';
      let tag = 'unknown';
      if (status === 'valid') tag = 'valid';
      else if (status === 'catch-all') tag = 'catch-all';
      else if (['invalid','spamtrap','abuse','do_not_mail'].includes(status)) tag = 'invalid';
      return { email: item.email_address || item.address || '', status, tag };
    });
    res.json({ verified });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fida SDR backend v3 running on port ${PORT}`));