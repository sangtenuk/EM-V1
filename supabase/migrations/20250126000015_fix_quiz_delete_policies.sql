-- Fix RLS policies for quiz tables to allow DELETE operations
-- This migration adds missing DELETE policies for authenticated users

-- Add DELETE policy for quiz_sessions
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz sessions" ON quiz_sessions;
CREATE POLICY "Allow authenticated users to delete quiz sessions" ON quiz_sessions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add DELETE policy for quiz_questions
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz questions" ON quiz_questions;
CREATE POLICY "Allow authenticated users to delete quiz questions" ON quiz_questions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add DELETE policy for quiz_answers
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz answers" ON quiz_answers;
CREATE POLICY "Allow authenticated users to delete quiz answers" ON quiz_answers
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add DELETE policy for quiz_participants
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz participants" ON quiz_participants;
CREATE POLICY "Allow authenticated users to delete quiz participants" ON quiz_participants
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add DELETE policy for quiz_responses
DROP POLICY IF EXISTS "Allow authenticated users to delete quiz responses" ON quiz_responses;
CREATE POLICY "Allow authenticated users to delete quiz responses" ON quiz_responses
  FOR DELETE USING (auth.role() = 'authenticated'); 