-- Fix quiz_participants table schema
-- First, drop the unique index if it exists
DROP INDEX IF EXISTS idx_quiz_participants_session_staff_id;

-- Add staff_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_participants' AND column_name = 'staff_id') THEN
        ALTER TABLE quiz_participants ADD COLUMN staff_id VARCHAR(50);
    END IF;
END $$;

-- Add attendee_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'quiz_participants' AND column_name = 'attendee_id') THEN
        ALTER TABLE quiz_participants ADD COLUMN attendee_id UUID REFERENCES attendees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create unique constraint to prevent duplicate staff IDs in the same session
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_participants_session_staff_id 
ON quiz_participants(session_id, staff_id) 
WHERE staff_id IS NOT NULL;

-- Update RLS policies for quiz_participants
DROP POLICY IF EXISTS "Users can view quiz participants for their company events" ON quiz_participants;
CREATE POLICY "Users can view quiz participants for their company events" ON quiz_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quiz_sessions qs
      JOIN quizzes q ON q.id = qs.quiz_id
      JOIN events e ON e.id = q.event_id
      JOIN company_users cu ON cu.company_id = e.company_id
      WHERE cu.id = auth.uid() AND qs.id = quiz_participants.session_id
    )
  ); 