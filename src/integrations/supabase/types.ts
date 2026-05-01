export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      academic_calendar: {
        Row: {
          batch_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          is_global: boolean
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          is_global?: boolean
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          is_global?: boolean
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_calendar_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_calendar_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_api_keys: {
        Row: {
          api_key: string
          created_at: string
          error_count: number
          id: string
          is_active: boolean
          label: string
          last_error: string | null
          last_used_at: string | null
          provider: string
          usage_count: number
        }
        Insert: {
          api_key: string
          created_at?: string
          error_count?: number
          id?: string
          is_active?: boolean
          label?: string
          last_error?: string | null
          last_used_at?: string | null
          provider?: string
          usage_count?: number
        }
        Update: {
          api_key?: string
          created_at?: string
          error_count?: number
          id?: string
          is_active?: boolean
          label?: string
          last_error?: string | null
          last_used_at?: string | null
          provider?: string
          usage_count?: number
        }
        Relationships: []
      }
      ai_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          model_used: string | null
          provider_used: string | null
          response_time_ms: number | null
          role: string
          session_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          model_used?: string | null
          provider_used?: string | null
          response_time_ms?: number | null
          role?: string
          session_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          model_used?: string | null
          provider_used?: string | null
          response_time_ms?: number | null
          role?: string
          session_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chatbot_config: {
        Row: {
          api_key: string | null
          created_at: string
          db_context_enabled: boolean
          id: string
          is_active: boolean
          knowledge_base: Json
          max_tokens: number
          model_name: string
          provider: string
          system_prompt: string
          temperature: number
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          db_context_enabled?: boolean
          id?: string
          is_active?: boolean
          knowledge_base?: Json
          max_tokens?: number
          model_name?: string
          provider?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          db_context_enabled?: boolean
          id?: string
          is_active?: boolean
          knowledge_base?: Json
          max_tokens?: number
          model_name?: string
          provider?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_search_index: {
        Row: {
          content_summary: string
          entity_id: string
          entity_type: string
          id: string
          keywords: string[] | null
          metadata: Json | null
          search_vector: unknown
          title: string
          updated_at: string
        }
        Insert: {
          content_summary?: string
          entity_id: string
          entity_type: string
          id?: string
          keywords?: string[] | null
          metadata?: Json | null
          search_vector?: unknown
          title?: string
          updated_at?: string
        }
        Update: {
          content_summary?: string
          entity_id?: string
          entity_type?: string
          id?: string
          keywords?: string[] | null
          metadata?: Json | null
          search_vector?: unknown
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          feedback: string | null
          file_url: string | null
          graded_at: string | null
          id: string
          score: number | null
          status: string | null
          submission_text: string | null
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          assignment_id: string
          feedback?: string | null
          file_url?: string | null
          graded_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
          submission_text?: string | null
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          assignment_id?: string
          feedback?: string | null
          file_url?: string | null
          graded_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
          submission_text?: string | null
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          course_id: string | null
          created_at: string | null
          description: string | null
          due_days: number | null
          id: string
          instructions: string | null
          is_published: boolean | null
          max_score: number | null
          section_id: string | null
          sort_order: number | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          due_days?: number | null
          id?: string
          instructions?: string | null
          is_published?: boolean | null
          max_score?: number | null
          section_id?: string | null
          sort_order?: number | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          due_days?: number | null
          id?: string
          instructions?: string | null
          is_published?: boolean | null
          max_score?: number | null
          section_id?: string | null
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          id: string
          live_class_id: string
          marked_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          id?: string
          live_class_id: string
          marked_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          id?: string
          live_class_id?: string
          marked_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_live_class_id_fkey"
            columns: ["live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_courses: {
        Row: {
          batch_id: string
          course_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          batch_id: string
          course_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          batch_id?: string
          course_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_courses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_students: {
        Row: {
          batch_id: string
          enrolled_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          batch_id: string
          enrolled_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          enrolled_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          max_students: number | null
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          max_students?: number | null
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          max_students?: number | null
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon_url: string | null
          id: number
          name: string
          parent_id: number | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          icon_url?: string | null
          id?: number
          name: string
          parent_id?: number | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          icon_url?: string | null
          id?: number
          name?: string
          parent_id?: number | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          background_url: string | null
          created_at: string | null
          created_by: string | null
          custom_texts: Json | null
          download_rule: string
          fields_config: Json
          id: string
          min_score_pct: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          background_url?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_texts?: Json | null
          download_rule?: string
          fields_config?: Json
          id?: string
          min_score_pct?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          background_url?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_texts?: Json | null
          download_rule?: string
          fields_config?: Json
          id?: string
          min_score_pct?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          download_count: number | null
          downloaded_at: string | null
          id: string
          issued_at: string | null
          score_percentage: number | null
          template_snapshot: Json | null
          user_id: string
        }
        Insert: {
          certificate_number: string
          course_id: string
          download_count?: number | null
          downloaded_at?: string | null
          id?: string
          issued_at?: string | null
          score_percentage?: number | null
          template_snapshot?: Json | null
          user_id: string
        }
        Update: {
          certificate_number?: string
          course_id?: string
          download_count?: number | null
          downloaded_at?: string | null
          id?: string
          issued_at?: string | null
          score_percentage?: number | null
          template_snapshot?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_read: boolean | null
          message: string
          reactions: Json | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          reactions?: Json | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          reactions?: Json | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      chat_requests: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cloudflare_r2_accounts: {
        Row: {
          access_key_id: string
          bucket_name: string
          created_at: string | null
          endpoint_url: string
          id: string
          last_used_at: string | null
          nickname: string
          public_domain_url: string
          secret_access_key: string
          status: string
          updated_at: string | null
          upload_count: number | null
        }
        Insert: {
          access_key_id: string
          bucket_name: string
          created_at?: string | null
          endpoint_url: string
          id?: string
          last_used_at?: string | null
          nickname: string
          public_domain_url: string
          secret_access_key: string
          status?: string
          updated_at?: string | null
          upload_count?: number | null
        }
        Update: {
          access_key_id?: string
          bucket_name?: string
          created_at?: string | null
          endpoint_url?: string
          id?: string
          last_used_at?: string | null
          nickname?: string
          public_domain_url?: string
          secret_access_key?: string
          status?: string
          updated_at?: string | null
          upload_count?: number | null
        }
        Relationships: []
      }
      cloudinary_accounts: {
        Row: {
          api_key: string
          api_secret: string
          cloud_name: string
          created_at: string | null
          file_category: string
          id: string
          is_primary: boolean | null
          nickname: string
          status: string | null
          updated_at: string | null
          upload_preset: string
          usage_pct: number | null
        }
        Insert: {
          api_key?: string
          api_secret?: string
          cloud_name: string
          created_at?: string | null
          file_category?: string
          id?: string
          is_primary?: boolean | null
          nickname: string
          status?: string | null
          updated_at?: string | null
          upload_preset?: string
          usage_pct?: number | null
        }
        Update: {
          api_key?: string
          api_secret?: string
          cloud_name?: string
          created_at?: string | null
          file_category?: string
          id?: string
          is_primary?: boolean | null
          nickname?: string
          status?: string | null
          updated_at?: string | null
          upload_preset?: string
          usage_pct?: number | null
        }
        Relationships: []
      }
      content_contributors: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          role: string
          sort_order: number
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_contributors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contributor_votes: {
        Row: {
          contributor_id: string
          created_at: string
          id: string
          vote_type: string
          voter_id: string
        }
        Insert: {
          contributor_id: string
          created_at?: string
          id?: string
          vote_type?: string
          voter_id: string
        }
        Update: {
          contributor_id?: string
          created_at?: string
          id?: string
          vote_type?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributor_votes_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          coupon_id: string | null
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          coupon_id?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          coupon_id?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_ids: string[] | null
          applicable_to: string | null
          applicable_type: string
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          min_order_amount: number | null
          per_user_limit: number | null
          usage_limit: number | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_ids?: string[] | null
          applicable_to?: string | null
          applicable_type?: string
          code: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          per_user_limit?: number | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_ids?: string[] | null
          applicable_to?: string | null
          applicable_type?: string
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          per_user_limit?: number | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      course_announcements: {
        Row: {
          content: string | null
          course_id: string
          created_at: string | null
          id: string
          instructor_id: string
          is_pinned: boolean | null
          title: string
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          instructor_id: string
          is_pinned?: boolean | null
          title: string
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          instructor_id?: string
          is_pinned?: boolean | null
          title?: string
        }
        Relationships: []
      }
      course_sections: {
        Row: {
          course_id: string
          description: string | null
          id: string
          materials: Json | null
          sort_order: number | null
          title: string
        }
        Insert: {
          course_id: string
          description?: string | null
          id?: string
          materials?: Json | null
          sort_order?: number | null
          title: string
        }
        Update: {
          course_id?: string
          description?: string | null
          id?: string
          materials?: Json | null
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          avg_rating: number | null
          category_id: number | null
          cert_template_id: string | null
          certificate_template_id: number | null
          certificate_threshold_pct: number | null
          content_drip_enabled: boolean | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          discount_ends_at: string | null
          discount_price: number | null
          enrollment_count: number | null
          id: string
          instructor_id: string | null
          intro_video_url: string | null
          is_public: boolean | null
          is_published: boolean | null
          language: string | null
          max_students: number | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          prerequisite_course_ids: string[] | null
          price: number | null
          rejection_reason: string | null
          revenue_share_pct: number | null
          review_count: number | null
          review_status: string | null
          short_description: string | null
          slug: string
          thumbnail_url: string | null
          title: string
          total_duration_minutes: number | null
          total_lessons: number | null
          updated_at: string | null
        }
        Insert: {
          avg_rating?: number | null
          category_id?: number | null
          cert_template_id?: string | null
          certificate_template_id?: number | null
          certificate_threshold_pct?: number | null
          content_drip_enabled?: boolean | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          discount_ends_at?: string | null
          discount_price?: number | null
          enrollment_count?: number | null
          id?: string
          instructor_id?: string | null
          intro_video_url?: string | null
          is_public?: boolean | null
          is_published?: boolean | null
          language?: string | null
          max_students?: number | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          prerequisite_course_ids?: string[] | null
          price?: number | null
          rejection_reason?: string | null
          revenue_share_pct?: number | null
          review_count?: number | null
          review_status?: string | null
          short_description?: string | null
          slug: string
          thumbnail_url?: string | null
          title: string
          total_duration_minutes?: number | null
          total_lessons?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_rating?: number | null
          category_id?: number | null
          cert_template_id?: string | null
          certificate_template_id?: number | null
          certificate_threshold_pct?: number | null
          content_drip_enabled?: boolean | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          discount_ends_at?: string | null
          discount_price?: number | null
          enrollment_count?: number | null
          id?: string
          instructor_id?: string | null
          intro_video_url?: string | null
          is_public?: boolean | null
          is_published?: boolean | null
          language?: string | null
          max_students?: number | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          prerequisite_course_ids?: string[] | null
          price?: number | null
          rejection_reason?: string | null
          revenue_share_pct?: number | null
          review_count?: number | null
          review_status?: string | null
          short_description?: string | null
          slug?: string
          thumbnail_url?: string | null
          title?: string
          total_duration_minutes?: number | null
          total_lessons?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_cert_template_id_fkey"
            columns: ["cert_template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          exchange_rate: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          exchange_rate?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          symbol?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          exchange_rate?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      discussion_upvotes: {
        Row: {
          created_at: string
          discussion_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discussion_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discussion_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_upvotes_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_upvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          content: string
          course_id: string
          created_at: string | null
          id: string
          is_answered: boolean | null
          is_closed: boolean
          is_pinned: boolean
          lesson_id: string | null
          parent_id: string | null
          upvote_count: number
          user_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          is_closed?: boolean
          is_pinned?: boolean
          lesson_id?: string | null
          parent_id?: string | null
          upvote_count?: number
          user_id: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          is_closed?: boolean
          is_pinned?: boolean
          lesson_id?: string | null
          parent_id?: string | null
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_access_tokens: {
        Row: {
          created_at: string | null
          ebook_id: string
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ebook_id: string
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          ebook_id?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebook_access_tokens_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_reading_progress: {
        Row: {
          brightness: number | null
          current_page: number | null
          ebook_id: string
          font_size: number | null
          highlights: Json | null
          id: string
          notes: Json | null
          progress_pct: number | null
          reading_mode: string | null
          total_pages: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brightness?: number | null
          current_page?: number | null
          ebook_id: string
          font_size?: number | null
          highlights?: Json | null
          id?: string
          notes?: Json | null
          progress_pct?: number | null
          reading_mode?: string | null
          total_pages?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brightness?: number | null
          current_page?: number | null
          ebook_id?: string
          font_size?: number | null
          highlights?: Json | null
          id?: string
          notes?: Json | null
          progress_pct?: number | null
          reading_mode?: string | null
          total_pages?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebook_reading_progress_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      ebooks: {
        Row: {
          age_restriction: string | null
          author: string | null
          category_id: number | null
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_price: number | null
          download_count: number | null
          file_format: string | null
          file_url: string | null
          gallery_urls: string[] | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          og_image_url: string | null
          page_count: number | null
          price: number | null
          seo_keywords: string | null
          slug: string
          sub_writers: string[] | null
          tags: string[] | null
          title: string
          total_revenue: number | null
        }
        Insert: {
          age_restriction?: string | null
          author?: string | null
          category_id?: number | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_price?: number | null
          download_count?: number | null
          file_format?: string | null
          file_url?: string | null
          gallery_urls?: string[] | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_count?: number | null
          price?: number | null
          seo_keywords?: string | null
          slug: string
          sub_writers?: string[] | null
          tags?: string[] | null
          title: string
          total_revenue?: number | null
        }
        Update: {
          age_restriction?: string | null
          author?: string | null
          category_id?: number | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_price?: number | null
          download_count?: number | null
          file_format?: string | null
          file_url?: string | null
          gallery_urls?: string[] | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_count?: number | null
          price?: number | null
          seo_keywords?: string | null
          slug?: string
          sub_writers?: string[] | null
          tags?: string[] | null
          title?: string
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ebooks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edumail_contacts: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edumail_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edumail_messages: {
        Row: {
          attachments: Json | null
          bcc_emails: string[] | null
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          created_at: string
          folder: string
          from_email: string
          has_attachments: boolean
          id: string
          in_reply_to: string | null
          is_read: boolean
          is_starred: boolean
          owner_id: string
          recalled_at: string | null
          sent_at: string | null
          signature_used: string | null
          subject: string
          thread_id: string | null
          to_emails: string[]
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string
          folder?: string
          from_email?: string
          has_attachments?: boolean
          id?: string
          in_reply_to?: string | null
          is_read?: boolean
          is_starred?: boolean
          owner_id: string
          recalled_at?: string | null
          sent_at?: string | null
          signature_used?: string | null
          subject?: string
          thread_id?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          bcc_emails?: string[] | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string
          folder?: string
          from_email?: string
          has_attachments?: boolean
          id?: string
          in_reply_to?: string | null
          is_read?: boolean
          is_starred?: boolean
          owner_id?: string
          recalled_at?: string | null
          sent_at?: string | null
          signature_used?: string | null
          subject?: string
          thread_id?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edumail_messages_in_reply_to_fkey"
            columns: ["in_reply_to"]
            isOneToOne: false
            referencedRelation: "edumail_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edumail_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edumail_signatures: {
        Row: {
          body_html: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edumail_signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient: string
          status: string
          subject: string | null
          template_key: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          status?: string
          subject?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string | null
          id: string
          payment_id: string | null
          progress_pct: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string | null
          id?: string
          payment_id?: string | null
          progress_pct?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string | null
          id?: string
          payment_id?: string | null
          progress_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          link: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          link?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          link?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      faculty_members: {
        Row: {
          bio: string | null
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          photo_url: string | null
          sort_order: number | null
          specialization: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          sort_order?: number | null
          specialization?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          sort_order?: number | null
          specialization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      forum_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_contributor_points: {
        Row: {
          action: string
          created_at: string | null
          id: string
          points: number
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          category_id: string | null
          content: string
          created_at: string | null
          id: string
          is_closed: boolean | null
          is_pinned: boolean | null
          search_vector: unknown
          title: string
          updated_at: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          category_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_closed?: boolean | null
          is_pinned?: boolean | null
          search_vector?: unknown
          title: string
          updated_at?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_closed?: boolean | null
          is_pinned?: boolean | null
          search_vector?: unknown
          title?: string
          updated_at?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reactions: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_rewards: {
        Row: {
          created_at: string | null
          granted_by: string
          id: string
          points: number
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by: string
          id?: string
          points?: number
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string
          id?: string
          points?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grade_configs: {
        Row: {
          created_at: string
          grade_point: number
          id: string
          is_active: boolean
          letter_grade: string
          max_pct: number
          min_pct: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          grade_point: number
          id?: string
          is_active?: boolean
          letter_grade: string
          max_pct: number
          min_pct: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          grade_point?: number
          id?: string
          is_active?: boolean
          letter_grade?: string
          max_pct?: number
          min_pct?: number
          sort_order?: number
        }
        Relationships: []
      }
      gradebook_manual_marks: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          label: string
          max_score: number
          notes: string | null
          score: number
          updated_by: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          label?: string
          max_score?: number
          notes?: string | null
          score?: number
          updated_by?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          label?: string
          max_score?: number
          notes?: string | null
          score?: number
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gradebook_manual_marks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          countdown_target: string | null
          created_at: string | null
          cta_link: string | null
          cta_text: string | null
          gradient_direction: string | null
          gradient_from: string | null
          gradient_to: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          overlay_opacity: number | null
          secondary_cta_link: string | null
          secondary_cta_text: string | null
          sort_order: number | null
          subtitle: string | null
          subtitle_color: string | null
          text_alignment: string | null
          title: string
          title_color: string | null
        }
        Insert: {
          countdown_target?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          gradient_direction?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          overlay_opacity?: number | null
          secondary_cta_link?: string | null
          secondary_cta_text?: string | null
          sort_order?: number | null
          subtitle?: string | null
          subtitle_color?: string | null
          text_alignment?: string | null
          title: string
          title_color?: string | null
        }
        Update: {
          countdown_target?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          gradient_direction?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          overlay_opacity?: number | null
          secondary_cta_link?: string | null
          secondary_cta_text?: string | null
          sort_order?: number | null
          subtitle?: string | null
          subtitle_color?: string | null
          text_alignment?: string | null
          title?: string
          title_color?: string | null
        }
        Relationships: []
      }
      id_card_settings: {
        Row: {
          authority_name: string | null
          authority_position: string | null
          card_bg_color: string | null
          id: string
          location: string
          logo_url: string | null
          signature_url: string | null
          university_name: string
          updated_at: string | null
        }
        Insert: {
          authority_name?: string | null
          authority_position?: string | null
          card_bg_color?: string | null
          id?: string
          location?: string
          logo_url?: string | null
          signature_url?: string | null
          university_name?: string
          updated_at?: string | null
        }
        Update: {
          authority_name?: string | null
          authority_position?: string | null
          card_bg_color?: string | null
          id?: string
          location?: string
          logo_url?: string | null
          signature_url?: string | null
          university_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      installment_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          paid_at: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          paid_at?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          paid_at?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_email_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          blocked_at: string | null
          created_at: string
          current_password: string | null
          disk_usage_bytes: number | null
          email_quota_mb: number
          generated_password: string | null
          id: string
          is_blocked: boolean
          last_password_reset_at: string | null
          last_synced_uid: number | null
          requested_email: string
          status: string
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          blocked_at?: string | null
          created_at?: string
          current_password?: string | null
          disk_usage_bytes?: number | null
          email_quota_mb?: number
          generated_password?: string | null
          id?: string
          is_blocked?: boolean
          last_password_reset_at?: string | null
          last_synced_uid?: number | null
          requested_email: string
          status?: string
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          blocked_at?: string | null
          created_at?: string
          current_password?: string | null
          disk_usage_bytes?: number | null
          email_quota_mb?: number
          generated_password?: string | null
          id?: string
          is_blocked?: boolean
          last_password_reset_at?: string | null
          last_synced_uid?: number | null
          requested_email?: string
          status?: string
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      instructor_applications: {
        Row: {
          admin_notes: string | null
          bio: string | null
          created_at: string | null
          email: string
          experience_years: number | null
          expertise: string
          full_name: string
          id: string
          linkedin_url: string | null
          motivation: string | null
          phone: string | null
          qualification: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_video_url: string | null
          status: string
          university: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          experience_years?: number | null
          expertise: string
          full_name: string
          id?: string
          linkedin_url?: string | null
          motivation?: string | null
          phone?: string | null
          qualification?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_video_url?: string | null
          status?: string
          university?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          experience_years?: number | null
          expertise?: string
          full_name?: string
          id?: string
          linkedin_url?: string | null
          motivation?: string | null
          phone?: string | null
          qualification?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_video_url?: string | null
          status?: string
          university?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_applications: {
        Row: {
          admin_notes: string | null
          availability_date: string | null
          cover_letter: string | null
          created_at: string
          id: string
          internship_id: string
          interview_date: string | null
          interview_notes: string | null
          portfolio_url: string | null
          rating: number | null
          resume_url: string | null
          reviewed_by: string | null
          skills: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          availability_date?: string | null
          cover_letter?: string | null
          created_at?: string
          id?: string
          internship_id: string
          interview_date?: string | null
          interview_notes?: string | null
          portfolio_url?: string | null
          rating?: number | null
          resume_url?: string | null
          reviewed_by?: string | null
          skills?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          availability_date?: string | null
          cover_letter?: string | null
          created_at?: string
          id?: string
          internship_id?: string
          interview_date?: string | null
          interview_notes?: string | null
          portfolio_url?: string | null
          rating?: number | null
          resume_url?: string | null
          reviewed_by?: string | null
          skills?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_applications_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_logs: {
        Row: {
          activities: string
          application_id: string
          created_at: string
          hours_worked: number
          id: string
          learnings: string | null
          log_date: string
          supervisor_feedback: string | null
          user_id: string
        }
        Insert: {
          activities?: string
          application_id: string
          created_at?: string
          hours_worked?: number
          id?: string
          learnings?: string | null
          log_date: string
          supervisor_feedback?: string | null
          user_id: string
        }
        Update: {
          activities?: string
          application_id?: string
          created_at?: string
          hours_worked?: number
          id?: string
          learnings?: string | null
          log_date?: string
          supervisor_feedback?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "internship_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_tasks: {
        Row: {
          application_id: string
          assigned_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          feedback: string | null
          id: string
          internship_id: string
          status: string
          submission_url: string | null
          submitted_at: string | null
          title: string
        }
        Insert: {
          application_id: string
          assigned_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          feedback?: string | null
          id?: string
          internship_id: string
          status?: string
          submission_url?: string | null
          submitted_at?: string | null
          title: string
        }
        Update: {
          application_id?: string
          assigned_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          feedback?: string | null
          id?: string
          internship_id?: string
          status?: string
          submission_url?: string | null
          submitted_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "internship_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_tasks_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
        ]
      }
      internships: {
        Row: {
          application_deadline: string | null
          company: string
          contact_email: string | null
          created_at: string
          department: string | null
          description: string | null
          duration: string | null
          id: string
          internship_type: string
          is_featured: boolean
          is_published: boolean
          location: string | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          positions_available: number
          positions_filled: number
          posted_by: string | null
          requirements: string | null
          seo_keywords: string | null
          skills_required: string[] | null
          status: string
          stipend: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          application_deadline?: string | null
          company: string
          contact_email?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          internship_type?: string
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          positions_available?: number
          positions_filled?: number
          posted_by?: string | null
          requirements?: string | null
          seo_keywords?: string | null
          skills_required?: string[] | null
          status?: string
          stipend?: string | null
          supervisor_id?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          application_deadline?: string | null
          company?: string
          contact_email?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          internship_type?: string
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          positions_available?: number
          positions_filled?: number
          posted_by?: string | null
          requirements?: string | null
          seo_keywords?: string | null
          skills_required?: string[] | null
          status?: string
          stipend?: string | null
          supervisor_id?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "internships_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internships_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_district: string | null
          billing_email: string | null
          billing_name: string | null
          billing_phone: string | null
          coupon_code: string | null
          created_at: string | null
          discount_amount: number | null
          id: string
          invoice_number: string
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          billing_district?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          coupon_code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          subtotal?: number
          total?: number
          user_id: string
        }
        Update: {
          billing_district?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          coupon_code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_courses: {
        Row: {
          course_id: string
          id: string
          learning_path_id: string
          sort_order: number | null
        }
        Insert: {
          course_id: string
          id?: string
          learning_path_id: string
          sort_order?: number | null
        }
        Update: {
          course_id?: string
          id?: string
          learning_path_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_courses_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          course_ids: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          price: number | null
          seo_keywords: string | null
          slug: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          course_ids?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          price?: number | null
          seo_keywords?: string | null
          slug: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          course_ids?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          price?: number | null
          seo_keywords?: string | null
          slug?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lesson_materials: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string
          material_id: string
          material_type: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id: string
          material_id: string
          material_type: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string
          material_id?: string
          material_type?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          last_position_seconds: number | null
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_position_seconds?: number | null
          lesson_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_position_seconds?: number | null
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          instructor_notes: string | null
          is_preview: boolean | null
          lesson_type: string | null
          live_class_platform: string | null
          live_class_url: string | null
          resource_url: string | null
          resources: Json | null
          scheduled_unlock_at: string | null
          section_id: string | null
          sort_order: number | null
          status: string | null
          title: string
          video_platform: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructor_notes?: string | null
          is_preview?: boolean | null
          lesson_type?: string | null
          live_class_platform?: string | null
          live_class_url?: string | null
          resource_url?: string | null
          resources?: Json | null
          scheduled_unlock_at?: string | null
          section_id?: string | null
          sort_order?: number | null
          status?: string | null
          title: string
          video_platform?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructor_notes?: string | null
          is_preview?: boolean | null
          lesson_type?: string | null
          live_class_platform?: string | null
          live_class_url?: string | null
          resource_url?: string | null
          resources?: Json | null
          scheduled_unlock_at?: string | null
          section_id?: string | null
          sort_order?: number | null
          status?: string | null
          title?: string
          video_platform?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          batch_id: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          meeting_url: string | null
          platform: string
          recording_url: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          platform?: string
          recording_url?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          platform?: string
          recording_url?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          alt_text: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      media_references: {
        Row: {
          cloudinary_account_id: string | null
          created_at: string | null
          fallback_url: string | null
          id: string
          owner_id: string | null
          owner_type: string
          public_id: string | null
          storage_source: string
          url: string
        }
        Insert: {
          cloudinary_account_id?: string | null
          created_at?: string | null
          fallback_url?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string
          public_id?: string | null
          storage_source?: string
          url: string
        }
        Update: {
          cloudinary_account_id?: string | null
          created_at?: string | null
          fallback_url?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string
          public_id?: string | null
          storage_source?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_references_cloudinary_account_id_fkey"
            columns: ["cloudinary_account_id"]
            isOneToOne: false
            referencedRelation: "cloudinary_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string | null
          id: string
          items: Json | null
          location: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          items?: Json | null
          location?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json | null
          location?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          item_id: string
          item_type: string
          order_id: string
          price: number
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          order_id: string
          price?: number
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          order_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string | null
          discount_amount: number | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          status: string | null
          total: number
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          total?: number
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          author_id: string | null
          content: Json | null
          created_at: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          slug: string
          sort_order: number | null
          status: string
          template: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content?: Json | null
          created_at?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          slug: string
          sort_order?: number | null
          status?: string
          template?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: Json | null
          created_at?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          slug?: string
          sort_order?: number | null
          status?: string
          template?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          created_at: string | null
          credentials: Json
          display_name: string
          gateway_name: string
          id: string
          is_active: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credentials?: Json
          display_name: string
          gateway_name: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          display_name?: string
          gateway_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_plans: {
        Row: {
          course_id: string
          created_at: string
          id: string
          installment_count: number
          interval_days: number
          is_active: boolean
          total_amount: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          installment_count?: number
          interval_days?: number
          is_active?: boolean
          total_amount?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          installment_count?: number
          interval_days?: number
          is_active?: boolean
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_review_config: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          is_enabled: boolean
          min_reviewers: number
          rubric_criteria: Json | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          min_reviewers?: number
          rubric_criteria?: Json | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          min_reviewers?: number
          rubric_criteria?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_review_config_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_reviews: {
        Row: {
          course_id: string
          created_at: string
          feedback: string | null
          id: string
          rating: number | null
          reviewer_id: string
          rubric_scores: Json | null
          submission_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number | null
          reviewer_id: string
          rubric_scores?: Json | null
          submission_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number | null
          reviewer_id?: string
          rubric_scores?: Json | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      plagiarism_reports: {
        Row: {
          checked_at: string | null
          created_at: string
          id: string
          matched_sources: Json | null
          similarity_pct: number
          status: string
          submission_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          id?: string
          matched_sources?: Json | null
          similarity_pct?: number
          status?: string
          submission_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          id?: string
          matched_sources?: Json | null
          similarity_pct?: number
          status?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plagiarism_reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          page_path: string | null
          popup_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          page_path?: string | null
          popup_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          page_path?: string | null
          popup_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "popup_analytics_popup_id_fkey"
            columns: ["popup_id"]
            isOneToOne: false
            referencedRelation: "popups"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_submissions: {
        Row: {
          email: string | null
          form_data: Json | null
          id: string
          ip_address: string | null
          popup_id: string
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          email?: string | null
          form_data?: Json | null
          id?: string
          ip_address?: string | null
          popup_id: string
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          email?: string | null
          form_data?: Json | null
          id?: string
          ip_address?: string | null
          popup_id?: string
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "popup_submissions_popup_id_fkey"
            columns: ["popup_id"]
            isOneToOne: false
            referencedRelation: "popups"
            referencedColumns: ["id"]
          },
        ]
      }
      popups: {
        Row: {
          accent_color: string | null
          animation: string
          background_color: string | null
          background_video_overlay_opacity: number | null
          background_video_url: string | null
          body_content: string | null
          countdown_expired_action: string | null
          countdown_expired_message: string | null
          countdown_source: string | null
          countdown_source_field: string | null
          countdown_source_id: string | null
          countdown_target_date: string | null
          created_at: string
          created_by: string | null
          cta_primary_label: string | null
          cta_primary_url: string | null
          cta_secondary_label: string | null
          cta_secondary_url: string | null
          end_date: string | null
          exclude_pages: string[] | null
          form_fields: Json | null
          frequency: string
          frequency_value: number | null
          id: string
          image_url: string | null
          is_active: boolean
          layout: string
          name: string
          priority: number
          size: string
          start_date: string | null
          subtitle: string | null
          target_devices: string
          target_pages: string[] | null
          target_user_state: string
          text_color: string | null
          title: string | null
          trigger_type: string
          trigger_value: number
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          accent_color?: string | null
          animation?: string
          background_color?: string | null
          background_video_overlay_opacity?: number | null
          background_video_url?: string | null
          body_content?: string | null
          countdown_expired_action?: string | null
          countdown_expired_message?: string | null
          countdown_source?: string | null
          countdown_source_field?: string | null
          countdown_source_id?: string | null
          countdown_target_date?: string | null
          created_at?: string
          created_by?: string | null
          cta_primary_label?: string | null
          cta_primary_url?: string | null
          cta_secondary_label?: string | null
          cta_secondary_url?: string | null
          end_date?: string | null
          exclude_pages?: string[] | null
          form_fields?: Json | null
          frequency?: string
          frequency_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout?: string
          name: string
          priority?: number
          size?: string
          start_date?: string | null
          subtitle?: string | null
          target_devices?: string
          target_pages?: string[] | null
          target_user_state?: string
          text_color?: string | null
          title?: string | null
          trigger_type?: string
          trigger_value?: number
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          accent_color?: string | null
          animation?: string
          background_color?: string | null
          background_video_overlay_opacity?: number | null
          background_video_url?: string | null
          body_content?: string | null
          countdown_expired_action?: string | null
          countdown_expired_message?: string | null
          countdown_source?: string | null
          countdown_source_field?: string | null
          countdown_source_id?: string | null
          countdown_target_date?: string | null
          created_at?: string
          created_by?: string | null
          cta_primary_label?: string | null
          cta_primary_url?: string | null
          cta_secondary_label?: string | null
          cta_secondary_url?: string | null
          end_date?: string | null
          exclude_pages?: string[] | null
          form_fields?: Json | null
          frequency?: string
          frequency_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout?: string
          name?: string
          priority?: number
          size?: string
          start_date?: string | null
          subtitle?: string | null
          target_devices?: string
          target_pages?: string[] | null
          target_user_state?: string
          text_color?: string | null
          title?: string | null
          trigger_type?: string
          trigger_value?: number
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: Json | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          seo_keywords: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          seo_keywords?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          seo_keywords?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_groups: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          max_members: number
          name: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_members?: number
          name: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_members?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submissions: {
        Row: {
          created_at: string
          description: string | null
          feedback: string | null
          file_url: string | null
          graded_at: string | null
          graded_by: string | null
          group_id: string
          id: string
          score: number | null
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feedback?: string | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          group_id: string
          id?: string
          score?: number | null
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feedback?: string | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          group_id?: string
          id?: string
          score?: number | null
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          admin_feedback: string | null
          answers: Json | null
          completed_at: string | null
          id: string
          ip_address: string | null
          manual_overrides: Json | null
          passed: boolean | null
          percentage: number | null
          quiz_id: string
          score: number | null
          started_at: string | null
          time_spent_seconds: number | null
          total_points: number | null
          user_id: string
        }
        Insert: {
          admin_feedback?: string | null
          answers?: Json | null
          completed_at?: string | null
          id?: string
          ip_address?: string | null
          manual_overrides?: Json | null
          passed?: boolean | null
          percentage?: number | null
          quiz_id: string
          score?: number | null
          started_at?: string | null
          time_spent_seconds?: number | null
          total_points?: number | null
          user_id: string
        }
        Update: {
          admin_feedback?: string | null
          answers?: Json | null
          completed_at?: string | null
          id?: string
          ip_address?: string | null
          manual_overrides?: Json | null
          passed?: boolean | null
          percentage?: number | null
          quiz_id?: string
          score?: number | null
          started_at?: string | null
          time_spent_seconds?: number | null
          total_points?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          explanation: string | null
          id: string
          image_url: string | null
          is_instruction: boolean | null
          negative_marks: number | null
          options: Json | null
          points: number | null
          question_text: string
          question_type: string | null
          quiz_id: string
          sequence_items: Json | null
          sort_order: number | null
          timer_seconds: number | null
        }
        Insert: {
          correct_answer: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_instruction?: boolean | null
          negative_marks?: number | null
          options?: Json | null
          points?: number | null
          question_text: string
          question_type?: string | null
          quiz_id: string
          sequence_items?: Json | null
          sort_order?: number | null
          timer_seconds?: number | null
        }
        Update: {
          correct_answer?: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_instruction?: boolean | null
          negative_marks?: number | null
          options?: Json | null
          points?: number | null
          question_text?: string
          question_type?: string | null
          quiz_id?: string
          sequence_items?: Json | null
          sort_order?: number | null
          timer_seconds?: number | null
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
      quizzes: {
        Row: {
          anti_cheat_enabled: boolean | null
          auto_submit_on_blur: boolean | null
          course_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_published: boolean | null
          lesson_id: string | null
          lock_ip: boolean | null
          max_attempts: number | null
          pass_percentage: number | null
          quiz_number: string | null
          randomize_options: boolean | null
          randomize_questions: boolean | null
          section_id: string | null
          sort_order: number | null
          status: string | null
          time_limit_minutes: number | null
          timer_mode: string | null
          title: string
        }
        Insert: {
          anti_cheat_enabled?: boolean | null
          auto_submit_on_blur?: boolean | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          lesson_id?: string | null
          lock_ip?: boolean | null
          max_attempts?: number | null
          pass_percentage?: number | null
          quiz_number?: string | null
          randomize_options?: boolean | null
          randomize_questions?: boolean | null
          section_id?: string | null
          sort_order?: number | null
          status?: string | null
          time_limit_minutes?: number | null
          timer_mode?: string | null
          title: string
        }
        Update: {
          anti_cheat_enabled?: boolean | null
          auto_submit_on_blur?: boolean | null
          course_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_published?: boolean | null
          lesson_id?: string | null
          lock_ip?: boolean | null
          max_attempts?: number | null
          pass_percentage?: number | null
          quiz_number?: string | null
          randomize_options?: boolean | null
          randomize_questions?: boolean | null
          section_id?: string | null
          sort_order?: number | null
          status?: string | null
          time_limit_minutes?: number | null
          timer_mode?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      r2_round_robin_state: {
        Row: {
          id: number
          last_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          last_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          last_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "r2_round_robin_state_last_account_id_fkey"
            columns: ["last_account_id"]
            isOneToOne: false
            referencedRelation: "cloudflare_r2_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          created_at: string | null
          credited_at: string | null
          id: string
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          credited_at?: string | null
          id?: string
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          credited_at?: string | null
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          order_id: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          refund_method: string
          status: string
          transaction_reference: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          order_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          refund_method?: string
          status?: string
          transaction_reference?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          order_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          refund_method?: string
          status?: string
          transaction_reference?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_form_config: {
        Row: {
          banner_url: string | null
          countdown_target: string | null
          custom_css: string | null
          event_details: string | null
          fields_order: Json | null
          id: string
          page_subtitle: string | null
          page_title: string | null
          updated_at: string | null
        }
        Insert: {
          banner_url?: string | null
          countdown_target?: string | null
          custom_css?: string | null
          event_details?: string | null
          fields_order?: Json | null
          id?: string
          page_subtitle?: string | null
          page_title?: string | null
          updated_at?: string | null
        }
        Update: {
          banner_url?: string | null
          countdown_target?: string | null
          custom_css?: string | null
          event_details?: string | null
          fields_order?: Json | null
          id?: string
          page_subtitle?: string | null
          page_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registration_purposes: {
        Row: {
          created_at: string | null
          custom_fields: Json | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          max_entries: number | null
          name: string
          photo_required: boolean | null
          slug: string
          sort_order: number | null
          starts_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_fields?: Json | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          max_entries?: number | null
          name: string
          photo_required?: boolean | null
          slug: string
          sort_order?: number | null
          starts_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_fields?: Json | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          max_entries?: number | null
          name?: string
          photo_required?: boolean | null
          slug?: string
          sort_order?: number | null
          starts_at?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          batch: string | null
          blood_group: string | null
          business_name: string | null
          created_at: string | null
          email: string
          experience_years: number | null
          extra_fields: Json | null
          full_name: string
          id: string
          job_area: string | null
          mobile: string
          photo_url: string | null
          purpose_id: string | null
          university: string | null
        }
        Insert: {
          batch?: string | null
          blood_group?: string | null
          business_name?: string | null
          created_at?: string | null
          email: string
          experience_years?: number | null
          extra_fields?: Json | null
          full_name: string
          id?: string
          job_area?: string | null
          mobile: string
          photo_url?: string | null
          purpose_id?: string | null
          university?: string | null
        }
        Update: {
          batch?: string | null
          blood_group?: string | null
          business_name?: string | null
          created_at?: string | null
          email?: string
          experience_years?: number | null
          extra_fields?: Json | null
          full_name?: string
          id?: string
          job_area?: string | null
          mobile?: string
          photo_url?: string | null
          purpose_id?: string | null
          university?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_purpose_id_fkey"
            columns: ["purpose_id"]
            isOneToOne: false
            referencedRelation: "registration_purposes"
            referencedColumns: ["id"]
          },
        ]
      }
      research_paper_access: {
        Row: {
          access_type: string
          created_at: string | null
          id: string
          paper_id: string
          user_id: string
        }
        Insert: {
          access_type?: string
          created_at?: string | null
          id?: string
          paper_id: string
          user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string | null
          id?: string
          paper_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_paper_access_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "research_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_paper_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_paper_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          paper_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          paper_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          paper_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_paper_bookmarks_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "research_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_paper_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_paper_reviews: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          is_anonymous: boolean | null
          paper_id: string
          rating: number | null
          reviewer_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_anonymous?: boolean | null
          paper_id: string
          rating?: number | null
          reviewer_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_anonymous?: boolean | null
          paper_id?: string
          rating?: number | null
          reviewer_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_paper_reviews_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "research_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_paper_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_papers: {
        Row: {
          abstract: string | null
          access_type: string
          admin_notes: string | null
          authors: Json | null
          category: string | null
          citation_count: number
          cover_image_url: string | null
          created_at: string
          doi: string | null
          download_count: number
          file_url: string | null
          id: string
          is_approved: boolean
          issue: string | null
          keywords: string | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          page_range: string | null
          price: number | null
          published_date: string | null
          reviewer_feedback: string | null
          reviewer_id: string | null
          revision_notes: string | null
          seo_keywords: string | null
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
          view_count: number
          volume: string | null
        }
        Insert: {
          abstract?: string | null
          access_type?: string
          admin_notes?: string | null
          authors?: Json | null
          category?: string | null
          citation_count?: number
          cover_image_url?: string | null
          created_at?: string
          doi?: string | null
          download_count?: number
          file_url?: string | null
          id?: string
          is_approved?: boolean
          issue?: string | null
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_range?: string | null
          price?: number | null
          published_date?: string | null
          reviewer_feedback?: string | null
          reviewer_id?: string | null
          revision_notes?: string | null
          seo_keywords?: string | null
          status?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
          view_count?: number
          volume?: string | null
        }
        Update: {
          abstract?: string | null
          access_type?: string
          admin_notes?: string | null
          authors?: Json | null
          category?: string | null
          citation_count?: number
          cover_image_url?: string | null
          created_at?: string
          doi?: string | null
          download_count?: number
          file_url?: string | null
          id?: string
          is_approved?: boolean
          issue?: string | null
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_range?: string | null
          price?: number | null
          published_date?: string | null
          reviewer_feedback?: string | null
          reviewer_id?: string | null
          revision_notes?: string | null
          seo_keywords?: string | null
          status?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
          view_count?: number
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_papers_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_papers_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          admin_response: string | null
          comment: string | null
          course_id: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          rating: number
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          comment?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating: number
          user_id: string
        }
        Update: {
          admin_response?: string | null
          comment?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          content: Json
          id: string
          page_key: string
          section_key: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          page_key: string
          section_key: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          page_key?: string
          section_key?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: number
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: number
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: number
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          provider_response: Json | null
          recipient_phone: string
          status: string
          template_key: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          provider_response?: Json | null
          recipient_phone: string
          status?: string
          template_key?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          provider_response?: Json | null
          recipient_phone?: string
          status?: string
          template_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          click_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string
          name: string
          sort_order: number | null
          tier: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          click_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url: string
          name: string
          sort_order?: number | null
          tier?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          click_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string
          name?: string
          sort_order?: number | null
          tier?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      storage_migration_log: {
        Row: {
          attempt_count: number
          bucket_path: string | null
          created_at: string
          error_message: string | null
          file_size: number | null
          id: string
          last_error_at: string | null
          migrated_at: string | null
          mime_type: string | null
          new_url: string | null
          old_url: string
          source: string | null
          started_at: string | null
          status: string
          tables_updated: Json | null
        }
        Insert: {
          attempt_count?: number
          bucket_path?: string | null
          created_at?: string
          error_message?: string | null
          file_size?: number | null
          id?: string
          last_error_at?: string | null
          migrated_at?: string | null
          mime_type?: string | null
          new_url?: string | null
          old_url: string
          source?: string | null
          started_at?: string | null
          status?: string
          tables_updated?: Json | null
        }
        Update: {
          attempt_count?: number
          bucket_path?: string | null
          created_at?: string
          error_message?: string | null
          file_size?: number | null
          id?: string
          last_error_at?: string | null
          migrated_at?: string | null
          mime_type?: string | null
          new_url?: string | null
          old_url?: string
          source?: string | null
          started_at?: string | null
          status?: string
          tables_updated?: Json | null
        }
        Relationships: []
      }
      student_grades: {
        Row: {
          batch_id: string | null
          course_id: string
          created_at: string
          credits: number
          grade_point: number
          graded_by: string | null
          id: string
          letter_grade: string
          notes: string | null
          percentage: number | null
          semester: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          course_id: string
          created_at?: string
          credits?: number
          grade_point: number
          graded_by?: string | null
          id?: string
          letter_grade: string
          notes?: string | null
          percentage?: number | null
          semester?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          course_id?: string
          created_at?: string
          credits?: number
          grade_point?: number
          graded_by?: string | null
          id?: string
          letter_grade?: string
          notes?: string | null
          percentage?: number | null
          semester?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_grades_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_grades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_id_cards: {
        Row: {
          card_number: string
          created_at: string | null
          download_blocked: boolean
          id: string
          is_active: boolean
          updated_at: string | null
          user_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          card_number: string
          created_at?: string | null
          download_blocked?: boolean
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          card_number?: string
          created_at?: string | null
          download_blocked?: boolean
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_id_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      success_stories: {
        Row: {
          course_title: string | null
          created_at: string | null
          graduation_year: number | null
          id: string
          is_featured: boolean | null
          job_title: string | null
          name: string
          photo_url: string | null
          story: string
        }
        Insert: {
          course_title?: string | null
          created_at?: string | null
          graduation_year?: number | null
          id?: string
          is_featured?: boolean | null
          job_title?: string | null
          name: string
          photo_url?: string | null
          story: string
        }
        Update: {
          course_title?: string | null
          created_at?: string | null
          graduation_year?: number | null
          id?: string
          is_featured?: boolean | null
          job_title?: string | null
          name?: string
          photo_url?: string | null
          story?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_type: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_type: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_type?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          batch: string | null
          bio: string | null
          blood_group: string | null
          business_type: string | null
          campus: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          current_job: string | null
          date_of_birth: string | null
          district: string | null
          division: string | null
          expertise: string[] | null
          facebook_url: string | null
          full_name: string | null
          gender: string | null
          github_url: string | null
          graduation_year: number | null
          headline: string | null
          id: string
          is_active: boolean | null
          is_public_contributor: boolean
          language_preference: string | null
          latitude: number | null
          linkedin_url: string | null
          location_updated_at: string | null
          longitude: number | null
          name_last_changed_at: string | null
          occupation: string | null
          phone: string | null
          preferred_language: string | null
          professional_role: string | null
          referral_code: string | null
          referred_by: string | null
          roll_id: string | null
          social_links: Json | null
          theme_preference: string | null
          university: string | null
          upazila: string | null
          updated_at: string | null
          username: string | null
          vote_count: number
          website_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          batch?: string | null
          bio?: string | null
          blood_group?: string | null
          business_type?: string | null
          campus?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          current_job?: string | null
          date_of_birth?: string | null
          district?: string | null
          division?: string | null
          expertise?: string[] | null
          facebook_url?: string | null
          full_name?: string | null
          gender?: string | null
          github_url?: string | null
          graduation_year?: number | null
          headline?: string | null
          id: string
          is_active?: boolean | null
          is_public_contributor?: boolean
          language_preference?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          location_updated_at?: string | null
          longitude?: number | null
          name_last_changed_at?: string | null
          occupation?: string | null
          phone?: string | null
          preferred_language?: string | null
          professional_role?: string | null
          referral_code?: string | null
          referred_by?: string | null
          roll_id?: string | null
          social_links?: Json | null
          theme_preference?: string | null
          university?: string | null
          upazila?: string | null
          updated_at?: string | null
          username?: string | null
          vote_count?: number
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          batch?: string | null
          bio?: string | null
          blood_group?: string | null
          business_type?: string | null
          campus?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          current_job?: string | null
          date_of_birth?: string | null
          district?: string | null
          division?: string | null
          expertise?: string[] | null
          facebook_url?: string | null
          full_name?: string | null
          gender?: string | null
          github_url?: string | null
          graduation_year?: number | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_public_contributor?: boolean
          language_preference?: string | null
          latitude?: number | null
          linkedin_url?: string | null
          location_updated_at?: string | null
          longitude?: number | null
          name_last_changed_at?: string | null
          occupation?: string | null
          phone?: string | null
          preferred_language?: string | null
          professional_role?: string | null
          referral_code?: string | null
          referred_by?: string | null
          roll_id?: string | null
          social_links?: Json | null
          theme_preference?: string | null
          university?: string | null
          upazila?: string | null
          updated_at?: string | null
          username?: string | null
          vote_count?: number
          website_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_lab_completions: {
        Row: {
          completed_at: string
          id: string
          lab_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lab_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lab_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_lab_completions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "virtual_labs"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_labs: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instructions: string | null
          is_published: boolean
          simulation_url: string
          sort_order: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          simulation_url: string
          sort_order?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          simulation_url?: string
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_labs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_labs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_topup_requests: {
        Row: {
          account_number: string | null
          admin_note: string | null
          amount: number
          created_at: string | null
          id: string
          payment_method: string
          processed_at: string | null
          processed_by: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          admin_note?: string | null
          amount: number
          created_at?: string | null
          id?: string
          payment_method: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          admin_note?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          payment_method?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_lessons: {
        Row: {
          content: string | null
          created_at: string | null
          description: string | null
          id: string
          lesson_type: string | null
          sort_order: number | null
          title: string
          updated_at: string | null
          workshop_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lesson_type?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
          workshop_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          lesson_type?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_lessons_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_quiz_attempts: {
        Row: {
          answers: Json
          id: string
          max_score: number | null
          quiz_id: string
          registration_id: string
          score: number | null
          submitted_at: string
        }
        Insert: {
          answers?: Json
          id?: string
          max_score?: number | null
          quiz_id: string
          registration_id: string
          score?: number | null
          submitted_at?: string
        }
        Update: {
          answers?: Json
          id?: string
          max_score?: number | null
          quiz_id?: string
          registration_id?: string
          score?: number | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "workshop_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_quiz_attempts_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "workshop_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_quizzes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          questions: Json
          time_limit_minutes: number | null
          title: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          questions?: Json
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          questions?: Json
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_quizzes_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_registrations: {
        Row: {
          checked_in_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          institution: string | null
          mobile: string | null
          registration_number: string
          status: Database["public"]["Enums"]["workshop_registration_status"]
          updated_at: string
          user_id: string | null
          workshop_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          institution?: string | null
          mobile?: string | null
          registration_number?: string
          status?: Database["public"]["Enums"]["workshop_registration_status"]
          updated_at?: string
          user_id?: string | null
          workshop_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          institution?: string | null
          mobile?: string | null
          registration_number?: string
          status?: Database["public"]["Enums"]["workshop_registration_status"]
          updated_at?: string
          user_id?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_registrations_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_sessions: {
        Row: {
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          meet_link: string | null
          session_date: string
          sort_order: number | null
          start_time: string | null
          title: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          meet_link?: string | null
          session_date: string
          sort_order?: number | null
          start_time?: string | null
          title: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          meet_link?: string | null
          session_date?: string
          sort_order?: number | null
          start_time?: string | null
          title?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_sessions_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          end_date: string | null
          end_time: string | null
          fake_registration_count: number
          id: string
          instructor_avatar: string | null
          instructor_bio: string | null
          instructor_id: string | null
          instructor_name: string | null
          is_featured: boolean
          materials: Json | null
          max_participants: number | null
          meet_link: string | null
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          prerequisites: string | null
          registration_deadline: string | null
          seo_keywords: string | null
          short_description: string | null
          slug: string
          start_at: string | null
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["workshop_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          what_you_learn: Json | null
          workshop_type: Database["public"]["Enums"]["workshop_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          end_date?: string | null
          end_time?: string | null
          fake_registration_count?: number
          id?: string
          instructor_avatar?: string | null
          instructor_bio?: string | null
          instructor_id?: string | null
          instructor_name?: string | null
          is_featured?: boolean
          materials?: Json | null
          max_participants?: number | null
          meet_link?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          prerequisites?: string | null
          registration_deadline?: string | null
          seo_keywords?: string | null
          short_description?: string | null
          slug: string
          start_at?: string | null
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["workshop_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          what_you_learn?: Json | null
          workshop_type?: Database["public"]["Enums"]["workshop_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          end_date?: string | null
          end_time?: string | null
          fake_registration_count?: number
          id?: string
          instructor_avatar?: string | null
          instructor_bio?: string | null
          instructor_id?: string | null
          instructor_name?: string | null
          is_featured?: boolean
          materials?: Json | null
          max_participants?: number | null
          meet_link?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          prerequisites?: string | null
          registration_deadline?: string | null
          seo_keywords?: string | null
          short_description?: string | null
          slug?: string
          start_at?: string | null
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["workshop_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          what_you_learn?: Json | null
          workshop_type?: Database["public"]["Enums"]["workshop_type"]
        }
        Relationships: [
          {
            foreignKeyName: "workshops_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_update_workshop_status: { Args: never; Returns: undefined }
      can_manage_content_contributors: {
        Args: { _content_id: string; _content_type: string }
        Returns: boolean
      }
      can_manage_course: { Args: { _course_id: string }; Returns: boolean }
      cleanup_old_ai_chats: { Args: never; Returns: undefined }
      credit_wallet: {
        Args: {
          _amount: number
          _description?: string
          _reference_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      debit_wallet: {
        Args: {
          _amount: number
          _description?: string
          _reference_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      generate_seo_slug: {
        Args: { _existing_id?: string; _table_name: string; _title: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ebook_download: {
        Args: { _ebook_id: string }
        Returns: undefined
      }
      increment_internship_view: {
        Args: { _internship_id: string }
        Returns: undefined
      }
      increment_research_paper_download: {
        Args: { _paper_id: string }
        Returns: undefined
      }
      increment_research_paper_view: {
        Args: { _paper_id: string }
        Returns: undefined
      }
      notify_admins: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      search_forum: {
        Args: { search_query: string }
        Returns: {
          category_id: string | null
          content: string
          created_at: string | null
          id: string
          is_closed: boolean | null
          is_pinned: boolean | null
          search_vector: unknown
          title: string
          updated_at: string | null
          user_id: string
          view_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "forum_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      seo_clean_text: {
        Args: { _input: string; _max_len?: number }
        Returns: string
      }
      seo_keywords_from_title: {
        Args: { _extra?: string; _title: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "chief_marketer"
        | "content_writer"
        | "instructor"
        | "student"
      workshop_registration_status:
        | "registered"
        | "attended"
        | "cancelled"
        | "no_show"
      workshop_status:
        | "draft"
        | "published"
        | "ongoing"
        | "completed"
        | "cancelled"
      workshop_type: "one_day" | "multi_day"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "chief_marketer",
        "content_writer",
        "instructor",
        "student",
      ],
      workshop_registration_status: [
        "registered",
        "attended",
        "cancelled",
        "no_show",
      ],
      workshop_status: [
        "draft",
        "published",
        "ongoing",
        "completed",
        "cancelled",
      ],
      workshop_type: ["one_day", "multi_day"],
    },
  },
} as const
