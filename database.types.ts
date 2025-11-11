export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      batch_participants: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          level_1_cluster: string | null
          level_1_comments: string | null
          level_2_cluster: string | null
          level_2_comments: string | null
          level_3_cluster: string | null
          level_3_comments: string | null
          level_4_cluster: string | null
          level_4_comments: string | null
          level_5_cluster: string | null
          level_5_comments: string | null
          overall_cluster: string | null
          overall_comments: string | null
          participant_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          level_1_cluster?: string | null
          level_1_comments?: string | null
          level_2_cluster?: string | null
          level_2_comments?: string | null
          level_3_cluster?: string | null
          level_3_comments?: string | null
          level_4_cluster?: string | null
          level_4_comments?: string | null
          level_5_cluster?: string | null
          level_5_comments?: string | null
          overall_cluster?: string | null
          overall_comments?: string | null
          participant_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          level_1_cluster?: string | null
          level_1_comments?: string | null
          level_2_cluster?: string | null
          level_2_comments?: string | null
          level_3_cluster?: string | null
          level_3_comments?: string | null
          level_4_cluster?: string | null
          level_4_comments?: string | null
          level_5_cluster?: string | null
          level_5_comments?: string | null
          overall_cluster?: string | null
          overall_comments?: string | null
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_participants_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "training_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      overall_challenges: {
        Row: {
          batch_id: string
          created_at: string
          ended_at: string | null
          id: string
          manager_ids: string[]
          name: string
          trainee_ids: string[]
        }
        Insert: {
          batch_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          manager_ids: string[]
          name: string
          trainee_ids: string[]
        }
        Update: {
          batch_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          manager_ids?: string[]
          name?: string
          trainee_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "overall_challenges_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "training_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_auth_id_fkey"
            columns: ["auth_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_option_id: string
          created_at: string
          id: string
          options: Json
          question_text: string
          quiz_id: string
        }
        Insert: {
          correct_option_id: string
          created_at?: string
          id?: string
          options: Json
          question_text: string
          quiz_id: string
        }
        Update: {
          correct_option_id?: string
          created_at?: string
          id?: string
          options?: Json
          question_text?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_submissions: {
        Row: {
          answers: Json
          completed_at: string
          created_at: string
          id: string
          participant_id: string
          quiz_id: string
          score: number
        }
        Insert: {
          answers: Json
          completed_at?: string
          created_at?: string
          id?: string
          participant_id: string
          quiz_id: string
          score: number
        }
        Update: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          participant_id?: string
          quiz_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_submissions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string
          id: string
          status: Database["public"]["Enums"]["quiz_status"]
          title: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by: string
          id?: string
          status?: Database["public"]["Enums"]["quiz_status"]
          title: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: Database["public"]["Enums"]["quiz_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "training_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_challenges: {
        Row: {
          claim_focus: string | null
          created_at: string
          evaluation_rules: Json
          evaluator_ids: string[] | null
          id: string
          overall_challenge_id: string
          patent_number: string | null
          report_end_time: string | null
          scores_published_at: string | null
          submission_end_time: string
          submission_limit: number | null
          summary: string | null
          title: string
        }
        Insert: {
          claim_focus?: string | null
          created_at?: string
          evaluation_rules: Json
          evaluator_ids?: string[] | null
          id?: string
          overall_challenge_id: string
          patent_number?: string | null
          report_end_time?: string | null
          scores_published_at?: string | null
          submission_end_time: string
          submission_limit?: number | null
          summary?: string | null
          title: string
        }
        Update: {
          claim_focus?: string | null
          created_at?: string
          evaluation_rules?: Json
          evaluator_ids?: string[] | null
          id?: string
          overall_challenge_id?: string
          patent_number?: string | null
          report_end_time?: string | null
          scores_published_at?: string | null
          submission_end_time?: string
          submission_limit?: number | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_challenges_overall_challenge_id_fkey"
            columns: ["overall_challenge_id"]
            isOneToOne: false
            referencedRelation: "overall_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          evaluation: Json | null
          id: string
          report_file: Json | null
          results: Json | null
          sub_challenge_id: string
          submitted_at: string
          trainee_id: string
        }
        Insert: {
          created_at?: string
          evaluation?: Json | null
          id?: string
          report_file?: Json | null
          results?: Json | null
          sub_challenge_id: string
          submitted_at?: string
          trainee_id: string
        }
        Update: {
          created_at?: string
          evaluation?: Json | null
          id?: string
          report_file?: Json | null
          results?: Json | null
          sub_challenge_id?: string
          submitted_at?: string
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_sub_challenge_id_fkey"
            columns: ["sub_challenge_id"]
            isOneToOne: false
            referencedRelation: "sub_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_batches: {
        Row: {
          created_at: string
          evaluator_ids: string[] | null
          id: string
          manager_ids: string[]
          name: string
        }
        Insert: {
          created_at?: string
          evaluator_ids?: string[] | null
          id?: string
          manager_ids: string[]
          name: string
        }
        Update: {
          created_at?: string
          evaluator_ids?: string[] | null
          id?: string
          manager_ids?: string[]
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_evaluator_batches: {
        Args: Record<string, never>
        Returns: {
          created_at: string
          evaluator_ids: string[] | null
          id: string
          manager_ids: string[]
          name: string
        }[]
      }
      get_my_participant_batches: {
        Args: Record<string, never>
        Returns: {
          created_at: string
          evaluator_ids: string[] | null
          id: string
          manager_ids: string[]
          name: string
        }[]
      }
      get_public_leaderboard: {
        Args: {
          p_challenge_id: string
        }
        Returns: Json
      }
      get_public_sub_challenge_leaderboard: {
        Args: {
          p_sub_challenge_id: string
        }
        Returns: Json
      }
      link_auth_to_profile: {
        Args: Record<string, never>
        Returns: {
          auth_id: string | null
          avatar_url: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
    }
    Enums: {
      incorrect_marking_type: "zero" | "penalty"
      quiz_status: "draft" | "live" | "ended"
      result_tier: "Tier-1" | "Tier-2" | "Tier-3"
      result_type: "Patent" | "Non-Patent Literature"
      user_role: "Manager" | "Trainee" | "Evaluator" | "Mentor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  Alias extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]) & string,
> = (PublicSchema["Tables"] & PublicSchema["Views"])[Alias] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  Alias extends keyof PublicSchema["Tables"] & string,
> = PublicSchema["Tables"][Alias] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  Alias extends keyof PublicSchema["Tables"] & string,
> = PublicSchema["Tables"][Alias] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  Alias extends keyof PublicSchema["Enums"] & string,
> = PublicSchema["Enums"][Alias]
