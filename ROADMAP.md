# BrainRotQuiz 개발 로드맵

> **최종 수정일**: 2026-01-15

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

## Phase 4: Supabase 인증/DB (미구현)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| Supabase 설정 | :x: | 프로젝트 연동 | - |
| 회원가입/로그인 | :x: | 이메일 인증 | - |
| 소셜 로그인 | :x: | Google, Kakao | - |
| 사용자 프로필 | :x: | 닉네임, 아바타 | - |
| DB 스키마 | :x: | 마이그레이션 | - |
| 퀴즈 저장 | :x: | 서버 DB 저장 | - |
| 세션 기록 | :x: | 풀이 기록 저장 | - |

---

## Phase 5: 게이미피케이션 확장 (미구현)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| XP 시스템 | :x: | 정답당 경험치 | - |
| 레벨 시스템 | :x: | XP 누적 레벨업 | - |
| 스트릭 | :x: | 연속 학습일 | - |
| 뱃지 시스템 | :x: | 업적 달성 뱃지 | - |
| 리더보드 | :x: | 주간/월간 랭킹 | - |
| 사운드 효과 | :x: | 정답/오답 효과음 | - |

---

## Phase 6: 추가 기능 (미구현)

| 기능 | 상태 | 설명 | 관련 파일 |
|------|:----:|------|-----------|
| 퀴즈 재도전 | :x: | 동일 퀴즈 재시작 | - |
| 오답노트 | :x: | 틀린 문제 저장 | - |
| 복습 시스템 | :x: | 스페이스드 리피티션 | - |
| 퀴즈 공유 | :x: | 링크 공유 | - |
| 다크 모드 | :x: | 테마 전환 | - |
| PWA | :x: | 오프라인 지원 | - |
| 학습 통계 | :x: | 대시보드 | - |

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
