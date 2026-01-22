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
      profiles: {
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
      quizzes: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          source_text: string | null;
          difficulty: 'easy' | 'medium' | 'hard' | null;
          question_count: number;
          is_public: boolean;
          share_code: string | null;
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
          created_at?: string;
          updated_at?: string;
        };
      };
      questions: {
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
      quiz_sessions: {
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
      session_answers: {
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
      quiz_cache: {
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
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// 편의를 위한 타입 별칭
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type DbQuiz = Database['public']['Tables']['quizzes']['Row'];
export type DbQuizInsert = Database['public']['Tables']['quizzes']['Insert'];
export type DbQuizUpdate = Database['public']['Tables']['quizzes']['Update'];

export type DbQuestion = Database['public']['Tables']['questions']['Row'];
export type DbQuestionInsert = Database['public']['Tables']['questions']['Insert'];

export type QuizSession = Database['public']['Tables']['quiz_sessions']['Row'];
export type QuizSessionInsert = Database['public']['Tables']['quiz_sessions']['Insert'];
export type QuizSessionUpdate = Database['public']['Tables']['quiz_sessions']['Update'];

export type SessionAnswer = Database['public']['Tables']['session_answers']['Row'];
export type SessionAnswerInsert = Database['public']['Tables']['session_answers']['Insert'];
