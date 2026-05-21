import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, BellRing, Cpu, PlayCircle, AlertCircle,
  MessageSquare, Mail, Smartphone, ShieldAlert, Activity,
  HelpCircle, Loader2, Send, BarChart3, Globe, Sun, Moon,
  Menu, X, CheckCircle, Zap, Calendar, CalendarDays, Key, Trash2,
  Search, FileCode, Server, AlertTriangle, User, Lock, Eye, EyeOff,
  ChevronDown
} from 'lucide-react';

// ✅ KB 데이터 JSON 파일에서 import (src/data/ 폴더)
import kbKo from './data/kb_ko.json';
import kbEn from './data/kb_en.json';

// ─── 렌더링 파싱 에러 방어 ──────────────────────────────────────────────────
const BQ  = String.fromCharCode(96);
const TBQ = BQ + BQ + BQ;

// ════════════════════════════════════════════════════════════════════════════
// ✅ 위험 명령어 패턴 감지
// ════════════════════════════════════════════════════════════════════════════
const DANGER_PATTERNS = [
  /docker[- ]compose\s+down\s+--volumes?/i,
  /docker\s+system\s+prune/i,
  /rm\s+-rf?\s+\//i,
  /rm\s+-rf?\s+~/i,
  /rm\s+-rf?\s+\*/i,
  /dd\s+if=.*\s+of=\/dev\//i,
  /mkfs\./i,
  /format\s+[a-z]:/i,
  /DROP\s+DATABASE/i,
  /DROP\s+TABLE/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*;?\s*$/im,
  />\/dev\/sda/i,
  /shred\s+-/i,
  /wipefs/i,
  /--volumes/i,
];

const isDangerousCommand = (code) =>
  DANGER_PATTERNS.some(p => p.test(code));

// ════════════════════════════════════════════════════════════════════════════
// ✅ 로그 민감정보 마스킹 유틸리티 (브라우저 단)
// ════════════════════════════════════════════════════════════════════════════
const maskSensitiveLog = (text) => {
  if (!text) return { masked: text, changed: false };
  let result = text;
  let changed = false;

  const rules = [
    { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, tag: '[MASKED_IP]' },
    { re: /\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, tag: '[MASKED_IP]' },
    { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, tag: '[MASKED_EMAIL]' },
    { re: /(password|passwd|pwd|secret|token|key|auth|credential)[\s=:'"]+\S+/gi, tag: '[MASKED_SECRET]' },
    { re: /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, tag: '[MASKED_JWT]' },
    { re: /AKIA[0-9A-Z]{16}/g, tag: '[MASKED_AWS_KEY]' },
    { re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/g, tag: '[MASKED_CARD]' },
  ];

  for (const rule of rules) {
    const replaced = result.replace(rule.re, rule.tag);
    if (replaced !== result) { changed = true; result = replaced; }
  }

  return { masked: result, changed };
};

// ════════════════════════════════════════════════════════════════════════════
// ✅ [SECTION 1] 멀티-LLM 설정 (모델 선택 포함)
// ════════════════════════════════════════════════════════════════════════════

const DAILY_TOKEN_LIMIT = 50000;

const MODEL_OPTIONS = {
  gemini: [
    {
      id: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      badge: { ko: '⭐ 추천', en: '⭐ Recommended' },
      costNote: { ko: '저비용 · 빠름', en: 'Low cost · Fast' },
      costTier: 1,
    },
    {
      id: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      badge: { ko: '💰', en: '💰' },
      costNote: { ko: '저비용', en: 'Low cost' },
      costTier: 1,
    },
    {
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      badge: { ko: '🔥', en: '🔥' },
      costNote: { ko: '고성능 · 고비용', en: 'High performance · High cost' },
      costTier: 3,
    },
  ],
  openai: [
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      badge: { ko: '⭐ 추천', en: '⭐ Recommended' },
      costNote: { ko: '저비용 · 안정적', en: 'Low cost · Reliable' },
      costTier: 1,
    },
    {
      id: 'gpt-4.1-nano',
      label: 'GPT-4.1 Nano',
      badge: { ko: '💰 최저가', en: '💰 Cheapest' },
      costNote: { ko: '최저비용', en: 'Lowest cost' },
      costTier: 0,
    },
    {
      id: 'gpt-4.1-mini',
      label: 'GPT-4.1 Mini',
      badge: { ko: '✦', en: '✦' },
      costNote: { ko: '저비용', en: 'Low cost' },
      costTier: 1,
    },
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      badge: { ko: '🔥', en: '🔥' },
      costNote: { ko: '고성능 · 고비용', en: 'High performance · High cost' },
      costTier: 3,
    },
  ],
  claude: [
    {
      id: 'claude-haiku-4-5-20251001',
      label: 'Claude Haiku 4.5',
      badge: { ko: '⭐ 추천', en: '⭐ Recommended' },
      costNote: { ko: '저비용 · 빠름', en: 'Low cost · Fast' },
      costTier: 1,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      label: 'Claude 3.5 Haiku',
      badge: { ko: '💰', en: '💰' },
      costNote: { ko: '저비용', en: 'Low cost' },
      costTier: 1,
    },
    {
      id: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      badge: { ko: '🔥', en: '🔥' },
      costNote: { ko: '고성능 · 고비용', en: 'High performance · High cost' },
      costTier: 3,
    },
  ],
};

const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-haiku-4-5-20251001',
};

const PROVIDER_CONFIG = {
  gemini: {
    label: 'Gemini',
    emoji: '✦',
    colorClass: 'blue',
    storageKey: 'byok_gemini_v3',
    keyPattern: /^AIza[A-Za-z0-9\-_.]{10,55}$/,
    placeholder: '••••••••••••••••••••',
    minLen: 20, maxLen: 60,
    note: null,
  },
  openai: {
    label: 'ChatGPT',
    emoji: '⬡',
    colorClass: 'green',
    storageKey: 'byok_openai_v3',
    keyPattern: /^sk-[A-Za-z0-9\-_]{20,200}$/,
    placeholder: '••••••••••••••••••••',
    minLen: 40, maxLen: 220,
    note: null,
  },
  claude: {
    label: 'Claude',
    emoji: '◈',
    colorClass: 'orange',
    storageKey: 'byok_claude_v3',
    keyPattern: /^sk-ant-[A-Za-z0-9\-_]{20,200}$/,
    placeholder: '••••••••••••••••••••',
    minLen: 50, maxLen: 220,
    note: null,
  },
};

// ════════════════════════════════════════════════════════════════════════════
// ✅ [SECTION 2] 보안 유틸리티 — AES-GCM 암호화 API Key 저장
// ════════════════════════════════════════════════════════════════════════════

const validateApiKey = (key, provider) => {
  if (!key || typeof key !== 'string') return false;
  const t = key.trim();
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) return false;
  if (t.length < cfg.minLen || t.length > cfg.maxLen) return false;
  return cfg.keyPattern.test(t);
};

const maskApiKey = () => '••••••••••••••••••••';

const CRYPTO_SALT = 'myit-agent-v4-salt-2025';

const getCryptoKey = async () => {
  const raw = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen.colorDepth,
    CRYPTO_SALT,
  ].join('|');
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return crypto.subtle.importKey(
    'raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
};

const encryptText = async (plaintext) => {
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuf), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch { return null; }
};

const decryptText = async (base64) => {
  try {
    const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const cipherBuf = combined.slice(12);
    const key = await getCryptoKey();
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
    return new TextDecoder().decode(plainBuf);
  } catch { return null; }
};

const safeStorage = {
  get: async (k) => {
    try {
      const v = localStorage.getItem(k);
      if (!v) return null;
      if (v.length < 100) { try { return atob(v); } catch {} }
      return await decryptText(v);
    } catch { return null; }
  },
  set: async (k, v) => {
    try {
      const encrypted = await encryptText(v);
      if (!encrypted) return false;
      localStorage.setItem(k, encrypted);
      return true;
    } catch { return false; }
  },
  remove: (k) => { try { localStorage.removeItem(k); return true; } catch { return false; } },
};

const sanitizeErrorMsg = (msg) =>
  (msg || '')
    .replace(/AIza[A-Za-z0-9\-_.]{10,}/g, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9\-_]{20,}/g, '[REDACTED]');

// ════════════════════════════════════════════════════════════════════════════
// ✅ KB 자동 확장 스토리지
// ════════════════════════════════════════════════════════════════════════════
const KB_LOCAL_KEY = 'kb_local_v1';

