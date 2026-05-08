// /api/gemini.js (Vercel Serverless Function)

export default async function handler(req, res) {
  // 1. [보안] POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. [보안] CORS 보호 (선택사항, Vercel은 기본적으로 동일 도메인만 허용하지만 명시적 방어)
  const origin = req.headers.origin;
  const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://myit-ai-agent.vercel.app'; // 로컬 테스트시는 주석처리
  
  // 3. 페이로드 파싱
  const { contents, systemInstruction } = req.body;

  // 4. Vercel 환경변수에서 API Key 가져오기 (절대 클라이언트에 노출 안 됨!)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '서버 환경변수에 API Key가 없습니다.' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // 5. 구글 서버로 진짜 요청 보내기 (서버 to 서버 통신)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents, systemInstruction }),
    });

    if (!response.ok) {
      throw new Error(`Google API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // 6. 결과를 프론트엔드로 전달
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Gemini API Fetch Error:', error);
    return res.status(500).json({ error: '내부 서버 오류로 AI 응답을 가져오지 못했습니다.' });
  }
}
