# SPEC: 퀴즈 JSON Export/Import 기능

## 개요

퀴즈를 JSON 파일로 내보내고(Export), JSON으로 새 퀴즈를 생성하거나 기존 퀴즈 전체를 교체(Import)하는 기능.

---

## 동기

- 퀴즈를 외부에서 편집하거나, 다른 사람과 공유하거나, 백업하는 용도
- AI 없이 직접 퀴즈를 JSON으로 작성해서 업로드하는 용도
- 기존 퀴즈를 통째로 교체해야 할 때 문제별 수정보다 빠른 방법 제공

---

## DB 충돌 분석

### 실제 컬럼 (마이그레이션 반영 기준)

- `saved_questions.correct_answers TEXT[]` — migration 002에서 배열로 변경됨 (schema.sql의 `correct_answer TEXT`는 구버전)

### 맞물리는 테이블

| 테이블 | 연결 방식 | Import/Replace 시 영향 |
|--------|----------|----------------------|
| `saved_questions` | `quiz_id` CASCADE | 퀴즈 삭제 시 문제도 삭제됨 (안전) |
| `play_answers` | `question_id` → SET NULL | 문제 삭제 시 NULL로 변환, 충돌 없음 |
| `wrong_answers` | `question_id` → SET NULL + UNIQUE(user_id, question_id) | NULL 다중 허용(PostgreSQL 특성)으로 충돌 없음, 단 `is_outdated` 처리 필요 |
| `saved_quizzes.bank_id` | → `question_banks` | 전체 교체 후 bank_id 잔존 시 "더 풀기" 버튼 논리 불일치 |

### 결론

기존 PATCH API 재사용 불가한 이유:

| 항목 | 기존 PATCH | 필요한 처리 |
|------|-----------|------------|
| bank_id 클리어 | ❌ 미지원 | NULL로 업데이트 필요 |
| wrong_answers outdated | UPDATE된 문제만 처리 | DELETE된 문제도 처리 필요 |
| order_index 연속성 | 갭 발생 (n, n+1, n+2...) | 0부터 재시작 필요 |

→ **전체 교체 전용 엔드포인트 신규 추가**

---

## Export JSON 형식

DB 내부 ID(`id`, `quiz_id`, `bankId` 등)를 제외한 휴먼리더블 포맷.

```json
{
  "version": "1.0",
  "exportedAt": "2026-03-01T09:00:00.000Z",
  "title": "한국사 핵심 정리",
  "difficulty": "medium",
  "questions": [
    {
      "type": "mcq",
      "questionText": "조선을 건국한 인물은?",
      "options": ["이성계", "이방원", "정도전", "최영"],
      "correctAnswers": ["이성계"],
      "explanation": "1392년 이성계가 조선을 건국했습니다."
    },
    {
      "type": "ox",
      "questionText": "한글은 세종대왕이 창제했다.",
      "correctAnswers": ["O"],
      "explanation": "1443년 세종대왕이 훈민정음을 창제했습니다."
    },
    {
      "type": "short",
      "questionText": "임진왜란이 발생한 연도는?",
      "correctAnswers": ["1592", "1592년"]
    },
    {
      "type": "fill",
      "questionText": "___은 신라의 삼국통일을 이룬 왕이다.",
      "correctAnswers": ["문무왕"]
    }
  ]
}
```

---

## 구현 계획

### 신규 파일 3개

#### 1. `lib/utils/quizJson.ts`

Zod 스키마 + Export/Import 핵심 유틸

