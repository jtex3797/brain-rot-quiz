-- BrainRotQuiz Supabase Schema (v2 - Current)
-- =====================================================
-- 이 파일은 현재 Supabase에 적용된 최신 스키마(v2)입니다.
--
-- [파일 구조]
-- 1. lib/supabase/schema.sql          : 현재 적용된 스키마 (v2)
-- 2. lib/supabase/schema_original.sql : 마이그레이션 전 원본 스키마 (v1)
-- 3. lib/supabase/migrations/         : 마이그레이션 스크립트
--
-- [v2 주요 변경사항]
-- - 테이블 리네이밍 (예: profiles -> user_profiles, quizzes -> saved_quizzes)
-- - Question Bank 캐시 구조 개선
-- =====================================================

-- =====================================================
-- 1. user_profiles 테이블 (사용자 프로필 + 게이미피케이션)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nickname TEXT,
  avatar_url TEXT,

  -- 게이미피케이션
  xp INTEGER DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_played_at TIMESTAMPTZ,

  -- 통계
  total_quizzes_played INTEGER DEFAULT 0 NOT NULL,
  total_questions_answered INTEGER DEFAULT 0 NOT NULL,
  total_correct_answers INTEGER DEFAULT 0 NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS 정책
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 신규 가입 시 프로필 자동 생성 트리거
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =====================================================
-- 2. question_banks 테이블 (문제 은행 - 긴 텍스트용 캐시)
-- =====================================================
-- 500자 이상 텍스트의 문제 은행 메타데이터
-- generation_cache는 짧은 텍스트(500자 미만) 전용으로 유지

CREATE TABLE IF NOT EXISTS public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 캐시 키
  content_hash TEXT NOT NULL UNIQUE,

  -- 원본 텍스트 (재사용 대비)
  original_content TEXT NOT NULL,

  -- 용량 정보
  max_capacity INTEGER NOT NULL,
  generated_count INTEGER NOT NULL DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_banks_content_hash ON public.question_banks(content_hash);
CREATE INDEX IF NOT EXISTS idx_question_banks_expires_at ON public.question_banks(expires_at);

-- RLS: 공용 캐시이므로 누구나 읽기/쓰기 가능
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read banks" ON public.question_banks;
CREATE POLICY "Anyone can read banks"
  ON public.question_banks FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can insert banks" ON public.question_banks;
CREATE POLICY "Anyone can insert banks"
  ON public.question_banks FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Anyone can update banks" ON public.question_banks;
CREATE POLICY "Anyone can update banks"
  ON public.question_banks FOR UPDATE
  USING (TRUE);


-- =====================================================
-- 3. question_bank_items 테이블 (은행 소속 개별 문제)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.question_bank_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 은행 참조
  bank_id UUID NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,

  -- 문제 데이터 (질문, 보기, 정답, 해설)
  question_json JSONB NOT NULL,

  -- 생성 방식 (ai: AI 생성, transformed: 변형)
  source_type TEXT NOT NULL CHECK (source_type IN ('ai', 'transformed')),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_bank_items_bank_id ON public.question_bank_items(bank_id);

-- RLS: 공용 캐시이므로 누구나 읽기/쓰기 가능
ALTER TABLE public.question_bank_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bank items" ON public.question_bank_items;
CREATE POLICY "Anyone can read bank items"
  ON public.question_bank_items FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can insert bank items" ON public.question_bank_items;
CREATE POLICY "Anyone can insert bank items"
  ON public.question_bank_items FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Anyone can update bank items" ON public.question_bank_items;
CREATE POLICY "Anyone can update bank items"
  ON public.question_bank_items FOR UPDATE
  USING (TRUE);


-- =====================================================
-- 4. saved_quizzes 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_text TEXT,

  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count INTEGER NOT NULL,

  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  share_code TEXT UNIQUE,

  -- Question Bank 시스템 연동
  bank_id UUID REFERENCES public.question_banks(id),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_quizzes_user_id ON public.saved_quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_quizzes_share_code ON public.saved_quizzes(share_code);
CREATE INDEX IF NOT EXISTS idx_saved_quizzes_bank_id ON public.saved_quizzes(bank_id);

ALTER TABLE public.saved_quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or public quizzes" ON public.saved_quizzes;
CREATE POLICY "Users can view own or public quizzes"
  ON public.saved_quizzes FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

DROP POLICY IF EXISTS "Users can create own quizzes" ON public.saved_quizzes;
CREATE POLICY "Users can create own quizzes"
  ON public.saved_quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quizzes" ON public.saved_quizzes;
