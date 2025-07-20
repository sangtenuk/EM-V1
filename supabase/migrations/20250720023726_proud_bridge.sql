/*
  # Add seating columns to attendees table

  1. Changes
    - Add `table_number` column (integer, nullable) to attendees table
    - Add `seat_number` column (integer, nullable) to attendees table
    
  2. Purpose
    - Enable seating arrangement functionality
    - Allow assignment of attendees to specific tables and seats
*/

-- Add table_number column to attendees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendees' AND column_name = 'table_number'
  ) THEN
    ALTER TABLE attendees ADD COLUMN table_number integer;
  END IF;
END $$;

-- Add seat_number column to attendees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendees' AND column_name = 'seat_number'
  ) THEN
    ALTER TABLE attendees ADD COLUMN seat_number integer;
  END IF;
END $$;