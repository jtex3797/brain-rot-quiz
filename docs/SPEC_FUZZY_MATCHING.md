# 유사 정답 매칭 (Fuzzy Matching) + 다중 정답 허용 — 구현 스펙

> **작성일**: 2026-01-28
> **관련 피드백**: FEEDBACK.md #12 (유사 정답 매칭), #14 (이중답 허용)

---

## 1. 목표

1. **Fuzzy Matching**: 띄어쓰기, 대소문자, 오타 → 정답 처리 (90%+ 유사도 시 피드백 표시)
2. **다중 정답 (correctAnswers)**: 한글명/영어명/음차 표기 등 AI가 대안 정답 생성
3. 향후 신고/답변 수정 기능으로 사용자가 대안 정답 추가 가능

---

## 2. 현재 상태 (AS-IS)

- `correctAnswer`는 전체 스택에서 단일 `string`
- 답안 비교: `QuestionCard.tsx`에서 `trim().toLowerCase() === correctAnswer.toLowerCase()`
- 별도 매칭 유틸리티 없음, 다중 정답 인프라 없음

---

## 3. 데이터 모델 변경 (통합 방식)

### 변경 전 (AS-IS)
```ts
correctAnswer: string  // 단일 정답
```

### 변경 후 (TO-BE)
```ts
correctAnswers: string[]  // [0] = 대표 정답, [1...] = 대안 정답
```

> **규칙**: 배열의 **첫 번째 요소**가 UI에 표시되는 **대표 정답**

---

## 4. 구현 계획

### Phase 1: 기반 (동작 변경 없음)

#### 1-1. 답안 매칭 유틸리티 — `lib/quiz/answerMatcher.ts` (신규)

**normalizeAnswer(text)**
```
input → trim → 다중 공백 제거 → lowercase → 문장부호 제거 → NFC 정규화 → 한국어 조사 제거
```
- 한국어 조사: 은/는/이/가/을/를/의/에/에서/으로/로/와/과/도

**fuzzyMatch(userAnswer, correctAnswers) — Fuse.js 기반**
```ts
import Fuse from 'fuse.js';

const normalizedAnswers = correctAnswers.map(normalizeAnswer);
const fuse = new Fuse(normalizedAnswers, {
  includeScore: true,
  threshold: 0.4,      // 0.0 = 정확 일치, 1.0 = 모든 것 매칭
  distance: 100,
  ignoreLocation: true,
});

const result = fuse.search(normalizeAnswer(userAnswer));
// similarity = 1 - score
```

**checkAnswer(userAnswer, correctAnswers, questionType?) → MatchResult**
```ts
interface MatchResult {
  isCorrect: boolean;
  matchType: 'exact' | 'similar' | 'wrong';
  similarity: number;       // 0.0 ~ 1.0
  matchedAnswer?: string;   // 매칭된 정답 원문
  displayAnswer: string;    // UI 표시용 (항상 correctAnswers[0])
}
```

로직 흐름:
1. mcq/ox → 정확 일치만 (fuzzy 비적용)
2. 정규화 후 정확 일치 → `exact`
3. 정규화된 길이 < 3자 → 정확 일치만 (짧은 답 보호)
4. Fuse.js 유사도 ≥ 0.9 → `similar` (정답 처리 + 피드백)
5. 그 외 → `wrong`

#### 1-2. 상수 — `lib/constants.ts`
```ts
export const ANSWER_MATCHING = {
  FUSE_THRESHOLD: 0.4,
  SIMILARITY_THRESHOLD: 0.9,
  MIN_LENGTH_FOR_FUZZY: 3,
} as const;
```

#### 1-3. 타입 변경 — `types/index.ts`
```ts
// Question 변경 (Breaking Change)
- correctAnswer: string;
+ correctAnswers: string[];  // [0] = 대표 정답

// UserAnswer에 추가
matchType?: 'exact' | 'similar' | 'wrong';
similarity?: number;
```

#### 1-4. DB 마이그레이션 — `lib/supabase/migrations/002_correct_answers_array.sql` (신규)
```sql
-- =====================================================
-- 002_correct_answers_array.sql
-- correctAnswer(string) → correctAnswers(string[]) 변환
-- =====================================================

-- 1. saved_questions: correct_answer → correct_answers (TEXT[])
ALTER TABLE public.saved_questions
  ALTER COLUMN correct_answer TYPE TEXT[] 
  USING ARRAY[correct_answer];

ALTER TABLE public.saved_questions
  RENAME COLUMN correct_answer TO correct_answers;

-- 2. question_bank_items: JSONB 내부 correctAnswer → correctAnswers 변환
UPDATE public.question_bank_items
SET question_json = jsonb_set(
  question_json - 'correctAnswer',
  '{correctAnswers}',
  to_jsonb(ARRAY[question_json->>'correctAnswer'])
)
WHERE question_json ? 'correctAnswer';

-- 3. generation_cache: 캐시 초기화 (형식 호환 안됨, 재생성 필요)
DELETE FROM public.generation_cache;
```

