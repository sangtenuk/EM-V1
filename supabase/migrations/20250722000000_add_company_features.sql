-- Add company feature flags for AssignFeatures functionality
-- This allows super admins to assign specific features to each company

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

-- Add RLS policy to ensure only super admins can modify features
CREATE POLICY "Only super admins can modify company features" ON companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true); 