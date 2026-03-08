# SPEC: 퀴즈 생성 파이프라인 개선 — 생성량 증가 + 변형 옵션화

> **작성일**: 2026-03-07
> **상태**: 계획됨 (3차 검증 완료)
> **관련 파일**: `lib/constants.ts`, `lib/quiz/textAnalyzer.ts`, `lib/quiz/questionPool.ts`, `lib/quiz/questionBankService.ts`, `app/api/quiz/generate/route.ts`, `app/(main)/upload/page.tsx`

---

## 1. 문제 현상: 추정치 100개 vs 실제 생성 37개

업로드 페이지에서 "총 100개 생성"이라고 표시되지만, 실제로는 37개만 생성됨.

---

## 2. 원인: 6단계 파이프라인에서의 누적 감소

### 2.1 전체 흐름도

```
[STEP 1] textAnalyzer          → "100개 가능" (이론적 추정)
              ↓
[STEP 2] questionBankService   → "100개 만들어" (목표 설정)
              ↓
[STEP 3] questionPool          → AI 70개 + 변형 30개 (역할 분배, aiRatio=0.7)
              ↓
[STEP 4] batchGenerator        → 5배치 × 7개 = 35개 (MAX_BATCHES 병목!)
              ↓
[STEP 5] 중복 제거              → ~30개 (Jaccard 유사도 0.7 + 동일정답 제거)
              ↓
[STEP 6] 변형 추가              → ~37개 (기계적 변형으로 약간 보충)
              ↓
         최종 결과: 37개
```

### 2.2 각 단계별 상세

#### STEP 1: 텍스트 용량 추정 (`textAnalyzer.ts`)

`calculateQuestionCapacity()` 함수가 텍스트 길이/문장수/키워드 수로 **이론적 최대치**를 계산.

```
8000자 입력 시:
  문자 기반: 8000 / 100(CHARS_PER_QUESTION) = 80개
  문장 기반: 185문장 / 0.5 × 빈칸배수 = ???개
  키워드 기반: 고유키워드 / 5 = ???개
  → 정보밀도 가중치(0.6~1.0) 적용
  → MAX_CAPACITY=100 에 도달
```

**문제점**: 이 추정치는 실제 AI 생성 능력과 무관한 이론값.

#### STEP 2: 은행 서비스 (`questionBankService.ts:124-125`)

```typescript
const targetGenerate = maxGenerate ?? capacity.max;  // 100
const bankSize = Math.min(MAX_BANK_CAPACITY, targetGenerate);  // min(100, 100) = 100
```

"더 풀기" 기능을 위해 최대한 많이 생성하여 DB에 저장해두려는 설계.

#### STEP 3: 문제 풀 역할 분배 (`questionPool.ts:114`)

```typescript
const aiTargetCount = Math.ceil(adjustedTarget * fullConfig.aiRatio);
// = Math.ceil(100 * 0.7) = 70
```

- **aiRatio=0.7**: 목표의 70%만 AI에게 요청
- **transformRatio=0.3**: 나머지 30%는 기계적 변형으로 채움

#### STEP 4: 배치 생성기 — 핵심 병목 (`batchGenerator.ts:192-198`)

```typescript
const targetWithOverproduction = Math.ceil(70 * 1.5);  // = 105
const batchCount = Math.min(
  Math.ceil(105 / 7),  // = 15배치 필요
  fullConfig.maxBatches  // = 5 ← 여기서 잘림!
);
// → 5배치 × 7개 = 최대 35개만 생성
```

| 상수 | 현재값 | 역할 |
|------|--------|------|
| `BATCH_SIZE` | 7 | 배치당 AI에게 요청하는 문제 수 |
| `MAX_BATCHES` | 5 | 최대 AI 호출 횟수 |
| `overproductionRatio` | 1.5 | 중복 제거 대비 여유 생산 비율 |

#### STEP 5: 중복 제거 (`batchGenerator.ts:52-83`)

두 가지 기준으로 중복 판정:
1. **Jaccard 유사도 ≥ 0.7**: 문제 텍스트의 토큰을 비교
2. **같은 정답 + 같은 문제 유형**: 내용이 달라도 정답이 같으면 중복

→ 35개에서 ~30개로 감소

#### STEP 6: 변형 문제 추가 (`questionTransformer.ts`)

AI가 만든 문제를 기계적으로 변형:

| 변형 종류 | 대상 유형 | 방법 |
|-----------|----------|------|
| `swap_answer` | MCQ | 정답↔오답 교환, "맞는 것" → "틀린 것" |
| `shift_blank` | Fill | 빈칸 위치를 다른 키워드로 변경 |
| `multi_blank` | Fill | 한 문장에서 여러 키워드를 빈칸으로 |
| `negate` | OX | "이다" → "아니다", 정답 반전 |
| `shuffle_options` | MCQ | 보기 순서만 변경 |
| `mcq_to_ox` | MCQ→OX | 각 보기를 "~이다. O/X?" 형태로 변환 (기본 OFF) |

