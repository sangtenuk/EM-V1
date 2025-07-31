-- Add timer fields to voting_sessions table
ALTER TABLE voting_sessions ADD COLUMN IF NOT EXISTS timer_duration INTEGER;
ALTER TABLE voting_sessions ADD COLUMN IF NOT EXISTS timer_start TIMESTAMPTZ; 