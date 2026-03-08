@# "더 풀기" shuffle 파라미터 소실 버그 수정 + 새로고침 중복 방지

---

## 1. Context

"더 풀기" 모달에서 "문제 순서 섞기" 토글을 켜도 실제로 shuffle이 적용되지 않는 버그.

- **근본 원인**: `LoadMoreModal` → `QuizResult` → `QuizPlayer` → `QuizPage` 전달 경로에서 shuffle 파라미터가 탈락
- **추가 이슈**: 페이지 새로고침 시 `answeredQuestionIds`가 React state로만 관리되어 초기화 → 이전 문제 중복 가능

### 현재 전달 체인

```
LoadMoreModal.onConfirm(count, shuffle)  ← shuffle 있음
  → QuizResult.handleLoadMoreConfirm(count)  ← shuffle 탈락!
    → QuizResult.onLoadMore(count)
      → QuizPlayer.onLoadMore(count)
        → QuizPage.handleLoadMore(count)
          → POST /api/quiz/load-more  body: { bankId, count, excludeIds }  ← shuffle 없음
```

### 참고: API 서버는 이미 shuffle 처리 가능

`app/api/quiz/load-more/route.ts:47-58`에서 `body.shuffle`을 수신하여 `shuffleOverride`로 처리하는 로직이 이미 존재. 클라이언트에서 안 보내는 것만 고치면 됨.

---

## 2. 점검 결과

### onLoadMore 사용처 (전체 프로젝트)

| 파일 | 위치 | 역할 |
|---|---|---|
| `QuizPlayer.tsx:28` | `onLoadMore?: (count: number) => Promise<void>` | prop 정의 |
| `QuizPlayer.tsx:176` | `onLoadMore={onLoadMore}` | QuizResult에 pass-through |
| `QuizResult.tsx:25` | `onLoadMore?: (count: number) => void` | prop 정의 |
| `QuizResult.tsx:64` | `onLoadMore?.(count)` | 호출 (shuffle 누락) |
| `QuizPage.tsx:340` | `onLoadMore={quiz.bankId ? handleLoadMore : undefined}` | 최종 핸들러 연결 |

- 오답 복습(`wrong-answers/`) 등 다른 경로에서 onLoadMore 사용 없음
- QuizPlayer 내부에서 onLoadMore를 직접 호출하는 곳 없음 (pass-through만)

### setAnsweredQuestionIds 호출 지점 (page.tsx)

| # | 위치 | 상황 | sessionStorage 동기화 필요 |
|---|---|---|---|
| 1 | line 62 | 초기 로드 (DB 퀴즈) | O |
| 2 | line 96 | 초기 로드 (로컬 퀴즈) | O |
| 3 | line 152 | 더 풀기 (handleLoadMore) | O |
| 4 | line 199 | 전체 다시 풀기 (handleResetAll) | O (새 값으로 갱신) |
| 5 | line 247 | 내 퀴즈에서 시작 (handleStartWithCount) | O |

### 기존 sessionStorage 사용 현황

프로젝트 전체에서 **0곳** — 새로 도입하는 패턴. 단, `'use client'` 컴포넌트이므로 SSR 문제 없음.

---

## 3. 수정 사항

### 3.1 QuizResult에서 shuffle 전달

**파일:** `components/quiz/QuizResult.tsx`

현재:
```typescript
// line 25
onLoadMore?: (count: number) => void;
// line 62
const handleLoadMoreConfirm = (count: number) => {
  setShowLoadMoreModal(false);
  onLoadMore?.(count);
};
```

수정:
```typescript
onLoadMore?: (count: number, shuffle?: boolean) => void;

const handleLoadMoreConfirm = (count: number, shuffle: boolean) => {
  setShowLoadMoreModal(false);
  onLoadMore?.(count, shuffle);
};
```

### 3.2 QuizPlayer에서 onLoadMore 타입 업데이트

**파일:** `components/quiz/QuizPlayer.tsx`

현재 (line 28):
```typescript
onLoadMore?: (count: number) => Promise<void>;
```

수정:
```typescript
onLoadMore?: (count: number, shuffle?: boolean) => Promise<void>;
```

QuizPlayer 내부에서 QuizResult에 pass-through (line 176)하므로 추가 수정 불필요.

### 3.3 QuizPage handleLoadMore에서 shuffle 수신 및 API 전달

**파일:** `app/(quiz)/quiz/[id]/page.tsx`

현재 (line 114):
```typescript
const handleLoadMore = useCallback(async (count?: number) => {
  // ...
  body: JSON.stringify({ bankId: quiz.bankId, count: loadCount, excludeIds }),
```

수정:
```typescript
const handleLoadMore = useCallback(async (count?: number, shuffle?: boolean) => {
  // ...
  body: JSON.stringify({ bankId: quiz.bankId, count: loadCount, excludeIds, shuffle }),
```

- useCallback 의존성 배열 변경 불필요 (shuffle은 파라미터)

### 3.4 answeredQuestionIds를 sessionStorage에 저장

**파일:** `app/(quiz)/quiz/[id]/page.tsx`

래퍼 함수로 5곳의 `setAnsweredQuestionIds` 호출을 일괄 교체:

```typescript
const STORAGE_KEY = `quiz_answered_${params.id}`;

// 래퍼: state + sessionStorage 동시 업데이트
const updateAnsweredIds = useCallback((ids: string[]) => {
  setAnsweredQuestionIds(ids);
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}, [params.id]);
```

초기 복원 (loadQuiz useEffect 내):
```typescript
// DB/로컬에서 퀴즈 로드 후, sessionStorage에 저장된 값이 있으면 우선 사용
const saved = sessionStorage.getItem(STORAGE_KEY);
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) setAnsweredQuestionIds(parsed);
  } catch {}
}
```

---

## 4. 수정 파일 목록

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `components/quiz/QuizResult.tsx` | `onLoadMore` 타입에 shuffle 추가, `handleLoadMoreConfirm`에서 shuffle 전달 |
| 2 | `components/quiz/QuizPlayer.tsx` | `onLoadMore` prop 타입 업데이트 |
| 3 | `app/(quiz)/quiz/[id]/page.tsx` | `handleLoadMore`에 shuffle 추가, `updateAnsweredIds` 래퍼로 sessionStorage 연동 |

> `app/api/quiz/load-more/route.ts`는 수정 불필요 — 이미 `body.shuffle` 처리 로직 있음

---

## 5. 검증

1. `npm run build` 성공 확인
2. "더 풀기" 모달에서 shuffle ON → 브라우저 DevTools Network 탭에서 API 요청 body에 `shuffle: true` 포함 확인
3. "더 풀기" 모달에서 shuffle OFF → `shuffle: false` 확인
4. 퀴즈 풀이 후 "더 풀기" → 새로고침 → 다시 "더 풀기" → 이전 문제 미포함 확인 (sessionStorage 복원)
5. "전체 다시 풀기" → sessionStorage 리셋 확인 (이전 excludeIds 무시)
