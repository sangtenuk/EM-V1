import { useState, useEffect } from 'react' 
import { Plus, Building2, Calendar, Users, UserPlus, Edit, Trash2, Mail, Phone, Star, TrendingUp, Activity } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import { useHybridDB } from '../../lib/hybridDB'
import toast from 'react-hot-toast'
import { create } from 'zustand';
import { hybridDB } from '../../lib/hybridDB';
import { Link } from 'react-router-dom';
import { uploadToPublicFolder, getFileUrl } from '../../lib/fileUpload';

interface Company {
  id: string
  name: string
  created_at?: string
  event_count?: number
  attendee_count?: number
  person_in_charge?: string
  contact_number?: string
  email?: string
  logo?: string
  lastSynced?: string
  syncStatus?: 'pending' | 'synced' | 'error'
  isLocal?: boolean
  events?: Array<{
    id: string
    name: string
    date: string | null
    attendee_count: number
    checked_in_count: number
  }>
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

// Utility to generate a color from a string
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `#${((hash >> 24) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 16) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 8) & 0xFF).toString(16).padStart(2, '0')}`;
  return color;
}

// Get gradient colors based on company color
function getGradientColors(baseColor: string) {
  return {
    from: baseColor + '20',
    to: baseColor + '10',
    border: baseColor + '30'
  }
}

