/*
  # Add identification fields to attendees table

  1. Changes
    - Add `identification_number` column (unique, required)
    - Add `staff_id` column (optional)
    - Remove dependency on company field for identification
  
  2. Security
    - Maintain existing RLS policies
    - Add unique constraint on identification_number
*/

-- Add identification_number column (unique, required)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendees' AND column_name = 'identification_number'
  ) THEN
    ALTER TABLE attendees ADD COLUMN identification_number text;
  END IF;
END $$;

-- Add staff_id column (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendees' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE attendees ADD COLUMN staff_id text;
  END IF;
END $$;

-- Add unique constraint on identification_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendees' AND constraint_name = 'attendees_identification_number_key'
  ) THEN
    ALTER TABLE attendees ADD CONSTRAINT attendees_identification_number_key UNIQUE (identification_number);
  END IF;
END $$;