```typescript
// Zod 스키마 — 둘 다 export 필수
export const QuizJsonQuestionSchema = z.object({  // ← export: replace route에서 import해서 서버검증
  type: z.enum(['mcq', 'ox', 'short', 'fill']),
  questionText: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswers: z.array(z.string()).min(1),
  explanation: z.string().optional(),
}).superRefine((q, ctx) => {
  // mcq 타입은 options 필수 (없으면 import 성공 후 퀴즈 플레이 시 렌더링 오류)
  if (q.type === 'mcq' && (!q.options || q.options.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mcq 타입은 options가 필요합니다' });
  }
  // mcq 정답은 반드시 options 안에 있어야 함 (없으면 플레이어가 정답 선택 불가능)
  if (q.type === 'mcq' && q.options && q.options.length > 0 && !q.options.includes(q.correctAnswers[0])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mcq 정답이 options에 없습니다' });
  }
  // ox 타입은 correctAnswers[0]이 반드시 'O' 또는 'X' (다른 값이면 플레이 시 영원히 틀림)
  if (q.type === 'ox' && !['O', 'X'].includes(q.correctAnswers[0])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ox 타입의 정답은 "O" 또는 "X"여야 합니다' });
  }
})

const QuizJsonSchema = z.object({
  version: z.literal('1.0'),
  exportedAt: z.string().datetime({ offset: true }),
  title: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  questions: z.array(QuizJsonQuestionSchema).min(1).max(100),
})

export type QuizJson = z.infer<typeof QuizJsonSchema>
// ← export: ImportJsonSection props, quiz-edit/my-quizzes handleJsonImport 타입에 사용

// 주요 함수 (모두 export)
buildQuizExportJson(params)           // QuestionUpdate[]|Question[] → QuizJson (id 제외)
                                      // ⚠️ difficulty: null 입력 → JSON에서 omit (undefined 변환 필수)
                                      //    출력에 "difficulty": null이 들어가면 import 시 Zod 거부됨
                                      //    (_delete: true 문제는 자동 제외)
parseAndValidateQuizJson(jsonString)  // JSON.parse(try-catch) → Zod safeParse → { success, data } | { success, error }
                                      // ⚠️ JSON.parse를 try-catch로 감싸야 함: 잘못된 JSON 입력 시 throw 발생
                                      //    → { success: false, error: 'JSON 형식이 올바르지 않습니다' } 반환
                                      //    Zod safeParse 자체는 throw하지 않음. JSON.parse가 유일한 throw 지점.
                                      // ⚠️ ZodError → string 변환 필수: result.error는 ZodError 객체 (string 아님)
                                      //    error: result.error.issues.map(e => e.message).join('\n')
                                      //    ⚠️ Zod v4(package.json: "^4.3.5") — .errors 대신 .issues 사용
                                      //       v3의 ZodError.errors → v4에서 ZodError.issues로 변경됨
                                      //       .errors는 backward compat alias로 남아있으나 .issues 사용 권장
                                      //    → 여러 오류 동시 발생 시 모두 표시 (e.g. "ox 정답은 O/X여야 합니다\nmcq 정답이 options에 없습니다")
quizJsonToImportBody(data)            // QuizJson → Question[] (각 question에 임시 crypto.randomUUID() 부여)
                                      // replace endpoint는 question.id를 무시하므로 무해
                                      // my-quizzes save 경로에서도 재사용 가능
downloadQuizJson(data, filename?)     // 브라우저 Blob URL 다운로드
```

#### 2. `app/api/quiz/[id]/replace/route.ts`

전체 교체 전용 POST 엔드포인트

