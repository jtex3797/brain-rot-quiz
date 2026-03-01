# SPEC: AI 모델 선택 기능

> **분류**: Feature Spec (신규 기능 설계)
> **작성일**: 2026-02-27
> **상태**: 구현 대기
> **관련 문서**: `Architecture_Hybrid Quiz Generation.md`, `PRD.md`

---

## 한 줄 요약

퀴즈 생성 시 사용자가 AI 모델(Gemini / GPT-4o mini / Claude Haiku / 자동)을 직접 선택할 수 있게 하고,
사용된 모델 정보를 DB에 저장하여 결과 화면 및 내 퀴즈 목록에 배지로 표시한다.

---

## ⚠️ 검증 결과 (구현 전 필독)

> 12차 코드베이스 전수 검증 완료 (2026-02-28). 설계 변경이 필요한 이슈 18건 발견. (I-19 허위 양성 → 제거)

| # | 이슈 | 심각도 | 해결책 | 상태 |
|---|------|--------|--------|------|
| I-1 | `hashOptions()`가 `preferredModel` 미포함 → 모델 달라도 동일 캐시 히트 | **CRITICAL** | `hashOptions()`에 `preferredModel` 추가 | 설계 반영 ✅ |
| I-2 | 500자+ (DB 은행 시스템) `model: 'db-bank-system'` 하드코딩 → 실제 모델명 소실 | **MAJOR** | Strict 모드 시 `preferredModel` 우선 반환 | 설계 반영 ✅ |
| I-3 | `QuizPlayer → QuizResult` prop 전달 명세 누락 | **MINOR** | 명시적 prop 전달 추가 | 설계 반영 ✅ |
| I-4 | `QuizResult` props에 `modelUsed` 타입 추가 필요 | **MINOR** | 이미 설계 포함 | 확인 완료 ✅ |
| I-5 | `pool-system` 경로도 `model: 'pool-system'` 하드코딩 — I-2와 동일 문제, 미처리 | **MAJOR** | I-2와 동일한 Strict 분기 fix 적용 | 설계 반영 ✅ |
| I-6 | 캐시 히트 시 `model: 'gemini-2.0-flash (cached)'` → `getModelDisplayName()` 매칭 실패 → 배지에 raw 문자열 노출 | **MAJOR** | `getModelDisplayName()`에서 `' (cached)'` suffix 제거 후 조회 | 설계 반영 ✅ |
| I-7 | `app/api/quiz/save/route.ts`가 `toDbQuiz()` 미사용 — inline insert 직접 구현. 스펙 8번 구현 경로 틀림 | **MAJOR** | `toDbQuiz()` 아닌 inline insert에 `ai_model` 직접 추가 | 설계 반영 ✅ |
| I-8 | save API에 `aiModel: data.model` 전달 시 Auto 모드에서 `'db-bank-system'`·`'pool-system'` 같은 시스템 문자열이 DB에 저장됨 | **MAJOR** | `aiModel: selectedModel` (프론트 state 값)으로 전달 — 항상 `'auto'` 또는 모델 ID로 클린 | 설계 반영 ✅ |
| I-9 | `upload/page.tsx` quiz 객체 구성 시 `modelUsed` 미설정 → localStorage 퀴즈에 `modelUsed` 없음 → 비로그인 결과 화면 배지 미표시 | **MAJOR** | quiz 객체에 `modelUsed: (selectedModel !== 'auto') ? data.model : undefined` 명시 추가 | 설계 반영 ✅ |
| I-10 | 상수 파일 경로 오류 — 스펙 전체에서 `lib/constants/constants.ts` 참조하나 실제 파일은 `lib/constants.ts` | **CRITICAL** | 경로 `lib/constants.ts`로 수정 | 설계 반영 ✅ |
| I-11 | `batchGenerator.ts` catch 블록이 `generateQuizWithFallback` Strict 에러를 무음 소멸 → Bank/Pool 경로(500자+ 대부분)에서 Strict 실패 시 generic 500 반환, 모델 특정 에러 메시지 소실 | **MAJOR** | `route.ts`에서 Bank/Pool 결과 후 `questions.length === 0 && preferredModel`이면 Strict 에러 메시지 반환 | 설계 반영 ✅ |
| I-12 | `generate.ts` catch 블록에서 `INVALID_API_KEY`가 Strict 체크보다 먼저 throw → Hybrid 경로 Strict 실패 시 Strict 전용 메시지 대신 "API 키가 유효하지 않습니다" 반환. Bank/Pool 경로는 I-11 fix로 보호됨 | **MINOR** | `generateQuizWithFallback()` catch 블록에서 `logger.error()` 직후, `classifyError()` 호출 **이전**에 `isStrict` 체크 추가 (섹션 5.1 코드 예시 참조) | 설계 반영 ✅ |
| I-13 | `types/supabase.ts` `DbSavedQuizUpdate` 타입에 `ai_model` 누락 — Row/Insert에만 추가됨 | **MINOR** | `DbSavedQuizUpdate`에도 `ai_model?: string \| null` 추가 | 설계 반영 ✅ |
| I-14 | `VALID_MODEL_VALUES.includes(preferredModel)` TypeScript 컴파일 에러 — `VALID_MODEL_VALUES` 타입이 리터럴 유니온 배열이라 `string` 타입 인수 불허 | **MINOR** | `(VALID_MODEL_VALUES as string[]).includes(preferredModel)` 으로 캐스팅 | **⬅ 신규** |
| I-15 | `QuizResult.tsx` 배지 조건에 `modelUsed !== 'auto'` 미포함 → DB에서 로드 시 `ai_model = 'auto'` → `modelUsed = 'auto'` → "[자동 (추천)]" 배지 표시됨 (설계 위반) | **MAJOR** | 배지 조건에 `&& modelUsed !== 'auto'` 추가. `fromDbQuiz()`에서도 `ai_model === 'auto'`이면 `undefined` 반환으로 정규화 | **⬅ 신규** |
| I-16 | 섹션 5.1 코드 예시에 `isStrict` 선언 및 `models` 배열 분기 누락 — catch 블록이 `isStrict`를 참조하지만 선언 위치가 없어 구현 불가 / 에러 메시지에 raw 모델 ID(`gemini-2.0-flash`) 노출 (섹션 3 UX 표시명과 불일치) | **MAJOR** | `generateQuizWithFallback()` 함수 진입부에 `isStrict`, `models` 분기 코드 추가. 에러 메시지에 `getModelDisplayName()` 적용 (5.1, I-11 동시 수정) | **⬅ 신규** |
| I-17 | `getOrGenerateQuestionBank()`가 `hashContent(content)`만으로 기존 은행 조회(`getBankByHash`) → Auto 모드로 생성된 은행이 있으면 Strict 모드 요청도 동일 캐시 히트 → 지정 모델이 생성하지 않은 문제 반환, 배지는 선택 모델로 표시 (설계의 "생성 투명성" 위반). I-1 fix는 `generation_cache`에만 적용되므로 question bank 캐시는 별도 대응 필수 | **CRITICAL** | 섹션 5.5 참조 — I-17 fix + I-18 fix를 합쳐 Strict 모드 early return 처리 필요 | **⬅ 신규** |
| I-18 | **[I-17 fix 불완전]** 스펙의 I-17 fix(`existingBank = isStrict ? null : ...`)는 "가져오기"만 막음. 이후 `getOrCreateBank(content, capacity.max)` 호출 시 함수 내부(`questionBank.ts:135-138`)에서 다시 `getBankByHash(contentHash)` 호출 → 기존 bank 반환 → Strict 생성 결과가 기존 bank에 저장됨 (bank 오염). 결과: quiz.bankId = 기존 Auto bank ID, "더 풀기" 시 혼합 모델 문제 노출 | **CRITICAL** | Strict 모드에서 bank 시스템 **early return** (생성 + 저장 모두 우회). 섹션 5.5 fix 완전 재작성 필요 | **⬅ 신규** |
| ~~I-19~~ | ~~**[I-16 fix 불완전 — 허위 양성]**~~ 실제 `generate.ts` 코드 확인 결과, 기존 for 루프가 이미 `for (const model of models)` 형태임 (`const models = getModelsByPriority()` 별도 선언 후 루프에서 참조). I-16 fix가 line 143만 교체하면 루프는 자동으로 새 `models`를 참조. 별도 루프 수정 불필요 → 이슈 철회. | ~~CRITICAL~~ | N/A (I-16 fix 단독으로 충분) | **❌ 철회** |