const getLocalKB = (lang) => {
  try {
    const raw = localStorage.getItem(KB_LOCAL_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return (all[lang] || []);
  } catch { return []; }
};

const saveLocalKBEntry = (entry, lang) => {
  try {
    const raw = localStorage.getItem(KB_LOCAL_KEY);
    const all = raw ? JSON.parse(raw) : { ko: [], en: [] };
    const existing = all[lang] || [];
    if (existing.find(e => e.id === entry.id)) return false;
    all[lang] = [entry, ...existing].slice(0, 50);
    localStorage.setItem(KB_LOCAL_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
};

const exportLocalKB = (lang) => {
  try {
    const raw = localStorage.getItem(KB_LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw)[lang] || [];
  } catch { return []; }
};

// ════════════════════════════════════════════════════════════════════════════
// KB 데이터
// ════════════════════════════════════════════════════════════════════════════
const kbData = { ko: kbKo, en: kbEn };

const dict = {
  ko: {
    title: "My IT Agent", subtitle: "Infra Troubleshooting",
    initMsg: "안녕하세요. 인프라 트러블슈팅 AI 에이전트입니다.\nLLM 버전 선택 후 API Key를 등록하면 AI 분석 기능을 사용할 수 있습니다.\nKB 기반 카테고리 조회는 API Key 등록이 필요 없습니다.",
    urgencyBtn: "🚨 긴급 장애 (Simulate)", agenticBtn: "🔎 장애 로그 분석 에이전트",
    agenticTitle: "긴급 로그 분석 워크플로우", statsTitle: "KB 장애 통계",
    finopsTitle: "FinOps 토큰 모니터링", totalUsage: "총 사용량",
    inputLabel: "입력", outputLabel: "출력",
    lastLabel: "Last:", actionReq: "Action Required", cliRun: "CLI 트러블슈팅 실행",
    ongoingTitle: "진행 중인 장애", noOngoing: "현재 진행 중인 장애가 없습니다.",
    sysAnal: "System Analysis", agent: "AI Agent", you: "You",
    catHelp: "자주 발생하는 장애 카테고리",
    inputPlaceholder: "장애 증상이나 기술 질문을 자유롭게 입력하세요...",
    rcaGen: "원인(RCA) 분석 및 조치 방안 생성 중...",
    simRcaMsg: "🚨 **[긴급 장애 감지]**\n장애: **{title}**\n\n<RCA>{rootCause}</RCA>\n\nCLI 버튼을 클릭하여 복구를 진행하세요.",
    cachedReply: "**[{title}]** 분석 가이드\n\n<RCA>{rootCause}</RCA>\n<RES>{resolution}</RES>\n\n좌측 **[CLI 트러블슈팅 실행]** 버튼을 클릭하세요.",
    cliContent: "복구 파이프라인 시작\n\n" + TBQ + "bash\n{cliMock}\n" + TBQ + "\n\n{insight}",
    cacheHit: "Last: 0 토큰 (Cache Hit)", apiHit: "Last: {tokens} 토큰 (API 호출)",
    dailyTrend: "일별 추이", monthlyTrend: "월별 추이", dailyBtn: "일별", monthlyBtn: "월별",
    categories: { "OS / GUI":"OS 장애","Cloud / Network":"네트워크 장애","Storage / Middleware":"스토리지 장애","Cloud / Kubernetes":"K8s 장애","Cloud / IaC":"IaC 장애","Database / HA":"DB 장애","Database / Disaster Recovery":"DB 장애","DevOps / Tooling":"DevOps 장애","Middleware / Web-WAS":"웹/미들웨어" },
    apiSettingTitle: "LLM 설정 (BYOK)",
    modelLabel: "모델 선택",
    saveBtn: "저장", apiKeyLinked: "연동 완료", resetBtn: "재설정",
    apiKeyInvalidFormat: "유효하지 않은 API Key 형식입니다. 프로바이더별 키 형식을 확인해주세요.",
    apiKeySaveError: "API Key 저장 중 오류가 발생했습니다.",
    apiKeyStorageNotice: "API Key는 내 브라우저에만 저장됩니다.",
    apiKeyAuthError: "API Key가 유효하지 않거나 권한이 없습니다. 키를 다시 확인해주세요.",
    apiKeyMissingError: "우측 상단 버튼에서 API Key를 먼저 등록해주세요.",
    apiKeyMissingAlert: "⚠️ API Key가 필요합니다. 우측 상단에서 등록해주세요.",
    clearChat: "대화 초기화",
    speechNotSupported: "이 브라우저는 음성 인식을 지원하지 않습니다.",
    voiceMuteToggle: "음성 출력 토글", listening: "듣고 있습니다...",
    agentLogDump: "에러 로그 덤프",
    agentLogPlaceholder: "에러 로그, 알람 메시지를 붙여넣으세요...",
    agentAnalyzing: "AI 분석 중...", agentAnalyzeBtn: "분석 및 스크립트 생성",
    agentRootCause: "원인", agentResolution: "해결", agentAutoScript: "자동화 복구 스크립트",
    agentPreview: "조치 사항 프리뷰", agentApproveReq: "대상 서버에 스크립트를 푸시하시겠습니까?",
    agentApproveDesc: "AWX Webhook 트리거를 통한 원격 복구 파이프라인",
    agentExecuteBtn: "원클릭 원격 복구 승인", agentExecuting: "인프라 복구 진행 중...",
    agentSuccess: "조치 성공 (정상화 완료)", backToChat: "채팅으로 돌아가기",
    adminMode: "관리자 권한 (Admin Mode)", unauthorizedBtn: "권한 없음 (Admin Only)",
    chatLabel: "채팅", agentLabel: "로그 분석",
    shellDownload: "Shell 다운로드", ansibleDownload: "Ansible 다운로드", transTitle: "번역",
    unknownLogError: "알 수 없는 로그입니다. AI 동적 분석을 위해 API Key를 등록해주세요.",
    apiRequestFailed: "API 요청에 실패했습니다.", aiAnalysisError: "AI 분석 중 오류:",
    aiSelectLabel: "AI 선택",
    saveAndStart: "저장 & 시작",
    dangerCmdTitle: "⚠️ 위험 명령어 감지",
    dangerCmdBody: "이 명령어는 데이터를 영구 삭제할 수 있습니다.\n리스크를 충분히 검토한 후 사용하세요.",
    dangerCmdConfirm: "위험성을 인지했습니다",
    dangerCmdCancel: "취소",
    securityBadge: "🔒 로그 보안 보장",
    securityNotice: "에러 로그의 민감 정보(IP, Credential)는 브라우저에서 자동 마스킹 처리 후 AI에 전달됩니다. 모델 학습에 사용되지 않습니다.",
    logMaskedNotice: "민감 정보가 자동 마스킹되었습니다.",
  },
  en: {
    title: "My IT Agent", subtitle: "Infra Troubleshooting",
    initMsg: "Hello, I'm the Infra Troubleshooting AI Agent.\nSelect your LLM and register an API Key to enable AI analysis.\nKB-based category lookups are always free — no API Key needed.",
    urgencyBtn: "🚨 Critical Alert (Simulate)", agenticBtn: "🔎 Log Analysis Agent",
    agenticTitle: "Agentic Auto-Remediation Workflow", statsTitle: "KB Incident Stats",
    finopsTitle: "FinOps Token Monitor", totalUsage: "Total Usage",
    inputLabel: "Input", outputLabel: "Output",
    lastLabel: "Last:", actionReq: "Action Required", cliRun: "Run CLI Troubleshooting",
    ongoingTitle: "Ongoing Incidents", noOngoing: "No ongoing incidents.",
    sysAnal: "System Analysis", agent: "AI Agent", you: "You",
    catHelp: "Frequent Incident Categories",
    inputPlaceholder: "Describe incident symptoms or tech queries freely...",
    rcaGen: "Analyzing RCA & Generating Resolution...",
    simRcaMsg: "🚨 **[Critical Incident Detected]**\nIncident: **{title}**\n\n<RCA>{rootCause}</RCA>\n\nClick the CLI button to proceed with recovery.",
    cachedReply: "Analysis guide for **[{title}]**\n\n<RCA>{rootCause}</RCA>\n<RES>{resolution}</RES>\n\nClick **[Run CLI Troubleshooting]** on the left.",
    cliContent: "Initiating recovery pipeline\n\n" + TBQ + "bash\n{cliMock}\n" + TBQ + "\n\n{insight}",
    cacheHit: "Last: 0 Tokens (Cache Hit)", apiHit: "Last: {tokens} Tokens (API Call)",
    dailyTrend: "Daily Trend", monthlyTrend: "Monthly Trend", dailyBtn: "Daily", monthlyBtn: "Monthly",
    categories: { "OS / GUI":"OS Issue","Cloud / Network":"Network Issue","Storage / Middleware":"Storage Issue","Cloud / Kubernetes":"K8s Issue","Cloud / IaC":"IaC Issue","Database / HA":"DB Issue","Database / Disaster Recovery":"DB Issue","DevOps / Tooling":"DevOps Issue","Middleware / Web-WAS":"Web/Middleware" },
    apiSettingTitle: "LLM Settings (BYOK)",
    modelLabel: "Select Version",
    saveBtn: "Save", apiKeyLinked: "Linked", resetBtn: "Reset",
    apiKeyMissingError: "Please register your API Key using the button in the top-right.",
    apiKeyMissingAlert: "⚠️ API Key required. Register via the top-right button.",
    apiKeyInvalidFormat: "Invalid API Key format. Check the format for your provider.",
    apiKeySaveError: "Error saving API Key.",
    apiKeyStorageNotice: "Your API Key is stored only in this browser.",
    apiKeyAuthError: "Invalid API Key or insufficient permissions. Please check your key.",
    clearChat: "Clear Chat",
    speechNotSupported: "Speech recognition not supported in this browser.",
    voiceMuteToggle: "Toggle Voice Output", listening: "Listening...",
    agentLogDump: "Error Log Dump",
    agentLogPlaceholder: "Paste the error log or alert message here...",
    agentAnalyzing: "AI Analyzing...", agentAnalyzeBtn: "Analyze & Generate Script",
    agentRootCause: "RCA", agentResolution: "Fix", agentAutoScript: "Automation Recovery Script",
    agentPreview: "Action Preview", agentApproveReq: "Push script to target servers?",
    agentApproveDesc: "Remote recovery pipeline via AWX Webhook trigger",
    agentExecuteBtn: "Approve One-Click Recovery", agentExecuting: "Executing recovery...",
    agentSuccess: "Remediation Successful", backToChat: "Back to Chat",
    adminMode: "Admin Privilege Mode", unauthorizedBtn: "Unauthorized (Admin Only)",
    chatLabel: "Chat", agentLabel: "Agent",
    shellDownload: "Download Shell", ansibleDownload: "Download Ansible", transTitle: "Translate",
    unknownLogError: "Unknown error log. Register an API Key for dynamic AI analysis.",
    apiRequestFailed: "API request failed.", aiAnalysisError: "AI analysis error:",
    aiSelectLabel: "Select AI",
    saveAndStart: "Save & Start",
    dangerCmdTitle: "⚠️ Dangerous Command Detected",
    dangerCmdBody: "This command can permanently delete data.\nPlease review all risks carefully before proceeding.",
    dangerCmdConfirm: "I understand the risk",
    dangerCmdCancel: "Cancel",
    securityBadge: "🔒 Log Security Guaranteed",
    securityNotice: "Sensitive data (IPs, credentials) in your logs is automatically masked in your browser before being sent to AI. Never used for model training.",
    logMaskedNotice: "Sensitive data was automatically masked.",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// 메시지 파싱 & 렌더링 컴포넌트
// ════════════════════════════════════════════════════════════════════════════
const parseMessageBlocks = (text) => {
  if (!text) return [];
  const blocks = [];
  const regex = new RegExp(`(<RCA>([\\s\\S]*?)<\\/RCA>|<RES>([\\s\\S]*?)<\\/RES>|${TBQ}(bash|sh|yaml|yml|hcl|json)?\\n([\\s\\S]*?)${TBQ})`, 'g');
  let lastIdx = 0, match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) blocks.push({ type: 'text', content: text.substring(lastIdx, match.index) });
    if (match[1].startsWith('<RCA>')) blocks.push({ type: 'rca', content: match[2].trim() });
    else if (match[1].startsWith('<RES>')) blocks.push({ type: 'res', content: match[3].trim() });
    else if (match[1].startsWith(TBQ)) {
      const l = (match[4] || '').toLowerCase();
      blocks.push(['yaml','yml','hcl','json'].includes(l) ? { type: 'script', lang: l, content: match[5].trim() } : { type: 'cli', content: match[5].trim() });
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) blocks.push({ type: 'text', content: text.substring(lastIdx) });
  return blocks;
};

const renderFormattedText = (text) => {
  if (!text) return null;
  return text.split(new RegExp(`(\\*\\*.*?\\*\\*|${BQ}.*?${BQ})`, 'g')).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-indigo-600 dark:text-indigo-400">{part.slice(2,-2)}</strong>;
    if (part.startsWith(BQ) && part.endsWith(BQ)) return <code key={i} className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1,-1)}</code>;
    return <span key={i}>{part}</span>;
  });
};

