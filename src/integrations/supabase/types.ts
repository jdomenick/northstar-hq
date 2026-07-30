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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          organization_id: string
          summary: string | null
          venture_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          summary?: string | null
          venture_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          summary?: string | null
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_collection_items: {
        Row: {
          added_by: string | null
          collection_id: string
          created_at: string
          display_order: number
          id: string
          media_asset_id: string
          organization_id: string
        }
        Insert: {
          added_by?: string | null
          collection_id: string
          created_at?: string
          display_order?: number
          id?: string
          media_asset_id: string
          organization_id: string
        }
        Update: {
          added_by?: string | null
          collection_id?: string
          created_at?: string
          display_order?: number
          id?: string
          media_asset_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "asset_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_collection_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "content_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_collection_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_collections: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          scope: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          scope?: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          scope?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_collections_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_favorites: {
        Row: {
          created_at: string
          id: string
          media_asset_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_asset_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_asset_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_favorites_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "content_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_favorites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_folders: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          owner_user_id: string | null
          parent_folder_id: string | null
          scope: string
          slug: string | null
          sort_order: number
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          parent_folder_id?: string | null
          scope?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          parent_folder_id?: string | null
          scope?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_folders_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          label: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          label: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type: string
          automation_mode: string
          created_at: string
          criticality: string
          deleted_at: string | null
          description: string | null
          display_name: string
          freshness: string
          health: string
          id: string
          last_activity_at: string | null
          metadata: Json
          organization_id: string
          owner_user_id: string | null
          status: string
          tags: string[]
          trust_level: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          asset_type: string
          automation_mode?: string
          created_at?: string
          criticality?: string
          deleted_at?: string | null
          description?: string | null
          display_name: string
          freshness?: string
          health?: string
          id?: string
          last_activity_at?: string | null
          metadata?: Json
          organization_id: string
          owner_user_id?: string | null
          status?: string
          tags?: string[]
          trust_level?: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          asset_type?: string
          automation_mode?: string
          created_at?: string
          criticality?: string
          deleted_at?: string | null
          description?: string | null
          display_name?: string
          freshness?: string
          health?: string
          id?: string
          last_activity_at?: string | null
          metadata?: Json
          organization_id?: string
          owner_user_id?: string | null
          status?: string
          tags?: string[]
          trust_level?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_fkey"
            columns: ["asset_type"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_definitions: {
        Row: {
          asset_id: string | null
          automation_family: string
          automation_key: string
          configuration: Json
          consecutive_failures: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          enabled: boolean
          id: string
          integration_connection_id: string | null
          last_failure_at: string | null
          last_run_at: string | null
          last_success_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          owner_id: string | null
          policy: Json
          priority: string
          schedule_expression: string | null
          status: string
          timezone: string
          trigger_type: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          asset_id?: string | null
          automation_family: string
          automation_key: string
          configuration?: Json
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          integration_connection_id?: string | null
          last_failure_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          owner_id?: string | null
          policy?: Json
          priority?: string
          schedule_expression?: string | null
          status?: string
          timezone?: string
          trigger_type?: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          asset_id?: string | null
          automation_family?: string
          automation_key?: string
          configuration?: Json
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          integration_connection_id?: string | null
          last_failure_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          owner_id?: string | null
          policy?: Json
          priority?: string
          schedule_expression?: string | null
          status?: string
          timezone?: string
          trigger_type?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_definitions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_definitions_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_definitions_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_health_snapshots: {
        Row: {
          automation_definition_id: string | null
          calculated_at: string
          created_at: string
          health_band: string
          health_score: number
          id: string
          organization_id: string
          signal_breakdown: Json
          venture_id: string | null
          version: string
        }
        Insert: {
          automation_definition_id?: string | null
          calculated_at?: string
          created_at?: string
          health_band: string
          health_score: number
          id?: string
          organization_id: string
          signal_breakdown?: Json
          venture_id?: string | null
          version?: string
        }
        Update: {
          automation_definition_id?: string | null
          calculated_at?: string
          created_at?: string
          health_band?: string
          health_score?: number
          id?: string
          organization_id?: string
          signal_breakdown?: Json
          venture_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_health_snapshots_automation_definition_id_fkey"
            columns: ["automation_definition_id"]
            isOneToOne: false
            referencedRelation: "automation_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_health_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_health_snapshots_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_job_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          external_reference: string | null
          id: string
          input_summary: Json
          job_id: string
          metadata: Json
          organization_id: string
          output_summary: Json
          provider: string | null
          started_at: string
          status: string
          worker_id: string | null
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          external_reference?: string | null
          id?: string
          input_summary?: Json
          job_id: string
          metadata?: Json
          organization_id: string
          output_summary?: Json
          provider?: string | null
          started_at?: string
          status?: string
          worker_id?: string | null
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          external_reference?: string | null
          id?: string
          input_summary?: Json
          job_id?: string
          metadata?: Json
          organization_id?: string
          output_summary?: Json
          provider?: string | null
          started_at?: string
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_job_dependencies: {
        Row: {
          created_at: string
          dependency_type: string
          depends_on_job_id: string
          id: string
          job_id: string
          organization_id: string
          required_status: string | null
        }
        Insert: {
          created_at?: string
          dependency_type?: string
          depends_on_job_id: string
          id?: string
          job_id: string
          organization_id: string
          required_status?: string | null
        }
        Update: {
          created_at?: string
          dependency_type?: string
          depends_on_job_id?: string
          id?: string
          job_id?: string
          organization_id?: string
          required_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_dependencies_depends_on_job_id_fkey"
            columns: ["depends_on_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_dependencies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_dependencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_job_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_key: string | null
          event_type: string
          id: string
          job_id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: string
          job_id: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: string
          job_id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_job_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          actor_type: string
          asset_id: string | null
          attempt_number: number
          automation_definition_id: string | null
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          handler_version: string
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          input_payload: Json
          integration_connection_id: string | null
          integration_source_id: string | null
          job_family: string
          job_type: string
          lease_expires_at: string | null
          max_attempts: number
          organization_id: string
          output_summary: Json
          parent_job_id: string | null
          policy_version: string
          priority: string
          retry_after: string | null
          root_job_id: string | null
          scheduled_for: string
          started_at: string | null
          status: string
          timeout_seconds: number
          trigger_type: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          actor_type?: string
          asset_id?: string | null
          attempt_number?: number
          automation_definition_id?: string | null
          available_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          handler_version?: string
          heartbeat_at?: string | null
          id?: string
          idempotency_key: string
          input_payload?: Json
          integration_connection_id?: string | null
          integration_source_id?: string | null
          job_family: string
          job_type: string
          lease_expires_at?: string | null
          max_attempts?: number
          organization_id: string
          output_summary?: Json
          parent_job_id?: string | null
          policy_version?: string
          priority?: string
          retry_after?: string | null
          root_job_id?: string | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          timeout_seconds?: number
          trigger_type?: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          actor_type?: string
          asset_id?: string | null
          attempt_number?: number
          automation_definition_id?: string | null
          available_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          handler_version?: string
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string
          input_payload?: Json
          integration_connection_id?: string | null
          integration_source_id?: string | null
          job_family?: string
          job_type?: string
          lease_expires_at?: string | null
          max_attempts?: number
          organization_id?: string
          output_summary?: Json
          parent_job_id?: string | null
          policy_version?: string
          priority?: string
          retry_after?: string | null
          root_job_id?: string | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          timeout_seconds?: number
          trigger_type?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_automation_definition_id_fkey"
            columns: ["automation_definition_id"]
            isOneToOne: false
            referencedRelation: "automation_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_integration_connection_id_fkey"
            columns: ["integration_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_integration_source_id_fkey"
            columns: ["integration_source_id"]
            isOneToOne: false
            referencedRelation: "integration_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_root_job_id_fkey"
            columns: ["root_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          livemode: boolean
          metadata: Json
          name: string | null
          organization_id: string
          stripe_customer_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          livemode?: boolean
          metadata?: Json
          name?: string | null
          organization_id: string
          stripe_customer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          livemode?: boolean
          metadata?: Json
          name?: string | null
          organization_id?: string
          stripe_customer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          client_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          id: string
          invoice_id: string | null
          organization_id: string
          payload: Json
          proposal_id: string | null
          subscription_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          client_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          id?: string
          invoice_id?: string | null
          organization_id: string
          payload?: Json
          proposal_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          client_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["billing_event_type"]
          id?: string
          invoice_id?: string | null
          organization_id?: string
          payload?: Json
          proposal_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_cents: number
          amount_paid_cents: number
          client_id: string
          collection_method: Database["public"]["Enums"]["billing_collection_method"]
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          due_at: string | null
          finalized_at: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf_url: string | null
          livemode: boolean
          metadata: Json
          organization_id: string
          paid_at: string | null
          proposal_id: string | null
          proposal_version: number | null
          refunded_amount_cents: number
          status: Database["public"]["Enums"]["billing_invoice_status"]
          stripe_invoice_id: string
          stripe_payment_intent_id: string | null
          type: Database["public"]["Enums"]["billing_invoice_type"]
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_cents: number
          amount_paid_cents?: number
          client_id: string
          collection_method?: Database["public"]["Enums"]["billing_collection_method"]
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          due_at?: string | null
          finalized_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          livemode?: boolean
          metadata?: Json
          organization_id: string
          paid_at?: string | null
          proposal_id?: string | null
          proposal_version?: number | null
          refunded_amount_cents?: number
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          stripe_invoice_id: string
          stripe_payment_intent_id?: string | null
          type: Database["public"]["Enums"]["billing_invoice_type"]
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_cents?: number
          amount_paid_cents?: number
          client_id?: string
          collection_method?: Database["public"]["Enums"]["billing_collection_method"]
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          due_at?: string | null
          finalized_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf_url?: string | null
          livemode?: boolean
          metadata?: Json
          organization_id?: string
          paid_at?: string | null
          proposal_id?: string | null
          proposal_version?: number | null
          refunded_amount_cents?: number
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          stripe_invoice_id?: string
          stripe_payment_intent_id?: string | null
          type?: Database["public"]["Enums"]["billing_invoice_type"]
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          invoice_id: string
          livemode: boolean
          metadata: Json
          organization_id: string
          paid_at: string | null
          receipt_url: string | null
          refunded_amount_cents: number
          refunded_at: string | null
          status: Database["public"]["Enums"]["billing_payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          invoice_id: string
          livemode?: boolean
          metadata?: Json
          organization_id: string
          paid_at?: string | null
          receipt_url?: string | null
          refunded_amount_cents?: number
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["billing_payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          livemode?: boolean
          metadata?: Json
          organization_id?: string
          paid_at?: string | null
          receipt_url?: string | null
          refunded_amount_cents?: number
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["billing_payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          amount_cents: number
          cancel_at: string | null
          canceled_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          customer_id: string | null
          id: string
          interval: string
          livemode: boolean
          metadata: Json
          organization_id: string
          proposal_id: string | null
          proposal_version: number | null
          status: Database["public"]["Enums"]["billing_subscription_status"]
          stripe_price_id: string | null
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cancel_at?: string | null
          canceled_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string | null
          id?: string
          interval?: string
          livemode?: boolean
          metadata?: Json
          organization_id: string
          proposal_id?: string | null
          proposal_version?: number | null
          status?: Database["public"]["Enums"]["billing_subscription_status"]
          stripe_price_id?: string | null
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cancel_at?: string | null
          canceled_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string | null
          id?: string
          interval?: string
          livemode?: boolean
          metadata?: Json
          organization_id?: string
          proposal_id?: string | null
          proposal_version?: number | null
          status?: Database["public"]["Enums"]["billing_subscription_status"]
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          livemode: boolean
          payload: Json
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["billing_webhook_processing_status"]
          received_at: string
          stripe_event_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          livemode?: boolean
          payload: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["billing_webhook_processing_status"]
          received_at?: string
          stripe_event_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          livemode?: boolean
          payload?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["billing_webhook_processing_status"]
          received_at?: string
          stripe_event_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          invited_by: string | null
          last_login_at: string | null
          last_name: string
          organization_id: string
          phone: string | null
          preferred_contact_method: string
          role: Database["public"]["Enums"]["client_account_role"]
          status: Database["public"]["Enums"]["client_account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          last_name?: string
          organization_id: string
          phone?: string | null
          preferred_contact_method?: string
          role?: Database["public"]["Enums"]["client_account_role"]
          status?: Database["public"]["Enums"]["client_account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          last_name?: string
          organization_id?: string
          phone?: string | null
          preferred_contact_method?: string
          role?: Database["public"]["Enums"]["client_account_role"]
          status?: Database["public"]["Enums"]["client_account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_audit_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          client_account_id: string | null
          client_id: string | null
          created_at: string
          event_type: string
          id: string
          invitation_id: string | null
          metadata: Json
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          client_account_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          invitation_id?: string | null
          metadata?: Json
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          client_account_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          invitation_id?: string | null
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_audit_events_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_audit_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_audit_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "client_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_company_profiles: {
        Row: {
          address_line1: string
          address_line2: string
          billing_contact_email: string
          billing_contact_name: string
          billing_contact_phone: string
          business_hours: string
          city: string
          client_id: string
          country: string
          created_at: string
          id: string
          legal_business_name: string
          operating_name: string
          organization_id: string
          postal_code: string
          preferred_communication_method: string
          primary_contact_email: string
          primary_contact_name: string
          primary_contact_phone: string
          primary_email: string
          primary_phone: string
          region: string
          service_area: string
          updated_at: string
          updated_by: string | null
          website_url: string
        }
        Insert: {
          address_line1?: string
          address_line2?: string
          billing_contact_email?: string
          billing_contact_name?: string
          billing_contact_phone?: string
          business_hours?: string
          city?: string
          client_id: string
          country?: string
          created_at?: string
          id?: string
          legal_business_name?: string
          operating_name?: string
          organization_id: string
          postal_code?: string
          preferred_communication_method?: string
          primary_contact_email?: string
          primary_contact_name?: string
          primary_contact_phone?: string
          primary_email?: string
          primary_phone?: string
          region?: string
          service_area?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          billing_contact_email?: string
          billing_contact_name?: string
          billing_contact_phone?: string
          business_hours?: string
          city?: string
          client_id?: string
          country?: string
          created_at?: string
          id?: string
          legal_business_name?: string
          operating_name?: string
          organization_id?: string
          postal_code?: string
          preferred_communication_method?: string
          primary_contact_email?: string
          primary_contact_name?: string
          primary_contact_phone?: string
          primary_email?: string
          primary_phone?: string
          region?: string
          service_area?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_company_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_company_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_delivery_milestones: {
        Row: {
          client_id: string
          client_visible: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          organization_id: string
          project_id: string
          requires_client_action: boolean
          sort_order: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          organization_id: string
          project_id: string
          requires_client_action?: boolean
          sort_order?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          organization_id?: string
          project_id?: string
          requires_client_action?: boolean
          sort_order?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_delivery_milestones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_delivery_milestones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_delivery_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          deliverable_status: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          id: string
          instructions: string
          is_deliverable: boolean
          is_required: boolean
          milestone_id: string | null
          onboarding_item_id: string | null
          organization_id: string
          project_id: string | null
          requested_by: string | null
          requires_client_review: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          revision_note: string
          revision_reason: string
          shared_at: string | null
          status: Database["public"]["Enums"]["client_document_status"]
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          version_label: string
          visibility: Database["public"]["Enums"]["client_document_visibility"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          deliverable_status?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          instructions?: string
          is_deliverable?: boolean
          is_required?: boolean
          milestone_id?: string | null
          onboarding_item_id?: string | null
          organization_id: string
          project_id?: string | null
          requested_by?: string | null
          requires_client_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_note?: string
          revision_reason?: string
          shared_at?: string | null
          status?: Database["public"]["Enums"]["client_document_status"]
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_label?: string
          visibility?: Database["public"]["Enums"]["client_document_visibility"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          deliverable_status?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          instructions?: string
          is_deliverable?: boolean
          is_required?: boolean
          milestone_id?: string | null
          onboarding_item_id?: string | null
          organization_id?: string
          project_id?: string | null
          requested_by?: string | null
          requires_client_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_note?: string
          revision_reason?: string
          shared_at?: string | null
          status?: Database["public"]["Enums"]["client_document_status"]
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_label?: string
          visibility?: Database["public"]["Enums"]["client_document_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "client_delivery_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_onboarding_item_id_fkey"
            columns: ["onboarding_item_id"]
            isOneToOne: false
            referencedRelation: "client_onboarding_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_executive_reports: {
        Row: {
          business_notes: string
          client_id: string
          created_at: string
          created_by: string | null
          highlights: Json
          id: string
          organization_id: string
          summary: string
          version: number
        }
        Insert: {
          business_notes?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          highlights?: Json
          id?: string
          organization_id: string
          summary?: string
          version: number
        }
        Update: {
          business_notes?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          highlights?: Json
          id?: string
          organization_id?: string
          summary?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_executive_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_executive_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          accepted_account_id: string | null
          accepted_at: string | null
          client_id: string
          created_at: string
          email: string
          expires_at: string
          first_name: string
          id: string
          invited_by: string | null
          last_name: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["client_account_role"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_account_id?: string | null
          accepted_at?: string | null
          client_id: string
          created_at?: string
          email: string
          expires_at: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_name?: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["client_account_role"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_account_id?: string | null
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          invited_by?: string | null
          last_name?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["client_account_role"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_accepted_account_id_fkey"
            columns: ["accepted_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_items: {
        Row: {
          blocked_reason: string
          client_id: string
          client_response: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          instructions: string
          is_required: boolean
          item_type: Database["public"]["Enums"]["client_onboarding_item_type"]
          organization_id: string
          owner: Database["public"]["Enums"]["client_onboarding_owner"]
          requires_document: boolean
          requires_review: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          revision_note: string
          sort_order: number
          status: Database["public"]["Enums"]["client_onboarding_status"]
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          blocked_reason?: string
          client_id: string
          client_response?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string
          is_required?: boolean
          item_type?: Database["public"]["Enums"]["client_onboarding_item_type"]
          organization_id: string
          owner?: Database["public"]["Enums"]["client_onboarding_owner"]
          requires_document?: boolean
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_note?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["client_onboarding_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          blocked_reason?: string
          client_id?: string
          client_response?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string
          is_required?: boolean
          item_type?: Database["public"]["Enums"]["client_onboarding_item_type"]
          organization_id?: string
          owner?: Database["public"]["Enums"]["client_onboarding_owner"]
          requires_document?: boolean
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_note?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["client_onboarding_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_outcome_metrics: {
        Row: {
          client_id: string
          client_visible: boolean
          created_at: string
          id: string
          label: string
          metric_key: string
          organization_id: string
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          sort_order: number
          source_label: string
          updated_at: string
          value_numeric: number
          value_unit: string
        }
        Insert: {
          client_id: string
          client_visible?: boolean
          created_at?: string
          id?: string
          label: string
          metric_key: string
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          sort_order?: number
          source_label?: string
          updated_at?: string
          value_numeric: number
          value_unit?: string
        }
        Update: {
          client_id?: string
          client_visible?: boolean
          created_at?: string
          id?: string
          label?: string
          metric_key?: string
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          sort_order?: number
          source_label?: string
          updated_at?: string
          value_numeric?: number
          value_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_outcome_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_outcome_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_workspace_events: {
        Row: {
          body: string
          client_id: string
          created_at: string
          document_id: string | null
          event_type: string
          id: string
          invoice_id: string | null
          is_notice: boolean
          occurred_at: string
          onboarding_item_id: string | null
          organization_id: string
          source_key: string | null
          title: string
        }
        Insert: {
          body?: string
          client_id: string
          created_at?: string
          document_id?: string | null
          event_type: string
          id?: string
          invoice_id?: string | null
          is_notice?: boolean
          occurred_at?: string
          onboarding_item_id?: string | null
          organization_id: string
          source_key?: string | null
          title: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          document_id?: string | null
          event_type?: string
          id?: string
          invoice_id?: string | null
          is_notice?: boolean
          occurred_at?: string
          onboarding_item_id?: string | null
          organization_id?: string
          source_key?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_workspace_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workspace_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workspace_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workspace_events_onboarding_item_id_fkey"
            columns: ["onboarding_item_id"]
            isOneToOne: false
            referencedRelation: "client_onboarding_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_workspace_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string
          original_due_date: string | null
          owner_user_id: string | null
          postponement_count: number
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          status: Database["public"]["Enums"]["commitment_status"]
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          original_due_date?: string | null
          owner_user_id?: string | null
          postponement_count?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["commitment_status"]
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          original_due_date?: string | null
          owner_user_id?: string | null
          postponement_count?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["commitment_status"]
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_evergreen_topics: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          organization_id: string
          slug: string
          sort_order: number
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          organization_id: string
          slug: string
          sort_order?: number
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          organization_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_evergreen_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_evergreen_topics_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_learnings: {
        Row: {
          audience_segment: string | null
          baseline_metric: number | null
          confidence: number | null
          content_pillar: string | null
          created_at: string
          created_by: string | null
          cta: string | null
          engine_version: string
          evidence_refs: Json
          format: string | null
          hook_pattern: string | null
          id: string
          observed_delta: number | null
          observed_metric: string
          organization_id: string
          platform: string | null
          publishing_time_bucket: string | null
          recommendation: string | null
          sample_size: number
          superseded_by: string | null
          topic: string | null
          updated_at: string
          valid_from: string
          valid_until: string | null
          venture_id: string
        }
        Insert: {
          audience_segment?: string | null
          baseline_metric?: number | null
          confidence?: number | null
          content_pillar?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string | null
          engine_version?: string
          evidence_refs?: Json
          format?: string | null
          hook_pattern?: string | null
          id?: string
          observed_delta?: number | null
          observed_metric: string
          organization_id: string
          platform?: string | null
          publishing_time_bucket?: string | null
          recommendation?: string | null
          sample_size?: number
          superseded_by?: string | null
          topic?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          venture_id: string
        }
        Update: {
          audience_segment?: string | null
          baseline_metric?: number | null
          confidence?: number | null
          content_pillar?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string | null
          engine_version?: string
          evidence_refs?: Json
          format?: string | null
          hook_pattern?: string | null
          id?: string
          observed_delta?: number | null
          observed_metric?: string
          organization_id?: string
          platform?: string | null
          publishing_time_bucket?: string | null
          recommendation?: string | null
          sample_size?: number
          superseded_by?: string | null
          topic?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_learnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_learnings_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "content_learnings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_learnings_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_media_assets: {
        Row: {
          alt_text: string | null
          approved_at: string | null
          approved_by: string | null
          archived: boolean
          aspect_ratio: string | null
          campaign_id: string | null
          caption: string | null
          checksum_sha256: string | null
          created_at: string
          creative_brief: string | null
          creative_notes: string | null
          credit: string | null
          deleted_at: string | null
          display_name: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          folder_id: string | null
          generated_at: string | null
          generation_model: string | null
          generation_negative_prompt: string | null
          generation_parameters: Json | null
          generation_prompt: string | null
          generation_seed: string | null
          generation_version: number | null
          height_px: number | null
          id: string
          last_used_at: string | null
          media_type: string
          mime_type: string | null
          organization_id: string
          original_filename: string | null
          review_state: string
          source: string
          status: string
          storage_bucket: string
          storage_path: string | null
          suggested_alt_text: string | null
          tags: string[]
          updated_at: string
          upload_error: string | null
          upload_started_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          venture_id: string
          width_px: number | null
        }
        Insert: {
          alt_text?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived?: boolean
          aspect_ratio?: string | null
          campaign_id?: string | null
          caption?: string | null
          checksum_sha256?: string | null
          created_at?: string
          creative_brief?: string | null
          creative_notes?: string | null
          credit?: string | null
          deleted_at?: string | null
          display_name?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          folder_id?: string | null
          generated_at?: string | null
          generation_model?: string | null
          generation_negative_prompt?: string | null
          generation_parameters?: Json | null
          generation_prompt?: string | null
          generation_seed?: string | null
          generation_version?: number | null
          height_px?: number | null
          id?: string
          last_used_at?: string | null
          media_type: string
          mime_type?: string | null
          organization_id: string
          original_filename?: string | null
          review_state?: string
          source?: string
          status?: string
          storage_bucket?: string
          storage_path?: string | null
          suggested_alt_text?: string | null
          tags?: string[]
          updated_at?: string
          upload_error?: string | null
          upload_started_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          venture_id: string
          width_px?: number | null
        }
        Update: {
          alt_text?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived?: boolean
          aspect_ratio?: string | null
          campaign_id?: string | null
          caption?: string | null
          checksum_sha256?: string | null
          created_at?: string
          creative_brief?: string | null
          creative_notes?: string | null
          credit?: string | null
          deleted_at?: string | null
          display_name?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          folder_id?: string | null
          generated_at?: string | null
          generation_model?: string | null
          generation_negative_prompt?: string | null
          generation_parameters?: Json | null
          generation_prompt?: string | null
          generation_seed?: string | null
          generation_version?: number | null
          height_px?: number | null
          id?: string
          last_used_at?: string | null
          media_type?: string
          mime_type?: string | null
          organization_id?: string
          original_filename?: string | null
          review_state?: string
          source?: string
          status?: string
          storage_bucket?: string
          storage_path?: string | null
          suggested_alt_text?: string | null
          tags?: string[]
          updated_at?: string
          upload_error?: string | null
          upload_started_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          venture_id?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_media_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "asset_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_assets_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_media_attachments: {
        Row: {
          content_item_id: string
          content_version_id: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          media_asset_id: string
          organization_id: string
          role: string
          venture_id: string
        }
        Insert: {
          content_item_id: string
          content_version_id: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          media_asset_id: string
          organization_id: string
          role?: string
          venture_id: string
        }
        Update: {
          content_item_id?: string
          content_version_id?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          media_asset_id?: string
          organization_id?: string
          role?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_media_attachments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_attachments_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "social_content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_attachments_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "content_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_attachments_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_media_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          content_item_id: string | null
          content_version_id: string | null
          created_at: string
          detail: Json | null
          id: string
          media_asset_id: string | null
          new_state: Json | null
          organization_id: string
          previous_state: Json | null
          venture_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          content_item_id?: string | null
          content_version_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          media_asset_id?: string | null
          new_state?: Json | null
          organization_id: string
          previous_state?: Json | null
          venture_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          content_item_id?: string | null
          content_version_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          media_asset_id?: string | null
          new_state?: Json | null
          organization_id?: string
          previous_state?: Json | null
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_media_audit_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_audit_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "social_content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_audit_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "content_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_media_audit_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ops_approvals: {
        Row: {
          action: string
          approved_at: string
          approved_by: string | null
          batch_id: string | null
          brand_profile_version: number | null
          content_item_id: string
          content_version: number
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          policy_version: string
          venture_id: string
        }
        Insert: {
          action: string
          approved_at?: string
          approved_by?: string | null
          batch_id?: string | null
          brand_profile_version?: number | null
          content_item_id: string
          content_version: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          policy_version?: string
          venture_id: string
        }
        Update: {
          action?: string
          approved_at?: string
          approved_by?: string | null
          batch_id?: string | null
          brand_profile_version?: number | null
          content_item_id?: string
          content_version?: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          policy_version?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ops_approvals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_approvals_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ops_autonomy: {
        Row: {
          campaign_pauses: Json
          changed_at: string
          changed_by: string | null
          created_at: string
          emergency_pause: boolean
          emergency_pause_reason: string | null
          id: string
          mode: string
          organization_id: string
          platform_pauses: Json
          policy_version: string
          updated_at: string
          venture_id: string
        }
        Insert: {
          campaign_pauses?: Json
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          emergency_pause?: boolean
          emergency_pause_reason?: string | null
          id?: string
          mode?: string
          organization_id: string
          platform_pauses?: Json
          policy_version?: string
          updated_at?: string
          venture_id: string
        }
        Update: {
          campaign_pauses?: Json
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          emergency_pause?: boolean
          emergency_pause_reason?: string | null
          id?: string
          mode?: string
          organization_id?: string
          platform_pauses?: Json
          policy_version?: string
          updated_at?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ops_autonomy_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_autonomy_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: true
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ops_autonomy_history: {
        Row: {
          autonomy_id: string
          change_type: string
          changed_at: string
          changed_by: string | null
          id: string
          organization_id: string
          revision: number
          snapshot: Json
          venture_id: string
        }
        Insert: {
          autonomy_id: string
          change_type: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          organization_id: string
          revision: number
          snapshot: Json
          venture_id: string
        }
        Update: {
          autonomy_id?: string
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          organization_id?: string
          revision?: number
          snapshot?: Json
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ops_autonomy_history_autonomy_id_fkey"
            columns: ["autonomy_id"]
            isOneToOne: false
            referencedRelation: "content_ops_autonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_autonomy_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_autonomy_history_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ops_kill_switches: {
        Row: {
          active: boolean
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          id: string
          organization_id: string
          reason: string | null
          scope: string
          scope_ref: string | null
          set_at: string
          set_by: string | null
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          active?: boolean
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
          scope: string
          scope_ref?: string | null
          set_at?: string
          set_by?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          active?: boolean
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          scope?: string
          scope_ref?: string | null
          set_at?: string
          set_by?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ops_kill_switches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_kill_switches_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ops_schedule_audit: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          automation_job_id: string | null
          content_item_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          policy_version: string
          reason: string | null
          venture_id: string
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          automation_job_id?: string | null
          content_item_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          policy_version?: string
          reason?: string | null
          venture_id: string
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          automation_job_id?: string | null
          content_item_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          policy_version?: string
          reason?: string | null
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ops_schedule_audit_automation_job_id_fkey"
            columns: ["automation_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_schedule_audit_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_schedule_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ops_schedule_audit_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      content_publication_history: {
        Row: {
          actor_user_id: string | null
          api_version: string
          automation_job_id: string | null
          content_item_id: string
          content_version_id: string | null
          created_at: string
          destination_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          organization_id: string
          permalink: string | null
          provider: string
          provider_media_id: string | null
          provider_post_id: string | null
          publish_generation: number
          request_snapshot: Json
          response_snapshot: Json
          social_account_id: string | null
          status: string
          updated_at: string
          venture_id: string
          verification_response: Json | null
          verified_at: string | null
        }
        Insert: {
          actor_user_id?: string | null
          api_version: string
          automation_job_id?: string | null
          content_item_id: string
          content_version_id?: string | null
          created_at?: string
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          permalink?: string | null
          provider: string
          provider_media_id?: string | null
          provider_post_id?: string | null
          publish_generation?: number
          request_snapshot?: Json
          response_snapshot?: Json
          social_account_id?: string | null
          status: string
          updated_at?: string
          venture_id: string
          verification_response?: Json | null
          verified_at?: string | null
        }
        Update: {
          actor_user_id?: string | null
          api_version?: string
          automation_job_id?: string | null
          content_item_id?: string
          content_version_id?: string | null
          created_at?: string
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          permalink?: string | null
          provider?: string
          provider_media_id?: string | null
          provider_post_id?: string | null
          publish_generation?: number
          request_snapshot?: Json
          response_snapshot?: Json
          social_account_id?: string | null
          status?: string
          updated_at?: string
          venture_id?: string
          verification_response?: Json | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_publication_history_automation_job_id_fkey"
            columns: ["automation_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_history_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_history_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "social_content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_history_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "meta_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_history_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publication_history_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          organization_id: string
          role: Database["public"]["Enums"]["conversation_message_role"]
          status: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          role: Database["public"]["Enums"]["conversation_message_role"]
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          role?: Database["public"]["Enums"]["conversation_message_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          summary: string | null
          title: string | null
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          conversation_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          conversation_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          context: string | null
          created_at: string
          created_by: string | null
          decision_date: string | null
          deleted_at: string | null
          evidence: Json | null
          final_decision: string | null
          id: string
          operator_recommendation: string | null
          opportunity_cost: string | null
          options_considered: Json | null
          organization_id: string
          outcome: string | null
          owner_user_id: string | null
          project_id: string | null
          question: string | null
          rationale: string | null
          review_date: string | null
          risks: Json | null
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          deleted_at?: string | null
          evidence?: Json | null
          final_decision?: string | null
          id?: string
          operator_recommendation?: string | null
          opportunity_cost?: string | null
          options_considered?: Json | null
          organization_id: string
          outcome?: string | null
          owner_user_id?: string | null
          project_id?: string | null
          question?: string | null
          rationale?: string | null
          review_date?: string | null
          risks?: Json | null
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          deleted_at?: string | null
          evidence?: Json | null
          final_decision?: string | null
          id?: string
          operator_recommendation?: string | null
          opportunity_cost?: string | null
          options_considered?: Json | null
          organization_id?: string
          outcome?: string | null
          owner_user_id?: string | null
          project_id?: string | null
          question?: string | null
          rationale?: string | null
          review_date?: string | null
          risks?: Json | null
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          knowledge_record_id: string | null
          organization_id: string
          processing_status: Database["public"]["Enums"]["document_processing_status"]
          title: string
          updated_at: string
          uploaded_by: string | null
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          knowledge_record_id?: string | null
          organization_id: string
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          title: string
          updated_at?: string
          uploaded_by?: string | null
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          knowledge_record_id?: string | null
          organization_id?: string
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_knowledge_record_id_fkey"
            columns: ["knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_graph_edges: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          organization_id: string
          relationship_type: Database["public"]["Enums"]["graph_relationship_type"]
          source: string
          source_entity_id: string
          source_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          target_entity_id: string
          target_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          updated_at: string
          venture_id: string | null
          weight: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          relationship_type: Database["public"]["Enums"]["graph_relationship_type"]
          source?: string
          source_entity_id: string
          source_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          target_entity_id: string
          target_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          updated_at?: string
          venture_id?: string | null
          weight?: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          relationship_type?: Database["public"]["Enums"]["graph_relationship_type"]
          source?: string
          source_entity_id?: string
          source_entity_type?: Database["public"]["Enums"]["graph_entity_type"]
          target_entity_id?: string
          target_entity_type?: Database["public"]["Enums"]["graph_entity_type"]
          updated_at?: string
          venture_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_graph_edges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_graph_edges_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_insights: {
        Row: {
          acted_on_action: string | null
          acted_on_at: string | null
          acted_on_by: string | null
          confidence: number
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          dismissed_reason: string | null
          entity_ref: string | null
          evidence: Json
          generated_at: string
          id: string
          insight_type: string
          organization_id: string
          pattern_key: string | null
          pattern_version: string | null
          priority: Database["public"]["Enums"]["insight_priority"]
          resolved_at: string | null
          severity: Database["public"]["Enums"]["insight_severity"]
          source_records: Json | null
          status: Database["public"]["Enums"]["insight_status"]
          summary: string | null
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          acted_on_action?: string | null
          acted_on_at?: string | null
          acted_on_by?: string | null
          confidence?: number
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          dismissed_reason?: string | null
          entity_ref?: string | null
          evidence?: Json
          generated_at?: string
          id?: string
          insight_type: string
          organization_id: string
          pattern_key?: string | null
          pattern_version?: string | null
          priority?: Database["public"]["Enums"]["insight_priority"]
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["insight_severity"]
          source_records?: Json | null
          status?: Database["public"]["Enums"]["insight_status"]
          summary?: string | null
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          acted_on_action?: string | null
          acted_on_at?: string | null
          acted_on_by?: string | null
          confidence?: number
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          dismissed_reason?: string | null
          entity_ref?: string | null
          evidence?: Json
          generated_at?: string
          id?: string
          insight_type?: string
          organization_id?: string
          pattern_key?: string | null
          pattern_version?: string | null
          priority?: Database["public"]["Enums"]["insight_priority"]
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["insight_severity"]
          source_records?: Json | null
          status?: Database["public"]["Enums"]["insight_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_insights_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string | null
          current_value: number | null
          deleted_at: string | null
          description: string | null
          goal_type: string | null
          id: string
          organization_id: string
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          deleted_at?: string | null
          description?: string | null
          goal_type?: string | null
          id?: string
          organization_id: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          deleted_at?: string | null
          description?: string | null
          goal_type?: string | null
          id?: string
          organization_id?: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      ingested_content_items: {
        Row: {
          asset_id: string | null
          author: string | null
          canonical_url: string | null
          category: string | null
          classification_confidence: number
          classification_signals: Json
          connection_id: string | null
          content_hash: string
          content_summary: string | null
          content_text: string | null
          created_at: string
          current_version_number: number
          deleted_at: string | null
          external_id: string | null
          freshness_status: Database["public"]["Enums"]["content_freshness_status"]
          id: string
          last_change_at: string | null
          last_change_significance: string | null
          last_ingested_at: string
          metadata: Json
          modified_at: string | null
          organization_id: string
          published_at: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["integration_source_type"]
          tags: string[]
          title: string
          updated_at: string
          venture_id: string | null
          verification_status: Database["public"]["Enums"]["content_verification_status"]
        }
        Insert: {
          asset_id?: string | null
          author?: string | null
          canonical_url?: string | null
          category?: string | null
          classification_confidence?: number
          classification_signals?: Json
          connection_id?: string | null
          content_hash: string
          content_summary?: string | null
          content_text?: string | null
          created_at?: string
          current_version_number?: number
          deleted_at?: string | null
          external_id?: string | null
          freshness_status?: Database["public"]["Enums"]["content_freshness_status"]
          id?: string
          last_change_at?: string | null
          last_change_significance?: string | null
          last_ingested_at?: string
          metadata?: Json
          modified_at?: string | null
          organization_id: string
          published_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["integration_source_type"]
          tags?: string[]
          title: string
          updated_at?: string
          venture_id?: string | null
          verification_status?: Database["public"]["Enums"]["content_verification_status"]
        }
        Update: {
          asset_id?: string | null
          author?: string | null
          canonical_url?: string | null
          category?: string | null
          classification_confidence?: number
          classification_signals?: Json
          connection_id?: string | null
          content_hash?: string
          content_summary?: string | null
          content_text?: string | null
          created_at?: string
          current_version_number?: number
          deleted_at?: string | null
          external_id?: string | null
          freshness_status?: Database["public"]["Enums"]["content_freshness_status"]
          id?: string
          last_change_at?: string | null
          last_change_significance?: string | null
          last_ingested_at?: string
          metadata?: Json
          modified_at?: string | null
          organization_id?: string
          published_at?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["integration_source_type"]
          tags?: string[]
          title?: string
          updated_at?: string
          venture_id?: string | null
          verification_status?: Database["public"]["Enums"]["content_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ingested_content_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_content_items_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_content_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_content_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "integration_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_content_items_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      ingested_content_versions: {
        Row: {
          captured_at: string
          change_significance: string | null
          content_hash: string
          content_item_id: string
          content_text: string | null
          diff_summary: Json
          id: string
          metadata: Json
          organization_id: string
          title: string | null
          version_number: number
        }
        Insert: {
          captured_at?: string
          change_significance?: string | null
          content_hash: string
          content_item_id: string
          content_text?: string | null
          diff_summary?: Json
          id?: string
          metadata?: Json
          organization_id: string
          title?: string | null
          version_number: number
        }
        Update: {
          captured_at?: string
          change_significance?: string | null
          content_hash?: string
          content_item_id?: string
          content_text?: string | null
          diff_summary?: Json
          id?: string
          metadata?: Json
          organization_id?: string
          title?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingested_content_versions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "ingested_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_content_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          asset_id: string | null
          automation_mode: string
          connection_type: Database["public"]["Enums"]["integration_connection_type"]
          created_at: string
          created_by: string | null
          credentials_reference: string | null
          deleted_at: string | null
          discovery_completed_at: string | null
          discovery_error_code: string | null
          discovery_last_run_id: string | null
          discovery_status: string
          display_name: string
          homepage_url: string | null
          id: string
          last_error_at: string | null
          last_error_code: string | null
          last_successful_sync_at: string | null
          last_sync_at: string | null
          next_cursor: Json | null
          organization_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          settings: Json
          status: Database["public"]["Enums"]["integration_connection_status"]
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          asset_id?: string | null
          automation_mode?: string
          connection_type: Database["public"]["Enums"]["integration_connection_type"]
          created_at?: string
          created_by?: string | null
          credentials_reference?: string | null
          deleted_at?: string | null
          discovery_completed_at?: string | null
          discovery_error_code?: string | null
          discovery_last_run_id?: string | null
          discovery_status?: string
          display_name: string
          homepage_url?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          next_cursor?: Json | null
          organization_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          settings?: Json
          status?: Database["public"]["Enums"]["integration_connection_status"]
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          asset_id?: string | null
          automation_mode?: string
          connection_type?: Database["public"]["Enums"]["integration_connection_type"]
          created_at?: string
          created_by?: string | null
          credentials_reference?: string | null
          deleted_at?: string | null
          discovery_completed_at?: string | null
          discovery_error_code?: string | null
          discovery_last_run_id?: string | null
          discovery_status?: string
          display_name?: string
          homepage_url?: string | null
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          next_cursor?: Json | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          settings?: Json
          status?: Database["public"]["Enums"]["integration_connection_status"]
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_discovery_last_run_id_fkey"
            columns: ["discovery_last_run_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_rest_endpoints: {
        Row: {
          auth_config_ciphertext: string | null
          auth_type: string
          base_url: string
          created_at: string
          created_by: string | null
          default_headers: Json
          default_query_params: Json
          description: string | null
          enabled: boolean
          id: string
          last_error: string | null
          last_error_at: string | null
          last_status_code: number | null
          last_success_at: string | null
          method: string
          name: string
          organization_id: string
          timeout_ms: number
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          auth_config_ciphertext?: string | null
          auth_type?: string
          base_url: string
          created_at?: string
          created_by?: string | null
          default_headers?: Json
          default_query_params?: Json
          description?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_status_code?: number | null
          last_success_at?: string | null
          method?: string
          name: string
          organization_id: string
          timeout_ms?: number
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          auth_config_ciphertext?: string | null
          auth_type?: string
          base_url?: string
          created_at?: string
          created_by?: string | null
          default_headers?: Json
          default_query_params?: Json
          description?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_status_code?: number | null
          last_success_at?: string | null
          method?: string
          name?: string
          organization_id?: string
          timeout_ms?: number
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_rest_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_rest_endpoints_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sources: {
        Row: {
          category: string | null
          connection_id: string | null
          created_at: string
          deleted_at: string | null
          discovered_at: string
          discovery_run_id: string | null
          external_id: string | null
          http_status: number | null
          id: string
          last_synced_at: string | null
          metadata: Json
          organization_id: string
          page_type: string | null
          relevance_score: number
          source_type: Database["public"]["Enums"]["integration_source_type"]
          source_url: string | null
          sync_enabled: boolean
          sync_frequency: string
          title: string
          trust_level: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          category?: string | null
          connection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          discovered_at?: string
          discovery_run_id?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id: string
          page_type?: string | null
          relevance_score?: number
          source_type: Database["public"]["Enums"]["integration_source_type"]
          source_url?: string | null
          sync_enabled?: boolean
          sync_frequency?: string
          title: string
          trust_level?: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          category?: string | null
          connection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          discovered_at?: string
          discovery_run_id?: string | null
          external_id?: string | null
          http_status?: number | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id?: string
          page_type?: string | null
          relevance_score?: number
          source_type?: Database["public"]["Enums"]["integration_source_type"]
          source_url?: string | null
          sync_enabled?: boolean
          sync_frequency?: string
          title?: string
          trust_level?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sources_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sources_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sources_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          created_at: string
          duration_ms: number | null
          failure_code: string | null
          failure_message: string | null
          id: string
          metadata: Json
          organization_id: string
          records_created: number
          records_discovered: number
          records_failed: number
          records_skipped: number
          records_updated: number
          source_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["integration_sync_status"]
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          duration_ms?: number | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          records_created?: number
          records_discovered?: number
          records_failed?: number
          records_skipped?: number
          records_updated?: number
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["integration_sync_status"]
          trigger_type?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          duration_ms?: number | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          records_created?: number
          records_discovered?: number
          records_failed?: number
          records_skipped?: number
          records_updated?: number
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["integration_sync_status"]
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "integration_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhook_deliveries: {
        Row: {
          attempt: number
          delivered_at: string
          error: string | null
          event_type: string
          id: string
          organization_id: string
          request_summary: Json
          response_summary: Json | null
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          attempt?: number
          delivered_at?: string
          error?: string | null
          event_type: string
          id?: string
          organization_id: string
          request_summary?: Json
          response_summary?: Json | null
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          attempt?: number
          delivered_at?: string
          error?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          request_summary?: Json
          response_summary?: Json | null
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhook_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "integration_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          event_types: string[]
          id: string
          last_delivery_at: string | null
          last_error: string | null
          last_error_at: string | null
          last_status_code: number | null
          name: string
          organization_id: string
          secret_ciphertext: string | null
          target_url: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_types?: string[]
          id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_status_code?: number | null
          name: string
          organization_id: string
          secret_ciphertext?: string | null
          target_url: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_types?: string[]
          id?: string
          last_delivery_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_status_code?: number | null
          name?: string
          organization_id?: string
          secret_ciphertext?: string | null
          target_url?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhooks_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_by: string | null
          created_at: string
          display_name: string | null
          id: string
          integration_type: string
          last_synced_at: string | null
          organization_id: string
          permissions: Json | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          integration_type: string
          last_synced_at?: string | null
          organization_id: string
          permissions?: Json | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          integration_type?: string
          last_synced_at?: string | null
          organization_id?: string
          permissions?: Json | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_records: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          importance: Database["public"]["Enums"]["priority_level"]
          knowledge_type: Database["public"]["Enums"]["knowledge_type"]
          organization_id: string
          source: string | null
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
          venture_id: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["priority_level"]
          knowledge_type?: Database["public"]["Enums"]["knowledge_type"]
          organization_id: string
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          venture_id?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["priority_level"]
          knowledge_type?: Database["public"]["Enums"]["knowledge_type"]
          organization_id?: string
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          venture_id?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_records_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_destinations: {
        Row: {
          connected_fb_page_id: string | null
          connected_ig_id: string | null
          created_at: string
          display_name: string
          external_id: string
          granted_permissions: string[]
          id: string
          insights_available: boolean
          kind: string
          last_capability_check: string | null
          last_capability_reason: string | null
          metadata: Json
          organization_id: string
          page_tasks: string[]
          publish_available: boolean
          social_account_id: string | null
          updated_at: string
          username: string | null
          venture_id: string
        }
        Insert: {
          connected_fb_page_id?: string | null
          connected_ig_id?: string | null
          created_at?: string
          display_name: string
          external_id: string
          granted_permissions?: string[]
          id?: string
          insights_available?: boolean
          kind: string
          last_capability_check?: string | null
          last_capability_reason?: string | null
          metadata?: Json
          organization_id: string
          page_tasks?: string[]
          publish_available?: boolean
          social_account_id?: string | null
          updated_at?: string
          username?: string | null
          venture_id: string
        }
        Update: {
          connected_fb_page_id?: string | null
          connected_ig_id?: string | null
          created_at?: string
          display_name?: string
          external_id?: string
          granted_permissions?: string[]
          id?: string
          insights_available?: boolean
          kind?: string
          last_capability_check?: string | null
          last_capability_reason?: string | null
          metadata?: Json
          organization_id?: string
          page_tasks?: string[]
          publish_available?: boolean
          social_account_id?: string | null
          updated_at?: string
          username?: string | null
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_destinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_destinations_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_destinations_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_media_delivery_tokens: {
        Row: {
          asset_id: string
          consumed_at: string | null
          created_at: string
          delivered_bytes: number | null
          delivery_ip: unknown
          expires_at: string
          id: string
          organization_id: string
          purpose: string
          token: string
        }
        Insert: {
          asset_id: string
          consumed_at?: string | null
          created_at?: string
          delivered_bytes?: number | null
          delivery_ip?: unknown
          expires_at: string
          id?: string
          organization_id: string
          purpose?: string
          token: string
        }
        Update: {
          asset_id?: string
          consumed_at?: string | null
          created_at?: string
          delivered_bytes?: number | null
          delivery_ip?: unknown
          expires_at?: string
          id?: string
          organization_id?: string
          purpose?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_media_delivery_tokens_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "content_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_media_delivery_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_oauth_states: {
        Row: {
          code_verifier: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          purpose: string
          redirect_uri: string
          requested_by: string | null
          requested_scopes: string[]
          state: string
          venture_id: string | null
        }
        Insert: {
          code_verifier?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          organization_id: string
          purpose?: string
          redirect_uri: string
          requested_by?: string | null
          requested_scopes?: string[]
          state: string
          venture_id?: string | null
        }
        Update: {
          code_verifier?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          purpose?: string
          redirect_uri?: string
          requested_by?: string | null
          requested_scopes?: string[]
          state?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_oauth_states_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_oauth_states_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_page_tokens: {
        Row: {
          destination_id: string
          encrypted_token: string
          encryption_scheme: string
          expires_at: string | null
          id: string
          last_refresh_at: string | null
          obtained_at: string
          organization_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          destination_id: string
          encrypted_token: string
          encryption_scheme?: string
          expires_at?: string | null
          id?: string
          last_refresh_at?: string | null
          obtained_at?: string
          organization_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          destination_id?: string
          encrypted_token?: string
          encryption_scheme?: string
          expires_at?: string | null
          id?: string
          last_refresh_at?: string | null
          obtained_at?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "meta_page_tokens_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: true
            referencedRelation: "meta_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_page_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nsl_assessment_requests: {
        Row: {
          biggest_challenge: string
          business_size: string | null
          company: string
          consent: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          industry: string | null
          operator_notes: string | null
          phone: string | null
          referral_source: string | null
          source_ip_hash: string | null
          status: string
          updated_at: string
          user_agent: string | null
          website: string | null
        }
        Insert: {
          biggest_challenge: string
          business_size?: string | null
          company: string
          consent?: boolean
          created_at?: string
          email: string
          full_name: string
          id?: string
          industry?: string | null
          operator_notes?: string | null
          phone?: string | null
          referral_source?: string | null
          source_ip_hash?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          website?: string | null
        }
        Update: {
          biggest_challenge?: string
          business_size?: string | null
          company?: string
          consent?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          industry?: string | null
          operator_notes?: string | null
          phone?: string | null
          referral_source?: string | null
          source_ip_hash?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          website?: string | null
        }
        Relationships: []
      }
      nsl_proposal_activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          proposal_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          proposal_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nsl_proposal_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nsl_proposal_activity_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      nsl_proposal_comments: {
        Row: {
          author_id: string | null
          comment: string
          created_at: string
          id: string
          organization_id: string
          proposal_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          comment: string
          created_at?: string
          id?: string
          organization_id: string
          proposal_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          comment?: string
          created_at?: string
          id?: string
          organization_id?: string
          proposal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nsl_proposal_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nsl_proposal_comments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      nsl_proposal_signatures: {
        Row: {
          acknowledgement: string
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          proposal_id: string
          proposal_version: number
          signed_at: string
          signer_email: string
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          acknowledgement: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          proposal_id: string
          proposal_version: number
          signed_at?: string
          signer_email: string
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          acknowledgement?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          proposal_id?: string
          proposal_version?: number
          signed_at?: string
          signer_email?: string
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nsl_proposal_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nsl_proposal_signatures_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      nsl_proposal_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          proposal_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          proposal_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          proposal_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "nsl_proposal_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nsl_proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      nsl_proposals: {
        Row: {
          accepted_at: string | null
          approved_at: string | null
          approved_by: string | null
          assessment_summary: string | null
          business_overview: string | null
          client_id: string
          created_at: string
          created_by: string | null
          current_challenges: string | null
          declined_at: string | null
          deliverables: string | null
          executive_summary: string | null
          expired_at: string | null
          growth_opportunities: string | null
          id: string
          implementation_timeline: string | null
          investment_summary: string | null
          locked_at: string | null
          organization_id: string
          payment_schedule: string | null
          pipeline_id: string | null
          proposal_number: string
          public_token_expires_at: string | null
          public_token_hash: string | null
          recommended_services: string | null
          recommended_strategy: string | null
          recurring_fee_cents: number
          sent_at: string | null
          setup_fee_cents: number
          status: Database["public"]["Enums"]["nsl_proposal_status"]
          terms: string | null
          title: string
          total_value_cents: number
          updated_at: string
          version: number
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_summary?: string | null
          business_overview?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          current_challenges?: string | null
          declined_at?: string | null
          deliverables?: string | null
          executive_summary?: string | null
          expired_at?: string | null
          growth_opportunities?: string | null
          id?: string
          implementation_timeline?: string | null
          investment_summary?: string | null
          locked_at?: string | null
          organization_id: string
          payment_schedule?: string | null
          pipeline_id?: string | null
          proposal_number: string
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          recommended_services?: string | null
          recommended_strategy?: string | null
          recurring_fee_cents?: number
          sent_at?: string | null
          setup_fee_cents?: number
          status?: Database["public"]["Enums"]["nsl_proposal_status"]
          terms?: string | null
          title: string
          total_value_cents?: number
          updated_at?: string
          version?: number
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assessment_summary?: string | null
          business_overview?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_challenges?: string | null
          declined_at?: string | null
          deliverables?: string | null
          executive_summary?: string | null
          expired_at?: string | null
          growth_opportunities?: string | null
          id?: string
          implementation_timeline?: string | null
          investment_summary?: string | null
          locked_at?: string | null
          organization_id?: string
          payment_schedule?: string | null
          pipeline_id?: string | null
          proposal_number?: string
          public_token_expires_at?: string | null
          public_token_hash?: string | null
          recommended_services?: string | null
          recommended_strategy?: string | null
          recurring_fee_cents?: number
          sent_at?: string | null
          setup_fee_cents?: number
          status?: Database["public"]["Enums"]["nsl_proposal_status"]
          terms?: string | null
          title?: string
          total_value_cents?: number
          updated_at?: string
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nsl_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nsl_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nsl_proposals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event: string
          id: string
          kind: Database["public"]["Enums"]["operator_kind"]
          organization_id: string
          payload: Json
          task_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event: string
          id?: string
          kind: Database["public"]["Enums"]["operator_kind"]
          organization_id: string
          payload?: Json
          task_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event?: string
          id?: string
          kind?: Database["public"]["Enums"]["operator_kind"]
          organization_id?: string
          payload?: Json
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_audit_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "operator_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_state: {
        Row: {
          auto_enabled: boolean
          kind: Database["public"]["Enums"]["operator_kind"]
          organization_id: string
          paused: boolean
          paused_at: string | null
          paused_by: string | null
          paused_reason: string | null
          resumed_at: string | null
          updated_at: string
        }
        Insert: {
          auto_enabled?: boolean
          kind: Database["public"]["Enums"]["operator_kind"]
          organization_id: string
          paused?: boolean
          paused_at?: string | null
          paused_by?: string | null
          paused_reason?: string | null
          resumed_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_enabled?: boolean
          kind?: Database["public"]["Enums"]["operator_kind"]
          organization_id?: string
          paused?: boolean
          paused_at?: string | null
          paused_by?: string | null
          paused_reason?: string | null
          resumed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_tasks: {
        Row: {
          approval_state: string
          approved_at: string | null
          approved_by: string | null
          assigned_to_user_id: string | null
          blocks_stage_advance: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          deal_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          description: string | null
          due_at: string | null
          id: string
          kind: Database["public"]["Enums"]["operator_kind"]
          organization_id: string
          playbook_step_id: string | null
          priority: Database["public"]["Enums"]["operator_task_priority"]
          related_entity_id: string | null
          related_entity_type: string | null
          requires_approval: boolean
          source: string
          status: Database["public"]["Enums"]["operator_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approval_state?: string
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_user_id?: string | null
          blocks_stage_advance?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deal_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          description?: string | null
          due_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["operator_kind"]
          organization_id: string
          playbook_step_id?: string | null
          priority?: Database["public"]["Enums"]["operator_task_priority"]
          related_entity_id?: string | null
          related_entity_type?: string | null
          requires_approval?: boolean
          source?: string
          status?: Database["public"]["Enums"]["operator_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approval_state?: string
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_user_id?: string | null
          blocks_stage_advance?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          deal_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          description?: string | null
          due_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["operator_kind"]
          organization_id?: string
          playbook_step_id?: string | null
          priority?: Database["public"]["Enums"]["operator_task_priority"]
          related_entity_id?: string | null
          related_entity_type?: string | null
          requires_approval?: boolean
          source?: string
          status?: Database["public"]["Enums"]["operator_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_operating_context: {
        Row: {
          active_ventures: Json
          business_model: string | null
          company_summary: string | null
          created_at: string
          created_by: string | null
          current_constraints: Json
          current_focus: string | null
          current_stage: string | null
          decision_preferences: Json
          founder_preferences: Json
          id: string
          important_metrics: Json
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          major_goals: Json
          major_risks: Json
          mission: string | null
          operating_principles: Json
          organization_id: string
          policy_version: string
          primary_customers: string | null
          revision: number
          risk_tolerance: string | null
          source_lineage: Json
          strategic_priorities: Json
          time_horizon: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_ventures?: Json
          business_model?: string | null
          company_summary?: string | null
          created_at?: string
          created_by?: string | null
          current_constraints?: Json
          current_focus?: string | null
          current_stage?: string | null
          decision_preferences?: Json
          founder_preferences?: Json
          id?: string
          important_metrics?: Json
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          major_goals?: Json
          major_risks?: Json
          mission?: string | null
          operating_principles?: Json
          organization_id: string
          policy_version?: string
          primary_customers?: string | null
          revision?: number
          risk_tolerance?: string | null
          source_lineage?: Json
          strategic_priorities?: Json
          time_horizon?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_ventures?: Json
          business_model?: string | null
          company_summary?: string | null
          created_at?: string
          created_by?: string | null
          current_constraints?: Json
          current_focus?: string | null
          current_stage?: string | null
          decision_preferences?: Json
          founder_preferences?: Json
          id?: string
          important_metrics?: Json
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          major_goals?: Json
          major_risks?: Json
          mission?: string | null
          operating_principles?: Json
          organization_id?: string
          policy_version?: string
          primary_customers?: string | null
          revision?: number
          risk_tolerance?: string | null
          source_lineage?: Json
          strategic_priorities?: Json
          time_horizon?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_operating_context_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_operating_context_history: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          context_id: string
          id: string
          organization_id: string
          revision: number
          snapshot: Json
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          context_id: string
          id?: string
          organization_id: string
          revision: number
          snapshot: Json
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          context_id?: string
          id?: string
          organization_id?: string
          revision?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_operating_context_history_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "organization_operating_context"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_operating_context_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_social_settings: {
        Row: {
          allow_holiday_publishing: boolean
          allow_weekend_publishing: boolean
          created_at: string
          default_approval_policy: string
          default_automation_mode: string
          default_timezone: string
          emergency_stop: boolean
          emergency_stop_reason: string | null
          emergency_stopped_at: string | null
          emergency_stopped_by: string | null
          global_required_disclaimers: Json
          maximum_posts_per_day: number
          maximum_posts_per_platform_per_day: number
          organization_id: string
          policy_version: string
          prohibited_topics: Json
          publishing_confirmation_version: string | null
          publishing_enabled_at: string | null
          publishing_enabled_by: string | null
          publishing_master_switch: boolean
          restricted_categories: Json
          social_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_holiday_publishing?: boolean
          allow_weekend_publishing?: boolean
          created_at?: string
          default_approval_policy?: string
          default_automation_mode?: string
          default_timezone?: string
          emergency_stop?: boolean
          emergency_stop_reason?: string | null
          emergency_stopped_at?: string | null
          emergency_stopped_by?: string | null
          global_required_disclaimers?: Json
          maximum_posts_per_day?: number
          maximum_posts_per_platform_per_day?: number
          organization_id: string
          policy_version?: string
          prohibited_topics?: Json
          publishing_confirmation_version?: string | null
          publishing_enabled_at?: string | null
          publishing_enabled_by?: string | null
          publishing_master_switch?: boolean
          restricted_categories?: Json
          social_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_holiday_publishing?: boolean
          allow_weekend_publishing?: boolean
          created_at?: string
          default_approval_policy?: string
          default_automation_mode?: string
          default_timezone?: string
          emergency_stop?: boolean
          emergency_stop_reason?: string | null
          emergency_stopped_at?: string | null
          emergency_stopped_by?: string | null
          global_required_disclaimers?: Json
          maximum_posts_per_day?: number
          maximum_posts_per_platform_per_day?: number
          organization_id?: string
          policy_version?: string
          prohibited_topics?: Json
          publishing_confirmation_version?: string | null
          publishing_enabled_at?: string | null
          publishing_enabled_by?: string | null
          publishing_master_switch?: boolean
          restricted_categories?: Json
          social_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_social_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          slug: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          slug?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          slug?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          links: Json
          location: string | null
          onboarding_completed: boolean
          preferred_name: string | null
          pronouns: string | null
          timezone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          links?: Json
          location?: string | null
          onboarding_completed?: boolean
          preferred_name?: string | null
          pronouns?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          links?: Json
          location?: string | null
          onboarding_completed?: boolean
          preferred_name?: string | null
          pronouns?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          blocker_summary: string | null
          client_delivery_completed_at: string | null
          client_delivery_started_at: string | null
          client_id: string | null
          client_next_action: string
          client_stage: string
          client_stage_label: string
          client_summary: string
          client_title: string
          client_visible: boolean
          created_at: string
          created_by: string | null
          created_source: string
          deadline: string | null
          deleted_at: string | null
          desired_outcome: string | null
          goal_id: string | null
          id: string
          name: string
          next_action: string | null
          objective: string | null
          organization_id: string
          owner_user_id: string | null
          pipeline_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          progress_percentage: number
          proposal_id: string | null
          proposal_version: number | null
          risk_summary: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          blocker_summary?: string | null
          client_delivery_completed_at?: string | null
          client_delivery_started_at?: string | null
          client_id?: string | null
          client_next_action?: string
          client_stage?: string
          client_stage_label?: string
          client_summary?: string
          client_title?: string
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          created_source?: string
          deadline?: string | null
          deleted_at?: string | null
          desired_outcome?: string | null
          goal_id?: string | null
          id?: string
          name: string
          next_action?: string | null
          objective?: string | null
          organization_id: string
          owner_user_id?: string | null
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          progress_percentage?: number
          proposal_id?: string | null
          proposal_version?: number | null
          risk_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          blocker_summary?: string | null
          client_delivery_completed_at?: string | null
          client_delivery_started_at?: string | null
          client_id?: string | null
          client_next_action?: string
          client_stage?: string
          client_stage_label?: string
          client_summary?: string
          client_title?: string
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          created_source?: string
          deadline?: string | null
          deleted_at?: string | null
          desired_outcome?: string | null
          goal_id?: string | null
          id?: string
          name?: string
          next_action?: string | null
          objective?: string | null
          organization_id?: string
          owner_user_id?: string | null
          pipeline_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          progress_percentage?: number
          proposal_id?: string | null
          proposal_version?: number | null
          risk_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_case_studies: {
        Row: {
          client_id: string | null
          created_at: string
          deal_id: string
          headline: string | null
          id: string
          metrics: Json
          organization_id: string
          published_url: string | null
          quote: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          deal_id: string
          headline?: string | null
          id?: string
          metrics?: Json
          organization_id: string
          published_url?: string | null
          quote?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          deal_id?: string
          headline?: string | null
          id?: string
          metrics?: Json
          organization_id?: string
          published_url?: string | null
          quote?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_case_studies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_case_studies_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_case_studies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_cashflow_entries: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["cashflow_direction"]
          id: string
          note: string | null
          occurred_on: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["cashflow_direction"]
          id?: string
          note?: string | null
          occurred_on: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["cashflow_direction"]
          id?: string
          note?: string | null
          occurred_on?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_cashflow_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_clients: {
        Row: {
          activated_at: string | null
          activation_project_id: string | null
          activation_proposal_id: string | null
          churned_at: string | null
          created_at: string
          created_by: string | null
          id: string
          mrr_cents: number
          name: string
          notes: string | null
          organization_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_project_id?: string | null
          activation_proposal_id?: string | null
          churned_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mrr_cents?: number
          name: string
          notes?: string | null
          organization_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_project_id?: string | null
          activation_proposal_id?: string | null
          churned_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mrr_cents?: number
          name?: string
          notes?: string | null
          organization_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_clients_activation_project_id_fkey"
            columns: ["activation_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_clients_activation_proposal_id_fkey"
            columns: ["activation_proposal_id"]
            isOneToOne: false
            referencedRelation: "nsl_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_clients_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_discovery_briefs: {
        Row: {
          budget_range: string | null
          created_at: string
          deal_id: string
          decision_makers: Json
          goals: Json
          id: string
          organization_id: string
          pain_points: Json
          prepared_by: string | null
          questions: Json
          research_summary: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          created_at?: string
          deal_id: string
          decision_makers?: Json
          goals?: Json
          id?: string
          organization_id: string
          pain_points?: Json
          prepared_by?: string | null
          questions?: Json
          research_summary?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          created_at?: string
          deal_id?: string
          decision_makers?: Json
          goals?: Json
          id?: string
          organization_id?: string
          pain_points?: Json
          prepared_by?: string | null
          questions?: Json
          research_summary?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_discovery_briefs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_discovery_briefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_launch_docs: {
        Row: {
          created_at: string
          deal_id: string
          deliverables: Json
          handover_url: string | null
          id: string
          organization_id: string
          project_id: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          deliverables?: Json
          handover_url?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          deliverables?: Json
          handover_url?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_launch_docs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_launch_docs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_launch_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_mrr_snapshots: {
        Row: {
          active_clients: number
          churned_mrr_cents: number
          created_at: string
          id: string
          mrr_cents: number
          new_mrr_cents: number
          organization_id: string
          snapshot_date: string
        }
        Insert: {
          active_clients?: number
          churned_mrr_cents?: number
          created_at?: string
          id?: string
          mrr_cents?: number
          new_mrr_cents?: number
          organization_id: string
          snapshot_date: string
        }
        Update: {
          active_clients?: number
          churned_mrr_cents?: number
          created_at?: string
          id?: string
          mrr_cents?: number
          new_mrr_cents?: number
          organization_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_mrr_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_pipeline: {
        Row: {
          client_id: string | null
          close_reason: string | null
          closed_at: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          expected_close: string | null
          id: string
          lost_reason: string | null
          name: string
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          organization_id: string
          owner_operator: Database["public"]["Enums"]["operator_kind"]
          owner_user_id: string | null
          probability: number
          source: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at: string
          updated_at: string
          value_cents: number
          venture_id: string | null
        }
        Insert: {
          client_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          expected_close?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          organization_id: string
          owner_operator?: Database["public"]["Enums"]["operator_kind"]
          owner_user_id?: string | null
          probability?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          updated_at?: string
          value_cents?: number
          venture_id?: string | null
        }
        Update: {
          client_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          expected_close?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_operator?: Database["public"]["Enums"]["operator_kind"]
          owner_user_id?: string | null
          probability?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          updated_at?: string
          value_cents?: number
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_pipeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "revenue_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_pipeline_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_pipeline_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_playbook_steps: {
        Row: {
          active: boolean
          automation_key: string
          blocks_stage_advance: boolean
          created_at: string
          default_due_offset_hours: number
          description: string | null
          id: string
          operator_kind: Database["public"]["Enums"]["operator_kind"]
          order_index: number
          organization_id: string | null
          requires_approval: boolean
          stage: Database["public"]["Enums"]["pipeline_stage"]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          automation_key?: string
          blocks_stage_advance?: boolean
          created_at?: string
          default_due_offset_hours?: number
          description?: string | null
          id?: string
          operator_kind: Database["public"]["Enums"]["operator_kind"]
          order_index?: number
          organization_id?: string | null
          requires_approval?: boolean
          stage: Database["public"]["Enums"]["pipeline_stage"]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          automation_key?: string
          blocks_stage_advance?: boolean
          created_at?: string
          default_due_offset_hours?: number
          description?: string | null
          id?: string
          operator_kind?: Database["public"]["Enums"]["operator_kind"]
          order_index?: number
          organization_id?: string | null
          requires_approval?: boolean
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_playbook_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_proposals: {
        Row: {
          amount_cents: number
          client_name: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          id: string
          notes: string | null
          organization_id: string
          pipeline_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          client_name: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          pipeline_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_name?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pipeline_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_proposals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_referrals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          occurred_on: string
          organization_id: string
          referred_name: string
          referrer_name: string
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
          value_cents: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          organization_id: string
          referred_name: string
          referrer_name: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          value_cents?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          organization_id?: string
          referred_name?: string
          referrer_name?: string
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_referrals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_stage_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          deal_id: string
          from_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          id: string
          operator_kind: Database["public"]["Enums"]["operator_kind"] | null
          organization_id: string
          payload: Json
          reason: string | null
          to_stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          deal_id: string
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          operator_kind?: Database["public"]["Enums"]["operator_kind"] | null
          organization_id: string
          payload?: Json
          reason?: string | null
          to_stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          deal_id?: string
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          operator_kind?: Database["public"]["Enums"]["operator_kind"] | null
          organization_id?: string
          payload?: Json
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["pipeline_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "revenue_stage_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "revenue_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_stage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_directives: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          organization_id: string
          priority: number
          scope: string
          starts_at: string
          status: string
          text: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          organization_id: string
          priority?: number
          scope: string
          starts_at?: string
          status?: string
          text: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          organization_id?: string
          priority?: number
          scope?: string
          starts_at?: string
          status?: string
          text?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_directives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_directives_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_executive_digests: {
        Row: {
          created_at: string
          digest_date: string
          generated_at: string
          health_snapshot_id: string | null
          id: string
          insight_ids: string[]
          method_version: string
          organization_id: string
          recommendation_ids: string[]
          sections: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          digest_date: string
          generated_at?: string
          health_snapshot_id?: string | null
          id?: string
          insight_ids?: string[]
          method_version: string
          organization_id: string
          recommendation_ids?: string[]
          sections: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          digest_date?: string
          generated_at?: string
          health_snapshot_id?: string | null
          id?: string
          insight_ids?: string[]
          method_version?: string
          organization_id?: string
          recommendation_ids?: string[]
          sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_executive_digests_health_snapshot_id_fkey"
            columns: ["health_snapshot_id"]
            isOneToOne: false
            referencedRelation: "sam_health_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_executive_digests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_health_snapshots: {
        Row: {
          categories: Json
          computed_at: string
          created_at: string
          id: string
          inputs: Json
          method_version: string
          organization_id: string
          overall: number
          venture_id: string | null
        }
        Insert: {
          categories: Json
          computed_at?: string
          created_at?: string
          id?: string
          inputs?: Json
          method_version: string
          organization_id: string
          overall: number
          venture_id?: string | null
        }
        Update: {
          categories?: Json
          computed_at?: string
          created_at?: string
          id?: string
          inputs?: Json
          method_version?: string
          organization_id?: string
          overall?: number
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_health_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_health_snapshots_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_invocation_context_refs: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          invocation_id: string
          organization_id: string
          role: string
          source: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          invocation_id: string
          organization_id: string
          role?: string
          source: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          invocation_id?: string
          organization_id?: string
          role?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_invocation_context_refs_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocation_context_refs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_invocation_provider_calls: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          input_tokens: number | null
          invocation_id: string
          latency_ms: number | null
          model_id: string
          organization_id: string
          output_tokens: number | null
          prompt_version: string
          provider_id: string
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          invocation_id: string
          latency_ms?: number | null
          model_id: string
          organization_id: string
          output_tokens?: number | null
          prompt_version: string
          provider_id: string
          status?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          invocation_id?: string
          latency_ms?: number | null
          model_id?: string
          organization_id?: string
          output_tokens?: number | null
          prompt_version?: string
          provider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_invocation_provider_calls_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocation_provider_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_invocations: {
        Row: {
          actor_user_id: string | null
          citation_count: number
          citation_lineage: Json
          confidence_framework_version: string | null
          confidence_method: string
          conflict_count: number
          constitution_version: string
          context_counts: Json
          conversation_id: string | null
          created_at: string
          error_code: string | null
          finished_at: string | null
          graph_depth: number
          graph_edges_count: number
          graph_nodes_count: number
          id: string
          input_tokens: number | null
          intent: string
          latency_ms: number | null
          learning_event_ids: string[]
          memory_considered_ids: string[]
          memory_excluded_ids: string[]
          memory_framework_version: string | null
          memory_selected_ids: string[]
          message_id: string | null
          organization_id: string
          output_tokens: number | null
          pipeline_version: string
          precedence_version: string | null
          prompt_version: string
          rollup_confidence: number | null
          rollup_confidence_band: string | null
          scope: Json
          started_at: string
          status: string
          strategy: string
          surface: string
          truncations: Json
          weights_version: string
          workflow_key: string | null
        }
        Insert: {
          actor_user_id?: string | null
          citation_count?: number
          citation_lineage?: Json
          confidence_framework_version?: string | null
          confidence_method: string
          conflict_count?: number
          constitution_version: string
          context_counts?: Json
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          graph_depth?: number
          graph_edges_count?: number
          graph_nodes_count?: number
          id?: string
          input_tokens?: number | null
          intent: string
          latency_ms?: number | null
          learning_event_ids?: string[]
          memory_considered_ids?: string[]
          memory_excluded_ids?: string[]
          memory_framework_version?: string | null
          memory_selected_ids?: string[]
          message_id?: string | null
          organization_id: string
          output_tokens?: number | null
          pipeline_version: string
          precedence_version?: string | null
          prompt_version: string
          rollup_confidence?: number | null
          rollup_confidence_band?: string | null
          scope?: Json
          started_at?: string
          status?: string
          strategy?: string
          surface?: string
          truncations?: Json
          weights_version: string
          workflow_key?: string | null
        }
        Update: {
          actor_user_id?: string | null
          citation_count?: number
          citation_lineage?: Json
          confidence_framework_version?: string | null
          confidence_method?: string
          conflict_count?: number
          constitution_version?: string
          context_counts?: Json
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          graph_depth?: number
          graph_edges_count?: number
          graph_nodes_count?: number
          id?: string
          input_tokens?: number | null
          intent?: string
          latency_ms?: number | null
          learning_event_ids?: string[]
          memory_considered_ids?: string[]
          memory_excluded_ids?: string[]
          memory_framework_version?: string | null
          memory_selected_ids?: string[]
          message_id?: string | null
          organization_id?: string
          output_tokens?: number | null
          pipeline_version?: string
          precedence_version?: string | null
          prompt_version?: string
          rollup_confidence?: number | null
          rollup_confidence_band?: string | null
          scope?: Json
          started_at?: string
          status?: string
          strategy?: string
          surface?: string
          truncations?: Json
          weights_version?: string
          workflow_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_invocations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_learning_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["sam_learning_event_type"]
          feedback_text: string | null
          id: string
          invocation_id: string | null
          memory_item_id: string | null
          message_id: string | null
          organization_id: string
          original_payload: Json
          outcome_status: string | null
          revised_payload: Json | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["sam_learning_event_type"]
          feedback_text?: string | null
          id?: string
          invocation_id?: string | null
          memory_item_id?: string | null
          message_id?: string | null
          organization_id: string
          original_payload?: Json
          outcome_status?: string | null
          revised_payload?: Json | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["sam_learning_event_type"]
          feedback_text?: string | null
          id?: string
          invocation_id?: string | null
          memory_item_id?: string | null
          message_id?: string | null
          organization_id?: string
          original_payload?: Json
          outcome_status?: string | null
          revised_payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_learning_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_mcp_connections: {
        Row: {
          created_at: string
          discovered_tools: Json
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_operation_id: string | null
          last_success_at: string | null
          last_tested_at: string | null
          organization_id: string
          protocol_version: string | null
          server_url: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discovered_tools?: Json
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_operation_id?: string | null
          last_success_at?: string | null
          last_tested_at?: string | null
          organization_id: string
          protocol_version?: string | null
          server_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discovered_tools?: Json
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_operation_id?: string | null
          last_success_at?: string | null
          last_tested_at?: string | null
          organization_id?: string
          protocol_version?: string | null
          server_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_mcp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_conflicts: {
        Row: {
          created_at: string
          id: string
          memory_item_a_id: string
          memory_item_b_id: string
          metadata: Json
          organization_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_item_a_id: string
          memory_item_b_id: string
          metadata?: Json
          organization_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_item_a_id?: string
          memory_item_b_id?: string
          metadata?: Json
          organization_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_conflicts_memory_item_a_id_fkey"
            columns: ["memory_item_a_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_conflicts_memory_item_b_id_fkey"
            columns: ["memory_item_b_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_feedback: {
        Row: {
          correction_text: string | null
          created_at: string
          feedback_type: Database["public"]["Enums"]["sam_memory_feedback_type"]
          id: string
          memory_item_id: string
          metadata: Json
          organization_id: string
          user_id: string
        }
        Insert: {
          correction_text?: string | null
          created_at?: string
          feedback_type: Database["public"]["Enums"]["sam_memory_feedback_type"]
          id?: string
          memory_item_id: string
          metadata?: Json
          organization_id: string
          user_id: string
        }
        Update: {
          correction_text?: string | null
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["sam_memory_feedback_type"]
          id?: string
          memory_item_id?: string
          metadata?: Json
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_feedback_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_items: {
        Row: {
          category: string
          confidence_band: string | null
          confidence_score: number | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_at: string | null
          evidence_refs: Json
          expires_at: string | null
          id: string
          last_confirmed_at: string | null
          layer: Database["public"]["Enums"]["sam_memory_layer"]
          memory_kind: Database["public"]["Enums"]["sam_memory_kind"] | null
          organization_id: string
          owner_user_id: string | null
          source_conversation_id: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_knowledge_record_id: string | null
          source_message_id: string | null
          source_type: Database["public"]["Enums"]["sam_memory_source_type"]
          statement: string
          status: Database["public"]["Enums"]["sam_memory_status"]
          structured_value: Json | null
          superseded_by: string | null
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          category: string
          confidence_band?: string | null
          confidence_score?: number | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_at?: string | null
          evidence_refs?: Json
          expires_at?: string | null
          id?: string
          last_confirmed_at?: string | null
          layer: Database["public"]["Enums"]["sam_memory_layer"]
          memory_kind?: Database["public"]["Enums"]["sam_memory_kind"] | null
          organization_id: string
          owner_user_id?: string | null
          source_conversation_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_knowledge_record_id?: string | null
          source_message_id?: string | null
          source_type: Database["public"]["Enums"]["sam_memory_source_type"]
          statement: string
          status?: Database["public"]["Enums"]["sam_memory_status"]
          structured_value?: Json | null
          superseded_by?: string | null
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          category?: string
          confidence_band?: string | null
          confidence_score?: number | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_at?: string | null
          evidence_refs?: Json
          expires_at?: string | null
          id?: string
          last_confirmed_at?: string | null
          layer?: Database["public"]["Enums"]["sam_memory_layer"]
          memory_kind?: Database["public"]["Enums"]["sam_memory_kind"] | null
          organization_id?: string
          owner_user_id?: string | null
          source_conversation_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_knowledge_record_id?: string | null
          source_message_id?: string | null
          source_type?: Database["public"]["Enums"]["sam_memory_source_type"]
          statement?: string
          status?: Database["public"]["Enums"]["sam_memory_status"]
          structured_value?: Json | null
          superseded_by?: string | null
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_source_knowledge_record_id_fkey"
            columns: ["source_knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_versions: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          memory_item_id: string
          organization_id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          memory_item_id: string
          organization_id: string
          snapshot: Json
          version_number: number
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          memory_item_id?: string
          organization_id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_versions_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_mission_work_items: {
        Row: {
          artifact: Json
          automation_job_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          error_code: string | null
          error_message: string | null
          id: string
          mission_id: string
          organization_id: string
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          artifact?: Json
          automation_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          mission_id: string
          organization_id: string
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          artifact?: Json
          automation_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          mission_id?: string
          organization_id?: string
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_mission_work_items_automation_job_id_fkey"
            columns: ["automation_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_mission_work_items_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "sam_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_mission_work_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          priority: number
          source: string
          source_ref: string | null
          status: string
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          priority?: number
          source?: string
          source_ref?: string | null
          status?: string
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          priority?: number
          source?: string
          source_ref?: string | null
          status?: string
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_missions_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_org_autonomy: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          organization_id: string
          reason: string | null
          state: string
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          organization_id: string
          reason?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          organization_id?: string
          reason?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_org_autonomy_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_rate_counters: {
        Row: {
          count: number
          day: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_rate_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_reasoning_replays: {
        Row: {
          context_hash: string
          created_at: string
          evaluator_version: string
          failures: Json
          fixture_id: string
          id: string
          metadata: Json
          model_id: string | null
          organization_id: string | null
          output_hash: string
          prompt_version: string
          provider_id: string | null
          scores: Json
          strategy: string
        }
        Insert: {
          context_hash: string
          created_at?: string
          evaluator_version: string
          failures?: Json
          fixture_id: string
          id?: string
          metadata?: Json
          model_id?: string | null
          organization_id?: string | null
          output_hash: string
          prompt_version: string
          provider_id?: string | null
          scores: Json
          strategy: string
        }
        Update: {
          context_hash?: string
          created_at?: string
          evaluator_version?: string
          failures?: Json
          fixture_id?: string
          id?: string
          metadata?: Json
          model_id?: string | null
          organization_id?: string | null
          output_hash?: string
          prompt_version?: string
          provider_id?: string | null
          scores?: Json
          strategy?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_reasoning_replays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_reasoning_traces: {
        Row: {
          citations: Json
          constitution_version: string | null
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          intent: string
          invocation_id: string
          message_id: string | null
          model_id: string | null
          organization_id: string
          pipeline_version: string | null
          prompt_version: string
          provider_id: string | null
          redaction_applied: boolean
          retention_days: number
          strategy: string
          summary: Json | null
          trace: Json
        }
        Insert: {
          citations?: Json
          constitution_version?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          intent: string
          invocation_id: string
          message_id?: string | null
          model_id?: string | null
          organization_id: string
          pipeline_version?: string | null
          prompt_version: string
          provider_id?: string | null
          redaction_applied?: boolean
          retention_days?: number
          strategy: string
          summary?: Json | null
          trace: Json
        }
        Update: {
          citations?: Json
          constitution_version?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          intent?: string
          invocation_id?: string
          message_id?: string | null
          model_id?: string | null
          organization_id?: string
          pipeline_version?: string | null
          prompt_version?: string
          provider_id?: string | null
          redaction_applied?: boolean
          retention_days?: number
          strategy?: string
          summary?: Json | null
          trace?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sam_reasoning_traces_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_reasoning_traces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_recommendation_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          organization_id: string
          payload: Json | null
          reason: string | null
          recommendation_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json | null
          reason?: string | null
          recommendation_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          reason?: string | null
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_recommendation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_recommendation_events_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "sam_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_recommendations: {
        Row: {
          confidence: number
          converted_to_ref: Json | null
          created_at: string
          evidence: Json
          expected_impact: string | null
          id: string
          insight_id: string | null
          kind: string
          method_version: string
          organization_id: string
          priority: Database["public"]["Enums"]["insight_priority"]
          rationale: string
          resolved_at: string | null
          resolved_by: string | null
          snooze_until: string | null
          status: string
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          confidence?: number
          converted_to_ref?: Json | null
          created_at?: string
          evidence?: Json
          expected_impact?: string | null
          id?: string
          insight_id?: string | null
          kind: string
          method_version: string
          organization_id: string
          priority?: Database["public"]["Enums"]["insight_priority"]
          rationale: string
          resolved_at?: string | null
          resolved_by?: string | null
          snooze_until?: string | null
          status?: string
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          confidence?: number
          converted_to_ref?: Json | null
          created_at?: string
          evidence?: Json
          expected_impact?: string | null
          id?: string
          insight_id?: string | null
          kind?: string
          method_version?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["insight_priority"]
          rationale?: string
          resolved_at?: string | null
          resolved_by?: string | null
          snooze_until?: string | null
          status?: string
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_recommendations_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "executive_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_recommendations_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_response_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          feedback_type: Database["public"]["Enums"]["sam_response_feedback_type"]
          id: string
          message_id: string
          note: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          feedback_type: Database["public"]["Enums"]["sam_response_feedback_type"]
          id?: string
          message_id: string
          note?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["sam_response_feedback_type"]
          id?: string
          message_id?: string
          note?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_response_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_response_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_response_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_settings: {
        Row: {
          allow_memory_proposals: boolean
          challenge_level: string
          enabled: boolean
          include_citations: boolean
          include_founder_memory: boolean
          include_org_memory: boolean
          include_venture_memory: boolean
          memory_review_reminders: boolean
          organization_id: string
          response_style: string
          retain_conversation_history: boolean
          show_confidence: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_memory_proposals?: boolean
          challenge_level?: string
          enabled?: boolean
          include_citations?: boolean
          include_founder_memory?: boolean
          include_org_memory?: boolean
          include_venture_memory?: boolean
          memory_review_reminders?: boolean
          organization_id: string
          response_style?: string
          retain_conversation_history?: boolean
          show_confidence?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_memory_proposals?: boolean
          challenge_level?: string
          enabled?: boolean
          include_citations?: boolean
          include_founder_memory?: boolean
          include_org_memory?: boolean
          include_venture_memory?: boolean
          memory_review_reminders?: boolean
          organization_id?: string
          response_style?: string
          retain_conversation_history?: boolean
          show_confidence?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_workflow_citations: {
        Row: {
          citation_type: string
          created_at: string
          entity_id: string
          entity_type: string
          finding_id: string | null
          href: string | null
          id: string
          lineage: Json
          organization_id: string
          relevance: string | null
          title: string
          workflow_run_id: string
        }
        Insert: {
          citation_type?: string
          created_at?: string
          entity_id: string
          entity_type: string
          finding_id?: string | null
          href?: string | null
          id?: string
          lineage?: Json
          organization_id: string
          relevance?: string | null
          title: string
          workflow_run_id: string
        }
        Update: {
          citation_type?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          finding_id?: string | null
          href?: string | null
          id?: string
          lineage?: Json
          organization_id?: string
          relevance?: string | null
          title?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_workflow_citations_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "sam_workflow_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_workflow_citations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_workflow_citations_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "sam_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_workflow_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          feedback_type: Database["public"]["Enums"]["sam_workflow_feedback_type"]
          id: string
          organization_id: string
          updated_at: string
          user_id: string
          workflow_run_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          feedback_type: Database["public"]["Enums"]["sam_workflow_feedback_type"]
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
          workflow_run_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          feedback_type?: Database["public"]["Enums"]["sam_workflow_feedback_type"]
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_workflow_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_workflow_feedback_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "sam_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_workflow_findings: {
        Row: {
          confidence_band: string | null
          confidence_score: number | null
          created_at: string
          finding_type: Database["public"]["Enums"]["sam_workflow_finding_type"]
          id: string
          organization_id: string
          priority: number
          severity: Database["public"]["Enums"]["sam_workflow_severity"]
          sort_order: number
          status: string
          structured_data: Json
          summary: string | null
          title: string
          workflow_run_id: string
        }
        Insert: {
          confidence_band?: string | null
          confidence_score?: number | null
          created_at?: string
          finding_type: Database["public"]["Enums"]["sam_workflow_finding_type"]
          id?: string
          organization_id: string
          priority?: number
          severity?: Database["public"]["Enums"]["sam_workflow_severity"]
          sort_order?: number
          status?: string
          structured_data?: Json
          summary?: string | null
          title: string
          workflow_run_id: string
        }
        Update: {
          confidence_band?: string | null
          confidence_score?: number | null
          created_at?: string
          finding_type?: Database["public"]["Enums"]["sam_workflow_finding_type"]
          id?: string
          organization_id?: string
          priority?: number
          severity?: Database["public"]["Enums"]["sam_workflow_severity"]
          sort_order?: number
          status?: string
          structured_data?: Json
          summary?: string | null
          title?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_workflow_findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_workflow_findings_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "sam_workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_workflow_runs: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          citation_summary: Json
          completed_at: string | null
          confidence_band: string | null
          confidence_score: number | null
          confidence_version: string
          constitution_version: string
          context_summary: Json
          created_at: string
          deleted_at: string | null
          executive_summary: string | null
          failed_at: string | null
          failure_code: string | null
          finding_count: number
          graph_version: string
          id: string
          initiated_by: string
          input_snapshot: Json
          input_tokens: number | null
          latency_ms: number | null
          memory_version: string
          model: string | null
          organization_id: string
          output_snapshot: Json | null
          output_tokens: number | null
          period_end: string | null
          period_start: string | null
          pipeline_version: string
          prompt_version: string
          provider: string | null
          recommendation_count: number
          risk_count: number
          started_at: string
          status: Database["public"]["Enums"]["sam_workflow_status"]
          synthesis_status: string
          trigger_type: Database["public"]["Enums"]["sam_workflow_trigger"]
          updated_at: string
          venture_id: string | null
          workflow_type: Database["public"]["Enums"]["sam_workflow_type"]
          workflow_version: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          citation_summary?: Json
          completed_at?: string | null
          confidence_band?: string | null
          confidence_score?: number | null
          confidence_version: string
          constitution_version: string
          context_summary?: Json
          created_at?: string
          deleted_at?: string | null
          executive_summary?: string | null
          failed_at?: string | null
          failure_code?: string | null
          finding_count?: number
          graph_version: string
          id?: string
          initiated_by: string
          input_snapshot?: Json
          input_tokens?: number | null
          latency_ms?: number | null
          memory_version: string
          model?: string | null
          organization_id: string
          output_snapshot?: Json | null
          output_tokens?: number | null
          period_end?: string | null
          period_start?: string | null
          pipeline_version: string
          prompt_version: string
          provider?: string | null
          recommendation_count?: number
          risk_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sam_workflow_status"]
          synthesis_status?: string
          trigger_type?: Database["public"]["Enums"]["sam_workflow_trigger"]
          updated_at?: string
          venture_id?: string | null
          workflow_type: Database["public"]["Enums"]["sam_workflow_type"]
          workflow_version: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          citation_summary?: Json
          completed_at?: string | null
          confidence_band?: string | null
          confidence_score?: number | null
          confidence_version?: string
          constitution_version?: string
          context_summary?: Json
          created_at?: string
          deleted_at?: string | null
          executive_summary?: string | null
          failed_at?: string | null
          failure_code?: string | null
          finding_count?: number
          graph_version?: string
          id?: string
          initiated_by?: string
          input_snapshot?: Json
          input_tokens?: number | null
          latency_ms?: number | null
          memory_version?: string
          model?: string | null
          organization_id?: string
          output_snapshot?: Json | null
          output_tokens?: number | null
          period_end?: string | null
          period_start?: string | null
          pipeline_version?: string
          prompt_version?: string
          provider?: string | null
          recommendation_count?: number
          risk_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["sam_workflow_status"]
          synthesis_status?: string
          trigger_type?: Database["public"]["Enums"]["sam_workflow_trigger"]
          updated_at?: string
          venture_id?: string | null
          workflow_type?: Database["public"]["Enums"]["sam_workflow_type"]
          workflow_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_workflow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_workflow_runs_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          asset_id: string | null
          connection_id: string | null
          content_item_id: string | null
          created_at: string
          dedup_key: string | null
          description: string | null
          detected_at: string
          id: string
          metadata: Json
          occurred_at: string
          organization_id: string
          severity: string
          signal_type: string
          significance: string | null
          source_id: string | null
          status: string
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          asset_id?: string | null
          connection_id?: string | null
          content_item_id?: string | null
          created_at?: string
          dedup_key?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id: string
          severity?: string
          signal_type: string
          significance?: string | null
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          asset_id?: string | null
          connection_id?: string | null
          content_item_id?: string | null
          created_at?: string
          dedup_key?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          severity?: string
          signal_type?: string
          significance?: string | null
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "ingested_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "integration_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_type: string | null
          approval_policy: string
          asset_id: string | null
          automation_mode: string
          connection_status: string
          consecutive_failures: number
          created_at: string
          created_by: string | null
          credential_reference: string | null
          default_schedule: Json
          default_timezone: string
          deleted_at: string | null
          display_name: string
          external_account_id: string | null
          granted_scopes: Json
          health_band: string
          health_score: number | null
          id: string
          last_failed_publication_at: string | null
          last_metrics_sync_at: string | null
          last_successful_publication_at: string | null
          last_verified_at: string | null
          metadata: Json
          organization_id: string
          platform: string
          publishing_enabled: boolean
          updated_at: string
          username: string | null
          venture_id: string
        }
        Insert: {
          account_type?: string | null
          approval_policy?: string
          asset_id?: string | null
          automation_mode?: string
          connection_status?: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          credential_reference?: string | null
          default_schedule?: Json
          default_timezone?: string
          deleted_at?: string | null
          display_name: string
          external_account_id?: string | null
          granted_scopes?: Json
          health_band?: string
          health_score?: number | null
          id?: string
          last_failed_publication_at?: string | null
          last_metrics_sync_at?: string | null
          last_successful_publication_at?: string | null
          last_verified_at?: string | null
          metadata?: Json
          organization_id: string
          platform: string
          publishing_enabled?: boolean
          updated_at?: string
          username?: string | null
          venture_id: string
        }
        Update: {
          account_type?: string | null
          approval_policy?: string
          asset_id?: string | null
          automation_mode?: string
          connection_status?: string
          consecutive_failures?: number
          created_at?: string
          created_by?: string | null
          credential_reference?: string | null
          default_schedule?: Json
          default_timezone?: string
          deleted_at?: string | null
          display_name?: string
          external_account_id?: string | null
          granted_scopes?: Json
          health_band?: string
          health_score?: number | null
          id?: string
          last_failed_publication_at?: string | null
          last_metrics_sync_at?: string | null
          last_successful_publication_at?: string | null
          last_verified_at?: string | null
          metadata?: Json
          organization_id?: string
          platform?: string
          publishing_enabled?: boolean
          updated_at?: string
          username?: string | null
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaigns: {
        Row: {
          approval_policy: string
          approved_at: string | null
          approved_by: string | null
          approved_templates: Json
          audience: Json
          automation_mode: string
          budget_metadata: Json | null
          calls_to_action: Json
          content_mix: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          end_at: string | null
          id: string
          links: Json
          name: string
          objective: string | null
          organization_id: string
          pause_reason: string | null
          paused: boolean
          platform_mix: Json
          platforms: Json
          posting_frequency: Json
          prohibited_claims: Json
          promotion_ratio_limit: number | null
          required_disclaimers: Json
          sam_recommendation: Json | null
          start_at: string | null
          status: string
          strategic_rationale: string | null
          strategy_period_end: string | null
          strategy_period_start: string | null
          superseded_by: string | null
          themes: Json
          updated_at: string
          venture_id: string
        }
        Insert: {
          approval_policy?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_templates?: Json
          audience?: Json
          automation_mode?: string
          budget_metadata?: Json | null
          calls_to_action?: Json
          content_mix?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          links?: Json
          name: string
          objective?: string | null
          organization_id: string
          pause_reason?: string | null
          paused?: boolean
          platform_mix?: Json
          platforms?: Json
          posting_frequency?: Json
          prohibited_claims?: Json
          promotion_ratio_limit?: number | null
          required_disclaimers?: Json
          sam_recommendation?: Json | null
          start_at?: string | null
          status?: string
          strategic_rationale?: string | null
          strategy_period_end?: string | null
          strategy_period_start?: string | null
          superseded_by?: string | null
          themes?: Json
          updated_at?: string
          venture_id: string
        }
        Update: {
          approval_policy?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_templates?: Json
          audience?: Json
          automation_mode?: string
          budget_metadata?: Json | null
          calls_to_action?: Json
          content_mix?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          links?: Json
          name?: string
          objective?: string | null
          organization_id?: string
          pause_reason?: string | null
          paused?: boolean
          platform_mix?: Json
          platforms?: Json
          posting_frequency?: Json
          prohibited_claims?: Json
          promotion_ratio_limit?: number | null
          required_disclaimers?: Json
          sam_recommendation?: Json | null
          start_at?: string | null
          status?: string
          strategic_rationale?: string | null
          strategy_period_end?: string | null
          strategy_period_start?: string | null
          superseded_by?: string | null
          themes?: Json
          updated_at?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_campaigns_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_campaigns_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_items: {
        Row: {
          alt_text: string | null
          approval_revoked_at: string | null
          approval_revoked_reason: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          approved_content_version: number | null
          archived_at: string | null
          automation_generated: boolean
          blocked_reason: string | null
          body: string
          brand_profile_version: number | null
          campaign_id: string | null
          confidence_score: number | null
          content_plan_id: string | null
          content_type: string
          content_version: number
          created_at: string
          created_by: string | null
          cta: string | null
          deleted_at: string | null
          duplicate_fingerprint: string
          editorial: Json
          evergreen_tags: string[]
          evergreen_topic: string | null
          external_post_id: string | null
          external_post_url: string | null
          final_title: string | null
          first_comment: string | null
          hashtags: Json
          hook: string | null
          human_reviewed: boolean
          id: string
          image_prompt: string | null
          learning_refs: Json
          link_url: string | null
          media_requirements: Json
          media_status: string
          metadata: Json
          newsletter_preview: string | null
          newsletter_subject: string | null
          organization_id: string
          parent_content_item_id: string | null
          platform: string
          policy_version: string
          publish_generation: number
          published_at: string | null
          publishing_window_end: string | null
          publishing_window_start: string | null
          risk_band: string
          risk_reasons: Json
          scheduled_for: string | null
          social_account_id: string | null
          source_lineage: Json
          status: string
          target_audience: string | null
          title: string | null
          updated_at: string
          venture_id: string
          working_title: string | null
        }
        Insert: {
          alt_text?: string | null
          approval_revoked_at?: string | null
          approval_revoked_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_content_version?: number | null
          archived_at?: string | null
          automation_generated?: boolean
          blocked_reason?: string | null
          body: string
          brand_profile_version?: number | null
          campaign_id?: string | null
          confidence_score?: number | null
          content_plan_id?: string | null
          content_type?: string
          content_version?: number
          created_at?: string
          created_by?: string | null
          cta?: string | null
          deleted_at?: string | null
          duplicate_fingerprint: string
          editorial?: Json
          evergreen_tags?: string[]
          evergreen_topic?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          final_title?: string | null
          first_comment?: string | null
          hashtags?: Json
          hook?: string | null
          human_reviewed?: boolean
          id?: string
          image_prompt?: string | null
          learning_refs?: Json
          link_url?: string | null
          media_requirements?: Json
          media_status?: string
          metadata?: Json
          newsletter_preview?: string | null
          newsletter_subject?: string | null
          organization_id: string
          parent_content_item_id?: string | null
          platform: string
          policy_version?: string
          publish_generation?: number
          published_at?: string | null
          publishing_window_end?: string | null
          publishing_window_start?: string | null
          risk_band?: string
          risk_reasons?: Json
          scheduled_for?: string | null
          social_account_id?: string | null
          source_lineage?: Json
          status?: string
          target_audience?: string | null
          title?: string | null
          updated_at?: string
          venture_id: string
          working_title?: string | null
        }
        Update: {
          alt_text?: string | null
          approval_revoked_at?: string | null
          approval_revoked_reason?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_content_version?: number | null
          archived_at?: string | null
          automation_generated?: boolean
          blocked_reason?: string | null
          body?: string
          brand_profile_version?: number | null
          campaign_id?: string | null
          confidence_score?: number | null
          content_plan_id?: string | null
          content_type?: string
          content_version?: number
          created_at?: string
          created_by?: string | null
          cta?: string | null
          deleted_at?: string | null
          duplicate_fingerprint?: string
          editorial?: Json
          evergreen_tags?: string[]
          evergreen_topic?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          final_title?: string | null
          first_comment?: string | null
          hashtags?: Json
          hook?: string | null
          human_reviewed?: boolean
          id?: string
          image_prompt?: string | null
          learning_refs?: Json
          link_url?: string | null
          media_requirements?: Json
          media_status?: string
          metadata?: Json
          newsletter_preview?: string | null
          newsletter_subject?: string | null
          organization_id?: string
          parent_content_item_id?: string | null
          platform?: string
          policy_version?: string
          publish_generation?: number
          published_at?: string | null
          publishing_window_end?: string | null
          publishing_window_start?: string | null
          risk_band?: string
          risk_reasons?: Json
          scheduled_for?: string | null
          social_account_id?: string | null
          source_lineage?: Json
          status?: string
          target_audience?: string | null
          title?: string | null
          updated_at?: string
          venture_id?: string
          working_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_content_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_items_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "social_content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_items_parent_content_item_id_fkey"
            columns: ["parent_content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_items_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_items_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          completion_rate: number | null
          connector_version: string
          content_item_id: string
          conversions: number | null
          created_at: string
          engagement_rate: number | null
          external_post_id: string
          follows: number | null
          id: string
          impressions: number | null
          leads: number | null
          likes: number | null
          link_clicks: number | null
          measured_at: string
          measurement_window: string
          organization_id: string
          platform: string
          raw_metrics_summary: Json
          reach: number | null
          saves: number | null
          shares: number | null
          social_account_id: string
          venture_id: string
          views: number | null
          watch_time_seconds: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          completion_rate?: number | null
          connector_version?: string
          content_item_id: string
          conversions?: number | null
          created_at?: string
          engagement_rate?: number | null
          external_post_id: string
          follows?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          likes?: number | null
          link_clicks?: number | null
          measured_at?: string
          measurement_window?: string
          organization_id: string
          platform: string
          raw_metrics_summary?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          social_account_id: string
          venture_id: string
          views?: number | null
          watch_time_seconds?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          completion_rate?: number | null
          connector_version?: string
          content_item_id?: string
          conversions?: number | null
          created_at?: string
          engagement_rate?: number | null
          external_post_id?: string
          follows?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          likes?: number | null
          link_clicks?: number | null
          measured_at?: string
          measurement_window?: string
          organization_id?: string
          platform?: string
          raw_metrics_summary?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          social_account_id?: string
          venture_id?: string
          views?: number | null
          watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_content_metrics_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_metrics_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_metrics_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_plans: {
        Row: {
          approval_policy: string
          approved_at: string | null
          approved_by: string | null
          audience: Json
          automation_mode: string
          calls_to_action: Json
          campaign_id: string | null
          content_frequency: Json
          content_mix: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          objective: string | null
          organization_id: string
          platforms: Json
          source_lineage: Json
          start_date: string | null
          status: string
          themes: Json
          updated_at: string
          venture_id: string
        }
        Insert: {
          approval_policy?: string
          approved_at?: string | null
          approved_by?: string | null
          audience?: Json
          automation_mode?: string
          calls_to_action?: Json
          campaign_id?: string | null
          content_frequency?: Json
          content_mix?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          objective?: string | null
          organization_id: string
          platforms?: Json
          source_lineage?: Json
          start_date?: string | null
          status?: string
          themes?: Json
          updated_at?: string
          venture_id: string
        }
        Update: {
          approval_policy?: string
          approved_at?: string | null
          approved_by?: string | null
          audience?: Json
          automation_mode?: string
          calls_to_action?: Json
          campaign_id?: string | null
          content_frequency?: Json
          content_mix?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          objective?: string | null
          organization_id?: string
          platforms?: Json
          source_lineage?: Json
          start_date?: string | null
          status?: string
          themes?: Json
          updated_at?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_content_plans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_plans_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      social_content_versions: {
        Row: {
          alt_text: string | null
          body: string
          brand_profile_version: number | null
          change_reason: string | null
          content_hash: string
          content_item_id: string
          created_at: string
          cta: string | null
          editorial: Json
          evergreen_tags: string[]
          evergreen_topic: string | null
          final_title: string | null
          first_comment: string | null
          generated_by: string
          generated_by_actor_id: string | null
          hashtags: Json
          hook: string | null
          id: string
          link_url: string | null
          media_requirements: Json
          newsletter_preview: string | null
          newsletter_subject: string | null
          organization_id: string
          policy_version: string
          restored_from_version: number | null
          source_lineage: Json
          target_audience: string | null
          title: string | null
          version: number
          working_title: string | null
        }
        Insert: {
          alt_text?: string | null
          body: string
          brand_profile_version?: number | null
          change_reason?: string | null
          content_hash: string
          content_item_id: string
          created_at?: string
          cta?: string | null
          editorial?: Json
          evergreen_tags?: string[]
          evergreen_topic?: string | null
          final_title?: string | null
          first_comment?: string | null
          generated_by?: string
          generated_by_actor_id?: string | null
          hashtags?: Json
          hook?: string | null
          id?: string
          link_url?: string | null
          media_requirements?: Json
          newsletter_preview?: string | null
          newsletter_subject?: string | null
          organization_id: string
          policy_version?: string
          restored_from_version?: number | null
          source_lineage?: Json
          target_audience?: string | null
          title?: string | null
          version: number
          working_title?: string | null
        }
        Update: {
          alt_text?: string | null
          body?: string
          brand_profile_version?: number | null
          change_reason?: string | null
          content_hash?: string
          content_item_id?: string
          created_at?: string
          cta?: string | null
          editorial?: Json
          evergreen_tags?: string[]
          evergreen_topic?: string | null
          final_title?: string | null
          first_comment?: string | null
          generated_by?: string
          generated_by_actor_id?: string | null
          hashtags?: Json
          hook?: string | null
          id?: string
          link_url?: string | null
          media_requirements?: Json
          newsletter_preview?: string | null
          newsletter_subject?: string | null
          organization_id?: string
          policy_version?: string
          restored_from_version?: number | null
          source_lineage?: Json
          target_audience?: string | null
          title?: string | null
          version?: number
          working_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_content_versions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_content_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_publication_attempts: {
        Row: {
          attempt_number: number
          automation_job_id: string | null
          completed_at: string | null
          connector_version: string
          content_fingerprint: string | null
          content_item_id: string
          content_version: number
          created_at: string
          duration_ms: number | null
          error_code: string | null
          external_post_id: string | null
          external_post_url: string | null
          external_reference: string | null
          id: string
          idempotency_key: string
          metadata: Json
          organization_id: string
          platform: string
          response_summary: Json
          social_account_id: string
          started_at: string
          status: string
          venture_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          attempt_number: number
          automation_job_id?: string | null
          completed_at?: string | null
          connector_version?: string
          content_fingerprint?: string | null
          content_item_id: string
          content_version: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          external_reference?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          organization_id: string
          platform: string
          response_summary?: Json
          social_account_id: string
          started_at?: string
          status?: string
          venture_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          attempt_number?: number
          automation_job_id?: string | null
          completed_at?: string | null
          connector_version?: string
          content_fingerprint?: string | null
          content_item_id?: string
          content_version?: number
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          external_reference?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          organization_id?: string
          platform?: string
          response_summary?: Json
          social_account_id?: string
          started_at?: string
          status?: string
          venture_id?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_publication_attempts_automation_job_id_fkey"
            columns: ["automation_job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publication_attempts_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "social_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publication_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publication_attempts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publication_attempts_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      venture_brand_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_calls_to_action: Json
          approved_examples: Json
          approved_links: Json
          archived_at: string | null
          audience: Json
          audience_segments: Json
          brand_name: string
          competitor_references: Json
          content_pillars: Json
          core_messages: Json
          created_at: string
          created_by: string | null
          crisis_keywords: Json
          crisis_language_rules: Json
          effective_at: string | null
          emoji_policy: string
          faith_language_policy: Json
          hashtag_policy: Json
          id: string
          long_description: string | null
          metadata: Json
          mission: string | null
          organization_id: string
          platform_preferences: Json
          posting_cadence: Json
          preferred_posting_windows: Json
          products: Json
          profanity_policy: string
          prohibited_claims: Json
          prohibited_topics: Json
          promotion_ratio_limit: number | null
          rejected_examples: Json
          required_disclaimers: Json
          restricted_topics: Json
          review_requirements: Json
          sensitive_topic_guidance: Json
          services: Json
          short_description: string | null
          status: string
          tone_attributes: Json
          updated_at: string
          venture_id: string
          version: number
          visual_guidance: Json
          visual_identity: Json
          voice_attributes: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_calls_to_action?: Json
          approved_examples?: Json
          approved_links?: Json
          archived_at?: string | null
          audience?: Json
          audience_segments?: Json
          brand_name: string
          competitor_references?: Json
          content_pillars?: Json
          core_messages?: Json
          created_at?: string
          created_by?: string | null
          crisis_keywords?: Json
          crisis_language_rules?: Json
          effective_at?: string | null
          emoji_policy?: string
          faith_language_policy?: Json
          hashtag_policy?: Json
          id?: string
          long_description?: string | null
          metadata?: Json
          mission?: string | null
          organization_id: string
          platform_preferences?: Json
          posting_cadence?: Json
          preferred_posting_windows?: Json
          products?: Json
          profanity_policy?: string
          prohibited_claims?: Json
          prohibited_topics?: Json
          promotion_ratio_limit?: number | null
          rejected_examples?: Json
          required_disclaimers?: Json
          restricted_topics?: Json
          review_requirements?: Json
          sensitive_topic_guidance?: Json
          services?: Json
          short_description?: string | null
          status?: string
          tone_attributes?: Json
          updated_at?: string
          venture_id: string
          version: number
          visual_guidance?: Json
          visual_identity?: Json
          voice_attributes?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_calls_to_action?: Json
          approved_examples?: Json
          approved_links?: Json
          archived_at?: string | null
          audience?: Json
          audience_segments?: Json
          brand_name?: string
          competitor_references?: Json
          content_pillars?: Json
          core_messages?: Json
          created_at?: string
          created_by?: string | null
          crisis_keywords?: Json
          crisis_language_rules?: Json
          effective_at?: string | null
          emoji_policy?: string
          faith_language_policy?: Json
          hashtag_policy?: Json
          id?: string
          long_description?: string | null
          metadata?: Json
          mission?: string | null
          organization_id?: string
          platform_preferences?: Json
          posting_cadence?: Json
          preferred_posting_windows?: Json
          products?: Json
          profanity_policy?: string
          prohibited_claims?: Json
          prohibited_topics?: Json
          promotion_ratio_limit?: number | null
          rejected_examples?: Json
          required_disclaimers?: Json
          restricted_topics?: Json
          review_requirements?: Json
          sensitive_topic_guidance?: Json
          services?: Json
          short_description?: string | null
          status?: string
          tone_attributes?: Json
          updated_at?: string
          venture_id?: string
          version?: number
          visual_guidance?: Json
          visual_identity?: Json
          voice_attributes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "venture_brand_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_brand_profiles_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      venture_operating_context: {
        Row: {
          active_projects: Json
          business_model: string | null
          created_at: string
          created_by: string | null
          current_bottlenecks: Json
          current_objectives: Json
          current_priorities: Json
          current_risks: Json
          current_stage: string | null
          id: string
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          major_dependencies: Json
          market_position: string | null
          mission: string | null
          offers: Json
          operating_notes: string | null
          organization_id: string
          paused_priorities: Json
          policy_version: string
          products: Json
          revision: number
          roadmap_summary: string | null
          services: Json
          source_lineage: Json
          strategic_assumptions: Json
          success_metrics: Json
          target_customer: string | null
          updated_at: string
          updated_by: string | null
          venture_id: string
          venture_summary: string | null
        }
        Insert: {
          active_projects?: Json
          business_model?: string | null
          created_at?: string
          created_by?: string | null
          current_bottlenecks?: Json
          current_objectives?: Json
          current_priorities?: Json
          current_risks?: Json
          current_stage?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          major_dependencies?: Json
          market_position?: string | null
          mission?: string | null
          offers?: Json
          operating_notes?: string | null
          organization_id: string
          paused_priorities?: Json
          policy_version?: string
          products?: Json
          revision?: number
          roadmap_summary?: string | null
          services?: Json
          source_lineage?: Json
          strategic_assumptions?: Json
          success_metrics?: Json
          target_customer?: string | null
          updated_at?: string
          updated_by?: string | null
          venture_id: string
          venture_summary?: string | null
        }
        Update: {
          active_projects?: Json
          business_model?: string | null
          created_at?: string
          created_by?: string | null
          current_bottlenecks?: Json
          current_objectives?: Json
          current_priorities?: Json
          current_risks?: Json
          current_stage?: string | null
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          major_dependencies?: Json
          market_position?: string | null
          mission?: string | null
          offers?: Json
          operating_notes?: string | null
          organization_id?: string
          paused_priorities?: Json
          policy_version?: string
          products?: Json
          revision?: number
          roadmap_summary?: string | null
          services?: Json
          source_lineage?: Json
          strategic_assumptions?: Json
          success_metrics?: Json
          target_customer?: string | null
          updated_at?: string
          updated_by?: string | null
          venture_id?: string
          venture_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venture_operating_context_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_operating_context_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: true
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      venture_operating_context_history: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          context_id: string
          id: string
          organization_id: string
          revision: number
          snapshot: Json
          venture_id: string
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          context_id: string
          id?: string
          organization_id: string
          revision: number
          snapshot: Json
          venture_id: string
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          context_id?: string
          id?: string
          organization_id?: string
          revision?: number
          snapshot?: Json
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venture_operating_context_history_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "venture_operating_context"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_operating_context_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_operating_context_history_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      venture_social_settings: {
        Row: {
          allowed_platforms: Json
          approval_policy: string
          automation_mode: string
          created_at: string
          default_timezone: string
          maximum_posts_per_day: number
          organization_id: string
          pause_reason: string | null
          paused: boolean
          paused_at: string | null
          paused_by: string | null
          policy_version: string
          prohibited_topics: Json
          publishing_enabled: boolean
          required_disclaimers: Json
          required_review_categories: Json
          restricted_topics: Json
          social_enabled: boolean
          updated_at: string
          updated_by: string | null
          venture_id: string
        }
        Insert: {
          allowed_platforms?: Json
          approval_policy?: string
          automation_mode?: string
          created_at?: string
          default_timezone?: string
          maximum_posts_per_day?: number
          organization_id: string
          pause_reason?: string | null
          paused?: boolean
          paused_at?: string | null
          paused_by?: string | null
          policy_version?: string
          prohibited_topics?: Json
          publishing_enabled?: boolean
          required_disclaimers?: Json
          required_review_categories?: Json
          restricted_topics?: Json
          social_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          venture_id: string
        }
        Update: {
          allowed_platforms?: Json
          approval_policy?: string
          automation_mode?: string
          created_at?: string
          default_timezone?: string
          maximum_posts_per_day?: number
          organization_id?: string
          pause_reason?: string | null
          paused?: boolean
          paused_at?: string | null
          paused_by?: string | null
          policy_version?: string
          prohibited_topics?: Json
          publishing_enabled?: boolean
          required_disclaimers?: Json
          required_review_categories?: Json
          restricted_topics?: Json
          social_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venture_social_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venture_social_settings_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: true
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      ventures: {
        Row: {
          audience: string | null
          business_model: string | null
          created_at: string
          created_by: string | null
          current_focus: string | null
          deleted_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          mission: string | null
          name: string
          organization_id: string
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          slug: string | null
          status: Database["public"]["Enums"]["venture_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          audience?: string | null
          business_model?: string | null
          created_at?: string
          created_by?: string | null
          current_focus?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name: string
          organization_id: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          slug?: string | null
          status?: Database["public"]["Enums"]["venture_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          audience?: string | null
          business_model?: string | null
          created_at?: string
          created_by?: string | null
          current_focus?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          slug?: string | null
          status?: Database["public"]["Enums"]["venture_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      automation_advance_definition: {
        Args: {
          _definition_id: string
          _last_run_at: string
          _next_run_at: string
        }
        Returns: undefined
      }
      automation_cancel_job: {
        Args: { _job_id: string; _organization_id: string; _reason?: string }
        Returns: {
          actor_type: string
          asset_id: string | null
          attempt_number: number
          automation_definition_id: string | null
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          handler_version: string
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          input_payload: Json
          integration_connection_id: string | null
          integration_source_id: string | null
          job_family: string
          job_type: string
          lease_expires_at: string | null
          max_attempts: number
          organization_id: string
          output_summary: Json
          parent_job_id: string | null
          policy_version: string
          priority: string
          retry_after: string | null
          root_job_id: string | null
          scheduled_for: string
          started_at: string | null
          status: string
          timeout_seconds: number
          trigger_type: string
          updated_at: string
          venture_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      automation_claim_next_job: {
        Args: { _lease_seconds?: number; _worker_id: string }
        Returns: {
          actor_type: string
          asset_id: string | null
          attempt_number: number
          automation_definition_id: string | null
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          handler_version: string
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          input_payload: Json
          integration_connection_id: string | null
          integration_source_id: string | null
          job_family: string
          job_type: string
          lease_expires_at: string | null
          max_attempts: number
          organization_id: string
          output_summary: Json
          parent_job_id: string | null
          policy_version: string
          priority: string
          retry_after: string | null
          root_job_id: string | null
          scheduled_for: string
          started_at: string | null
          status: string
          timeout_seconds: number
          trigger_type: string
          updated_at: string
          venture_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      automation_recover_stale_jobs: {
        Args: { _limit?: number }
        Returns: {
          actor_type: string
          asset_id: string | null
          attempt_number: number
          automation_definition_id: string | null
          available_at: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          handler_version: string
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          input_payload: Json
          integration_connection_id: string | null
          integration_source_id: string | null
          job_family: string
          job_type: string
          lease_expires_at: string | null
          max_attempts: number
          organization_id: string
          output_summary: Json
          parent_job_id: string | null
          policy_version: string
          priority: string
          retry_after: string | null
          root_job_id: string | null
          scheduled_for: string
          started_at: string | null
          status: string
          timeout_seconds: number
          trigger_type: string
          updated_at: string
          venture_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      client_account_client_id: { Args: { _user: string }; Returns: string }
      client_account_org_id: { Args: { _user: string }; Returns: string }
      has_org_role: {
        Args: {
          _min: Database["public"]["Enums"]["org_role"]
          _org: string
          _user: string
        }
        Returns: boolean
      }
      is_client_account: { Args: { _user: string }; Returns: boolean }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_owner: { Args: { _org: string; _user: string }; Returns: boolean }
      nsl_proposal_accept: {
        Args: {
          _acknowledgement: string
          _ip: string
          _signer_email: string
          _signer_name: string
          _token_hash: string
          _user_agent: string
        }
        Returns: {
          accepted_at: string
          idempotent: boolean
          proposal_id: string
        }[]
      }
      org_role_of: {
        Args: { _org: string; _user: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      shares_org_with: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      billing_collection_method: "send_invoice" | "charge_automatically"
      billing_event_type:
        | "customer_created"
        | "invoice_created"
        | "invoice_finalized"
        | "invoice_sent"
        | "invoice_payment_failed"
        | "setup_deposit_paid"
        | "onboarding_payment_complete"
        | "setup_final_paid"
        | "ready_for_go_live"
        | "subscription_created"
        | "subscription_updated"
        | "subscription_canceled"
        | "recurring_billing_active"
        | "refund_issued"
        | "delivery_project_created"
        | "client_activated"
        | "delivery_ready_to_start"
      billing_invoice_status:
        | "draft"
        | "open"
        | "paid"
        | "uncollectible"
        | "void"
        | "refunded"
        | "partially_refunded"
      billing_invoice_type:
        | "setup_deposit"
        | "setup_final"
        | "subscription"
        | "adjustment"
      billing_payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "partially_refunded"
      billing_subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
      billing_webhook_processing_status:
        | "received"
        | "processing"
        | "processed"
        | "failed"
      cashflow_direction: "inflow" | "outflow"
      client_account_role: "client_admin" | "client_user"
      client_account_status: "active" | "deactivated"
      client_document_status:
        | "requested"
        | "uploaded"
        | "needs_revision"
        | "approved"
        | "archived"
      client_document_visibility:
        | "internal_only"
        | "client_visible"
        | "client_uploaded"
      client_onboarding_item_type:
        | "company_information"
        | "contact_information"
        | "service_area"
        | "business_hours"
        | "brand_assets"
        | "system_access"
        | "existing_software"
        | "required_document"
        | "approval"
        | "other"
      client_onboarding_owner: "client" | "northstar"
      client_onboarding_status:
        | "not_started"
        | "in_progress"
        | "submitted"
        | "needs_revision"
        | "approved"
        | "blocked"
        | "not_applicable"
      client_status: "active" | "paused" | "churned" | "onboarding"
      commitment_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "overdue"
        | "completed"
        | "canceled"
      content_freshness_status:
        | "fresh"
        | "aging"
        | "stale"
        | "inaccessible"
        | "unknown"
      content_verification_status:
        | "unverified"
        | "reviewed"
        | "verified"
        | "disputed"
        | "rejected"
      conversation_message_role: "user" | "operator" | "system" | "tool"
      decision_status:
        | "draft"
        | "under_review"
        | "waiting_for_founder"
        | "decided"
        | "revisit_later"
        | "closed"
      document_processing_status:
        | "uploaded"
        | "pending"
        | "processing"
        | "ready"
        | "failed"
      goal_status:
        | "proposed"
        | "active"
        | "at_risk"
        | "achieved"
        | "missed"
        | "paused"
        | "archived"
      graph_entity_type:
        | "organization"
        | "profile"
        | "member"
        | "venture"
        | "project"
        | "task"
        | "goal"
        | "decision"
        | "commitment"
        | "knowledge"
        | "document"
        | "memory"
        | "activity"
      graph_relationship_type:
        | "belongs_to"
        | "supports"
        | "blocks"
        | "depends_on"
        | "advances"
        | "contradicts"
        | "informs"
        | "derived_from"
        | "related_to"
        | "assigned_to"
        | "owned_by"
        | "supersedes"
        | "caused"
        | "resulted_in"
        | "references"
      insight_priority: "low" | "normal" | "high" | "critical"
      insight_severity:
        | "information"
        | "attention"
        | "warning"
        | "critical"
        | "opportunity"
      insight_status: "active" | "dismissed" | "resolved" | "expired"
      integration_connection_status:
        | "pending"
        | "active"
        | "error"
        | "disabled"
        | "archived"
      integration_connection_type:
        | "website"
        | "database"
        | "rest"
        | "webhook"
        | "file_import"
        | "api_token"
      integration_provider:
        | "website"
        | "supabase"
        | "rest_api"
        | "webhook"
        | "csv_import"
        | "json_import"
        | "api_token"
        | "other"
      integration_source_type:
        | "webpage"
        | "sitemap"
        | "blog"
        | "docs"
        | "db_table"
        | "rest_endpoint"
        | "webhook_topic"
        | "csv_file"
        | "json_file"
        | "manual"
        | "other"
      integration_status:
        | "disconnected"
        | "pending"
        | "connected"
        | "error"
        | "paused"
      integration_sync_status:
        | "queued"
        | "running"
        | "succeeded"
        | "partial"
        | "failed"
        | "cancelled"
      knowledge_type:
        | "founder_profile"
        | "venture_knowledge"
        | "person"
        | "policy"
        | "brand_guideline"
        | "strategy"
        | "research"
        | "meeting_note"
        | "conversation_summary"
        | "operating_procedure"
        | "general"
      member_status: "invited" | "active" | "suspended" | "removed"
      nsl_proposal_status:
        | "draft"
        | "internal_review"
        | "approved"
        | "ready_to_send"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
        | "superseded"
        | "cancelled"
      operator_kind: "hunter" | "builder"
      operator_task_priority: "low" | "normal" | "high" | "urgent"
      operator_task_status:
        | "queued"
        | "in_progress"
        | "needs_approval"
        | "blocked"
        | "done"
        | "cancelled"
      org_role: "owner" | "admin" | "executive" | "member" | "viewer"
      pipeline_stage:
        | "lead"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
        | "prospect"
        | "researched"
        | "contacted"
        | "engaged"
        | "discovery_scheduled"
        | "discovery_held"
        | "proposal_sent"
        | "project_kickoff"
        | "in_delivery"
        | "launched"
        | "case_study"
        | "referral"
      priority_level: "low" | "normal" | "high" | "critical"
      project_status:
        | "proposed"
        | "planned"
        | "active"
        | "at_risk"
        | "blocked"
        | "completed"
        | "archived"
      proposal_status: "draft" | "sent" | "accepted" | "declined" | "expired"
      referral_status: "new" | "introduced" | "in_progress" | "won" | "lost"
      sam_learning_event_type:
        | "recommendation_accepted"
        | "recommendation_rejected"
        | "recommendation_edited"
        | "recommendation_ignored"
        | "memory_confirmed"
        | "memory_corrected"
        | "memory_rejected"
        | "memory_disputed"
        | "memory_expired"
        | "outcome_completed"
        | "outcome_failed"
        | "outcome_superseded"
        | "workflow_run_completed"
        | "workflow_run_failed"
        | "workflow_marked_useful"
        | "workflow_marked_partially_useful"
        | "workflow_marked_not_useful"
        | "workflow_marked_incorrect"
        | "workflow_marked_missing_context"
      sam_memory_feedback_type:
        | "accurate"
        | "inaccurate"
        | "incomplete"
        | "outdated"
        | "disputed"
      sam_memory_kind:
        | "working"
        | "episodic"
        | "semantic"
        | "operational"
        | "strategic"
      sam_memory_layer:
        | "founder"
        | "organization"
        | "venture"
        | "operational"
        | "historical"
        | "preference"
      sam_memory_source_type:
        | "manual"
        | "profile"
        | "organization_settings"
        | "venture_settings"
        | "knowledge_record"
        | "decision"
        | "commitment"
        | "goal"
        | "conversation"
        | "correction"
        | "proposal"
        | "integration"
      sam_memory_status:
        | "proposed"
        | "confirmed"
        | "disputed"
        | "outdated"
        | "superseded"
        | "archived"
      sam_response_feedback_type:
        | "helpful"
        | "not_helpful"
        | "partially_helpful"
        | "incorrect"
        | "missing_context"
      sam_workflow_feedback_type:
        | "useful"
        | "partially_useful"
        | "not_useful"
        | "incorrect"
        | "missing_context"
      sam_workflow_finding_type:
        | "observation"
        | "priority"
        | "risk"
        | "opportunity"
        | "blocker"
        | "decision_needed"
        | "commitment_issue"
        | "goal_issue"
        | "contradiction"
        | "recommendation"
        | "missing_information"
      sam_workflow_severity:
        | "informational"
        | "low"
        | "medium"
        | "high"
        | "critical"
      sam_workflow_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "archived"
      sam_workflow_trigger: "manual" | "scheduled_future" | "system_future"
      sam_workflow_type:
        | "daily_briefing"
        | "weekly_review"
        | "decision_review"
        | "commitment_review"
        | "priority_planning"
        | "risk_review"
        | "goal_alignment"
        | "venture_health"
        | "organization_health"
      task_status:
        | "backlog"
        | "ready"
        | "in_progress"
        | "waiting"
        | "blocked"
        | "completed"
        | "canceled"
      venture_status:
        | "idea"
        | "active"
        | "paused"
        | "at_risk"
        | "closed"
        | "archived"
      verification_status: "unverified" | "verified" | "outdated" | "disputed"
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
      billing_collection_method: ["send_invoice", "charge_automatically"],
      billing_event_type: [
        "customer_created",
        "invoice_created",
        "invoice_finalized",
        "invoice_sent",
        "invoice_payment_failed",
        "setup_deposit_paid",
        "onboarding_payment_complete",
        "setup_final_paid",
        "ready_for_go_live",
        "subscription_created",
        "subscription_updated",
        "subscription_canceled",
        "recurring_billing_active",
        "refund_issued",
        "delivery_project_created",
        "client_activated",
        "delivery_ready_to_start",
      ],
      billing_invoice_status: [
        "draft",
        "open",
        "paid",
        "uncollectible",
        "void",
        "refunded",
        "partially_refunded",
      ],
      billing_invoice_type: [
        "setup_deposit",
        "setup_final",
        "subscription",
        "adjustment",
      ],
      billing_payment_status: [
        "pending",
        "succeeded",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      billing_subscription_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
      billing_webhook_processing_status: [
        "received",
        "processing",
        "processed",
        "failed",
      ],
      cashflow_direction: ["inflow", "outflow"],
      client_account_role: ["client_admin", "client_user"],
      client_account_status: ["active", "deactivated"],
      client_document_status: [
        "requested",
        "uploaded",
        "needs_revision",
        "approved",
        "archived",
      ],
      client_document_visibility: [
        "internal_only",
        "client_visible",
        "client_uploaded",
      ],
      client_onboarding_item_type: [
        "company_information",
        "contact_information",
        "service_area",
        "business_hours",
        "brand_assets",
        "system_access",
        "existing_software",
        "required_document",
        "approval",
        "other",
      ],
      client_onboarding_owner: ["client", "northstar"],
      client_onboarding_status: [
        "not_started",
        "in_progress",
        "submitted",
        "needs_revision",
        "approved",
        "blocked",
        "not_applicable",
      ],
      client_status: ["active", "paused", "churned", "onboarding"],
      commitment_status: [
        "open",
        "in_progress",
        "waiting",
        "overdue",
        "completed",
        "canceled",
      ],
      content_freshness_status: [
        "fresh",
        "aging",
        "stale",
        "inaccessible",
        "unknown",
      ],
      content_verification_status: [
        "unverified",
        "reviewed",
        "verified",
        "disputed",
        "rejected",
      ],
      conversation_message_role: ["user", "operator", "system", "tool"],
      decision_status: [
        "draft",
        "under_review",
        "waiting_for_founder",
        "decided",
        "revisit_later",
        "closed",
      ],
      document_processing_status: [
        "uploaded",
        "pending",
        "processing",
        "ready",
        "failed",
      ],
      goal_status: [
        "proposed",
        "active",
        "at_risk",
        "achieved",
        "missed",
        "paused",
        "archived",
      ],
      graph_entity_type: [
        "organization",
        "profile",
        "member",
        "venture",
        "project",
        "task",
        "goal",
        "decision",
        "commitment",
        "knowledge",
        "document",
        "memory",
        "activity",
      ],
      graph_relationship_type: [
        "belongs_to",
        "supports",
        "blocks",
        "depends_on",
        "advances",
        "contradicts",
        "informs",
        "derived_from",
        "related_to",
        "assigned_to",
        "owned_by",
        "supersedes",
        "caused",
        "resulted_in",
        "references",
      ],
      insight_priority: ["low", "normal", "high", "critical"],
      insight_severity: [
        "information",
        "attention",
        "warning",
        "critical",
        "opportunity",
      ],
      insight_status: ["active", "dismissed", "resolved", "expired"],
      integration_connection_status: [
        "pending",
        "active",
        "error",
        "disabled",
        "archived",
      ],
      integration_connection_type: [
        "website",
        "database",
        "rest",
        "webhook",
        "file_import",
        "api_token",
      ],
      integration_provider: [
        "website",
        "supabase",
        "rest_api",
        "webhook",
        "csv_import",
        "json_import",
        "api_token",
        "other",
      ],
      integration_source_type: [
        "webpage",
        "sitemap",
        "blog",
        "docs",
        "db_table",
        "rest_endpoint",
        "webhook_topic",
        "csv_file",
        "json_file",
        "manual",
        "other",
      ],
      integration_status: [
        "disconnected",
        "pending",
        "connected",
        "error",
        "paused",
      ],
      integration_sync_status: [
        "queued",
        "running",
        "succeeded",
        "partial",
        "failed",
        "cancelled",
      ],
      knowledge_type: [
        "founder_profile",
        "venture_knowledge",
        "person",
        "policy",
        "brand_guideline",
        "strategy",
        "research",
        "meeting_note",
        "conversation_summary",
        "operating_procedure",
        "general",
      ],
      member_status: ["invited", "active", "suspended", "removed"],
      nsl_proposal_status: [
        "draft",
        "internal_review",
        "approved",
        "ready_to_send",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "superseded",
        "cancelled",
      ],
      operator_kind: ["hunter", "builder"],
      operator_task_priority: ["low", "normal", "high", "urgent"],
      operator_task_status: [
        "queued",
        "in_progress",
        "needs_approval",
        "blocked",
        "done",
        "cancelled",
      ],
      org_role: ["owner", "admin", "executive", "member", "viewer"],
      pipeline_stage: [
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
        "prospect",
        "researched",
        "contacted",
        "engaged",
        "discovery_scheduled",
        "discovery_held",
        "proposal_sent",
        "project_kickoff",
        "in_delivery",
        "launched",
        "case_study",
        "referral",
      ],
      priority_level: ["low", "normal", "high", "critical"],
      project_status: [
        "proposed",
        "planned",
        "active",
        "at_risk",
        "blocked",
        "completed",
        "archived",
      ],
      proposal_status: ["draft", "sent", "accepted", "declined", "expired"],
      referral_status: ["new", "introduced", "in_progress", "won", "lost"],
      sam_learning_event_type: [
        "recommendation_accepted",
        "recommendation_rejected",
        "recommendation_edited",
        "recommendation_ignored",
        "memory_confirmed",
        "memory_corrected",
        "memory_rejected",
        "memory_disputed",
        "memory_expired",
        "outcome_completed",
        "outcome_failed",
        "outcome_superseded",
        "workflow_run_completed",
        "workflow_run_failed",
        "workflow_marked_useful",
        "workflow_marked_partially_useful",
        "workflow_marked_not_useful",
        "workflow_marked_incorrect",
        "workflow_marked_missing_context",
      ],
      sam_memory_feedback_type: [
        "accurate",
        "inaccurate",
        "incomplete",
        "outdated",
        "disputed",
      ],
      sam_memory_kind: [
        "working",
        "episodic",
        "semantic",
        "operational",
        "strategic",
      ],
      sam_memory_layer: [
        "founder",
        "organization",
        "venture",
        "operational",
        "historical",
        "preference",
      ],
      sam_memory_source_type: [
        "manual",
        "profile",
        "organization_settings",
        "venture_settings",
        "knowledge_record",
        "decision",
        "commitment",
        "goal",
        "conversation",
        "correction",
        "proposal",
        "integration",
      ],
      sam_memory_status: [
        "proposed",
        "confirmed",
        "disputed",
        "outdated",
        "superseded",
        "archived",
      ],
      sam_response_feedback_type: [
        "helpful",
        "not_helpful",
        "partially_helpful",
        "incorrect",
        "missing_context",
      ],
      sam_workflow_feedback_type: [
        "useful",
        "partially_useful",
        "not_useful",
        "incorrect",
        "missing_context",
      ],
      sam_workflow_finding_type: [
        "observation",
        "priority",
        "risk",
        "opportunity",
        "blocker",
        "decision_needed",
        "commitment_issue",
        "goal_issue",
        "contradiction",
        "recommendation",
        "missing_information",
      ],
      sam_workflow_severity: [
        "informational",
        "low",
        "medium",
        "high",
        "critical",
      ],
      sam_workflow_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "archived",
      ],
      sam_workflow_trigger: ["manual", "scheduled_future", "system_future"],
      sam_workflow_type: [
        "daily_briefing",
        "weekly_review",
        "decision_review",
        "commitment_review",
        "priority_planning",
        "risk_review",
        "goal_alignment",
        "venture_health",
        "organization_health",
      ],
      task_status: [
        "backlog",
        "ready",
        "in_progress",
        "waiting",
        "blocked",
        "completed",
        "canceled",
      ],
      venture_status: [
        "idea",
        "active",
        "paused",
        "at_risk",
        "closed",
        "archived",
      ],
      verification_status: ["unverified", "verified", "outdated", "disputed"],
    },
  },
} as const
