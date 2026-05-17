// ============================================================
// 📁 파일 경로: /api/gemini.js
// Vercel Serverless Function — Gemini API 서버-to-서버 프록시
//
// ✅ 보안 수정 사항:
//   1. API Key URL 파라미터 → x-goog-api-key 헤더 전달 (로그 노출 방지)
//   2. Origin 화이트리스트 실제 검증 로직 추가 (기존: 선언만 하고 미사용)
//   3. 모델명 화이트리스트 검증 (임의 모델 호출 차단)
//   4. userApiKey 형식 정규식 검증 (Gemini 키 패턴)
//   5. OPTIONS preflight 응답 처리 추가
//   6. 에러 응답에서 내부 스택트레이스/상세정보 제거
//   7. 응답 정규화: { text, usage } 형식으로 프론트 통일
// ============================================================
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
// ✅ 허용 모델 화이트리스트 (Gemini 1.x는 2025년 3월 EOS → 2.0+ 이상만 허용)
const ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];
 
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
 
export default async function handler(req, res) {
  // ✅ CORS Origin 검증
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === '';
 
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
 
  // ✅ OPTIONS preflight 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
 
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
 
  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }
 
  const { userApiKey, model, messages, systemPrompt, isJsonMode } = req.body || {};
 
  // ✅ API Key 존재 및 형식 검증 (AIza 접두사)
  if (!userApiKey || typeof userApiKey !== 'string') {
    return res.status(400).json({ error: 'API Key is required' });
  }
  const trimmedKey = userApiKey.trim();
  if (!/^AIza[A-Za-z0-9\-_.]{10,55}$/.test(trimmedKey)) {
    return res.status(400).json({ error: 'Invalid API Key format' });
  }
 
  // ✅ 모델 화이트리스트 검증
  const selectedModel = (model || 'gemini-2.5-flash').trim();
  if (!ALLOWED_MODELS.includes(selectedModel)) {
    return res.status(400).json({ error: `Unsupported model: ${selectedModel}` });
  }
 
  // ✅ messages 배열 검증
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
 
  // Gemini API 페이로드 구성
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
    // ✅ [핵심 보안 수정]
    // 기존: ?key=${apiKey} → 서버 액세스 로그에 API Key 전체가 기록됨 (Critical 취약점)
    // 변경: x-goog-api-key 헤더 → 로그에 기록되지 않음
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
 
    // ✅ 정규화된 응답 반환 (프론트엔드가 프로바이더 포맷 몰라도 됨)
    return res.status(200).json({
      text: data?.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: {
        input: data?.usageMetadata?.promptTokenCount || 0,
        output: data?.usageMetadata?.candidatesTokenCount || 0,
        total: data?.usageMetadata?.totalTokenCount || 0,
      },
    });
 
  } catch (error) {
    // ✅ 민감 정보(키, 응답 본문) console.error 기록 금지
    console.error('[Gemini Proxy] Internal error occurred');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
