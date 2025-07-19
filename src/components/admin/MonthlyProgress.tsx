import { useState, useEffect } from 'react'
import { TrendingUp, Calendar, Users, Building2, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface MonthlyData {
  month: string
  events: number
  attendees: number
  checkedIn: number
  companies: number
}

interface CompanyProgress {
  id: string
  name: string
  events: number
  attendees: number
  checkedIn: number
}

export default function MonthlyProgress() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [companyProgress, setCompanyProgress] = useState<CompanyProgress[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMonthlyProgress()
    fetchCompanyProgress()
  }, [selectedYear])

  const fetchMonthlyProgress = async () => {
    try {
      setLoading(true)
      
      // Get events for the selected year
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          created_at,
          company_id
        `)
        .gte('created_at', `${selectedYear}-01-01`)
        .lt('created_at', `${selectedYear + 1}-01-01`)

      if (eventsError) throw eventsError

      // Get attendees for these events
      const eventIds = events?.map(e => e.id) || []
      const { data: attendees, error: attendeesError } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in, created_at')
        .in('event_id', eventIds)

      if (attendeesError) throw attendeesError

      // Get companies created this year
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, created_at')
        .gte('created_at', `${selectedYear}-01-01`)
        .lt('created_at', `${selectedYear + 1}-01-01`)

      if (companiesError) throw companiesError

      // Process data by month
      const monthlyStats: MonthlyData[] = []
      
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(selectedYear, month, 1)
        const monthEnd = new Date(selectedYear, month + 1, 0)
        
        const monthEvents = events?.filter(e => {
          const eventDate = new Date(e.created_at)
          return eventDate >= monthStart && eventDate <= monthEnd
        }) || []

        const monthAttendees = attendees?.filter(a => {
          const attendeeDate = new Date(a.created_at)
          return attendeeDate >= monthStart && attendeeDate <= monthEnd
        }) || []

        const monthCompanies = companies?.filter(c => {
          const companyDate = new Date(c.created_at)
          return companyDate >= monthStart && companyDate <= monthEnd
        }) || []

        monthlyStats.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          events: monthEvents.length,
          attendees: monthAttendees.length,
          checkedIn: monthAttendees.filter(a => a.checked_in).length,
          companies: monthCompanies.length
        })
      }

      setMonthlyData(monthlyStats)
    } catch (error: any) {
      toast.error('Error fetching monthly progress: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyProgress = async () => {
    try {
      const { data: companies, error } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          events!inner(
            id,
            attendees(id, checked_in)
          )
        `)

      if (error) throw error

      const companyStats = companies?.map(company => {
        const events = company.events || []
        const allAttendees = events.flatMap(e => e.attendees || [])
        
        return {
          id: company.id,
          name: company.name,
          events: events.length,
          attendees: allAttendees.length,
          checkedIn: allAttendees.filter(a => a.checked_in).length
        }
      }) || []

      setCompanyProgress(companyStats.sort((a, b) => b.attendees - a.attendees))
    } catch (error: any) {
      console.error('Error fetching company progress:', error)
    }
  }

  const totalEvents = monthlyData.reduce((sum, month) => sum + month.events, 0)
  const totalAttendees = monthlyData.reduce((sum, month) => sum + month.attendees, 0)
  const totalCheckedIn = monthlyData.reduce((sum, month) => sum + month.checkedIn, 0)
  const totalCompanies = monthlyData.reduce((sum, month) => sum + month.companies, 0)

  const maxValue = Math.max(...monthlyData.map(m => Math.max(m.events, m.attendees / 10, m.checkedIn / 10)))

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monthly Progress</h1>
          <p className="text-gray-600 mt-2">Track monthly performance and growth</p>
        </div>
        <div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalEvents}</div>
              <div className="text-sm text-gray-600">Total Events</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalAttendees}</div>
              <div className="text-sm text-gray-600">Total Attendees</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalCheckedIn}</div>
              <div className="text-sm text-gray-600">Checked In</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalCompanies}</div>
              <div className="text-sm text-gray-600">New Companies</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2" />
            Monthly Trends ({selectedYear})
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {monthlyData.map((month, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{month.month}</span>
                    <span className="text-gray-600">
                      {month.events} events • {month.attendees} attendees
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    {/* Events Bar */}
                    <div className="flex items-center">
                      <div className="w-16 text-xs text-gray-600">Events</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxValue > 0 ? (month.events / maxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-xs text-right">{month.events}</div>
                    </div>
                    
                    {/* Attendees Bar */}
                    <div className="flex items-center">
                      <div className="w-16 text-xs text-gray-600">Attendees</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxValue > 0 ? ((month.attendees / 10) / maxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-xs text-right">{month.attendees}</div>
                    </div>
                    
                    {/* Check-ins Bar */}
                    <div className="flex items-center">
                      <div className="w-16 text-xs text-gray-600">Check-ins</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${maxValue > 0 ? ((month.checkedIn / 10) / maxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className="w-8 text-xs text-right">{month.checkedIn}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Company Performance */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Building2 className="h-6 w-6 mr-2" />
            Company Performance
          </h2>
          
          <div className="space-y-4">
            {companyProgress.slice(0, 10).map((company, index) => (
              <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{company.name}</div>
                    <div className="text-sm text-gray-600">
                      {company.events} events • {company.attendees} attendees
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{company.checkedIn}</div>
                  <div className="text-xs text-gray-600">checked in</div>
                </div>
              </div>
            ))}
            
            {companyProgress.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No company data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}