const TextStream = ({ text, animate, onDone, scrollRef }) => {
  const [d, setD] = useState(animate ? '' : text);
  const fin = useRef(!animate);
  useEffect(() => {
    if (fin.current || !animate) { setD(text); if (onDone && animate) onDone(); return; }
    let i = 0;
    const t = setInterval(() => { setD(text.slice(0,i)); scrollRef.current?.scrollIntoView({behavior:'auto',block:'end'}); i+=3; if(i>=text.length){setD(text);fin.current=true;clearInterval(t);if(onDone)onDone();} }, 10);
    return () => clearInterval(t);
  }, [animate, text, onDone, scrollRef]);
  return <div className="mb-3 leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">{renderFormattedText(d)}</div>;
};

const RcaCard = ({ text, animate, onDone, scrollRef }) => {
  const [d, setD] = useState(animate ? '' : text);
  const fin = useRef(!animate);
  useEffect(() => {
    if (fin.current || !animate) { setD(text); if (onDone && animate) onDone(); return; }
    let i = 0;
    const t = setInterval(() => { setD(text.slice(0,i)); scrollRef.current?.scrollIntoView({behavior:'auto',block:'end'}); i+=3; if(i>=text.length){setD(text);fin.current=true;clearInterval(t);if(onDone)onDone();} }, 10);
    return () => clearInterval(t);
  }, [animate, text, onDone, scrollRef]);
  return <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded-r-xl p-4 my-3 shadow-sm"><div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-wider"><AlertCircle className="w-3.5 h-3.5"/>Root Cause Analysis</div><div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{renderFormattedText(d)}</div></div>;
};

const ResCard = ({ text, animate, onDone, scrollRef }) => {
  const [d, setD] = useState(animate ? '' : text);
  const fin = useRef(!animate);
  useEffect(() => {
    if (fin.current || !animate) { setD(text); if (onDone && animate) onDone(); return; }
    let i = 0;
    const t = setInterval(() => { setD(text.slice(0,i)); scrollRef.current?.scrollIntoView({behavior:'auto',block:'end'}); i+=3; if(i>=text.length){setD(text);fin.current=true;clearInterval(t);if(onDone)onDone();} }, 10);
    return () => clearInterval(t);
  }, [animate, text, onDone, scrollRef]);
  return <div className="bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 rounded-r-xl p-4 my-3 shadow-sm"><div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider"><CheckCircle className="w-3.5 h-3.5"/>Resolution</div><div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{renderFormattedText(d)}</div></div>;
};

const CLIStream = ({ code, animate, onDone, scrollRef, lang }) => {
  const lines = code.trim().split('\n');
  const [vis, setVis] = useState(animate ? [] : lines);
  const [showDanger, setShowDanger] = useState(false);
  const [dangerAcked, setDangerAcked] = useState(false);
  const fin = useRef(!animate);
  const t = dict[lang] || dict['ko'];

  useEffect(() => {
    if (fin.current || !animate) { setVis(lines); if(onDone&&animate)onDone(); return; }
    let i = 0;
    const interval = setInterval(() => {
      setVis(lines.slice(0,i+1));
      scrollRef.current?.scrollIntoView({behavior:'auto',block:'end'});
      i++;
      if(i>=lines.length){fin.current=true;clearInterval(interval);if(onDone)onDone();}
    }, 280);
    return () => clearInterval(interval);
  }, [animate, code, onDone, scrollRef]);

  useEffect(() => {
    if (!dangerAcked && isDangerousCommand(code)) {
      setShowDanger(true);
    }
  }, [code, dangerAcked]);

  const rl = (l) => {
    if (l.startsWith('[ERROR]')) return <span className="text-red-400 font-bold">{l}</span>;
    if (l.startsWith('[INFO]')) return <span className="text-blue-400">{l}</span>;
    if (l.startsWith('[SUCCESS]')) return <span className="text-emerald-400 font-bold">{l}</span>;
    if (l.startsWith('$')) return <><span className="text-indigo-400 mr-2 select-none">$</span><span className="text-green-300">{l.substring(1)}</span></>;
    if (l.startsWith('>')) return <><span className="text-indigo-400 mr-2 select-none">{'>'}</span><span className="text-green-300">{l.substring(1)}</span></>;
    return <span className="text-slate-300">{l}</span>;
  };

  return (
    <div className="my-3">
      {showDanger && !dangerAcked && (
        <div className="mb-3 bg-red-950/60 border-2 border-red-500/70 rounded-xl p-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0"/>
            <span className="text-sm font-bold text-red-300">{t.dangerCmdTitle}</span>
          </div>
          <p className="text-xs text-red-200/80 leading-relaxed whitespace-pre-line mb-3">{t.dangerCmdBody}</p>
          <div className="flex gap-2">
            <button onClick={()=>{setDangerAcked(true);setShowDanger(false);}}
              className="flex-1 text-xs font-bold py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">
              {t.dangerCmdConfirm}
            </button>
            <button onClick={()=>setShowDanger(false)}
              className="flex-1 text-xs font-bold py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
              {t.dangerCmdCancel}
            </button>
          </div>
        </div>
      )}
      <div className="bg-[#0c0c0c] text-slate-300 p-4 rounded-xl font-mono text-xs shadow-2xl border border-slate-700/80">
        <div className="flex gap-1.5 mb-3 border-b border-slate-800 pb-2.5 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"/>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"/>
          <span className="text-slate-500 text-[10px] ml-2">root@l3-master:~</span>
          {isDangerousCommand(code) && (
            <span className="ml-auto text-[9px] font-bold text-red-400 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5"/>DANGER
            </span>
          )}
        </div>
        <div className="space-y-1 break-all">
          {vis.map((l,i) => <div key={i} className="flex whitespace-pre-wrap">{rl(l)}</div>)}
          {animate&&vis.length<lines.length&&<div className="flex"><span className="text-indigo-400 mr-2">$</span><span className="w-2 h-3.5 bg-slate-400 animate-pulse"/></div>}
        </div>
      </div>
    </div>
  );
};

const ScriptStream = ({ code, lang: sl, animate, onDone, scrollRef }) => {
  const lines = code.trim().split('\n');
  const [vis, setVis] = useState(animate ? [] : lines);
  const fin = useRef(!animate);
  useEffect(() => {
    if (fin.current || !animate) { setVis(lines); if(onDone&&animate)onDone(); return; }
    let i = 0;
    const t = setInterval(() => { setVis(lines.slice(0,i+1)); scrollRef.current?.scrollIntoView({behavior:'auto',block:'end'}); i++; if(i>=lines.length){fin.current=true;clearInterval(t);if(onDone)onDone();} }, 180);
    return () => clearInterval(t);
  }, [animate, code, onDone, scrollRef]);
  return <div className="bg-[#1e1e1e] text-slate-300 p-4 rounded-xl font-mono text-xs shadow-2xl border border-slate-700/80 my-3"><div className="flex gap-2 mb-3 border-b border-slate-700 pb-2.5 items-center"><Cpu className="w-3.5 h-3.5 text-indigo-400"/><span className="text-slate-400 text-[10px] font-sans font-bold uppercase tracking-widest">{sl||'Script'} Automation</span></div><div className="space-y-0.5 break-all">{vis.map((l,i)=><div key={i} className="whitespace-pre-wrap">{l}</div>)}{animate&&vis.length<lines.length&&<div className="w-2 h-3.5 bg-slate-400 animate-pulse mt-1"/>}</div></div>;
};

const SequenceRenderer = ({ msgId, blocks, isNew, lang, scrollRef, onComplete }) => {
  const [idx, setIdx] = useState(isNew ? 0 : blocks.length);
  useEffect(() => { if (!isNew) setIdx(blocks.length); }, [isNew, blocks.length]);
  useEffect(() => { if (isNew && idx >= blocks.length && onComplete) onComplete(msgId); }, [idx, blocks.length, isNew, msgId, onComplete]);
  return <div className="space-y-1">{blocks.map((b, i) => {
    if (i > idx) return null;
    const a = isNew && i === idx;
    const next = () => setIdx(p => p+1);
    if (b.type==='text') return <TextStream key={i} text={b.content} animate={a} onDone={next} scrollRef={scrollRef}/>;
    if (b.type==='rca') return <RcaCard key={i} text={b.content} animate={a} onDone={next} scrollRef={scrollRef}/>;
    if (b.type==='res') return <ResCard key={i} text={b.content} animate={a} onDone={next} scrollRef={scrollRef}/>;
    if (b.type==='cli') return <CLIStream key={i} code={b.content} animate={a} onDone={next} scrollRef={scrollRef} lang={lang}/>;
    if (b.type==='script') return <ScriptStream key={i} code={b.content} lang={b.lang} animate={a} onDone={next} scrollRef={scrollRef}/>;
    return null;
  })}</div>;
};

