/*
  # Create tables for seating arrangement

  1. New Tables
    - `tables`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events)
      - `table_number` (integer)
      - `table_type` (text, default 'Regular')
      - `capacity` (integer, default 8)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `tables` table
    - Add policy for authenticated users to manage tables

  3. Changes
    - Update attendees table to use table_assignment as text (for table numbers)
*/

CREATE TABLE IF NOT EXISTS tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  table_type text DEFAULT 'Regular',
  capacity integer DEFAULT 8,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tables"
  ON tables
  FOR ALL
  TO authenticated
  USING (true);

-- Update attendees table to ensure table_assignment is text for table numbers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendees' AND column_name = 'table_assignment'
  ) THEN
    ALTER TABLE attendees ADD COLUMN table_assignment text;
  END IF;
END $$;