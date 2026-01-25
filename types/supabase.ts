export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          nickname: string | null;
          avatar_url: string | null;
          xp: number;
          level: number;
          current_streak: number;
          longest_streak: number;
          last_played_at: string | null;
          total_quizzes_played: number;
          total_questions_answered: number;
          total_correct_answers: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nickname?: string | null;
          avatar_url?: string | null;
          xp?: number;
          level?: number;
          current_streak?: number;
          longest_streak?: number;
          last_played_at?: string | null;
          total_quizzes_played?: number;
          total_questions_answered?: number;
          total_correct_answers?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          nickname?: string | null;
          avatar_url?: string | null;
          xp?: number;
          level?: number;
          current_streak?: number;
          longest_streak?: number;
          last_played_at?: string | null;
          total_quizzes_played?: number;
          total_questions_answered?: number;
          total_correct_answers?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      saved_quizzes: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          source_text: string | null;
          difficulty: 'easy' | 'medium' | 'hard' | null;
          question_count: number;
          is_public: boolean;
          share_code: string | null;
          bank_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          source_text?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard' | null;
          question_count: number;
          is_public?: boolean;
          share_code?: string | null;
          bank_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          source_text?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard' | null;
          question_count?: number;
          is_public?: boolean;
          share_code?: string | null;
          bank_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      saved_questions: {
        Row: {
          id: string;
          quiz_id: string;
          type: 'mcq' | 'ox' | 'short' | 'fill';
          question_text: string;
          options: Json | null;
          correct_answer: string;
          explanation: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          type: 'mcq' | 'ox' | 'short' | 'fill';
          question_text: string;
          options?: Json | null;
          correct_answer: string;
          explanation?: string | null;
          order_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          type?: 'mcq' | 'ox' | 'short' | 'fill';
          question_text?: string;
          options?: Json | null;
          correct_answer?: string;
          explanation?: string | null;
          order_index?: number;
          created_at?: string;
        };
      };
      play_sessions: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string | null;
          score: number;
          correct_count: number;
          total_questions: number;
          max_combo: number;
          xp_earned: number;
          started_at: string;
          completed_at: string | null;
          status: 'in_progress' | 'completed' | 'abandoned';
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_id?: string | null;
          score: number;
          correct_count: number;
          total_questions: number;
          max_combo?: number;
          xp_earned?: number;
          started_at?: string;
          completed_at?: string | null;
          status?: 'in_progress' | 'completed' | 'abandoned';
        };
        Update: {
          id?: string;
          user_id?: string;
          quiz_id?: string | null;
          score?: number;
          correct_count?: number;
          total_questions?: number;
          max_combo?: number;
          xp_earned?: number;
          started_at?: string;
          completed_at?: string | null;
          status?: 'in_progress' | 'completed' | 'abandoned';
        };
      };
      play_answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string | null;
          user_answer: string;
          is_correct: boolean;
          time_spent_ms: number | null;
          answered_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          question_id?: string | null;
          user_answer: string;
          is_correct: boolean;
          time_spent_ms?: number | null;
          answered_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          question_id?: string | null;
          user_answer?: string;
          is_correct?: boolean;
          time_spent_ms?: number | null;
          answered_at?: string;
        };
      };
      generation_cache: {
        Row: {
          id: string;
          content_hash: string;
          options_hash: string;
          quiz_data: Json;
          hit_count: number;
          created_at: string;
          last_accessed_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          content_hash: string;
          options_hash: string;
          quiz_data: Json;
          hit_count?: number;
          created_at?: string;
          last_accessed_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          content_hash?: string;
          options_hash?: string;
          quiz_data?: Json;
          hit_count?: number;
          created_at?: string;
          last_accessed_at?: string;
          expires_at?: string;
        };
      };
      question_banks: {
        Row: {
          id: string;
          content_hash: string;
          original_content: string;
          max_capacity: number;
          generated_count: number;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          content_hash: string;
          original_content: string;
          max_capacity: number;
          generated_count?: number;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          content_hash?: string;
          original_content?: string;
          max_capacity?: number;
          generated_count?: number;
          created_at?: string;
          expires_at?: string;
        };
      };
      bank_questions: {
        Row: {
          id: string;
          bank_id: string;
          question_json: Json;
          source_type: 'ai' | 'transformed';
          created_at: string;
        };
        Insert: {
          id?: string;
          bank_id: string;
          question_json: Json;
          source_type: 'ai' | 'transformed';
          created_at?: string;
        };
        Update: {
          id?: string;
          bank_id?: string;
          question_json?: Json;
          source_type?: 'ai' | 'transformed';
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_xp: {
        Args: {
          p_user_id: string;
          xp_amount: number;
        };
        Returns: {
          new_xp: number;
          new_level: number;
          level_up: boolean;
        }[];
      };
      update_streak: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          new_streak: number;
          is_new_day: boolean;
        }[];
      };
      cleanup_expired_cache: {
        Args: Record<string, never>;
        Returns: number;
      };
      cleanup_expired_banks: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// 편의를 위한 타입 별칭
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

