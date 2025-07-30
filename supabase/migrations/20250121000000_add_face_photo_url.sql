-- Add face_photo_url column to attendees table
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS face_photo_url TEXT;

-- Create storage bucket for attendee photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendee-photos', 'attendee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for attendee-photos bucket
CREATE POLICY "Allow authenticated users to upload photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attendee-photos');

CREATE POLICY "Allow authenticated users to view photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'attendee-photos'); 