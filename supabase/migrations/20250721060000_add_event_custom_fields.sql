-- Add custom_background and custom_logo columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_background TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_logo TEXT; 