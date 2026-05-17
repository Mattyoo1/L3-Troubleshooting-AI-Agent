// ============================================================
// 📁 파일 경로: /tailwind.config.js
//
// ✅ 수정 사항:
//   1. tailwindcss-animate 플러그인 추가
//      - App.jsx에서 animate-in, slide-in-from-*, fade-in 등 사용
//      - 이 플러그인 없으면 해당 애니메이션 클래스 동작 안 함
//      - 설치 필요: npm install tailwindcss-animate
//   2. safelist: 동적 클래스가 빌드 시 purge되지 않도록 보호
// ============================================================
 
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // ✅ animate-in, slide-in-from-*, zoom-in-*, fade-in 등 사용에 필요
    // npm install tailwindcss-animate 실행 후 사용 가능
    require('tailwindcss-animate'),
  ],
}