```
POST /api/quiz/[id]/replace
요청: { title, difficulty?, questions[] }
응답: { success: true } | { success: false, error: string }  ← PATCH route 동일 패턴
      성공: HTTP 200 + { success: true }
      실패: HTTP 400/401/403/404/500 + { success: false, error: '...' }
      ⚠️ 클라이언트가 data.success / data.error 직접 참조하므로 반드시 준수

⚠️ 함수 시그니처 + 초기 추출 (PATCH route 동일 패턴 — route.ts:117-133):
   ```typescript
   export async function POST(
       request: Request,
       { params }: { params: Promise<{ id: string }> }
   ) {
       try {
           const { id: quizId } = await params;     // ⚠️ await 필수 — Next.js 15에서 params는 Promise
           const body = await request.json();       // ← step 0 safeParse 전에 반드시 추출
           const supabase = await createClient() as any;
           // step 0~6...
       } catch (error) { ... }
   }
   ```
   ⚠️ `params.id`로 동기 접근 시 TypeScript 에러 발생 (`Promise<{id:string}>`를 직접 접근)
   ⚠️ `body` 추출 전 `ReplaceBodySchema.safeParse(body)` 호출 시 `undefined` 파싱 → 항상 400 반환
   ⚠️ `import { z } from 'zod'` + `import { QuizJsonQuestionSchema } from '@/lib/utils/quizJson'`
      + `import { markAsOutdated } from '@/lib/supabase/wrongAnswers'` 필수 (PATCH route 미사용 import)

⚠️ 전체 핸들러를 외부 try-catch로 감싸야 함 (PATCH/save 라우트 동일 구조):
   try { /* 0-6단계 전체 */ }
   catch (error) { return NextResponse.json({ success: false, error: '교체 중 오류가 발생했습니다' }, { status: 500 }) }

처리 순서:
0. 요청 body 검증 (400 반환) — **body 전체를 Zod 한 번에 처리 필수**
   ⚠️ title/difficulty를 개별 if-check로 따로 검증하면 누락 위험.
      미검증 difficulty가 step 5(DELETE) 이후 step 6(UPDATE)에서 DB CHECK constraint 오류 발생
      → steps 3-4가 이미 실행된 상태라 퀴즈가 0문제로 파괴됨 (400이 아닌 500으로 처리되는 순서 역전)
   ```typescript
   import { QuizJsonQuestionSchema } from '@/lib/utils/quizJson'
   const ReplaceBodySchema = z.object({
     title: z.string().min(1),
     difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
     questions: z.array(QuizJsonQuestionSchema).min(1).max(100),
     //                                          ^^^^^^^^ client QuizJsonSchema와 동일 상한 유지
   })
   const bodyResult = ReplaceBodySchema.safeParse(body)
   if (!bodyResult.success) return NextResponse.json({ success: false, error: '입력이 올바르지 않습니다' }, { status: 400 })
   const validatedBody = bodyResult.data
   // 이후 body.questions 대신 validatedBody.questions 사용 (타입 안전)
   // validatedBody.difficulty 는 'easy'|'medium'|'hard'|undefined — step 6에서 validatedBody.difficulty ?? null
   ```
1. 인증 + 소유권 검증  ← PATCH route (lines 135-163) 동일 패턴 사용
   ```typescript
   const { data: { user }, error: authError } = await supabase.auth.getUser()
   if (authError || !user) return 401
   const { data: existingQuiz, error: quizError } = await supabase
     .from('saved_quizzes').select('user_id').eq('id', quizId).single()
   if (quizError || !existingQuiz) return 404  // 존재하지 않는 quiz_id
   if (existingQuiz.user_id !== user.id) return 403  // 타인 퀴즈
   ```
   ⚠️ 명시적 소유권 검증 필수 — RLS만으로 의존하면:
      step 5 INSERT 시 FK 위반 → 500 반환 (데이터는 보호되나 에러 코드 오염)
2. SELECT id FROM saved_questions WHERE quiz_id = :id  ← existingIds string[] 수집
   ⚠️ 에러 체크 + 매핑 필수:
      const { data: questionRows, error: selectError } = await supabase
        .from('saved_questions').select('id').eq('quiz_id', quizId)
      if (selectError) return 500
      const existingIds = (questionRows ?? []).map((q: { id: string }) => q.id)
      // ⚠️ ?? [] 방어 필수 — supabase as any 환경에서 에러 없어도 null 반환 가능
      (결과는 Array<{ id: string }> — string[]로 변환해야 markAsOutdated 타입 일치)
3. if (existingIds.length > 0) {  ← 빈 배열이면 스킵 (빈 배열 .in() → PostgREST 에러)
     const { success } = await markAsOutdated(existingIds)
     if (!success) return NextResponse.json({ success: false, error: '오답노트 처리 실패' }, { status: 500 })
   }
   ⚠️ markAsOutdated는 절대 throw하지 않음 — 내부에서 catch 후 { success: false } 반환
   ⚠️ await + 반환값 체크 필수 — 미체크 시 is_outdated=false 불일치 발생
4. DELETE FROM saved_questions WHERE quiz_id = :id     ← 일괄 삭제
   (cascade → play_answers.question_id=NULL, wrong_answers.question_id=NULL)
   ⚠️ 에러 체크 필수: const { error: deleteError } = await supabase...delete()...
      if (deleteError) return 500  ← 미체크 시 step 5 INSERT로 진행 → 기존+신규 문제 혼재
5. INSERT INTO saved_questions (order_index 0,1,2...)  ← 새 문제 삽입
   ⚠️ camelCase→snake_case 필드 매핑 필수 (save route 동일 패턴):
      questionsData = validatedBody.questions.map((q, index) => ({  // ← body 아님 (step 0에서 validatedBody로 대체)
        quiz_id: quizId,
        type: q.type,
        question_text: q.questionText,   // ← questionText ≠ question_text, 그대로 spread하면 INSERT 실패
        options: q.options ?? null,
        correct_answers: q.correctAnswers, // ← correctAnswers ≠ correct_answers
        explanation: q.explanation ?? null,
        order_index: index,
        // id 없음 — DB가 auto UUID 부여
      }))
   ⚠️ 에러 체크 필수: const { error: insertError } = await supabase...insert(questionsData)
      if (insertError) return 500  ← 미체크 시 0문제 상태에서 200 반환 → 클라이언트가 성공으로 오인
6. UPDATE saved_quizzes SET title, difficulty, question_count,
                            source_text=NULL, bank_id=NULL, ai_model=NULL, updated_at
   ⚠️ question_count: validatedBody.questions.length 필수  // ← body.questions.length 아님, validatedBody 사용
      (step 5에서 실제 INSERT된 문제 수와 일치해야 함)
      참고: PATCH route에서 question_count: 1 하드코딩 버그가 있었음 (현재 수정됨) — 동일 실수 방지
   ⚠️ updated_at 값 명시 필수 — saved_quizzes에 UPDATE 트리거 없음 (DEFAULT NOW()는 INSERT 전용)
      PATCH route 동일 패턴 (route.ts:170): updated_at: new Date().toISOString()
      미포함 시 updated_at이 생성 시각 그대로 고정됨
   ⚠️ 에러 체크 필수: const { error: updateError } = await supabase...update({...}).eq('id', quizId)
      if (updateError) return 500  ← 미체크 시 새 문제는 삽입됐는데 메타데이터 갱신 안 된 채로 200 반환
   ⚠️ difficulty는 반드시 validatedBody.difficulty ?? null 로 전달  // ← body 아님
      (undefined 그대로 전달 시 Supabase가 해당 컬럼 UPDATE 스킵 → 의도한 NULL 설정 안 됨)
      (difficulty 없으면 validatedBody.difficulty=undefined → ?? null → DB에 NULL 저장 — 의도적)
   ⚠️ source_text=NULL — JSON Import는 AI 생성이 아니므로 원본 텍스트 클리어
      (ai_model=NULL과 함께 "AI 생성 메타데이터 전체 초기화" 관점에서 일관성 유지)
```

