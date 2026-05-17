// ============================================================
// 📁 파일 경로: /api/openai.js
// Vercel Serverless Function — OpenAI 프록시 + 서버사이드 토큰 제한
// ============================================================
 
import { kv } from '@vercel/kv';
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
const ALLOWED_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-nano',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4.1',
];
 
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const SERVER_DAILY_LIMIT = 50000;
const KEY_EXPIRY_SECONDS = 48 * 3600;
 
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
 
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === '';
 
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
 
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
 
  // ✅ 서버사이드 토큰 한도 검증
  const ip = getClientIP(req);
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `tokens:${ip}:${today}`;
 
  try {
    const currentUsage = (await kv.get(usageKey)) || 0;
    if (currentUsage >= SERVER_DAILY_LIMIT) {
      return res.status(429).json({
        error: `Daily token limit (${SERVER_DAILY_LIMIT.toLocaleString()}) exceeded. Please try again tomorrow.`,
        usage: currentUsage,
        limit: SERVER_DAILY_LIMIT,
      });
    }
  } catch {
    // KV 미설정 시 생략
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
 
  const payload = { model: selectedModel, messages: openaiMessages, max_tokens: 4096 };
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
    const tokensUsed = data?.usage?.total_tokens || 0;
 
    // ✅ 사용량 서버사이드 기록
    try {
      if (tokensUsed > 0) {
        await kv.incrby(usageKey, tokensUsed);
        await kv.expire(usageKey, KEY_EXPIRY_SECONDS);
      }
    } catch {
      // KV 미설정 시 무시
    }
 
    return res.status(200).json({
      text: data?.choices?.[0]?.message?.content || '',
      usage: {
        input: data?.usage?.prompt_tokens || 0,
        output: data?.usage?.completion_tokens || 0,
        total: tokensUsed,
      },
    });
 
  } catch (error) {
    console.error('[OpenAI Proxy] Internal error occurred');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