export type DbSavedQuiz = Database['public']['Tables']['saved_quizzes']['Row'];
export type DbSavedQuizInsert = Database['public']['Tables']['saved_quizzes']['Insert'];
export type DbSavedQuizUpdate = Database['public']['Tables']['saved_quizzes']['Update'];

export type DbSavedQuestion = Database['public']['Tables']['saved_questions']['Row'];
export type DbSavedQuestionInsert = Database['public']['Tables']['saved_questions']['Insert'];

export type PlaySession = Database['public']['Tables']['play_sessions']['Row'];
export type PlaySessionInsert = Database['public']['Tables']['play_sessions']['Insert'];
export type PlaySessionUpdate = Database['public']['Tables']['play_sessions']['Update'];

export type PlayAnswer = Database['public']['Tables']['play_answers']['Row'];
export type PlayAnswerInsert = Database['public']['Tables']['play_answers']['Insert'];

export type DbQuestionBank = Database['public']['Tables']['question_banks']['Row'];
export type DbQuestionBankInsert = Database['public']['Tables']['question_banks']['Insert'];
export type DbQuestionBankUpdate = Database['public']['Tables']['question_banks']['Update'];

export type DbBankQuestion = Database['public']['Tables']['bank_questions']['Row'];
export type DbBankQuestionInsert = Database['public']['Tables']['bank_questions']['Insert'];

// 하위 호환성을 위한 별칭 (deprecated)
/** @deprecated Use UserProfile instead */
export type Profile = UserProfile;
/** @deprecated Use UserProfileInsert instead */
export type ProfileInsert = UserProfileInsert;
/** @deprecated Use UserProfileUpdate instead */
export type ProfileUpdate = UserProfileUpdate;

/** @deprecated Use DbSavedQuiz instead */
export type DbQuiz = DbSavedQuiz;
/** @deprecated Use DbSavedQuizInsert instead */
export type DbQuizInsert = DbSavedQuizInsert;
/** @deprecated Use DbSavedQuizUpdate instead */
export type DbQuizUpdate = DbSavedQuizUpdate;

/** @deprecated Use DbSavedQuestion instead */
export type DbQuestion = DbSavedQuestion;
/** @deprecated Use DbSavedQuestionInsert instead */
export type DbQuestionInsert = DbSavedQuestionInsert;

/** @deprecated Use PlaySession instead */
export type QuizSession = PlaySession;
/** @deprecated Use PlaySessionInsert instead */
export type QuizSessionInsert = PlaySessionInsert;
/** @deprecated Use PlaySessionUpdate instead */
export type QuizSessionUpdate = PlaySessionUpdate;

/** @deprecated Use PlayAnswer instead */
export type SessionAnswer = PlayAnswer;
/** @deprecated Use PlayAnswerInsert instead */
export type SessionAnswerInsert = PlayAnswerInsert;

/** @deprecated Use DbQuestionBank instead */
export type DbQuizPool = DbQuestionBank;
/** @deprecated Use DbQuestionBankInsert instead */
export type DbQuizPoolInsert = DbQuestionBankInsert;
/** @deprecated Use DbQuestionBankUpdate instead */
export type DbQuizPoolUpdate = DbQuestionBankUpdate;

/** @deprecated Use DbBankQuestion instead */
export type DbPoolQuestion = DbBankQuestion;
/** @deprecated Use DbBankQuestionInsert instead */
export type DbPoolQuestionInsert = DbBankQuestionInsert;
