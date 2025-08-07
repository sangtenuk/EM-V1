-- Fix companies table by adding missing columns for hybrid database compatibility

-- Add missing columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN companies.syncStatus IS 'Sync status for hybrid database: pending, synced, error';
COMMENT ON COLUMN companies.lastSynced IS 'Last sync timestamp for hybrid database';
COMMENT ON COLUMN companies.isLocal IS 'Flag to identify locally created records';

-- Update existing records to have proper sync status
UPDATE companies 
SET syncStatus = 'synced', 
    lastSynced = created_at 
WHERE syncStatus IS NULL;

-- Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position; 