---

## 1. 배경 및 목적

### 현재 상황

현재 모든 퀴즈는 `Gemini 2.0 Flash → GPT-4o mini → Claude 3.5 Haiku` 자동 폴백 전략으로만 생성된다.

**문제점**:
- 사용자는 어떤 모델이 사용됐는지 알 수 없다
- 특정 모델을 원하는 사용자(성능 비교, 특정 모델 선호)에게 선택권이 없다
- 생성된 퀴즈의 모델 정보가 DB에 저장되지 않아 추후 조회 불가

### 해결 목표

| 목표 | 방법 |
|------|------|
| 모델 선택권 제공 | 업로드 페이지에 드롭다운 추가 |
| 생성 투명성 | 결과 화면에 실제 사용 모델 배지 표시 |
| 히스토리 추적 | `saved_quizzes.ai_model` 컬럼으로 DB 저장 |

---

## 2. 결정사항 (Decision Log)

| 항목 | 결정 | 이유 |
|------|------|------|
| UI 방식 | 드롭다운 `<select>` | 공간 효율, 4개 옵션에 적합 |
| 기본값 | `자동 (추천)` | 기존 폴백 동작 유지, 무조건 안전한 기본값 |
| 특정 모델 실패 시 폴백 | **없음** (에러 반환) | 사용자가 명시적으로 선택한 모델 = 그 모델로만 시도하는 것이 의도 |
| Auto 모드 폴백 | **유지** (기존 동작) | 자동은 안정성이 목적 |
| DB 저장 | `ai_model TEXT DEFAULT 'auto'` 컬럼 추가 | 내 퀴즈 목록 표시 + 히스토리 추적 |
| 모델 배지 표시 | 결과 화면 + 내 퀴즈 목록 | 자동(`auto`)일 때는 배지 미표시 (노이즈 감소) |
| 캐시 분리 | 모델별 별도 캐시 키 | 같은 텍스트도 모델마다 다른 결과 가능 |

