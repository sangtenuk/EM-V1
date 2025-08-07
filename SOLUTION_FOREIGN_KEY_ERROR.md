# Foreign Key Constraint Error - Solution

## 🔍 **Problem Identified:**
The error `"insert or update on table "company_users" violates foreign key constraint "company_users_company_id_fkey"` occurs because:

1. **No companies exist** in the database (0 companies found)
2. **You're trying to create a user** for a company that doesn't exist
3. **The company_id being used** is invalid or doesn't exist

## 🛠️ **Solution Steps:**

### **Step 1: Create a Company First**
Before creating users, you need to create at least one company:

1. **Go to Company Management** in your app
2. **Click "Add Company"** button
3. **Fill in the company details:**
   - Company Name (required)
   - Person in Charge (optional)
   - Contact Number (optional)
   - Email (optional)
4. **Click "Create Company"**

### **Step 2: Verify Company Creation**
After creating a company, you should see it in the companies list. The company will have:
- A unique ID
- The name you entered
- Default features enabled

### **Step 3: Create Users for the Company**
Once you have a company:

1. **Click "Add User"** button
2. **Select the company** from the dropdown
3. **Enter the user's email**
4. **Click "Create User"**

## 🔧 **Database Fix (if needed):**

If you're still getting the error, run this SQL in your Supabase SQL Editor:

```sql
-- Check existing companies
SELECT id, name, created_at FROM companies ORDER BY created_at DESC;

-- Check existing users
SELECT cu.*, c.name as company_name 
FROM company_users cu 
LEFT JOIN companies c ON cu.company_id = c.id 
ORDER BY cu.created_at DESC;

-- Clean up any orphaned records (if any exist)
DELETE FROM company_users 
WHERE company_id NOT IN (SELECT id FROM companies);
```

## 🎯 **Expected Flow:**

1. **Create Company** → Company gets ID (e.g., `abc123`)
2. **Create User** → User gets company_id = `abc123`
3. **Foreign key constraint** → ✅ Valid because company exists

## ⚠️ **Common Mistakes:**

1. **Trying to create user first** - Must create company first
2. **Using invalid company_id** - Make sure to select from dropdown
3. **Company was deleted** - Check if company still exists

## 🧪 **Test the Fix:**

Run this test script to verify everything works:

```bash
node test_database_state.js
```

You should see:
- ✅ Companies count: > 0
- ✅ Users count: > 0 (after creating users)
- ✅ No orphaned records

## 📋 **Quick Checklist:**

- [ ] Create at least one company
- [ ] Verify company appears in the list
- [ ] Try creating a user for that company
- [ ] Check that user appears in the company's user list

The AssignFeatures system will work once you have companies and users set up! 🚀 