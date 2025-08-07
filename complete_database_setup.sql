-- =====================================================
-- COMPLETE DATABASE SETUP FOR EM-V1
-- This file contains all SQL migrations and fixes merged into one
-- =====================================================

-- =====================================================
-- 1. CREATE ALL TABLES
-- =====================================================

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    person_in_charge TEXT,
    contact_number TEXT,
    email TEXT,
    logo TEXT,
    features_enabled JSONB DEFAULT '{"registration": true, "checkin": true, "voting": true, "welcoming": true, "quiz": true, "lucky_draw": true, "gallery": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Company users table
CREATE TABLE IF NOT EXISTS company_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    date TIMESTAMP WITH TIME ZONE,
    location TEXT,
    max_attendees INTEGER,
    registration_qr TEXT,
    offline_qr TEXT,
    custom_background TEXT,
    custom_logo TEXT,
    max_gallery_uploads INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mode TEXT DEFAULT 'hybrid',
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Attendees table
CREATE TABLE IF NOT EXISTS attendees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    identification_number TEXT NOT NULL,
    staff_id TEXT,
    table_assignment TEXT,
    table_type TEXT DEFAULT 'regular',
    checked_in BOOLEAN DEFAULT false,
    check_in_time TIMESTAMP WITH TIME ZONE,
    table_number INTEGER,
    seat_number INTEGER,
    face_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Lucky draw winners table
CREATE TABLE IF NOT EXISTS lucky_draw_winners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES attendees(id) ON DELETE SET NULL,
    winner_name TEXT NOT NULL,
    winner_company TEXT,
    table_number INTEGER,
    is_table_winner BOOLEAN DEFAULT false,
    table_type TEXT,
    prize_id TEXT,
    prize_title TEXT,
    prize_description TEXT,
    prize_position INTEGER,
    draw_type TEXT DEFAULT 'regular',
    draw_session_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Voting sessions table
CREATE TABLE IF NOT EXISTS voting_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Voting options table
CREATE TABLE IF NOT EXISTS voting_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Voting votes table
CREATE TABLE IF NOT EXISTS voting_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,
    option_id UUID REFERENCES voting_options(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false,
    UNIQUE(session_id, attendee_id)
);

-- Quiz sessions table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT false,
    is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Quiz questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice',
    options JSONB,
    correct_answer TEXT,
    points INTEGER DEFAULT 1,
    time_limit INTEGER,
    order_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Quiz participants table
CREATE TABLE IF NOT EXISTS quiz_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
    staff_id TEXT,
    score INTEGER DEFAULT 0,
    answers JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false,
    UNIQUE(session_id, attendee_id)
);

-- Quiz winners table
CREATE TABLE IF NOT EXISTS quiz_winners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
    winner_name TEXT NOT NULL,
    score INTEGER,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Gallery uploads table
CREATE TABLE IF NOT EXISTS gallery_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    syncStatus TEXT DEFAULT 'synced',
    lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    isLocal BOOLEAN DEFAULT false
);

-- Tables for seating arrangement
CREATE TABLE IF NOT EXISTS tables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    table_type TEXT DEFAULT 'Regular',
    capacity INTEGER DEFAULT 8,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom backgrounds table
CREATE TABLE IF NOT EXISTS custom_backgrounds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. ADD MISSING COLUMNS (FIXES)
-- =====================================================