---

## 3. 사용자 흐름

```
[ 업로드 페이지 — 퀴즈 설정 카드 ]
  ├─ 세션당 문제 수 슬라이더  (기존)
  ├─ AI 모델 드롭다운         ← 신규
  │    ├─ 자동 (추천) [기본값]
  │    ├─ Google Gemini
  │    ├─ OpenAI GPT-4o mini
  │    └─ Claude Haiku
  ├─ 난이도 선택              (기존)
  └─ [퀴즈 생성하기] 버튼

자동 모드 선택 → 생성
  └─ 기존 폴백 전략 (Gemini → GPT → Claude)
  └─ 결과 화면: 배지 없음

특정 모델 선택 → 생성
  └─ 해당 모델만 시도 (Strict)
  └─ 성공: 결과 화면에 [Google Gemini] 배지
  └─ 실패: "Gemini 모델 사용 중 오류가 발생했습니다. 다른 모델을 선택하거나 자동 모드를 사용해주세요."

내 퀴즈 목록
  └─ 모델 지정 생성 퀴즈: 난이도 배지 옆에 [Google Gemini] 배지
  └─ 자동 생성 퀴즈: 배지 없음
```

---

## 4. 데이터 설계

### 4.1 DB 스키마 변경

**마이그레이션**: `lib/supabase/migrations/004_add_ai_model.sql`

```sql
ALTER TABLE public.saved_quizzes
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'auto';

COMMENT ON COLUMN public.saved_quizzes.ai_model
  IS 'AI 모델 ID. 값: auto | gemini-2.0-flash | gpt-4o-mini | claude-3-5-haiku-20241022';
```

### 4.1-a [I-1 수정] hashOptions() 업데이트

**`lib/cache/quizCache.ts`** — `hashOptions()` 수정 필요

현재 코드 (`lib/cache/quizCache.ts:56-62`):
```ts
// 현재: difficulty, questionCount만 해싱 → preferredModel 달라도 같은 캐시 키
export async function hashOptions(options: QuizGenerationOptions): Promise<string> {
  const normalized = JSON.stringify({
    difficulty: options.difficulty,
    questionCount: options.questionCount,
  });
  return hashContent(normalized);
}
```

수정 후:
```ts
// preferredModel 추가 → 모델별 캐시 자동 분리
export async function hashOptions(options: QuizGenerationOptions): Promise<string> {
  const normalized = JSON.stringify({
    difficulty: options.difficulty,
    questionCount: options.questionCount,
    preferredModel: options.preferredModel, // 추가
  });
  return hashContent(normalized);
}
```

> **하위 호환성**: Auto 모드 (`preferredModel: undefined`) → 기존 캐시 키와 동일. 캐시 호환 유지.

---

### 4.2 타입 변경

**`types/index.ts`**

```ts
// 추가 필드
QuizGenerationOptions.preferredModel?: string
Quiz.modelUsed?: string
```

**`types/supabase.ts`**

```ts
// DbSavedQuiz Row
ai_model: string | null

// DbSavedQuizInsert
ai_model?: string | null

// DbSavedQuizUpdate  [I-13]
ai_model?: string | null
```

### 4.3 상수 정의

> **[I-10] 주의**: 실제 파일 경로는 `lib/constants.ts` (단일 파일). `lib/constants/constants.ts` 경로는 존재하지 않음.

**`lib/constants.ts`** 추가:

```ts
export type ModelOption =
  | 'auto'
  | 'gemini-2.0-flash'
  | 'gpt-4o-mini'
  | 'claude-3-5-haiku-20241022';

export const MODEL_OPTIONS = [
  { value: 'auto',                        label: '자동 (추천)',        description: '빠르고 안정적인 폴백 전략' },
  { value: 'gemini-2.0-flash',           label: 'Google Gemini',      description: '무료 한도 높음, 빠른 응답' },
  { value: 'gpt-4o-mini',               label: 'OpenAI GPT-4o mini', description: '안정적, 저비용' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku',        description: '정확도 높음' },
] as const;

export const VALID_MODEL_VALUES = MODEL_OPTIONS.map((m) => m.value);

export function getModelDisplayName(model: string | null | undefined): string {
  // [I-6] ' (cached)' suffix 제거 후 조회
  const cleaned = (model ?? '').replace(' (cached)', '').trim();
  const found = MODEL_OPTIONS.find((m) => m.value === cleaned);
  return found ? found.label : (cleaned || '자동');
}
```

---

## 5. 백엔드 설계

### 5.1 AI 생성 로직 — Strict / Auto 분기

**파일**: `lib/ai/generate.ts` — `generateQuizWithFallback()`

```
options.preferredModel 없거나 'auto'
  → Auto 모드: getModelsByPriority() 전체 폴백 (기존 동작 유지)

options.preferredModel 있음
  → Strict 모드: getModelByName(preferredModel) 단일 시도
  → 실패 시: 에러 throw, 폴백 없음
  → 에러 메시지: "{표시명} 모델 사용 중 오류가 발생했습니다. 다른 모델을 선택하거나 자동 모드를 사용해주세요."
```