⚠️ **step 3은 반드시 step 4 이전** — 삭제 후에는 question_id 추적 불가
⚠️ **step 3 실패 시 abort** — 진행하면 is_outdated 불일치 발생
⚠️ **트랜잭션 없음 (Supabase JS 미지원)**
   - step 5(INSERT) 실패 → 500 반환 (클라이언트 알림), quiz는 0문제 상태 유지 (롤백 불가)
   - step 6(UPDATE) 실패 → 500 반환 (클라이언트 알림), 새 문제는 삽입됐는데 메타데이터 갱신 안 됨 (롤백 불가)
   → "허용 가능한 트레이드오프"는 롤백 불가를 수용하는 것이지, 에러 응답 생략이 아님
   → 실패 시 반드시 500 반환해야 클라이언트가 오인하지 않음
   → 향후 필요 시 Supabase RPC(stored procedure)로 원자적 처리 가능

재사용: `markAsOutdated(questionIds)` @ `lib/supabase/wrongAnswers.ts:232`
참고: `wrong_answers`는 `types/supabase.ts` 미등록 → `supabase as any` 패턴 사용 (기존 코드 전체 동일)

#### 3. `components/quiz-edit/ImportJsonSection.tsx`

인라인 Card 섹션 컴포넌트

```typescript
interface ImportJsonSectionProps {
  onImport: (data: QuizJson) => Promise<void>  // ⚠️ void 아님 — await해서 버튼 비활성화 필요
  confirmLabel?: string  // 기본값: "교체 확정" (my-quizzes에서는 "새 퀴즈 만들기" 전달)
}
```

- 파일 업로드(`.json`) + 텍스트 붙여넣기 두 가지 입력 방식
- 실시간 Zod 검증 → 오류 표시 or 미리보기(제목, 문제 수, 난이도, 내보낸 시각)
- 확정 버튼 (`confirmLabel` 텍스트, 미리보기 있을 때만 활성화) + `confirm()` 다이얼로그
- ⚠️ 확정 버튼은 `onImport` 실행 중 비활성화 필수 (더블클릭 방지)
  ```typescript
  const [isConfirming, setIsConfirming] = useState(false)
  async function handleConfirm() {
    if (!previewData || isConfirming) return
    if (!confirm(...)) return
    setIsConfirming(true)
    try {
      await onImport(previewData)  // ← Promise<void> await
    } finally {
      setIsConfirming(false)  // ← onImport가 예외를 throw해도 버튼 반드시 재활성화
    }
  }
  // 버튼: disabled={!previewData || isConfirming}
  // ⚠️ try-finally 필수 — onImport가 예외를 throw하면 setIsConfirming(false)가 실행되지 않아
  //    버튼이 영구 비활성화됨. 두 onImport 구현체 모두 try-catch로 내부 처리하지만 방어 필수.
  ```

