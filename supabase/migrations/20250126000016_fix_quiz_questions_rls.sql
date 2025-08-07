-- Fix RLS policies for quiz questions to ensure proper access
-- This migration ensures that quiz questions can be read by anyone

-- Drop existing policies for quiz_questions
DROP POLICY IF EXISTS "Allow public read access to quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Allow authenticated users to create quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Allow authenticated users to update quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz questions" ON quiz_questions;

-- Create new policies for quiz_questions
CREATE POLICY "Allow public read access to quiz questions" ON quiz_questions
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create quiz questions" ON quiz_questions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update quiz questions" ON quiz_questions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete quiz questions" ON quiz_questions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Also fix quiz_answers policies
DROP POLICY IF EXISTS "Allow public read access to quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Allow authenticated users to create quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Allow authenticated users to update quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz answers" ON quiz_answers;

CREATE POLICY "Allow public read access to quiz answers" ON quiz_answers
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create quiz answers" ON quiz_answers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update quiz answers" ON quiz_answers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete quiz answers" ON quiz_answers
  FOR DELETE USING (auth.role() = 'authenticated'); 