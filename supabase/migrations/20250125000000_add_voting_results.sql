-- Create voting_results table to store voting session results
CREATE TABLE IF NOT EXISTS voting_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voting_session_id UUID REFERENCES voting_sessions(id) ON DELETE CASCADE,
  winning_photo_id UUID REFERENCES voting_photos(id) ON DELETE CASCADE,
  winning_photo_title TEXT NOT NULL,
  winning_vote_count INTEGER NOT NULL,
  total_votes INTEGER NOT NULL,
  total_participants INTEGER NOT NULL,
  is_redraw BOOLEAN DEFAULT FALSE,
  redraw_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to ensure one result per session
ALTER TABLE voting_results ADD CONSTRAINT unique_voting_session_result UNIQUE (voting_session_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_voting_results_session_id ON voting_results(voting_session_id);
CREATE INDEX IF NOT EXISTS idx_voting_results_created_at ON voting_results(created_at);

-- Enable RLS
ALTER TABLE voting_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON voting_results FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON voting_results FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON voting_results FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON voting_results FOR DELETE USING (auth.role() = 'authenticated'); 