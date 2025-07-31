-- Migration for custom_prizes table
-- Run this in your Supabase SQL Editor

-- Create custom_prizes table
CREATE TABLE IF NOT EXISTS custom_prizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position > 0),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, position)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_custom_prizes_event_id ON custom_prizes(event_id);
CREATE INDEX IF NOT EXISTS idx_custom_prizes_position ON custom_prizes(position);

-- Temporarily disable RLS for development (can be enabled later)
-- ALTER TABLE custom_prizes ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (development mode)
-- CREATE POLICY "Allow all operations for development" ON custom_prizes
--   FOR ALL USING (true);

-- Optional: Enable RLS later with proper policies
-- ALTER TABLE custom_prizes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations for development" ON custom_prizes
--   FOR ALL USING (true); 