> **전파 경로**: `options`가 배치 생성(`batchGenerator.ts`)까지 스프레드로 전달되므로
> `QuizGenerationOptions.preferredModel` 추가만으로 자동 전파됨.

> **[I-16 신규] `isStrict` 선언 및 `models` 배열 분기**: `generateQuizWithFallback()` 함수 진입부에서
> `isStrict` 플래그와 `models` 배열을 아래와 같이 분기해야 한다. 이 코드 없이는 Strict 모드가 동작하지 않는다.
>
> ```ts
> // import 추가: lib/constants.ts 에 추가될 getModelDisplayName, getModelByName은 models.ts에 기존 존재
> // import { getModelDisplayName } from '@/lib/constants';  ← 추가 필요
>
> export async function generateQuizWithFallback(
>   content: string,
>   options: QuizGenerationOptions  // preferredModel?: string 이 추가된 타입
> ): Promise<QuizGenerationResult> {
>   const isStrict = !!(options.preferredModel && options.preferredModel !== 'auto');
>   const models = isStrict
>     ? [getModelByName(options.preferredModel!)].filter((m): m is AIModel => !!m)
>     : getModelsByPriority();
>   const errors: AIError[] = [];
>
>   // ★ 실제 코드 확인: line 148은 이미 `for (const model of models)` 형태.
>   //   line 143의 `const models = getModelsByPriority()`만 위 코드로 교체하면 됨. 루프 변경 불필요.
>   for (const model of models) {
>     // ... 이하 기존 루프 본문 그대로
> ```

> **[I-12] 구현 주의**: `generateQuizWithFallback()` catch 블록에서 `isStrict` 체크를
> **`classifyError()` 호출 이전, catch 블록 맨 위**에 추가해야 한다.
> 기존 `INVALID_API_KEY` 조기 throw(`line 207-209`)는 `classifyError` 이후에 실행되므로,
> isStrict를 그 앞에 두면 에러 종류에 관계없이 반드시 Strict 메시지가 우선한다.
>
> **에러 메시지에는 `getModelDisplayName()`을 사용해 사용자 친화적 표시명으로 노출한다**
> (`options.preferredModel` raw ID 그대로 노출 금지).
>
> ```ts
> } catch (error) {
>   // [I-12] catch 블록 맨 위: Strict 모드면 즉시 throw (classifyError 이전)
>   if (isStrict) {
>     throw new Error(
>       `${getModelDisplayName(options.preferredModel)} 모델 사용 중 오류가 발생했습니다. 다른 모델을 선택하거나 자동 모드를 사용해주세요.`
>     );
>   }
>
>   // Auto 모드: 기존 로직 유지 (아래는 기존 코드 그대로)
>   const aiError = classifyError(error, model.name);
>   errors.push(aiError);
>   if (aiError.code !== 'RATE_LIMIT') { ... }
> ```

### 5.2 캐시 키 전략

> **검증 결과 [I-1]**: `hashOptions()`는 현재 `difficulty`, `questionCount`만 해싱.
> `preferredModel`을 추가해야 모델별 캐시가 분리됨. (4.1-a 섹션 참조)

| 모드 | `preferredModel` 값 | 캐시 동작 |
|------|-------------------|-----------|
| Auto | `undefined` | 기존 캐시와 해시 동일 → 호환 유지 |
| 특정 모델 | `'gemini-2.0-flash'` 등 | 별도 캐시 항목 생성 |

```ts
// route.ts — Auto일 때 preferredModel 제외해서 기존 캐시 호환 유지
const options = {
  questionCount: sessionSize,
  difficulty,
  bypassCache,
  ...(preferredModel && preferredModel !== 'auto' ? { preferredModel } : {}),
};
```

### 5.3 API Route

**`app/api/quiz/generate/route.ts`** 변경:

```
body 파싱: preferredModel (선택값)
검증: VALID_MODEL_VALUES 포함 여부
options 구성: auto/undefined이면 제외
응답: 기존 model 필드 유지 (프론트엔드는 data.model 사용, selectedModel 별도 추가 불필요)
```

> **[I-14] 구현 주의**: `VALID_MODEL_VALUES`는 `as const`로 선언된 배열에서 파생되어 리터럴 유니온 타입
> `('auto' | 'gemini-2.0-flash' | ...)[]`으로 추론된다. `preferredModel`이 `string`이므로
> TypeScript 컴파일 에러 발생. 반드시 캐스팅 필요:
>
> ```ts
> // ❌ TS 에러: Argument of type 'string' is not assignable to ...
> if (preferredModel && !VALID_MODEL_VALUES.includes(preferredModel)) { ... }
>
> // ✅ 캐스팅으로 해결
> if (preferredModel && !(VALID_MODEL_VALUES as string[]).includes(preferredModel)) { ... }
> ```

**[I-2] + [I-5] 하드코딩된 model 필드 — 3개 경로 모두 수정**

`route.ts`에 model을 하드코딩하는 경로가 **3개** 존재한다.

| 경로 | 발동 조건 | 현재 | 수정 후 |
|------|----------|------|---------|
| DB 은행 시스템 | 500자+ 텍스트 | `'db-bank-system'` | Strict → `preferredModel`, Auto → `'db-bank-system'` |
| 메모리 풀 시스템 | 500자 미만 대량 요청 | `'pool-system'` | Strict → `preferredModel`, Auto → `'pool-system'` |
| 하이브리드 | 일반 | `result.model` (실제 모델명) | 변경 없음 ✅ |

