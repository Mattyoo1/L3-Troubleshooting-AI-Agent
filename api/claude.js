// ============================================================
// 📁 파일 경로: /api/claude.js
// Vercel Serverless Function — Claude 프록시 + 서버사이드 토큰 제한
// ============================================================
 
import { kv } from '@vercel/kv';
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
];
 
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
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
  if (!/^sk-ant-[A-Za-z0-9\-_]{20,200}$/.test(trimmedKey)) {
    return res.status(400).json({ error: 'Invalid Anthropic API Key format' });
  }
 
  const selectedModel = (model || 'claude-haiku-4-5-20251001').trim();
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
 
  // Claude 메시지 형식 (연속 동일 role 병합)
  const claudeMessages = [];
  let lastRole = null;
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m.content || '');
    if (role === lastRole && claudeMessages.length > 0) {
      claudeMessages[claudeMessages.length - 1].content += '\n' + content;
    } else {
      claudeMessages.push({ role, content });
      lastRole = role;
    }
  }
 
  let finalSystemPrompt = systemPrompt || '';
  if (isJsonMode) {
    finalSystemPrompt += (finalSystemPrompt ? '\n\n' : '') +
      'IMPORTANT: Respond with valid JSON only. No markdown, no explanation, no code fences. Just the raw JSON object.';
  }
 
  const claudePayload = { model: selectedModel, max_tokens: 4096, messages: claudeMessages };
  if (finalSystemPrompt) claudePayload.system = finalSystemPrompt;
 
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(claudePayload),
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
    const inputTokens = data?.usage?.input_tokens || 0;
    const outputTokens = data?.usage?.output_tokens || 0;
    const tokensUsed = inputTokens + outputTokens;
 
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
      text: data?.content?.[0]?.text || '',
      usage: {
        input: inputTokens,
        output: outputTokens,
        total: tokensUsed,
      },
    });
 
  } catch (error) {
    console.error('[Claude Proxy] Internal error occurred');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
