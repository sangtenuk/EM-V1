-- Complete Database Migration for EM-V1
-- Use this to migrate to a new Supabase project

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voting options table
CREATE TABLE IF NOT EXISTS voting_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voting votes table
CREATE TABLE IF NOT EXISTS voting_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,
    option_id UUID REFERENCES voting_options(id) ON DELETE CASCADE,
    attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_sync_status ON companies(syncStatus);

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

-- Quiz indexes
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_event_id ON quiz_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_is_active ON quiz_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_session_id ON quiz_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_session_id ON quiz_participants(session_id);

-- Gallery indexes
CREATE INDEX IF NOT EXISTS idx_gallery_uploads_event_id ON gallery_uploads(event_id);
CREATE INDEX IF NOT EXISTS idx_gallery_uploads_created_at ON gallery_uploads(created_at DESC);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
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

-- =====================================================
-- 4. CREATE RLS POLICIES
-- =====================================================

-- Companies policies
CREATE POLICY "Allow all operations on companies" ON companies
  FOR ALL USING (true) WITH CHECK (true);

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
-- 5. CREATE FUNCTIONS AND TRIGGERS
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
-- 6. VERIFICATION QUERIES
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
    'quiz_participants', 'quiz_winners', 'gallery_uploads'
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

-- =====================================================
-- 7. MIGRATION COMPLETE MESSAGE
-- =====================================================

SELECT 'Database migration completed successfully!' as status; 