CREATE POLICY "Users can update own quizzes"
  ON public.saved_quizzes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own quizzes" ON public.saved_quizzes;
CREATE POLICY "Users can delete own quizzes"
  ON public.saved_quizzes FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================
-- 5. saved_questions 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.saved_quizzes(id) ON DELETE CASCADE NOT NULL,

  type TEXT NOT NULL CHECK (type IN ('mcq', 'ox', 'short', 'fill')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,

  order_index INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_questions_quiz_id ON public.saved_questions(quiz_id);

ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;

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
-- 6. play_sessions 테이블 (플레이 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.play_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES public.saved_quizzes(id) ON DELETE SET NULL,

  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  max_combo INTEGER DEFAULT 0 NOT NULL,
  xp_earned INTEGER DEFAULT 0 NOT NULL,

  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_play_sessions_user_id ON public.play_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_play_sessions_quiz_id ON public.play_sessions(quiz_id);

ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.play_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.play_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON public.play_sessions;
CREATE POLICY "Users can create own sessions"
  ON public.play_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.play_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.play_sessions FOR UPDATE
  USING (auth.uid() = user_id);


-- =====================================================
-- 7. play_answers 테이블 (개별 답변)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.play_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.play_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.saved_questions(id) ON DELETE SET NULL,

  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INTEGER,

  answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_play_answers_session_id ON public.play_answers(session_id);

ALTER TABLE public.play_answers ENABLE ROW LEVEL SECURITY;

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
-- 8. generation_cache 테이블 (AI 생성 퀴즈 캐시)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.generation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 캐시 키: 텍스트 해시 + 옵션 조합
  content_hash TEXT NOT NULL,
  options_hash TEXT NOT NULL,

  -- 캐시된 퀴즈 데이터
  quiz_data JSONB NOT NULL,

  -- 메타데이터
  hit_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- TTL (30일 후 만료)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,

  -- 복합 유니크 제약 (같은 텍스트 + 같은 옵션 = 같은 캐시)
  UNIQUE(content_hash, options_hash)
);

CREATE INDEX IF NOT EXISTS idx_generation_cache_hash ON public.generation_cache(content_hash, options_hash);
CREATE INDEX IF NOT EXISTS idx_generation_cache_expires ON public.generation_cache(expires_at);

-- RLS: 캐시는 모든 사용자가 읽기/쓰기 가능 (공용 캐시)
ALTER TABLE public.generation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read cache" ON public.generation_cache;
CREATE POLICY "Anyone can read cache"
  ON public.generation_cache FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can insert cache" ON public.generation_cache;
CREATE POLICY "Anyone can insert cache"
  ON public.generation_cache FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Anyone can update cache" ON public.generation_cache;
CREATE POLICY "Anyone can update cache"
  ON public.generation_cache FOR UPDATE
  USING (TRUE);


-- =====================================================
-- 9. 유틸리티 함수
-- =====================================================

-- XP를 레벨로 변환하는 함수
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, FLOOR((-1 + SQRT(1 + 8 * xp / 100.0)) / 2)::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- XP 추가 및 레벨 업데이트 함수
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

-- 스트릭 업데이트 함수
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

-- 프로필 통계 업데이트 함수
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

-- 만료된 캐시 자동 삭제 함수
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

-- 만료된 문제 은행 자동 삭제 함수
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


-- =====================================================
-- 10. wrong_answers 테이블 (오답노트)
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
  -- { type, questionText, options, correctAnswers, explanation }

  -- 오답 정보
  user_answer TEXT NOT NULL,
  wrong_count INTEGER DEFAULT 1 NOT NULL,

  -- 상태
  is_outdated BOOLEAN DEFAULT FALSE NOT NULL,  -- 원본 수정됨
  is_resolved BOOLEAN DEFAULT FALSE NOT NULL,  -- 다시 맞춤

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


-- =====================================================
-- 11. badges 테이블 (뱃지 정의)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('level', 'combo', 'streak', 'quiz_count', 'accuracy', 'special')),
  tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 4),
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Anyone can view badges"
  ON public.badges FOR SELECT
  USING (TRUE);


