// ============================================================
// 📁 파일 경로: /api/gemini.js
// Vercel Serverless Function — Gemini API 서버-to-서버 프록시
//
// ✅ 수정: @vercel/kv 제거 (deprecated + 미설정 시 함수 로드 실패 버그)
//
// 📌 서버사이드 토큰 제한 옵션 (Upstash Redis):
//   1. npm install @upstash/redis
//   2. Vercel Dashboard → Integrations → Upstash Redis 추가 (무료)
//   3. 환경변수 자동 추가됨: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
//   4. 아래 주석 처리된 Redis 섹션 활성화
// ============================================================
 
// ─── [선택사항] Upstash Redis (서버사이드 토큰 제한) ────────────────────
// 설정 완료 후 아래 주석을 해제하세요
//
import { Redis } from '@upstash/redis';
const redis = (process.env.KV_REST_API_URL && process.env.KV_REST_TOKEN)
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;
// ──────────────────────────────────────────────────────────────────────────
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
const ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];
 
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const SERVER_DAILY_LIMIT = 50000;
 
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });
 
  const { userApiKey, model, messages, systemPrompt, isJsonMode } = req.body || {};
 
  if (!userApiKey || typeof userApiKey !== 'string') {
    return res.status(400).json({ error: 'API Key is required' });
  }
  const trimmedKey = userApiKey.trim();
  if (!/^AIza[A-Za-z0-9\-_.]{10,55}$/.test(trimmedKey)) {
    return res.status(400).json({ error: 'Invalid API Key format' });
  }
 
  const selectedModel = (model || 'gemini-2.5-flash').trim();
  if (!ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: `Unsupported model: ${selectedModel}` });
  }
 
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
 
  // ─── [선택사항] Upstash Redis 서버사이드 한도 체크 ─────────────────
  // Upstash 설정 완료 후 아래 주석을 해제하세요
  //
  // if (redis) {
  //   const ip = getClientIP(req);
  //   const today = new Date().toISOString().split('T')[0];
  //   const usageKey = `tokens:${ip}:${today}`;
  //   const currentUsage = (await redis.get(usageKey)) || 0;
  //   if (currentUsage >= SERVER_DAILY_LIMIT) {
  //     return res.status(429).json({ error: 'Daily token limit exceeded. Try again tomorrow.' });
  //   }
  // }
  // ──────────────────────────────────────────────────────────────────────
 
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));
 
  const geminiPayload = { contents };
  if (systemPrompt) {
    geminiPayload.systemInstruction = { parts: [{ text: String(systemPrompt) }] };
  }
  if (isJsonMode) {
    geminiPayload.generationConfig = { responseMimeType: 'application/json' };
  }
 
  try {
    // ✅ API Key → URL 파라미터 아닌 헤더로 전달 (서버 로그 노출 방지)
    const response = await fetch(
      `${GEMINI_API_BASE}/${selectedModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        body: JSON.stringify(geminiPayload),
      }
    );
 
    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return res.status(401).json({ error: 'Invalid or unauthorized API Key' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      return res.status(502).json({ error: 'LLM API request failed' });
    }
 
    const data = await response.json();
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;
 
    // ─── [선택사항] Upstash 사용량 기록 ────────────────────────────────
    // if (redis && tokensUsed > 0) {
    //   const ip = getClientIP(req);
    //   const today = new Date().toISOString().split('T')[0];
    //   const usageKey = `tokens:${ip}:${today}`;
    //   await redis.incrby(usageKey, tokensUsed);
    //   await redis.expire(usageKey, 172800); // 48h
    // }
    // ──────────────────────────────────────────────────────────────────────
 
    return res.status(200).json({
      text: data?.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: {
        input: data?.usageMetadata?.promptTokenCount || 0,
        output: data?.usageMetadata?.candidatesTokenCount || 0,
        total: tokensUsed,
      },
    });
 
  } catch (error) {
    console.error('[Gemini Proxy] Internal error occurred');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
