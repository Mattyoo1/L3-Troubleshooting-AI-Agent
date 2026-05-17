/ ============================================================
// 📁 파일 경로: /api/claude.js  ← 신규 추가 파일
// Vercel Serverless Function — Anthropic Claude API 프록시
//
// ✅ Claude API는 브라우저 직접 호출 시 CORS 제한이 있지만,
//    Vercel Serverless Function을 통한 서버-to-서버 호출은 CORS 문제 없음
//    → Edge Function 별도 설정 불필요, github push만으로 자동 배포 가능
// ✅ 'anthropic-dangerous-direct-browser-access' 헤더 불필요 (서버 호출이므로)
// ============================================================
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
// ✅ FinOps 최적화: 저비용 모델 우선
const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',   // 추천 · 최저비용
  'claude-3-5-haiku-20241022',   // 저비용
  'claude-sonnet-4-6',           // 고성능
  'claude-opus-4-6',             // 최고성능 (고비용)
];
 
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
 
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === '';
 
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });
 
  const { userApiKey, model, messages, systemPrompt, isJsonMode } = req.body || {};
 
  // ✅ Anthropic API Key 형식 검증 (sk-ant- 접두사)
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
 
  // ✅ Claude는 user/assistant 메시지가 번갈아 와야 함
  // 연속된 동일 role 메시지 병합 처리
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
 
  // ✅ Claude JSON mode: 네이티브 미지원 → system prompt에 JSON 지시 추가
  let finalSystemPrompt = systemPrompt || '';
  if (isJsonMode) {
    finalSystemPrompt += (finalSystemPrompt ? '\n\n' : '') +
      'IMPORTANT: Respond with valid JSON only. No markdown, no explanation, no code fences. Just the raw JSON object.';
  }
 
  const claudePayload = {
    model: selectedModel,
    max_tokens: 4096,
    messages: claudeMessages,
  };
  if (finalSystemPrompt) {
    claudePayload.system = finalSystemPrompt;
  }
 
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': ANTHROPIC_VERSION,
        // ✅ 서버-to-서버 호출이므로 browser-access 헤더 불필요
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
 
    return res.status(200).json({
      text: data?.content?.[0]?.text || '',
      usage: {
        input: data?.usage?.input_tokens || 0,
        output: data?.usage?.output_tokens || 0,
        total: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
      },
    });
 
  } catch (error) {
    console.error('[Claude Proxy] Internal error occurred');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
