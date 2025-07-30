-- Create custom_backgrounds table
CREATE TABLE IF NOT EXISTS custom_backgrounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE custom_backgrounds ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all backgrounds
CREATE POLICY "Allow authenticated users to read backgrounds" ON custom_backgrounds
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert backgrounds
CREATE POLICY "Allow authenticated users to insert backgrounds" ON custom_backgrounds
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update backgrounds
CREATE POLICY "Allow authenticated users to update backgrounds" ON custom_backgrounds
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete backgrounds
CREATE POLICY "Allow authenticated users to delete backgrounds" ON custom_backgrounds
  FOR DELETE USING (auth.role() = 'authenticated'); 