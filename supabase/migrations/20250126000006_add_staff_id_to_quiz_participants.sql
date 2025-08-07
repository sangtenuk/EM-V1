-- Add staff_id and attendee_id columns to quiz_participants table
ALTER TABLE quiz_participants 
ADD COLUMN staff_id VARCHAR(50),
ADD COLUMN attendee_id UUID REFERENCES attendees(id) ON DELETE SET NULL;

-- Create unique constraint to prevent duplicate staff IDs in the same session
CREATE UNIQUE INDEX idx_quiz_participants_session_staff_id 
ON quiz_participants(session_id, staff_id) 
WHERE staff_id IS NOT NULL;

-- Add RLS policy for quiz_participants with staff_id
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