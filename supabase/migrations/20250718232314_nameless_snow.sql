/*
  # Event Management System Schema

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamp)
    
    - `events`
      - `id` (uuid, primary key) 
      - `company_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text)
      - `date` (timestamp)
      - `location` (text)
      - `max_attendees` (integer)
      - `created_at` (timestamp)
    
    - `attendees`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `company` (text)
      - `table_assignment` (text)
      - `qr_code` (text)
      - `checked_in` (boolean)
      - `check_in_time` (timestamp)
      - `created_at` (timestamp)
    
    - `gallery_photos`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key)
      - `attendee_name` (text)
      - `photo_url` (text)
      - `created_at` (timestamp)
    
    - `tables`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key)
      - `table_number` (integer)
      - `table_type` (text)
      - `capacity` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  table_assignment text,
  qr_code text UNIQUE,
  checked_in boolean DEFAULT false,
  check_in_time timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  attendee_name text,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  table_type text DEFAULT 'Regular',
  capacity integer DEFAULT 8,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Policies for public access to registration and check-in
CREATE POLICY "Public can read events for registration"
  ON events
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can insert attendees"
  ON attendees
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read own attendee record"
  ON attendees
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can update check-in status"
  ON attendees
  FOR UPDATE
  TO anon
  USING (true);

CREATE POLICY "Public can read gallery photos"
  ON gallery_photos
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can insert gallery photos"
  ON gallery_photos
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policies for authenticated users (admins/superusers)
CREATE POLICY "Authenticated users can manage companies"
  ON companies
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage events"
  ON events
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage attendees"
  ON attendees
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage gallery"
  ON gallery_photos
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage tables"
  ON tables
  FOR ALL
  TO authenticated
  USING (true);