# Database Setup Guide

## 🚨 Current Issue
Your database connection is working, but there are two issues:
1. Row Level Security (RLS) policies are blocking operations
2. Missing hybrid database columns (syncStatus, lastSynced, isLocal)

Here's how to fix both issues:

## 📋 Step-by-Step Setup

### 1. Run the Database Schema Script
Copy and paste this into your Supabase SQL Editor:

```sql
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
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Company users policies
CREATE POLICY "Allow authenticated users to manage company users" ON company_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Events policies
CREATE POLICY "Allow authenticated users to manage events" ON events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attendees policies
CREATE POLICY "Allow authenticated users to manage attendees" ON attendees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_features_enabled ON companies USING GIN (features_enabled);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id);
CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);

-- 8. Add comments for documentation
COMMENT ON COLUMN companies.features_enabled IS 'JSON object containing boolean flags for each feature. Super admin can assign specific features to companies based on their package.';
```

### 2. Fix Missing Hybrid Database Columns
Run this to add the missing columns that the hybrid database system expects:

```sql
-- Fix all tables by adding missing hybrid database columns

-- 1. Fix companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;

-- 2. Fix events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE events ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS mode text DEFAULT 'online';

-- 3. Fix attendees table
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS table_type text DEFAULT 'Regular';

-- 4. Fix company_users table
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS syncStatus text DEFAULT 'synced';
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS lastSynced timestamptz DEFAULT now();
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS isLocal boolean DEFAULT false;

-- 5. Update existing records
UPDATE companies SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
UPDATE events SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
UPDATE attendees SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
UPDATE company_users SET syncStatus = 'synced', lastSynced = created_at WHERE syncStatus IS NULL;
```

### 3. Fix RLS Policies (if tables already exist)
If the tables already exist but you're getting RLS errors, run this:

```sql
-- Fix RLS policies for the event management system

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to manage companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to manage company users" ON company_users;
DROP POLICY IF EXISTS "Allow authenticated users to manage events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to manage attendees" ON attendees;

-- Create new policies that allow all operations for authenticated users
CREATE POLICY "Allow authenticated users to manage companies" ON companies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage company users" ON company_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage events" ON events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage attendees" ON attendees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow public access for basic operations (registration, check-in)
CREATE POLICY "Public can read events for registration" ON events
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can insert attendees" ON attendees
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Public can read own attendee record" ON attendees
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can update check-in status" ON attendees
  FOR UPDATE TO anon USING (true);
```

### 4. Test the Setup
After running the SQL scripts, test the connection:

```bash
node test_db_connection.js
```

You should see:
- ✅ Companies table accessible
- ✅ Company users table accessible
- ✅ Company creation successful

### 5. Restart Your Application
```bash
npm run dev
```

## 🎯 What Should Work After This

1. **User Creation** - Company users can be created without errors
2. **Company Management** - All company operations should work
3. **AssignFeatures** - The feature assignment system should work
4. **All Existing Features** - Everything else should work normally

## 🔧 Troubleshooting

### If you still get errors:

1. **Check if you're authenticated** - Make sure you're logged in to the app
2. **Clear browser cache** - Hard refresh the page (Ctrl+F5)
3. **Check Supabase logs** - Go to your Supabase dashboard > Logs
4. **Verify RLS policies** - Run the RLS fix script again

### Common Issues:

- **400 Bad Request** - Usually means table doesn't exist or wrong schema
- **409 Conflict** - Usually means unique constraint violation
- **RLS Policy Error** - Run the RLS fix script

## 📞 Need Help?

If you're still having issues:
1. Check the Supabase dashboard logs
2. Run the test script again
3. Make sure you're logged in to the application 