**퀄리티 문제**: 같은 내용의 짝퉁 문제이므로 학습 효과가 낮음.

---

## 3. 개선 계획

### 3.1 배치 상수 증가

**파일**: `lib/constants.ts:22-23`

| 상수 | 변경 전 | 변경 후 | 효과 |
|------|---------|---------|------|
| `BATCH_SIZE` | 7 | 10 | 배치당 더 많은 문제 생성 |
| `MAX_BATCHES` | 5 | 10 | 최대 10회 AI 호출 가능 |

→ 이론적 최대: 10 × 10 = 100개 (중복 제거 후 ~65개)

**검증 완료:**
- `batchGenerator.ts`, `questionPool.ts`에서만 사용됨 — 다른 코드 영향 없음
- 프롬프트(`prompts.ts`)에 `questionCount` 동적 삽입 → 10개 요청도 문제 없음
- 토큰 제한 없음 (Gemini 1M, GPT-4o mini 128K, Haiku 200K)
- `divideFocusAreas`: 문단 부족 시 전체 텍스트 폴백 → 안전
- `questionPool.ts:121` 임계값 변경: `aiTargetCount <= 10`이면 단일 배치 → 8~10개 요청이 더 효율적
- 조기 종료(`batchGenerator.ts:250`): 120% 도달 시 break → 정상 동작
- 테스트 파일 없음 → 상수 변경으로 인한 테스트 실패 위험 없음

### 3.2 추정 상한 보수화

**파일**: `lib/quiz/textAnalyzer.ts:37`

| 상수 | 변경 전 | 변경 후 | 이유 |
|------|---------|---------|------|
| `MAX_CAPACITY` | 100 | 80 | 실제 생성 가능량에 근접하도록 상한 조정 |

> `CHARS_PER_QUESTION`(100)은 변경하지 않음. 상한만 조정하여 이중 감소 방지.

**검증 완료:**
- `textAnalyzer.ts` 내부 상수. 외부에서 import하지 않음
- 대부분의 텍스트(8000자 이하)는 자연 계산값이 80 미만 → 실질적 영향 적음
- 10000자+ 고밀도 텍스트에서만 80 캡 적용 (상위 5~10%)
- UI "총 N개 생성" 표시가 자동으로 80 이하로 변경됨
- `questionBankService.ts:25`의 `MAX_BANK_CAPACITY=100` → `80`으로 통일
  (capacity.max ≤ 80이면 `min(100, 80)` = 항상 80 → 100이 죽은 상수가 되므로)

### 3.3 변형 기능 옵션화 (UI 토글)

**파일**: `app/(main)/upload/page.tsx`

- `enableTransform` state 추가 (기본값: `false`)
- AI 모델 선택 아래에 토글 버튼 추가 (기존 난이도/모델 선택과 동일한 버튼 스타일)
  - 프로젝트에 전용 Toggle 컴포넌트 없음 → 기존 버튼 패턴(`border-2 p-3 rounded-lg`) 사용
- API 호출 시 `enableTransform` 값을 request body에 포함
- 토글 OFF 시: AI 100% 생성 (변형 없음)
- 토글 ON 시: 기존 방식 (aiRatio=0.7, 변형 30%)

**검증 완료:**
- 업로드 페이지가 `/api/quiz/generate`의 **유일한 호출자** → 다른 페이지 수정 불필요
- API route에 Zod 검증/미들웨어 필터링 없음 → 새 필드 자동 수용

### 3.4 API/백엔드에서 변형 옵션 전달

총 **3개 코드 경로** 처리:

#### 경로 A: DB 은행 시스템 (500자 이상) — `route.ts:146-217`

```
route.ts → getOrGenerateQuestionBank() → generateQuestionPool()
```

- `route.ts`: request body에서 `enableTransform` 파싱 (기본: `false`)
- `questionBankService.ts`:
  - 함수 시그니처에 `enableTransform` 파라미터 추가
  - **뱅크 해시에 `enableTransform` 포함** → 변형 ON/OFF 별도 뱅크 생성
  - `generateQuestionPool()` 호출 시 config에 `enableTransform` 전달

#### 경로 B: 메모리 풀 시스템 (500자 미만, 대량 요청) — `route.ts:219-284`

```
route.ts → generateQuestionPool() 직접 호출
```

- **현재 문제**: `aiRatio: 0.7`, `transformRatio: 0.3` 하드코딩됨 (line 224-225)
- `enableTransform`에 따라 조건부 설정:
  - OFF: `enableTransform: false` → questionPool이 내부에서 aiRatio=1.0 처리
  - ON: 기존 동작 유지