export default function CompanyManagement() {
  const { getCompanies, createCompany: createCompanyHybrid, updateCompany: updateCompanyHybrid, deleteCompany: deleteCompanyHybrid } = useHybridDB();
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    company_id: '',
    newPassword: ''
  })
  const [loading, setLoading] = useState(true)
  // Add new state for company details
  const [companyForm, setCompanyForm] = useState({
    name: '',
    person_in_charge: '',
    contact_number: '',
    email: '',
    logo: '',
  })
  // Add upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetchCompanies()
    fetchCompanyUsers()
  }, [])

  const fetchCompanies = async () => {
    try {
      const companiesData = await getCompanies();

      // Fetch events and attendees for each company
      const companiesWithCounts = await Promise.all(
        companiesData.map(async (company) => {
          try {
            const { data: events } = await supabase
              .from('events')
              .select(`
                id,
                name,
                date,
                attendees(id, checked_in)
              `)
              .eq('company_id', company.id)
              .order('date', { ascending: false })

            const allAttendees = events?.flatMap(e => e.attendees || []) || []

            return {
              ...company,
              event_count: events?.length || 0,
              attendee_count: allAttendees.length,
              events: events?.map(event => ({
                id: event.id,
                name: event.name,
                date: event.date,
                attendee_count: event.attendees?.length || 0,
                checked_in_count: event.attendees?.filter((a: any) => a.checked_in).length || 0
              })) || []
            }
          } catch (error) {
            // If we can't fetch events (offline), just return the company data
            return {
              ...company,
              event_count: 0,
              attendee_count: 0,
              events: []
            }
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
    if (!companyForm.name.trim()) return

    try {
      await createCompanyHybrid({ ...companyForm })

      toast.success('Company created successfully!')
      setCompanyForm({ name: '', person_in_charge: '', contact_number: '', email: '', logo: '' })
      setShowModal(false)
      fetchCompanies()
    } catch (error: any) {
      toast.error('Error creating company: ' + error.message)
    }
  }

  const editCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyForm.name.trim() || !editingCompany) return

    try {
      await updateCompanyHybrid(editingCompany.id, { ...companyForm })

      toast.success('Company updated successfully!')
      setCompanyForm({ name: '', person_in_charge: '', contact_number: '', email: '', logo: '' })
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
      await deleteCompanyHybrid(companyId)
      toast.success('Company deleted successfully!')
      fetchCompanies()
      fetchCompanyUsers()
    } catch (error: any) {
      toast.error('Error deleting company: ' + error.message)
    }
  }

  const openEditModal = (company: Company) => {
    setEditingCompany(company)
    setCompanyForm({
      name: company.name || '',
      person_in_charge: company.person_in_charge || '',
      contact_number: company.contact_number || '',
      email: company.email || '',
      logo: company.logo || '',
    })
    setShowModal(true)
  }

  const openEditUserModal = (user: CompanyUser) => {
    setEditingUser(user)
    setUserForm({
      email: user.email,
      password: '',
      company_id: user.company_id,
      newPassword: ''
    })
    setShowUserModal(true)
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
      setUserForm({ email: '', password: '', company_id: '', newPassword: '' })
      setShowUserModal(false)
      fetchCompanyUsers()
    } catch (error: any) {
      toast.error('Error creating user: ' + error.message)
    }
  }

  const updateCompanyUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userForm.email.trim() || !editingUser) return

    try {
      // Update email in company_users table
      const { error: updateError } = await supabase
        .from('company_users')
        .update({ email: userForm.email })
        .eq('id', editingUser.id)

      if (updateError) throw updateError

      // If new password is provided, update it via Edge Function
      if (userForm.newPassword.trim()) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-company-user-password`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: editingUser.id,
            new_password: userForm.newPassword
          })
        })

        const result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to update password')
        }
      }

      toast.success('User updated successfully!')
      setUserForm({ email: '', password: '', company_id: '', newPassword: '' })
      setEditingUser(null)
      setShowUserModal(false)
      fetchCompanyUsers()
    } catch (error: any) {
      toast.error('Error updating user: ' + error.message)
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
    setEditingUser(null)
    setShowModal(false)
    setShowUserModal(false)
  }

  // Add logo upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      // Upload to public folder using the new utility
      const uploadedFile = await uploadToPublicFolder(file, 'logo', undefined, editingCompany?.id);
      setCompanyForm({ ...companyForm, logo: uploadedFile.url });
      toast.success('Logo uploaded to public folder!');
    } catch (err: any) {
      toast.error('Error uploading logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Company Management
            </h1>
            <p className="text-gray-600 mt-2">Manage companies, events, and user access</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Add User
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Company
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Companies</p>
                <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-xl">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {companies.reduce((sum, company) => sum + (company.event_count || 0), 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Attendees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {companies.reduce((sum, company) => sum + (company.attendee_count || 0), 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-xl">
                <UserPlus className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{companyUsers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => {
            const companyUsersList = companyUsers.filter(user => user.company_id === company.id)
            const companyColor = stringToColor(company.id)
            const gradients = getGradientColors(companyColor)
            return (
              <div key={company.id} className="group bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
                {/* Company Header with Gradient */}
                <div 
                  className="p-4 text-white relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${companyColor}, ${companyColor}dd)`
                  }}
                >
                  <div className="absolute inset-0 bg-black opacity-10"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="p-2 bg-white bg-opacity-20 rounded-xl mr-3">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-bold truncate">{company.name}</h3>
                          <p className="text-sm opacity-90">
                            Created {company.created_at ? new Date(company.created_at).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(company)}
                          className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCompany(company.id)}
                          className="p-2 bg-red-500 bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{company.event_count}</div>
                        <div className="text-xs opacity-90">Events</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{company.attendee_count}</div>
                        <div className="text-xs opacity-90">Attendees</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{companyUsersList.length}</div>
                        <div className="text-xs opacity-90">Users</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Company Content */}
                <div className="p-4">
                  {/* Contact Info */}
                  {(company.person_in_charge || company.contact_number || company.email) && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                      {company.person_in_charge && (
                        <div className="flex items-center text-gray-700 mb-2">
                          <Star className="h-4 w-4 mr-2 text-yellow-500" />
                          <span className="text-sm font-medium">{company.person_in_charge}</span>
                        </div>
                      )}
                      {company.contact_number && (
                        <div className="flex items-center text-gray-600 mb-2">
                          <Phone className="h-4 w-4 mr-2 text-blue-500" />
                          <span className="text-sm">{company.contact_number}</span>
                        </div>
                      )}
                      {company.email && (
                        <div className="flex items-center text-gray-600">
                          <Mail className="h-4 w-4 mr-2 text-green-500" />
                          <span className="text-sm">{company.email}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Events Section */}
                  {company.events && company.events.length > 0 && (
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                        Events
                      </h4>
                      <div className="space-y-2">
                        {company.events.map((event) => (
                          <Link
                            key={event.id}
                            to={`/admin/events/${event.id}`}
                            className="block p-2 rounded-lg hover:bg-gray-50 transition-all duration-200 border border-gray-100 hover:border-gray-200"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="font-semibold text-gray-900 px-3 py-1 rounded-lg text-sm inline-block"
                                  style={{ 
                                    backgroundColor: gradients.from,
                                    color: companyColor,
                                    border: `1px solid ${gradients.border}`
                                  }}
                                >
                                  {event.name}
                                </div>
                                {event.date && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(event.date).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-semibold text-gray-900">
                                  {event.checked_in_count}/{event.attendee_count}
                                </div>
                                <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                                  <div 
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{ 
                                      width: `${event.attendee_count > 0 ? (event.checked_in_count / event.attendee_count) * 100 : 0}%`,
                                      backgroundColor: companyColor
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users Section */}
                  {companyUsersList.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <UserPlus className="h-4 w-4 mr-2 text-purple-500" />
                        Users ({companyUsersList.length})
                      </h4>
                      <div className="space-y-2">
                        {companyUsersList.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">{user.email}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(user.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex space-x-1 ml-3">
                              <button
                                onClick={() => openEditUserModal(user)}
                                className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteCompanyUser(user.id)}
                                className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
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
              </div>
            )
          })}
        </div>

        {companies.length === 0 && companyUsers.length === 0 && (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 max-w-md mx-auto">
              <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">No companies found</h3>
              <p className="text-gray-600 mb-6">Get started by creating your first company</p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Add Company
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Company User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                {editingUser ? 'Edit Company User' : 'Create Company User'}
              </h2>
              <form onSubmit={editingUser ? updateCompanyUser : createCompanyUser}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Company *
                    </label>
                    <select
                      value={userForm.company_id}
                      onChange={(e) => setUserForm({ ...userForm, company_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      disabled={!!editingUser}
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter password"
                        required
                        minLength={6}
                      />
                    </div>
                  )}
                  {editingUser && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        New Password (leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        value={userForm.newPassword}
                        onChange={(e) => setUserForm({ ...userForm, newPassword: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter new password"
                        minLength={6}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-3 mt-8">
                  <button
                    type="button"
                                      onClick={() => {
                    setShowUserModal(false)
                    setEditingUser(null)
                    setUserForm({ email: '', password: '', company_id: '', newPassword: '' })
                  }}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium"
                  >
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Company Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                {editingCompany ? 'Edit Company' : 'Create New Company'}
              </h2>
              <form onSubmit={editingCompany ? editCompany : createCompany}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name *</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      value={companyForm.name} 
                      onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Person in Charge</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      value={companyForm.person_in_charge} 
                      onChange={e => setCompanyForm({ ...companyForm, person_in_charge: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      value={companyForm.contact_number} 
                      onChange={e => setCompanyForm({ ...companyForm, contact_number: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      value={companyForm.email} 
                      onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Logo</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      disabled={uploadingLogo}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {uploadingLogo && <div className="text-sm text-blue-500 mt-2">Uploading...</div>}
                    {companyForm.logo && (
                      <img src={getStorageUrl(companyForm.logo)} alt="Logo Preview" className="w-16 h-16 rounded-xl object-cover mt-2" />
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-8">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium"
                  >
                    {editingCompany ? 'Update Company' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}