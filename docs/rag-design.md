# RAG 도입 설계문서

## 개요

기존 퀴즈 생성 파이프라인에 **임베딩 기반 검색(RAG)**을 추가하여 문제 품질을 개선한다.
변경 대상은 두 경로로 한정한다.

| 경로 | 현재 방식 | 개선 후 |
|------|-----------|---------|
| NLP 전처리 | TF-IDF 점수로 핵심 문장 추출 | TF-IDF + 임베딩 유사도 하이브리드 스코어링으로 리랭킹 |
| 배치 생성 | 문단 단위 순차 분할 | 임베딩 기반 커버리지 최대화로 배치별 컨텍스트 선택 |

---

## 아키텍처

```
lib/rag/                        ← 새 모듈
├── chunker.ts                  # 문장 경계 존중 청크 분할
├── embedder.ts                 # OpenAI text-embedding-3-small 래퍼
├── retriever.ts                # 코사인 유사도 검색 (top-K + 커버리지 최대화)
└── index.ts                    # barrel export

수정 파일:
├── lib/utils/logger.ts         # LogModule에 'RAG' 추가
├── lib/nlp/textProcessor.ts    # processTextWithReranking() 추가
├── lib/nlp/index.ts            # 새 함수 export
├── lib/quiz/questionPool.ts    # processTextWithReranking 호출 및 generationContent 준비
└── lib/quiz/batchGenerator.ts  # RAG 기반 배치 컨텍스트 선택 추가
```

### 의존성 원칙
- `lib/rag/`는 기존 모듈에 의존하지 않음. 기존 모듈이 `lib/rag/`를 가져온다.
- 임베딩은 **인메모리**로 요청당 생성·사용·폐기. pgvector 등 벡터 DB 불필요.
- 새 패키지·환경변수 불필요. `@ai-sdk/openai`와 `OPENAI_API_KEY` 재사용.

---

## 모듈 상세

### chunker.ts — 청크 분할

배치 생성에서 사용한다. 문장 배열을 슬라이딩 윈도우로 청크화한다.

```typescript
interface Chunk {
  text: string;
  sentenceIndices: number[];  // 원본 sentences 배열 내 인덱스 범위
}

interface ChunkingConfig {
  chunkSize: number;       // 청크당 최대 문장 수 (기본: 3)
  overlap: number;         // 오버랩 문장 수 (기본: 1)
  minChunkLength: number;  // 최소 문자 수, 미충족 시 병합 (기본: 30)
}

function createChunks(sentences: string[], config?: ChunkingConfig): Chunk[]
```

- `chunkSize=3`: `text-embedding-3-small`에서 ~3문장 단위가 의미 단위와 잘 매칭
- `overlap=1`: 주제 전환이 청크 경계와 정확히 겹치지 않는 경우 커버
- 마지막 청크가 `minChunkLength` 미충족이면 이전 청크와 병합

### embedder.ts — 임베딩 생성

단일 책임: API 호출만. 에러는 throw 그대로 (폴백 결정은 호출자가 한다).

```typescript
const EMBEDDING_MODEL = openai.embedding('text-embedding-3-small');

async function embedText(text: string): Promise<number[]>
// → ai.embed() 호출

async function embedTexts(texts: string[]): Promise<number[][]>
// → ai.embedMany() 호출 (자동 배치 분할)
// 빈 문자열은 빈 배열 []로 반환 (원본 인덱스 유지)
```

### retriever.ts — 검색

벡터 연산만 수행 (API 호출 없음). `cosineSimilarity`는 `ai` 패키지에서 제공.

**전략 1 — `retrieveTopK`** (NLP 리랭킹용)

쿼리 벡터와 후보 벡터 사이의 코사인 유사도를 계산하여 상위 K개를 반환한다.
NLP 경로에서는 K = 전체 문장 수로 호출하여 모든 유사도 점수를 추출한다.

> ⚠️ `cosineSimilarity`의 반환 범위는 **[-1, 1]**이다 (실증 확인됨: 직교→0, 반대→-1).
> 빈 벡터(`[]`) 후보만 제외하고 음수 유사도도 그대로 반환해야 한다.
> NLP 경로에서 음수 유사도 문장을 제거하면 해당 문장 점수가 강제 0으로 고정되어 min-max 정규화 후에도 최저값이 되는 문제가 발생한다.

**전략 2 — `retrieveForCoverage`** (배치 생성용)

