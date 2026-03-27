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
          applicable_to: string | null
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          min_order_amount: number | null
          usage_limit: number | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_to?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_to?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
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
          price: number | null
          rejection_reason: string | null
          revenue_share_pct: number | null
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
          price?: number | null
          rejection_reason?: string | null
          revenue_share_pct?: number | null
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
          price?: number | null
          rejection_reason?: string | null
          revenue_share_pct?: number | null
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
      discussions: {
        Row: {
          content: string
          course_id: string
          created_at: string | null
          id: string
          is_answered: boolean | null
          lesson_id: string | null
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          lesson_id?: string | null
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string | null
          id?: string
          is_answered?: boolean | null
          lesson_id?: string | null
          parent_id?: string | null
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
          description: string | null
          discount_price: number | null
          download_count: number | null
          file_format: string | null
          file_url: string | null
          gallery_urls: string[] | null
          id: string
          is_published: boolean | null
          meta_keywords: string | null
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
          description?: string | null
          discount_price?: number | null
          download_count?: number | null
          file_format?: string | null
          file_url?: string | null
          gallery_urls?: string[] | null
          id?: string
          is_published?: boolean | null
          meta_keywords?: string | null
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
          description?: string | null
          discount_price?: number | null
          download_count?: number | null
          file_format?: string | null
          file_url?: string | null
          gallery_urls?: string[] | null
          id?: string
          is_published?: boolean | null
          meta_keywords?: string | null
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
        ]
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
          id: string
          image_url: string | null
          is_active: boolean | null
          secondary_cta_link: string | null
          secondary_cta_text: string | null
          sort_order: number | null
          subtitle: string | null
          title: string
        }
        Insert: {
          countdown_target?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          secondary_cta_link?: string | null
          secondary_cta_text?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title: string
        }
        Update: {
          countdown_target?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          secondary_cta_link?: string | null
          secondary_cta_text?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string
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
      posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: Json | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          published_at: string | null
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
          published_at?: string | null
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
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
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
      reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string | null
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
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
      user_profiles: {
        Row: {
          avatar_url: string | null
          batch: string | null
          blood_group: string | null
          business_type: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          current_job: string | null
          date_of_birth: string | null
          district: string | null
          division: string | null
          full_name: string | null
          graduation_year: number | null
          id: string
          is_active: boolean | null
          language_preference: string | null
          latitude: number | null
          longitude: number | null
          occupation: string | null
          phone: string | null
          professional_role: string | null
          referral_code: string | null
          referred_by: string | null
          roll_id: string | null
          theme_preference: string | null
          university: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          batch?: string | null
          blood_group?: string | null
          business_type?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          current_job?: string | null
          date_of_birth?: string | null
          district?: string | null
          division?: string | null
          full_name?: string | null
          graduation_year?: number | null
          id: string
          is_active?: boolean | null
          language_preference?: string | null
          latitude?: number | null
          longitude?: number | null
          occupation?: string | null
          phone?: string | null
          professional_role?: string | null
          referral_code?: string | null
          referred_by?: string | null
          roll_id?: string | null
          theme_preference?: string | null
          university?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          batch?: string | null
          blood_group?: string | null
          business_type?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          current_job?: string | null
          date_of_birth?: string | null
          district?: string | null
          division?: string | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string
          is_active?: boolean | null
          language_preference?: string | null
          latitude?: number | null
          longitude?: number | null
          occupation?: string | null
          phone?: string | null
          professional_role?: string | null
          referral_code?: string | null
          referred_by?: string | null
          roll_id?: string | null
          theme_preference?: string | null
          university?: string | null
          updated_at?: string | null
          username?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      notify_admins: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type: string
        }
        Returns: undefined
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
    },
  },
} as const
