// ============================================================
// 📁 파일 경로: /api/usage.js  ← 신규 추가 파일
//
// ✅ 목적: localStorage 우회 방지를 위한 서버사이드 토큰 사용량 추적
//
// ──────────────────────────────────────────────────────────
// 🔴 현재 localStorage 우회 방법 (취약점 설명)
// ──────────────────────────────────────────────────────────
// 1. 브라우저에서 F12 → DevTools 열기
// 2. Application 탭 → Storage → Local Storage → 사이트 URL 클릭
// 3. 'token_history' 키 찾기
// 4. 값을 더블클릭 → {} 로 변경하거나 행 우클릭 → Delete 삭제
// 5. 페이지 새로고침 → 사용량 0으로 초기화, 한도 우회 완료
//
// 이 방법으로 50,000 토큰 한도를 무한히 우회 가능합니다.
//
// ✅ 해결책: IP 기반 서버사이드 추적 (Vercel KV 사용)
//
// 📦 사전 준비:
//   1. npm install @vercel/kv
//   2. Vercel Dashboard → Storage → Create → KV Database 생성
//   3. 프로젝트에 연결 → 환경변수 자동 추가됨
//      (KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN 등)
//   4. Vercel 무료 플랜: 30MB 스토리지, 월 300,000 요청 무료
//
// ⚠️  KV 미설정 시 graceful degradation:
//   KV 없이도 앱은 정상 동작, 서버사이드 제한만 비활성화됨
// ============================================================
 
import { kv } from '@vercel/kv';
 
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'https://myit-ai-agent.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);
 
const SERVER_DAILY_LIMIT = 50000;
const KEY_EXPIRY_SECONDS = 48 * 3600; // 48시간 후 자동 만료
 
/**
 * 클라이언트 IP 추출
 * Vercel은 x-forwarded-for 헤더에 실제 IP를 담아줌
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // 다중 프록시 경유 시 첫 번째 IP가 실제 클라이언트
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
 
export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === '';
 
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });
 
  const ip = getClientIP(req);
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `tokens:${ip}:${today}`;
 
  // ──────────────────────────────────────────────────────
  // GET: 현재 사용량 조회 (앱 시작 시 서버값과 동기화용)
  // ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const usage = (await kv.get(usageKey)) || 0;
      return res.status(200).json({
        usage,
        limit: SERVER_DAILY_LIMIT,
        remaining: Math.max(0, SERVER_DAILY_LIMIT - usage),
        exceeded: usage >= SERVER_DAILY_LIMIT,
        date: today,
      });
    } catch {
      // KV 미설정 시 — 제한 없음으로 응답 (graceful)
      return res.status(200).json({
        usage: 0,
        limit: SERVER_DAILY_LIMIT,
        remaining: SERVER_DAILY_LIMIT,
        exceeded: false,
        kvAvailable: false,
      });
    }
  }
 
  // ──────────────────────────────────────────────────────
  // POST: 사용량 증가 기록 (각 API 호출 완료 후 호출됨)
  // ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { tokens } = req.body || {};
    if (!tokens || typeof tokens !== 'number' || tokens <= 0 || tokens > 200000) {
      return res.status(400).json({ error: 'Invalid token count' });
    }
 
    try {
      const newUsage = await kv.incrby(usageKey, Math.floor(tokens));
      // TTL 갱신 (처음 생성 시에도, 이후에도 항상 48h 유지)
      await kv.expire(usageKey, KEY_EXPIRY_SECONDS);
 
      return res.status(200).json({
        usage: newUsage,
        limit: SERVER_DAILY_LIMIT,
        remaining: Math.max(0, SERVER_DAILY_LIMIT - newUsage),
        exceeded: newUsage > SERVER_DAILY_LIMIT,
      });
    } catch {
      // KV 미설정 시 — 조용히 무시 (앱 동작 방해 안 함)
      return res.status(200).json({
        usage: tokens,
        kvAvailable: false,
      });
    }
  }
 
  return res.status(405).json({ error: 'Method Not Allowed' });
}
