/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { TrendingUp, Calendar, Users, Building2, BarChart3, Download, FileText } from 'lucide-react'
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

interface Event {
  id: string
  name: string
  date: string
  attendees: number
  checkedIn: number
}

export default function MonthlyProgress() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [companyProgress, setCompanyProgress] = useState<CompanyProgress[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [exportType, setExportType] = useState<'monthly' | 'annual' | 'event'>('monthly')
  const [selectedEvent, setSelectedEvent] = useState<string>('')
  const [includeAttendees, setIncludeAttendees] = useState<boolean>(true)

  useEffect(() => {
    fetchMonthlyProgress()
    fetchCompanyProgress()
    fetchEvents()
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

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          attendees(id, checked_in)
        `)
        .order('date', { ascending: false })

      if (error) throw error

      const eventStats = data?.map(event => ({
        id: event.id,
        name: event.name,
        date: event.date,
        attendees: event.attendees?.length || 0,
        checkedIn: event.attendees?.filter(a => a.checked_in).length || 0
      })) || []

      setEvents(eventStats)
    } catch (error: any) {
      console.error('Error fetching events:', error)
    }
  }

  const totalEvents = monthlyData.reduce((sum, month) => sum + month.events, 0)
  const totalAttendees = monthlyData.reduce((sum, month) => sum + month.attendees, 0)
  const totalCheckedIn = monthlyData.reduce((sum, month) => sum + month.checkedIn, 0)
  const totalCompanies = monthlyData.reduce((sum, month) => sum + month.companies, 0)

  const maxValue = Math.max(...monthlyData.map(m => Math.max(m.events, m.attendees, m.checkedIn)))

  // Chart dimensions
  const chartWidth = 600
  const chartHeight = 300
  const padding = 40

  const generateChartPath = (data: number[], color: string) => {
    if (data.length === 0) return ''
    
    const points = data.map((value, index) => {
      const x = padding + (index * (chartWidth - 2 * padding)) / (data.length - 1)
      const y = chartHeight - padding - ((value / maxValue) * (chartHeight - 2 * padding))
      return `${x},${y}`
    }).join(' ')
    
    return `M ${points}`
  }

  const exportReport = async () => {
    try {
      let csvContent = ''
      let fileName = ''

      switch (exportType) {
        case 'monthly':
          // CSV header
          csvContent = 'Month,Events,Attendees,Checked In,New Companies\n'
          
          // Add monthly data
          monthlyData.forEach(month => {
            csvContent += `${month.month},${month.events},${month.attendees},${month.checkedIn},${month.companies}\n`
          })
          
          // Add summary row
          csvContent += `\nSUMMARY\n`
          csvContent += `Total Events,${totalEvents}\n`
          csvContent += `Total Attendees,${totalAttendees}\n`
          csvContent += `Total Checked In,${totalCheckedIn}\n`
          csvContent += `Total New Companies,${totalCompanies}\n`
          
          fileName = `monthly-report-${selectedYear}.csv`
          break

        case 'annual':
          // CSV header for annual report
          csvContent = 'Report Type,Annual Report\n'
          csvContent += `Year,${selectedYear}\n\n`
          
          // Summary section
          csvContent += 'SUMMARY\n'
          csvContent += 'Metric,Value\n'
          csvContent += `Total Events,${totalEvents}\n`
          csvContent += `Total Attendees,${totalAttendees}\n`
          csvContent += `Total Checked In,${totalCheckedIn}\n`
          csvContent += `Total New Companies,${totalCompanies}\n\n`
          
          // Monthly breakdown
          csvContent += 'MONTHLY BREAKDOWN\n'
          csvContent += 'Month,Events,Attendees,Checked In,New Companies\n'
          monthlyData.forEach(month => {
            csvContent += `${month.month},${month.events},${month.attendees},${month.checkedIn},${month.companies}\n`
          })
          
          // Company performance
          csvContent += '\nCOMPANY PERFORMANCE\n'
          csvContent += 'Rank,Company Name,Events,Attendees,Checked In\n'
          companyProgress.forEach((company, index) => {
            csvContent += `${index + 1},${company.name},${company.events},${company.attendees},${company.checkedIn}\n`
          })
          
          fileName = `annual-report-${selectedYear}.csv`
          break

        case 'event':
          if (!selectedEvent) {
            toast.error('Please select an event')
            return
          }
          
          // Fetch detailed event data
          const { data: eventDetails, error: eventError } = await supabase
            .from('events')
            .select(`
              id,
              name,
              date,
              description,
              location,
              attendees(
                id,
                name,
                email,
                phone,
                checked_in,
                created_at
              )
            `)
            .eq('id', selectedEvent)
            .single()

          if (eventError) {
            toast.error('Error fetching event details')
            return
          }

          // CSV header for event report
          csvContent = 'EVENT DETAILS\n'
          csvContent += 'Field,Value\n'
          csvContent += `Event Name,${eventDetails.name}\n`
          csvContent += `Event Date,${eventDetails.date}\n`
          csvContent += `Location,${eventDetails.location || 'N/A'}\n`
          csvContent += `Description,${eventDetails.description || 'N/A'}\n`
          csvContent += `Total Attendees,${eventDetails.attendees?.length || 0}\n`
          csvContent += `Checked In,${eventDetails.attendees?.filter(a => a.checked_in).length || 0}\n`
          
          // Include attendee details if option is enabled
          if (includeAttendees && eventDetails.attendees && eventDetails.attendees.length > 0) {
            csvContent += '\nATTENDEE DETAILS\n'
            csvContent += 'Name,Email,Phone,Checked In,Registration Date\n'
            eventDetails.attendees.forEach(attendee => {
              const checkedIn = attendee.checked_in ? 'Yes' : 'No'
              const registrationDate = new Date(attendee.created_at).toLocaleDateString()
              csvContent += `${attendee.name || 'N/A'},${attendee.email || 'N/A'},${attendee.phone || 'N/A'},${checkedIn},${registrationDate}\n`
            })
          }
          
          fileName = `event-report-${eventDetails.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
          break
      }

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('CSV report exported successfully!')
    } catch (error: any) {
      toast.error('Error exporting report: ' + error.message)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monthly Progress</h1>
          <p className="text-gray-600 mt-2">Track monthly performance and growth</p>
        </div>
        <div className="flex gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as 'monthly' | 'annual' | 'event')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly Report</option>
              <option value="annual">Annual Report</option>
              <option value="event">Event Report</option>
            </select>
            
            {exportType === 'event' && (
              <>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeAttendees"
                    checked={includeAttendees}
                    onChange={(e) => setIncludeAttendees(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="includeAttendees" className="text-sm text-gray-700">
                    Include Attendees
                  </label>
                </div>
              </>
            )}
            
            <button
              onClick={exportReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
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
            <div className="relative">
              <svg width={chartWidth} height={chartHeight} className="mx-auto">
                {/* Grid lines */}
                {Array.from({ length: 5 }, (_, i) => (
                  <line
                    key={i}
                    x1={padding}
                    y1={padding + (i * (chartHeight - 2 * padding)) / 4}
                    x2={chartWidth - padding}
                    y2={padding + (i * (chartHeight - 2 * padding)) / 4}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}
                
                {/* Y-axis labels */}
                {Array.from({ length: 5 }, (_, i) => (
                  <text
                    key={i}
                    x={padding - 10}
                    y={padding + (i * (chartHeight - 2 * padding)) / 4}
                    textAnchor="end"
                    className="text-xs text-gray-500"
                    dy="0.35em"
                  >
                    {Math.round((maxValue * (4 - i)) / 4)}
                  </text>
                ))}
                
                {/* X-axis labels */}
                {monthlyData.map((month, index) => (
                  <text
                    key={index}
                    x={padding + (index * (chartWidth - 2 * padding)) / (monthlyData.length - 1)}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-xs text-gray-500"
                  >
                    {month.month}
                  </text>
                ))}
                
                {/* Chart lines */}
                <path
                  d={generateChartPath(monthlyData.map(m => m.events), '#3b82f6')}
                  stroke="#3b82f6"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d={generateChartPath(monthlyData.map(m => m.attendees), '#10b981')}
                  stroke="#10b981"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d={generateChartPath(monthlyData.map(m => m.checkedIn), '#8b5cf6')}
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  fill="none"
                />
                
                {/* Data points */}
                {monthlyData.map((month, index) => {
                  const x = padding + (index * (chartWidth - 2 * padding)) / (monthlyData.length - 1)
                  return (
                    <g key={index}>
                      <circle
                        cx={x}
                        cy={chartHeight - padding - ((month.events / maxValue) * (chartHeight - 2 * padding))}
                        r="3"
                        fill="#3b82f6"
                      />
                      <circle
                        cx={x}
                        cy={chartHeight - padding - ((month.attendees / maxValue) * (chartHeight - 2 * padding))}
                        r="3"
                        fill="#10b981"
                      />
                      <circle
                        cx={x}
                        cy={chartHeight - padding - ((month.checkedIn / maxValue) * (chartHeight - 2 * padding))}
                        r="3"
                        fill="#8b5cf6"
                      />
                    </g>
                  )
                })}
              </svg>
              
              {/* Legend */}
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span>Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <span>Attendees</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                  <span>Check-ins</span>
                </div>
              </div>
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