#### 경로 C: 하이브리드 캐시 (짧은 텍스트, 소량) — `route.ts:286-331`

- `generateQuiz()` 직접 호출 → 변형 로직 없음
- **변경 불필요**

### 3.5 뱅크 해시에 enableTransform 포함

**파일**: `lib/quiz/questionBankService.ts:63-79, 140`

**핵심**: `questionBank.ts:133`의 `getOrCreateBank`도 **내부에서 해시를 재계산**함. 조회용 해시와 생성용 해시가 일치해야 하므로, `modelKey`에 transform 정보를 합쳐서 전달.

```typescript
// 변경 전:
const modelKey = (options.preferredModel && options.preferredModel !== 'auto')
  ? options.preferredModel : undefined;
const hashInput = modelKey ? `${content}:${modelKey}` : content;

// 변경 후: modelKey에 transform 정보를 합침
const rawModelKey = (options.preferredModel && options.preferredModel !== 'auto')
  ? options.preferredModel : undefined;
const transformKey = enableTransform ? 'transform' : 'pure';
const modelKey = rawModelKey
  ? `${rawModelKey}:${transformKey}`
  : transformKey;
// → hashInput = `${content}:${modelKey}` (modelKey가 항상 존재)

// getOrCreateBank에도 동일 modelKey 전달 → 내부 해시 일치
const createResult = await getOrCreateBank(content, capacity.max, modelKey);
```

**이유**: `getOrCreateBank` (`questionBank.ts:133`)도 `modelKey`로 해시를 재계산함. `modelKey`에 transform 정보를 합치면 **조회/생성 해시가 자동으로 일치** → `questionBank.ts` 수정 불필요.

**검증 완료:**
- `questionBankService.ts:78` (조회 해시)와 `questionBank.ts:133` (생성 해시)가 동일 `modelKey` 사용 → 일치 ✅
- `saveQuestionsToBank(bankId, poolResult.questions, 'ai')` — `poolResult.questions`는 AI+변형이 섞인 배열
- `source_type` 컬럼은 전체 배열에 동일 값(`'ai'`) 적용 → 개별 필터링 불가
- 따라서 **해시 분리가 가장 간단하고 확실한 해결책**

### 3.6 questionPool 내부 처리

**파일**: `lib/quiz/questionPool.ts`

`QuestionPoolConfig` 인터페이스에 `enableTransform?: boolean` 추가 (기본: `true`로 하위 호환).

```typescript
// enableTransform=false일 때 config 오버라이드:
const effectiveAiRatio = fullConfig.enableTransform === false ? 1.0 : fullConfig.aiRatio;
const effectiveTransformRatio = fullConfig.enableTransform === false ? 0 : fullConfig.transformRatio;
```

→ `transformRatio=0`이면 STEP 6 변형 단계가 자연스럽게 스킵됨
  (line 151: `transformTarget > 0 && fullConfig.transformRatio > 0` 조건 불충족)

**검증 완료:**
- `QuestionPoolConfig`은 `lib/quiz/index.ts`에서 re-export됨 — 타입 추가는 하위 호환
- `DEFAULT_POOL_CONFIG`의 기본값은 기존 동작 유지 (`aiRatio: 0.7`)
- `enableTransform=false` + `aiRatio=1.0`이면 AI가 목표 전체를 담당
  → 변형 단계의 `transformTarget = adjustedTarget - allQuestions.length`가 0 이하 → 자연 스킵

### 3.7 Vercel 타임아웃 설정

**파일**: `app/api/quiz/generate/route.ts` (기존 파일에 추가)

```typescript
// route.ts 최상단 export 추가
export const maxDuration = 60;
```

Next.js Route Segment Config 공식 기능. `vercel.json` 신규 생성 없이 해당 라우트에만 60초 타임아웃 적용.

배치당 AI 호출 3~8초 × 10배치 = 30~80초. Vercel 기본 타임아웃(30초) 초과 가능.

### 3.8 `enableTransform` 전달 방식 — 타입 변경 없이 별도 변수

```
route.ts에서 body.enableTransform 파싱
  ↓
경로 A: getOrGenerateQuestionBank(..., enableTransform) → 별도 파라미터
  ↓
경로 B: generateQuestionPool(content, options, { enableTransform }) → config에 포함
```

`QuizGenerationOptions` 타입, `hashOptions()` (캐시 해시) 모두 변경 불필요.
- 경로 C(하이브리드)는 변형 로직이 없으므로 전달할 필요 없음
- `quizCache.ts`의 캐시 해시도 영향 없음

---

## 4. 개선 후 예상 흐름 (변형 OFF 기준)

