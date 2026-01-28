-- =====================================================
-- 002_correct_answers_array.sql
-- correctAnswer(string) → correctAnswers(string[]) 변환
-- Supabase SQL Editor에서 수동 실행
-- =====================================================

-- 1. saved_questions: correct_answer(TEXT) → correct_answers(TEXT[])
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

-- =====================================================
-- 롤백 SQL (문제 발생 시)
-- =====================================================
/*
ALTER TABLE public.saved_questions
  RENAME COLUMN correct_answers TO correct_answer;

ALTER TABLE public.saved_questions
  ALTER COLUMN correct_answer TYPE TEXT
  USING correct_answer[1];

UPDATE public.question_bank_items
SET question_json = jsonb_set(
  question_json - 'correctAnswers',
  '{correctAnswer}',
  to_jsonb((question_json->'correctAnswers'->>0))
)
WHERE question_json ? 'correctAnswers';
*/
