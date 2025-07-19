/*
  # Remove unique constraint on qr_code column

  1. Changes
    - Remove the unique constraint `attendees_qr_code_key` from the `qr_code` column
    - This constraint is causing issues because base64 QR code data is too large for B-tree indexing
    - Attendee uniqueness is already handled by the `id` primary key

  2. Reasoning
    - QR codes contain large base64 image data that exceeds B-tree index size limits
    - The unique constraint on qr_code is not necessary for data integrity
    - Each attendee already has a unique ID for identification
*/

-- Remove the unique constraint on qr_code column
ALTER TABLE public.attendees DROP CONSTRAINT IF EXISTS attendees_qr_code_key;