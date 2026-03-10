// Fida AI SDR Backend v2 — PubMed + LinkedIn research + Instantly.ai CSV export
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'Fida AI SDR backend v2 running ✅' }));

// ── PubMed search ─────────────────────────────────────────────────────────────
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
      return {
        title: pub.title || '',
        journal: pub.fulljournalname || pub.source || '',
        date: pub.pubdate || '',
      };
    }).filter(p => p.title);
  } catch (e) {
    console.error('PubMed error:', e.message);
    return [];
  }
}

// ── LinkedIn via Claude web search ────────────────────────────────────────────
async function searchLinkedIn(firstName, lastName, institution, anthropicKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search for "${firstName} ${lastName}" researcher at "${institution}" on LinkedIn or their lab website. Return ONLY JSON: {"title":"","lab_focus":"","notable":""} — current job title, main research focus, one notable fact. If not found return empty strings.`
        }]
      })
    });
    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) return {};
    return JSON.parse(textBlock.text.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('LinkedIn search error:', e.message);
    return {};
  }
}

// ── Generate personalized emails ──────────────────────────────────────────────
app.post('/generate', async (req, res) => {
  const { lead, anthropicKey, knowledgeBase } = req.body;
  if (!lead || !anthropicKey) return res.status(400).json({ error: 'Missing lead or anthropicKey' });

  try {
    const [publications, linkedIn] = await Promise.all([
      searchPubMed(lead.firstName, lead.lastName, lead.organisation),
      searchLinkedIn(lead.firstName, lead.lastName, lead.organisation, anthropicKey)
    ]);

    const focusAreas = lead.focusedAreas
      ? lead.focusedAreas.split(';').slice(0, 4).map(s => s.split('#')[0].trim()).join(', ')
      : 'surface plasmon resonance, binding assays';

    const pubContext = publications.length
      ? publications.map(p => `- "${p.title}" (${p.journal}, ${p.date})`).join('\n')
      : '- No recent PubMed publications found; use SciLeads focus areas only';

    const linkedInContext = linkedIn.title
      ? `- Current title: ${linkedIn.title}\n- Lab focus: ${linkedIn.lab_focus}\n- Notable: ${linkedIn.notable}`
      : '- LinkedIn data not found';

    const kbContext = knowledgeBase?.length
      ? `\n\nFIDA KNOWLEDGE BASE — application notes & brochures:\n` +
        knowledgeBase.map((doc, i) => `[Doc ${i+1}: ${doc.name}]\n${doc.content.substring(0, 2500)}`).join('\n\n---\n\n')
      : '';

    const prompt = `You are an expert B2B sales email writer for Fida, a biotech instrument company.

FIDA NEO:
- Measures hydrodynamic radius (Rh), polydispersity, aggregation — 40nL sample, minutes
- Cytiva/Biacore partnership: Fida Neo is the recommended companion to Biacore SPR
- Workflow: FIDA (reagent QC) → Biacore SPR (kinetics) → FIDA (orthogonal KD verification)
- Catches aggregation that SPR misses — "Don't waste SPR runs on bad reagents"
- Sales rep: Mike O'Donovan${kbContext}

CONTACT:
- Name: ${lead.firstName} ${lead.lastName}
- Institution: ${lead.organisation}
- Title: ${lead.jobTitle}
- Location: ${lead.state}, ${lead.country}
- SciLeads focus: ${focusAreas}

PubMed publications:
${pubContext}

LinkedIn/web:
${linkedInContext}

TASK: Write a 3-email cold outreach sequence.
Rules:
- Reference their SPECIFIC recent papers or research by name when possible
- If knowledge base docs provided, pick the single most relevant Fida application for their work and reference it
- Peer-to-peer tone, never salesy, scientifically credible
- No placeholder text
- Email 1 (Day 1): 5 sentences max — personalized hook from their research + Fida relevance
- Email 2 (Day 4): 4 sentences max — specific pain point their work faces, how Fida solves it
- Email 3 (Day 8): 3 sentences max — brief low-friction breakup / last check-in
- Each email ends with a soft ask for a 20-min call

Respond ONLY with valid JSON, no markdown fences:
{"email1":{"subject":"...","body":"..."},"email2":{"subject":"...","body":"..."},"email3":{"subject":"...","body":"..."},"personalization_note":"...","matched_app":"..."}

personalization_note = 1 sentence on what specific research angle was used
matched_app = most relevant doc name from knowledge base, or "General SPR/Biacore workflow" if none`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content?.[0]?.text || '';
    const emails = JSON.parse(text.replace(/```json|```/g, '').trim());

    res.json({ emails, research: { publications: publications.slice(0, 3), linkedIn } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test Anthropic key ────────────────────────────────────────────────────────
app.post('/test-anthropic', async (req, res) => {
  const { anthropicKey } = req.body;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    const d = await r.json();
    if (d.error) return res.status(401).json({ error: d.error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fida SDR backend v2 running on port ${PORT}`));
