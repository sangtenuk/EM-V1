-- Add width and height columns to tables table for resizable cards
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 80; 