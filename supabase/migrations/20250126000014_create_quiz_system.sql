-- Create Quiz System Database Schema
-- This is a clean implementation without the previous issues

-- Create quiz_sessions table
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  qr_code_url TEXT,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'finished')),
  current_question_index INTEGER DEFAULT 0,
  host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'timed')),
  time_limit INTEGER DEFAULT 30,
  points INTEGER DEFAULT 10,
  order_index INTEGER NOT NULL,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz_answers table
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quiz_participants table
CREATE TABLE IF NOT EXISTS quiz_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
  player_name VARCHAR(255) NOT NULL,
  total_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, attendee_id)
);

-- Create quiz_responses table
CREATE TABLE IF NOT EXISTS quiz_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES quiz_participants(id) ON DELETE CASCADE,
  selected_answer_id UUID REFERENCES quiz_answers(id) ON DELETE CASCADE,
  is_correct BOOLEAN,
  response_time_ms INTEGER,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_event_id ON quiz_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_session_id ON quiz_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON quiz_questions(session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_session_id ON quiz_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_session_id ON quiz_responses(session_id);

-- Enable Row Level Security
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_sessions
CREATE POLICY "Allow public read access to quiz sessions" ON quiz_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create quiz sessions" ON quiz_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update quiz sessions" ON quiz_sessions
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for quiz_questions
CREATE POLICY "Allow public read access to quiz questions" ON quiz_questions
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage quiz questions" ON quiz_questions
  FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for quiz_answers
CREATE POLICY "Allow public read access to quiz answers" ON quiz_answers
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage quiz answers" ON quiz_answers
  FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for quiz_participants
CREATE POLICY "Allow public read access to quiz participants" ON quiz_participants
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to quiz participants" ON quiz_participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update quiz participants" ON quiz_participants
  FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for quiz_responses
CREATE POLICY "Allow public read access to quiz responses" ON quiz_responses
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to quiz responses" ON quiz_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update quiz responses" ON quiz_responses
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for quiz_sessions
CREATE TRIGGER update_quiz_sessions_updated_at 
    BEFORE UPDATE ON quiz_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 