```ts
// 공통 패턴 — 각 경로에 적용
const resolvedModel = (preferredModel && preferredModel !== 'auto')
  ? preferredModel
  : 'db-bank-system'; // 또는 'pool-system'

return NextResponse.json({ ..., model: resolvedModel });
```

> Strict 모드 성공 = preferredModel 사용 보장됨. 논리적으로 안전.
>
> **⚠️ [I-17] 주의**: 이 `resolvedModel` 패턴은 응답 `model` 필드만 수정한다.
> 실제로 Strict 모드에서 지정 모델이 문제를 생성했다는 보장은 `questionBankService.ts` 수정(5.5 섹션)이 함께 되어야 성립된다.
> I-17 fix 없이 I-2/I-5만 적용하면 배지는 "Google Gemini"를 표시하지만 실제 문제는 다른 모델 생성일 수 있음.

**[I-11] Strict 에러 무음 소멸 방지 — Bank/Pool 경로에 빈 결과 감지 추가**

`batchGenerator.ts` catch 블록이 `generateQuizWithFallback`의 Strict 에러를 삼키기 때문에,
Bank/Pool 경로에서 Strict 모드 실패 시 `questions: []`가 반환된다.
`validateQuiz()`가 잡지만 에러 메시지가 generic으로 바뀐다.
`route.ts`에서 각 경로 직후 빈 결과를 조기 감지한다.

```ts
// DB 은행 시스템 결과 직후 (Pool 경로도 동일 패턴)
// getModelDisplayName import: import { getModelDisplayName } from '@/lib/constants';
if (preferredModel && preferredModel !== 'auto' && bankResult.questions.length === 0) {
  endPipeline(false, { error: 'STRICT_MODEL_FAILED', model: preferredModel }); // ← endPipeline 필수
  return NextResponse.json(
    { success: false, error: `${getModelDisplayName(preferredModel)} 모델 사용 중 오류가 발생했습니다. 다른 모델을 선택하거나 자동 모드를 사용해주세요.` },
    { status: 500 }
  );
}
```

### 5.5 Question Bank 캐시 — Strict 모드 완전 우회 [I-17][I-18]

**파일**: `lib/quiz/questionBankService.ts` — `getOrGenerateQuestionBank()`

> **[I-17] 핵심 이슈**: 현재 은행 조회 키가 `hashContent(content)` 단독 → Auto 모드 생성 은행이 있으면 Strict 모드 요청에서도 캐시 히트. I-1 fix는 `generation_cache` 테이블의 `options_hash`에만 적용되며, `question_banks` 테이블은 별도 hash 체계 사용이므로 I-1로 해결 안 됨.
>
> **[I-18] I-17 fix 불완전 문제**: 단순히 `existingBank = isStrict ? null : ...`로 조회만 건너뛰어도, 이후 호출되는 `getOrCreateBank(content, capacity.max)`가 **내부적으로 다시 `getBankByHash(contentHash)`를 호출** (`questionBank.ts:135-138`):
> ```ts
> // getOrCreateBank 내부
> const existing = await getBankByHash(contentHash);
> if (existing) {
>   return { success: true, bank: existing }; // ← 기존 bank 반환 — Strict 우회 무력화!
> }
> ```
> 결과: Strict 생성 문제들이 기존 Auto bank에 저장됨 → bank 오염 → "더 풀기" 시 혼합 모델 문제 노출.

**올바른 fix — Strict 모드에서 bank 시스템 early return (생성·저장 모두 우회)**:

```ts
export async function getOrGenerateQuestionBank(
  content: string,
  options: QuizGenerationOptions,
  sessionSize: number,
  maxGenerate?: number
): Promise<BankGenerationResult> {
  const isStrict = !!(options.preferredModel && options.preferredModel !== 'auto');

  // [I-17][I-18] Strict 모드: bank 시스템 완전 우회 (가져오기 + 저장 모두 건너뜀)
  // - getOrCreateBank()가 내부적으로 기존 bank를 재발견하므로 early return 필수
  // - Strict 모드에서 bankId 미설정 → quiz.bankId = undefined → "더 풀기" 미지원 (의도된 동작)
  if (isStrict) {
    logger.info('Bank', '⚡ Strict 모드 — bank 시스템 우회, 직접 생성');
    const poolResult = await generateQuestionPool(content, options, {
      targetCount: sessionSize,
      bypassCapacityCheck: true,
    });
    return {
      bankId: '',           // bank 없음
      questions: poolResult.questions.slice(0, sessionSize),
      isFromCache: false,
      remainingCount: 0,    // 더 풀기 없음
      metadata: poolResult.metadata,
    };
  }

  // Auto 모드: 기존 bank 시스템 그대로
  const contentHash = await hashContent(content);
  const existingBank = await getBankByHash(contentHash);

  // ... 이하 기존 코드 그대로
```

