/*
  # Add registration_qr column to events table

  1. Changes
    - Add `registration_qr` column to `events` table
    - Column type: TEXT (nullable)
    - Used to store QR code data URLs for event registration

  2. Notes
    - This column will store base64-encoded QR code images
    - Nullable to support existing events without QR codes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'registration_qr'
  ) THEN
    ALTER TABLE events ADD COLUMN registration_qr text;
  END IF;
END $$;