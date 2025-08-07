-- Export Database to Local Files
-- This script exports the complete database schema and data

-- =====================================================
-- 1. EXPORT SCHEMA (Table Definitions)
-- =====================================================

-- Export companies table schema
SELECT 
    'CREATE TABLE companies (' ||
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
    ');' as schema_export
FROM companies LIMIT 1;

-- Export company_users table schema
SELECT 
    'CREATE TABLE company_users (' ||
    'id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' ||
    'email TEXT NOT NULL UNIQUE,' ||
    'company_id UUID REFERENCES companies(id) ON DELETE CASCADE,' ||
    'created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'syncStatus TEXT DEFAULT ''synced'',' ||
    'lastSynced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),' ||
    'isLocal BOOLEAN DEFAULT false' ||
    ');' as schema_export
FROM company_users LIMIT 1;

-- Export events table schema
SELECT 
    'CREATE TABLE events (' ||
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
    ');' as schema_export
FROM events LIMIT 1;

-- Export attendees table schema
SELECT 
    'CREATE TABLE attendees (' ||
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
    ');' as schema_export
FROM attendees LIMIT 1;

-- =====================================================
-- 2. EXPORT DATA (INSERT Statements)
-- =====================================================

-- Export companies data
SELECT 
    'INSERT INTO companies (id, name, person_in_charge, contact_number, email, logo, features_enabled, created_at, syncStatus, lastSynced, isLocal) VALUES (' ||
    '''' || id || ''', ' ||
    '''' || COALESCE(name, '') || ''', ' ||
    '''' || COALESCE(person_in_charge, '') || ''', ' ||
    '''' || COALESCE(contact_number, '') || ''', ' ||
    '''' || COALESCE(email, '') || ''', ' ||
    '''' || COALESCE(logo, '') || ''', ' ||
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
    '''' || COALESCE(email, '') || ''', ' ||
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
    '''' || COALESCE(name, '') || ''', ' ||
    '''' || COALESCE(description, '') || ''', ' ||
    '''' || COALESCE(date, '') || ''', ' ||
    '''' || COALESCE(location, '') || ''', ' ||
    COALESCE(max_attendees::text, 'NULL') || ', ' ||
    '''' || COALESCE(registration_qr, '') || ''', ' ||
    '''' || COALESCE(offline_qr, '') || ''', ' ||
    '''' || COALESCE(custom_background, '') || ''', ' ||
    '''' || COALESCE(custom_logo, '') || ''', ' ||
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
    '''' || COALESCE(name, '') || ''', ' ||
    '''' || COALESCE(email, '') || ''', ' ||
    '''' || COALESCE(phone, '') || ''', ' ||
    '''' || COALESCE(company, '') || ''', ' ||
    '''' || COALESCE(identification_number, '') || ''', ' ||
    '''' || COALESCE(staff_id, '') || ''', ' ||
    '''' || COALESCE(table_assignment, '') || ''', ' ||
    '''' || COALESCE(table_type, 'regular') || ''', ' ||
    COALESCE(checked_in::text, 'false') || ', ' ||
    '''' || COALESCE(check_in_time, '') || ''', ' ||
    COALESCE(table_number::text, 'NULL') || ', ' ||
    COALESCE(seat_number::text, 'NULL') || ', ' ||
    '''' || COALESCE(face_photo_url, '') || ''', ' ||
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
-- 5. EXPORT COMMENTS
-- =====================================================

SELECT 'COMMENT ON COLUMN companies.syncStatus IS ''Sync status for hybrid database: pending, synced, error'';' as comment_export;
SELECT 'COMMENT ON COLUMN companies.lastSynced IS ''Last sync timestamp for hybrid database'';' as comment_export;
SELECT 'COMMENT ON COLUMN companies.isLocal IS ''Flag to identify locally created records'';' as comment_export;
SELECT 'COMMENT ON COLUMN companies.features_enabled IS ''JSON object containing boolean flags for each feature. Super admin can assign specific features to companies based on their package.'';' as comment_export;

SELECT 'COMMENT ON COLUMN events.syncStatus IS ''Sync status for hybrid database: pending, synced, error'';' as comment_export;
SELECT 'COMMENT ON COLUMN events.lastSynced IS ''Last sync timestamp for hybrid database'';' as comment_export;
SELECT 'COMMENT ON COLUMN events.isLocal IS ''Flag to identify locally created records'';' as comment_export;
SELECT 'COMMENT ON COLUMN events.mode IS ''Operation mode: online, offline, hybrid'';' as comment_export;

SELECT 'COMMENT ON COLUMN attendees.syncStatus IS ''Sync status for hybrid database: pending, synced, error'';' as comment_export;
SELECT 'COMMENT ON COLUMN attendees.lastSynced IS ''Last sync timestamp for hybrid database'';' as comment_export;
SELECT 'COMMENT ON COLUMN attendees.isLocal IS ''Flag to identify locally created records'';' as comment_export;
SELECT 'COMMENT ON COLUMN attendees.table_type IS ''Type of table assignment: Regular, VIP, etc.'';' as comment_export;

SELECT 'COMMENT ON COLUMN company_users.syncStatus IS ''Sync status for hybrid database: pending, synced, error'';' as comment_export;
SELECT 'COMMENT ON COLUMN company_users.lastSynced IS ''Last sync timestamp for hybrid database'';' as comment_export;
SELECT 'COMMENT ON COLUMN company_users.isLocal IS ''Flag to identify locally created records'';' as comment_export;

-- =====================================================
-- 6. EXPORT COMPLETE SCHEMA
-- =====================================================

-- Export complete table definitions
SELECT 
    '-- Complete Database Schema Export' as schema_header,
    '-- Generated on: ' || NOW() as generation_time;

-- Export all table definitions
SELECT 
    'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' ||
    string_agg(
        column_name || ' ' || data_type || 
        CASE 
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END ||
        CASE 
            WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ', '
        ORDER BY ordinal_position
    ) ||
    ');' as complete_schema
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('companies', 'company_users', 'events', 'attendees')
GROUP BY table_name;

-- =====================================================
-- 7. EXPORT SUMMARY
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