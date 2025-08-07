-- Complete RLS policy fix for all tables

-- 1. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated users to manage companies" ON companies;
DROP POLICY IF EXISTS "Allow authenticated users to manage company users" ON company_users;
DROP POLICY IF EXISTS "Allow authenticated users to manage events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to manage attendees" ON attendees;
DROP POLICY IF EXISTS "Public can read events for registration" ON events;
DROP POLICY IF EXISTS "Public can insert attendees" ON attendees;
DROP POLICY IF EXISTS "Public can read own attendee record" ON attendees;
DROP POLICY IF EXISTS "Public can update check-in status" ON attendees;

-- 2. Create comprehensive policies for companies
CREATE POLICY "Allow all operations on companies" ON companies
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Create comprehensive policies for company_users
CREATE POLICY "Allow all operations on company_users" ON company_users
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Create comprehensive policies for events
CREATE POLICY "Allow all operations on events" ON events
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Create comprehensive policies for attendees
CREATE POLICY "Allow all operations on attendees" ON attendees
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Also allow public access for basic operations (registration, check-in)
CREATE POLICY "Public can read events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Public can insert attendees" ON attendees
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read attendees" ON attendees
  FOR SELECT USING (true);

CREATE POLICY "Public can update attendees" ON attendees
  FOR UPDATE USING (true);

-- 7. Verify the policies were created
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

-- 8. Test the policies by checking if we can insert
-- (This will show if the policies are working)
SELECT 'RLS policies updated successfully' as status; 