-- Add qr_code column to attendees table
-- This migration adds a column to store QR codes for individual attendees

ALTER TABLE attendees ADD COLUMN IF NOT EXISTS qr_code text;

-- Add comment to document the purpose
COMMENT ON COLUMN attendees.qr_code IS 'QR code data URL for attendee check-in';

-- Add unique constraints for name, identification_number, and staff_id within the same event
-- This ensures uniqueness per event as requested by the user

-- First, create a unique index for name per event
CREATE UNIQUE INDEX IF NOT EXISTS attendees_name_event_unique 
ON attendees (event_id, LOWER(name));

-- Create a unique index for identification_number per event
CREATE UNIQUE INDEX IF NOT EXISTS attendees_identification_event_unique 
ON attendees (event_id, identification_number);

-- Create a unique index for staff_id per event (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS attendees_staff_id_event_unique 
ON attendees (event_id, staff_id) WHERE staff_id IS NOT NULL; 