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
      overall_challenges: {
        Row: {
          created_at: string
          evaluator_ids: string[]
          id: string
          manager_ids: string[]
          name: string
          trainee_ids: string[]
        }
        Insert: {
          created_at?: string
          evaluator_ids: string[]
          id?: string
          manager_ids: string[]
          name: string
          trainee_ids: string[]
        }
        Update: {
          created_at?: string
          evaluator_ids?: string[]
          id?: string
          manager_ids?: string[]
          name?: string
          trainee_ids?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_challenges: {
        Row: {
          claim_focus: string | null
          created_at: string
          evaluation_rules: Json
          id: string
          overall_challenge_id: string
          patent_number: string | null
          submission_end_time: string
          summary: string | null
          title: string
        }
        Insert: {
          claim_focus?: string | null
          created_at?: string
          evaluation_rules: Json
          id?: string
          overall_challenge_id: string
          patent_number?: string | null
          submission_end_time: string
          summary?: string | null
          title: string
        }
        Update: {
          claim_focus?: string | null
          created_at?: string
          evaluation_rules?: Json
          id?: string
          overall_challenge_id?: string
          patent_number?: string | null
          submission_end_time?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      incorrect_marking_type: "zero" | "penalty"
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
  Alias extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]) & string
> = (PublicSchema["Tables"] & PublicSchema["Views"])[Alias] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  Alias extends keyof PublicSchema["Tables"] & string
> = PublicSchema["Tables"][Alias] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  Alias extends keyof PublicSchema["Tables"] & string
> = PublicSchema["Tables"][Alias] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  Alias extends keyof PublicSchema["Enums"] & string
> = PublicSchema["Enums"][Alias]
