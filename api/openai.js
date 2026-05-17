// ============================================================
// 📁 파일 경로: /api/openai.js
// Vercel Serverless Function — OpenAI API 서버-to-서버 프록시
//
// ✅ @vercel/kv 없이 즉시 동작하는 클린 버전
// 📌 Upstash Redis 연동 방법은 gemini.js 주석 참고
// ============================================================
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
const ALLOWED_MODELS = [
  'gpt-4o-mini',    // ⭐ 추천 · 저비용
  'gpt-4.1-nano',   // 💰 최저비용
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4.1',
];
 
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
 
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === '';
 
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });
 
  const { userApiKey, model, messages, systemPrompt, isJsonMode } = req.body || {};
 
  if (!userApiKey || typeof userApiKey !== 'string') {
    return res.status(400).json({ error: 'API Key is required' });
  }
  const trimmedKey = userApiKey.trim();
  if (!/^sk-[A-Za-z0-9\-_]{20,200}$/.test(trimmedKey)) {
    return res.status(400).json({ error: 'Invalid OpenAI API Key format' });
  }
 
  const selectedModel = (model || 'gpt-4o-mini').trim();
  if (!ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: `Unsupported model: ${selectedModel}` });
  }
 
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
 
  const openaiMessages = [];
  if (systemPrompt) {
    openaiMessages.push({ role: 'system', content: String(systemPrompt) });
  }
  messages.forEach(m => {
    openaiMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    });
  });
 
  const payload = {
    model: selectedModel,
    messages: openaiMessages,
    max_tokens: 4096,
  };
  if (isJsonMode) {
    payload.response_format = { type: 'json_object' };
  }
 
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify(payload),
    });
 
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ error: 'Invalid or unauthorized API Key' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      return res.status(502).json({ error: 'LLM API request failed' });
    }
 
    const data = await response.json();
 
    return res.status(200).json({
      text: data?.choices?.[0]?.message?.content || '',
      usage: {
        input: data?.usage?.prompt_tokens || 0,
        output: data?.usage?.completion_tokens || 0,
        total: data?.usage?.total_tokens || 0,
      },
    });
 
  } catch (error) {
    console.error('[OpenAI Proxy] Internal error occurred');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
