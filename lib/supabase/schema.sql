-- BrainRotQuiz Supabase Schema
-- Supabase SQL Editor에서 실행하세요

-- =====================================================
-- 1. profiles 테이블 (사용자 프로필 + 게이미피케이션)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 신규 가입 시 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
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
-- 2. quizzes 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_text TEXT,

  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count INTEGER NOT NULL,

  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  share_code TEXT UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_share_code ON public.quizzes(share_code);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or public quizzes" ON public.quizzes;
CREATE POLICY "Users can view own or public quizzes"
  ON public.quizzes FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

DROP POLICY IF EXISTS "Users can create own quizzes" ON public.quizzes;
CREATE POLICY "Users can create own quizzes"
  ON public.quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quizzes" ON public.quizzes;
CREATE POLICY "Users can update own quizzes"
  ON public.quizzes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own quizzes" ON public.quizzes;
CREATE POLICY "Users can delete own quizzes"
  ON public.quizzes FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================
-- 3. questions 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,

  type TEXT NOT NULL CHECK (type IN ('mcq', 'ox', 'short', 'fill')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,

  order_index INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Questions follow quiz access" ON public.questions;
CREATE POLICY "Questions follow quiz access"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id
      AND (quizzes.user_id = auth.uid() OR quizzes.is_public = TRUE)
    )
  );

DROP POLICY IF EXISTS "Users can create questions for own quizzes" ON public.questions;
CREATE POLICY "Users can create questions for own quizzes"
  ON public.questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = quiz_id AND quizzes.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete questions from own quizzes" ON public.questions;
CREATE POLICY "Users can delete questions from own quizzes"
  ON public.questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id AND quizzes.user_id = auth.uid()
    )
  );


-- =====================================================
-- 4. quiz_sessions 테이블 (플레이 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,

  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  max_combo INTEGER DEFAULT 0 NOT NULL,
  xp_earned INTEGER DEFAULT 0 NOT NULL,

  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON public.quiz_sessions(quiz_id);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.quiz_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.quiz_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON public.quiz_sessions;
CREATE POLICY "Users can create own sessions"
  ON public.quiz_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.quiz_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.quiz_sessions FOR UPDATE
  USING (auth.uid() = user_id);


-- =====================================================
-- 5. session_answers 테이블 (개별 답변)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,

  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INTEGER,

  answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_answers_session_id ON public.session_answers(session_id);

ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own answers" ON public.session_answers;
CREATE POLICY "Users can view own answers"
  ON public.session_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions
      WHERE quiz_sessions.id = session_answers.session_id
      AND quiz_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own answers" ON public.session_answers;
CREATE POLICY "Users can create own answers"
  ON public.session_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions
      WHERE quiz_sessions.id = session_id
      AND quiz_sessions.user_id = auth.uid()
    )
  );


-- =====================================================
-- 6. 유틸리티 함수
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
  SELECT level INTO old_level FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles
  SET
    xp = profiles.xp + xp_amount,
    level = calculate_level(profiles.xp + xp_amount),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING profiles.xp, profiles.level INTO updated_xp, updated_level;

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
  FROM public.profiles WHERE id = p_user_id;

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

  UPDATE public.profiles
  SET
    current_streak = streak_val,
    longest_streak = GREATEST(longest_streak, streak_val),
    last_played_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT streak_val, result_is_new_day;
END;
$$;


-- =====================================================
-- 7. quiz_cache 테이블 (AI 생성 퀴즈 캐시)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quiz_cache (
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

CREATE INDEX IF NOT EXISTS idx_quiz_cache_hash ON public.quiz_cache(content_hash, options_hash);
CREATE INDEX IF NOT EXISTS idx_quiz_cache_expires ON public.quiz_cache(expires_at);

-- RLS: 캐시는 모든 사용자가 읽기/쓰기 가능 (공용 캐시)
ALTER TABLE public.quiz_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read cache" ON public.quiz_cache;
CREATE POLICY "Anyone can read cache"
  ON public.quiz_cache FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can insert cache" ON public.quiz_cache;
CREATE POLICY "Anyone can insert cache"
  ON public.quiz_cache FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Anyone can update cache" ON public.quiz_cache;
CREATE POLICY "Anyone can update cache"
  ON public.quiz_cache FOR UPDATE
  USING (TRUE);

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
  DELETE FROM public.quiz_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- =====================================================
-- 8. quiz_pools 테이블 (문제 풀 - 긴 텍스트용 캐시)
-- =====================================================
-- 500자 이상 텍스트의 문제 풀 메타데이터
-- quiz_cache는 짧은 텍스트(500자 미만) 전용으로 유지

CREATE TABLE IF NOT EXISTS public.quiz_pools (
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

CREATE INDEX IF NOT EXISTS idx_quiz_pools_content_hash ON public.quiz_pools(content_hash);
CREATE INDEX IF NOT EXISTS idx_quiz_pools_expires_at ON public.quiz_pools(expires_at);

-- RLS: 공용 캐시이므로 누구나 읽기/쓰기 가능
ALTER TABLE public.quiz_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pools" ON public.quiz_pools;
CREATE POLICY "Anyone can read pools"
  ON public.quiz_pools FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can insert pools" ON public.quiz_pools;
CREATE POLICY "Anyone can insert pools"
  ON public.quiz_pools FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Anyone can update pools" ON public.quiz_pools;
CREATE POLICY "Anyone can update pools"
  ON public.quiz_pools FOR UPDATE
  USING (TRUE);


-- =====================================================
-- 9. pool_questions 테이블 (풀 소속 개별 문제)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pool_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 풀 참조
  pool_id UUID NOT NULL REFERENCES public.quiz_pools(id) ON DELETE CASCADE,

  -- 문제 데이터 (질문, 보기, 정답, 해설)
  question_json JSONB NOT NULL,

  -- 생성 방식 (ai: AI 생성, transformed: 변형)
  source_type TEXT NOT NULL CHECK (source_type IN ('ai', 'transformed')),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pool_questions_pool_id ON public.pool_questions(pool_id);

-- RLS: 공용 캐시이므로 누구나 읽기/쓰기 가능
ALTER TABLE public.pool_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pool questions" ON public.pool_questions;
CREATE POLICY "Anyone can read pool questions"
  ON public.pool_questions FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Anyone can insert pool questions" ON public.pool_questions;
CREATE POLICY "Anyone can insert pool questions"
  ON public.pool_questions FOR INSERT
  WITH CHECK (TRUE);


-- 만료된 풀 자동 삭제 함수
CREATE OR REPLACE FUNCTION public.cleanup_expired_pools()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.quiz_pools
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
