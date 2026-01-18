-- BrainRotQuiz Supabase Schema
-- Supabase SQL Editor에서 실행하세요

-- =====================================================
-- 1. profiles 테이블 (사용자 프로필 + 게이미피케이션)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 신규 가입 시 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =====================================================
-- 2. quizzes 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_text TEXT,

  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count INTEGER NOT NULL,

  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  share_code TEXT UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_share_code ON quizzes(share_code);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or public quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can create own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quizzes"
  ON quizzes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes"
  ON quizzes FOR DELETE
  USING (auth.uid() = user_id);


-- =====================================================
-- 3. questions 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,

  type TEXT NOT NULL CHECK (type IN ('mcq', 'ox', 'short', 'fill')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,

  order_index INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions follow quiz access"
  ON questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id
      AND (quizzes.user_id = auth.uid() OR quizzes.is_public = TRUE)
    )
  );

CREATE POLICY "Users can create questions for own quizzes"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_id AND quizzes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete questions from own quizzes"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = questions.quiz_id AND quizzes.user_id = auth.uid()
    )
  );


-- =====================================================
-- 4. quiz_sessions 테이블 (플레이 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,

  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  max_combo INTEGER DEFAULT 0 NOT NULL,
  xp_earned INTEGER DEFAULT 0 NOT NULL,

  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,

  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON quiz_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON quiz_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON quiz_sessions FOR UPDATE
  USING (auth.uid() = user_id);


-- =====================================================
-- 5. session_answers 테이블 (개별 답변)
-- =====================================================
CREATE TABLE IF NOT EXISTS session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,

  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INTEGER,

  answered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_answers_session_id ON session_answers(session_id);

ALTER TABLE session_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own answers"
  ON session_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions
      WHERE quiz_sessions.id = session_answers.session_id
      AND quiz_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own answers"
  ON session_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_sessions
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
CREATE OR REPLACE FUNCTION add_xp(p_user_id UUID, xp_amount INTEGER)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, level_up BOOLEAN) AS $$
DECLARE
  old_level INTEGER;
  updated_xp INTEGER;
  updated_level INTEGER;
BEGIN
  SELECT level INTO old_level FROM profiles WHERE id = p_user_id;

  UPDATE profiles
  SET
    xp = profiles.xp + xp_amount,
    level = calculate_level(profiles.xp + xp_amount),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING profiles.xp, profiles.level INTO updated_xp, updated_level;

  RETURN QUERY SELECT updated_xp, updated_level, (updated_level > old_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 스트릭 업데이트 함수
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS TABLE(new_streak INTEGER, is_new_day BOOLEAN) AS $$
DECLARE
  last_played TIMESTAMPTZ;
  today DATE := CURRENT_DATE;
  yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  streak_val INTEGER;
  result_is_new_day BOOLEAN := FALSE;
BEGIN
  SELECT last_played_at, current_streak INTO last_played, streak_val
  FROM profiles WHERE id = p_user_id;

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

  UPDATE profiles
  SET
    current_streak = streak_val,
    longest_streak = GREATEST(longest_streak, streak_val),
    last_played_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT streak_val, result_is_new_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
