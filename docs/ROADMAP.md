# BrainRotQuiz 개발 로드맵

> **최종 수정일**: 2026-01-30

이 문서는 기능별 구현 상태와 개발 우선순위를 추적합니다.

---

## 구현 상태 범례

| 상태 | 설명 |
|:----:|------|
| :white_check_mark: | 완료 |
| :construction: | 진행 중 |
| :hourglass: | 대기 중 |
| :x: | 미구현 |

---

## Phase 0: 프로젝트 기반 (완료)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| Next.js 15 설정 | :white_check_mark: | App Router, TypeScript | `next.config.ts` |
| Tailwind CSS | :white_check_mark: | v3.4 스타일링 | `tailwind.config.ts` |
| 디자인 시스템 | :white_check_mark: | 커스텀 색상, Button 컴포넌트 | `globals.css`, `components/ui/` |
| 프로젝트 구조 | :white_check_mark: | lib/, components/, app/ 정리 | - |

---

## Phase 1: AI 퀴즈 엔진 (완료)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| Vercel AI SDK 통합 | :white_check_mark: | 멀티 모델 지원 | `lib/ai/` |
| 퀴즈 생성 API | :white_check_mark: | POST /api/quiz/generate | `app/api/quiz/generate/` |
| 멀티 모델 폴백 | :white_check_mark: | Gemini → GPT → Claude | `lib/ai/models.ts` |
| 퀴즈 타입 정의 | :white_check_mark: | MCQ, OX, Short Answer | `types/index.ts` |
| 로컬 스토리지 | :white_check_mark: | 퀴즈 임시 저장 | `lib/utils/storage.ts` |
| **문제 은행 (Question Bank)** | :white_check_mark: | 최대 용량 생성, 이어 풀기, DB 저장 | `lib/quiz/questionBankService.ts`, `app/api/quiz` |

---

## Phase 2: 퀴즈 UI (완료)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| 텍스트 업로드 | :white_check_mark: | textarea 입력 | `app/upload/page.tsx` |
| 퀴즈 플레이어 | :white_check_mark: | 문제 풀이 UI | `components/quiz/QuizPlayer.tsx` |
| 객관식 UI | :white_check_mark: | 4지선다 버튼 | `components/quiz/MultipleChoice.tsx` |
| OX 퀴즈 UI | :white_check_mark: | O/X 버튼 | `components/quiz/OXQuestion.tsx` |
| 단답형 UI | :white_check_mark: | 텍스트 입력 | `components/quiz/ShortAnswer.tsx` |
| 진행바 | :white_check_mark: | 현재/전체 진행률 | `components/quiz/ProgressBar.tsx` |
| 콤보 시스템 | :white_check_mark: | 연속 정답 추적 | `lib/hooks/useQuizCombo.ts` |
| 결과 화면 | :white_check_mark: | 점수, 오답 목록 | `components/quiz/QuizResult.tsx` |

---

## Phase 3: 코드 품질 (완료)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| 상수 중앙화 | :white_check_mark: | 매직 넘버 제거 | `lib/constants.ts` |
| 타입 안전성 | :white_check_mark: | `as any` 제거 | 전체 |
| 커스텀 훅 | :white_check_mark: | 상태 로직 분리 | `lib/hooks/` |
| 에러 바운더리 | :white_check_mark: | 전역 에러 처리 | `components/ErrorBoundary.tsx` |
| 에러 UI | :white_check_mark: | 사용자 친화적 에러 | `components/ErrorFallback.tsx` |

---

## Phase 4: Supabase 인증/DB (완료)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| Supabase 설정 | :white_check_mark: | 프로젝트 연동 | `lib/supabase/` |
| 회원가입/로그인 | :white_check_mark: | 이메일 인증 | `app/auth/`, `contexts/AuthContext.tsx` |
| 소셜 로그인 | :hourglass: | Google, Kakao (추후) | - |
| 사용자 프로필 | :white_check_mark: | 닉네임, 아바타 | `types/supabase.ts` |
| DB 스키마 | :white_check_mark: | 마이그레이션 | `lib/supabase/schema.sql` |
| 퀴즈 저장 | :white_check_mark: | 생성한 퀴즈를 Supabase에 저장 | `lib/supabase/quiz.ts` |
| 세션 기록 | :white_check_mark: | quiz_sessions, session_answers 연동 | `lib/supabase/session.ts` |

---

## Phase 5: 게이미피케이션 확장 (진행 중)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| XP 시스템 | :white_check_mark: | add_xp 함수 호출, 정답당 경험치 | `lib/supabase/session.ts` |
| 레벨 시스템 | :white_check_mark: | XP 누적 레벨업 | `lib/supabase/schema.sql` |
| 스트릭 | :white_check_mark: | update_streak 함수, 연속 학습일 | `lib/supabase/session.ts` |
| XP 획득 UI | :white_check_mark: | 퀴즈 완료 시 XP 표시 | `components/quiz/XPGainDisplay.tsx` |
| 뱃지 시스템 | :white_check_mark: | 업적 달성 뱃지 | `lib/supabase/badges.ts`, `components/badge/` |
| 리더보드 | :x: | 주간/월간 랭킹 | - |
| 사운드 효과 | :white_check_mark: | 정답/오답 효과음 | `lib/hooks/useQuizSound.ts`, `contexts/SoundContext.tsx` |

