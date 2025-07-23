import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Building2, 
  Calendar, 
  Users, 
  UserCheck, 
  TrendingUp, 
  BarChart3,
  MapPin,
  Image,
  Vote,
  Gift,
  Monitor,
  QrCode,
  ArrowRight,
  Activity,
  Search,
  Clock,
  Eye
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface DashboardProps {
  userCompany?: any
}

interface AdminStats {
  totalCompanies: number
  totalEvents: number
  totalAttendees: number
  totalCheckedIn: number
  totalUsers: number
  recentEvents: Array<{
    id: string
    name: string
    company: { name: string }
    attendee_count: number
    checked_in_count: number
    created_at: string
    date: string | null
  }>
  recentUsers: Array<{
    id: string
    email: string
    company: { name: string }
    created_at: string
    last_sign_in_at: string | null
  }>
  monthlyGrowth: {
    companies: number
    events: number
    attendees: number
    users: number
  }
  searchResults: {
    companies: Array<{ id: string, name: string, created_at: string }>
    users: Array<{ id: string, email: string, company: { name: string } }>
    events: Array<{ id: string, name: string, company: { name: string }, date: string | null }>
  }
}

interface CompanyStats {
  totalEvents: number
  totalAttendees: number
  totalCheckedIn: number
  upcomingEvents: number
  recentEvents: Array<{
    id: string
    name: string
    date: string | null
    attendee_count: number
    checked_in_count: number
  }>
  quickActions: Array<{
    name: string
    path: string
    icon: any
    description: string
    color: string
  }>
  monthlyData: Array<{
    month: string
    events: number
    attendees: number
    checkedIn: number
  }>
}

