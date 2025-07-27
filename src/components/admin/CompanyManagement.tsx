/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { Plus, Building2, Calendar, Users, UserPlus, Edit, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Company {
  id: string
  name: string
  created_at: string
  event_count?: number
  attendee_count?: number
}

interface CompanyUser {
  id: string
  email: string
  company_id: string
  created_at: string
  company: {
    name: string
  }
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    company_id: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompanies()
    fetchCompanyUsers()
  }, [])

  const fetchCompanies = async () => {
    try {
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch event and attendee counts for each company
      const companiesWithCounts = await Promise.all(
        companiesData.map(async (company) => {
          const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('company_id', company.id)

          const { data: attendees } = await supabase
            .from('attendees')
            .select('id')
            .in('event_id', events?.map(e => e.id) || [])

          return {
            ...company,
            event_count: events?.length || 0,
            attendee_count: attendees?.length || 0
          }
        })
      )

      setCompanies(companiesWithCounts)
    } catch (error: any) {
      toast.error('Error fetching companies: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('company_users')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCompanyUsers(data || [])
    } catch (error: any) {
      console.error('Error fetching company users:', error)
    }
  }

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyName.trim()) return

    try {
      const { error } = await supabase
        .from('companies')
        .insert([{ name: newCompanyName }])

      if (error) throw error

      toast.success('Company created successfully!')
      setNewCompanyName('')
      setShowModal(false)
      fetchCompanies()
    } catch (error: any) {
      toast.error('Error creating company: ' + error.message)
    }
  }

  const editCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyName.trim() || !editingCompany) return

    try {
      const { error } = await supabase
        .from('companies')
        .update({ name: newCompanyName })
        .eq('id', editingCompany.id)

      if (error) throw error

      toast.success('Company updated successfully!')
      setNewCompanyName('')
      setEditingCompany(null)
      setShowModal(false)
      fetchCompanies()
    } catch (error: any) {
      toast.error('Error updating company: ' + error.message)
    }
  }

  const deleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company? This will also delete all events and attendees.')) return

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)

      if (error) throw error
      toast.success('Company deleted successfully!')
      fetchCompanies()
      fetchCompanyUsers()
    } catch (error: any) {
      toast.error('Error deleting company: ' + error.message)
    }
  }

  const openEditModal = (company: Company) => {
    setEditingCompany(company)
    setNewCompanyName(company.name)
    setShowModal(true)
  }

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
      setUserForm({ email: '', password: '', company_id: '' })
      setShowUserModal(false)
      fetchCompanyUsers()
    } catch (error: any) {
      toast.error('Error creating user: ' + error.message)
    }
  }

  const deleteCompanyUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      // Delete from company_users table
      const { error: deleteError } = await supabase
        .from('company_users')
        .delete()
        .eq('id', userId)

      if (deleteError) throw deleteError

      toast.success('User deleted successfully!')
      fetchCompanyUsers()
    } catch (error: any) {
      toast.error('Error deleting user: ' + error.message)
    }
  }

  const resetForm = () => {
    setNewCompanyName('')
    setEditingCompany(null)
    setShowModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600 mt-2">Manage companies, events, and user access</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowUserModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Add User
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Company
          </button>
        </div>
      </div>

      {/* Companies with Users */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
>        {companies.map((company) => {
          const companyUsersList = companyUsers.filter(user => user.company_id === company.id)
          return (
            <div key={company.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <Building2 className="h-8 w-8 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{company.name}</h3>
                    <p className="text-sm text-gray-500">
                      Created {new Date(company.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(company)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteCompany(company.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-5 w-5 mr-2" />
                  <span>{company.event_count} Events</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Users className="h-5 w-5 mr-2" />
                  <span>{company.attendee_count} Total Attendees</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <UserPlus className="h-5 w-5 mr-2" />
                  <span>{companyUsersList.length} Users</span>
                </div>
              </div>

              {/* Company Users */}
              {companyUsersList.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Company Users</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {companyUsersList.map((user) => (
                      <div key={user.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{user.email}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteCompanyUser(user.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
          </div>
      </div>

      {companies.length === 0 && companyUsers.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first company</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Company
          </button>
        </div>
      )}

      {/* Create Company User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Company User</h2>
            <form onSubmit={createCompanyUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company *
                  </label>
                  <select
                    value={userForm.company_id}
                    onChange={(e) => setUserForm({ ...userForm, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy company grid - keeping for backward compatibility */}
      <div className="hidden">
        {companies.map((company) => (
          <div key={company.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">{company.name}</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center text-gray-600">
                <Calendar className="h-5 w-5 mr-2" />
                <span>{company.event_count} Events</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Users className="h-5 w-5 mr-2" />
                <span>{company.attendee_count} Total Attendees</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Created {new Date(company.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Company Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingCompany ? 'Edit Company' : 'Create New Company'}
            </h2>
            <form onSubmit={editingCompany ? editCompany : createCompany}>
              <div className="mb-4">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingCompany ? 'Update Company' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}