const TokenTrendChart = ({ history, lang, currentTokens }) => {
  const [view, setView] = useState('daily');
  const t = dict[lang];
  const getData = () => {
    const data = [], today = new Date();
    if (view === 'daily') {
      for (let i=6;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);const ds=d.toISOString().split('T')[0];let v=history[ds]||0;if(i===0&&currentTokens>0)v+=currentTokens;data.push({label:`${d.getMonth()+1}/${d.getDate()}`,value:v});}
    } else {
      for(let i=5;i>=0;i--){const d=new Date(today.getFullYear(),today.getMonth()-i,1);const ms=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;data.push({label:lang==='ko'?`${d.getMonth()+1}월`:d.toLocaleString('en-US',{month:'short'}),value:0,key:ms});}
      Object.keys(history).forEach(ds=>{const ms=ds.substring(0,7);const tgt=data.find(m=>m.key===ms);if(tgt)tgt.value+=history[ds];});
      const cms=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;const cm=data.find(m=>m.key===cms);if(cm&&currentTokens>0)cm.value+=currentTokens;
    }
    return data;
  };
  const chartData = getData();
  const maxVal = Math.max(...chartData.map(d=>d.value), 1000);
  return <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
    <div className="flex justify-between items-center mb-3">
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{view==='daily'?t.dailyTrend:t.monthlyTrend}</span>
      <div className="flex gap-2 text-[9px] font-bold uppercase">
        <button onClick={()=>setView('daily')} className={view==='daily'?'text-indigo-500':'text-slate-400'}>{t.dailyBtn}</button>
        <span className="text-slate-300">|</span>
        <button onClick={()=>setView('monthly')} className={view==='monthly'?'text-indigo-500':'text-slate-400'}>{t.monthlyBtn}</button>
      </div>
    </div>
    <div className="flex items-end h-16 gap-1 mt-3">
      {chartData.map((d,i)=>{const h=(d.value/maxVal)*100;return <div key={i} className="flex flex-col items-center flex-1 group relative h-full justify-end">
        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 pointer-events-none">{d.value.toLocaleString()}</div>
        <div className="w-full bg-slate-200 dark:bg-slate-800/50 rounded-t-sm h-full flex items-end"><div className="w-full bg-indigo-500/80 dark:bg-indigo-500 rounded-t-sm transition-all duration-700 group-hover:bg-indigo-400" style={{height:`${Math.max(h,2)}%`}}/></div>
        <span className="text-[9px] text-slate-500 mt-1.5">{d.label}</span>
      </div>;})}
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════════
// ✅ [MAIN APP]
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [lang, setLang] = useState('ko');
  const [theme, setTheme] = useState('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [logInput, setLogInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [matchedSolution, setMatchedSolution] = useState(null);
  const [executionStatus, setExecutionStatus] = useState('idle');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('USER');

  const [llmProvider, setLlmProvider] = useState(() => {
    try { return localStorage.getItem('llm_provider') || 'gemini'; } catch { return 'gemini'; }
  });

  const [apiKeys, setApiKeys] = useState({ gemini:'', openai:'', claude:'' });
  useEffect(() => {
    const loadKeys = async () => {
      const keys = {};
      for (const p of Object.keys(PROVIDER_CONFIG)) {
        keys[p] = (await safeStorage.get(PROVIDER_CONFIG[p].storageKey)) || '';
      }
      setApiKeys(keys);
    };
    loadKeys();
  }, []);

  const [localKbEntries, setLocalKbEntries] = useState({ ko: [], en: [] });
  useEffect(() => {
    setLocalKbEntries({ ko: getLocalKB('ko'), en: getLocalKB('en') });
  }, []);

  const [selectedModels, setSelectedModels] = useState(() => {
    try {
      const saved = localStorage.getItem('selected_models_v2');
      return saved ? { ...DEFAULT_MODELS, ...JSON.parse(saved) } : { ...DEFAULT_MODELS };
    } catch { return { ...DEFAULT_MODELS }; }
  });

  const [apiKeyInputVal, setApiKeyInputVal] = useState('');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  const t = dict[lang];

  useEffect(() => {
    setMatchedSolution(prev => {
      if (!prev) return null;
      return kbData[lang].find(item => item.id === prev.id) || prev;
    });
  }, [lang]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const [messages, setMessages] = useState(() => {
    try { const s = sessionStorage.getItem('chat_history'); return s ? JSON.parse(s).map(m=>({...m,isNew:false})) : []; } catch { return []; }
  });
  useEffect(() => { if (messages.length===0) setMessages([{id:'init-1',role:'assistant',type:'INIT',isNew:false}]); }, []);
  useEffect(() => { if (messages.length>0) { try { sessionStorage.setItem('chat_history',JSON.stringify(messages.map(m=>({...m,isNew:false})))); } catch {} } }, [messages]);

  const [tokenHistory, setTokenHistory] = useState(() => {
    try { const s=localStorage.getItem('token_history'); return s?JSON.parse(s):{}; } catch { return {}; }
  });
  const [tokens, setTokens] = useState({input:0,output:0,transKo:0,transEn:0,chat:0,agent:0,total:0,type:'NONE',count:0});

  const markMessageAsOld = useCallback((id) => setMessages(prev=>prev.map(m=>m.id===id?{...m,isNew:false}:m)), []);

  const updateTokenHistory = useCallback((n) => {
    if (n<=0) return;
    const today = new Date().toISOString().split('T')[0];
    setTokenHistory(prev => {
      const updated = {...prev,[today]:(prev[today]||0)+n};
      try { localStorage.setItem('token_history',JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKeyInputVal.trim();
    if (!validateApiKey(trimmed, llmProvider)) { alert(t.apiKeyInvalidFormat); return; }
    const saved = await safeStorage.set(PROVIDER_CONFIG[llmProvider].storageKey, trimmed);
    if (!saved) { alert(t.apiKeySaveError); return; }
    try { localStorage.setItem('llm_provider', llmProvider); } catch {}
    setApiKeys(prev => ({...prev,[llmProvider]:trimmed}));
    setApiKeyInputVal('');
    setIsApiKeyVisible(false);
  }, [apiKeyInputVal, llmProvider, t]);

  const handleResetApiKey = useCallback(() => {
    safeStorage.remove(PROVIDER_CONFIG[llmProvider].storageKey);
    setApiKeys(prev => ({...prev,[llmProvider]:''}));
    setApiKeyInputVal('');
    setIsApiKeyVisible(false);
  }, [llmProvider]);

  const handleModelChange = useCallback((model) => {
    const updated = {...selectedModels, [llmProvider]: model};
    setSelectedModels(updated);
    try { localStorage.setItem('selected_models_v2', JSON.stringify(updated)); } catch {}
  }, [selectedModels, llmProvider]);

  const fetchLLM = useCallback(async ({ messages: msgs, systemPrompt, isJsonMode = false }) => {
    const currentKey = apiKeys[llmProvider]?.trim();
    if (!currentKey) throw new Error(t.apiKeyMissingError);

    const todayStr = new Date().toISOString().split('T')[0];
    if ((tokenHistory[todayStr]||0) > DAILY_TOKEN_LIMIT) {
      throw new Error(lang==='ko' ? `일일 사용량 한도(${DAILY_TOKEN_LIMIT.toLocaleString()} Token) 초과` : `Daily usage limit exceeded.`);
    }

    for (let attempt=0; attempt<3; attempt++) {
      try {
        const response = await fetch(`/api/${llmProvider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userApiKey: currentKey,
            model: selectedModels[llmProvider],
            messages: msgs,
            systemPrompt,
            isJsonMode,
          }),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) throw new Error(t.apiKeyAuthError);
          if ((response.status===429||response.status===503) && attempt<2) {
            await new Promise(r=>setTimeout(r,2000*Math.pow(2,attempt)));
            continue;
          }
          const errData = await response.json().catch(()=>({}));
          throw new Error(sanitizeErrorMsg(errData.error || t.apiRequestFailed));
        }

        return await response.json();
      } catch (err) {
        if (attempt===2 || err.message===t.apiKeyAuthError || err.message===t.apiKeyMissingError) throw err;
      }
    }
    throw new Error(lang==='ko'?'API 타임아웃: 서버가 응답하지 않습니다.':'API timeout.');
  }, [llmProvider, apiKeys, selectedModels, tokenHistory, t, lang]);

  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeCLIAction, setActiveCLIAction] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLlmSettingsOpen, setIsLlmSettingsOpen] = useState(false);
  const [logMaskedNotice, setLogMaskedNotice] = useState(false);
  const [llmStep, setLlmStep] = useState(0);
  const messagesEndRef = useRef(null);
  const currentInputRef = useRef('');
  const recognitionRef = useRef(null);
  const handleSendMessageRef = useRef(null);

  const wakeUpSpeechEngine = () => { try { if('speechSynthesis'in window){const u=new SpeechSynthesisUtterance('');u.volume=0;window.speechSynthesis.speak(u);} }catch{} };
  const speakText = useCallback((txt) => {
    if (isAudioMuted) return;
    try {
      if (!('speechSynthesis'in window)) return;
      window.speechSynthesis.resume(); window.speechSynthesis.cancel();
      let clean = txt.replace(new RegExp(`${TBQ}[\\s\\S]*?${TBQ}`,'g'),lang==='ko'?' 코드 블록 참조. ':' See code block. ')
        .replace(/<[^>]+>/g,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(new RegExp(BQ,'g'),'');
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang==='ko'?'ko-KR':'en-US'; u.rate=1.1;
      window.speechSynthesis.speak(u);
    }catch{}
  }, [isAudioMuted, lang]);

  const toggleListening = () => {
    try {
      wakeUpSpeechEngine();
      if (isListening) {
        setIsListening(false);
        const txt = currentInputRef.current;
        if (recognitionRef.current){recognitionRef.current.onresult=null;recognitionRef.current.stop();}
        if (txt.trim()&&handleSendMessageRef.current) handleSendMessageRef.current(txt);
        return;
      }
      setIsAudioMuted(false);
      const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
      if (!SR){alert(t.speechNotSupported);return;}
      const rec=new SR(); recognitionRef.current=rec;
      rec.lang=lang==='ko'?'ko-KR':'en-US'; rec.continuous=true; rec.interimResults=true;
      const base=currentInputRef.current?currentInputRef.current+' ':'';
      rec.onstart=()=>setIsListening(true);
      rec.onresult=(e)=>{let s='';for(let i=0;i<e.results.length;i++)s+=e.results[i][0].transcript;const v=base+s;currentInputRef.current=v;setInput(v);};
      rec.onerror=()=>setIsListening(false); rec.onend=()=>setIsListening(false);
      rec.start();
    }catch{setIsListening(false);}
  };

  const categoryCounts = kbData[lang].reduce((acc,cur)=>{const n=t.categories[cur.category]||cur.category;acc[n]=(acc[n]||0)+1;return acc;},{});
  const maxCatCount = Math.max(...Object.values(categoryCounts));

  const translateMessage = async (text, targetLang, msgId) => {
    if (!apiKeys[llmProvider]) return;
    try {
      const res = await fetchLLM({
        messages:[{role:'user',content:`Translate to ${targetLang==='ko'?'Korean':'English'} (keep IT terms in English). Return ONLY the translated text.\n\n${text}`}],
        systemPrompt:'You are an expert IT translator. Provide direct translation without markdown.',
      });
      if (res.text) {
        setMessages(prev=>prev.map(m=>m.id===msgId?{...m,content:{...m.content,[targetLang]:res.text.trim()}}:m));
        if (res.usage.total>0) {
          setTokens(prev=>({...prev,total:prev.total+res.usage.total,transKo:targetLang==='ko'?prev.transKo+res.usage.total:prev.transKo,transEn:targetLang==='en'?prev.transEn+res.usage.total:prev.transEn,chat:prev.chat+res.usage.total}));
          updateTokenHistory(res.usage.total);
        }
      }
    }catch{}
  };

  const handleCategoryClick = (catName) => {
    wakeUpSpeechEngine();
    const issues = kbData[lang].filter(item=>(t.categories[item.category]||item.category)===catName);
    if (!issues.length) return;
    const item = issues[Math.floor(Math.random()*issues.length)];
    const uid = Date.now()+'-u';
    setMessages(prev=>[...prev,{id:uid,role:'user',type:'CATEGORY_PROMPT',category:item.category,isNew:false}]);
    setTokens(prev=>({...prev,type:'CACHE',count:0}));
    setTimeout(()=>{
      const aid = Date.now()+'-a';
      setMessages(prev=>[...prev,{id:aid,role:'assistant',type:'CACHED_RCA',caseId:item.id,isNew:true}]);
      setActiveCLIAction(item.id); setIsMobileMenuOpen(false);
      if (!isAudioMuted) speakText(t.cachedReply.replace('{title}',item.title).replace('{rootCause}',item.rootCause).replace('{resolution}',item.resolution));
    },400);
  };

  const handleSendMessage = async (userText) => {
    if (!userText.trim()||isLoading) return;
    wakeUpSpeechEngine();
    if (!apiKeys[llmProvider]) {
      const eid=Date.now()+'-nokey';
      setMessages(prev=>[...prev,{id:eid,role:'assistant',type:'CUSTOM_CHAT',content:{[lang]:`⚠️ ${t.apiKeyMissingError}`},originalLang:lang,isNew:false}]);
      return;
    }
    setInput(''); currentInputRef.current='';
    const uid=Date.now()+'-u';
    setMessages(prev=>[...prev,{id:uid,role:'user',type:'CUSTOM_CHAT',content:{[lang]:userText},originalLang:lang,isNew:false}]);
    setIsLoading(true);
    const targetLang=lang==='ko'?'en':'ko';
    await translateMessage(userText,targetLang,uid);

    const systemPrompt=`당신은 인프라 트러블슈팅 AI 에이전트입니다.
[지침]:
1. 기술적으로 100% 정확한지 교차 검증하세요.
2. 현재 언어(${lang==='ko'?'한국어':'English'})로 전문적으로 답변하세요.

[상황 A: KB와 일치하는 경우]
- 답변 첫 줄에 "[MATCHED_KB_ID: 해당ID]" 출력
- <RCA>...</RCA> 및 <RES>...</RES> 태그 사용
- 코드 블록 출력 금지
- 마지막에 "상세 로그는 **[${t.cliRun}]** 버튼을 클릭하세요." 안내

[상황 B: 새로운 장애/일반 질문]
- MATCHED_KB_ID 태그 출력 금지
- <RCA>, <RES> 태그로 설명
- 스크립트는 코드 블록 사용
- "버튼을 클릭하세요" 안내 금지

[Knowledge Base]:
${kbData[lang].map(m=>`ID: ${m.id}\nTitle: ${m.title}\nRoot Cause: ${m.rootCause}\nResolution: ${m.resolution}`).join('\n\n')}`;

    const histMsgs = messages
      .filter(m=>(m.role==='user'||m.role==='assistant')&&m.type==='CUSTOM_CHAT')
      .map(m=>({role:m.role,content:m.content[lang]||m.content[m.originalLang]||''}));
    histMsgs.push({role:'user',content:`<<<START>>>\n${userText}\n<<<END>>>`});

    try {
      const result = await fetchLLM({messages:histMsgs,systemPrompt});
      let reply = result.text||'No response generated.';
      const matchReg=/\[MATCHED_KB_ID:\s*([A-Z0-9-]+)\]/i;
      const match=reply.match(matchReg);
      let matchedId=null;
      if(match){matchedId=match[1];reply=reply.replace(matchReg,'').trim();}
      if(result.usage.total>0){
        setTokens(prev=>({...prev,input:prev.input+result.usage.input,output:prev.output+result.usage.output,total:prev.total+result.usage.total,chat:prev.chat+result.usage.total,type:'API',count:result.usage.total}));
        updateTokenHistory(result.usage.total);
      }
      const aid=Date.now()+'-a';
      setMessages(prev=>[...prev,{id:aid,role:'assistant',type:'CUSTOM_CHAT',content:{[lang]:reply},originalLang:lang,isNew:true}]);
      translateMessage(reply,targetLang,aid);
      speakText(reply);
      setActiveCLIAction(matchedId||null);
    }catch(err){
      const eid=Date.now()+'-e';
      setMessages(prev=>[...prev,{id:eid,role:'assistant',type:'CUSTOM_CHAT',content:{[lang]:`⚠️ Error: ${sanitizeErrorMsg(err.message)}`},originalLang:lang,isNew:false}]);
    }finally{setIsLoading(false);}
  };

  useEffect(()=>{handleSendMessageRef.current=handleSendMessage;},[handleSendMessage]);

  const triggerSimulation = () => {
    if(isSimulating) return;
    setIsSimulating(true); setIsMobileMenuOpen(false);
    const tc=kbData[lang][Math.floor(Math.random()*kbData[lang].length)];
    const cl=t.categories[tc.category]||tc.category;
    const incidents=[
      {id:`INC-${Date.now()}-1`,msg:`🚨 [${cl}] ${tc.title}`,icon:<AlertCircle className="w-5 h-5 text-red-500"/>,color:'border-red-500/50 bg-red-50 dark:bg-red-500/10'},
      {id:`INC-${Date.now()}-2`,msg:`💬 #incident-response`,icon:<MessageSquare className="w-5 h-5 text-blue-500"/>,color:'border-blue-500/50 bg-blue-50 dark:bg-blue-500/10'},
      {id:`INC-${Date.now()}-3`,msg:`📧 RCA Status: Analyzing`,icon:<Mail className="w-5 h-5 text-emerald-500"/>,color:'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'},
    ];
    setToasts(incidents); setActiveIncidents(incidents);
    setTimeout(()=>{
      setToasts([]);
      const sid=Date.now()+'-sys';
      setMessages(prev=>[...prev,{id:sid,role:'system',type:'SIM_RCA',caseId:tc.id,isNew:true}]);
      setActiveCLIAction(tc.id);
      if(!isAudioMuted) speakText(t.simRcaMsg.replace('{title}',tc.title).replace('{rootCause}',tc.rootCause));
    },5000);
  };

  const handleCLIAction=(id)=>{setActiveCLIAction(null);const cid=Date.now()+'-cli';setMessages(prev=>[...prev,{id:cid,role:'assistant',type:'CLI_ACTION',caseId:id,isNew:true}]);setActiveIncidents([]);setIsSimulating(false);};
  const handleClearChat=()=>{setMessages([{id:Date.now()+'-init',role:'assistant',type:'INIT',isNew:false}]);setActiveCLIAction(null);setLogInput('');setMatchedSolution(null);setExecutionStatus('idle');try{window.speechSynthesis?.cancel();}catch{}};

  const getDynamicContent=(msg,l)=>{
    if(msg.type==='CUSTOM_CHAT') return msg.content[l]||msg.content[msg.originalLang]||'';
    if(msg.type==='INIT') return dict[l].initMsg;
    if(msg.type==='CATEGORY_PROMPT'){const lc=dict[l].categories[msg.category]||msg.category;return `[${lc}] ${l==='ko'?'관련 장애 원인과 해결 방법':'RCA and resolution for this category.'}`;}
    const kb=kbData[l].find(c=>c.id===msg.caseId);if(!kb) return '';
    if(msg.type==='SIM_RCA') return dict[l].simRcaMsg.replace('{title}',kb.title).replace('{rootCause}',kb.rootCause);
    if(msg.type==='CACHED_RCA') return dict[l].cachedReply.replace('{title}',kb.title).replace('{rootCause}',kb.rootCause).replace('{resolution}',kb.resolution);
    if(msg.type==='CLI_ACTION') return dict[l].cliContent.replace('{cliMock}',kb.cliMock).replace('{insight}',kb.insight);
    return '';
  };

  const getLatestTokenStr=()=>{
    if(tokens.type==='CACHE') return t.cacheHit;
    if(tokens.type==='API') return t.apiHit.replace('{tokens}',tokens.count.toLocaleString());
    return `${t.lastLabel} None`;
  };

  const handleAnalyzeLog = useCallback(async () => {
    if (!logInput?.trim()) return;
    setAnalyzing(true); setMatchedSolution(null); setExecutionStatus('idle');
    const ll = logInput.toLowerCase();
    let found=null;
    if(ll.includes('vsftpd')||ll.includes('500 oops')) found=kbData[lang][1];
    else if(ll.includes('space')||ll.includes('tomcat')) found=kbData[lang][2];
    else if(ll.includes('x509')||ll.includes('connection refused')) found=kbData[lang][3];
    else if(ll.includes('terraform')||ll.includes('ncloud')) found=kbData[lang][4];
    else if(ll.includes('mariadb')||ll.includes('binlog')) found=kbData[lang][5];
    else if(ll.includes('xrdp')||ll.includes('polkit')) found=kbData[lang][0];
    if(found){setTimeout(()=>{setMatchedSolution(found);setAnalyzing(false);},1000);return;}
    if(!apiKeys[llmProvider]){alert(t.unknownLogError);setAnalyzing(false);return;}

    const systemPrompt=`당신은 클라우드/인프라 L3 장애 해결 에이전트입니다.
아래 JSON 형식으로만 응답하세요. 다른 텍스트 금지.
{"id":"TS-DYNAMIC-AI","title":"장애 제목","rootCause":"근본 원인","resolution":"단계별 조치","cliMock":"$ 로 시작하는 명령어 (백틱 금지)","insight":"Ansible Playbook ${TBQ}yaml...${TBQ} 형태로"}`;

    const { masked: maskedLog, changed: wasChanged } = maskSensitiveLog(logInput);
    if (wasChanged) setLogMaskedNotice(true);

    try {
      const result=await fetchLLM({
        messages:[{role:'user',content:`언어: ${lang==='ko'?'한국어':'English'}\n\nError Log:\n${maskedLog}`}],
        systemPrompt,
        isJsonMode:true,
      });
      if(result.text){
        const clean=result.text.replace(/```json|```/g,'').trim();
        const parsed = JSON.parse(clean);

        const newEntry = {
          ...parsed,
          id: `TS-LOCAL-${Date.now()}`,
          category: 'AI Generated',
          _savedAt: new Date().toISOString(),
          _source: 'ai-agent',
        };
        const saved = saveLocalKBEntry(newEntry, lang);
        if (saved) {
          setLocalKbEntries(prev => ({
            ...prev,
            [lang]: [newEntry, ...(prev[lang]||[])].slice(0,50),
          }));
        }

        setMatchedSolution(parsed);
        if(result.usage.total>0){
          setTokens(prev=>({...prev,input:prev.input+result.usage.input,output:prev.output+result.usage.output,total:prev.total+result.usage.total,agent:prev.agent+result.usage.total,type:'API',count:result.usage.total}));
          updateTokenHistory(result.usage.total);
        }
      }
    }catch(err){alert(`${t.aiAnalysisError}\n${sanitizeErrorMsg(err.message)}`);}
    finally{setAnalyzing(false);}
  },[logInput,lang,t,apiKeys,llmProvider,fetchLLM,updateTokenHistory]);

  const downloadFile=useCallback((name,content)=>{try{const a=document.createElement('a');const blob=new Blob([content],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);}catch{}},[]);
  const handleDownloadAnsible=useCallback((sol)=>{if(!sol?.insight)return;let c='# Parsing failed.';if(sol.insight.includes(TBQ+'yaml')){const p=sol.insight.split(TBQ+'yaml');if(p.length>1)c=p[1].split(TBQ)[0].trim();}downloadFile(`fix_${sol.id}.yml`,c);},[downloadFile]);
  const handleDownloadShell=useCallback((sol)=>{if(!sol)return;let c='#!/bin/bash\n\n';if(sol.insight?.includes(TBQ+'bash')){const p=sol.insight.split(TBQ+'bash');if(p.length>1){c+=p[1].split(TBQ)[0].trim();downloadFile(`fix_${sol.id}.sh`,c);return;}}sol.cliMock?.split('\n').forEach(l=>{if(l?.trim().startsWith('$'))c+=l.replace(/^\$\s*/,'')+'\n';});downloadFile(`fix_${sol.id}.sh`,c.trim());},[downloadFile]);

  const currentCfg = PROVIDER_CONFIG[llmProvider];
  const currentKey = apiKeys[llmProvider];
  const currentModel = selectedModels[llmProvider];
  const currentModelInfo = MODEL_OPTIONS[llmProvider]?.find(m=>m.id===currentModel);
  const modelBadge = (m) => typeof m?.badge === 'object' ? (m.badge[lang]||m.badge.ko) : (m?.badge||'');
  const modelCostNote = (m) => typeof m?.costNote === 'object' ? (m.costNote[lang]||m.costNote.ko) : (m?.costNote||'');

  const providerBg = { gemini:'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-blue-500', openai:'bg-emerald-50 dark:bg-slate-800 border-emerald-200 dark:border-emerald-500', claude:'bg-orange-50 dark:bg-slate-800 border-orange-200 dark:border-orange-500' };
  const providerText = { gemini:'text-blue-600 dark:text-blue-400', openai:'text-emerald-600 dark:text-emerald-400', claude:'text-orange-600 dark:text-orange-400' };

  return (
    <div className="h-screen flex flex-col md:flex-row font-sans overflow-hidden bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50 space-y-3 pointer-events-none">
        {toasts.map(toast=><div key={toast.id} className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-right-8 ${toast.color}`}>{toast.icon}<span className="text-sm font-bold">{toast.msg}</span></div>)}
      </div>
      {isMobileMenuOpen&&<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={()=>setIsMobileMenuOpen(false)}/>}

      {/* ── 사이드바 ──────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen?'translate-x-0':'-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0`}>
        <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0"><Terminal className="w-4 h-4 text-white"/></div>
            <div><h1 className="font-bold text-slate-900 dark:text-white text-[15px] leading-tight">{t.title}</h1><span className="text-[10px] text-indigo-500 font-mono tracking-widest">{t.subtitle}</span></div>
          </div>
          <button onClick={()=>setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex flex-col gap-1.5">
          <button onClick={triggerSimulation} disabled={isSimulating} className="w-full bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 disabled:opacity-50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"><BellRing className="w-3.5 h-3.5"/>{t.urgencyBtn}</button>
          <button onClick={()=>{setActiveView('agentic');setIsMobileMenuOpen(false);}} className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${activeView==='agentic'?'bg-indigo-600 text-white border border-indigo-500':'bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'}`}><Search className="w-3.5 h-3.5"/>{t.agenticBtn}</button>
        </div>

        <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">

          {currentKey && (
            <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 ${providerBg[llmProvider]}`}>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>
              <div className="flex-1 min-w-0">
                <span className={`text-[11px] font-bold ${providerText[llmProvider]}`}>{currentCfg.emoji} {currentCfg.label} {t.apiKeyLinked}</span>
                <p className="text-[9px] text-slate-400 font-mono truncate">{maskApiKey()}</p>
              </div>
            </div>
          )}

          {userRole==='ADMIN'&&(
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5"/>{t.adminMode}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isAdmin} onChange={()=>setIsAdmin(!isAdmin)}/>
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"/>
                </label>
              </div>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-[#0B1120] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-bold"><BarChart3 className="w-3.5 h-3.5"/>{t.statsTitle}</h3>
              {localKbEntries[lang]?.length > 0 && (
                <button onClick={()=>{
                  const data = exportLocalKB(lang);
                  downloadFile(`kb_local_${lang}_${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(data, null, 2));
                }} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-0.5 border border-indigo-500/30 px-1.5 py-0.5 rounded-md">
                  <FileCode className="w-2.5 h-2.5"/>JSON
                </button>
              )}
            </div>
            <div className="space-y-2">
              {Object.entries(categoryCounts).map(([name,count])=>(
                <div key={name} className="flex items-center gap-2">
                  <div className="w-16 text-[10px] text-slate-600 dark:text-slate-500 font-bold truncate" title={name}>{name}</div>
                  <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{width:`${(count/maxCatCount)*100}%`}}/></div>
                  <div className="text-[10px] text-slate-500 w-4 text-right font-bold">{count}</div>
                </div>
              ))}
            </div>
            {localKbEntries[lang]?.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[9px] text-indigo-500 font-bold flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5"/>
                  {lang==='ko'?`AI 학습 KB +${localKbEntries[lang].length}건`:`AI KB +${localKbEntries[lang].length} cases`}
                </span>
                <button onClick={()=>{
                  if(window.confirm(lang==='ko'?'로컬 AI KB를 초기화합니까?':'Clear local AI KB?')){
                    localStorage.removeItem(KB_LOCAL_KEY);
                    setLocalKbEntries({ko:[],en:[]});
                  }
                }} className="text-[9px] text-slate-400 hover:text-red-400 transition-colors">
                  {lang==='ko'?'초기화':'Clear'}
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-[#0B1120] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-bold"><Cpu className="w-3.5 h-3.5"/>{t.finopsTitle}</h3>
            <div className="text-center mb-3 pb-3 border-b border-slate-200 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1 font-bold">{t.totalUsage}</span>
              <div className="text-3xl font-light text-slate-900 dark:text-white flex justify-center items-baseline gap-1">{tokens.total.toLocaleString()}<span className="text-[10px] text-slate-400 font-bold">/ 50K</span></div>
              {currentKey ? (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold ${providerText[llmProvider]}`}>{currentCfg.emoji} {currentCfg.label}</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-[10px] text-slate-400 font-mono">{currentModel.split('-').slice(0,3).join('-')}</span>
                  <span className="text-emerald-500 text-[8px]">●</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Key className="w-3 h-3 text-slate-400"/>
                  <span className="text-[10px] text-slate-400">{lang==='ko'?'API Key 등록 후 활성화':'Register API Key to activate'}</span>
                </div>
              )}
            </div>
            <div className="space-y-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800/50">
              {[{label:t.chatLabel,key:'chat',color:'bg-indigo-500',Icon:MessageSquare,tc:'text-indigo-600 dark:text-indigo-400'},{label:t.agentLabel,key:'agent',color:'bg-emerald-500',Icon:Search,tc:'text-emerald-600 dark:text-emerald-400'}].map(({label,key,color,Icon,tc})=>(
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className={`${tc} flex items-center gap-1`}><Icon className="w-3 h-3"/>{label}</span>
                    <span className="text-slate-700 dark:text-slate-300">{tokens[key].toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{width:`${Math.min((tokens[key]/50000)*100,100)}%`}}/></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700/80"><span className="text-[9px] text-slate-500 block mb-1 font-bold">{t.inputLabel} / {t.outputLabel}</span><div className="text-xs font-bold"><span className="text-indigo-500">{tokens.input}</span><span className="text-slate-400"> / </span><span className="text-teal-500">{tokens.output}</span></div></div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700/80"><span className="text-[9px] text-slate-500 block mb-1 font-bold">{t.transTitle} KO/EN</span><div className="text-xs font-bold"><span className="text-orange-500">{tokens.transKo}</span><span className="text-slate-400"> / </span><span className="text-orange-500">{tokens.transEn}</span></div></div>
            </div>
            <div className="text-[10px] text-green-600 dark:text-green-400 font-bold text-center mb-2">{getLatestTokenStr()}</div>
            <TokenTrendChart history={tokenHistory} lang={lang} currentTokens={tokens.total}/>
          </div>

          {activeCLIAction&&activeView==='chat'&&(
            <div className="mt-auto pt-2 hidden md:block">
              <h2 className="text-[10px] font-bold text-green-600 dark:text-green-500 uppercase tracking-widest mb-2 text-center">{t.actionReq}</h2>
              <button onClick={()=>handleCLIAction(activeCLIAction)} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all border border-green-400 animate-pulse"><Zap className="w-5 h-5 fill-current"/>{t.cliRun}</button>
            </div>
          )}

          <div className="md:hidden mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around">
            <button onClick={()=>{try{if(!isAudioMuted)window.speechSynthesis?.cancel();}catch{}setIsAudioMuted(!isAudioMuted);setIsMobileMenuOpen(false);}} className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-500 p-2">
              <span className="text-lg">{isAudioMuted?'🔇':'🔊'}</span>
              <span className="text-[9px] font-bold">{lang==='ko'?'음성':'Sound'}</span>
            </button>
            <button onClick={()=>{setTheme(p=>p==='dark'?'light':'dark');}} className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-500 p-2">
              <span className="text-lg">{theme==='dark'?'☀️':'🌙'}</span>
              <span className="text-[9px] font-bold">{lang==='ko'?'테마':'Theme'}</span>
            </button>
            <button onClick={()=>{setLang(p=>p==='ko'?'en':'ko');}} className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-500 p-2">
              <Globe className="w-5 h-5"/>
              <span className="text-[9px] font-bold uppercase">{lang}</span>
            </button>
            <button onClick={()=>{handleClearChat();setIsMobileMenuOpen(false);}} className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 p-2">
              <Trash2 className="w-5 h-5"/>
              <span className="text-[9px] font-bold">{lang==='ko'?'초기화':'Clear'}</span>
            </button>
            <button onClick={()=>setUserRole(p=>p==='ADMIN'?'USER':'ADMIN')} className={`flex flex-col items-center gap-1 p-2 ${userRole==='ADMIN'?'text-emerald-500':'text-slate-400'}`}>
              <User className="w-5 h-5"/>
              <span className="text-[9px] font-bold">Admin</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── 메인 영역 ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full relative bg-slate-50 dark:bg-[#0B1120]">
        <header className="h-14 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex justify-between items-center px-3 md:px-6 z-20 shrink-0">
          {/* 모바일: 햄버거 */}
          <button onClick={()=>setIsMobileMenuOpen(true)} className="md:hidden text-slate-500 hover:text-indigo-600 dark:hover:text-white p-1"><Menu className="w-6 h-6"/></button>

          {/* 모바일: 앱 타이틀 */}
          <span className="md:hidden text-sm font-bold text-slate-700 dark:text-white">{t.title}</span>

          {/* ✅ 오른쪽 버튼들 — flex 컨테이너를 올바르게 닫는 것이 핵심 수정 포인트 */}
          <div className="flex items-center gap-2">
            {/* LLM 설정 버튼 */}
            <div className="relative">
              <button onClick={()=>{setIsLlmSettingsOpen(v=>!v);setLlmStep(currentKey?3:0);}}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full border cursor-pointer transition-all ${currentKey?providerBg[llmProvider]:'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'}`}>
                {currentKey?(
                  <><span>{currentCfg.emoji}</span>
                  <span className={`hidden sm:inline ${providerText[llmProvider]}`}>{currentCfg.label}</span>
                  <span className="hidden sm:inline text-slate-300 dark:text-slate-600">·</span>
                  <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-mono">{currentModelInfo?.label.split(' ').slice(-2).join(' ')}</span>
                  <span className="text-emerald-500">●</span></>
                ):(
                  <><Key className="w-3 h-3 text-slate-400"/>
                  <span className="text-slate-400">{lang==='ko'?'LLM 설정':'LLM Setup'}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400"/></>
                )}
              </button>
              {isLlmSettingsOpen&&(
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={()=>{setIsLlmSettingsOpen(false);setApiKeyInputVal('');}}/>
                  <div className="fixed md:absolute inset-x-0 md:inset-x-auto bottom-0 md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-80 z-50 flex flex-col bg-white dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-700 rounded-t-3xl md:rounded-2xl shadow-2xl" style={{maxHeight:'88vh'}}>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full md:hidden"/>
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 mt-2 md:mt-0">{lang==='ko'?'AI 모델 설정':'AI Model Setup'}</span>
                      <button onClick={()=>{setIsLlmSettingsOpen(false);setApiKeyInputVal('');}} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                    {currentKey&&llmStep===3?(
                      <div className="p-5 flex flex-col gap-4">
                        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 px-4 py-4 rounded-2xl">
                          <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0"/>
                          <div>
                            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{currentCfg.emoji} {currentCfg.label} {t.apiKeyLinked}</p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{maskApiKey()}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{modelBadge(currentModelInfo)} {currentModelInfo?.label}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={()=>setLlmStep(0)} className="flex-1 text-sm font-bold py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors">{lang==='ko'?'변경':'Change'}</button>
                          <button onClick={()=>{handleResetApiKey();setLlmStep(0);}} className="flex-1 text-sm font-bold py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-500 rounded-xl transition-colors flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4"/>{t.resetBtn}</button>
                        </div>
                      </div>
                    ):(
                      <div className="p-5 flex flex-col gap-5">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.aiSelectLabel||'AI 선택'}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {Object.entries(PROVIDER_CONFIG).map(([key,cfg])=>{
                              const isActive=llmProvider===key;
                              const hasKey=!!apiKeys[key];
                              return(
                                <button key={key} onClick={()=>{setLlmProvider(key);try{localStorage.setItem('llm_provider',key);}catch{}setApiKeyInputVal('');if(llmStep===0)setLlmStep(1);}}
                                  className={`flex flex-col items-center py-4 rounded-2xl border-2 transition-all font-bold ${isActive?`border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ${providerText[key]}`:'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                                  <span className="text-2xl mb-1.5">{cfg.emoji}</span>
                                  <span className="text-[11px]">{cfg.label}</span>
                                  {hasKey&&<span className="text-[9px] text-emerald-500 mt-1">● {lang==='ko'?'연동됨':'Active'}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {llmStep>=1&&(
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{lang==='ko'?'버전 선택':'Select Version'}</span>
                              {currentModelInfo&&<span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${currentModelInfo.costTier===1?'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400':'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>{modelCostNote(currentModelInfo)}</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                              {MODEL_OPTIONS[llmProvider].map(m=>(
                                <button key={m.id} onClick={()=>{handleModelChange(m.id);if(llmStep===1)setLlmStep(2);}}
                                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${currentModel===m.id?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300':'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                  <div>
                                    <span className="text-sm font-bold block">{modelBadge(m)} {m.label}</span>
                                    <span className="text-[11px] text-slate-400 mt-0.5 block">{modelCostNote(m)}</span>
                                  </div>
                                  {currentModel===m.id&&<CheckCircle className="w-5 h-5 text-indigo-500 shrink-0"/>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {llmStep>=2&&(
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">API Key</span>
                            </div>
                            <input type="password" value={apiKeyInputVal}
                              onChange={e=>setApiKeyInputVal(e.target.value.replace(/[^A-Za-z0-9\-_.]/g,''))}
                              placeholder={lang==='ko'?'API Key 입력':'Enter API Key'} maxLength={currentCfg.maxLen}
                              className="w-full text-sm bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 mb-3 focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 font-mono"
                              autoComplete="off" spellCheck={false} autoCorrect="off" autoCapitalize="off"/>
                            <button onClick={()=>{handleSaveApiKey();if(validateApiKey(apiKeyInputVal.trim(),llmProvider))setLlmStep(3);}} disabled={!apiKeyInputVal.trim()}
                              className="w-full text-base font-bold py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">
                              <CheckCircle className="w-5 h-5"/>{t.saveAndStart||(lang==='ko'?'저장하고 시작':'Save & Start')}
                            </button>
                          </div>
                        )}
                        <div style={{height:'max(env(safe-area-inset-bottom, 0px), 16px)'}}/>
                      </div>
                    )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* ✅ 여기서 <div className="relative"> 만 닫힘
                   <div className="flex items-center gap-2"> 는 아직 열려있음 — 이것이 핵심 수정 */}

            {/* 나머지 헤더 버튼들은 모두 flex 컨테이너 안에 올바르게 위치 */}
            <button onClick={()=>{try{if(!isAudioMuted)window.speechSynthesis?.cancel();}catch{}setIsAudioMuted(!isAudioMuted);}} className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm border border-slate-300 dark:border-slate-700 shadow-sm">{isAudioMuted?'🔇':'🔊'}</button>
            <button onClick={()=>setUserRole(p=>p==='ADMIN'?'USER':'ADMIN')} className={`hidden md:flex items-center justify-center w-8 h-8 rounded-full transition-colors text-sm border shadow-sm ${userRole==='ADMIN'?'bg-emerald-100 border-emerald-300 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500/50 dark:text-emerald-400':'bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}><User className="w-4 h-4"/></button>
            <button onClick={handleClearChat} className="hidden md:block text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors"><Trash2 className="w-5 h-5"/></button>
            <button onClick={()=>setTheme(p=>p==='dark'?'light':'dark')} className="text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors">{theme==='dark'?<Sun className="w-5 h-5"/>:<Moon className="w-5 h-5"/>}</button>
            <button onClick={()=>setLang(p=>p==='ko'?'en':'ko')} className="flex items-center gap-1 text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors"><Globe className="w-5 h-5"/><span className="text-xs font-bold uppercase">{lang}</span></button>
            <div className="hidden md:block relative cursor-pointer" onClick={()=>setIsNotifOpen(!isNotifOpen)}>
              <BellRing className={`w-5 h-5 ${isNotifOpen?'text-indigo-600 dark:text-white':'text-slate-400 hover:text-indigo-500 dark:hover:text-white'}`}/>
              {activeIncidents.length>0&&<span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"/></span>}
              <div className={`absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 transition-all ${isNotifOpen?'opacity-100 visible':'opacity-0 invisible'}`}>
                <h3 className="text-xs font-bold text-slate-500 mb-2 px-2 pt-1 uppercase">{t.ongoingTitle}</h3>
                {activeIncidents.length===0?<div className="p-3 text-sm text-slate-500 text-center">{t.noOngoing}</div>:activeIncidents.map(inc=><div key={inc.id} className="p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg mb-1.5 last:mb-0"><p className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 font-bold">{inc.icon}{inc.msg}</p></div>)}
              </div>
            </div>
          </div>
          {/* ✅ 여기서 <div className="flex items-center gap-2"> 올바르게 닫힘 */}
        </header>

        {/* ── 채팅 뷰 ──────────────────────────────────────────────── */}
        {activeView==='chat'&&(
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-6 pb-4">
                {messages.map(msg=>{
                  const isUser=msg.role==='user',isSys=msg.role==='system';
                  const content=getDynamicContent(msg,lang);
                  const blocks=parseMessageBlocks(content);
                  return (
                    <div key={msg.id} className={`flex ${isUser?'justify-end items-end':'justify-start items-start'} flex-col`}>
                      <div className={`max-w-[95%] md:max-w-[85%] rounded-2xl p-5 shadow-sm ${isUser?'bg-indigo-100 dark:bg-indigo-600 text-indigo-900 dark:text-white border border-indigo-200 dark:border-indigo-500/30 rounded-tr-none':isSys?'bg-red-50 dark:bg-slate-900 border-2 border-red-500/30 rounded-tl-none shadow-[0_0_20px_rgba(239,68,68,0.1)]':'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none shadow-lg'}`}>
                        <div className={`flex items-center gap-2 mb-3 border-b pb-2 ${isUser?'opacity-80 border-indigo-300 dark:border-white/20':'opacity-60 border-slate-300 dark:border-slate-600'}`}>
                          {isUser?<Smartphone className="w-4 h-4"/>:isSys?<ShieldAlert className="w-4 h-4 text-red-500"/>:<Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/>}
                          <span className="text-xs font-bold uppercase tracking-wider">{isUser?t.you:isSys?t.sysAnal:t.agent}</span>
                          {!isUser&&!isSys&&currentKey&&<span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 ${providerText[llmProvider]}`}>{currentCfg.emoji} {currentModelInfo?.label.split(' ').slice(-2).join(' ')||currentModel}</span>}
                        </div>
                        <div className="text-sm break-words font-medium">
                          <SequenceRenderer msgId={msg.id} blocks={blocks} isNew={msg.isNew} lang={lang} scrollRef={messagesEndRef} onComplete={markMessageAsOld}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isLoading&&<div className="flex justify-start"><div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none p-5 flex items-center gap-4 shadow-lg"><Loader2 className="w-5 h-5 animate-spin text-indigo-600"/><span className="text-sm font-bold animate-pulse">{t.rcaGen}</span></div></div>}
                <div ref={messagesEndRef}/>
                {activeCLIAction&&<div className="h-16 md:hidden"/>}
              </div>
            </div>
            {activeCLIAction&&<div className="md:hidden px-4 pb-2">
              <button onClick={()=>handleCLIAction(activeCLIAction)} className="w-full bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg border border-green-400 animate-pulse"><Zap className="w-4 h-4 fill-current"/>{t.cliRun}</button>
            </div>}
            <div className="bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex flex-col pb-safe shrink-0 z-30">
              <div className="max-w-4xl mx-auto w-full px-4 pt-3">
                <div className="text-xs text-slate-500 font-bold mb-2 flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5"/>{t.catHelp}</div>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {Object.keys(categoryCounts).map(n=><button key={n} onClick={()=>handleCategoryClick(n)} disabled={isLoading} className="text-[11px] whitespace-nowrap shrink-0 font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-indigo-600 dark:text-indigo-300 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 rounded-lg transition-colors shadow-sm">{n}</button>)}
                </div>
              </div>
              <div className="max-w-4xl mx-auto w-full p-4 pt-2">
                <form onSubmit={e=>{e.preventDefault();handleSendMessage(input);}} className="relative flex items-center">
                  <button type="button" onClick={toggleListening} disabled={isLoading} className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all text-[16px] ${isListening?'bg-red-100 dark:bg-red-500/20 animate-pulse border border-red-300':'grayscale opacity-70 hover:opacity-100 hover:grayscale-0'}`}>{isListening?'🔴':'🎤'}</button>
                  <input type="text" value={input} onChange={e=>{setInput(e.target.value);currentInputRef.current=e.target.value;}} maxLength={500} placeholder={isListening?t.listening:t.inputPlaceholder} className={`w-full bg-slate-100 dark:bg-slate-900 border ${isListening?'border-red-400':'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white font-medium rounded-full pl-14 pr-14 py-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner`} disabled={isLoading||isListening}/>
                  <button type="submit" disabled={!input.trim()||isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50"><Send className="w-4 h-4 ml-0.5"/></button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* ── 에이전트 뷰 ───────────────────────────────────────────── */}
        {activeView==='agentic'&&(
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar animate-in slide-in-from-right-8 duration-300">
            <div className="max-w-4xl mx-auto space-y-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30"><Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/></div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.agenticTitle}</h2>
                </div>
                <button onClick={()=>setActiveView('chat')} className="flex items-center space-x-1.5 text-sm font-medium px-4 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 shadow-sm"><MessageSquare className="w-4 h-4"/><span className="hidden sm:inline">{t.backToChat}</span></button>
              </div>
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 md:p-4 flex items-start gap-2.5">
                <span className="text-base md:text-lg shrink-0">🔒</span>
                <div>
                  <p className="text-xs md:text-sm font-bold text-indigo-300 mb-0.5 md:mb-1">{t.securityBadge}</p>
                  <p className="text-[10px] md:text-xs text-indigo-200/70 leading-relaxed">{t.securityNotice}</p>
                </div>
              </div>

              {!currentKey&&<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/><div><p className="text-sm font-bold text-amber-800 dark:text-amber-300">{t.apiKeyMissingAlert}</p><p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{lang==='ko'?'KB 매칭 분석은 무료입니다. AI 동적 분석만 API Key가 필요합니다.':'KB matching is free. Only AI dynamic analysis requires an API Key.'}</p></div></div>}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md">
                <label className="block text-sm font-bold mb-3 flex items-center space-x-2"><AlertTriangle className="w-4 h-4 text-amber-500"/><span>{t.agentLogDump}</span></label>
                <textarea value={logInput} onChange={e=>{setLogInput(e.target.value);setLogMaskedNotice(false);}} placeholder={t.agentLogPlaceholder} className="w-full h-32 md:h-40 p-3 md:p-4 font-mono text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none shadow-inner bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300"/>
                {logMaskedNotice && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0"/>
                    {t.logMaskedNotice}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button onClick={handleAnalyzeLog} disabled={!logInput?.trim()||analyzing} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md active:scale-95">
                    {analyzing?<Loader2 className="w-4 h-4 animate-spin"/>:<PlayCircle className="w-4 h-4"/>}
                    <span>{analyzing?t.agentAnalyzing:t.agentAnalyzeBtn}</span>
                  </button>
                </div>
              </div>
              {matchedSolution&&(
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 overflow-x-auto custom-scrollbar shadow-xl animate-in fade-in duration-500">
                  <div className="min-w-[600px] md:min-w-full">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-500/20 p-6 flex items-start space-x-4">
                      <ShieldAlert className="w-7 h-7 text-indigo-500 shrink-0 mt-0.5"/>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white break-words">{matchedSolution.title}</h3>
                        <div className="mt-4 space-y-3">
                          <p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap"><span className="font-bold px-2 py-1 rounded mr-2 border text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-700/50 inline-block mb-1">{t.agentRootCause}</span>{matchedSolution.rootCause}</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap"><span className="font-bold px-2 py-1 rounded mr-2 border text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700/50 inline-block mb-1">{t.agentResolution}</span>{matchedSolution.resolution}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-500 flex items-center gap-2"><Server className="w-5 h-5"/>{t.agentAutoScript}</span>
                        <div className="flex gap-2">
                          <button onClick={()=>handleDownloadShell(matchedSolution)} className="flex items-center gap-1.5 text-xs border px-4 py-2.5 rounded-lg font-bold bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white shadow-sm transition-colors"><Terminal className="w-4 h-4 text-blue-500"/>{t.shellDownload}</button>
                          <button onClick={()=>handleDownloadAnsible(matchedSolution)} className="flex items-center gap-1.5 text-xs border px-4 py-2.5 rounded-lg font-bold bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white shadow-sm transition-colors"><FileCode className="w-4 h-4 text-amber-500"/>{t.ansibleDownload}</button>
                        </div>
                      </div>
                      <div className="bg-[#0f172a] p-5 rounded-xl border border-slate-800 text-white font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed mb-5 shadow-inner">
                        <div className="text-slate-500 mb-3 select-none"># {t.agentPreview}</div>
                        {matchedSolution.cliMock?.split('\n').map((line,i)=><div key={i} className={line.startsWith('[ERROR]')?'text-red-400 font-bold':line.startsWith('[SUCCESS]')||line.startsWith('[INFO]')?'text-emerald-400':line.startsWith('$')?'text-blue-300':'text-slate-300'}>{line}</div>)}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-inner">
                        <p className="text-base font-bold mb-2 text-slate-800 dark:text-white">{t.agentApproveReq}</p>
                        <p className="text-sm mb-5 text-slate-500">{t.agentApproveDesc}</p>
                        {executionStatus==='idle'&&<button onClick={()=>{setExecutionStatus('running');setTimeout(()=>setExecutionStatus('success'),2500);}} disabled={userRole!=='ADMIN'||!isAdmin} className={`w-full md:w-auto mx-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold transition-all ${userRole==='ADMIN'&&isAdmin?'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95':'bg-slate-200 dark:bg-slate-800/80 text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed'}`}>{userRole==='ADMIN'&&isAdmin?<PlayCircle className="w-5 h-5"/>:<Lock className="w-5 h-5"/>}<span>{userRole==='ADMIN'&&isAdmin?t.agentExecuteBtn:t.unauthorizedBtn}</span></button>}
                        {executionStatus==='running'&&<div className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 px-8 py-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30"><Loader2 className="w-5 h-5 animate-spin"/><span className="font-bold">{t.agentExecuting}</span></div>}
                        {executionStatus==='success'&&<div className="flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-100 px-8 py-4 bg-emerald-100 dark:bg-emerald-600 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-500 animate-in zoom-in-95"><CheckCircle className="w-6 h-6"/><span className="font-bold text-lg">{t.agentSuccess}</span></div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{__html:`
        .custom-scrollbar{scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent;}
        .dark .custom-scrollbar{scrollbar-color:#334155 transparent;}
        .custom-scrollbar::-webkit-scrollbar{height:6px;width:6px;}
        .custom-scrollbar::-webkit-scrollbar-track{background:transparent;}
        .custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px;}
        .dark .custom-scrollbar::-webkit-scrollbar-thumb{background:#334155;}
        @media(max-width:768px){.pb-safe{padding-bottom:env(safe-area-inset-bottom,1rem)}}
      `}}/>
    </div>
  );
}
