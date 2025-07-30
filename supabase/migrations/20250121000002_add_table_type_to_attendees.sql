-- Add table_type field to attendees table
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS table_type text DEFAULT 'Regular';

-- Update existing attendees to have 'Regular' as table_type if they don't have one
UPDATE attendees SET table_type = 'Regular' WHERE table_type IS NULL; 