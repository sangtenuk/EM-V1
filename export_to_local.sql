-- Export Database to Local Files
-- Run this in Supabase SQL Editor to export your database

-- =====================================================
-- 1. EXPORT SCHEMA DEFINITIONS
-- =====================================================

-- Export complete table definitions
SELECT 
    '-- Complete Database Schema Export' as export_header,
    '-- Generated on: ' || NOW() as generation_time;

-- Export companies table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS companies (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'name TEXT NOT NULL,' ||
    'person_in_charge TEXT,' ||
    'contact_number TEXT,' ||
    'email TEXT,' ||
    'logo TEXT,' ||
    'features_enabled JSONB DEFAULT ''{"registration": true, "checkin": true, "voting": true, "welcoming": true, "quiz": true, "lucky_draw": true, "gallery": true}''::jsonb,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export company_users table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS company_users (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'email TEXT NOT NULL UNIQUE,' ||
    'company_id UUID REFERENCES companies(id) ON DELETE CASCADE,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export events table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS events (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'company_id UUID REFERENCES companies(id) ON DELETE CASCADE,' ||
    'name TEXT NOT NULL,' ||
    'description TEXT,' ||
    'date TIMESTAMP WITH TIME ZONE,' ||
    'location TEXT,' ||
    'max_attendees INTEGER,' ||
    'registration_qr TEXT,' ||
    'offline_qr TEXT,' ||
    'custom_background TEXT,' ||
    'custom_logo TEXT,' ||
    'max_gallery_uploads INTEGER DEFAULT 100,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'mode TEXT DEFAULT ''hybrid'',' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export attendees table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS attendees (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'event_id UUID REFERENCES events(id) ON DELETE CASCADE,' ||
    'name TEXT NOT NULL,' ||
    'email TEXT,' ||
    'phone TEXT,' ||
    'company TEXT,' ||
    'identification_number TEXT NOT NULL,' ||
    'staff_id TEXT,' ||
    'table_assignment TEXT,' ||
    'table_type TEXT DEFAULT ''regular'',' ||
    'checked_in BOOLEAN DEFAULT false,' ||
    'check_in_time TIMESTAMP WITH TIME ZONE,' ||
    'table_number INTEGER,' ||
    'seat_number INTEGER,' ||
    'face_photo_url TEXT,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export lucky_draw_winners table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS lucky_draw_winners (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'event_id UUID REFERENCES events(id) ON DELETE CASCADE,' ||
    'attendee_id UUID REFERENCES attendees(id) ON DELETE SET NULL,' ||
    'winner_name TEXT NOT NULL,' ||
    'winner_company TEXT,' ||
    'table_number INTEGER,' ||
    'is_table_winner BOOLEAN DEFAULT false,' ||
    'table_type TEXT,' ||
    'prize_id TEXT,' ||
    'prize_title TEXT,' ||
    'prize_description TEXT,' ||
    'prize_position INTEGER,' ||
    'draw_type TEXT DEFAULT ''regular'',' ||
    'draw_session_id TEXT NOT NULL,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export voting_sessions table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS voting_sessions (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'event_id UUID REFERENCES events(id) ON DELETE CASCADE,' ||
    'title TEXT NOT NULL,' ||
    'description TEXT,' ||
    'start_time TIMESTAMP WITH TIME ZONE,' ||
    'end_time TIMESTAMP WITH TIME ZONE,' ||
    'is_active BOOLEAN DEFAULT false,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export voting_options table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS voting_options (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,' ||
    'option_text TEXT NOT NULL,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export voting_votes table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS voting_votes (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,' ||
    'option_id UUID REFERENCES voting_options(id) ON DELETE CASCADE,' ||
    'attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,' ||
    'voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false,' ||
    'UNIQUE(session_id, attendee_id)' ||
    ');' as schema_export;

-- Export quiz_sessions table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS quiz_sessions (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'event_id UUID REFERENCES events(id) ON DELETE CASCADE,' ||
    'title TEXT NOT NULL,' ||
    'description TEXT,' ||
    'start_time TIMESTAMP WITH TIME ZONE,' ||
    'end_time TIMESTAMP WITH TIME ZONE,' ||
    'is_active BOOLEAN DEFAULT false,' ||
    'is_paused BOOLEAN DEFAULT false,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export quiz_questions table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS quiz_questions (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,' ||
    'question_text TEXT NOT NULL,' ||
    'question_type TEXT DEFAULT ''multiple_choice'',' ||
    'options JSONB,' ||
    'correct_answer TEXT,' ||
    'points INTEGER DEFAULT 1,' ||
    'time_limit INTEGER,' ||
    'order_index INTEGER,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export quiz_participants table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS quiz_participants (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,' ||
    'attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,' ||
    'staff_id TEXT,' ||
    'score INTEGER DEFAULT 0,' ||
    'answers JSONB,' ||
    'started_at TIMESTAMP WITH TIME ZONE,' ||
    'completed_at TIMESTAMP WITH TIME ZONE,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false,' ||
    'UNIQUE(session_id, attendee_id)' ||
    ');' as schema_export;

-- Export quiz_winners table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS quiz_winners (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,' ||
    'attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,' ||
    'winner_name TEXT NOT NULL,' ||
    'score INTEGER,' ||
    'rank INTEGER,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export gallery_uploads table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS gallery_uploads (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'event_id UUID REFERENCES events(id) ON DELETE CASCADE,' ||
    'file_name TEXT NOT NULL,' ||
    'file_url TEXT NOT NULL,' ||
    'file_type TEXT,' ||
    'file_size INTEGER,' ||
    'uploaded_by TEXT,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export;

-- Export tables table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS tables (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'event_id UUID REFERENCES events(id) ON DELETE CASCADE,' ||
    'table_number INTEGER NOT NULL,' ||
    'table_type TEXT DEFAULT ''Regular'',' ||
    'capacity INTEGER DEFAULT 8,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()' ||
    ');' as schema_export;

-- Export custom_backgrounds table definition
SELECT 
    'CREATE TABLE IF NOT EXISTS custom_backgrounds (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'section TEXT NOT NULL,' ||
    'image_url TEXT NOT NULL,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()' ||
    ');' as schema_export;

-- =====================================================
-- 2. EXPORT DATA AS INSERT STATEMENTS
-- =====================================================

-- Export companies data
SELECT 
    'INSERT INTO companies (id, name, person_in_charge, contact_number, email, logo, features_enabled, created_at, syncStatus, lastSynced, isLocal) VALUES (' ||
    '''' || id || ''', ' ||
    '''' || COALESCE(REPLACE(name, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(person_in_charge, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(contact_number, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(email, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(logo, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(features_enabled::text, '{"registration": true, "checkin": true, "voting": true, "welcoming": true, "quiz": true, "lucky_draw": true, "gallery": true}') || ''', ' ||
    '''' || created_at || ''', ' ||
    '''' || COALESCE(syncStatus, 'synced') || ''', ' ||
    '''' || COALESCE(lastSynced, created_at) || ''', ' ||
    COALESCE(isLocal::text, 'false') ||
    ');' as data_export
FROM companies;

-- Export company_users data
SELECT 
    'INSERT INTO company_users (id, email, company_id, created_at, syncStatus, lastSynced, isLocal) VALUES (' ||
    '''' || id || ''', ' ||
    '''' || COALESCE(REPLACE(email, '''', ''''''), '') || ''', ' ||
    '''' || company_id || ''', ' ||
    '''' || created_at || ''', ' ||
    '''' || COALESCE(syncStatus, 'synced') || ''', ' ||
    '''' || COALESCE(lastSynced, created_at) || ''', ' ||
    COALESCE(isLocal::text, 'false') ||
    ');' as data_export
FROM company_users;

-- Export events data
SELECT 
    'INSERT INTO events (id, company_id, name, description, date, location, max_attendees, registration_qr, offline_qr, custom_background, custom_logo, max_gallery_uploads, created_at, mode, syncStatus, lastSynced, isLocal) VALUES (' ||
    '''' || id || ''', ' ||
    '''' || company_id || ''', ' ||
    '''' || COALESCE(REPLACE(name, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(description, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(date, '') || ''', ' ||
    '''' || COALESCE(REPLACE(location, '''', ''''''), '') || ''', ' ||
    COALESCE(max_attendees::text, 'NULL') || ', ' ||
    '''' || COALESCE(REPLACE(registration_qr, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(offline_qr, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(custom_background, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(custom_logo, '''', ''''''), '') || ''', ' ||
    COALESCE(max_gallery_uploads::text, '100') || ', ' ||
    '''' || created_at || ''', ' ||
    '''' || COALESCE(mode, 'hybrid') || ''', ' ||
    '''' || COALESCE(syncStatus, 'synced') || ''', ' ||
    '''' || COALESCE(lastSynced, created_at) || ''', ' ||
    COALESCE(isLocal::text, 'false') ||
    ');' as data_export
FROM events;

-- Export attendees data
SELECT 
    'INSERT INTO attendees (id, event_id, name, email, phone, company, identification_number, staff_id, table_assignment, table_type, checked_in, check_in_time, table_number, seat_number, face_photo_url, created_at, syncStatus, lastSynced, isLocal) VALUES (' ||
    '''' || id || ''', ' ||
    '''' || event_id || ''', ' ||
    '''' || COALESCE(REPLACE(name, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(email, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(phone, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(company, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(identification_number, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(staff_id, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(REPLACE(table_assignment, '''', ''''''), '') || ''', ' ||
    '''' || COALESCE(table_type, 'regular') || ''', ' ||
    COALESCE(checked_in::text, 'false') || ', ' ||
    '''' || COALESCE(check_in_time, '') || ''', ' ||
    COALESCE(table_number::text, 'NULL') || ', ' ||
    COALESCE(seat_number::text, 'NULL') || ', ' ||
    '''' || COALESCE(REPLACE(face_photo_url, '''', ''''''), '') || ''', ' ||
    '''' || created_at || ''', ' ||
    '''' || COALESCE(syncStatus, 'synced') || ''', ' ||
    '''' || COALESCE(lastSynced, created_at) || ''', ' ||
    COALESCE(isLocal::text, 'false') ||
    ');' as data_export
FROM attendees;

-- =====================================================
-- 3. EXPORT INDEXES
-- =====================================================

SELECT 'CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_companies_sync_status ON companies(syncStatus);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_companies_features_enabled ON companies USING GIN (features_enabled);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_company_users_email ON company_users(email);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_company_users_created_at ON company_users(created_at DESC);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_attendees_checked_in ON attendees(checked_in);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_attendees_identification_number ON attendees(identification_number);' as index_export;
SELECT 'CREATE INDEX IF NOT EXISTS idx_attendees_staff_id ON attendees(staff_id);' as index_export;

-- =====================================================
-- 4. EXPORT RLS POLICIES
-- =====================================================

SELECT 'ALTER TABLE companies ENABLE ROW LEVEL SECURITY;' as rls_export;
SELECT 'ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;' as rls_export;
SELECT 'ALTER TABLE events ENABLE ROW LEVEL SECURITY;' as rls_export;
SELECT 'ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;' as rls_export;

SELECT 'CREATE POLICY "Allow all operations on companies" ON companies FOR ALL USING (true) WITH CHECK (true);' as policy_export;
SELECT 'CREATE POLICY "Allow all operations on company_users" ON company_users FOR ALL USING (true) WITH CHECK (true);' as policy_export;
SELECT 'CREATE POLICY "Allow all operations on events" ON events FOR ALL USING (true) WITH CHECK (true);' as policy_export;
SELECT 'CREATE POLICY "Allow all operations on attendees" ON attendees FOR ALL USING (true) WITH CHECK (true);' as policy_export;

-- =====================================================
-- 5. EXPORT SUMMARY
-- =====================================================

SELECT 
    'Database Export Summary:' as summary_header,
    'Tables exported: ' || COUNT(*) as table_count,
    'Total records: ' || SUM(record_count) as total_records
FROM (
    SELECT 'companies' as table_name, COUNT(*) as record_count FROM companies
    UNION ALL
    SELECT 'company_users', COUNT(*) FROM company_users
    UNION ALL
    SELECT 'events', COUNT(*) FROM events
    UNION ALL
    SELECT 'attendees', COUNT(*) FROM attendees
) as table_counts;

SELECT 'Database export completed successfully!' as export_status; 