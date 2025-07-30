-- Add position and rotation columns to tables table for draggable venue layout
ALTER TABLE tables ADD COLUMN IF NOT EXISTS x INTEGER DEFAULT 100;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS y INTEGER DEFAULT 100;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS rotation INTEGER DEFAULT 0; 