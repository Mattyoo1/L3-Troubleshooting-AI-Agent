// ============================================================
// 📁 파일 경로: /tailwind.config.js
//
// ✅ 수정: require() → import 방식으로 변경
//    Vite 프로젝트는 package.json에 "type":"module" 설정 시
//    require()를 사용할 수 없어 빌드 에러 발생
//    → ESM 방식의 import animate from 'tailwindcss-animate' 사용
// ✅ package.json "type": "module" → ESM 방식 사용 (require 불가)
// ✅ npm install tailwindcss-animate --save-dev 설치 후 동작
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
 // ✅ safelist: 동적으로 생성되는 클래스가 빌드 시 제거되지 않도록 보호
  safelist: [
    'dark:bg-slate-800',
    'dark:border-blue-500',
    'dark:border-emerald-500',
    'dark:border-orange-500',
    'bg-blue-50',
    'bg-emerald-50',
    'bg-orange-50',
    'border-blue-200',
    'border-emerald-200',
    'border-orange-200',
  ],
  plugins: [
    // ✅ animate-in, slide-in-from-*, zoom-in-*, fade-in 등 UI 애니메이션 지원
    animate
  ],
}
 