> **설계 결정**: Strict 모드는 **"더 풀기" 미지원** (`bankId = ''` → `quiz.bankId = undefined`).
> 사용자가 특정 모델을 명시적으로 선택한 경우 해당 모델이 생성한 문제만 제공하는 것이 투명성 원칙에 부합.
> Auto 모드에서만 bank 캐시 + "더 풀기" 기능 활성화됨.
>
> **Route.ts 영향**: DB 은행 경로에서 `bankResult.bankId === ''`이면 응답에 `bankId` 미포함 처리 필요.
> (기존 코드에서 `bankId: undefined`는 정상 처리되므로 별도 수정 불필요할 수 있음 — 확인 필요)

### 5.4 Supabase 저장 흐름 [I-7 수정]

> **[I-7] 중요**: `app/api/quiz/save/route.ts`는 `toDbQuiz()`를 **사용하지 않는다**.
> `saved_quizzes`에 직접 inline insert 구현. `toDbQuiz()` 수정은 save API에 반영 안 됨.

**실제 구현 경로 — save route에 직접 추가:**

```ts
// app/api/quiz/save/route.ts line 15
const { quiz, sourceText, difficulty, aiModel } = body;  // aiModel 파싱 추가

// line 47-59 inline insert에 ai_model 추가
await supabase.from('saved_quizzes').insert({
  // ...기존 필드...
  ai_model: aiModel ?? 'auto',  // ← 직접 추가
});
```

> **[I-8] 주의**: `upload/page.tsx`에서 save API 호출 시 `aiModel: data.model`이 아닌
> `aiModel: selectedModel`을 전달해야 한다. `data.model`은 Auto 모드에서
> `'db-bank-system'`·`'pool-system'`이 될 수 있으나, `selectedModel`은 항상 사용자가
> 선택한 클린 값 (`'auto'` 또는 모델 ID)이다.

**`fromDbQuiz()` 업데이트** (`lib/supabase/quiz.ts:60-70`):
```ts
export function fromDbQuiz(dbQuiz: DbSavedQuiz, dbQuestions: DbSavedQuestion[]): Quiz {
  return {
    id: dbQuiz.id,
    title: dbQuiz.title,
    questions: dbQuestions.sort(...).map(fromDbQuestion),
    bankId: dbQuiz.bank_id ?? undefined,
    createdAt: new Date(dbQuiz.created_at),
    // [I-15] 'auto'이면 undefined 반환 (배지 미표시 보장)
    modelUsed: (dbQuiz.ai_model && dbQuiz.ai_model !== 'auto') ? dbQuiz.ai_model : undefined,
  };
}
```

> `api/quiz/[id]/route.ts`는 `fromDbQuiz()` 사용 → 자동으로 `quiz.modelUsed` 포함됨 ✅

---

## 6. 프론트엔드 설계

### 6.1 업로드 페이지 UI 구조

**`app/(main)/upload/page.tsx`**

배치: 세션당 문제 수 슬라이더 아래, 난이도 선택 위

```
퀴즈 설정 카드
 ├─ 세션당 문제 수 슬라이더
 ├─ ── 신규 ──────────────────────
 │   AI 모델 [드롭다운]
 │    ▾ 자동 (추천) — 빠르고 안정적인 폴백 전략
 ├─ ─────────────────────────────
 ├─ 난이도 선택
 └─ [퀴즈 생성하기]
```

스타일: 기존 `border border-foreground/20 bg-background` 텍스트 인풋 계열 통일

**[I-9] quiz 객체 구성 — `modelUsed` 명시 필수** (`upload/page.tsx:136-143`)

`data.quiz`에는 `modelUsed`가 없으므로 스프레드만으로는 설정되지 않는다.
localStorage 저장 전 반드시 명시해야 비로그인 사용자도 배지를 볼 수 있다.

```ts
const quiz: Quiz = {
  ...data.quiz,
  modelUsed: (selectedModel && selectedModel !== 'auto') ? data.model : undefined,  // [I-9]
  bankId: data.bankId,
  remainingCount: data.remainingCount,
  sessionSize: questionCount,
  requestedQuestionCount: questionCount,
};
```

**[I-8] save API 호출 — `selectedModel` 사용** (Auto 모드 오염 방지)

```ts
body: JSON.stringify({ quiz, sourceText: content, difficulty, aiModel: selectedModel })
//                                                                        ↑ data.model 아님
```

### 6.2 결과 화면 배지

**`components/quiz/QuizResult.tsx`**

위치: 스코어 카드(정답률 / 맞은 수 / 최대 콤보) 아래

```
┌─ 결과 화면 ─────────────────────────┐
│  🎉 훌륭해요!                        │
│                                     │
│  정답률  맞은 수  최대 콤보          │
│   80%    4/5      3                 │
│                                     │
│        [ Google Gemini ]            │  ← 신규 (modelUsed 있을 때만)
│                                     │
│  오답 목록 ...                       │
└─────────────────────────────────────┘
```

조건: `db-bank-system`, `pool-system` 등 Auto 시스템 값은 배지 미표시

> **[I-2][I-5] 수정 후**: Strict 모드에서 모든 경로(`db-bank-system`, `pool-system`, 하이브리드)의
> 응답 `model` 필드가 `preferredModel` 값으로 통일됨. 배지 정상 표시됨.
>
> **[I-6] 수정 후**: `getModelDisplayName()`이 `' (cached)'` suffix를 제거 후 조회하므로
> 캐시 히트 결과도 'Google Gemini'로 정상 표시됨.