export default function Dashboard({ userCompany }: DashboardProps) {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<AdminStats['searchResults'] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (userCompany) {
      fetchCompanyStats()
    } else {
      fetchAdminStats()
    }
  }, [userCompany])

  useEffect(() => {
    if (searchTerm && !userCompany) {
      const debounceTimer = setTimeout(() => {
        performSearch()
      }, 300)
      return () => clearTimeout(debounceTimer)
    } else {
      setSearchResults(null)
    }
  }, [searchTerm, userCompany])

  const performSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null)
      return
    }

    setSearching(true)
    try {
      const searchPattern = `%${searchTerm.toLowerCase()}%`

      // Search companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, created_at')
        .ilike('name', searchPattern)
        .limit(5)

      // Search users
      const { data: users } = await supabase
        .from('company_users')
        .select(`
          id,
          email,
          company:companies(name)
        `)
        .ilike('email', searchPattern)
        .limit(5)

      // Search events
      const { data: events } = await supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          company:companies(name)
        `)
        .ilike('name', searchPattern)
        .limit(5)

      setSearchResults({
        companies: companies || [],
        users: (users || []).map(user => ({
          ...user,
          company: Array.isArray(user.company) ? user.company[0] : user.company
        })),
        events: (events || []).map(event => ({
          ...event,
          company: Array.isArray(event.company) ? event.company[0] : event.company
        }))
      })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  const fetchAdminStats = async () => {
    try {
      setLoading(true)

      // Fetch companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, created_at')

      // Fetch events with company info
      const { data: events } = await supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          created_at,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      // Fetch attendees
      const { data: attendees } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in, created_at')

      // Fetch users
      const { data: users } = await supabase
        .from('company_users')
        .select(`
          id,
          email,
          created_at,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      // Calculate stats
      const totalCompanies = companies?.length || 0
      const totalEvents = events?.length || 0
      const totalAttendees = attendees?.length || 0
      const totalCheckedIn = attendees?.filter(a => a.checked_in).length || 0
      const totalUsers = users?.length || 0

      // Get recent events with attendee counts
      const recentEventsWithCounts = await Promise.all(
        (events?.slice(0, 5) || []).map(async (event) => {
          const eventAttendees = attendees?.filter(a => a.event_id === event.id) || []
          return {
            ...event,
            company: Array.isArray(event.company) ? event.company[0] : event.company,
            attendee_count: eventAttendees.length,
            checked_in_count: eventAttendees.filter(a => a.checked_in).length
          }
        })
      )

      // Get recent users
      const recentUsers = (users?.slice(0, 5) || []).map(user => ({
        ...user,
        company: Array.isArray(user.company) ? user.company[0] : user.company,
        last_sign_in_at: null // This would come from auth.users if accessible
      }))

      // Calculate monthly growth (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const monthlyGrowth = {
        companies: companies?.filter(c => new Date(c.created_at) > thirtyDaysAgo).length || 0,
        events: events?.filter(e => new Date(e.created_at) > thirtyDaysAgo).length || 0,
        attendees: attendees?.filter(a => new Date(a.created_at) > thirtyDaysAgo).length || 0,
        users: users?.filter(u => new Date(u.created_at) > thirtyDaysAgo).length || 0
      }

      setAdminStats({
        totalCompanies,
        totalEvents,
        totalAttendees,
        totalCheckedIn,
        totalUsers,
        recentEvents: recentEventsWithCounts,
        recentUsers,
        monthlyGrowth,
        searchResults: { companies: [], users: [], events: [] }
      })
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyStats = async () => {
    try {
      setLoading(true)

      // Fetch company events
      const { data: events } = await supabase
        .from('events')
        .select('id, name, date, created_at')
        .eq('company_id', userCompany.company_id)
        .order('created_at', { ascending: false })

      // Fetch attendees for company events
      const eventIds = events?.map(e => e.id) || []
      const { data: attendees } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in, created_at')
        .in('event_id', eventIds)

      // Calculate stats
      const totalEvents = events?.length || 0
      const totalAttendees = attendees?.length || 0
      const totalCheckedIn = attendees?.filter(a => a.checked_in).length || 0
      
      // Count upcoming events
      const now = new Date()
      const upcomingEvents = events?.filter(e => e.date && new Date(e.date) > now).length || 0

      // Get recent events with attendee counts
      const recentEventsWithCounts = (events?.slice(0, 5) || []).map(event => {
        const eventAttendees = attendees?.filter(a => a.event_id === event.id) || []
        return {
          ...event,
          attendee_count: eventAttendees.length,
          checked_in_count: eventAttendees.filter(a => a.checked_in).length
        }
      })

      // Generate monthly data for the last 6 months
      const monthlyData = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

        const monthEvents = events?.filter(e => {
          const eventDate = new Date(e.created_at)
          return eventDate >= monthStart && eventDate <= monthEnd
        }) || []

        const monthAttendees = attendees?.filter(a => {
          const attendeeDate = new Date(a.created_at)
          return attendeeDate >= monthStart && attendeeDate <= monthEnd
        }) || []

        monthlyData.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          events: monthEvents.length,
          attendees: monthAttendees.length,
          checkedIn: monthAttendees.filter(a => a.checked_in).length
        })
      }

      // Define quick actions for company users
      const quickActions = [
        {
          name: 'Create Event',
          path: '/admin/events',
          icon: Calendar,
          description: 'Set up a new event',
          color: 'bg-blue-500'
        },
        {
          name: 'Manage Attendees',
          path: '/admin/attendees',
          icon: Users,
          description: 'View and manage registrations',
          color: 'bg-green-500'
        },
        {
          name: 'Check-in System',
          path: '/admin/checkin',
          icon: QrCode,
          description: 'Scan QR codes for check-in',
          color: 'bg-purple-500'
        },
        {
          name: 'Seating Arrangement',
          path: '/admin/seating',
          icon: MapPin,
          description: 'Arrange tables and seats',
          color: 'bg-orange-500'
        },
        {
          name: 'Event Gallery',
          path: '/admin/gallery',
          icon: Image,
          description: 'Manage photo uploads',
          color: 'bg-pink-500'
        },
        {
          name: 'Voting System',
          path: '/admin/voting',
          icon: Vote,
          description: 'Create voting sessions',
          color: 'bg-indigo-500'
        }
      ]

      setCompanyStats({
        totalEvents,
        totalAttendees,
        totalCheckedIn,
        upcomingEvents,
        recentEvents: recentEventsWithCounts,
        quickActions,
        monthlyData
      })
    } catch (error) {
      console.error('Error fetching company stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Admin Dashboard
  if (!userCompany && adminStats) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">System-wide analytics and management overview</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search companies, users, or events..."
            />
            {searching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults && (
            <div className="mt-4 space-y-4">
              {searchResults.companies.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Companies</h3>
                  <div className="space-y-2">
                    {searchResults.companies.map(company => (
                      <div key={company.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-blue-600 mr-2" />
                          <span>{company.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(company.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.users.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Users</h3>
                  <div className="space-y-2">
                    {searchResults.users.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-green-600 mr-2" />
                          <div>
                            <span>{user.email}</span>
                            <div className="text-sm text-gray-500">{user.company.name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.events.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Events</h3>
                  <div className="space-y-2">
                    {searchResults.events.map(event => (
                      <div key={event.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-purple-600 mr-2" />
                          <div>
                            <span>{event.name}</span>
                            <div className="text-sm text-gray-500">{event.company.name}</div>
                          </div>
                        </div>
                        {event.date && (
                          <span className="text-sm text-gray-500">
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{adminStats.totalCompanies}</div>
                <div className="text-sm text-gray-600">Companies</div>
                {adminStats.monthlyGrowth.companies > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.companies}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{adminStats.totalEvents}</div>
                <div className="text-sm text-gray-600">Events</div>
                {adminStats.monthlyGrowth.events > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.events}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{adminStats.totalAttendees}</div>
                <div className="text-sm text-gray-600">Attendees</div>
                {adminStats.monthlyGrowth.attendees > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.attendees}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{adminStats.totalCheckedIn}</div>
                <div className="text-sm text-gray-600">Check-ins</div>
                <div className="text-xs text-gray-500 mt-1">
                  {adminStats.totalAttendees > 0 
                    ? `${Math.round((adminStats.totalCheckedIn / adminStats.totalAttendees) * 100)}% rate`
                    : '0% rate'
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{adminStats.totalUsers}</div>
                <div className="text-sm text-gray-600">Users</div>
                {adminStats.monthlyGrowth.users > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.users}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Management Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BarChart3 className="h-6 w-6 mr-2" />
              System Management
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/admin/companies"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Building2 className="h-8 w-8 text-blue-600 mb-2" />
                <div className="font-medium">Companies</div>
                <div className="text-sm text-gray-600">Manage organizations</div>
              </Link>
              <Link
                to="/admin/progress"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Activity className="h-8 w-8 text-green-600 mb-2" />
                <div className="font-medium">Analytics</div>
                <div className="text-sm text-gray-600">Monthly progress</div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Events</h2>
              <Link 
                to="/admin/events" 
                className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-3">
              {adminStats.recentEvents.map((event) => (
                <div key={event.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{event.name}</div>
                    <div className="text-sm text-gray-600">{event.company.name}</div>
                    {event.date && (
                      <div className="text-xs text-gray-500">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{event.checked_in_count}/{event.attendee_count}</div>
                    <div className="text-xs text-gray-500">checked in</div>
                  </div>
                </div>
              ))}
              {adminStats.recentEvents.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent events</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Users</h2>
              <Link 
                to="/admin/companies" 
                className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-3">
              {adminStats.recentUsers.map((user) => (
                <div key={user.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-600">{user.company.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    {user.last_sign_in_at && (
                      <div className="text-xs text-green-600 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Active
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {adminStats.recentUsers.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent users</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Company User Dashboard
  if (userCompany && companyStats) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back to {userCompany.company.name}</p>
        </div>

        {/* Company Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{companyStats.totalEvents}</div>
                <div className="text-sm text-gray-600">Total Events</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{companyStats.totalAttendees}</div>
                <div className="text-sm text-gray-600">Total Attendees</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{companyStats.totalCheckedIn}</div>
                <div className="text-sm text-gray-600">Total Check-ins</div>
                <div className="text-xs text-gray-500 mt-1">
                  {companyStats.totalAttendees > 0 
                    ? `${Math.round((companyStats.totalCheckedIn / companyStats.totalAttendees) * 100)}% rate`
                    : '0% rate'
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{companyStats.upcomingEvents}</div>
                <div className="text-sm text-gray-600">Upcoming Events</div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            Monthly Performance
          </h2>
          <div className="space-y-4">
            {companyStats.monthlyData.map((month, index) => {
              const maxValue = Math.max(...companyStats.monthlyData.map(m => Math.max(m.events * 10, m.attendees, m.checkedIn)))
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{month.month}</span>
                    <span className="text-gray-600">
                      {month.events} events • {month.attendees} attendees
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <div className="w-16 text-xs text-gray-600">Events</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxValue > 0 ? ((month.events * 10) / maxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-xs text-right">{month.events}</div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="w-16 text-xs text-gray-600">Attendees</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxValue > 0 ? (month.attendees / maxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-xs text-right">{month.attendees}</div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="w-16 text-xs text-gray-600">Check-ins</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxValue > 0 ? (month.checkedIn / maxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-xs text-right">{month.checkedIn}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions and Recent Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              {companyStats.quickActions.slice(0, 4).map((action) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.name}
                    to={action.path}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="font-medium text-gray-900">{action.name}</div>
                    <div className="text-sm text-gray-600">{action.description}</div>
                  </Link>
                )
              })}
            </div>
            
            {companyStats.quickActions.length > 4 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  {companyStats.quickActions.slice(4).map((action) => {
                    const Icon = action.icon
                    return (
                      <Link
                        key={action.name}
                        to={action.path}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{action.name}</div>
                          <div className="text-xs text-gray-600">{action.description}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Events</h2>
              <Link 
                to="/admin/events" 
                className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-3">
              {companyStats.recentEvents.map((event) => (
                <div key={event.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{event.name}</div>
                    {event.date && (
                      <div className="text-sm text-gray-600">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{event.checked_in_count}/{event.attendee_count}</div>
                    <div className="text-xs text-gray-500">attendees</div>
                  </div>
                </div>
              ))}
              {companyStats.recentEvents.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No events yet</p>
                  <Link 
                    to="/admin/events" 
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Create your first event
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Tools */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Event Tools</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/admin/lucky-draw"
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Gift className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <div className="font-medium text-sm">Lucky Draw</div>
            </Link>
            <Link
              to="/admin/welcome-monitor"
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Monitor className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <div className="font-medium text-sm">Welcome Monitor</div>
            </Link>
            <Link
              to="/admin/voting-monitor"
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <div className="font-medium text-sm">Voting Monitor</div>
            </Link>
            <Link
              to="/admin/progress"
              className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Activity className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="font-medium text-sm">Analytics</div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}