#### 1-5. DB 타입 — `types/supabase.ts`
```ts
// saved_questions
- correct_answer: string
+ correct_answers: string[]
```

---

### Phase 2: 데이터 레이어

#### 2-1. `lib/supabase/quiz.ts`
- `toDbQuestions()`: `correct_answers: q.correctAnswers` 
- `fromDbQuestion()`: `correctAnswers: dbQ.correct_answers`

#### 2-2. `lib/supabase/questionBank.ts`
- question_json에서 `correctAnswers` 매핑

---

### Phase 3: AI 생성

#### 3-1. `lib/ai/prompts.ts`
- Zod 스키마 변경:
  ```ts
  - correctAnswer: z.string().describe('정답'),
  + correctAnswers: z.array(z.string()).min(1).describe('정답 목록 (첫 번째가 대표 정답, 나머지는 대안)'),
  ```
- SYSTEM_PROMPT에 규칙 추가:
  ```
  5. **정답 (correctAnswers)**
     - 배열 형태로 제공, 첫 번째가 대표 정답
     - 단답형/빈칸: 한글↔영문, 약칭 등 대안 정답 추가
     - 객관식/OX: 정답 1개만 (["O"] 또는 ["정답보기"])
  ```

#### 3-2. `lib/ai/generate.ts`
- quiz mapping에서 `correctAnswers` 전달

---

### Phase 4: UI 통합

#### 4-1. `components/quiz/QuestionCard.tsx` (핵심 변경)
- `checkAnswer()` 호출
- 피드백 UI:
  - exact → "정답입니다!"
  - similar → "유사 정답입니다! (92% 일치)" + 대표 정답 표시
  - wrong → "아쉽네요! 정답: {correctAnswers[0]}"

#### 4-2. 기타 컴포넌트
- `QuizPlayer.tsx`, `QuizResult.tsx` 등에서 `correctAnswer` → `correctAnswers[0]` 변경

---

## 5. 수정 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `lib/quiz/answerMatcher.ts` | **신규** |
| `lib/constants.ts` | 수정 |
| `types/index.ts` | 수정 |
| `types/supabase.ts` | 수정 |
| `lib/supabase/migrations/002_correct_answers_array.sql` | **신규** |
| `lib/supabase/quiz.ts` | 수정 |
| `lib/supabase/questionBank.ts` | 수정 |
| `lib/ai/prompts.ts` | 수정 |
| `lib/ai/generate.ts` | 수정 |
| `lib/hooks/useQuizAnswers.ts` | 수정 |
| `components/quiz/QuestionCard.tsx` | 수정 |
| `components/quiz/QuizPlayer.tsx` | 수정 |
| `components/quiz/QuizResult.tsx` | 수정 |

---

## 6. 설계 결정 사항

- **통합 방식 채택**: `correctAnswers: string[]` 단일 필드로 관리
- **첫 번째 = 대표 정답**: UI 표시용 정답은 항상 `correctAnswers[0]`
- **Fuse.js 라이브러리**: ~15KB gzip, 한글/영어 모두 지원
- **정규화 함수 조합**: 한국어 조사 처리를 위해 `normalizeAnswer()` 선처리 필수
- **짧은 답 보호**: 3자 미만은 fuzzy 비적용 ("AI" ≠ "AB")
- **NFC 정규화**: 한글 자모/음절 블록 혼용 방지

### 의존성 추가
```bash
npm install fuse.js
```

---

## 7. 검증 방법

1. `npm run build` — 타입 에러 없는지 확인
2. Supabase 마이그레이션 실행 후 기존 데이터 `["기존답"]` 형태로 변환 확인
3. 개발 서버에서 단답형 퀴즈 생성 후:
   - 정확한 답 → "정답입니다!"
   - 대소문자/띄어쓰기 다르게 → "정답입니다!" (exact)
   - 약간 오타 (90%+) → "유사 정답입니다! (XX%)"
   - 대안 정답 입력 → "정답입니다!"
   - 완전 다른 답 → "아쉽네요!"
4. 기존 객관식/OX → 기존 동작 유지
