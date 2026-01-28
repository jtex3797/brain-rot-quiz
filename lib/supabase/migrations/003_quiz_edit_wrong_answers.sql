-- Migration 003: 퀴즈 수정 기능 + 오답노트
-- 적용일: 2026-01-28

-- =====================================================
-- 1. saved_questions UPDATE 정책 추가
-- =====================================================
DROP POLICY IF EXISTS "Users can update questions in own quizzes" ON public.saved_questions;
CREATE POLICY "Users can update questions in own quizzes"
  ON public.saved_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_quizzes
      WHERE saved_quizzes.id = saved_questions.quiz_id AND saved_quizzes.user_id = auth.uid()
    )
  );


-- =====================================================
-- 2. wrong_answers 테이블 (오답노트)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,

  -- 원본 참조 (삭제되면 NULL)
  quiz_id UUID REFERENCES public.saved_quizzes(id) ON DELETE SET NULL,
  question_id UUID REFERENCES public.saved_questions(id) ON DELETE SET NULL,

  -- 스냅샷 (항상 유지)
  quiz_title TEXT NOT NULL,
  question_snapshot JSONB NOT NULL,

  -- 오답 정보
  user_answer TEXT NOT NULL,
  wrong_count INTEGER DEFAULT 1 NOT NULL,

  -- 상태
  is_outdated BOOLEAN DEFAULT FALSE NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE NOT NULL,

  -- 타임스탬프
  first_wrong_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_wrong_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ,

  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_wrong_answers_user_id ON public.wrong_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_question_id ON public.wrong_answers(question_id);

ALTER TABLE public.wrong_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wrong answers" ON public.wrong_answers;
CREATE POLICY "Users can view own wrong answers"
  ON public.wrong_answers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own wrong answers" ON public.wrong_answers;
CREATE POLICY "Users can create own wrong answers"
  ON public.wrong_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wrong answers" ON public.wrong_answers;
CREATE POLICY "Users can update own wrong answers"
  ON public.wrong_answers FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wrong answers" ON public.wrong_answers;
CREATE POLICY "Users can delete own wrong answers"
  ON public.wrong_answers FOR DELETE
  USING (auth.uid() = user_id);
