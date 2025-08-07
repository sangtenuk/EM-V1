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

-- Test the policies by checking if they exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('companies', 'company_users', 'events', 'attendees')
ORDER BY tablename, policyname; 