-- Fix company_users foreign key constraint issue

-- 1. First, let's check what companies exist
SELECT id, name, created_at FROM companies ORDER BY created_at DESC;

-- 2. Check if there are any orphaned company_users records
SELECT cu.*, c.name as company_name 
FROM company_users cu 
LEFT JOIN companies c ON cu.company_id = c.id 
WHERE c.id IS NULL;

-- 3. Clean up any orphaned records (if any exist)
DELETE FROM company_users 
WHERE company_id NOT IN (SELECT id FROM companies);

-- 4. Verify the foreign key constraint is working properly
-- This will show any remaining orphaned records
SELECT cu.*, c.name as company_name 
FROM company_users cu 
LEFT JOIN companies c ON cu.company_id = c.id 
WHERE c.id IS NULL;

-- 5. Add a helpful comment to the constraint
COMMENT ON CONSTRAINT company_users_company_id_fkey ON company_users 
IS 'Foreign key to companies table. Make sure the company exists before creating users.'; 