# 🎮 BrainRotQuiz - AI 기반 게이미피케이션 퀴즈 앱 PRD

> **문서 버전**: v1.1
> **최종 수정일**: 2026-01-15
> **작성자**: AI Assistant

---

## 1. 제품 개요 (Overview)

### 1.1 제품명
**BrainRotQuiz**

### 1.2 제품 비전
> *"읽기 어려운 문장들을 재미있게 퀴즈로 변환하여 학습 효율을 극대화하는 게이미피케이션 퀴즈 앱"*

지루한 텍스트 문서를 **중독성 있는 듀오링고 스타일의 퀴즈**로 변환하여 학습 효율을 극대화합니다.

### 1.3 핵심 가치 제안
| 가치 | 설명 |
|------|------|
| **즉각적 변환** | 텍스트를 입력하면 몇 초 만에 퀴즈로 변환 |
| **게이미피케이션** | 콤보, 스트릭, 레벨업 시스템으로 학습 동기 부여 |
| **적응형 학습** | 틀린 문제를 반복 학습하는 스마트 복습 시스템 |
| **감각적 피드백** | 시각/청각 효과로 즐거운 학습 경험 제공 |

---

## 2. 사용자 요구사항 및 기능 (Requirements)

### 2.1 기능 우선순위 매트릭스

| 우선순위 | 구분 | 기능명 | 상세 내용 |
|:--------:|------|--------|-----------|
| **P0** | Core | AI 퀴즈 엔진 | 텍스트 분석 → 객관식, OX, 단답형 문제 자동 생성 |
| **P0** | UX | 게이미피케이션 UI | 진행 바, 콤보 시스템, 즉각적 시각 효과 |
| **P0** | Core | 멀티 모델 폴백 | Gemini → GPT → Claude 순차 전환으로 안정성 확보 |
| **P1** | Audio | 사운드 피드백 | 정답/오답 시 청각적 피드백 효과음 |
| **P1** | UX | 반응형 디자인 | 모바일/태블릿/데스크톱 완벽 지원 |
| **P2** | Data | 학습 리포트 | 틀린 문제 복습 로직 + 학습 통계 대시보드 |
| **P2** | Social | 공유 기능 | 퀴즈 링크 공유, 친구와 경쟁 |
| **P2** | Gamification | 리더보드 | 전체/친구 랭킹, 주간/월간 순위 |
| **P2** | Gamification | 뱃지/업적 | 학습 마일스톤 달성 시 뱃지 획득 |
| **P3** | UX | 퀴즈 재도전 | 동일 퀴즈 다시 풀기 기능 |
| **P3** | Data | 오답노트 | 틀린 문제 저장 및 모아보기 |
| **P3** | UX | 다크 모드 | 시스템/수동 테마 전환 |
| **P3** | Mobile | PWA 지원 | 오프라인 학습, 홈 화면 추가 |

### 2.2 사용자 플로우

```
[📄 문서 업로드] → [🤖 AI 분석] → [📝 퀴즈 생성] → [🎮 퀴즈 풀이]
                                                          ↓
                                              ┌───────────┴───────────┐
                                              ↓                       ↓
                                         [✅ 정답]              [❌ 오답]
                                              ↓                       ↓
                                    [🎉 콤보 증가 + 효과]    [💡 정답 표시 + 복습]
                                              ↓                       ↓
                                              └───────────┬───────────┘
                                                          ↓
                                                   [🏆 결과 화면]
```

### 2.3 퀴즈 유형

> **핵심 컨셉**: 모든 퀴즈는 **빈칸 채우기** 기반. 난이도에 따라 보기 제공 여부가 달라짐.

| 유형 | 설명 | 난이도 | 예시 |
|------|------|:------:|------|
| **빈칸 + 4지선다** | 빈칸에 들어갈 답을 4개 보기 중 선택 | ⭐ | `[____]는 UI 라이브러리다` → A)Vue B)React C)Angular D)Svelte |
| **빈칸 + 주관식** | 빈칸에 직접 타이핑 | ⭐⭐⭐ | `[____]는 UI 라이브러리다` → 직접 입력 |
| **OX 퀴즈** | 문장의 참/거짓 판단 | ⭐⭐ | "React는 Google이 개발했다" → O/X |

### 2.4 AI 퀴즈 생성 로직 (핵심)

**🎯 1차 퀴즈 구조: 빈칸 채우기**

긴 지문에서 핵심 내용을 파악하고 빈칸 채우기 퀴즈를 생성하는 것이 기본 전략입니다.

#### Step 1: 핵심 문장 추출
- 자료로 제공된 텍스트 전체를 분석
- 전체 맥락을 관통하는 **핵심 문장**을 여러 개 추출
- 원문의 의미를 해치지 않도록 가급적 **그대로 유지**

#### Step 2: 키워드 선정 및 빈칸 처리
- 각 문장에서 가장 핵심이 되는 **키워드** 선정 (1개 또는 여러 개)
- 선정된 키워드를 빈칸(`[____]`)으로 변환