### 수정 파일 3개

#### 4. `lib/utils/index.ts`
```typescript
export * from './quizJson'  // 추가
```

#### 5. `app/(main)/quiz-edit/[id]/page.tsx`
- PageHeader actions에 "JSON 내보내기" 버튼 추가
  ```
  const exportData = buildQuizExportJson({ title, difficulty, questions: questions.filter(q => !q._delete) })
  downloadQuizJson(exportData)  // API 호출 없이 현재 state에서 직접 생성
  // ⚠️ exportData 할당 필수 — buildQuizExportJson 반환값을 변수에 저장하지 않으면 downloadQuizJson(undefined) 런타임 에러
  ```
- 문제 목록 위에 `ImportJsonSection` 배치
- `handleJsonImport(importData: QuizJson): Promise<void>`  ← ⚠️ 파라미터명 importData (data 금지 — 응답 변수와 충돌)
  ```typescript
  // ⚠️ beforeunload 가드 우회용 ref 필수 (컴포넌트 최상단에 선언)
  const skipBeforeUnload = useRef(false)
  // ⚠️ useRef import 추가 필수: import { useState, useEffect, useMemo, useRef } from 'react'
  //    현재 page.tsx:3 → { useState, useEffect, useMemo } — useRef 누락 → 타입/런타임 오류
  // → beforeunload 핸들러에서: if (hasChanges && !skipBeforeUnload.current) { e.preventDefault(); ... }

  async function handleJsonImport(importData: QuizJson): Promise<void> {
    try {
      const response = await fetch(`/api/quiz/${quizId}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },  // ← handleSave 동일 패턴
        body: JSON.stringify({ title: importData.title, difficulty: importData.difficulty, questions: importData.questions }),
      })
      const result = await response.json()  // ← 변수명 result (data 금지 — importData와 혼동)
      if (result.success) {
        skipBeforeUnload.current = true  // ← reload 전 동기적으로 설정 → beforeunload 억제
        window.location.reload()
      } else alert(result.error ?? '교체에 실패했습니다')  // ← alert() 필수. setError() 금지
      // ⚠️ setError() 사용 금지: quiz-edit의 error state는 if (error) { return <에러 페이지> } 패턴으로
      //    퀴즈 에디터 전체 UI를 에러 뷰로 교체함 → 편집 중인 내용 컨텍스트 손실
      //    실패 시 alert()로 사용자 알림 후 에디터 유지 — handleSave 동일 패턴 (page.tsx:183)
    } catch {
      alert('교체 중 오류가 발생했습니다')  // ← setError() 금지 (동일 이유)
    }
  }
  ```
  ⚠️ `window.location.reload()`는 `beforeunload` 이벤트를 발생시킴
     quiz-edit 페이지는 `hasChanges` 상태에서 beforeunload 가드를 등록함 (page.tsx:96-104)
     성공 후 reload 시 hasChanges=true이면 "변경사항이 저장되지 않습니다" 브라우저 다이얼로그 발생
     → `useRef(false)` + 동기 설정으로 우회 (React state 변경은 비동기라 reload 전에 반영 안 됨)
  ⚠️ `loadQuiz`는 useEffect 내부 스코프 함수라 외부에서 직접 호출 불가
  ⚠️ onImport prop은 `Promise<void>` 타입 → ImportJsonSection이 await하여 버튼 비활성화

#### 6. `app/(main)/my-quizzes/page.tsx`
- 카드별 "내보내기" 버튼:
  ```
  try {
    GET /api/quiz/[id]
    → const data = await response.json()
    → if (!data.quiz) { alert('퀴즈를 불러올 수 없습니다'); return }  ← null 체크 필수
    → const exportData = buildQuizExportJson({ title: data.quiz.title, difficulty: data.quiz.difficulty, questions: data.quiz.questions })
    → downloadQuizJson(exportData)  // ⚠️ const exportData = 할당 필수 (미할당 시 downloadQuizJson(undefined) 런타임 에러)
  } catch { alert('내보내기 중 오류가 발생했습니다') }  ← handleDelete 패턴 동일
  ```
  ⚠️ try-catch 필수 — 네트워크 오류 시 response.json() throw 가능
  (difficulty는 fromDbQuiz 수정 후 정상 반환됨)
- 페이지 상단 "JSON 가져오기" 버튼 → `ImportJsonSection` 표시
  ⚠️ `showImportSection` state 필수 (현재 페이지에 없음):
  ```tsx
  const [showImportSection, setShowImportSection] = useState(false)
  // 버튼: onClick={() => setShowImportSection(v => !v)}
  // 렌더: {showImportSection && <ImportJsonSection ... />}
  ```
  미추가 시 ImportJsonSection이 항상 렌더되거나 버튼 클릭이 동작하지 않음
  ⚠️ confirmLabel 전달 필수:
  ```tsx
  <ImportJsonSection onImport={handleNewQuizImport} confirmLabel="새 퀴즈 만들기" />
  // ← confirmLabel 생략 시 기본값 "교체 확정" → 새 퀴즈 생성 컨텍스트와 의미 불일치
  ```
  → `async function handleNewQuizImport(data: QuizJson): Promise<void>`
  // ⚠️ async 필수: 함수 내부에서 await fetch() + await response.json() 사용
  //    onImport prop 타입이 (data: QuizJson) => Promise<void> — async 없으면 void 반환 → 타입 에러
  //    handleJsonImport(quiz-edit)와 동일하게 async function으로 선언 필수
  ```
  try {
    const quizId = crypto.randomUUID()
    const questions = quizJsonToImportBody(data)  // Question[] (임시 id 포함)
    POST /api/quiz/save { quiz: { id: quizId, title: data.title, questions },
                          difficulty: data.difficulty ?? undefined,
                          sourceText: null, aiModel: null }
    const result = await response.json()
    if (result.success) router.push(`/quiz-edit/${quizId}`)
    else alert(result.error)  ← my-quizzes 페이지는 setError 없음, alert() 패턴 (handleDelete 참고)
  } catch { alert('가져오기 중 오류가 발생했습니다') }  ← 네트워크 오류 대비
  ```

---

## 전체 흐름

```
[Export - quiz-edit 페이지]
"JSON 내보내기" 클릭
  → buildQuizExportJson(현재 title/questions state)
  → downloadQuizJson() → .json 파일 다운로드

