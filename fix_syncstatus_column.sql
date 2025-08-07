-- Fix syncStatus column case sensitivity issue
-- This script ensures the syncStatus column exists with the correct case

-- Check if syncStatus column exists (case insensitive)
DO $$
BEGIN
    -- For companies table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'syncStatus'
    ) THEN
        -- Try to add the column with correct case
        ALTER TABLE companies ADD COLUMN "syncStatus" text DEFAULT 'synced';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'lastSynced'
    ) THEN
        ALTER TABLE companies ADD COLUMN "lastSynced" timestamptz DEFAULT now();
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
END $$;

-- Update existing records to have proper syncStatus
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

-- Update existing records to have proper lastSynced
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

-- Add comments to explain the columns
COMMENT ON COLUMN companies."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN events."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN attendees."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN company_users."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN lucky_draw_winners."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN voting_sessions."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN voting_options."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN voting_votes."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_sessions."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_questions."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_participants."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN quiz_winners."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN gallery_uploads."syncStatus" IS 'Sync status for hybrid database: pending, synced, error';

-- Verify the columns exist
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

SELECT 'syncStatus and lastSynced columns fixed successfully!' as status; 