-- Add quiz_winners table for storing winner data
-- This table will store the final results of quiz sessions for reporting

CREATE TABLE IF NOT EXISTS quiz_winners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES quiz_participants(id) ON DELETE CASCADE,
  player_name VARCHAR(255) NOT NULL,
  final_score INTEGER NOT NULL,
  rank_position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_winners_session_id ON quiz_winners(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_winners_rank_position ON quiz_winners(rank_position);

-- Enable Row Level Security
ALTER TABLE quiz_winners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_winners
CREATE POLICY "Allow public read access to quiz winners" ON quiz_winners
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create quiz winners" ON quiz_winners
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update quiz winners" ON quiz_winners
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete quiz winners" ON quiz_winners
  FOR DELETE USING (auth.role() = 'authenticated'); 