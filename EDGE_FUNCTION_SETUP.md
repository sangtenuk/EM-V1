# Edge Function Setup Instructions

## Current Status
The user creation functionality has been simplified to work without Edge Functions. Users are created in the `company_users` table and can sign up later with the same email address.

## If You Want to Use Edge Functions (Optional)

### 1. Deploy the Edge Function
```bash
# Navigate to your project directory
cd /path/to/your/project

# Deploy the create-company-user function
npx supabase functions deploy create-company-user

# Deploy the update-company-user-password function (if needed)
npx supabase functions deploy update-company-user-password
```

### 2. Set Environment Variables
In your Supabase project dashboard:
1. Go to Settings > API
2. Copy your `service_role` key
3. Go to Settings > Functions
4. Add environment variable: `SUPABASE_SERVICE_ROLE_KEY`

### 3. Update the Code
If you want to use Edge Functions, replace the current user creation code in `CompanyManagement.tsx` with:

```typescript
const createCompanyUser = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!userForm.email.trim() || !userForm.password.trim() || !userForm.company_id) return

  try {
    // Get current session for authorization
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Call Edge Function to create user securely
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userForm.email,
        password: userForm.password,
        company_id: userForm.company_id
      })
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create user')
    }

    toast.success('Company user created successfully!')
    setUserForm({ email: '', password: '', company_id: '', newPassword: '' })
    setShowUserModal(false)
    fetchCompanyUsers()
  } catch (error: any) {
    toast.error('Error creating user: ' + error.message)
  }
}
```

## Current Working Solution
The current implementation creates users in the `company_users` table without requiring Edge Functions. Users can then sign up with the same email address to get access to the system.

This approach is simpler and doesn't require additional setup. 