-- Manual migration to add features_enabled column to companies table
-- Run this in the Supabase SQL editor

-- Add features_enabled column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS features_enabled jsonb DEFAULT '{
  "registration": true,
  "checkin": true,
  "voting": true,
  "welcoming": true,
  "quiz": true,
  "lucky_draw": true,
  "gallery": true
}'::jsonb;

-- Add comment to explain the feature flags
COMMENT ON COLUMN companies.features_enabled IS 'JSON object containing boolean flags for each feature. Super admin can assign specific features to companies based on their package.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_features_enabled ON companies USING GIN (features_enabled);

-- Update existing companies to have default features enabled
UPDATE companies 
SET features_enabled = '{
  "registration": true,
  "checkin": true,
  "voting": true,
  "welcoming": true,
  "quiz": true,
  "lucky_draw": true,
  "gallery": true
}'::jsonb
WHERE features_enabled IS NULL; 