> **[I-15] 구현 주의**: DB에서 로드한 퀴즈(`fromDbQuiz()`)는 `ai_model = 'auto'`이면
> `modelUsed = 'auto'`가 된다. `'auto'`는 truthy이므로 배지 조건을 통과해
> "[자동 (추천)]" 배지가 표시된다 — 설계 위반.
>
> **수정 1 — `fromDbQuiz()` 정규화** (`lib/supabase/quiz.ts`):
> ```ts
> modelUsed: (dbQuiz.ai_model && dbQuiz.ai_model !== 'auto') ? dbQuiz.ai_model : undefined,
> ```
>
> **수정 2 — `QuizResult.tsx` 방어 조건** (안전망):
> ```tsx
> // ❌ 기존 조건: 'auto' 배지 표시됨
> {modelUsed && !['db-bank-system', 'pool-system'].some(s => modelUsed.includes(s)) && (
>
> // ✅ 수정 조건: 'auto' 제외 추가
> {modelUsed && modelUsed !== 'auto' && !['db-bank-system', 'pool-system'].some(s => modelUsed.includes(s)) && (
> ```

**prop 전달 체인 [I-3]:**
```
quiz/[id]/page.tsx
  └─ QuizPlayer(quiz)         ← quiz.modelUsed 포함
       └─ QuizResult(          ← 명시적 prop 전달 필요
            modelUsed={quiz.modelUsed}
          )
```

### 6.3 내 퀴즈 목록 배지

**`app/(main)/my-quizzes/page.tsx`**

```
┌─ 내 퀴즈 카드 ──────────────────────────────────┐
│  📝 React 기초 퀴즈   [보통]  [Google Gemini]   │  ← 모델 배지 추가
│  5문제 · 2026.02.27                             │
└─────────────────────────────────────────────────┘
```

조건: `ai_model === 'auto'`이면 배지 미표시

---

## 7. 전체 데이터 흐름

```
[upload/page]
  selectedModel = 'gemini-2.0-flash'
        │
        ▼  POST /api/quiz/generate
           { preferredModel: 'gemini-2.0-flash', sessionSize, difficulty }
        │
        ▼  generateQuizWithFallback(content, options)
           Strict 모드 → Gemini만 시도
           성공 → { quiz, model: 'gemini-2.0-flash' }
           실패 → 에러 throw → 500 응답 → 프론트 에러 UI 표시
        │
        ▼  response: { quiz, model: 'gemini-2.0-flash', ... }
        │
        ├─ quiz.modelUsed = (selectedModel !== 'auto') ? data.model : undefined  // [I-9] 조건부 명시 (Strict 예시: 'gemini-2.0-flash')
        │  └─ saveQuizToLocal(quiz)  ← localStorage (modelUsed 포함)
        │
        └─  POST /api/quiz/save
            { quiz, sourceText, difficulty, aiModel: selectedModel }  // [I-8] selectedModel 사용
            └─ saved_quizzes.ai_model = 'gemini-2.0-flash'

[quiz/[id]/page.tsx]
  quiz.modelUsed = 'gemini-2.0-flash'
  └─ QuizPlayer(quiz)
       └─ QuizResult(modelUsed='gemini-2.0-flash')
            └─ 배지: [Google Gemini]

[my-quizzes/page.tsx]
  DbQuiz.ai_model = 'gemini-2.0-flash'
  └─ 배지: [Google Gemini]
```

---

## 8. 수정 파일 목록

| # | 파일 | 유형 | 주요 변경 내용 |
|---|------|------|---------------|
| 1 | `lib/supabase/migrations/004_add_ai_model.sql` | 신규 | ai_model 컬럼 추가 |
| 2 | `types/index.ts` | 수정 | `QuizGenerationOptions.preferredModel`, `Quiz.modelUsed` |
| 3 | `types/supabase.ts` | 수정 | `DbSavedQuiz` Row/Insert/Update에 `ai_model` 추가 **[I-13]** |
| 4 | `lib/constants.ts` | 수정 | **[I-10]** `MODEL_OPTIONS`, `getModelDisplayName` 추가 (경로 주의: 단일 파일) |
| 5 | `lib/cache/quizCache.ts` | 수정 | **[I-1]** `hashOptions()`에 `preferredModel` 추가 |
| 6 | `lib/ai/generate.ts` | 수정 | **[I-16]** `isStrict`·`models` 선언 추가 (line 143 교체, for 루프는 이미 `models` 참조하므로 변경 불필요), `generateQuizWithFallback()` Strict/Auto 분기, `getModelDisplayName` import 추가 |
| 7 | `app/api/quiz/generate/route.ts` | 수정 | `preferredModel` 파싱·검증·options 전달, **[I-2][I-5]** 3개 경로 model 필드 Strict 분기, **[I-11][I-16]** Bank/Pool Strict 빈 결과 조기 감지 (에러 메시지 `getModelDisplayName()` 적용), `getModelDisplayName` import 추가 |
| 8 | `lib/supabase/quiz.ts` | 수정 | **[I-7]** `fromDbQuiz()`에 `modelUsed` 매핑 추가, **[I-15]** `ai_model === 'auto'`이면 `undefined` 반환 정규화 |
| 9 | `app/api/quiz/save/route.ts` | 수정 | **[I-7]** inline insert에 `ai_model` 직접 추가, `aiModel` body 파싱 |
| 10 | `app/(main)/upload/page.tsx` | 수정 | 모델 선택 드롭다운, state, API 호출 수정, **[I-8]** save 시 `selectedModel` 전달, **[I-9]** quiz 객체에 `modelUsed` 명시 |
| 11 | `components/quiz/QuizPlayer.tsx` | 수정 | **[I-3]** `QuizResult`에 `modelUsed={quiz.modelUsed}` 명시적 전달 |
| 12 | `components/quiz/QuizResult.tsx` | 수정 | `modelUsed` prop 추가, 모델 배지 렌더링, **[I-15]** 배지 조건에 `!== 'auto'` 추가 |
| 13 | `app/(main)/my-quizzes/page.tsx` | 수정 | `ai_model` 배지 표시 |
| 14 | `lib/quiz/questionBankService.ts` | 수정 | **[I-17][I-18]** `getOrGenerateQuestionBank()` Strict 모드 early return — bank 시스템 완전 우회 (가져오기 + 저장 모두 건너뜀, `bankId: ''` 반환) |