#### Step 3: 보기 옵션 (선택적)
| 모드 | 설명 | 난이도 |
|------|------|--------|
| **객관식** | 4개의 보기 제공 | ⭐ 쉬움 |
| **주관식** | 보기 없이 직접 입력 | ⭐⭐⭐ 어려움 |

#### 예시

**원문:**
> "React는 Facebook이 개발한 UI 라이브러리로, 가상 DOM을 사용하여 성능을 최적화한다."

**생성된 퀴즈:**
```
문제: React는 [____]이 개발한 UI 라이브러리로, [____]을 사용하여 성능을 최적화한다.

정답: Facebook, 가상 DOM

보기 (객관식 모드):
A) Google, Shadow DOM
B) Facebook, 가상 DOM  ✅
C) Microsoft, Real DOM
D) Apple, Virtual Tree
```

---

## 3. 기술 스택 및 아키텍처

### 3.1 기술 스택

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│  Next.js 14+ │ TypeScript │ Framer Motion │ Tailwind   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    AI Gateway Layer                     │
│         Vercel AI SDK (멀티 모델 통합 인터페이스)          │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│    │ Gemini  │  │  GPT-4  │  │ Claude  │              │
│    │  2.0    │  │   mini  │  │  3.5    │              │
│    └─────────┘  └─────────┘  └─────────┘              │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      Backend                            │
│    Supabase (Auth + Database + Storage + Realtime)     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 AI 멀티 모델 폴백 전략

```typescript
// 의사 코드: 폴백 로직
const models = [
  { name: 'gemini-2.0-flash', priority: 1 },  // 무료 한도 높음
  { name: 'gpt-4o-mini', priority: 2 },       // 저비용 대안
  { name: 'claude-3.5-haiku', priority: 3 },  // 최종 폴백
];

async function generateQuiz(content: string) {
  for (const model of models) {
    try {
      return await callModel(model.name, content);
    } catch (error) {
      if (error.status === 429) continue; // Rate limit → 다음 모델
      throw error;
    }
  }
  throw new Error('모든 모델 사용 불가');
}
```

```

### 3.3 문제 풀 (Question Pool) 시스템

> **목적**: 긴 텍스트의 경우 한 번에 최대 수량(30~50개)을 생성하여 저장하고, 사용자가 끊김 없이 이어 풀 수 있도록 지원합니다.

**핵심 로직:**
1. **용량 분석**: 텍스트 분석을 통해 생성 가능한 최대 문제 수(`capacity.max`) 계산
2. **선제적 생성**: 사용자 요청 수보다 넉넉하게(최대 50개) 생성하여 `quiz_pools` 테이블에 저장
3. **이어 풀기**: 퀴즈 종료 후 "더 풀기" 클릭 시, AI 대기 없이 저장된 풀에서 즉시 문제 로드

**기대 효과:**
- **비용 절감**: 동일 텍스트에 대한 반복적 AI 호출 방지
- **경험 개선**: 첫 로딩 이후에는 지연 시간(Latency) 제로에 가까운 경험
- **데이터 축적**: 양질의 퀴즈 데이터셋 자연스러운 확보

### 3.4 핵심 기술 결정

| 영역 | 선택 | 근거 |
|------|------|------|
| **프레임워크** | Next.js 14+ | App Router, Server Actions, 빠른 초기 로드 |
| **AI SDK** | Vercel AI SDK | 멀티 모델 통합, 스트리밍 지원 |
| **애니메이션** | Framer Motion | 선언적 API, 성능 최적화 |
| **DB/Auth** | Supabase | 로컬 개발 지원, 무료 티어, 실시간 기능 |
| **스타일링** | Tailwind CSS | 빠른 개발, 일관된 디자인 시스템 |

---

## 4. 데이터베이스 스키마 (ERD 초안)

### 4.1 핵심 테이블

```
users ─────────────────┬──────────────────→ documents
  │                    │                        │
  │ (1:N)              │ (1:N)                  │ (1:N)
  ▼                    ▼                        ▼
quiz_sessions      user_achievements        quizzes
  │                                             │
  │ (1:N)                                       │ (1:N)
  ▼                                             ▼
