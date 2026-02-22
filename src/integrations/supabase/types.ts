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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asha_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          rule_id: string | null
          rule_name: string
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          rule_id?: string | null
          rule_name: string
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          rule_id?: string | null
          rule_name?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "asha_monitor_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_branches: {
        Row: {
          conflicts: number
          created_at: string
          id: string
          is_main: boolean
          is_protected: boolean
          name: string
          parent_id: string | null
          transform_count: number
          user_id: string
        }
        Insert: {
          conflicts?: number
          created_at?: string
          id?: string
          is_main?: boolean
          is_protected?: boolean
          name: string
          parent_id?: string | null
          transform_count?: number
          user_id: string
        }
        Update: {
          conflicts?: number
          created_at?: string
          id?: string
          is_main?: boolean
          is_protected?: boolean
          name?: string
          parent_id?: string | null
          transform_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_branches_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "asha_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_datasets: {
        Row: {
          branch: string | null
          col_count: number | null
          created_at: string
          date_range: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          issues: Json | null
          project_name: string | null
          quality_score: number | null
          row_count: number | null
          schema: Json | null
          session_id: string | null
          status: string
          storage_path: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string | null
          col_count?: number | null
          created_at?: string
          date_range?: string | null
          description?: string | null
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          issues?: Json | null
          project_name?: string | null
          quality_score?: number | null
          row_count?: number | null
          schema?: Json | null
          session_id?: string | null
          status?: string
          storage_path: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string | null
          col_count?: number | null
          created_at?: string
          date_range?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          issues?: Json | null
          project_name?: string | null
          quality_score?: number | null
          row_count?: number | null
          schema?: Json | null
          session_id?: string | null
          status?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_datasets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_document_entities: {
        Row: {
          confidence: number | null
          context: string | null
          created_at: string
          document_id: string
          entity_label: string | null
          entity_type: string
          entity_value: string
          id: string
          metadata: Json | null
          page_number: number | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          context?: string | null
          created_at?: string
          document_id: string
          entity_label?: string | null
          entity_type?: string
          entity_value: string
          id?: string
          metadata?: Json | null
          page_number?: number | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          context?: string | null
          created_at?: string
          document_id?: string
          entity_label?: string | null
          entity_type?: string
          entity_value?: string
          id?: string
          metadata?: Json | null
          page_number?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_document_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "asha_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_document_links: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          link_reason: string | null
          link_type: string
          source_document_id: string
          target_document_id: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          link_reason?: string | null
          link_type?: string
          source_document_id: string
          target_document_id: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          link_reason?: string | null
          link_type?: string
          source_document_id?: string
          target_document_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_document_links_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "asha_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asha_document_links_target_document_id_fkey"
            columns: ["target_document_id"]
            isOneToOne: false
            referencedRelation: "asha_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_documents: {
        Row: {
          created_at: string
          doc_type: string
          extracted_text: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          language: string | null
          metadata: Json | null
          page_count: number | null
          session_id: string | null
          status: string
          storage_path: string
          summary: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          language?: string | null
          metadata?: Json | null
          page_count?: number | null
          session_id?: string | null
          status?: string
          storage_path: string
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          language?: string | null
          metadata?: Json | null
          page_count?: number | null
          session_id?: string | null
          status?: string
          storage_path?: string
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_entity_matches: {
        Row: {
          confidence: number
          created_at: string
          entity_a: Json
          entity_b: Json
          entity_type: string
          id: string
          match_fields: string[]
          status: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entity_a: Json
          entity_b: Json
          entity_type?: string
          id?: string
          match_fields?: string[]
          status?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_a?: Json
          entity_b?: Json
          entity_type?: string
          id?: string
          match_fields?: string[]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      asha_insights: {
        Row: {
          created_at: string
          dataset_id: string | null
          description: string
          dismissed: boolean
          icon: string
          id: string
          pinned: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          description: string
          dismissed?: boolean
          icon?: string
          id?: string
          pinned?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          description?: string
          dismissed?: boolean
          icon?: string
          id?: string
          pinned?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_insights_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "asha_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_monitor_rules: {
        Row: {
          active: boolean
          condition: string
          created_at: string
          frequency: string
          id: string
          last_checked: string | null
          last_triggered: string | null
          name: string
          target: string
          threshold: string
          trigger_count: number
          user_id: string
        }
        Insert: {
          active?: boolean
          condition: string
          created_at?: string
          frequency?: string
          id?: string
          last_checked?: string | null
          last_triggered?: string | null
          name: string
          target: string
          threshold: string
          trigger_count?: number
          user_id: string
        }
        Update: {
          active?: boolean
          condition?: string
          created_at?: string
          frequency?: string
          id?: string
          last_checked?: string | null
          last_triggered?: string | null
          name?: string
          target?: string
          threshold?: string
          trigger_count?: number
          user_id?: string
        }
        Relationships: []
      }
      asha_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          response: string
          response_type: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          response?: string
          response_type?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          response?: string
          response_type?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_queries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_reports: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          pages: number | null
          schedule: string | null
          session_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          name: string
          pages?: number | null
          schedule?: string | null
          session_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          pages?: number | null
          schedule?: string | null
          session_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_sessions: {
        Row: {
          company_name: string
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asha_workflows: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_run: string | null
          name: string
          runs_count: number
          template_id: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_run?: string | null
          name: string
          runs_count?: number
          template_id?: string | null
          trigger_type?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_run?: string | null
          name?: string
          runs_count?: number
          template_id?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_profiles: {
        Row: {
          company_name: string | null
          competitors: string[]
          created_at: string
          custom_topics: string[]
          delivery_time: string
          enabled: boolean
          id: string
          industry: string
          investment_interests: string[]
          key_markets: string[]
          regulatory_bodies: string[]
          technology_stack: string[]
          tracked_people: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          competitors?: string[]
          created_at?: string
          custom_topics?: string[]
          delivery_time?: string
          enabled?: boolean
          id?: string
          industry?: string
          investment_interests?: string[]
          key_markets?: string[]
          regulatory_bodies?: string[]
          technology_stack?: string[]
          tracked_people?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          competitors?: string[]
          created_at?: string
          custom_topics?: string[]
          delivery_time?: string
          enabled?: boolean
          id?: string
          industry?: string
          investment_interests?: string[]
          key_markets?: string[]
          regulatory_bodies?: string[]
          technology_stack?: string[]
          tracked_people?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_reports: {
        Row: {
          content: string
          created_at: string
          critical_items: number
          id: string
          monitoring_items: number
          significant_items: number
          sources_checked: number
          title: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          critical_items?: number
          id?: string
          monitoring_items?: number
          significant_items?: number
          sources_checked?: number
          title?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          critical_items?: number
          id?: string
          monitoring_items?: number
          significant_items?: number
          sources_checked?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      calibration_feedback: {
        Row: {
          created_at: string
          feedback: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      code_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "code_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      code_snippets: {
        Row: {
          content: string
          created_at: string
          folder_id: string | null
          id: string
          language: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          language?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          language?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_snippets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "code_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          replies_count: number
          status: string
          title: string
          updated_at: string
          user_id: string
          votes: number
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          replies_count?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
          votes?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          replies_count?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          votes?: number
        }
        Relationships: []
      }
      community_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          mode: string
          persona_id: string | null
          pinned: boolean
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          mode?: string
          persona_id?: string | null
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          mode?: string
          persona_id?: string | null
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_permissions: {
        Row: {
          created_at: string
          dataset_id: string | null
          id: string
          row_filter: Json | null
          sensitivity_level: string
          team_id: string
          user_id: string | null
          visible_columns: string[]
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          id?: string
          row_filter?: Json | null
          sensitivity_level?: string
          team_id: string
          user_id?: string | null
          visible_columns?: string[]
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          id?: string
          row_filter?: Json | null
          sensitivity_level?: string
          team_id?: string
          user_id?: string | null
          visible_columns?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "data_permissions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "asha_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_permissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      google_accounts: {
        Row: {
          access_token: string
          avatar_url: string | null
          created_at: string
          data_points_count: number
          display_name: string | null
          google_email: string
          id: string
          is_primary: boolean
          last_sync_at: string | null
          refresh_token: string
          scopes: string[]
          status: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          avatar_url?: string | null
          created_at?: string
          data_points_count?: number
          display_name?: string | null
          google_email: string
          id?: string
          is_primary?: boolean
          last_sync_at?: string | null
          refresh_token: string
          scopes?: string[]
          status?: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          avatar_url?: string | null
          created_at?: string
          data_points_count?: number
          display_name?: string | null
          google_email?: string
          id?: string
          is_primary?: boolean
          last_sync_at?: string | null
          refresh_token?: string
          scopes?: string[]
          status?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      granted_subscriptions: {
        Row: {
          active: boolean
          email: string
          expires_at: string | null
          granted_at: string
          id: string
          product_id: string
          tier: string
        }
        Insert: {
          active?: boolean
          email: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          product_id: string
          tier: string
        }
        Update: {
          active?: boolean
          email?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          product_id?: string
          tier?: string
        }
        Relationships: []
      }
      honeypot_logs: {
        Row: {
          created_at: string
          fingerprint: string | null
          geo_country: string | null
          id: string
          request_data: Json
          source_ip: string | null
          trap_name: string
          trap_type: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          geo_country?: string | null
          id?: string
          request_data?: Json
          source_ip?: string | null
          trap_name: string
          trap_type?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          geo_country?: string | null
          id?: string
          request_data?: Json
          source_ip?: string | null
          trap_name?: string
          trap_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      ide_sessions: {
        Row: {
          active_file_id: string | null
          created_at: string
          files: Json
          id: string
          name: string
          open_file_ids: string[]
          panel_config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_file_id?: string | null
          created_at?: string
          files?: Json
          id?: string
          name?: string
          open_file_ids?: string[]
          panel_config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_file_id?: string | null
          created_at?: string
          files?: Json
          id?: string
          name?: string
          open_file_ids?: string[]
          panel_config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imagine_sessions: {
        Row: {
          aureon_messages: Json
          created_at: string
          grid_h: number
          grid_w: number
          id: string
          name: string
          pixels: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          aureon_messages?: Json
          created_at?: string
          grid_h?: number
          grid_w?: number
          id?: string
          name?: string
          pixels?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          aureon_messages?: Json
          created_at?: string
          grid_h?: number
          grid_w?: number
          id?: string
          name?: string
          pixels?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_responses: {
        Row: {
          action_taken: string
          auto_resolved: boolean
          created_at: string
          details: Json
          event_ids: string[]
          id: string
          incident_type: string
          resolved_at: string | null
          severity: string
          target_ip: string | null
          target_user_id: string | null
        }
        Insert: {
          action_taken: string
          auto_resolved?: boolean
          created_at?: string
          details?: Json
          event_ids?: string[]
          id?: string
          incident_type: string
          resolved_at?: string | null
          severity?: string
          target_ip?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_taken?: string
          auto_resolved?: boolean
          created_at?: string
          details?: Json
          event_ids?: string[]
          id?: string
          incident_type?: string
          resolved_at?: string | null
          severity?: string
          target_ip?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      installed_personas: {
        Row: {
          id: string
          installed_at: string
          persona_id: string
          user_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          persona_id: string
          user_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          persona_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installed_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "shared_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_plugins: {
        Row: {
          config: Json
          id: string
          installed_at: string
          plugin_id: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          installed_at?: string
          plugin_id: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          installed_at?: string
          plugin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installed_plugins_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      library_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_entries: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sources: Json | null
          truth_score: string | null
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
          truth_score?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
          truth_score?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      nomad_entities: {
        Row: {
          confidence: number | null
          created_at: string
          entity_type: string
          entity_value: string
          id: string
          investigation_id: string
          source: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          entity_type: string
          entity_value: string
          id?: string
          investigation_id: string
          source?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          entity_type?: string
          entity_value?: string
          id?: string
          investigation_id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomad_entities_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "nomad_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      nomad_investigations: {
        Row: {
          created_at: string
          entities_found: Json | null
          findings: string
          id: string
          investigation_type: string | null
          query: string
          sources_checked: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entities_found?: Json | null
          findings: string
          id?: string
          investigation_type?: string | null
          query: string
          sources_checked?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          entities_found?: Json | null
          findings?: string
          id?: string
          investigation_type?: string | null
          query?: string
          sources_checked?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      notebook_cells: {
        Row: {
          cell_type: string
          config: Json
          content: string
          created_at: string
          id: string
          notebook_id: string
          output: string | null
          position: number
          updated_at: string
        }
        Insert: {
          cell_type?: string
          config?: Json
          content?: string
          created_at?: string
          id?: string
          notebook_id: string
          output?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          cell_type?: string
          config?: Json
          content?: string
          created_at?: string
          id?: string
          notebook_id?: string
          output?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_cells_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_comments: {
        Row: {
          cell_id: string | null
          content: string
          created_at: string
          id: string
          notebook_id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          cell_id?: string | null
          content: string
          created_at?: string
          id?: string
          notebook_id: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          cell_id?: string | null
          content?: string
          created_at?: string
          id?: string
          notebook_id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_comments_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "notebook_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_comments_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notebook_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_shares: {
        Row: {
          created_at: string
          id: string
          notebook_id: string
          permission: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notebook_id: string
          permission?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notebook_id?: string
          permission?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebook_shares_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_shares_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_versions: {
        Row: {
          change_summary: string
          changed_by: string
          created_at: string
          id: string
          notebook_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_summary?: string
          changed_by: string
          created_at?: string
          id?: string
          notebook_id: string
          snapshot?: Json
          version: number
        }
        Update: {
          change_summary?: string
          changed_by?: string
          created_at?: string
          id?: string
          notebook_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebook_versions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          created_at: string
          description: string
          id: string
          last_run_at: string | null
          owner_id: string
          schedule: string | null
          status: string
          tags: string[]
          team_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          last_run_at?: string | null
          owner_id: string
          schedule?: string | null
          status?: string
          tags?: string[]
          team_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          last_run_at?: string | null
          owner_id?: string
          schedule?: string | null
          status?: string
          tags?: string[]
          team_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          author: string
          category: string
          config_schema: Json
          created_at: string
          description: string
          downloads: number
          icon: string
          id: string
          is_premium: boolean
          name: string
          price_cents: number
          rating: number
          version: string
        }
        Insert: {
          author?: string
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string
          downloads?: number
          icon?: string
          id?: string
          is_premium?: boolean
          name: string
          price_cents?: number
          rating?: number
          version?: string
        }
        Update: {
          author?: string
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string
          downloads?: number
          icon?: string
          id?: string
          is_premium?: boolean
          name?: string
          price_cents?: number
          rating?: number
          version?: string
        }
        Relationships: []
      }
      prediction_history: {
        Row: {
          company: string
          created_at: string
          event_date: string
          event_description: string
          event_type: string
          id: string
          lead_time_days: number | null
          prediction_confidence: number | null
          prediction_made_at: string | null
          signals_detected: Json
          was_predicted: boolean
        }
        Insert: {
          company: string
          created_at?: string
          event_date: string
          event_description: string
          event_type: string
          id?: string
          lead_time_days?: number | null
          prediction_confidence?: number | null
          prediction_made_at?: string | null
          signals_detected?: Json
          was_predicted?: boolean
        }
        Update: {
          company?: string
          created_at?: string
          event_date?: string
          event_description?: string
          event_type?: string
          id?: string
          lead_time_days?: number | null
          prediction_confidence?: number | null
          prediction_made_at?: string | null
          signals_detected?: Json
          was_predicted?: boolean
        }
        Relationships: []
      }
      prediction_signals: {
        Row: {
          credibility_score: number
          detected_at: string
          id: string
          prediction_id: string | null
          relevance_score: number
          search_query: string
          signal_category: string
          signal_type: string
          source_date: string | null
          source_domain: string | null
          source_snippet: string
          source_title: string
          source_url: string
          weight: number
        }
        Insert: {
          credibility_score: number
          detected_at?: string
          id?: string
          prediction_id?: string | null
          relevance_score: number
          search_query: string
          signal_category: string
          signal_type: string
          source_date?: string | null
          source_domain?: string | null
          source_snippet: string
          source_title: string
          source_url: string
          weight: number
        }
        Update: {
          credibility_score?: number
          detected_at?: string
          id?: string
          prediction_id?: string | null
          relevance_score?: number
          search_query?: string
          signal_category?: string
          signal_type?: string
          source_date?: string | null
          source_domain?: string | null
          source_snippet?: string
          source_title?: string
          source_url?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_signals_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          company: string
          confidence: number
          created_at: string
          estimated_date: string
          event_type: string
          historical_comparison: Json | null
          id: string
          outcome: string | null
          outcome_date: string | null
          prediction_text: string
          reasoning_chain: Json
          session_id: string | null
          severity: string
          signals: Json
          status: string
          time_horizon: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          confidence: number
          created_at?: string
          estimated_date: string
          event_type: string
          historical_comparison?: Json | null
          id?: string
          outcome?: string | null
          outcome_date?: string | null
          prediction_text: string
          reasoning_chain?: Json
          session_id?: string | null
          severity: string
          signals?: Json
          status?: string
          time_horizon: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          confidence?: number
          created_at?: string
          estimated_date?: string
          event_type?: string
          historical_comparison?: Json | null
          id?: string
          outcome?: string | null
          outcome_date?: string | null
          prediction_text?: string
          reasoning_chain?: Json
          session_id?: string | null
          severity?: string
          signals?: Json
          status?: string
          time_horizon?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string
          files: string[]
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          files?: string[]
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          files?: string[]
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_tracking: {
        Row: {
          blocked: boolean
          created_at: string
          endpoint: string
          id: string
          identifier: string
          identifier_type: string
          request_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          identifier_type?: string
          request_count?: number
          window_end?: string
          window_start?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          identifier_type?: string
          request_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      saved_prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          starred: boolean
          tags: string[]
          title: string
          usage_count: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          starred?: boolean
          tags?: string[]
          title: string
          usage_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          starred?: boolean
          tags?: string[]
          title?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action_taken: string
          created_at: string
          detection_rule: string
          event_type: string
          fingerprint: string | null
          geo_city: string | null
          geo_country: string | null
          id: string
          metadata: Json
          payload_snippet: string | null
          request_method: string | null
          request_path: string | null
          severity: string
          source_ip: string | null
          user_agent: string | null
        }
        Insert: {
          action_taken?: string
          created_at?: string
          detection_rule: string
          event_type?: string
          fingerprint?: string | null
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          metadata?: Json
          payload_snippet?: string | null
          request_method?: string | null
          request_path?: string | null
          severity?: string
          source_ip?: string | null
          user_agent?: string | null
        }
        Update: {
          action_taken?: string
          created_at?: string
          detection_rule?: string
          event_type?: string
          fingerprint?: string | null
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          metadata?: Json
          payload_snippet?: string | null
          request_method?: string | null
          request_path?: string | null
          severity?: string
          source_ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      shared_personas: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          installs: number
          is_public: boolean
          name: string
          rating: number
          system_prompt: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          installs?: number
          is_public?: boolean
          name: string
          rating?: number
          system_prompt?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          installs?: number
          is_public?: boolean
          name?: string
          rating?: number
          system_prompt?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_definitions: {
        Row: {
          accuracy_rate: number | null
          base_weight: number
          created_at: string
          detection_frequency: string
          enabled: boolean
          event_type: string
          exclude_keywords: string[] | null
          false_positive_rate: number | null
          id: string
          keywords: string[]
          search_queries: string[]
          signal_name: string
          signal_type: string
        }
        Insert: {
          accuracy_rate?: number | null
          base_weight: number
          created_at?: string
          detection_frequency: string
          enabled?: boolean
          event_type: string
          exclude_keywords?: string[] | null
          false_positive_rate?: number | null
          id?: string
          keywords: string[]
          search_queries: string[]
          signal_name: string
          signal_type: string
        }
        Update: {
          accuracy_rate?: number | null
          base_weight?: number
          created_at?: string
          detection_frequency?: string
          enabled?: boolean
          event_type?: string
          exclude_keywords?: string[] | null
          false_positive_rate?: number | null
          id?: string
          keywords?: string[]
          search_queries?: string[]
          signal_name?: string
          signal_type?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      threat_intelligence: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          hit_count: number
          id: string
          indicator_type: string
          indicator_value: string
          is_active: boolean
          last_seen: string | null
          metadata: Json
          source: string
          threat_category: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          indicator_type?: string
          indicator_value: string
          is_active?: boolean
          last_seen?: string | null
          metadata?: Json
          source?: string
          threat_category?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          indicator_type?: string
          indicator_value?: string
          is_active?: boolean
          last_seen?: string | null
          metadata?: Json
          source?: string
          threat_category?: string
        }
        Relationships: []
      }
      tracker_devices: {
        Row: {
          created_at: string
          device_name: string
          id: string
          last_seen: string | null
          pairing_token: string | null
          pairing_token_expires_at: string | null
          phone_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string
          id?: string
          last_seen?: string | null
          pairing_token?: string | null
          pairing_token_expires_at?: string | null
          phone_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string
          id?: string
          last_seen?: string | null
          pairing_token?: string | null
          pairing_token_expires_at?: string | null
          phone_number?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tracker_locations: {
        Row: {
          accuracy: number | null
          address: string | null
          device_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          device_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          device_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_locations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "tracker_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_stats: {
        Row: {
          chat_prompts: number
          code_prompts: number
          created_at: string
          id: string
          last_active_date: string | null
          research_prompts: number
          streak_days: number
          total_prompts: number
          truth_prompts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_prompts?: number
          code_prompts?: number
          created_at?: string
          id?: string
          last_active_date?: string | null
          research_prompts?: number
          streak_days?: number
          total_prompts?: number
          truth_prompts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_prompts?: number
          code_prompts?: number
          created_at?: string
          id?: string
          last_active_date?: string | null
          research_prompts?: number
          streak_days?: number
          total_prompts?: number
          truth_prompts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_behavior_analytics: {
        Row: {
          anomaly_details: string | null
          avg_response_time_ms: number | null
          behavior_type: string
          created_at: string
          device_info: Json
          geo_location: string | null
          id: string
          period_end: string
          period_start: string
          request_count: number
          risk_score: number
          session_fingerprint: string | null
          unique_endpoints: number
          user_id: string
        }
        Insert: {
          anomaly_details?: string | null
          avg_response_time_ms?: number | null
          behavior_type?: string
          created_at?: string
          device_info?: Json
          geo_location?: string | null
          id?: string
          period_end?: string
          period_start?: string
          request_count?: number
          risk_score?: number
          session_fingerprint?: string | null
          unique_endpoints?: number
          user_id: string
        }
        Update: {
          anomaly_details?: string | null
          avg_response_time_ms?: number | null
          behavior_type?: string
          created_at?: string
          device_info?: Json
          geo_location?: string | null
          id?: string
          period_end?: string
          period_start?: string
          request_count?: number
          risk_score?: number
          session_fingerprint?: string | null
          unique_endpoints?: number
          user_id?: string
        }
        Relationships: []
      }
      user_intelligence_profile: {
        Row: {
          active_hours: string[]
          created_at: string
          depth_auto: string
          id: string
          inferred_traits: Json
          tone_preference: string
          topics_of_interest: string[]
          total_calibrations: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_hours?: string[]
          created_at?: string
          depth_auto?: string
          id?: string
          inferred_traits?: Json
          tone_preference?: string
          topics_of_interest?: string[]
          total_calibrations?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_hours?: string[]
          created_at?: string
          depth_auto?: string
          id?: string
          inferred_traits?: Json
          tone_preference?: string
          topics_of_interest?: string[]
          total_calibrations?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          memory_enabled: boolean
          response_depth: string
          response_length: string
          theme: string
          updated_at: string
          user_id: string
          wallpaper: string
          web_search_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          memory_enabled?: boolean
          response_depth?: string
          response_length?: string
          theme?: string
          updated_at?: string
          user_id: string
          wallpaper?: string
          web_search_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          memory_enabled?: boolean
          response_depth?: string
          response_length?: string
          theme?: string
          updated_at?: string
          user_id?: string
          wallpaper?: string
          web_search_enabled?: boolean
        }
        Relationships: []
      }
      zali_components: {
        Row: {
          compatible_names: string[] | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          lead_days: number | null
          name: string
          reused: number | null
          success_rate: number | null
          supplier: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          compatible_names?: string[] | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_days?: number | null
          name: string
          reused?: number | null
          success_rate?: number | null
          supplier?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          compatible_names?: string[] | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_days?: number | null
          name?: string
          reused?: number | null
          success_rate?: number | null
          supplier?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zali_materials: {
        Row: {
          avg_cost: number | null
          category: string
          created_at: string
          failure_mode: string | null
          id: string
          name: string
          notes: string | null
          success_rate: number | null
          sustainability: string | null
          times_used: number | null
          top_use: string | null
          trend: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number | null
          category?: string
          created_at?: string
          failure_mode?: string | null
          id?: string
          name: string
          notes?: string | null
          success_rate?: number | null
          sustainability?: string | null
          times_used?: number | null
          top_use?: string | null
          trend?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number | null
          category?: string
          created_at?: string
          failure_mode?: string | null
          id?: string
          name?: string
          notes?: string | null
          success_rate?: number | null
          sustainability?: string | null
          times_used?: number | null
          top_use?: string | null
          trend?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zali_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zali_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zali_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zali_mfg_results: {
        Row: {
          analysis_type: string
          created_at: string
          id: string
          project_name: string
          results: Json | null
          user_id: string
        }
        Insert: {
          analysis_type?: string
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      zali_optimization_results: {
        Row: {
          created_at: string
          id: string
          project_name: string
          results: Json | null
          user_id: string
          weights: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id: string
          weights?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id?: string
          weights?: Json | null
        }
        Relationships: []
      }
      zali_projects: {
        Row: {
          cost_analysis: Json | null
          created_at: string
          description: string | null
          design_type: string | null
          id: string
          manufacturing: Json | null
          name: string
          phase: string | null
          research_domains: Json | null
          simulation_results: Json | null
          specifications: Json | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_analysis?: Json | null
          created_at?: string
          description?: string | null
          design_type?: string | null
          id?: string
          manufacturing?: Json | null
          name: string
          phase?: string | null
          research_domains?: Json | null
          simulation_results?: Json | null
          specifications?: Json | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_analysis?: Json | null
          created_at?: string
          description?: string | null
          design_type?: string | null
          id?: string
          manufacturing?: Json | null
          name?: string
          phase?: string | null
          research_domains?: Json | null
          simulation_results?: Json | null
          specifications?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zali_research: {
        Row: {
          confidence: number | null
          content: string | null
          created_at: string
          domain: string
          id: string
          project_id: string
          sources: Json | null
          title: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          content?: string | null
          created_at?: string
          domain: string
          id?: string
          project_id: string
          sources?: Json | null
          title: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          content?: string | null
          created_at?: string
          domain?: string
          id?: string
          project_id?: string
          sources?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zali_research_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zali_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zali_simulation_results: {
        Row: {
          created_at: string
          id: string
          project_name: string
          results: Json | null
          sim_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          sim_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          sim_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_role: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
      }
      has_notebook_share: {
        Args: { _notebook_id: string; _user_id: string }
        Returns: boolean
      }
      is_notebook_owner: {
        Args: { _notebook_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      notebook_team_id: { Args: { _notebook_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
