// backend/services/flexportAnalyzer.js
const axios = require('axios');
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function analyzeForFlexport(companyName, prospectData, newsHeadlines, searchResults) {
  const system = `You are a Flexport sales intelligence analyst. Flexport is a global freight forwarder and logistics platform offering: real-time shipment visibility, customs clearance, duty deferral, bonded warehouses, and ocean/air/trucking coordination. Your role is to help SDRs understand import-dependent companies and craft compelling Flexport outreach.`;

  const user = `Analyze this company as a Flexport inbound sales prospect:

Company: ${companyName}
${prospectData ? `Sector: ${prospectData.sector} | Revenue: ${prospectData.estimated_revenue} | Import Origins: ${prospectData.import_origins?.join(', ')} | Shipping Lanes: ${prospectData.primary_lanes?.join(', ')} | Current Forwarder: ${prospectData.likely_forwarder}` : ''}

Recent Supply Chain News:
${newsHeadlines?.map(n => `- ${n}`).join('\n') || 'No recent news'}

Search Context:
${searchResults?.map(r => `- ${r.title}: ${r.snippet}`).join('\n') || 'Limited data'}

Return JSON with exactly these fields:
{
  "profile": "2-3 sentence overview: what they import, from where, how it relates to their business model",
  "pain_points": ["Supply chain pain specific to their business", "Customs/compliance challenge", "Visibility or cost pain point"],
  "tech_maturity": "1-2 sentences on their logistics tech sophistication — are they using a TMS, manual tracking, etc.",
  "outreach_angle": "Specific 1-2 sentence Flexport pitch referencing their actual lanes and pain points. Reference real Flexport value props.",
  "decision_makers": [
    {"title": "VP Supply Chain or Head of Operations", "concerns": ["Specific concern 1", "Specific concern 2"]},
    {"title": "CFO or Finance Lead", "concerns": ["Duty cost concern", "Freight spend visibility"]}
  ],
  "icp_breakdown": {
    "fit_score": 85,
    "reasoning": "Why this company is a strong Flexport ICP fit",
    "key_signals": ["Signal 1", "Signal 2", "Signal 3"]
  },
  "flexport_value_props": ["Most relevant Flexport feature for this company", "Second most relevant"]
}`;

  const response = await axios.post(OPENAI_URL, {
    model: 'gpt-4-turbo',
    max_tokens: 800,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
  }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });

  const content = response.data.choices[0].message.content;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse analysis JSON');
  return JSON.parse(match[0]);
}

module.exports = { analyzeForFlexport };
