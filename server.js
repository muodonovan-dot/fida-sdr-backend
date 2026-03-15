// Fida AI SDR Backend v4 — with multi-step email sequences
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.json({ status: 'Fida AI SDR backend v4 running - multi-step sequences enabled' }));

// Application focus configurations
const APPLICATION_FOCUS = {
  general: {
    product: 'Fida Neo — Native-state protein characterization platform with flow-induced dispersion analysis.',
    angle: 'Position Fida Neo as the solution for accurate hydrodynamic radius (Rh) measurement in native state — unlike Biacore/SPR which requires surface immobilization. Emphasize aggregation detection, polydispersity assessment, and solution-phase insights that complement their existing biophysical toolkit.'
  },
  spr_biacore: {
    product: 'Fida Neo — Complementary protein characterization that measures what Biacore cannot: native-state hydrodynamic properties.',
    angle: 'Frame as the perfect companion to their SPR/Biacore workflows. While Biacore gives binding kinetics, Fida Neo reveals solution-phase aggregation, size distribution, and conformational changes that occur before and after binding events.'
  }
};

// Generate personalized emails
app.post('/generate', async (req, res) => {
  const { lead, anthropicKey, knowledgeBase, tone, campaignContext, applicationFocus, sequenceLength } = req.body;
  if (!lead || !anthropicKey) return res.status(400).json({ error: 'Missing lead or anthropicKey' });
  try {
    const effectiveSequenceLength = sequenceLength || 3;
    const prompt = buildPrompt(lead, [], {}, knowledgeBase, tone || 'academic', campaignContext || 'scileads', applicationFocus || 'general', effectiveSequenceLength);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content?.[0]?.text || '';
    const emails = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json({ emails, research: { publications: [], linkedIn: {} }, lowConfidence: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function buildPrompt(lead, publications, linkedIn, knowledgeBase, tone, campaignContext, applicationFocus, sequenceLength = 3) {
  const appInfo = APPLICATION_FOCUS[applicationFocus] || APPLICATION_FOCUS.general;

  const sequenceInstructions = {
    3: `Write a 3-email sequence:
- Email 1: Research hook + Fida relevance (5 sentences max)
- Email 2: Specific pain point + how Fida solves it (4 sentences max) 
- Email 3: Brief breakup + last check-in (3 sentences max)
JSON: {"email1":{"subject":"...","body":"..."},"email2":{"subject":"...","body":"..."},"email3":{"subject":"...","body":"..."},"personalization_note":"...","matched_app":"..."}`,
    
    5: `Write a 5-email sequence:
- Email 1: Research hook + initial Fida relevance (5 sentences max)
- Email 2: Core value proposition + specific benefits (5 sentences max)
- Email 3: Social proof + peer validation (4 sentences max)
- Email 4: Follow-up + address concerns (4 sentences max)
- Email 5: Final touch + breakup (3 sentences max)
JSON: {"email1":{"subject":"...","body":"..."},"email2":{"subject":"...","body":"..."},"email3":{"subject":"...","body":"..."},"email4":{"subject":"...","body":"..."},"email5":{"subject":"...","body":"..."},"personalization_note":"...","matched_app":"..."}`,
    
    7: `Write a 7-email sequence:
- Email 1: Research hook + initial Fida relevance (5 sentences max)
- Email 2: Core value proposition + specific benefits (5 sentences max)
- Email 3: Social proof + peer validation (4 sentences max)
- Email 4: Detailed case study + concrete results (5 sentences max)
- Email 5: Follow-up + address concerns (4 sentences max)
- Email 6: Different angle + alternative use case (4 sentences max)
- Email 7: Final touch + low-pressure breakup (3 sentences max)
JSON: {"email1":{"subject":"...","body":"..."},"email2":{"subject":"...","body":"..."},"email3":{"subject":"...","body":"..."},"email4":{"subject":"...","body":"..."},"email5":{"subject":"...","body":"..."},"email6":{"subject":"...","body":"..."},"email7":{"subject":"...","body":"..."},"personalization_note":"...","matched_app":"..."}`
  };

  return `You are an expert B2B sales email writer for Fida Bio.

PRODUCT: ${appInfo.product}
APPLICATION FOCUS: ${appInfo.angle}
TONE: Academic - write as a peer scientist, reference methodology
SALES REP: Mike O'Donovan, Fida Bio

CONTACT:
- Name: ${lead.firstName} ${lead.lastName}
- Institution: ${lead.organisation}
- Title: ${lead.jobTitle}

TASK: ${sequenceInstructions[sequenceLength] || sequenceInstructions[3]}

Each email ends with a soft ask for a 20-min call. No placeholder text — everything specific to this person.`;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Fida SDR backend v4 running on port ${PORT}`));