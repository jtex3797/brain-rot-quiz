-- Migration 004: saved_quizzes 테이블에 ai_model 컬럼 추가
-- 퀴즈 생성 시 사용된 AI 모델을 저장하여 결과 화면/목록 배지에 표시

ALTER TABLE public.saved_quizzes
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'auto';

COMMENT ON COLUMN public.saved_quizzes.ai_model
  IS 'AI 모델 ID. 값: auto | gemini-2.0-flash | gpt-4o-mini | claude-3-5-haiku-20241022';
