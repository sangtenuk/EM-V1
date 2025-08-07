-- Fix all tables by adding missing hybrid database columns

-- 1. Fix companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;

-- 2. Fix events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE events ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS mode text DEFAULT 'online';

-- 3. Fix attendees table
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS table_type text DEFAULT 'Regular';

-- 4. Fix company_users table
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;

-- 5. Update existing records
UPDATE companies SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
UPDATE events SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
UPDATE attendees SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
UPDATE company_users SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;

-- 6. Add comments
COMMENT ON COLUMN companies.syncStatus IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN companies.lastSynced IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN companies.isLocal IS 'Flag to identify locally created records';

COMMENT ON COLUMN events.syncStatus IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN events.lastSynced IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN events.isLocal IS 'Flag to identify locally created records';
COMMENT ON COLUMN events.mode IS 'Operation mode: online, offline, hybrid';

COMMENT ON COLUMN attendees.syncStatus IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN attendees.lastSynced IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN attendees.isLocal IS 'Flag to identify locally created records';
COMMENT ON COLUMN attendees.table_type IS 'Type of table assignment: Regular, VIP, etc.';

COMMENT ON COLUMN company_users.syncStatus IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN company_users.lastSynced IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN company_users.isLocal IS 'Flag to identify locally created records';

-- 7. Verify all table structures
SELECT 'companies' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position;

SELECT 'events' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

SELECT 'attendees' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'attendees' 
ORDER BY ordinal_position;

SELECT 'company_users' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'company_users' 
ORDER BY ordinal_position; 