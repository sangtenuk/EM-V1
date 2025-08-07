-- Add max_gallery_uploads column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_gallery_uploads integer DEFAULT 2;

-- Add comment to document the purpose
COMMENT ON COLUMN events.max_gallery_uploads IS 'Maximum number of photos each attendee can upload to the gallery'; 