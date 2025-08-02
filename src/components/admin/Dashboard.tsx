import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  Eye,
  Sparkles,
  Star,
  Zap,
  Target,
  Award,
  Rocket,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useGlobalModeStore, HybridMode } from '../../lib/globalModeStore';
import { useSyncStatusStore, SyncStatus } from '../../lib/hybridDB';

interface DashboardProps {
  userCompany?: any
}

interface Event {
  id: string
  name: string
  date: string | null
  company: { 
    id: string
    name: string 
  }
  attendee_count: number
  checked_in_count: number
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
    gradient: string
  }>
  monthlyData: Array<{
    month: string
    events: number
    attendees: number
    checkedIn: number
  }>
}

interface Event {
  id: string
  name: string
  date: string | null
  company: { 
    id: string
    name: string 
  }
  attendee_count: number
  checked_in_count: number
}

export default function Dashboard({ userCompany }: DashboardProps) {
  const navigate = useNavigate()
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<AdminStats['searchResults'] | null>(null)
  const [searching, setSearching] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const { mode, setMode } = useGlobalModeStore();
  const { status: syncStatus, lastSync } = useSyncStatusStore();

  // Memoized computed values
  const isAdmin = useMemo(() => !userCompany, [userCompany])
  const hasSearchResults = useMemo(() => searchResults && (
    searchResults.companies.length > 0 || 
    searchResults.users.length > 0 || 
    searchResults.events.length > 0
  ), [searchResults])

  useEffect(() => {
    const initializeDashboard = async () => {
      if (userCompany) {
        await fetchCompanyStats()
      } else {
        await fetchAdminStats()
      }
      await fetchEvents()
    }
    
    initializeDashboard()
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

  // Handle clicking outside search results to clear them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const searchContainer = document.querySelector('[data-search-container]')
      if (searchContainer && !searchContainer.contains(event.target as Node)) {
        setSearchResults(null)
        setSearchTerm('')
      }
    }

    if (searchResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchResults])

  const performSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null)
      return
    }

    setSearching(true)
    try {
      const searchPattern = `%${searchTerm.toLowerCase()}%`

      // Parallel search for better performance
      const [companiesResult, usersResult, eventsResult] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, created_at')
          .ilike('name', searchPattern)
          .limit(5),
        supabase
          .from('company_users')
          .select(`
            id,
            email,
            company:companies(name)
          `)
          .ilike('email', searchPattern)
          .limit(5),
        supabase
          .from('events')
          .select(`
            id,
            name,
            date,
            company:companies(name)
          `)
          .ilike('name', searchPattern)
          .limit(5)
      ])

      setSearchResults({
        companies: companiesResult.data || [],
        users: (usersResult.data || []).map(user => ({
          ...user,
          company: Array.isArray(user.company) ? user.company[0] : user.company
        })),
        events: (eventsResult.data || []).map(event => ({
          ...event,
          company: Array.isArray(event.company) ? event.company[0] : event.company
        }))
      })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }, [searchTerm])

  const handleSearchResultClick = useCallback((type: 'company' | 'user' | 'event', id?: string) => {
    // Clear search results when navigating
    setSearchResults(null)
    setSearchTerm('')
    
    // Navigate based on type
    const routes = {
      company: '/admin/companies',
      user: '/admin/companies',
      event: id ? `/admin/events/${id}` : '/admin/events'
    }
    
    navigate(routes[type])
  }, [navigate])

  const fetchEvents = async () => {
    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          company:companies(id, name),
          attendees(id, checked_in)
        `)
        .order('date', { ascending: true })

      // Filter by company if user is a company user
      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query
      if (error) throw error

      const eventsWithCounts = data?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company,
        attendee_count: event.attendees?.length || 0,
        checked_in_count: event.attendees?.filter((a: any) => a.checked_in).length || 0
      })) || []

      setEvents(eventsWithCounts)
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  // Utility to generate a color from a string
  const stringToColor = useCallback((str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `#${((hash >> 24) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 16) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 8) & 0xFF).toString(16).padStart(2, '0')}`;
    return color;
  }, [])

  const getDaysInMonth = useCallback((date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }, [])

  const getFirstDayOfMonth = useCallback((date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }, [])

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(event => {
      if (!event.date) return false
      // Handle both date-only and datetime formats
      const eventDate = event.date.split('T')[0]
      return eventDate === dateStr
    })
  }, [events])

  const renderCalendar = useCallback(() => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-1 text-gray-300"></div>)
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const dayEvents = getEventsForDate(date)
      const isToday = date.toDateString() === new Date().toDateString()

      days.push(
        <div 
          key={day} 
          className={`p-1 min-h-[60px] border border-gray-200 ${
            isToday ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-medium mb-1">{day}</div>
          <div className="space-y-0.5">
            {dayEvents.length === 0 ? (
              <div className="text-xs text-gray-400 text-center">No events</div>
            ) : (
              <>
                {dayEvents.slice(0, 1).map((event) => {
                 const companyColor = stringToColor(event.company?.id || event.id || 'default')
                  return (
                    <Link
                      key={event.id}
                      to={`/admin/events/${event.id}`}
                      className="block text-xs p-1 rounded hover:shadow-sm transition-all cursor-pointer text-white font-medium"
                      style={{ backgroundColor: companyColor }}
                      title={`${event.name} - ${event.checked_in_count}/${event.attendee_count} checked in`}
                    >
                      <div className="truncate text-xs" title={event.name}>
                        {event.name}
                      </div>
                      <div className="text-white/80 text-xs">
                        {event.checked_in_count}/{event.attendee_count}
                      </div>
                    </Link>
                  )
                })}
                {dayEvents.length > 1 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{dayEvents.length - 1} more
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )
    }

    return days
  }, [currentDate, getDaysInMonth, getFirstDayOfMonth, getEventsForDate, stringToColor])

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
          color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
          gradient: 'from-blue-500 to-cyan-500'
        },
        {
          name: 'Manage Attendees',
          path: '/admin/attendees',
          icon: Users,
          description: 'View and manage registrations',
          color: 'bg-gradient-to-br from-green-500 to-emerald-500',
          gradient: 'from-green-500 to-emerald-500'
        },
        {
          name: 'Seating Arrangement',
          path: '/admin/seating',
          icon: MapPin,
          description: 'Arrange tables and seats',
          color: 'bg-gradient-to-br from-orange-500 to-red-500',
          gradient: 'from-orange-500 to-red-500'
        },
        {
          name: 'Check-in System',
          path: '/admin/checkin',
          icon: QrCode,
          description: 'Scan QR codes for check-in',
          color: 'bg-gradient-to-br from-purple-500 to-indigo-500',
          gradient: 'from-purple-500 to-indigo-500'
        },
        
        {
          name: 'Event Gallery',
          path: '/admin/gallery',
          icon: Image,
          description: 'Manage photo uploads',
          color: 'bg-gradient-to-br from-pink-500 to-rose-500',
          gradient: 'from-pink-500 to-rose-500'
        },
        {
          name: 'Voting System',
          path: '/admin/voting',
          icon: Vote,
          description: 'Create voting sessions',
          color: 'bg-gradient-to-br from-violet-500 to-purple-500',
          gradient: 'from-violet-500 to-purple-500'
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

  // Memoized loading component
  const LoadingSpinner = useMemo(() => (
    <div className="flex items-center justify-center h-64">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-purple-600 animate-pulse" />
      </div>
    </div>
  ), [])

  if (loading) {
    return LoadingSpinner
  }

  // Admin Dashboard
  if (!userCompany && adminStats) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 text-lg">System-wide analytics and management overview</p>
        </div>

        {/* Hybrid Mode Toggle */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="admin-hybrid-mode-select" style={{ fontWeight: 'bold', marginRight: 8 }}>Data Mode:</label>
          <select
            id="admin-hybrid-mode-select"
            value={mode}
            onChange={e => setMode(e.target.value as HybridMode)}
            style={{ padding: 4, borderRadius: 4 }}
          >
            <option value="online">Online (Supabase)</option>
            <option value="offline">Offline (Local Only)</option>
            <option value="hybrid">Hybrid (Sync)</option>
          </select>
        </div>
        {/* Sync/DB Status UI */}
        <div className="flex items-center space-x-4 mb-4">
          <div className={`flex items-center px-3 py-1 rounded-full text-white font-semibold text-xs ${syncStatus === 'idle' ? 'bg-gray-400' : syncStatus === 'syncing' ? 'bg-blue-500' : syncStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
               title={`Sync status: ${syncStatus}`}>
            Sync: {syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)}
          </div>
          <div className={`flex items-center px-3 py-1 rounded-full text-white font-semibold text-xs ${mode === 'online' ? 'bg-blue-500' : mode === 'offline' ? 'bg-yellow-500' : 'bg-green-500'}`}
               title={`Database mode: ${mode}`}>
            DB: {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </div>
          {lastSync && (
            <div className="text-xs text-gray-500">Last Sync: {new Date(lastSync).toLocaleString()}</div>
          )}
        </div>

        {/* Search Bar */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6" data-search-container>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-12 pr-12 py-4 border-0 rounded-xl bg-gray-50/50 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all duration-300 text-lg"
              placeholder="Search companies, users, or events..."
            />
            {searching && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {hasSearchResults && searchResults && (
            <div className="mt-6 space-y-6">
              {searchResults.companies.length > 0 && (
                <div className="animate-fade-in">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Building2 className="h-5 w-5 text-blue-500 mr-2" />
                    Companies
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.companies.map(company => (
                      <div 
                        key={company.id} 
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => handleSearchResultClick('company')}
                        title="Click to view company details"
                      >
                        <div className="flex items-center">
                          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg mr-3">
                            <Building2 className="h-4 w-4 text-white" />
                          </div>
                          <span className="font-medium text-gray-900">{company.name}</span>
                        </div>
                        <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">
                          {new Date(company.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.users.length > 0 && (
                <div className="animate-fade-in">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Users className="h-5 w-5 text-green-500 mr-2" />
                    Users
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.users.map(user => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => handleSearchResultClick('user')}
                        title="Click to view user details"
                      >
                        <div className="flex items-center">
                          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg mr-3">
                            <Users className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 block">{user.email}</span>
                            <span className="text-sm text-gray-500">{user.company?.name || 'Unknown Company'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.events.length > 0 && (
                <div className="animate-fade-in">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Calendar className="h-5 w-5 text-purple-500 mr-2" />
                    Events
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.events.map(event => (
                      <div 
                        key={event.id} 
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                        onClick={() => handleSearchResultClick('event', event.id)}
                        title="Click to view event details"
                      >
                        <div className="flex items-center">
                          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mr-3">
                            <Calendar className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 block">{event.name}</span>
                            <span className="text-sm text-gray-500">{event.company?.name || 'Unknown Company'}</span>
                          </div>
                        </div>
                        {event.date && (
                          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-blue-600 rounded-lg mr-4">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {adminStats.totalCompanies}
                </div>
                <div className="text-sm text-gray-600 font-medium">Companies</div>
                {adminStats.monthlyGrowth.companies > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.companies} this month
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-green-600 rounded-lg mr-4">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {adminStats.totalEvents}
                </div>
                <div className="text-sm text-gray-600 font-medium">Events</div>
                {adminStats.monthlyGrowth.events > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.events} this month
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-purple-600 rounded-lg mr-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {adminStats.totalAttendees}
                </div>
                <div className="text-sm text-gray-600 font-medium">Attendees</div>
                {adminStats.monthlyGrowth.attendees > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.attendees} this month
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-orange-600 rounded-lg mr-4">
                <UserCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {adminStats.totalCheckedIn}
                </div>
                <div className="text-sm text-gray-600 font-medium">Check-ins</div>
                <div className="text-xs text-gray-500 mt-1">
                  {adminStats.totalAttendees > 0 
                    ? `${Math.round((adminStats.totalCheckedIn / adminStats.totalAttendees) * 100)}% rate`
                    : '0% rate'
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-indigo-600 rounded-lg mr-4">
                <Eye className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {adminStats.totalUsers}
                </div>
                <div className="text-sm text-gray-600 font-medium">Users</div>
                {adminStats.monthlyGrowth.users > 0 && (
                  <div className="text-xs text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{adminStats.monthlyGrowth.users} this month
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>



        {/* Admin Management and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg mr-3">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              System Management
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <Link
                to="/admin/companies"
                className="group p-6 border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 transition-all duration-300 card-hover"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg mr-4 group-hover:scale-110 transition-transform duration-300">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">Companies</div>
                    <div className="text-sm text-gray-600">Manage organizations</div>
                  </div>
                </div>
              </Link>
              <Link
                to="/admin/progress"
                className="group p-6 border-2 border-gray-100 rounded-xl hover:border-green-300 hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 transition-all duration-300 card-hover"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg mr-4 group-hover:scale-110 transition-transform duration-300">
                    <Activity className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">Analytics</div>
                    <div className="text-sm text-gray-600">Monthly progress</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                Recent Events
              </h2>
              <Link 
                to="/admin/events" 
                className="text-purple-600 hover:text-purple-700 flex items-center text-sm font-medium bg-purple-50 px-3 py-2 rounded-lg hover:bg-purple-100 transition-all duration-300"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-3">
              {adminStats.recentEvents.map((event, index) => (
                <div key={event.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300 animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div>
                    <div className="font-medium text-gray-900">{event.name}</div>
                    <div className="text-sm text-gray-600">{event.company?.name || 'Unknown Company'}</div>
                    {event.date && (
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full mt-1 inline-block">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{event.checked_in_count}/{event.attendee_count}</div>
                    <div className="text-xs text-gray-500">checked in</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${event.attendee_count > 0 ? (event.checked_in_count / event.attendee_count) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              {adminStats.recentEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No recent events</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                Recent Users
              </h2>
              <Link 
                to="/admin/companies" 
                className="text-indigo-600 hover:text-indigo-700 flex items-center text-sm font-medium bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-all duration-300"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-3">
              {adminStats.recentUsers.map((user, index) => (
                <div key={user.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300 animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div>
                    <div className="font-medium text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-600">{user.company?.name || 'Unknown Company'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    {user.last_sign_in_at && (
                      <div className="text-xs text-green-600 flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        Active
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {adminStats.recentUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No recent users</p>
                </div>
              )}
            </div>
          </div>

          {/* Compact Calendar Section */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg mr-3">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                Event Calendar
              </h2>
              <div className="text-xs text-gray-500">
                {events.length} events
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold">
                  {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <div key={`${day}-${index}`} className="p-1 text-center text-xs font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-0.5">
              {renderCalendar()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Company User Dashboard
  if (userCompany && companyStats) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg">
              <Star className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Welcome Back!
          </h1>
          <p className="text-gray-600 text-lg">
            <span className="font-semibold text-indigo-600">{userCompany?.company?.name || 'Company'}</span> Dashboard
          </p>
        </div>

        {/* Company Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-blue-600 rounded-lg mr-4">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.totalEvents}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Events</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-green-600 rounded-lg mr-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.totalAttendees}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Attendees</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-purple-600 rounded-lg mr-4">
                <UserCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.totalCheckedIn}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Check-ins</div>
                <div className="text-xs text-gray-500 mt-1">
                  {companyStats.totalAttendees > 0 
                    ? `${Math.round((companyStats.totalCheckedIn / companyStats.totalAttendees) * 100)}% rate`
                    : '0% rate'
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-orange-600 rounded-lg mr-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.upcomingEvents}
                </div>
                <div className="text-sm text-gray-600 font-medium">Upcoming Events</div>
              </div>
            </div>
          </div>
        </div>

        

        {/* Quick Actions and Recent Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg mr-3">
                <Zap className="h-6 w-6 text-white" />
              </div>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyStats.quickActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.name}
                    to={action.path}
                    className="group p-6 border-2 border-gray-100 rounded-xl hover:border-transparent hover:shadow-xl transition-all duration-300 card-hover animate-scale-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className={`w-12 h-12 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="font-semibold text-gray-900 text-lg mb-1">{action.name}</div>
                    <div className="text-sm text-gray-600">{action.description}</div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold flex items-center">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                Recent Events
              </h2>
              <Link 
                to="/admin/events" 
                className="text-green-600 hover:text-green-700 flex items-center text-sm font-medium bg-green-50 px-3 py-2 rounded-lg hover:bg-green-100 transition-all duration-300"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-4">
              {companyStats.recentEvents.map((event, index) => (
                <div key={event.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300 animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">{event.name}</div>
                    {event.date && (
                      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full mt-1 inline-block">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{event.checked_in_count}/{event.attendee_count}</div>
                    <div className="text-xs text-gray-500">attendees</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${event.attendee_count > 0 ? (event.checked_in_count / event.attendee_count) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              {companyStats.recentEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No events yet</p>
                  <Link 
                    to="/admin/events" 
                    className="text-green-600 hover:text-green-700 text-sm font-medium bg-green-50 px-4 py-2 rounded-lg hover:bg-green-100 transition-all duration-300 inline-block mt-2"
                  >
                    Create your first event
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Tools */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg mr-3">
              <Target className="h-6 w-6 text-white" />
            </div>
            Event Tools & Monitors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/admin/lucky-draw"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-yellow-300 hover:bg-gradient-to-br hover:from-yellow-50 hover:to-orange-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <Gift className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Lucky Draw</div>
              <div className="text-sm text-gray-600 mt-1">Random winner selection</div>
            </Link>
            <Link
              to="/admin/welcome-monitor"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <Monitor className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Welcome Monitor</div>
              <div className="text-sm text-gray-600 mt-1">Live check-in display</div>
            </Link>
            <Link
              to="/admin/voting-monitor"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-purple-300 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Voting Monitor</div>
              <div className="text-sm text-gray-600 mt-1">Live voting results</div>
            </Link>
            <Link
              to="/admin/progress"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-green-300 hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Analytics</div>
              <div className="text-sm text-gray-600 mt-1">Performance insights</div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Company User Dashboard
  if (userCompany && companyStats) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg">
              <Star className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Welcome Back!
          </h1>
          <p className="text-gray-600 text-lg">
            <span className="font-semibold text-indigo-600">{userCompany?.company?.name || 'Company'}</span> Dashboard
          </p>
        </div>

        {/* Company Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-blue-600 rounded-lg mr-4">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.totalEvents}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Events</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-green-600 rounded-lg mr-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.totalAttendees}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Attendees</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-purple-600 rounded-lg mr-4">
                <UserCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.totalCheckedIn}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Check-ins</div>
                <div className="text-xs text-gray-500 mt-1">
                  {companyStats.totalAttendees > 0 
                    ? `${Math.round((companyStats.totalCheckedIn / companyStats.totalAttendees) * 100)}% rate`
                    : '0% rate'
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border p-6 card-hover">
            <div className="flex items-center">
              <div className="p-3 bg-orange-600 rounded-lg mr-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {companyStats.upcomingEvents}
                </div>
                <div className="text-sm text-gray-600 font-medium">Upcoming Events</div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Calendar Section for Company Users */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg mr-3">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              Event Calendar
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-base font-semibold">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>
        </div>

        {/* Quick Actions and Recent Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg mr-3">
                <Zap className="h-6 w-6 text-white" />
              </div>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyStats.quickActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.name}
                    to={action.path}
                    className="group p-6 border-2 border-gray-100 rounded-xl hover:border-transparent hover:shadow-xl transition-all duration-300 card-hover animate-scale-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className={`w-12 h-12 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="font-semibold text-gray-900 text-lg mb-1">{action.name}</div>
                    <div className="text-sm text-gray-600">{action.description}</div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold flex items-center">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                Recent Events
              </h2>
              <Link 
                to="/admin/events" 
                className="text-green-600 hover:text-green-700 flex items-center text-sm font-medium bg-green-50 px-3 py-2 rounded-lg hover:bg-green-100 transition-all duration-300"
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <div className="space-y-4">
              {companyStats.recentEvents.map((event, index) => (
                <div key={event.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-300 animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div>
                    <div className="font-semibold text-gray-900 text-lg">{event.name}</div>
                    {event.date && (
                      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full mt-1 inline-block">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{event.checked_in_count}/{event.attendee_count}</div>
                    <div className="text-xs text-gray-500">attendees</div>
                    <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${event.attendee_count > 0 ? (event.checked_in_count / event.attendee_count) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              {companyStats.recentEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No events yet</p>
                  <Link 
                    to="/admin/events" 
                    className="text-green-600 hover:text-green-700 text-sm font-medium bg-green-50 px-4 py-2 rounded-lg hover:bg-green-100 transition-all duration-300 inline-block mt-2"
                  >
                    Create your first event
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Tools */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg mr-3">
              <Target className="h-6 w-6 text-white" />
            </div>
            Event Tools & Monitors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/admin/lucky-draw"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-yellow-300 hover:bg-gradient-to-br hover:from-yellow-50 hover:to-orange-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <Gift className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Lucky Draw</div>
              <div className="text-sm text-gray-600 mt-1">Random winner selection</div>
            </Link>
            <Link
              to="/admin/welcome-monitor"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <Monitor className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Welcome Monitor</div>
              <div className="text-sm text-gray-600 mt-1">Live check-in display</div>
            </Link>
            <Link
              to="/admin/voting-monitor"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-purple-300 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Voting Monitor</div>
              <div className="text-sm text-gray-600 mt-1">Live voting results</div>
            </Link>
            <Link
              to="/admin/progress"
              className="group p-6 text-center border-2 border-gray-100 rounded-xl hover:border-green-300 hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 transition-all duration-300 card-hover"
            >
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg mx-auto mb-3 w-fit group-hover:scale-110 transition-transform duration-300">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div className="font-semibold text-gray-900">Analytics</div>
              <div className="text-sm text-gray-600 mt-1">Performance insights</div>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}