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

// Utility function to get Supabase storage URL
export const getStorageUrl = (path: string, bucket: string = 'images'): string => {
  if (!path) return ''
  
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  // If it's a blob URL, return as is
  if (path.startsWith('blob:')) {
    return path
  }
  
  // If it's a data URL, return as is
  if (path.startsWith('data:')) {
    return path
  }
  
  // Otherwise, construct Supabase storage URL
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}

// Utility function to upload image to Supabase storage
export const uploadImage = async (file: File, path: string, bucket: string = 'images'): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) throw error
    
    return getStorageUrl(data.path, bucket)
  } catch (error) {
    console.error('Error uploading image:', error)
    throw error
  }
}

// Utility function to delete image from Supabase storage
export const deleteImage = async (path: string, bucket: string = 'images'): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])
    
    if (error) throw error
  } catch (error) {
    console.error('Error deleting image:', error)
    throw error
  }
}

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