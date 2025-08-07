# 🚀 Complete Migration Guide: Move to New Supabase Project

## 📋 **Overview**
Your current Supabase project has hit the egress limit. This guide will help you migrate to a new Supabase project with all your data and functionality intact.

## 🎯 **What You'll Get**
- ✅ **Complete database schema** with all tables
- ✅ **All RLS policies** properly configured
- ✅ **Performance indexes** for fast queries
- ✅ **Data migration tools** to move your existing data
- ✅ **Updated configuration** for your new project

## 📁 **Files Created**
1. `complete_database_migration.sql` - Complete database setup
2. `export_data_for_migration.sql` - Export your existing data
3. `MIGRATION_TO_NEW_SUPABASE_GUIDE.md` - This guide

## 🛠️ **Step-by-Step Migration Process**

### **Step 1: Create New Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `EM-V1-New` (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project to be ready (2-3 minutes)

### **Step 2: Get New Project Credentials**
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://your-new-project.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### **Step 3: Set Up Database Schema**
1. Go to **SQL Editor** in your new project
2. Copy and paste the entire content of `complete_database_migration.sql`
3. Click **Run** to execute
4. You should see: `"Database migration completed successfully!"`

### **Step 4: Export Data from Old Project**
1. Go to your **OLD** Supabase project
2. Go to **SQL Editor**
3. Copy and paste the content of `export_data_for_migration.sql`
4. Run each SELECT statement to export your data
5. **Save the results** (you can download as CSV or copy the data)

### **Step 5: Import Data to New Project**
1. Go to your **NEW** Supabase project
2. Go to **SQL Editor**
3. Convert the exported data to INSERT statements
4. Run the INSERT statements to import your data

### **Step 6: Update Your Application**
1. Update your environment variables:

```bash
# Update NW.env file
VITE_SUPABASE_URL=https://your-new-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key
```

2. Restart your application:
```bash
npm run dev
```

## 🔧 **Alternative: Quick Start (No Data Migration)**

If you want to start fresh without migrating existing data:

1. **Create new Supabase project**
2. **Run the migration script** (`complete_database_migration.sql`)
3. **Update your environment variables**
4. **Test the application** - everything should work!

## ✅ **Verification Checklist**

After migration, verify these work:

- [ ] **Company Creation** - Create a new company
- [ ] **User Creation** - Create a user for the company
- [ ] **AssignFeatures** - Assign features to companies
- [ ] **Event Creation** - Create events
- [ ] **Attendee Registration** - Register attendees
- [ ] **Check-in System** - Check in attendees
- [ ] **All Other Features** - Voting, Quiz, Lucky Draw, Gallery

## 🚨 **Important Notes**

### **File Storage**
- **Images/Logos**: If you have uploaded files, you'll need to re-upload them
- **Local Storage**: The app uses local storage for images, so they should persist

### **Authentication**
- **User Accounts**: Users will need to sign up again in the new project
- **Admin Access**: You'll need to set up admin access again

### **Environment Variables**
Make sure to update:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🎉 **Benefits of New Project**

1. **✅ Fresh egress quota** - No more limits
2. **✅ Better performance** - Clean database
3. **✅ Latest features** - Access to newest Supabase features
4. **✅ Proper RLS policies** - Security configured correctly
5. **✅ All AssignFeatures functionality** - Ready to use

## 🆘 **Troubleshooting**

### **If migration fails:**
1. Check that all SQL executed successfully
2. Verify RLS policies are created
3. Test with a simple company creation

### **If data import fails:**
1. Check foreign key relationships
2. Import in order: companies → users → events → attendees
3. Verify UUIDs are valid

### **If app doesn't connect:**
1. Verify environment variables are updated
2. Check that new project is active
3. Test connection with simple query

## 📞 **Need Help?**

If you encounter any issues:
1. Check the Supabase logs
2. Verify all SQL executed successfully
3. Test with the provided verification queries

The AssignFeatures system and all other functionality will work perfectly in your new project! 🚀 