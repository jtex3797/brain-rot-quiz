# NLP 전처리(텍스트 축소) 분석 보고서

> 분석일: 2026-03-03
> 상태: **데드 코드 확인** — 전처리 텍스트 축소가 AI에 실질적으로 적용되지 않음

---

## 1. 배경

프로젝트에 NLP 전처리 파이프라인(`lib/nlp/textProcessor.ts`)이 구현되어 있음:
- 문장 분리 → TF-IDF 점수 계산 → 중복 제거 → 핵심 문장 추출
- 결과: `topSentences` (축소된 텍스트)

원래 의도: 긴 텍스트를 축소하여 AI 토큰 비용을 절감하는 것.

---

## 2. 발견 사항: 텍스트 축소가 AI에 도달하지 않음

### 원인: 두 임계값이 동일 (500자)

| 상수 | 위치 | 값 | 역할 |
|------|------|-----|------|
| `BANK_THRESHOLD` | `app/api/quiz/generate/route.ts:27` | **500** | 500자 이상이면 DB 은행 경로로 분기 |
| `shouldPreprocess()` | `lib/nlp/textProcessor.ts:257` | **500**자 이상 | 전처리 적용 여부 결정 |

### 코드 흐름 추적

```
사용자 텍스트 입력
       │
 content.length >= 500?
  ┌────┴────┐
 YES       NO
  │         │
  ▼         ▼
DB 은행    generateQuiz()
경로       │
  │     shouldPreprocess()?
  │     = text.length >= 500
  │     = false (500자 미만!)
  │         │
  ▼         ▼
원문 AI    원문 AI
전달       전달
```

#### 경로 A: 500자 이상 (대부분의 실사용)

```
route.ts:134  → useDbBankSystem = content.length >= 500  → true
route.ts:150  → getOrGenerateQuestionBank(content, ...)  → 원문 content 전달
                  │
questionBankService.ts:120  → processText(content)  → 용량 계산에만 사용
questionBankService.ts:134  → generateQuestionPool(content, ...)  → 원문 전달
                                  │
questionPool.ts:99   → processText(content)  → 용량 계산에만 사용
questionPool.ts:123  → generateQuestionBatch(content, ...)  → 원문 전달
                           │
batchGenerator.ts:221  → generateQuizWithFallback(batchContent, ...)  → 원문 AI 전달
```

**결론: processText의 topSentences(축소 결과)는 어디에도 사용되지 않음. 원문이 AI에 전달됨.**

#### 경로 B: 500자 미만

```
route.ts:288   → generateQuiz(content, options)
generate.ts:48 → shouldPreprocess(content) = false (500자 미만)
generate.ts:50 → generateQuizWithFallback(content, options)  → 원문 AI 전달
```

**generate.ts 83~105행의 전처리 축소 코드 (condensedText → AI)는 도달 불가.**

---

## 3. processText가 실제로 사용되는 용도

현재 `processText`는 호출되지만, **오직 용량 계산(문제 수 추정)에만** 사용됨:

| 파일 | 행 | processText 용도 | AI 전달 여부 |
|------|-----|-----------------|-------------|
| `generate.ts:87` | condensedText → AI | ❌ 도달 불가 (데드 코드) |
| `questionBankService.ts:120` | `calculateQuestionCapacity`에 전달 | ❌ AI와 무관 |
| `questionPool.ts:99` | `calculateQuestionCapacity`에 전달 | ❌ AI와 무관 |
| `analyze/route.ts:41` | 텍스트 분석 API | ❌ AI와 무관 |
| `textAnalyzer.ts:78` | 용량 계산 내부 | ❌ AI와 무관 |

---

## 4. DB 저장 확인

`question_banks` 테이블에 저장되는 것도 원문:

```sql
-- schema.sql:89-90
original_content TEXT NOT NULL  -- 원본 텍스트 (재사용 대비)
```

```typescript
// questionBank.ts:144-146
const insertData = {
  content_hash: contentHash,
  original_content: content,  // ← 원문 그대로
};
```

축소된 텍스트가 DB에 저장되는 칼럼이나 경로는 없음.

---

## 5. 데드 코드 위치

`lib/ai/generate.ts` 83~105행:

```typescript
// 이 블록은 현재 route.ts 라우팅 구조에서 도달 불가
const processed = processText(content);
const condensedText = processed.topSentences.join('\n\n');  // ← 축소
const result = await generateQuizWithFallback(condensedText, options);  // ← 축소 텍스트 전달
```

이 코드에 도달하려면:
1. `generateQuiz`가 호출되어야 함 → content < 500자일 때만
2. `shouldPreprocess(content)` = true → content >= 500자일 때만

두 조건이 **모순**이므로 도달 불가.

---

## 6. 향후 선택지

### A. 현상 유지
- processText는 용량 계산에만 사용 (이 용도는 의미 있음)
- AI에는 항상 원문 전달 (토큰 비용은 절감되지 않음)

### B. DB 은행 경로에 전처리 적용
- `generateQuestionPool`/`batchGenerator`에 전달하는 텍스트를 축소
- 토큰 비용 절감 효과 발생
- 수정 범위: `questionBankService.ts`, `questionPool.ts`, `batchGenerator.ts`

### C. 데드 코드 정리
- `generate.ts` 83~105행의 전처리 로직 제거
- `shouldPreprocess` 함수 제거 또는 용도 변경
- 코드 가독성 향상
