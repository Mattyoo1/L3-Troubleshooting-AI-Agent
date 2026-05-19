// ============================================================
// 📁 파일 경로: /public/sw.js
//
// ✅ 보안 수정 사항:
//   1. /api/* 경로 캐싱 완전 금지 (API Key, LLM 응답 캐시 방지 - Critical 취약점 수정)
//   2. 외부 LLM API 응답 캐싱 금지 (직접 호출 차단 경로 포함)
//   3. console.log 전체 제거 (프로덕션 정보 노출 방지)
//   4. skipWaiting + clients.claim으로 즉시 활성화
//   5. 캐시 버전 관리 강화 (배포 시 자동 갱신)
// ============================================================
 
const CACHE_VERSION = 'v3';
const CACHE_NAME = `l3-agent-cache-${CACHE_VERSION}`;
 
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];
 
// ✅ 절대 캐싱 금지 경로 패턴 (API Key 및 민감 응답 보호)
const NEVER_CACHE_PATTERNS = [
  /^\/api\//,                                  // 자체 Vercel API 프록시
  /generativelanguage\.googleapis\.com/,       // Gemini (직접 호출 시)
  /api\.openai\.com/,                          // OpenAI
  /api\.anthropic\.com/,                       // Anthropic
];
 
// 1. 설치: 정적 에셋 사전 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 일부 에셋 없어도 SW 설치 실패하지 않도록 예외 처리
      });
    })
  );
  self.skipWaiting(); // 즉시 활성화
});
 
// 2. 활성화: 구버전 캐시 자동 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});
 
// 3. Fetch 인터셉트: API 요청은 반드시 네트워크 직통
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;
 
  // ✅ 캐싱 금지 패턴 검사 (POST 포함 모든 비-GET도 통과)
  const shouldBypassCache = NEVER_CACHE_PATTERNS.some(p => p.test(url));
  if (shouldBypassCache || request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
 
  // 정적 에셋: Cache First 전략
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then(networkResponse => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        }
        return networkResponse;
      }).catch(() => {
        // 오프라인 + 캐시 없음 → 기본 페이지 반환
        return caches.match('/index.html');
      });
    })
  );
});
