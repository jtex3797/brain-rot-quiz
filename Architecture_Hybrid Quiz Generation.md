# 하이브리드 퀴즈 생성 시스템 구현 계획

> AI 비용 절감 + 다양한 문제 생성을 위한 NLP 전처리 기반 하이브리드 시스템

---

## 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| AI 토큰 사용량 | 100% | ~50-60% |
| 문제 다양성 | AI 임의 선택 | 키워드 밀도 기반 분산 |
| 캐싱 | 없음 | 텍스트 해시 기반 DB 캐시 |
| 오프라인 | 불가 | 기본 규칙 기반 생성 가능 |

---

## 결정된 사항 ✅

| 항목 | 결정 |
|------|------|
| 라이브러리 | **gimci** (순수 JS, 한국어 지원) |
| 캐시 TTL | **30일** 만료 |
| 중복 문장 | **제거** (유사도 기반) |
| 문장 추출 개수 | **동적** (텍스트 품질/길이 기반) |
| 캐시 키 | **옵션 포함** (난이도, 문제 수) |
| 오프라인 모드 | **Phase 1-3 완료 후** 별도 구현 |

---

## 아키텍처 개요

```
┌────────────────────────────────────────────────────────────────┐
│                        사용자 입력 (텍스트)                      │
└─────────────────────────────┬──────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     1. 텍스트 길이 판단                          │
│           < 500자 → AI 직접 전송 | ≥ 500자 → 전처리              │
└─────────────────────────────┬──────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     2. 캐시 조회 (해시 기반)                      │
│              Hit → 캐시된 퀴즈 반환 | Miss → 생성                 │
└─────────────────────────────┬──────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    3. NLP 전처리 (로컬)                          │
│     문장 분리 → TF-IDF 계산 → 상위 N개 핵심 문장 추출             │
└─────────────────────────────┬──────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    4. AI 퀴즈 생성 (축소된 텍스트)                │
│            Gemini → GPT → Claude (기존 폴백 유지)                │
└─────────────────────────────┬──────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     5. 캐시 저장 & 반환                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Proposed Changes

### Phase 1: NLP 전처리 엔진

#### [NEW] [textProcessor.ts](file:///c:/jte-workspace/my-project/brain-rot-quiz/lib/nlp/textProcessor.ts)

핵심 텍스트 처리 모듈:

```typescript
interface ProcessedText {
  originalLength: number;
  sentences: ScoredSentence[];
  topSentences: string[];       // 중복 제거된 핵심 문장들
  language: 'ko' | 'en' | 'mixed';
  extractionRatio: number;      // 추출 비율 (품질 지표)
}

interface ScoredSentence {
  text: string;
  score: number;        // TF-IDF 점수
  keywords: string[];   // 추출된 키워드
  position: number;     // 원문 내 위치 (0-1)
}
```

**동적 문장 추출 로직:**
- 텍스트 길이 기반: `min(문장수, max(10, 문장수 * 0.4))`
- 키워드 밀도 기준: 평균 이상 점수 문장 우선
- 유사도 기반 중복 제거: 80% 이상 유사 문장 제거

주요 함수:
- `splitSentences(text)` - 한국어/영어 문장 분리
- `calculateTFIDF(sentences)` - 키워드 밀도 점수 계산  
- `extractTopSentences(sentences, count)` - 상위 N개 선택
- `removeDuplicates(sentences)` - 유사 문장 중복 제거

---

#### [NEW] [koreanTokenizer.ts](file:///c:/jte-workspace/my-project/brain-rot-quiz/lib/nlp/koreanTokenizer.ts)

한국어 텍스트 토큰화:

```typescript
// 한국어 조사/어미 제거하여 키워드 추출
function tokenizeKorean(text: string): string[]

// 불용어 필터링
function removeStopwords(tokens: string[]): string[]
```

---

#### [NEW] [tfidf.ts](file:///c:/jte-workspace/my-project/brain-rot-quiz/lib/nlp/tfidf.ts)

TF-IDF 알고리즘 구현:

```typescript
// Term Frequency 계산
function calculateTF(tokens: string[]): Map<string, number>

// Inverse Document Frequency 계산
function calculateIDF(documents: string[][]): Map<string, number>

// TF-IDF 점수 계산
function calculateTFIDF(
  sentence: string, 
  allSentences: string[]
): number
```

---

### Phase 2: 캐싱 시스템

#### [NEW] Supabase `quiz_cache` 테이블

```sql
CREATE TABLE IF NOT EXISTS public.quiz_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 캐시 키 (텍스트 해시)
  content_hash TEXT NOT NULL UNIQUE,
  
  -- 생성 옵션 (난이도, 문제 수 등)
  options JSONB NOT NULL,
  
  -- 캐시된 퀴즈 데이터
  quiz_data JSONB NOT NULL,
  
  -- 메타데이터
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- TTL (30일)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_quiz_cache_hash ON public.quiz_cache(content_hash);
```

---

#### [NEW] [quizCache.ts](file:///c:/jte-workspace/my-project/brain-rot-quiz/lib/cache/quizCache.ts)

```typescript
interface CacheOptions {
  bypassCache?: boolean;  // "새 문제 생성" 시 true
}

// 캐시 조회
async function getCachedQuiz(
  contentHash: string, 
  options: QuizGenerationOptions
): Promise<Quiz | null>

// 캐시 저장
async function setCachedQuiz(
  contentHash: string,
  options: QuizGenerationOptions,
  quiz: Quiz
): Promise<void>

// 텍스트 해시 생성 (SHA-256)
function hashContent(text: string): string
```

---

### Phase 3: 파이프라인 통합

#### [MODIFY] [generate.ts](file:///c:/jte-workspace/my-project/brain-rot-quiz/lib/ai/generate.ts)

기존 `generateQuizWithFallback` 함수를 래핑:

```typescript
// 새로운 진입점
export async function generateQuiz(
  content: string,
  options: QuizGenerationOptions & CacheOptions
): Promise<QuizGenerationResult> {
  
  // 1. 텍스트 길이 체크
  if (content.length < 500) {
    return generateQuizWithFallback(content, options);
  }
  
  // 2. 캐시 확인 (bypassCache가 아닌 경우)
  if (!options.bypassCache) {
    const cached = await getCachedQuiz(hash, options);
    if (cached) return { quiz: cached, model: 'cache', cached: true };
  }
  
  // 3. NLP 전처리
  const processed = await processText(content);
  const condensedText = processed.topSentences.join('\n');
  
  // 4. AI 생성 (축소된 텍스트)
  const result = await generateQuizWithFallback(condensedText, options);
  
  // 5. 캐시 저장
  await setCachedQuiz(hash, options, result.quiz);
  
  return result;
}
```

---

## Verification Plan

### 자동화 테스트

```bash
# 1. NLP 전처리 단위 테스트
npm run test -- lib/nlp/

# 2. 캐시 통합 테스트
npm run test -- lib/cache/

# 3. E2E 테스트 (500자 미만/이상 텍스트)
npm run test:e2e -- quiz-generation
```

### 수동 검증

1. **토큰 절감 확인**: AI 호출 시 `tokensUsed` 비교 (전/후)
2. **캐시 동작 확인**: 같은 텍스트 2번 생성 → 두 번째는 캐시에서 반환
3. **"새 문제 생성"**: `bypassCache: true` 옵션으로 새 퀴즈 생성 확인
4. **한국어 처리**: 한국어 텍스트에서 키워드 정상 추출 확인
