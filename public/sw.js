// public/sw.js 파일 내용

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // 크롬 PWA 설치 기준을 통과하기 위한 최소한의 fetch 이벤트 핸들러
});