MMR(Maximal Marginal Relevance) 변형. 이미 커버된 영역과 가장 다른 후보를 순차적으로 선택한다.

```
점수 공식:
  maxSimToCovered_i = max(cosine(candidate_i, covered_j)) for all j
  score_i = -diversityWeight * maxSimToCovered_i
  → maxSimToCovered가 낮을수록(기존과 다를수록) 점수 높음

순차 greedy 선택:
  1. 모든 후보의 score 계산
  2. 최고 score 후보 선택 → covered에 추가
  3. 남은 후보에 대해 재계산
  4. selectCount까지 반복
```

> ⚠️ `maxSimToCovered`의 초기값은 **`-Infinity`**여야 한다.
> `0`으로 초기화하면 모든 유사도가 음수인 경우(실질적으로 커버 안 됨)에도 `maxSimToCovered`가 0으로 남아
> 해당 후보의 다양성이 실제보다 낮게 평가된다.

- `diversityWeight=0.7`: 완전한 다양성(1.0)이면 우연히 무관한 문장이 들어올 수 있으므로 균형점
- `coveredEmbeddings`가 빈 배열이면 모든 후보가 동등 → **첫 번째 배치는 별도로 `retrieveTopK`로 처리**

---

## 경로별 적용 상세

### 경로 A: NLP 리랭킹 (`processTextWithReranking`)

기존 `processText()`는 유지한다. `questionPool.ts`에서 용량 계산용으로 동기 호출되므로.
새로운 `processTextWithReranking()`만 `questionPool.ts`에서 호출한다 (`generateQuestionBatch`에 넘길 content로).

**공유 단계 추출 (코드 중복 방지):**
단계 1~4(splitSentences → tokenize → TF-IDF → ScoredSentence 생성)는 두 함수 모두에서 필요한다.
이를 내부 헬퍼 `preprocessTFIDF(text)`로 분리하여 공유한다.

```typescript
// 내부 헬퍼 (export 안 함)
function preprocessTFIDF(text: string): {
  rawSentences: string[];
  scoredSentences: ScoredSentence[];
  language: 'ko' | 'en' | 'mixed';
}

// 기존 함수 — 헬퍼를 호출 후 단계 5~7만 수행
export function processText(text: string): ProcessedText {
  const { rawSentences, scoredSentences, language } = preprocessTFIDF(text);
  // 중복제거 → extractTopSentences → 반환 (기존과 동일)
}

// 새 함수 — 헬퍼를 호출 후 리랭킹 + 단계 5~7
export async function processTextWithReranking(text: string): Promise<ProcessedText> {
  const { rawSentences, scoredSentences, language } = preprocessTFIDF(text);
  // 리랭킹 시도 → 중복제거 → extractTopSentences → 반환
}
```

```
processTextWithReranking(text)
  │
  ├─ preprocessTFIDF() → rawSentences, scoredSentences
  │
  ├─ [문장 수 < 8개] → 리랭킹 건너뜄음, 기존 경로로 진행
  │
  └─ [문장 수 ≥ 8개] → RAG 리랭킹 시도
        │
        ├─ 쿼리 구성: scoredSentences의 키워드 빈도 상위 5개를 space join
        ├─ embedText(쿼리) + embedTexts(모든 문장)
        ├─ retrieveTopK(K=전체) → 유사도 점수 추출 (음수 포함)
        ├─ hybrid scoring:
        │     normalizedEmb   × 0.4
        │   + normalizedTfidf × 0.6
        ├─ score 교체 → 중복제거 → extractTopSentences
        │
        └─ [실패 시] 폴백: 기존 TF-IDF 결과로 진행
```

**정규화**: min-max (0~1 범위). 모든 값이 동일하면 0.5로.

**α=0.4 선택 근거**: 리랭킹은 보완의 역할. TF-IDF가 이미 키워드 중요도를 잘 구분하는 텍스트에서 임베딩만으로 바꾸면 오히려 나빠질 수 있다. 0.4는 "임베딩이 보조 신호"인 균형점.

### 경로 B: 배치 생성 컨텍스트 선택

`divideFocusAreas()`는 유지한다 (폴백용).

