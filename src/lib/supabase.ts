import { createClient } from '@supabase/supabase-js'

// Use environment variables with fallbacks for demo purposes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      company_users: {
        Row: {
          id: string
          email: string
          company_id: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          company_id: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          company_id?: string
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          date: string | null
          location: string | null
          max_attendees: number | null
          registration_qr: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          date?: string | null
          location?: string | null
          max_attendees?: number | null
          registration_qr?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          date?: string | null
          location?: string | null
          max_attendees?: number | null
          registration_qr?: string | null
          created_at?: string
        }
      }
      attendees: {
        Row: {
          id: string
          event_id: string
          name: string
          email: string | null
          phone: string | null
          identification_number: string
          staff_id: string | null
          table_assignment: string | null
          table_number: number | null
          seat_number: number | null
          qr_code: string | null
          checked_in: boolean | null
          check_in_time: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          email?: string | null
          phone?: string | null
          identification_number: string
          staff_id?: string | null
          table_assignment?: string | null
          table_number?: number | null
          seat_number?: number | null
          qr_code?: string | null
          checked_in?: boolean | null
          check_in_time?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          identification_number?: string
          staff_id?: string | null
          table_assignment?: string | null
          table_number?: number | null
          seat_number?: number | null
          qr_code?: string | null
          checked_in?: boolean | null
          check_in_time?: string | null
          created_at?: string
        }
      }
      gallery_photos: {
        Row: {
          id: string
          event_id: string
          attendee_name: string | null
          photo_url: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          attendee_name?: string | null
          photo_url: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          attendee_name?: string | null
          photo_url?: string
          created_at?: string
        }
      }
      tables: {
        Row: {
          id: string
          event_id: string
          table_number: number
          table_type: string | null
          capacity: number | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          table_number: number
          table_type?: string | null
          capacity?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          table_number?: number
          table_type?: string | null
          capacity?: number | null
          created_at?: string
        }
      }
      voting_sessions: {
        Row: {
          id: string
          event_id: string
          title: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          title: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          title?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      voting_photos: {
        Row: {
          id: string
          voting_session_id: string
          title: string
          photo_url: string
          created_at: string
        }
        Insert: {
          id?: string
          voting_session_id: string
          title: string
          photo_url: string
          created_at?: string
        }
        Update: {
          id?: string
          voting_session_id?: string
          title?: string
          photo_url?: string
          created_at?: string
        }
      }
      votes: {
        Row: {
          id: string
          voting_photo_id: string
          attendee_id: string
          created_at: string
        }
        Insert: {
          id?: string
          voting_photo_id: string
          attendee_id: string
          created_at?: string
        }
        Update: {
          id?: string
          voting_photo_id?: string
          attendee_id?: string
          created_at?: string
        }
      }
    }
  }
}