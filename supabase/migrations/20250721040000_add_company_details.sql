-- Add more company details
ALTER TABLE companies ADD COLUMN IF NOT EXISTS person_in_charge text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo text; 