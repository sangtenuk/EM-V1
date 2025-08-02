/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { TrendingUp, Calendar, Users, Building2, BarChart3, Download, FileText, Trophy, Award, Star, PieChart, BarChart } from 'lucide-react'
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

interface Winner {
  id: string
  name: string
  type: 'lucky_draw' | 'voting' | 'table'
  prize?: string
  position?: number
  company?: string
  table_number?: number
}

interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor: string[]
    borderColor?: string[]
    borderWidth?: number
  }>
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
  const [includeWinners, setIncludeWinners] = useState<boolean>(true)
  const [includeCharts, setIncludeCharts] = useState<boolean>(true)

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
        checkedIn: event.attendees?.filter((a: any) => a.checked_in).length || 0
      })) || []

      setEvents(eventStats)
    } catch (error: any) {
      console.error('Error fetching events:', error)
    }
  }



  const fetchEventWinners = async (eventId: string): Promise<Winner[]> => {
    try {
      const winners: Winner[] = []

      // Fetch lucky draw winners from the lucky_draw_winners table
      const { data: luckyDrawWinners, error: luckyDrawError } = await supabase
        .from('lucky_draw_winners')
        .select('*')
        .eq('event_id', eventId)
        .order('prize_position', { ascending: false })

      if (!luckyDrawError && luckyDrawWinners) {
        luckyDrawWinners.forEach(winner => {
          winners.push({
            id: winner.id,
            name: winner.winner_name || 'Unknown Winner',
            type: 'lucky_draw',
            prize: winner.prize_title || 'Unknown Prize',
            position: winner.prize_position || 1,
            company: winner.winner_company,
            table_number: winner.table_number
          })
        })
      }

      // Fetch voting winners
      const { data: votingSessions, error: sessionsError } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          title,
          voting_photos(
            id,
            title,
            photo_url,
            vote_count
          )
        `)
        .eq('event_id', eventId)

      if (!sessionsError && votingSessions) {
        votingSessions.forEach(session => {
          if (session.voting_photos && session.voting_photos.length > 0) {
            // Get the photo with the most votes
            const topPhoto = session.voting_photos.reduce((prev, current) => 
              (prev.vote_count > current.vote_count) ? prev : current
            )
            
            const totalVotes = session.voting_photos.reduce((sum, photo) => sum + photo.vote_count, 0)
            const votePercentage = totalVotes > 0 ? (topPhoto.vote_count / totalVotes) * 100 : 0

            winners.push({
              id: `voting-${topPhoto.id}`,
              name: topPhoto.title,
              type: 'voting',
              prize: `${session.title} Winner`,
              position: 1
            })
          }
        })
      }

      return winners
    } catch (error) {
      console.error('Error fetching winners:', error)
      return []
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

  const generatePieChartData = (eventDetails: any) => {
    const totalAttendees = eventDetails.attendees?.length || 0
    const checkedInAttendees = eventDetails.attendees?.filter((a: any) => a.checked_in).length || 0
    const notCheckedIn = totalAttendees - checkedInAttendees

    return {
      labels: ['Checked In', 'Not Checked In'],
      datasets: [{
        label: 'Attendee Status',
        data: [checkedInAttendees, notCheckedIn],
        backgroundColor: ['#10b981', '#ef4444'],
        borderColor: ['#059669', '#dc2626'],
        borderWidth: 2
      }]
    }
  }

  const generateBarChartData = (eventDetails: any) => {
    // Group check-ins by hour
    const checkInHours: { [key: number]: number } = {}
    
    eventDetails.attendees?.forEach((attendee: any) => {
      if (attendee.checked_in && attendee.check_in_time) {
        const hour = new Date(attendee.check_in_time).getHours()
        checkInHours[hour] = (checkInHours[hour] || 0) + 1
      }
    })

    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
    const data = Array.from({ length: 24 }, (_, i) => checkInHours[i] || 0)

    return {
      labels,
      datasets: [{
        label: 'Check-ins by Hour',
        data,
        backgroundColor: ['#3b82f6'],
        borderColor: ['#2563eb'],
        borderWidth: 1
      }]
    }
  }

  const generateChartSVG = (chartData: ChartData, chartType: 'pie' | 'bar', title: string) => {
    const width = 400
    const height = 300
    const padding = 40

    if (chartType === 'pie') {
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) / 2 - padding

      const total = chartData.datasets[0].data.reduce((sum, value) => sum + value, 0)
      let currentAngle = 0

      const paths = chartData.datasets[0].data.map((value, index) => {
        const percentage = value / total
        const angle = percentage * 2 * Math.PI
        const x1 = centerX + radius * Math.cos(currentAngle)
        const y1 = centerY + radius * Math.sin(currentAngle)
        const x2 = centerX + radius * Math.cos(currentAngle + angle)
        const y2 = centerY + radius * Math.sin(currentAngle + angle)

        const largeArcFlag = angle > Math.PI ? 1 : 0
        const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`

        const textAngle = currentAngle + angle / 2
        currentAngle += angle

        return {
          path,
          color: chartData.datasets[0].backgroundColor[index],
          label: chartData.labels[index],
          value,
          percentage: (percentage * 100).toFixed(1),
          textAngle
        }
      })

      return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <title>${title}</title>
          ${paths.map((slice, index) => `
            <path d="${slice.path}" fill="${slice.color}" stroke="white" stroke-width="2"/>
            <text x="${centerX + (radius + 20) * Math.cos(slice.textAngle)}" 
                  y="${centerY + (radius + 20) * Math.sin(slice.textAngle)}" 
                  text-anchor="middle" font-size="12" fill="white" font-weight="bold">
              ${slice.label} (${slice.percentage}%)
            </text>
          `).join('')}
          <text x="${centerX}" y="${centerY}" text-anchor="middle" font-size="16" font-weight="bold" fill="#374151">
            ${title}
          </text>
        </svg>
      `
    } else if (chartType === 'bar') {
      const barWidth = (width - 2 * padding) / chartData.labels.length
      const maxValue = Math.max(...chartData.datasets[0].data)
      const scale = (height - 2 * padding) / maxValue

      const bars = chartData.datasets[0].data.map((value, index) => {
        const x = padding + index * barWidth
        const y = height - padding - value * scale
        const barHeight = value * scale

        return {
          x,
          y,
          width: barWidth - 2,
          height: barHeight,
          value,
          label: chartData.labels[index]
        }
      })

      return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <title>${title}</title>
          ${bars.map(bar => `
            <rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" 
                  fill="${chartData.datasets[0].backgroundColor}" stroke="${chartData.datasets[0].borderColor}" stroke-width="1"/>
            <text x="${bar.x + bar.width / 2}" y="${bar.y - 5}" text-anchor="middle" font-size="10" fill="#374151">
              ${bar.value}
            </text>
            <text x="${bar.x + bar.width / 2}" y="${height - 5}" text-anchor="middle" font-size="8" fill="#6b7280">
              ${bar.label}
            </text>
          `).join('')}
          <text x="${width / 2}" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#374151">
            ${title}
          </text>
        </svg>
      `
    }

    return ''
  }

     const generateEventReportSheets = (eventDetails: any, winners: Winner[], attendees: any[]) => {
     const currentDate = new Date().toLocaleDateString('en-US', { 
       year: 'numeric', 
       month: 'long', 
       day: 'numeric' 
     })
     
     let csvContent = ''
     
     // Sheet 1: Event Overview
     csvContent += '🎉 EVENT MANAGEMENT SYSTEM - PREMIUM REPORT\n'
     csvContent += '='.repeat(80) + '\n'
     csvContent += `📅 Report Generated: ${currentDate}\n`
     csvContent += `🎯 Event: ${eventDetails.name}\n`
     csvContent += `📅 Event Date: ${eventDetails.date}\n`
     csvContent += `📍 Location: ${eventDetails.location || 'N/A'}\n`
     csvContent += `📝 Description: ${eventDetails.description || 'N/A'}\n`
     csvContent += '='.repeat(80) + '\n\n'
     
     // Event Overview Section
     csvContent += '📊 EVENT OVERVIEW\n'
     csvContent += '-'.repeat(40) + '\n'
     csvContent += `Total Attendees,${eventDetails.attendees?.length || 0}\n`
     csvContent += `Checked In,${eventDetails.attendees?.filter((a: any) => a.checked_in).length || 0}\n`
     csvContent += `Winners,${winners.length}\n`
     csvContent += `Check-in Rate,${Math.round((eventDetails.attendees?.filter((a: any) => a.checked_in).length / (eventDetails.attendees?.length || 1)) * 100)}%\n`
     csvContent += '\n'
     
     // Analytics Summary
     if (includeCharts) {
       csvContent += '📈 ANALYTICS SUMMARY\n'
       csvContent += '-'.repeat(40) + '\n'
       
       // Check-in Status Summary
       const totalAttendees = eventDetails.attendees?.length || 0
       const checkedInAttendees = eventDetails.attendees?.filter((a: any) => a.checked_in).length || 0
       const notCheckedIn = totalAttendees - checkedInAttendees
       
       csvContent += 'Check-in Status:\n'
       csvContent += `  Checked In: ${checkedInAttendees} (${totalAttendees > 0 ? ((checkedInAttendees / totalAttendees) * 100).toFixed(1) : '0'}%)\n`
       csvContent += `  Not Checked In: ${notCheckedIn} (${totalAttendees > 0 ? ((notCheckedIn / totalAttendees) * 100).toFixed(1) : '0'}%)\n`
       
       // Peak Check-in Hours
       const checkInHours: { [key: number]: number } = {}
       eventDetails.attendees?.forEach((attendee: any) => {
         if (attendee.checked_in && attendee.check_in_time) {
           const hour = new Date(attendee.check_in_time).getHours()
           checkInHours[hour] = (checkInHours[hour] || 0) + 1
         }
       })
       
       const peakHours = Object.entries(checkInHours)
         .map(([hour, count]) => ({ hour: parseInt(hour), count }))
         .sort((a, b) => b.count - a.count)
         .slice(0, 3)
       
       csvContent += '\nPeak Check-in Hours:\n'
       peakHours.forEach(peak => {
         csvContent += `  ${peak.hour}:00 - ${peak.count} check-ins\n`
       })
       csvContent += '\n'
     }
     
     // Winners Section
     if (winners.length > 0) {
       csvContent += '🏆 WINNERS\n'
       csvContent += '-'.repeat(40) + '\n'
       csvContent += 'Position,Type,Winner Name,Company,Table,Prize\n'
       winners.forEach((winner, index) => {
         const tableInfo = winner.table_number ? `Table ${winner.table_number}` : 'N/A'
         csvContent += `${winner.position || index + 1},${winner.type.toUpperCase()},${winner.name},${winner.company || 'N/A'},${tableInfo},${winner.prize || 'N/A'}\n`
       })
       csvContent += '\n'
     }
     
     // Sheet 2: Attendees List
     if (attendees.length > 0) {
       csvContent += '\n' + '='.repeat(80) + '\n'
       csvContent += '👥 ATTENDEE LIST\n'
       csvContent += '='.repeat(80) + '\n'
       csvContent += `Event: ${eventDetails.name}\n`
       csvContent += `Report Generated: ${currentDate}\n`
       csvContent += '='.repeat(80) + '\n\n'
       
       csvContent += 'Name,Email,Phone,Status,Registration Date,Check-in Time,Table Info\n'
       attendees.forEach((attendee: any) => {
         const status = attendee.checked_in ? '✓ Checked In' : '○ Not Checked'
         const registrationDate = new Date(attendee.created_at).toLocaleDateString()
         const checkInTime = attendee.check_in_time ? new Date(attendee.check_in_time).toLocaleString() : 'N/A'
         
         let tableInfo = 'N/A'
         if (attendee.table_number) {
           tableInfo = `Table ${attendee.table_number}`
           if (attendee.seat_number) {
             tableInfo += ` - Seat ${attendee.seat_number}`
           }
         } else if (attendee.table_assignment) {
           tableInfo = attendee.table_assignment
         }
         
         csvContent += `${attendee.name || 'N/A'},${attendee.email || 'N/A'},${attendee.phone || 'N/A'},${status},${registrationDate},${checkInTime},${tableInfo}\n`
       })
       
       csvContent += '\n' + '='.repeat(80) + '\n'
       csvContent += '📋 Attendee List Summary\n'
       csvContent += '-'.repeat(40) + '\n'
       csvContent += `• Total Attendees: ${attendees.length}\n`
       csvContent += `• Checked In: ${attendees.filter((a: any) => a.checked_in).length}\n`
       csvContent += `• Not Checked In: ${attendees.filter((a: any) => !a.checked_in).length}\n`
       csvContent += '='.repeat(80) + '\n'
     }
     
     // Final Footer
     csvContent += '\n' + '='.repeat(80) + '\n'
     csvContent += '📋 Report Summary\n'
     csvContent += '-'.repeat(40) + '\n'
     csvContent += `• Total Records: ${attendees.length + winners.length}\n`
     csvContent += `• Report Type: Premium Event Report\n`
     csvContent += `• Generated By: Event Management System\n`
     csvContent += `• Format: Single CSV with Multiple Sections\n`
     csvContent += `• Analytics Included: ${includeCharts ? 'Yes' : 'No'}\n`
     csvContent += '='.repeat(80) + '\n'
     
     return csvContent
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
              location
            `)
            .eq('id', selectedEvent)
            .single()

          if (eventError) {
            toast.error('Error fetching event details')
            return
          }

          // Fetch attendees separately to avoid nested query issues
          const { data: attendees, error: attendeesError } = await supabase
            .from('attendees')
            .select(`
              id,
              name,
              email,
              phone,
              checked_in,
              created_at,
              check_in_time
            `)
            .eq('event_id', selectedEvent)

          if (attendeesError) {
            toast.error('Error fetching attendees')
            return
          }

          // Combine event details with attendees
          const eventWithAttendees = {
            ...eventDetails,
            attendees: attendees || []
          }

          if (eventError) {
            toast.error('Error fetching event details')
            return
          }

          // Fetch winners if enabled
          let winners: Winner[] = []
          if (includeWinners) {
            winners = await fetchEventWinners(selectedEvent)
          }

                     // Generate single CSV report with multiple sections
           const eventCsvContent = generateEventReportSheets(eventWithAttendees, winners, includeAttendees ? eventWithAttendees.attendees || [] : [])
           
           // Create and download single CSV file
           const blob = new Blob([eventCsvContent], { type: 'text/csv;charset=utf-8;' })
           const url = URL.createObjectURL(blob)
           const a = document.createElement('a')
           a.href = url
           a.download = `event-report-${eventDetails.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
           document.body.appendChild(a)
           a.click()
           document.body.removeChild(a)
           URL.revokeObjectURL(url)

          toast.success('Premium CSV report exported successfully!')
          return
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
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeWinners"
                    checked={includeWinners}
                    onChange={(e) => setIncludeWinners(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="includeWinners" className="text-sm text-gray-700">
                    Include Winners
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeCharts"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="includeCharts" className="text-sm text-gray-700">
                    Include Charts
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