-- Fix syncStatus and lastSynced columns for all tables
DO $$
BEGIN
    -- For companies table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE companies ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE companies ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE companies ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For events table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE events ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE events ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE events ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'mode'
    ) THEN
        ALTER TABLE events ADD COLUMN "mode" text DEFAULT 'hybrid';
    END IF;
    
    -- For attendees table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendees' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE attendees ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendees' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE attendees ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendees' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE attendees ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendees' AND column_name = 'table_type'
    ) THEN
        ALTER TABLE attendees ADD COLUMN "table_type" text DEFAULT 'regular';
    END IF;
    
    -- For company_users table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_users' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE company_users ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_users' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE company_users ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_users' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE company_users ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For lucky_draw_winners table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lucky_draw_winners' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE lucky_draw_winners ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lucky_draw_winners' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE lucky_draw_winners ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lucky_draw_winners' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE lucky_draw_winners ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For voting_sessions table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_sessions' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE voting_sessions ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_sessions' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE voting_sessions ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_sessions' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE voting_sessions ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For voting_options table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_options' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE voting_options ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_options' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE voting_options ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_options' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE voting_options ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For voting_votes table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_votes' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE voting_votes ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_votes' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE voting_votes ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_votes' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE voting_votes ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voting_votes' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE voting_votes ADD COLUMN "created_at" timestamptz DEFAULT now();
    END IF;
    
    -- For quiz_sessions table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_sessions' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE quiz_sessions ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_sessions' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE quiz_sessions ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_sessions' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE quiz_sessions ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For quiz_questions table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_questions' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE quiz_questions ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_questions' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE quiz_questions ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_questions' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE quiz_questions ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For quiz_participants table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_participants' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE quiz_participants ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_participants' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE quiz_participants ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_participants' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE quiz_participants ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For quiz_winners table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_winners' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE quiz_winners ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_winners' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE quiz_winners ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_winners' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE quiz_winners ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
    
    -- For gallery_uploads table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gallery_uploads' AND column_name = 'syncStatus'
    ) THEN
        ALTER TABLE gallery_uploads ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gallery_uploads' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE gallery_uploads ADD COLUMN "lastSynced" timestamptz DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gallery_uploads' AND column_name = 'isLocal'
    ) THEN
        ALTER TABLE gallery_uploads ADD COLUMN "isLocal" boolean DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- 3. UPDATE EXISTING RECORDS
-- =====================================================

-- Update existing records to have proper syncStatus and lastSynced
UPDATE companies SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE events SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE attendees SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE company_users SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE lucky_draw_winners SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE voting_sessions SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE voting_options SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE voting_votes SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE quiz_sessions SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE quiz_questions SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE quiz_participants SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE quiz_winners SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;
UPDATE gallery_uploads SET "syncStatus" = 'synced' WHERE "syncStatus" IS NULL;

-- Update lastSynced for tables with created_at column
UPDATE companies SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE events SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE attendees SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE company_users SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE lucky_draw_winners SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE voting_sessions SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE voting_options SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE voting_votes SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE quiz_sessions SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE quiz_questions SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE quiz_participants SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE quiz_winners SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;
UPDATE gallery_uploads SET "lastSynced" = created_at WHERE "lastSynced" IS NULL;

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_sync_status ON companies(syncStatus);
CREATE INDEX IF NOT EXISTS idx_companies_features_enabled ON companies USING GIN (features_enabled);

-- Company users indexes
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_email ON company_users(email);
CREATE INDEX IF NOT EXISTS idx_company_users_created_at ON company_users(created_at DESC);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Attendees indexes
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_checked_in ON attendees(checked_in);
CREATE INDEX IF NOT EXISTS idx_attendees_identification_number ON attendees(identification_number);
CREATE INDEX IF NOT EXISTS idx_attendees_staff_id ON attendees(staff_id);

-- Lucky draw winners indexes
CREATE INDEX IF NOT EXISTS idx_lucky_draw_winners_event_id ON lucky_draw_winners(event_id);
CREATE INDEX IF NOT EXISTS idx_lucky_draw_winners_draw_session_id ON lucky_draw_winners(draw_session_id);

-- Voting indexes
CREATE INDEX IF NOT EXISTS idx_voting_sessions_event_id ON voting_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_is_active ON voting_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_voting_options_session_id ON voting_options(session_id);
CREATE INDEX IF NOT EXISTS idx_voting_votes_session_id ON voting_votes(session_id);
CREATE INDEX IF NOT EXISTS idx_voting_votes_created_at ON voting_votes(created_at DESC);

-- Quiz indexes
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_event_id ON quiz_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_is_active ON quiz_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_session_id ON quiz_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_session_id ON quiz_participants(session_id);

-- Gallery indexes
CREATE INDEX IF NOT EXISTS idx_gallery_uploads_event_id ON gallery_uploads(event_id);
CREATE INDEX IF NOT EXISTS idx_gallery_uploads_created_at ON gallery_uploads(created_at DESC);

-- Tables indexes
CREATE INDEX IF NOT EXISTS idx_tables_event_id ON tables(event_id);
CREATE INDEX IF NOT EXISTS idx_tables_table_number ON tables(table_number);

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE lucky_draw_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_backgrounds ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. CREATE RLS POLICIES
-- =====================================================

-- Companies policies
CREATE POLICY "Allow all operations on companies" ON companies
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Only super admins can modify company features" ON companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Company users policies
CREATE POLICY "Allow all operations on company_users" ON company_users
  FOR ALL USING (true) WITH CHECK (true);

-- Events policies
CREATE POLICY "Allow all operations on events" ON events
  FOR ALL USING (true) WITH CHECK (true);

