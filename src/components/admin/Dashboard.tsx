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
  Activity
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
  recentEvents: Array<{
    id: string
    name: string
    company: { name: string }
    attendee_count: number
    checked_in_count: number
    created_at: string
  }>
  monthlyGrowth: {
    companies: number
    events: number
    attendees: number
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
}

export default function Dashboard({ userCompany }: DashboardProps) {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userCompany) {
      fetchCompanyStats()
    } else {
      fetchAdminStats()
    }
  }, [userCompany])

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
          created_at,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      // Fetch attendees
      const { data: attendees } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in, created_at')

      // Calculate stats
      const totalCompanies = companies?.length || 0
      const totalEvents = events?.length || 0
      const totalAttendees = attendees?.length || 0
      const totalCheckedIn = attendees?.filter(a => a.checked_in).length || 0

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

      // Calculate monthly growth (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const monthlyGrowth = {
        companies: companies?.filter(c => new Date(c.created_at) > thirtyDaysAgo).length || 0,
        events: events?.filter(e => new Date(e.created_at) > thirtyDaysAgo).length || 0,
        attendees: attendees?.filter(a => new Date(a.created_at) > thirtyDaysAgo).length || 0
      }

      setAdminStats({
        totalCompanies,
        totalEvents,
        totalAttendees,
        totalCheckedIn,
        recentEvents: recentEventsWithCounts,
        monthlyGrowth
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
        .select('id, event_id, checked_in')
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
        quickActions
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

        {/* Admin Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{adminStats.totalCompanies}</div>
                <div className="text-sm text-gray-600">Total Companies</div>
                {adminStats.monthlyGrowth.companies > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.companies} this month
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
                <div className="text-sm text-gray-600">Total Events</div>
                {adminStats.monthlyGrowth.events > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.events} this month
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
                <div className="text-sm text-gray-600">Total Attendees</div>
                {adminStats.monthlyGrowth.attendees > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.attendees} this month
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
                <div className="text-sm text-gray-600">Total Check-ins</div>
                <div className="text-xs text-gray-500 mt-1">
                  {adminStats.totalAttendees > 0 
                    ? `${Math.round((adminStats.totalCheckedIn / adminStats.totalAttendees) * 100)}% rate`
                    : '0% rate'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Management Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <BarChart3 className="h-6 w-6 mr-2" />
              System Management
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/admin"
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
            <h2 className="text-xl font-semibold mb-4">Recent Events</h2>
            <div className="space-y-3">
              {adminStats.recentEvents.map((event) => (
                <div key={event.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{event.name}</div>
                    <div className="text-sm text-gray-600">{event.company.name}</div>
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

        {/* Quick Actions */}
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