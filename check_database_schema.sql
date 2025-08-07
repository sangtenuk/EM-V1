-- Check and create necessary tables for the event management system

-- 1. Create companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  person_in_charge text,
  contact_number text,
  email text,
  logo text,
  features_enabled jsonb DEFAULT '{
    "registration": true,
    "checkin": true,
    "voting": true,
    "welcoming": true,
    "quiz": true,
    "lucky_draw": true,
    "gallery": true
  }'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Create company_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. Create events table if it doesn't exist
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  date timestamptz,
  location text,
  max_attendees integer DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

-- 4. Create attendees table if it doesn't exist
CREATE TABLE IF NOT EXISTS attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  identification_number text,
  staff_id text,
  table_assignment text,
  table_number integer,
  seat_number integer,
  qr_code text UNIQUE,
  face_photo_url text,
  checked_in boolean DEFAULT false,
  check_in_time timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5. Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- 6. Create basic RLS policies
-- Companies policies
CREATE POLICY "Allow authenticated users to manage companies" ON companies
  FOR ALL TO authenticated USING (true);

-- Company users policies
CREATE POLICY "Allow authenticated users to manage company users" ON company_users
  FOR ALL TO authenticated USING (true);

-- Events policies
CREATE POLICY "Allow authenticated users to manage events" ON events
  FOR ALL TO authenticated USING (true);

-- Attendees policies
CREATE POLICY "Allow authenticated users to manage attendees" ON attendees
  FOR ALL TO authenticated USING (true);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_features_enabled ON companies USING GIN (features_enabled);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);

-- 8. Add comments for documentation
COMMENT ON COLUMN companies.features_enabled IS 'JSON object containing boolean flags for each feature. Super admin can assign specific features to companies based on their package.'; 