-- Attendees policies
CREATE POLICY "Allow all operations on attendees" ON attendees
  FOR ALL USING (true) WITH CHECK (true);

-- Lucky draw winners policies
CREATE POLICY "Allow all operations on lucky_draw_winners" ON lucky_draw_winners
  FOR ALL USING (true) WITH CHECK (true);

-- Voting policies
CREATE POLICY "Allow all operations on voting_sessions" ON voting_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on voting_options" ON voting_options
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on voting_votes" ON voting_votes
  FOR ALL USING (true) WITH CHECK (true);

-- Quiz policies
CREATE POLICY "Allow all operations on quiz_sessions" ON quiz_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on quiz_questions" ON quiz_questions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on quiz_participants" ON quiz_participants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on quiz_winners" ON quiz_winners
  FOR ALL USING (true) WITH CHECK (true);

-- Gallery policies
CREATE POLICY "Allow all operations on gallery_uploads" ON gallery_uploads
  FOR ALL USING (true) WITH CHECK (true);

-- Tables policies
CREATE POLICY "Authenticated users can manage tables" ON tables
  FOR ALL
  TO authenticated
  USING (true);

-- Custom backgrounds policies
CREATE POLICY "Allow authenticated users to read backgrounds" ON custom_backgrounds
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert backgrounds" ON custom_backgrounds
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update backgrounds" ON custom_backgrounds
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete backgrounds" ON custom_backgrounds
  FOR DELETE USING (auth.role() = 'authenticated');

-- Public access policies for registration and check-in
CREATE POLICY "Public can read events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Public can insert attendees" ON attendees
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read attendees" ON attendees
  FOR SELECT USING (true);

CREATE POLICY "Public can update attendees" ON attendees
  FOR UPDATE USING (true);

-- =====================================================
-- 7. ADD COMMENTS TO COLUMNS
-- =====================================================

-- Companies comments
COMMENT ON COLUMN companies."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN companies."lastSynced" IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN companies."isLocal" IS 'Flag to identify locally created records';
COMMENT ON COLUMN companies.features_enabled IS 'JSON object containing boolean flags for each feature. Super admin can assign specific features to companies based on their package.';

-- Events comments
COMMENT ON COLUMN events."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN events."lastSynced" IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN events."isLocal" IS 'Flag to identify locally created records';
COMMENT ON COLUMN events.mode IS 'Operation mode: online, offline, hybrid';

-- Attendees comments
COMMENT ON COLUMN attendees."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN attendees."lastSynced" IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN attendees."isLocal" IS 'Flag to identify locally created records';
COMMENT ON COLUMN attendees.table_type IS 'Type of table assignment: Regular, VIP, etc.';

-- Company users comments
COMMENT ON COLUMN company_users."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN company_users."lastSynced" IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN company_users."isLocal" IS 'Flag to identify locally created records';

-- Lucky draw winners comments
COMMENT ON COLUMN lucky_draw_winners."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN lucky_draw_winners."lastSynced" IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN lucky_draw_winners."isLocal" IS 'Flag to identify locally created records';

-- Voting comments
COMMENT ON COLUMN voting_sessions."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN voting_options."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN voting_votes."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';

-- Quiz comments
COMMENT ON COLUMN quiz_sessions."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_questions."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_participants."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_winners."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';

-- Gallery comments
COMMENT ON COLUMN gallery_uploads."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';

-- =====================================================
-- 8. CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.lastSynced = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 9. VERIFICATION QUERIES
-- =====================================================

-- Check if all tables were created
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'companies', 'company_users', 'events', 'attendees', 
    'lucky_draw_winners', 'voting_sessions', 'voting_options', 
    'voting_votes', 'quiz_sessions', 'quiz_questions', 
    'quiz_participants', 'quiz_winners', 'gallery_uploads',
    'tables', 'custom_backgrounds'
)
ORDER BY table_name;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check syncStatus and lastSynced columns
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN (
    'companies', 'events', 'attendees', 'company_users', 'lucky_draw_winners',
    'voting_sessions', 'voting_options', 'voting_votes',
    'quiz_sessions', 'quiz_questions', 'quiz_participants', 'quiz_winners',
    'gallery_uploads'
)
AND column_name IN ('syncStatus', 'lastSynced')
ORDER BY table_name, column_name;

-- =====================================================
-- 10. MIGRATION COMPLETE MESSAGE
-- =====================================================

SELECT 'Complete database setup completed successfully!' as status; 