answers                                    questions
```

### 4.2 테이블 정의

**users**
- `id` (UUID, PK)
- `email` (String)
- `name` (String)
- `total_xp` (Int)
- `current_streak` (Int)
- `created_at` (Timestamp)

**documents**
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `title` (String)
- `content` (Text)
- `file_url` (String)
- `created_at` (Timestamp)

**quizzes**
- `id` (UUID, PK)
- `document_id` (UUID, FK)
- `title` (String)
- `question_count` (Int)
- `created_at` (Timestamp)

**questions**
- `id` (UUID, PK)
- `quiz_id` (UUID, FK)
- `type` (Enum: mcq|ox|short|fill)
- `question_text` (Text)
- `options` (JSON)
- `correct_answer` (String)
- `explanation` (Text)

**quiz_sessions**
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `quiz_id` (UUID, FK)
- `score` (Int)
- `max_combo` (Int)
- `xp_earned` (Int)
- `started_at` (Timestamp)
- `completed_at` (Timestamp)

**answers**
- `id` (UUID, PK)
- `session_id` (UUID, FK)
- `question_id` (UUID, FK)
- `user_answer` (String)
- `is_correct` (Boolean)
- `time_spent_ms` (Int)

**review_queue** (복습 대기열)
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `question_id` (UUID, FK)
- `next_review_at` (Timestamp)
- `review_count` (Int)

**badges** (뱃지/업적)
- `id` (UUID, PK)
- `name` (String)
- `description` (Text)
- `icon_url` (String)
- `condition_type` (Enum: streak|xp|quiz_count|combo|perfect)
- `condition_value` (Int)

**user_badges** (사용자 획득 뱃지)
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `badge_id` (UUID, FK)
- `earned_at` (Timestamp)

**leaderboard_cache** (리더보드 캐시)
- `id` (UUID, PK)
- `user_id` (UUID, FK)
- `period` (Enum: weekly|monthly|all_time)
- `rank` (Int)
- `total_xp` (Int)
- `updated_at` (Timestamp)

---

## 5. UI/UX 설계 가이드

### 5.1 핵심 화면 목록

| 화면 | 설명 | 핵심 요소 |
|------|------|-----------|
| **홈** | 대시보드 | 스트릭 표시, 최근 퀴즈, XP 현황 |
| **업로드** | 문서 등록 | 드래그앤드롭, 진행률 표시 |
| **퀴즈 풀이** | 메인 게임 | 진행바, 콤보, 타이머, 애니메이션 |
| **결과** | 성과 요약 | 점수, XP 획득, 틀린 문제 목록 |
| **복습** | 재학습 | 스페이스드 리피티션 기반 |
| **오답노트** | 틀린 문제 모음 | 문제 목록, 재도전 버튼 |
| **리더보드** | 랭킹 | 주간/월간/전체 순위, 친구 순위 |
| **프로필** | 내 정보 | 뱃지, 통계, 설정 |

### 5.2 게이미피케이션 요소

| 요소 | 설명 | 구현 방식 |
|------|------|-----------|
| **콤보** | 연속 정답 시 보너스 | 2연속부터 x1.5, 5연속 x2 배율 |
| **스트릭** | 연속 학습일 | 매일 1개 퀴즈 완료 시 유지 |
| **XP** | 경험치 | 정답당 10XP, 콤보 보너스 추가 |
| **레벨** | 성장 시스템 | XP 누적으로 레벨업 |
| **뱃지** | 업적 시스템 | 마일스톤 달성 시 획득 (첫 퀴즈, 10연속 정답 등) |
| **리더보드** | 경쟁 시스템 | 주간/월간 XP 랭킹 |

### 5.3 시각/청각 피드백

```
정답 시:
  ✅ 초록색 체크 애니메이션
  🎊 Confetti 효과 (콤보 5+ 시)
  🔊 "딩동!" 효과음

오답 시:
  ❌ 빨간색 X 애니메이션
  📖 정답 + 해설 표시
  🔊 "뚜둥" 효과음
```

---

## 6. 개발 로드맵

### Phase 1: 기반 구축 (1-2주)
- [ ] Next.js 프로젝트 초기화
- [ ] Supabase 로컬 환경 설정
- [ ] 기본 DB 스키마 마이그레이션
- [ ] 인증 시스템 구현

### Phase 2: AI 엔진 개발 (1-2주)
- [ ] Vercel AI SDK 통합
- [ ] 퀴즈 생성 프롬프트 엔지니어링
- [ ] JSON 출력 파싱 및 검증
- [ ] 멀티 모델 폴백 로직 구현

### Phase 3: 핵심 UI 구현 (2-3주)
- [ ] 퀴즈 풀이 화면 개발
- [ ] 진행바 + 콤보 시스템
- [ ] Framer Motion 애니메이션
- [ ] 결과 화면

### Phase 4: 게이미피케이션 (1-2주)
- [ ] XP + 레벨 시스템
- [ ] 스트릭 로직
- [ ] 사운드 효과 통합
- [ ] 업적 시스템

### Phase 5: 고도화 (지속)
- [ ] 복습 알고리즘
- [ ] 학습 통계 대시보드
- [ ] 성능 최적화
- [ ] 클라우드 배포

---

## 7. 향후 고려사항

- **협업 모드**: 친구와 실시간 퀴즈 대결
- **AI 튜터**: 틀린 문제에 대한 개인화된 설명
- **다국어 지원**: 영어/일본어 퀴즈 생성
- **오프라인 모드**: PWA로 오프라인 학습 지원
- **소셜 로그인**: Google, Kakao, GitHub OAuth
- **퀴즈 템플릿**: 자주 쓰는 형식 저장
- **팀 학습**: 스터디 그룹 기능

---

## 8. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| v1.0 | 2026-01-12 | 최초 작성 |
| v1.1 | 2026-01-15 | 리더보드, 뱃지, 오답노트, PWA 등 기능 추가 |
