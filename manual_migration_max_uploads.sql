-- Add max_gallery_uploads column to events table
-- This migration adds a column to control the maximum number of photos each attendee can upload

ALTER TABLE events ADD COLUMN IF NOT EXISTS max_gallery_uploads integer DEFAULT 2;

-- Add comment to document the purpose
COMMENT ON COLUMN events.max_gallery_uploads IS 'Maximum number of photos each attendee can upload to the gallery';

-- Update existing events to have the default value if they don't have it set
UPDATE events SET max_gallery_uploads = 2 WHERE max_gallery_uploads IS NULL;

-- Add logo_url column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;

-- Add comment to document the purpose
COMMENT ON COLUMN companies.logo_url IS 'URL to the company logo image'; 