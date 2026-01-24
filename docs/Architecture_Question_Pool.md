# 아키텍처: 문제 풀 (Question Pool) 시스템

> **목적**: 텍스트 분석에 소요되는 고비용 AI 작업을 최소화하고, 사용자가 동일한 텍스트로 끊김 없이 퀴즈를 즐길 수 있도록 퀴즈 미리 생성 및 저장 시스템을 구축한다.

---

## 1. 개요 (Overview)

기존 시스템은 "텍스트 입력 → 1회용 퀴즈 생성 → 종료"의 단발성 흐름이었다. 이를 개선하여 **"텍스트 입력 → 최대 가능 수량 생성 및 저장 → N회차 쪼개서 풀기"** 구조로 변경한다.

## 2. 현재 구현된 모듈

### 2.1 텍스트 용량 분석 (`lib/quiz/textAnalyzer.ts`)
- `calculateQuestionCapacity()`: 텍스트 품질에 따른 최대 문제 수 계산
- 문장 수, 키워드 다양성, 정보 밀도 기반
- **최대 50문제**까지 생성 가능 (`MAX_CAPACITY: 50`)

### 2.2 배치 생성기 (`lib/quiz/batchGenerator.ts`)
- 여러 번 AI 호출로 문제 확보 + 중복 제거 (Jaccard similarity 0.7)
- 문단 단위 초점 영역 분할로 다양한 관점의 문제 생성
- 목표의 120% 도달 시 조기 종료

### 2.3 문제 풀 생성기 (`lib/quiz/questionPool.ts`)
- **AI 생성 70% + 변형 30%** 하이브리드 구조
- 변형: 정답 교환, 빈칸 이동, 부정형 변환, 보기 순서 변경

### 2.4 기존 캐시 시스템 (`lib/cache/quizCache.ts`)
- `quiz_cache` 테이블: 전체 퀴즈 단위 캐싱
- **문제**: 개별 문제 단위 저장/조회 불가 → 신규 테이블 필요

> **공존 방침**: `quiz_cache`는 **짧은 텍스트(500자 미만)** 전용으로 유지하고, `quiz_pools`는 **긴 텍스트(500자 이상)** 전용으로 사용한다. 두 시스템은 텍스트 길이 기준으로 분기된다.

---

## 3. 데이터베이스 스키마 (Schema)

### 3.1 `quiz_pools` 테이블
원본 텍스트와 생성 옵션을 기준으로 하는 메타데이터 저장소.

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `content_hash` | TEXT | 텍스트 원본 해시 (검색용, Unique Index 필수) |
| `original_content` | TEXT | 원본 텍스트 (재사용 대비) |
| `max_capacity` | INT | `calculateQuestionCapacity()`가 계산한 최대 문제 수 |
| `generated_count` | INT | 실제 생성된 문제 수 |
| `created_at` | TIMESTAMP | 생성 일시 |
| `expires_at` | TIMESTAMP | 만료 일시 (30일 TTL) |

### 3.2 `pool_questions` 테이블
풀에 소속된 개별 문제 저장소. **사용자별 상태(`is_used` 등)는 저장하지 않음.**

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `pool_id` | UUID | FK (`quiz_pools.id`) |
| `question_json` | JSONB | 문제 데이터 (질문, 보기, 정답, 해설) |
| `source_type` | TEXT | `ai` 또는 `transformed` |
| `created_at` | TIMESTAMP | 생성 일시 |

> **주의**: 사용자별 "푼 문제" 상태는 `quiz_sessions` 및 `session_answers` 테이블을 통해 추적하며, 비로그인 사용자는 클라이언트 상태(Local Storage) 또는 요청 시 `excludeIds` 파라미터로 처리한다.

---

## 4. 핵심 로직 흐름 (Logic Flow)

### 4.1 퀴즈 생성 요청 (`POST /api/quiz/generate`)

