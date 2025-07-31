-- Add is_locked column to tables table for lock functionality
ALTER TABLE tables ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Add comment to document the column purpose
COMMENT ON COLUMN tables.is_locked IS 'Whether the table is locked from being moved or modified'; 