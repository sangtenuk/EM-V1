-- Update quiz_sessions status to include 'paused'
-- First, create a new enum type with 'paused' status
CREATE TYPE quiz_session_status_new AS ENUM ('waiting', 'active', 'paused', 'finished');

-- Update existing sessions to use the new enum
ALTER TABLE quiz_sessions 
ALTER COLUMN status TYPE quiz_session_status_new 
USING status::text::quiz_session_status_new;

-- Drop the old enum and rename the new one
DROP TYPE quiz_session_status;
ALTER TYPE quiz_session_status_new RENAME TO quiz_session_status; 