---

## Phase 6: 추가 기능 (미구현)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| 퀴즈 재도전 | :white_check_mark: | 동일 퀴즈 재시작 | `components/quiz/QuizPlayer.tsx`, `components/quiz/QuizResult.tsx` |
| 오답노트 | :white_check_mark: | 틀린 문제 저장 및 퀴즈별 필터링 | `app/(main)/wrong-answers/`, `lib/supabase/wrongAnswers.ts` |
| 오답 복습 | :white_check_mark: | 오답만 모아서 다시 풀기 | `app/(quiz)/wrong-review/page.tsx` |
| 복습 시스템 | :x: | 스페이스드 리피티션 | - |
| 퀴즈 공유 | :x: | 링크 공유 | - |
| 다크 모드 | :white_check_mark: | 테마 전환 (Light/Dark) | `components/ui/ThemeToggle.tsx` |
| PWA | :x: | 오프라인 지원 | - |
| 프로필 페이지 | :white_check_mark: | /profile 에서 통계 표시 | `app/profile/page.tsx` |
| 학습 통계 | :white_check_mark: | 프로필 대시보드 (정답률, 스트릭 등) | `app/profile/page.tsx` |
| 유사 정답 매칭 | :white_check_mark: | Fuzzy Matching, 오타 허용 (구현 완료) | `lib/quiz/answerMatcher.ts` |
| 다중 정답 지원 | :white_check_mark: | AI 프롬프트 강화, 동의어/영문/약칭 대안 | `lib/ai/prompts.ts` |
| 퀴즈 수정 (편집 페이지) | :white_check_mark: | /quiz-edit/[id] 개별 UPDATE | `app/(main)/quiz-edit/` |
| 플레이 중 문제 수정 | :white_check_mark: | 답변 후 즉시 수정, 본인 퀴즈만 | `components/quiz/EditQuestionModal.tsx` |
| 오류 신고 | :x: | 퀴즈 오류 피드백 | - |

---

## 개발 우선순위 (추천)

### 즉시 구현 가능 (Supabase 없이)
1. **사운드 효과** - 효과음 추가
2. **다크 모드** - 테마 전환
3. **퀴즈 재도전** - 결과 화면에서 다시 풀기

### Supabase 연동 후
1. **회원가입/로그인**
2. **퀴즈 저장** (로컬 → DB)
3. **XP/레벨 시스템**
4. **오답노트**
5. **뱃지 시스템**
6. **리더보드**

### 나중에
1. **PWA 지원**
2. **복습 알고리즘**
3. **퀴즈 공유**
4. **학습 통계 대시보드**

---

## 기술 부채

| 항목 | 우선순위 | 설명 |
|------|:--------:|------|
| 테스트 코드 | 중 | Jest/Vitest 단위 테스트 추가 |
| E2E 테스트 | 낮 | Playwright 통합 테스트 |
| 접근성 | 중 | 키보드 네비게이션, 스크린 리더 |
| 성능 최적화 | 낮 | 번들 사이즈, 이미지 최적화 |
| 에러 모니터링 | 중 | Sentry 연동 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2026-01-15 | 최초 작성, Phase 0-3 완료 표시 |
| 2026-01-17 | 사운드 효과 구현 완료 (useQuizSound, SoundContext, SoundToggle) |
| 2026-01-21 | Phase 4 Supabase 인증/DB 완료 (이메일 인증, DB 스키마, 퀴즈 저장) |
| 2026-01-21 | Phase 5 XP/레벨/스트릭 시스템 구현 (XPGainDisplay, useQuizSession) |
| 2026-01-22 | 프로필 페이지 구현 (/profile) |
| 2026-01-24 | 퀴즈 재도전 기능 완료 표시 (이미 구현되어 있던 기능 확인) |
| 2026-01-24 | 문제 풀(Question Pool) 시스템 기획 추가 (Phase 1 보강) |
| 2026-01-26 | 문제 은행(Question Bank) 구현 완료 및 UI/UX 개선 (다크모드, 헤더, 통계) |
| 2026-01-27 | 진입 경로 기반 동적 네비게이션 적용 및 레이아웃 안정화 (컴포넌트 리마운트 버그 수정) |
| 2026-01-28 | 유사 정답 매칭 및 다중 정답 기능 구현 완료 (Phase 6 완료) |
| 2026-01-30 | Gemini 모델명 수정 (gemini-2.0-flash), 다중 정답 프롬프트 강화 |
| 2026-01-30 | 플레이 중 문제 수정 기능 구현 (EditQuestionModal, 소유권 확인) |
| 2026-01-30 | 오답노트 기능 완료 (퀴즈별 필터링 + 오답 복습 모드) |
| 2026-01-31 | 뱃지 시스템 구현 (데이터 모델, RPC 함수, UI 컴포넌트 통합) |
| 2026-01-31 | 퀴즈 생성 시 '최근 문제 제외' 옵션 추가 (Duplicate Prevention) |