```
1. 용량 분석
   └─ calculateQuestionCapacity() → capacity.max 획득

2. 생성 수량 결정
   └─ poolSize = max(요청수, ceil(capacity.max × 0.5))
   └─ 상한: 50개 (MAX_CAPACITY)

3. 풀 조회
   └─ content_hash로 기존 풀 확인
   └─ 동시 요청: ON CONFLICT DO NOTHING

4. 풀 생성 (없을 경우)
   └─ generateQuestionPool() 호출
       ├─ AI 배치 생성 (70%)
       └─ 문제 변형 (30%)
   └─ quiz_pools + pool_questions에 저장

5. 배치 반환
   └─ pool_questions에서 요청 수량만큼 추출
   └─ 클라이언트에 pool_id 함께 반환
```

### 4.2 이어 풀기 (`POST /api/quiz/load-more`)

| 로그인 여부 | 동작 |
|-------------|------|
| **로그인 O** | 서버가 `session_answers` 기반으로 "안 푼 문제"만 정확히 제공 |
| **로그인 X** | 서버가 풀에서 **랜덤 추출**. 중복 가능하지만 단순화 |

**로그인 사용자 흐름**:
1. 퀴즈 결과 화면에서 **[더 풀기]** 버튼 제공.
2. 클라이언트가 `pool_id` 전송.
3. 서버는 `session_answers`를 조회해 이미 푼 문제 ID를 자동 제외하고 N개 반환.

**비로그인 사용자 흐름**:
1. 퀴즈 결과 화면에서 **[더 풀기]** 버튼 제공.
2. 클라이언트가 `pool_id` 전송 (별도 상태 저장 없음).
3. 서버는 풀에서 **랜덤으로** N개 추출하여 반환.
4. 중복 문제가 나올 수 있지만, UI에 **"로그인하면 기록이 저장됩니다"** 안내 표시.

> **채택 이유**: 비로그인 사용자는 가벼운 체험 목적이므로 중복이 일부 발생해도 무방하며, LocalStorage 관리 복잡도를 제거할 수 있다.


---

## 5. 확장성 및 유지보수 (Scalability & Maintenance)

- **인덱싱**: `content_hash`에 Unique Index 적용하여 조회 성능 확보.
- **데이터 정리**: `quiz_pools`에 `expires_at`을 설정하고, Cron Job 또는 Database Trigger로 주기적인 삭제 수행.
- **동시성**: 풀 생성은 멱등성(Idempotency)을 보장해야 함. 동일 해시 요청이 동시에 와도 풀은 하나만 생성되어야 함.
- **API 타임아웃**: Vercel 함수 타임아웃(10초/60초)을 고려, 배치 생성의 조기 종료(120% 도달) 활용.

---

## 6. 구현 체크리스트 (Checklist)

### DB & 백엔드
- [ ] Supabase 마이그레이션 (`quiz_pools`, `pool_questions`)
- [ ] 인덱스 생성 (`content_hash` UNIQUE, `pool_id`)
- [ ] RLS 정책 적용 (공용 캐시: 누구나 읽기/쓰기 가능)
- [ ] 만료 데이터 정리 함수 (`cleanup_expired_pools()`)
- [ ] `QuestionPoolService` 구현
    - [ ] `getOrCreatePool(contentHash)` - Atomic transaction
    - [ ] `fetchQuestionsFromPool(poolId, count, userId?)` - 로그인 시 exclude, 비로그인 시 랜덤
    - [ ] `saveQuestionsToPool(poolId, questions)`
- [ ] API 수정
    - [ ] `POST /api/quiz/generate` - 텍스트 길이 분기 + 풀 생성/저장
    - [ ] `POST /api/quiz/load-more` - 신규 엔드포인트 (로그인/비로그인 분기)

### 클라이언트
- [ ] `QuizResult` 페이지 "더 풀기" 버튼 UI
- [ ] 남은 문제 수 표시 (로그인 사용자만)
- [ ] 비로그인 사용자용 로그인 유도 배너 ("로그인하면 기록이 저장됩니다")