[Export - my-quizzes 페이지]
카드 "내보내기" 클릭
  → GET /api/quiz/[id]
  → buildQuizExportJson()
  → downloadQuizJson()

[Import/Replace - quiz-edit 페이지]
"JSON으로 일괄 교체" 섹션 열기
  → 파일 업로드 or 텍스트 붙여넣기
  → parseAndValidateQuizJson() (실시간)
  → 미리보기 표시
  → "교체 확정" + confirm
  → POST /api/quiz/[id]/replace
      1. 기존 question ID 수집 (SELECT)
      2. markAsOutdated(questionIds)  ← wrongAnswers.ts 재사용
      3. saved_questions 일괄 DELETE  ← cascade 발생
      4. 새 문제 INSERT (0, 1, 2...)
      5. saved_quizzes UPDATE (title, difficulty, question_count, source_text=NULL, bank_id=NULL, ai_model=NULL, updated_at)
  → 성공 시에만 페이지 리로드 / 실패 시 오류 표시

[Import - my-quizzes 페이지 / 새 퀴즈]
"JSON 가져오기" 클릭
  → ImportJsonSection 표시
  → 검증 후 POST /api/quiz/save (기존 API 재사용)
  → /quiz-edit/[newId]로 이동
```

---

## 검증 항목

1. Export: quiz-edit에서 내보내기 → JSON에 id/bankId 없음 확인
2. Replace: 내보낸 JSON으로 교체 → 재조회 시 문제 교체 확인
3. bank_id 클리어: bank_id 있는 퀴즈 교체 후 "더 풀기" 버튼 비활성화 확인
4. wrong_answers: 교체 전 오답 있는 퀴즈 교체 → 오답노트에서 `is_outdated = true` 확인
5. Import 새 퀴즈: my-quizzes에서 JSON → 새 퀴즈 생성 확인
6. Zod 검증: 잘못된 JSON 입력 → 오류 메시지 표시 확인
7. `npm run build` 타입 오류 없음

---

## 주의사항 (구현 시 함께 수정 필요)

### `buildQuizExportJson` 입력 타입 통일

quiz-edit 페이지는 `QuestionUpdate[]` (state), my-quizzes는 `Question[]` (API 응답) 을 갖는다.
두 타입은 공통 필드(`type`, `questionText`, `options`, `correctAnswers`, `explanation`)를 공유하므로 함수 시그니처를 유연하게 설계:

```typescript
// 두 케이스 모두 수용 — _delete 마킹 문제는 자동 제외
buildQuizExportJson(params: {
  title: string
  difficulty?: 'easy' | 'medium' | 'hard' | null  // ⚠️ string | null 금지
  // string | null이면 반환 QuizJson.difficulty('easy'|'medium'|'hard'|undefined)에
  // string | undefined 할당 불가 → TypeScript 컴파일 에러
  questions: Array<{
    type: QuizType
    questionText: string
    options?: string[]
    correctAnswers: string[]
    explanation?: string
    _delete?: boolean  // QuestionUpdate에만 있음, 있으면 제외
  }>
})
```

### `wrong_answers` RLS 제한

replace 엔드포인트는 서버 클라이언트지만 RLS가 적용되어 `auth.uid() = user_id` 조건이 자동 추가됨.

`markAsOutdated(questionIds)`는 `question_id IN (...)` 방식으로 동작한다:

```sql
-- 실제 실행되는 쿼리 (quiz_id 기반이 아님)
UPDATE wrong_answers SET is_outdated = true
WHERE question_id IN (:id1, :id2, ...)
AND user_id = auth.uid()  -- RLS 자동 추가
```

→ **퀴즈 소유자 본인의 오답노트만 처리됨.** 다른 사용자가 이 퀴즈를 풀어서 쌓인 오답노트는 `question_id = NULL` (cascade)이 되지만 `is_outdated = false` 상태 유지.
→ 현재 스케일에서는 허용 가능한 트레이드오프.

### `difficulty` 누락 버그 (기존 코드)

`lib/supabase/quiz.ts`의 `fromDbQuiz()`가 `difficulty`를 반환하지 않음.

```typescript
// 현재 fromDbQuiz 반환값 (difficulty 없음)
return { id, title, questions, bankId, createdAt, modelUsed }
```

결과적으로:
- quiz-edit 페이지에서 `data.quiz.difficulty` → 항상 `undefined` → `setDifficulty(null)`
- Export 시 difficulty가 항상 누락됨
- PATCH 저장 시 `difficulty: null`이 전송되어 DB의 difficulty를 null로 덮어씀

**수정**: `fromDbQuiz`에 difficulty 추가 + `Quiz` 타입에 `difficulty?: 'easy' | 'medium' | 'hard'` 추가

```typescript
// lib/supabase/quiz.ts 수정 후
return {
  id: dbQuiz.id,
  title: dbQuiz.title,
  difficulty: dbQuiz.difficulty ?? undefined,  // 추가
  questions: ...,
  ...
}
```

이 수정은 JSON Import/Export 기능과 독립적이지만, 함께 처리하는 것이 적합함.

### `hasChanges` — `difficulty` 미추적 버그 (기존 코드, fromDbQuiz 수정의 파생 이슈)

`quiz-edit/[id]/page.tsx:74-92`:

```typescript
const hasChanges = useMemo(() => {
    const titleChanged = title !== originalQuiz.title;
    const questionsChanged = ...;
    return titleChanged || questionsChanged;
    // ← difficulty 체크 없음
}, [title, questions, originalQuiz]);
// ← dependency에도 difficulty 없음
```

`fromDbQuiz` difficulty 수정 후 파생되는 동작:
1. 퀴즈 로드 → `difficulty: 'medium'` 정상 표시
2. 사용자가 dropdown에서 'hard'로 변경
3. `hasChanges = false` (difficulty 미추적) → 저장 버튼 비활성화
4. difficulty만 바꿔서는 저장 불가

**수정**: `hasChanges` 로직에 `difficultyChanged` 추가 + `useMemo` dependency에 `difficulty` 추가

```typescript
const hasChanges = useMemo(() => {
    if (!originalQuiz) return false;
    const titleChanged = title !== originalQuiz.title;
    const difficultyChanged = difficulty !== (originalQuiz.difficulty ?? null);  // 추가
    const questionsChanged = ...;
    return titleChanged || difficultyChanged || questionsChanged;
}, [title, difficulty, questions, originalQuiz]);  // difficulty 추가
```

### ⚠️ 보안 이슈 (구현 전 반드시 해결)

#### 1. `proxy.ts` → `middleware.ts` 이름 버그 (HIGH)

현재 `proxy.ts`는 Next.js에 인식되지 않음. Next.js middleware는 반드시 프로젝트 루트의 `middleware.ts` 파일에 `export function middleware`로 내보내야 함.

현재 상태:
- `proxy.ts` + `export async function proxy(...)` → **middleware 미작동**
- `/profile`, `/my-quizzes`, `/dashboard` 보호 라우트가 실제로 보호되지 않음

**수정**: `proxy.ts` → `middleware.ts` 파일 이름 변경 + 함수명 `proxy` → `middleware` 변경.

참고: replace endpoint 자체는 `supabase.auth.getUser()`로 서버에서 직접 인증하므로 이 버그의 영향을 받지 않음. 단, 페이지 라우트 보호 전반에 영향.

#### 2. PATCH route cross-bank write (HIGH)

`app/api/quiz/[id]/route.ts:226-246` — bank에서 로드된 문제 수정 시:

```typescript
.from('question_bank_items')
.update({ question_json: { ... } })
.eq('id', q.id)
.eq('bank_id', existingQuiz.bank_id);  // 소유권 없는 공유 bank
```

`question_banks`는 컨텐츠 해시 기반 공유 캐시 (`user_id` 없음). 동일 컨텐츠로 퀴즈를 만든 다른 사용자의 bank item을 덮어쓸 수 있음.

**수정 방향**: bank item 수정 전 해당 `q.id`가 이 퀴즈의 `saved_questions` 또는 이 퀴즈의 `bank_id`에 실제로 속하는 항목인지 검증.

### `POST /api/quiz/save` 재사용 (my-quizzes에서 새 퀴즈 Import)

save API는 `quiz.id`를 그대로 DB에 저장하므로, 클라이언트에서 `crypto.randomUUID()`로 ID 생성 후 전달 필요.

save API가 요구하는 body 형식 (`difficulty`는 `quiz` 객체 내부가 아닌 top-level 필드):

```typescript
// POST /api/quiz/save 요청 body
{
  quiz: {
    id: string,          // crypto.randomUUID() 생성
    title: string,
    questions: Question[],
  },
  difficulty: 'easy' | 'medium' | 'hard' | undefined,
  sourceText: null,
  aiModel: null,
}
```

### `quizJsonToImportBody` — Question.id 처리

`Question` 인터페이스는 `id: string` 필수. 하지만 import된 JSON questions에는 id가 없음.
`quizJsonToImportBody`에서 각 question에 임시 `crypto.randomUUID()`를 생성해야 타입 오류 없음.

참고: save API 서버 측에서 question.id는 DB INSERT 시 사용되지 않고 DB auto-generated UUID가 부여됨 — 임시 id는 타입 만족용.

---

## 관련 파일

- `lib/supabase/quiz.ts` — `fromDbQuiz` (difficulty 추가 수정 필요), `toDbQuestions`
- `app/api/quiz/[id]/route.ts` — PATCH 로직 (bank_items 직접 수정 기능 추가됨), GET 응답 구조
- `app/api/quiz/save/route.ts` — 새 퀴즈 저장 API (Import 재사용)
- `types/index.ts` — `Quiz`, `Question`, `QuizType` 타입 (`difficulty` 필드 추가 필요)
- `lib/supabase/schema.sql` — 참고용 (v2 현재 스키마. migration 004 ai_model 컬럼은 미반영)
- `lib/supabase/migrations/002_correct_answers_array.sql` — `correct_answers TEXT[]` 컬럼 확인
- `lib/supabase/migrations/003_quiz_edit_wrong_answers.sql` — `wrong_answers` 테이블 정의 + RLS (`UNIQUE(user_id, question_id)`, `question_id ON DELETE SET NULL` 확인)
- `lib/supabase/migrations/003_bank_items_update_policy.sql` — `question_bank_items` UPDATE RLS 정책 (`USING(TRUE)`)
- `lib/supabase/migrations/004_add_ai_model.sql` — `ai_model TEXT DEFAULT 'auto'` 컬럼 (NULL 허용, NOT NULL 없음)
