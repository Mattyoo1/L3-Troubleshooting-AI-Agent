/ ============================================================
// 📁 파일 경로: /vite.config.js
//
// ✅ 수정 사항:
//   1. 로컬 개발 시 /api/* 요청 프록시 설정 추가
//      - Vite dev server에서 /api/gemini 등 호출 시
//        로컬에서 실행 중인 Vercel dev 서버로 프록시
//      - 실제 배포 환경(Vercel)에서는 이 설정 무시됨
//
// 📌 로컬 개발 권장 방식:
//   - vercel dev 명령어를 사용하면 Vercel Serverless Function을
//     로컬에서 그대로 테스트 가능 (프록시 설정 불필요)
//   - npm run dev는 순수 프론트엔드만 테스트할 때 사용
// ============================================================
 
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // ✅ 로컬 개발 시 /api/* → vercel dev 서버로 프록시
      // vercel dev를 별도 터미널에서 실행 (기본 포트 3000)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // ✅ 빌드 결과물 최적화
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'lucide': ['lucide-react'],
        },
      },
    },
  },
})