```
[STEP 1] textAnalyzer          → "80개 가능" (보수적 추정)
              ↓
[STEP 2] questionBankService   → "80개 만들어" (목표 설정, 별도 뱅크)
              ↓
[STEP 3] questionPool          → AI 80개 전량 요청 (aiRatio=1.0)
              ↓
[STEP 4] batchGenerator        → 최대 10배치 × 10개 = 100개 raw
              ↓
[STEP 5] 중복 제거              → ~65개
              ↓
[STEP 6] 변형 스킵              → 그대로 ~65개
              ↓
         최종 결과: ~65개 ← 추정치 80개에 근접
```

---

## 5. 검증에서 확인된 사항

### 5.1 뱅크 캐시 분리 (해시에 enableTransform 포함)

- 변형 ON으로 생성한 뱅크: AI + 변형 문제 혼합 저장됨
- 변형 OFF로 생성한 뱅크: AI 문제만 저장됨
- **해시에 enableTransform 포함하여 별도 뱅크로 분리** → 캐시 히트 시 정확한 결과 반환
- "더 풀기"(`load-more`)도 해당 뱅크에서 가져오므로 일관성 유지

### 5.2 load-more API 영향 없음 (안전)

- `app/api/quiz/load-more/route.ts`: BATCH_SIZE, MAX_BATCHES, enableTransform 모두 참조 안 함
- 뱅크에 저장된 문제를 그대로 반환 → 뱅크 분리로 자동 해결

### 5.3 SESSION_SIZE.MAX=20 vs MAX_CAPACITY=80

- UI 슬라이더 최대값: `min(SESSION_SIZE.MAX=20, capacity.max)` = **20**
- "총 80개 생성"은 은행 전체 용량 (더 풀기용)
- 세션당 최대 20개 → 기존 설계 유지
- `QUESTION_COUNT.MAX=100`은 API 검증용 → 변경 불필요 (독립적)

### 5.4 기존 뱅크(BATCH_SIZE=7 시절) 처리

- 기존 뱅크(~37문제)는 그대로 유지
- `sessionSize`(3~20) 충분히 서빙 가능 → 캐시 히트로 정상 동작
- 30일 TTL 만료 후 자연 재생성 시 새 상수 적용
- 별도 마이그레이션 불필요

### 5.5 캐시 해시(quizCache) 영향 없음

- `quizCache.ts`의 `hashOptions()`는 경로 C(하이브리드)에서만 사용
- 경로 C는 변형 로직 없음 → `enableTransform` 해시 포함 불필요

### 5.6 UI 진행바 퍼센트 (기존 이슈, 범위 밖)

- `questionCount/capacity.max`로 계산 → MAX_CAPACITY 변경 시 퍼센트 미세 변동
- 기존에도 20/100=20%로 오해 소지 있었음 → 이번 작업과 무관, 별도 이슈

---

## 6. 수정 파일 목록

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `lib/constants.ts` | `BATCH_SIZE=10`, `MAX_BATCHES=10` |
| 2 | `lib/quiz/textAnalyzer.ts` | `MAX_CAPACITY=80` |
| 3 | `lib/quiz/questionBankService.ts` | `MAX_BANK_CAPACITY=80`, 함수에 `enableTransform` 파라미터 추가, 뱅크 해시에 포함 |
| 4 | `lib/quiz/questionPool.ts` | `QuestionPoolConfig`에 `enableTransform` 추가, 조건부 aiRatio/transformRatio 처리 |
| 5 | `app/api/quiz/generate/route.ts` | `export const maxDuration = 60` 추가, `enableTransform` 파싱, 경로 A(bankService)/B(pool 직접) 모두 전달 |
| 6 | `app/(main)/upload/page.tsx` | 변형 토글 버튼 UI 추가 (기존 버튼 패턴), API 호출 시 전달 |

> `types/index.ts`의 `QuizGenerationOptions` 타입은 변경하지 않음.
> `enableTransform`은 route.ts에서 별도 변수로 파싱하여 각 경로에 직접 전달.

---

## 7. 검증 방법

1. `npm run build` 성공 확인
2. 업로드 페이지에서 변형 토글 ON/OFF 동작 확인
3. 8000자 텍스트로 변형 OFF 생성 → 서버 로그에서 `aiRatio=1.0`, 변형 스킵 확인
4. 같은 텍스트로 변형 ON 생성 → 별도 뱅크 생성 확인 (해시 다름)
5. "더 풀기" → 각 뱅크에서 올바른 문제 반환 확인

---

## 8. 미결 사항 (이번 작업 범위 밖)

- [ ] UI 진행바가 세션 크기가 아닌 은행 용량 기준으로 퍼센트 표시하는 문제 (기존 이슈)
