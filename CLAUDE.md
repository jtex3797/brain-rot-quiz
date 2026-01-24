# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

BrainRotQuiz는 AI 기반 퀴즈 생성 플랫폼입니다. 텍스트 문서를 업로드하면 게이미피케이션 요소(콤보, XP, 레벨)가 적용된 퀴즈로 변환합니다.

**기술 스택:** Next.js 16 + React 19 + TypeScript + Tailwind CSS + Supabase + Vercel AI SDK

## 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 검사
```

## 아키텍처

### 하이브리드 퀴즈 생성 파이프라인

```
텍스트 입력 → 캐시 확인 → NLP 전처리(500자 이상) → AI 생성 → 캐시 저장
```

1. **캐시 시스템** (`lib/cache/`): SHA-256 해시 기반, Supabase 저장, 30일 TTL
2. **NLP 전처리** (`lib/nlp/`): TF-IDF 기반 핵심 문장 추출, `Intl.Segmenter`로 한/영 토큰화
3. **AI 생성** (`lib/ai/`): 멀티모델 폴백 (Gemini → GPT-4o mini → Claude Haiku)
4. **문제 풀** (`lib/quiz/`): AI 생성 + 문제 변형(swap, negate, shuffle) 조합

### 주요 디렉토리

- `app/api/quiz/generate/` - 퀴즈 생성 API (POST)
- `lib/ai/` - AI 모델 설정, 프롬프트, 생성 로직
- `lib/nlp/` - 텍스트 분석, TF-IDF, 토큰화
- `lib/quiz/` - 배치 생성, 문제 풀, 문제 변형
- `lib/hooks/` - 퀴즈 세션, 콤보, 사운드 등 커스텀 훅
- `contexts/` - Auth, Theme, Sound Context

### 게이미피케이션

- 콤보 시스템: 연속 정답 시 콤보 증가 (2+, 5+, 7+, 10+ 단계별 메시지)
- XP 시스템: 정답당 경험치 획득
- 사운드/애니메이션: Framer Motion + use-sound

## 환경 변수

```
GOOGLE_GENERATIVE_AI_API_KEY    # Gemini API
OPENAI_API_KEY                  # OpenAI API
ANTHROPIC_API_KEY               # Claude API
NEXT_PUBLIC_SUPABASE_URL        # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase 익명 키
```

## 컨벤션

- UI 텍스트/주석: 한국어
- 컴포넌트: PascalCase, 훅: use* prefix
- 클라이언트 컴포넌트: `'use client'` 명시
- 로깅: `lib/utils/logger.ts` 사용 (파이프라인 추적용)
- 검증: Zod 스키마
