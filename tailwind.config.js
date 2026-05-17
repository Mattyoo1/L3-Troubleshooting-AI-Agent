// ============================================================
// 📁 파일 경로: /tailwind.config.js
//
// ✅ 수정: require() → import 방식으로 변경
//    Vite 프로젝트는 package.json에 "type":"module" 설정 시
//    require()를 사용할 수 없어 빌드 에러 발생
//    → ESM 방식의 import animate from 'tailwindcss-animate' 사용
// ============================================================
 
import animate from 'tailwindcss-animate';
 
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
    // ✅ animate-in, slide-in-from-*, zoom-in-*, fade-in 등 UI 애니메이션 지원
    animate,
  ],
}
 
