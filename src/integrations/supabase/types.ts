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
      absences: {
        Row: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          payload: Json | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          payload?: Json | null
          resolved_at?: string | null
          severity: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          payload?: Json | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_absences: {
        Row: {
          absence_type: string
          approved_at: string
          approved_by: string
          category: string
          company_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          time_change: string | null
          user_id: string
        }
        Insert: {
          absence_type: string
          approved_at?: string
          approved_by: string
          category?: string
          company_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          time_change?: string | null
          user_id: string
        }
        Update: {
          absence_type?: string
          approved_at?: string
          approved_by?: string
          category?: string
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          time_change?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_absences_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_absences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acting_as_user_id: string | null
          action: string
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: unknown
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          acting_as_user_id?: string | null
          action: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          acting_as_user_id?: string | null
          action?: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: number
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: number
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: number
          used?: boolean
        }
        Relationships: []
      }
      centers: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          description: string | null
          geojson: Json | null
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          geojson?: Json | null
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          geojson?: Json | null
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_in_reminders: {
        Row: {
          created_at: string
          date: string
          id: string
          shift_start_time: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          shift_start_time: string
          worker_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          shift_start_time?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_in_reminders_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_points: {
        Row: {
          active: boolean | null
          center: string | null
          company_id: string
          created_at: string | null
          id: string
          last_clock: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          center?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          last_clock?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          center?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          last_clock?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string | null
          created_at: string
          employee_count: number | null
          entry_early_minutes: number
          entry_late_minutes: number
          exit_early_minutes: number
          exit_late_minutes: number
          holiday_region: string
          hq_lat: number | null
          hq_lng: number | null
          id: string
          keep_sessions_days: number
          keep_sessions_open: boolean
          kiosk_mode: string
          legal_address: string | null
          legal_name: string | null
          legal_representative_id: string | null
          legal_representative_name: string | null
          logo_url: string | null
          max_shift_hours: number | null
          name: string
          owner_email: string | null
          owner_user_id: string | null
          pauses_enabled: boolean
          phone: string | null
          plan: string
          policies: Json | null
          sector: string | null
          status: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          employee_count?: number | null
          entry_early_minutes?: number
          entry_late_minutes?: number
          exit_early_minutes?: number
          exit_late_minutes?: number
          holiday_region?: string
          hq_lat?: number | null
          hq_lng?: number | null
          id?: string
          keep_sessions_days?: number
          keep_sessions_open?: boolean
          kiosk_mode?: string
          legal_address?: string | null
          legal_name?: string | null
          legal_representative_id?: string | null
          legal_representative_name?: string | null
          logo_url?: string | null
          max_shift_hours?: number | null
          name: string
          owner_email?: string | null
          owner_user_id?: string | null
          pauses_enabled?: boolean
          phone?: string | null
          plan?: string
          policies?: Json | null
          sector?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          employee_count?: number | null
          entry_early_minutes?: number
          entry_late_minutes?: number
          exit_early_minutes?: number
          exit_late_minutes?: number
          holiday_region?: string
          hq_lat?: number | null
          hq_lng?: number | null
          id?: string
          keep_sessions_days?: number
          keep_sessions_open?: boolean
          kiosk_mode?: string
          legal_address?: string | null
          legal_name?: string | null
          legal_representative_id?: string | null
          legal_representative_name?: string | null
          logo_url?: string | null
          max_shift_hours?: number | null
          name?: string
          owner_email?: string | null
          owner_user_id?: string | null
          pauses_enabled?: boolean
          phone?: string | null
          plan?: string
          policies?: Json | null
          sector?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_compliance_settings: {
        Row: {
          allow_outside_schedule: boolean
          allowed_checkin_end: string | null
          allowed_checkin_start: string | null
          company_id: string
          created_at: string
          id: string
          max_month_hours: number | null
          max_week_hours: number | null
          min_hours_between_shifts: number | null
          updated_at: string
        }
        Insert: {
          allow_outside_schedule?: boolean
          allowed_checkin_end?: string | null
          allowed_checkin_start?: string | null
          company_id: string
          created_at?: string
          id?: string
          max_month_hours?: number | null
          max_week_hours?: number | null
          min_hours_between_shifts?: number | null
          updated_at?: string
        }
        Update: {
          allow_outside_schedule?: boolean
          allowed_checkin_end?: string | null
          allowed_checkin_start?: string | null
          company_id?: string
          created_at?: string
          id?: string
          max_month_hours?: number | null
          max_week_hours?: number | null
          min_hours_between_shifts?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_compliance_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_day_rules: {
        Row: {
          allow_sunday_clock: boolean
          company_id: string
          created_at: string
          holiday_clock_policy: string
          id: string
          special_day_policy: string
          updated_at: string
        }
        Insert: {
          allow_sunday_clock?: boolean
          company_id: string
          created_at?: string
          holiday_clock_policy?: string
          id?: string
          special_day_policy?: string
          updated_at?: string
        }
        Update: {
          allow_sunday_clock?: boolean
          company_id?: string
          created_at?: string
          holiday_clock_policy?: string
          id?: string
          special_day_policy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_day_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_holidays: {
        Row: {
          company_id: string
          created_at: string | null
          holiday_date: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          holiday_date: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          holiday_date?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_signups: {
        Row: {
          company_payload: Json
          created_at: string
          created_company_id: string | null
          email: string
          email_verify_token: string
          expires_at: string
          full_name: string | null
          id: string
          ip: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          company_payload?: Json
          created_at?: string
          created_company_id?: string | null
          email: string
          email_verify_token: string
          expires_at: string
          full_name?: string | null
          id?: string
          ip?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          company_payload?: Json
          created_at?: string
          created_company_id?: string | null
          email?: string
          email_verify_token?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          ip?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_signups_created_company_id_fkey"
            columns: ["created_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_special_days: {
        Row: {
          company_id: string
          created_at: string
          date: string
          id: string
          is_special: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          id?: string
          is_special?: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          is_special?: boolean
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_special_days_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          metadata: Json | null
          revoked_at: string | null
          text_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          metadata?: Json | null
          revoked_at?: string | null
          text_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          metadata?: Json | null
          revoked_at?: string | null
          text_version?: string
          user_id?: string
        }
        Relationships: []
      }
      correction_requests: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          payload: Json
          reason: string | null
          status: string
          submitted_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          payload: Json
          reason?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          payload?: Json
          reason?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          device_id: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          center_id: string | null
          company_id: string
          created_at: string
          id: string
          last_seen_at: string | null
          meta: Json | null
          name: string
          secret_hash: string | null
          type: string
        }
        Insert: {
          center_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          meta?: Json | null
          name: string
          secret_hash?: string | null
          type: string
        }
        Update: {
          center_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          meta?: Json | null
          name?: string
          secret_hash?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string
          company_id: string
          description: string | null
          document_date: string | null
          expires_at: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string
          title: string
          uploaded_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          category: string
          company_id: string
          description?: string | null
          document_date?: string | null
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path: string
          title: string
          uploaded_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          category?: string
          company_id?: string
          description?: string | null
          document_date?: string | null
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string
          title?: string
          uploaded_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_revisions: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          event_id: string
          hash: string | null
          id: string
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          event_id: string
          hash?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          event_id?: string
          hash?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      fastclock_points: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string | null
          radius_meters: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name?: string | null
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string | null
          radius_meters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fastclock_points_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          incident_date: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["incident_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          incident_date: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          incident_date?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          center_id: string | null
          company_id: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          role: string
          status: string
          team_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          center_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          id?: string
          role: string
          status?: string
          team_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          center_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          status?: string
          team_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      login_code_requests: {
        Row: {
          email: string
          id: string
          ip: string | null
          profile_id: string
          requested_at: string
          user_agent: string | null
        }
        Insert: {
          email: string
          id?: string
          ip?: string | null
          profile_id: string
          requested_at?: string
          user_agent?: string | null
        }
        Update: {
          email?: string
          id?: string
          ip?: string | null
          profile_id?: string
          requested_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_code_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_signoffs: {
        Row: {
          center_id: string | null
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          month: number
          signature: Json | null
          signed_at: string | null
          status: string
          summary_hash: string | null
          user_id: string
          year: number
        }
        Insert: {
          center_id?: string | null
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          month: number
          signature?: Json | null
          signed_at?: string | null
          status?: string
          summary_hash?: string | null
          user_id: string
          year: number
        }
        Update: {
          center_id?: string | null
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          month?: number
          signature?: Json | null
          signed_at?: string | null
          status?: string
          summary_hash?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      nfc_cards: {
        Row: {
          active: boolean
          card_uid: string | null
          card_uid_normalized: string
          company_id: string
          created_at: string
          empleado_id: string | null
          id: string
          label: string | null
          uid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          card_uid?: string | null
          card_uid_normalized: string
          company_id: string
          created_at?: string
          empleado_id?: string | null
          id?: string
          label?: string | null
          uid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          card_uid?: string | null
          card_uid_normalized?: string
          company_id?: string
          created_at?: string
          empleado_id?: string | null
          id?: string
          label?: string | null
          uid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_cards_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          company_id: string
          id: string
          notify_absence_requests: boolean
          notify_clock_alerts: boolean
          notify_correction_requests: boolean
          notify_general: boolean
          scope_filter: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          notify_absence_requests?: boolean
          notify_clock_alerts?: boolean
          notify_correction_requests?: boolean
          notify_general?: boolean
          scope_filter?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          notify_absence_requests?: boolean
          notify_clock_alerts?: boolean
          notify_correction_requests?: boolean
          notify_general?: boolean
          scope_filter?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_code: string | null
          avatar_url: string | null
          center_id: string | null
          created_at: string
          email: string
          full_name: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          is_superadmin: boolean
          login_code: string | null
          onboarding_completed_at: string | null
          team_id: string | null
          updated_at: string
          vacation_days_override: number | null
        }
        Insert: {
          access_code?: string | null
          avatar_url?: string | null
          center_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          hire_date?: string | null
          id: string
          is_active?: boolean
          is_superadmin?: boolean
          login_code?: string | null
          onboarding_completed_at?: string | null
          team_id?: string | null
          updated_at?: string
          vacation_days_override?: number | null
        }
        Update: {
          access_code?: string | null
          avatar_url?: string | null
          center_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          is_superadmin?: boolean
          login_code?: string | null
          onboarding_completed_at?: string | null
          team_id?: string | null
          updated_at?: string
          vacation_days_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_jobs: {
        Row: {
          deleted_count: number
          dry_run: boolean
          id: string
          log: string | null
          run_at: string
          status: string
        }
        Insert: {
          deleted_count?: number
          dry_run?: boolean
          id?: string
          log?: string | null
          run_at?: string
          status?: string
        }
        Update: {
          deleted_count?: number
          dry_run?: boolean
          id?: string
          log?: string | null
          run_at?: string
          status?: string
        }
        Relationships: []
      }
      schedule_adjustments_history: {
        Row: {
          applied_from: string
          changed_at: string
          changed_by: string | null
          company_id: string
          created_by: string | null
          end_time: string | null
          expected_hours: number
          id: string
          reason: string | null
          start_time: string | null
          user_id: string
        }
        Insert: {
          applied_from: string
          changed_at?: string
          changed_by?: string | null
          company_id: string
          created_by?: string | null
          end_time?: string | null
          expected_hours: number
          id?: string
          reason?: string | null
          start_time?: string | null
          user_id: string
        }
        Update: {
          applied_from?: string
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          created_by?: string | null
          end_time?: string | null
          expected_hours?: number
          id?: string
          reason?: string | null
          start_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_adjustments_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_adjustments_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_adjustments_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          friday: Json | null
          id: string
          monday: Json | null
          name: string
          saturday: Json | null
          skip_holidays: boolean
          sunday: Json | null
          thursday: Json | null
          tuesday: Json | null
          updated_at: string
          wednesday: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          friday?: Json | null
          id?: string
          monday?: Json | null
          name: string
          saturday?: Json | null
          skip_holidays?: boolean
          sunday?: Json | null
          thursday?: Json | null
          tuesday?: Json | null
          updated_at?: string
          wednesday?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          friday?: Json | null
          id?: string
          monday?: Json | null
          name?: string
          saturday?: Json | null
          skip_holidays?: boolean
          sunday?: Json | null
          thursday?: Json | null
          tuesday?: Json | null
          updated_at?: string
          wednesday?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_hours: {
        Row: {
          afternoon_start_time: string | null
          company_id: string
          created_at: string
          created_by: string
          date: string
          end_time: string | null
          expected_hours: number
          id: string
          morning_end_time: string | null
          notes: string | null
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          afternoon_start_time?: string | null
          company_id: string
          created_at?: string
          created_by: string
          date: string
          end_time?: string | null
          expected_hours?: number
          id?: string
          morning_end_time?: string | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          afternoon_start_time?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          date?: string
          end_time?: string | null
          expected_hours?: number
          id?: string
          morning_end_time?: string | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_hours_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_reports: {
        Row: {
          company_id: string
          content_hash: string
          generated_at: string
          generated_by: string | null
          generated_by_email: string | null
          id: string
          notes: string | null
          payload: Json
          period_end: string
          period_start: string
          report_type: string
          scope: string
          signature: string
          user_id: string | null
          verification_token: string
        }
        Insert: {
          company_id: string
          content_hash: string
          generated_at?: string
          generated_by?: string | null
          generated_by_email?: string | null
          id?: string
          notes?: string | null
          payload: Json
          period_end: string
          period_start: string
          report_type?: string
          scope?: string
          signature: string
          user_id?: string | null
          verification_token: string
        }
        Update: {
          company_id?: string
          content_hash?: string
          generated_at?: string
          generated_by?: string | null
          generated_by_email?: string | null
          id?: string
          notes?: string | null
          payload?: Json
          period_end?: string
          period_start?: string
          report_type?: string
          scope?: string
          signature?: string
          user_id?: string | null
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          center_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          center_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          center_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_duration: string | null
          new_end_time: string | null
          new_start_time: string | null
          old_duration: string | null
          old_end_time: string | null
          old_start_time: string | null
          reason: string | null
          time_entry_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_duration?: string | null
          new_end_time?: string | null
          new_start_time?: string | null
          old_duration?: string | null
          old_end_time?: string | null
          old_start_time?: string | null
          reason?: string | null
          time_entry_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_duration?: string | null
          new_end_time?: string | null
          new_start_time?: string | null
          old_duration?: string | null
          old_end_time?: string | null
          old_start_time?: string | null
          reason?: string | null
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_log_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      time_events: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string
          device_id: string | null
          distance_meters: number | null
          event_time: string
          event_type: Database["public"]["Enums"]["time_event_type"]
          id: string
          is_within_geofence: boolean | null
          latitude: number | null
          longitude: number | null
          meta: Json | null
          notes: string | null
          original_event_time: string | null
          photo_url: string | null
          point_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string
          device_id?: string | null
          distance_meters?: number | null
          event_time?: string
          event_type: Database["public"]["Enums"]["time_event_type"]
          id?: string
          is_within_geofence?: boolean | null
          latitude?: number | null
          longitude?: number | null
          meta?: Json | null
          notes?: string | null
          original_event_time?: string | null
          photo_url?: string | null
          point_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string
          device_id?: string | null
          distance_meters?: number | null
          event_time?: string
          event_type?: Database["public"]["Enums"]["time_event_type"]
          id?: string
          is_within_geofence?: boolean | null
          latitude?: number | null
          longitude?: number | null
          meta?: Json | null
          notes?: string | null
          original_event_time?: string | null
          photo_url?: string | null
          point_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "fastclock_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajadores_rows: {
        Row: {
          activo: boolean
          company_id: string
          id: string
          nombre_completo: string | null
          numero_logico: number | null
        }
        Insert: {
          activo?: boolean
          company_id: string
          id: string
          nombre_completo?: string | null
          numero_logico?: number | null
        }
        Update: {
          activo?: boolean
          company_id?: string
          id?: string
          nombre_completo?: string | null
          numero_logico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trabajadores_rows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajadores_rows_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_policies: {
        Row: {
          annual_days: number
          block_over_balance: boolean
          carry_over: string
          carry_over_until_month: number | null
          company_id: string
          count_type: string
          fiscal_year_start: string
          updated_at: string | null
        }
        Insert: {
          annual_days?: number
          block_over_balance?: boolean
          carry_over?: string
          carry_over_until_month?: number | null
          company_id: string
          count_type?: string
          fiscal_year_start?: string
          updated_at?: string | null
        }
        Update: {
          annual_days?: number
          block_over_balance?: boolean
          carry_over?: string
          carry_over_until_month?: number | null
          company_id?: string
          count_type?: string
          fiscal_year_start?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacation_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          changed_by: string | null
          clock_in_time: string
          clock_out_time: string | null
          company_id: string
          corrected_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_corrected: boolean
          point_id: string | null
          review_status: string
          source: string | null
          status: string | null
          total_hours: number | null
          total_pause_duration: string | null
          total_work_duration: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          clock_in_time: string
          clock_out_time?: string | null
          company_id: string
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_corrected?: boolean
          point_id?: string | null
          review_status?: string
          source?: string | null
          status?: string | null
          total_hours?: number | null
          total_pause_duration?: string | null
          total_work_duration?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          clock_in_time?: string
          clock_out_time?: string | null
          company_id?: string
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_corrected?: boolean
          point_id?: string | null
          review_status?: string
          source?: string | null
          status?: string | null
          total_hours?: number | null
          total_pause_duration?: string | null
          total_work_duration?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "fastclock_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_day_rules: {
        Row: {
          allow_sunday_clock: boolean | null
          company_id: string
          created_at: string
          holiday_clock_policy: string | null
          id: string
          special_day_policy: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_sunday_clock?: boolean | null
          company_id: string
          created_at?: string
          holiday_clock_policy?: string | null
          id?: string
          special_day_policy?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_sunday_clock?: boolean | null
          company_id?: string
          created_at?: string
          holiday_clock_policy?: string | null
          id?: string
          special_day_policy?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_day_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_day_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_devices: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          device_id: string
          id: string
          last_used_at: string | null
          point_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          device_id: string
          id?: string
          last_used_at?: string | null
          point_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          device_id?: string
          id?: string
          last_used_at?: string | null
          point_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_devices_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "fastclock_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_signed_acceptances: {
        Row: {
          company_id: string
          dni_snapshot: string | null
          document_hash: string
          document_html: string
          document_title: string
          document_type: string
          full_name_snapshot: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          ip: string | null
          notes: string | null
          signature_image: string
          signed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          dni_snapshot?: string | null
          document_hash: string
          document_html: string
          document_title: string
          document_type: string
          full_name_snapshot?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ip?: string | null
          notes?: string | null
          signature_image: string
          signed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          dni_snapshot?: string | null
          document_hash?: string
          document_html?: string
          document_title?: string
          document_type?: string
          full_name_snapshot?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ip?: string | null
          notes?: string | null
          signature_image?: string
          signed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_signed_acceptances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_signed_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      reports_sanitized: {
        Row: {
          company_id: string | null
          created_at: string | null
          device_id: string | null
          event_time: string | null
          event_type: Database["public"]["Enums"]["time_event_type"] | null
          id: string | null
          meta_sanitized: Json | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          device_id?: string | null
          event_time?: string | null
          event_type?: Database["public"]["Enums"]["time_event_type"] | null
          id?: string | null
          meta_sanitized?: never
          source?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          device_id?: string | null
          event_time?: string | null
          event_type?: Database["public"]["Enums"]["time_event_type"] | null
          id?: string | null
          meta_sanitized?: never
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_schedule_template: {
        Args: {
          p_end_date: string
          p_overwrite?: boolean
          p_start_date: string
          p_template_id: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      approve_company_signup: {
        Args: { p_signup_id: string; p_user_id: string }
        Returns: Json
      }
      autoclose_stale_sessions: { Args: never; Returns: number }
      check_company_active: { Args: { p_company_id: string }; Returns: boolean }
      count_vacation_days_between: {
        Args: {
          p_company_id: string
          p_count_type: string
          p_end: string
          p_start: string
        }
        Returns: number
      }
      create_auth_code: { Args: { p_email: string }; Returns: string }
      delete_time_event_with_reason: {
        Args: { p_event_id: string; p_reason: string }
        Returns: undefined
      }
      generate_login_code: { Args: never; Returns: string }
      get_user_role: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_vacation_balance: {
        Args: { p_company_id: string; p_user_id: string; p_year?: number }
        Returns: {
          accrued_days: number
          assigned_days: number
          available_days: number
          pending_days: number
          used_days: number
        }[]
      }
      has_company_membership: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: never; Returns: boolean }
      kiosk_device_by_pin: { Args: { p_pin: string }; Returns: Json }
      kiosk_employee_by_code: {
        Args: { p_code: string; p_pin: string }
        Returns: Json
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_company_id: string
          p_diff?: Json
          p_entity_id: string
          p_entity_type: string
          p_reason?: string
        }
        Returns: string
      }
      nfc_kiosk_clock: {
        Args: { p_company_id: string; p_event_time?: string; p_raw_uid: string }
        Returns: Json
      }
      set_compliance_settings: {
        Args: {
          _allow_outside_schedule: boolean
          _allowed_checkin_end: string
          _allowed_checkin_start: string
          _company_id: string
          _max_month_hours: number
          _max_week_hours: number
          _min_hours_between_shifts: number
        }
        Returns: {
          allow_outside_schedule: boolean
          allowed_checkin_end: string | null
          allowed_checkin_start: string | null
          company_id: string
          created_at: string
          id: string
          max_month_hours: number | null
          max_week_hours: number | null
          min_hours_between_shifts: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_compliance_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_geofence: {
        Args: {
          p_center_id: string
          p_company_id: string
          p_latitude: number
          p_longitude: number
        }
        Returns: boolean
      }
      verify_auth_code: {
        Args: { p_code: string; p_email: string }
        Returns: boolean
      }
    }
    Enums: {
      absence_status: "pending" | "approved" | "rejected"
      absence_type: "vacation" | "sick_leave" | "personal" | "other"
      day_type: "working" | "holiday" | "special"
      incident_status: "pending" | "resolved" | "dismissed"
      incident_type:
        | "late_arrival"
        | "early_departure"
        | "missing_clock"
        | "other"
      shift_role: "worker" | "backup"
      shift_status: "planned" | "published" | "cancelled"
      time_event_type: "clock_in" | "clock_out" | "pause_start" | "pause_end"
      user_role: "owner" | "admin" | "manager" | "worker"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      absence_status: ["pending", "approved", "rejected"],
      absence_type: ["vacation", "sick_leave", "personal", "other"],
      day_type: ["working", "holiday", "special"],
      incident_status: ["pending", "resolved", "dismissed"],
      incident_type: [
        "late_arrival",
        "early_departure",
        "missing_clock",
        "other",
      ],
      shift_role: ["worker", "backup"],
      shift_status: ["planned", "published", "cancelled"],
      time_event_type: ["clock_in", "clock_out", "pause_start", "pause_end"],
      user_role: ["owner", "admin", "manager", "worker"],
    },
  },
} as const