---

## 9. 검증 계획

| # | 시나리오 | 기대 결과 | 검증 포인트 |
|---|----------|-----------|------------|
| 1 | Auto 선택 후 생성 (500자 미만) | 기존 폴백 동작 유지, 결과/목록 배지 없음 | `hashOptions` preferredModel 미포함 |
| 2 | Gemini 선택 후 생성 성공 (500자 미만, 하이브리드) | 결과 화면 [Google Gemini] 배지, DB `ai_model='gemini-2.0-flash'` | Strict 모드 동작 |
| 3 | Gemini 선택 후 생성 성공 (500자 이상, 은행 시스템) | **[I-2]** `model='gemini-2.0-flash'`, 배지 표시 | route.ts Strict 분기 |
| 4 | Gemini 선택 후 생성 성공 (500자 미만 대량 요청, 풀 시스템) | **[I-5]** `model='gemini-2.0-flash'`, 배지 표시 | pool-system Strict 분기 |
| 5 | 특정 모델 선택 후 API 오류 | **[I-16]** "Google Gemini 모델 사용 중 오류가 발생했습니다." (표시명), 폴백 없이 중단 | `isStrict` 분기 + `getModelDisplayName()` 에러 메시지 |
| 6 | 동일 텍스트로 Gemini/GPT 순차 생성 | **[I-1]** 각각 다른 캐시 항목, 서로 캐시 히트 안 함 | `hashOptions` preferredModel 포함 |
| 7 | Auto로 생성 후 동일 텍스트 Auto 재생성 | 캐시 히트 (기존 캐시와 호환) | Auto 모드 캐시 호환 |
| 8 | 캐시 히트 후 결과 화면 배지 | **[I-6]** `'gemini-2.0-flash (cached)'` → [Google Gemini] 표시 | `getModelDisplayName` suffix 제거 |
| 9 | 로그인 후 내 퀴즈 목록 조회 | 모델 지정 퀴즈에만 배지, Auto 퀴즈 배지 없음 | `ai_model` DB 저장·조회 |
| 10 | 내 퀴즈에서 퀴즈 플레이 완료 | **[I-3]** `fromDbQuiz()` → `quiz.modelUsed` → QuizResult 배지 | prop 체인 전파 |
| 11 | 로그인 없이 생성 | save API 미호출 → `modelUsed` localStorage만 저장, 목록 배지 없음 | 비로그인 경로 정상 동작 |
| 12 | 비로그인 + Gemini 선택 → 생성 후 결과 화면 | **[I-9]** `quiz.modelUsed` 설정됨 → [Google Gemini] 배지 표시 | localStorage quiz에 modelUsed 포함 여부 |
| 13 | Gemini 선택 + 500자 이상 텍스트 + API 오류 | **[I-11][I-16]** generic 에러 아닌 "Google Gemini 모델 사용 중 오류가 발생했습니다." 노출 (표시명) | Bank 경로 Strict 빈 결과 조기 감지 + `getModelDisplayName()` 적용 |
| 14 | Auto 선택 후 생성 → 내 퀴즈 목록 | **[I-8]** `ai_model = 'auto'` (시스템 문자열 아님), 목록 배지 없음 | DB saved_quizzes.ai_model 값 확인 |
| 15 | Auto로 은행 생성 후 Gemini Strict로 동일 텍스트 재요청 | **[I-17][I-18]** bank 경로 완전 우회(early return), Gemini로 새로 생성, quiz.bankId 없음, "더 풀기" 버튼 미표시 | `questionBankService` early return 동작 확인. Auto bank에 Gemini 문제가 추가되지 않음 확인 (DB question_bank_items 행 수 변화 없음) |
| 16 | Gemini Strict 모드로 500자+ 텍스트 생성 → "더 풀기" 버튼 | **[I-18]** bankId 없음 → "더 풀기" 버튼 미표시 (Auto 모드와 다른 UX — 의도된 동작) | quiz.bankId === undefined 확인 |