```
generateQuestionBatch(content, ...)
  │
  ├─ [루프 밖] RAG 초기화:
  │     splitSentences(content) → createChunks() → embedTexts()
  │     실패 시: ragAvailable = false
  │
  └─ 배치 루프:
        │
        ├─ [ragAvailable=false] → focusAreas[i] (기존 문단 분할)
        │
        └─ [ragAvailable=true]
              │
              ├─ 배치 0: retrieveTopK(쿼리, chunkEmbeddings, 3) → 상위 3개 청크
              │
              └─ 배치 1+:
                    새 문제만 embedTexts → coverageEmbeddings에 누적
                    retrieveForCoverage(chunkEmbeddings, coverageEmbeddings, 3)
                    → 기존과 가장 다른 3개 청크
              │
              └─ [실패 시] 폴백: focusAreas[i]
        │
        └─ createBatchPromptSuffix() → AI 호출 (기존과 동일)
```

**"문제 텍스트 + 정답"을 커버리지 벡터로 사용하는 이유:**
빈칸형 문제("인공지능은 [____]을...")를 그대로 임베딩하면 불완전한 의미. 정답을 붙이면 완전한 의미의 문장이 되어 정확한 벡터 표현.

**배치 0의 쿼리 구성:**
`textProcessor`의 `buildRerankingQuery`는 `ScoredSentence[]`를 받는다. `batchGenerator`에는 `ScoredSentence`가 없으므로 동일 함수를 호출할 수 없다.
대신 `batchGenerator`에서는 이미 사용 중인 `tokenize(content)`로 키워드 빈도를 직접 추출한다.

```typescript
// batchGenerator 내부: 첫 번째 배치 쿼리 구성
const tokens = tokenize(content);  // 이미 import됨
const freq = new Map<string, number>();
for (const t of tokens) { freq.set(t, (freq.get(t) || 0) + 1); }
const firstBatchQuery = [...freq.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(e => e[0])
  .join(' ');
```

**커버리지 임베딩 캐시 (API 호출 절약):**
배치 루프에서 매 회마다 기존 문제 전체를 다시 embed하면 중복 호출이다.
이전 배치의 `coverageEmbeddings`를 루프 밖 변수로 유지하고, 새로운 문제만 embed하여 추가한다.

```typescript
// 루프 밖
let coverageEmbeddings: number[][] = [];

// 루프 안 (배치 1+)
const newQuestions = /* 이 배치에서 새로 생성된 문제 */;
const newTexts = newQuestions.map(q => `${q.questionText} ${q.correctAnswers[0]}`);
const newEmbeddings = await embedTexts(newTexts);
coverageEmbeddings = [...coverageEmbeddings, ...newEmbeddings];
// retrieveForCoverage(chunkEmbeddings, coverageEmbeddings, 3) 호출
```

**임베딩 API 호출 횟수 (캐시 적용 후):**
- 청크 임베딩: 1회 (루프 밖, embedMany로 단일 호출)
- 배치 0: 쿼리 임베딩 1회
- 배치 1+: 새 문제만 임베딩 (회당 ~5-10개)
- 총 API 호출: ~배치 수 + 1회

**`createBatchPromptSuffix()` 유지 이유:**
RAG는 컨텍스트 선택 레이어. `promptSuffix`는 AI 생성 지시 레이어.
RAG로 다양한 텍스트가 들어가더라도 AI가 유사한 주제로 문제를 생성할 수 있으므로, `promptSuffix`가 마지막 안전망으로 작동한다.

---

## 폴백 구조

모든 RAG 경로는 try/catch로 감싸져 있다. 임베딩 API가 실패하면 기존 방식으로 자동 전환된다.

```
┌─────────────────────┐    성공    ┌──────────────┐
│  임베딩 API 호출     │ ────────▶ │  RAG 경로    │
└─────────────────────┘            └──────────────┘
         │ 실패
         ▼
┌─────────────────────┐
│  기존 경로 (폴백)    │  TF-IDF만 (NLP) / 문단 분할 (배치)
└─────────────────────┘
```

---

## 검증 체크리스트

- [ ] `npm run build` — 타입 오류 없음
- [ ] 장문 텍스트(500자+, 8문장+)로 퀴즈 생성 → 로그에 `[RAG] 리랭킹 완료` 출력
- [ ] 장문 텍스트로 문제 풀 생성 → 로그에 `[RAG] 배치 생성용 청크 임베딩 완료` 출력
- [ ] 짧은 텍스트(500자 미만)로 생성 → RAG 관련 로그 없음 (리랭킹 건너뜄음)
- [ ] OPENAI_API_KEY 무효화 후 퀴즈 생성 → 기존 방식으로 graceful degradation → 키 복원
