-- =====================================================
-- BrainRotQuiz 테이블 리네이밍 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- =====================================================
-- 1. 테이블 리네이밍
-- =====================================================
ALTER TABLE public.profiles RENAME TO user_profiles;
ALTER TABLE public.quiz_cache RENAME TO generation_cache;
ALTER TABLE public.quiz_pools RENAME TO question_banks;
ALTER TABLE public.pool_questions RENAME TO question_bank_items;
ALTER TABLE public.quizzes RENAME TO saved_quizzes;
ALTER TABLE public.questions RENAME TO saved_questions;
ALTER TABLE public.quiz_sessions RENAME TO play_sessions;
ALTER TABLE public.session_answers RENAME TO play_answers;

-- =====================================================
-- 2. 컬럼 리네이밍
-- =====================================================
ALTER TABLE public.saved_quizzes RENAME COLUMN pool_id TO bank_id;
ALTER TABLE public.question_bank_items RENAME COLUMN pool_id TO bank_id;

-- =====================================================
-- 3. 인덱스 리네이밍
-- =====================================================
ALTER INDEX idx_quizzes_user_id RENAME TO idx_saved_quizzes_user_id;
ALTER INDEX idx_quizzes_share_code RENAME TO idx_saved_quizzes_share_code;
-- idx_quizzes_pool_id는 존재하지 않으므로 새로 생성
CREATE INDEX IF NOT EXISTS idx_saved_quizzes_bank_id ON public.saved_quizzes(bank_id);
ALTER INDEX idx_questions_quiz_id RENAME TO idx_saved_questions_quiz_id;
ALTER INDEX idx_quiz_sessions_user_id RENAME TO idx_play_sessions_user_id;
ALTER INDEX idx_quiz_sessions_quiz_id RENAME TO idx_play_sessions_quiz_id;
ALTER INDEX idx_session_answers_session_id RENAME TO idx_play_answers_session_id;
ALTER INDEX idx_quiz_cache_hash RENAME TO idx_generation_cache_hash;
ALTER INDEX idx_quiz_cache_expires RENAME TO idx_generation_cache_expires;
ALTER INDEX idx_quiz_pools_content_hash RENAME TO idx_question_banks_content_hash;
ALTER INDEX idx_quiz_pools_expires_at RENAME TO idx_question_banks_expires_at;
ALTER INDEX idx_pool_questions_pool_id RENAME TO idx_question_bank_items_bank_id;

-- =====================================================
-- 4. RLS 정책 재생성 (테이블명 참조 업데이트)
-- =====================================================

-- saved_questions RLS (quizzes → saved_quizzes 참조)
DROP POLICY IF EXISTS "Questions follow quiz access" ON public.saved_questions;
CREATE POLICY "Questions follow quiz access"
  ON public.saved_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_quizzes
      WHERE saved_quizzes.id = saved_questions.quiz_id
      AND (saved_quizzes.user_id = auth.uid() OR saved_quizzes.is_public = TRUE)
    )
  );

DROP POLICY IF EXISTS "Users can create questions for own quizzes" ON public.saved_questions;
CREATE POLICY "Users can create questions for own quizzes"
  ON public.saved_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_quizzes
      WHERE saved_quizzes.id = quiz_id AND saved_quizzes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete questions from own quizzes" ON public.saved_questions;
CREATE POLICY "Users can delete questions from own quizzes"
  ON public.saved_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_quizzes
      WHERE saved_quizzes.id = saved_questions.quiz_id AND saved_quizzes.user_id = auth.uid()
    )
  );

-- play_answers RLS (quiz_sessions → play_sessions 참조)
DROP POLICY IF EXISTS "Users can view own answers" ON public.play_answers;
CREATE POLICY "Users can view own answers"
  ON public.play_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.play_sessions
      WHERE play_sessions.id = play_answers.session_id
      AND play_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own answers" ON public.play_answers;
CREATE POLICY "Users can create own answers"
  ON public.play_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.play_sessions
      WHERE play_sessions.id = session_id
      AND play_sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. RPC 함수 업데이트 (profiles → user_profiles)
-- =====================================================

-- handle_new_user 함수 업데이트
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- add_xp 함수 업데이트
CREATE OR REPLACE FUNCTION public.add_xp(p_user_id UUID, xp_amount INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, level_up BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_level INTEGER;
  updated_xp INTEGER;
  updated_level INTEGER;
BEGIN
  SELECT level INTO old_level FROM public.user_profiles WHERE id = p_user_id;

  UPDATE public.user_profiles
  SET
    xp = user_profiles.xp + xp_amount,
    level = calculate_level(user_profiles.xp + xp_amount),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING user_profiles.xp, user_profiles.level INTO updated_xp, updated_level;

  RETURN QUERY SELECT updated_xp, updated_level, (updated_level > old_level);
END;
$$;

-- update_streak 함수 업데이트
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS TABLE(new_streak INTEGER, is_new_day BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_played TIMESTAMPTZ;
  today DATE := CURRENT_DATE;
  yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  streak_val INTEGER;
  result_is_new_day BOOLEAN := FALSE;
BEGIN
  SELECT last_played_at, current_streak INTO last_played, streak_val
  FROM public.user_profiles WHERE id = p_user_id;

  IF last_played IS NULL OR last_played::DATE < yesterday THEN
    streak_val := 1;
    result_is_new_day := TRUE;
  ELSIF last_played::DATE = yesterday THEN
    streak_val := streak_val + 1;
    result_is_new_day := TRUE;
  ELSIF last_played::DATE = today THEN
    result_is_new_day := FALSE;
  ELSE
    streak_val := 1;
    result_is_new_day := TRUE;
  END IF;

  UPDATE public.user_profiles
  SET
    current_streak = streak_val,
    longest_streak = GREATEST(longest_streak, streak_val),
    last_played_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT streak_val, result_is_new_day;
END;
$$;

-- cleanup_expired_cache 함수 업데이트
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.generation_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- cleanup_expired_pools → cleanup_expired_banks
DROP FUNCTION IF EXISTS public.cleanup_expired_pools();
CREATE OR REPLACE FUNCTION public.cleanup_expired_banks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.question_banks
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- increment_profile_stats 함수 업데이트
CREATE OR REPLACE FUNCTION public.increment_profile_stats(
  p_user_id UUID,
  p_quizzes_played INTEGER DEFAULT 0,
  p_questions_answered INTEGER DEFAULT 0,
  p_correct_answers INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    total_quizzes_played = total_quizzes_played + p_quizzes_played,
    total_questions_answered = total_questions_answered + p_questions_answered,
    total_correct_answers = total_correct_answers + p_correct_answers,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;


-- =====================================================
-- 롤백 SQL (문제 발생 시)
-- =====================================================
/*
ALTER TABLE public.user_profiles RENAME TO profiles;
ALTER TABLE public.generation_cache RENAME TO quiz_cache;
ALTER TABLE public.question_banks RENAME TO quiz_pools;
ALTER TABLE public.question_bank_items RENAME TO pool_questions;
ALTER TABLE public.saved_quizzes RENAME TO quizzes;
ALTER TABLE public.saved_questions RENAME TO questions;
ALTER TABLE public.play_sessions RENAME TO quiz_sessions;
ALTER TABLE public.play_answers RENAME TO session_answers;
ALTER TABLE public.quizzes RENAME COLUMN bank_id TO pool_id;
*/
