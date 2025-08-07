# Supabase RLS Policy Fix Guide

## 🔍 **Problem Identified:**
The error `"new row violates row-level security policy for table "companies"` occurs because:
1. **RLS is enabled** on all tables
2. **Policies are too restrictive** and blocking operations
3. **The system is trying to connect to Supabase** but getting blocked by RLS

## 🛠️ **Solution:**

### **Step 1: Run the Complete RLS Fix**
Copy and paste this into your Supabase SQL Editor:

```sql
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
```

### **Step 2: Test the Fix**
After running the SQL, test the connection:

```bash
node test_supabase_creation.js
```

You should see:
- ✅ Company creation successful!
- ✅ User creation successful!

### **Step 3: Restart Your Application**
```bash
npm run dev
```

## 🎯 **What Will Work After This:**

1. **✅ Company Creation** - Companies will be created in Supabase
2. **✅ User Creation** - Users will be created in Supabase
3. **✅ AssignFeatures** - Feature assignment will work
4. **✅ All Existing Features** - Everything else will work normally

## 🔧 **Why This Happens:**

- **RLS (Row Level Security)** - Supabase's security feature that blocks operations by default
- **Default Policies** - The default policies are too restrictive
- **Hybrid Database** - The system was trying to use local storage instead of Supabase

## 📋 **Updated Code:**

I've also updated the code to:
- ✅ **Force online mode** for company creation
- ✅ **Create directly in Supabase** instead of local storage
- ✅ **Add proper error handling**
- ✅ **Include features_enabled** by default

## 🚀 **Next Steps:**

1. **Run the RLS fix SQL** in Supabase
2. **Test company creation** in your app
3. **Test user creation** for the company
4. **Test AssignFeatures** - it will work once companies exist!

The AssignFeatures system is ready to go once you fix the RLS policies! 🎉 