-- =====================================================
-- 12. user_badges 테이블 (사용자 획득 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_notified BOOLEAN DEFAULT FALSE NOT NULL,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own badges" ON public.user_badges;
CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;
CREATE POLICY "Users can insert own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own badges" ON public.user_badges;
CREATE POLICY "Users can update own badges"
  ON public.user_badges FOR UPDATE
  USING (auth.uid() = user_id);


-- =====================================================
-- 13. 뱃지 초기 데이터
-- =====================================================
INSERT INTO badges (code, name, description, icon, category, tier, condition_type, condition_value, sort_order) VALUES
-- 레벨 뱃지
('level_5', '초보 학습자', '레벨 5 달성', '🌱', 'level', 1, 'level_reach', 5, 100),
('level_10', '성장하는 학습자', '레벨 10 달성', '🌿', 'level', 2, 'level_reach', 10, 101),
('level_25', '숙련된 학습자', '레벨 25 달성', '🌳', 'level', 3, 'level_reach', 25, 102),
('level_50', '마스터 학습자', '레벨 50 달성', '🏆', 'level', 4, 'level_reach', 50, 103),
-- 콤보 뱃지
('combo_5', '콤보 시작!', '5 콤보 달성', '🔥', 'combo', 1, 'combo_achieve', 5, 200),
('combo_10', '불타는 연속', '10 콤보 달성', '💥', 'combo', 2, 'combo_achieve', 10, 201),
('combo_20', '콤보 마스터', '20 콤보 달성', '⚡', 'combo', 3, 'combo_achieve', 20, 202),
('combo_50', '전설의 콤보', '50 콤보 달성', '🌟', 'combo', 4, 'combo_achieve', 50, 203),
-- 스트릭 뱃지
('streak_3', '3일 연속', '3일 연속 학습', '📅', 'streak', 1, 'streak_reach', 3, 300),
('streak_7', '일주일 연속', '7일 연속 학습', '🗓️', 'streak', 2, 'streak_reach', 7, 301),
('streak_30', '한 달 연속', '30일 연속 학습', '📆', 'streak', 3, 'streak_reach', 30, 302),
('streak_100', '100일의 기적', '100일 연속 학습', '🎯', 'streak', 4, 'streak_reach', 100, 303),
-- 퀴즈 완료 뱃지
('quiz_1', '첫 퀴즈', '첫 번째 퀴즈 완료', '🎉', 'quiz_count', 1, 'quiz_complete', 1, 400),
('quiz_10', '퀴즈 애호가', '10개 퀴즈 완료', '📝', 'quiz_count', 1, 'quiz_complete', 10, 401),
('quiz_50', '퀴즈 탐험가', '50개 퀴즈 완료', '🗺️', 'quiz_count', 2, 'quiz_complete', 50, 402),
('quiz_100', '퀴즈 정복자', '100개 퀴즈 완료', '👑', 'quiz_count', 3, 'quiz_complete', 100, 403),
('quiz_500', '퀴즈 전설', '500개 퀴즈 완료', '💎', 'quiz_count', 4, 'quiz_complete', 500, 404),
-- 정답률 뱃지
('accuracy_80', '정확도 80%', '정답률 80% 이상 유지', '✅', 'accuracy', 1, 'accuracy_maintain', 80, 500),
('accuracy_90', '정확도 90%', '정답률 90% 이상 유지', '🎯', 'accuracy', 2, 'accuracy_maintain', 90, 501),
('accuracy_95', '정확도 95%', '정답률 95% 이상 유지', '💯', 'accuracy', 3, 'accuracy_maintain', 95, 502)
ON CONFLICT (code) DO NOTHING;


-- =====================================================
-- 14. 뱃지 체크 및 부여 함수
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS TABLE(badge_code TEXT, badge_name TEXT, badge_icon TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_badge RECORD;
  v_max_combo INTEGER;
BEGIN
  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(MAX(max_combo), 0) INTO v_max_combo
  FROM play_sessions WHERE user_id = p_user_id;

  FOR v_badge IN SELECT * FROM badges ORDER BY sort_order LOOP
    IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    IF (
      (v_badge.condition_type = 'level_reach' AND v_profile.level >= v_badge.condition_value) OR
      (v_badge.condition_type = 'combo_achieve' AND v_max_combo >= v_badge.condition_value) OR
      (v_badge.condition_type = 'streak_reach' AND v_profile.longest_streak >= v_badge.condition_value) OR
      (v_badge.condition_type = 'quiz_complete' AND v_profile.total_quizzes_played >= v_badge.condition_value) OR
      (v_badge.condition_type = 'accuracy_maintain' AND
       v_profile.total_questions_answered >= 50 AND
       (v_profile.total_correct_answers::FLOAT / v_profile.total_questions_answered * 100) >= v_badge.condition_value)
    ) THEN
      INSERT INTO user_badges (user_id, badge_id, is_notified)
      VALUES (p_user_id, v_badge.id, FALSE);

      badge_code := v_badge.code;
      badge_name := v_badge.name;
      badge_icon := v_badge.icon;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
