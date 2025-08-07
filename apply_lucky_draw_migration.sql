-- Create lucky_draw_winners table
CREATE TABLE IF NOT EXISTS lucky_draw_winners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
  winner_name TEXT NOT NULL,
  winner_company TEXT,
  table_number INTEGER,
  is_table_winner BOOLEAN DEFAULT FALSE,
  table_type TEXT,
  prize_id UUID REFERENCES custom_prizes(id) ON DELETE SET NULL,
  prize_title TEXT,
  prize_description TEXT,
  prize_position INTEGER,
  draw_type TEXT NOT NULL CHECK (draw_type IN ('regular', 'table', 'custom')),
  draw_session_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_lucky_draw_winners_event_id ON lucky_draw_winners(event_id);
CREATE INDEX IF NOT EXISTS idx_lucky_draw_winners_draw_session_id ON lucky_draw_winners(draw_session_id);
CREATE INDEX IF NOT EXISTS idx_lucky_draw_winners_created_at ON lucky_draw_winners(created_at);

-- Add RLS policies
ALTER TABLE lucky_draw_winners ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to manage lucky draw winners
CREATE POLICY "Authenticated users can manage lucky draw winners"
  ON lucky_draw_winners
  FOR ALL
  TO authenticated
  USING (true);

-- Policy for public to read lucky draw winners (for display purposes)
CREATE POLICY "Public can read lucky draw winners"
  ON lucky_draw_winners
  FOR SELECT
  TO anon
  USING (true); 