const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const FIDA_CONTEXT = `You are an expert B2B sales email writer for Fida, a biotech instrument company making the Fida Neo instrument — measures hydrodynamic radius (Rh), polydispersity, and aggregation in 40nL sample in minutes.

Key points:
- Cytiva partnership: Fida Neo is the recommended companion to Biacore SPR — use FIDA first to QC reagents before expensive SPR experiments
- Workflow: FIDA (reagent QC) → Biacore SPR (kinetics) → FIDA (orthogonal KD verification)
- Catches aggregation problems SPR misses
- Core pitch: "Don't waste SPR runs on bad reagents"
- Sales rep: Mike O'Donovan at Fida

Write emails: concise, warm, scientifically credible, never generic, peer-to-peer researcher tone, no placeholder text, goal = 20-min discovery call.`;

// Health check
app.get('/', (req, res) => res.json({ status: 'Fida AI SDR backend running ✅' }));

// Generate emails for one lead
app.post('/generate', async (req, res) => {
  const { lead, anthropicKey } = req.body;
  if (!lead || !anthropicKey) return res.status(400).json({ error: 'Missing lead or anthropicKey' });

  try {
    const focusAreas = lead.focusedAreas
      ? lead.focusedAreas.split(';').slice(0, 4).map(s => s.split('#')[0].trim()).join(', ')
      : 'surface plasmon resonance, binding assays';
    const recentDate = lead.recentActivity
      ? new Date(lead.recentActivity).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'recently';
    const pubSnippet = lead.publications
      ? lead.publications.split('|').slice(0, 2).map(s => s.trim()).filter(Boolean).join('; ')
      : '';

    const prompt = `${FIDA_CONTEXT}

Lead:
- Name: ${lead.firstName} ${lead.lastName}
- Institution: ${lead.organisation}
- Job title: ${lead.jobTitle}
- Location: ${lead.state}, ${lead.country}
- Research focus: ${focusAreas}
- Recent SPR activity: ${recentDate}
${pubSnippet ? `- Recent publication topics: ${pubSnippet}` : ''}

Write a 3-email cold outreach sequence to book a 20-minute discovery call about Fida Neo:
Email 1 (Day 1): Short intro referencing their SPR work + Cytiva/Biacore collaboration. Max 5 sentences.
Email 2 (Day 3): Follow-up on reagent QC problem Fida solves before SPR runs. Max 4 sentences.
Email 3 (Day 7): Brief breakup email, low-friction ask. Max 3 sentences.

Respond ONLY with valid JSON, no markdown:
{"email1":{"subject":"...","body":"..."},"email2":{"subject":"...","body":"..."},"email3":{"subject":"...","body":"..."}}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content?.[0]?.text || '';
    const emails = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json({ emails });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create HubSpot contact
app.post('/hubspot/contact', async (req, res) => {
  const { lead, hubspotKey } = req.body;
  if (!lead || !hubspotKey) return res.status(400).json({ error: 'Missing lead or hubspotKey' });

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubspotKey}` },
      body: JSON.stringify({
        properties: {
          firstname: lead.firstName,
          lastname: lead.lastName,
          email: lead.email,
          company: lead.organisation,
          jobtitle: lead.jobTitle,
          state: lead.state,
          country: lead.country,
          leadsource: 'Scileads'
        }
      })
    });
    const data = await response.json();
    if (data.status === 'error') {
      // Handle duplicate contact gracefully
      if (data.message && data.message.includes('already exists')) {
        return res.json({ id: null, duplicate: true });
      }
      return res.status(400).json({ error: data.message });
    }
    res.json({ id: data.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add note with email sequence to a HubSpot contact
app.post('/hubspot/note', async (req, res) => {
  const { contactId, emails, lead, hubspotKey } = req.body;
  if (!contactId || !emails || !hubspotKey) return res.status(400).json({ error: 'Missing params' });

  const noteBody = `FIDA AI SDR — Personalized Email Sequence for ${lead.firstName} ${lead.lastName}

--- EMAIL 1 (Day 1) ---
Subject: ${emails.email1.subject}

${emails.email1.body}

--- EMAIL 2 (Day 3) ---
Subject: ${emails.email2.subject}

${emails.email2.body}

--- EMAIL 3 (Day 7) ---
Subject: ${emails.email3.subject}

${emails.email3.body}`;

  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubspotKey}` },
      body: JSON.stringify({
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString()
        },
        associations: [{
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }]
        }]
      })
    });
    const data = await response.json();
    res.json({ noteId: data.id || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fida SDR backend running on port ${PORT}`));
