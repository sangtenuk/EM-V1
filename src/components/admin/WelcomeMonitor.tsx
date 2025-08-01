import { useState, useEffect } from 'react'
import { Monitor, Users, Settings, Maximize, Clock, Building, MapPin, User, Calendar, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface Event {
  id: string
  name: string
  company: {
    name: string
  }
}

interface LatestCheckIn {
  id: string
  name: string
  company: string | null
  check_in_time: string
  face_photo_url?: string | null
  table_number?: string | null
  table_position?: string | null
  email?: string | null
  phone?: string | null
  registration_date?: string | null
}

interface WelcomeMonitorProps {
  userCompany?: any
}

export default function WelcomeMonitor({ userCompany }: WelcomeMonitorProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [latestCheckIn, setLatestCheckIn] = useState<LatestCheckIn | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [checkInHistory, setCheckInHistory] = useState<LatestCheckIn[]>([])
  const [settings, setSettings] = useState({
    showCompany: true,
    showTime: true,
    showPhoto: true,
    showTableInfo: true,
    showContactInfo: false,
    autoHide: true,
    hideDelay: 5000,
    backgroundColor: '#1e40af',
    textColor: '#ffffff',
    showHistory: false,
    maxHistoryItems: 5
  })

  useEffect(() => {
    fetchEvents()
  }, [userCompany])

  useEffect(() => {
    if (selectedEventId) {
      // Set up real-time subscription for new check-ins - same approach as VotingMonitor
      const subscription = supabase
        .channel(`check-ins-${selectedEventId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendees'
          },
          (payload) => {
            // Force immediate update with smooth transition
            setTimeout(() => {
              checkForNewCheckIns()
            }, 100)
          }
        )
        .subscribe()

      // Initial fetch
      checkForNewCheckIns()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [selectedEventId])

  // Periodic refresh as fallback (every 10 seconds) - same as VotingMonitor
  useEffect(() => {
    if (selectedEventId) {
      const interval = setInterval(() => {
        checkForNewCheckIns()
      }, 10000) // 10 seconds

      return () => clearInterval(interval)
    }
  }, [selectedEventId])

  // Fixed auto-hide timer that doesn't interfere with new check-ins
  useEffect(() => {
    if (latestCheckIn && settings.autoHide) {
      const timer = setTimeout(() => {
        // Only hide if no new check-ins have been detected recently
        const checkInTime = new Date(latestCheckIn.check_in_time)
        const now = new Date()
        const timeDiff = (now.getTime() - checkInTime.getTime()) / 1000
        
        if (timeDiff > 30) { // Only auto-hide if check-in is older than 30 seconds
          setLatestCheckIn(null)
        }
      }, settings.hideDelay)

      return () => clearTimeout(timer)
    }
  }, [latestCheckIn, settings.autoHide, settings.hideDelay])

  const checkForNewCheckIns = async () => {
    try {
      // Fetch recent check-ins from the database
      const { data: recentCheckIns, error } = await supabase
        .from('attendees')
        .select(`
          id,
          name,
          company,
          email,
          phone,
          table_number,
          seat_number,
          table_assignment,
          face_photo_url,
          check_in_time,
          created_at
        `)
        .eq('event_id', selectedEventId)
        .eq('checked_in', true)
        .not('check_in_time', 'is', null)
        .order('check_in_time', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching recent check-ins:', error)
        return
      }

      if (recentCheckIns && recentCheckIns.length > 0) {
        // Get the most recent check-in
        const latestCheckIn = recentCheckIns[0]
        
        // Check if this is a new check-in (within last 30 seconds)
        const checkInTime = new Date(latestCheckIn.check_in_time)
        const now = new Date()
        const timeDiff = (now.getTime() - checkInTime.getTime()) / 1000 // seconds
        
        if (timeDiff < 30) { // Only show if check-in was within last 30 seconds
          // Get table position if table_number exists
          let tablePosition = ''
          if (latestCheckIn.table_number) {
            tablePosition = `Table ${latestCheckIn.table_number}`
            if (latestCheckIn.seat_number) {
              tablePosition += ` - Seat ${latestCheckIn.seat_number}`
            }
          } else if (latestCheckIn.table_assignment) {
            tablePosition = latestCheckIn.table_assignment
          }
          
          const checkInData = {
            id: latestCheckIn.id,
            name: latestCheckIn.name,
            company: latestCheckIn.company,
            check_in_time: latestCheckIn.check_in_time,
            face_photo_url: latestCheckIn.face_photo_url,
            table_number: latestCheckIn.table_number,
            table_position: tablePosition,
            email: latestCheckIn.email,
            phone: latestCheckIn.phone,
            registration_date: latestCheckIn.created_at
          }
          
          setLatestCheckIn(checkInData)
          
          // Add to history
          setCheckInHistory(prev => {
            const newHistory = [checkInData, ...prev.slice(0, settings.maxHistoryItems - 1)]
            return newHistory
          })
        }
      }
    } catch (error) {
      console.error('Error checking for new check-ins:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          name,
          company_id,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      // Filter by company if user is a company user
      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query

      if (error) throw error

      if (data) {
        const normalizedData = data.map((event: any) => ({
          ...event,
          company: Array.isArray(event.company) ? event.company[0] : event.company
        }))
        setEvents(normalizedData)

        // Auto-select first event for company users
        if (userCompany && normalizedData && normalizedData.length > 0) {
          setSelectedEventId(normalizedData[0].id)
        }
      }
    } catch (error: any) {
      console.error('Error fetching events:', error)
    }
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const MonitorDisplay = () => (
    <div className="h-full flex items-center justify-center relative" style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}>
      <AnimatePresence>
        {latestCheckIn ? (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="text-center max-w-4xl mx-auto p-8"
          >
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="mb-8">
              <h1 className="text-6xl md:text-8xl font-bold mb-6">Welcome!</h1>
              
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
                {settings.showPhoto && latestCheckIn.face_photo_url && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="flex-shrink-0"
                  >
                    <img 
                      src={latestCheckIn.face_photo_url} 
                      alt={latestCheckIn.name}
                      className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white shadow-2xl object-cover"
                    />
                  </motion.div>
                )}
                
                <div className="flex-1">
                  <div className="text-4xl md:text-6xl font-semibold mb-4">{latestCheckIn.name}</div>
                  
                  {settings.showCompany && latestCheckIn.company && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-2xl md:text-4xl opacity-80 mb-4 flex items-center justify-center"
                    >
                      <Building className="h-6 w-6 md:h-8 md:w-8 mr-2" />
                      {latestCheckIn.company}
                    </motion.div>
                  )}
                  
                  {settings.showTableInfo && latestCheckIn.table_number && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-xl md:text-3xl opacity-80 mb-4 flex items-center justify-center"
                    >
                      <MapPin className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                      Table {latestCheckIn.table_number}
                      {latestCheckIn.table_position && ` - ${latestCheckIn.table_position}`}
                    </motion.div>
                  )}
                  
                  {settings.showTime && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="text-xl md:text-2xl opacity-60 flex items-center justify-center"
                    >
                      <Clock className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                      {formatTime(latestCheckIn.check_in_time)}
                    </motion.div>
                  )}
                </div>
              </div>
              
              {settings.showContactInfo && (latestCheckIn.email || latestCheckIn.phone) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="text-lg md:text-xl opacity-70"
                >
                  {latestCheckIn.email && (
                    <div className="mb-2">{latestCheckIn.email}</div>
                  )}
                  {latestCheckIn.phone && (
                    <div>{latestCheckIn.phone}</div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Users className="h-32 w-32 mx-auto mb-8 opacity-50" />
            <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome to the Event</h1>
            <p className="text-xl md:text-2xl opacity-80">Waiting for check-ins...</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Check-in History */}
      {settings.showHistory && checkInHistory.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 right-4"
        >
          <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Recent Check-ins</h3>
            <div className="flex gap-2 overflow-x-auto">
              {checkInHistory.map((checkIn, index) => (
                <motion.div
                  key={checkIn.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex-shrink-0 bg-white bg-opacity-20 rounded-lg p-3 min-w-0"
                >
                  {checkIn.face_photo_url && (
                    <img 
                      src={checkIn.face_photo_url} 
                      alt={checkIn.name}
                      className="w-8 h-8 rounded-full mr-2 object-cover"
                    />
                  )}
                  <div className="text-sm">
                    <div className="font-semibold truncate">{checkIn.name}</div>
                    <div className="opacity-80 text-xs">{formatTime(checkIn.check_in_time)}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50">
        <MonitorDisplay />
        <button onClick={toggleFullscreen} className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-colors">
          Exit Fullscreen
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Monitor</h1>
          <p className="text-gray-600 mt-2">Display latest check-ins on external monitor with detailed attendee information</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => checkForNewCheckIns()}
            disabled={!selectedEventId}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Refresh Check-ins
          </button>
          <button
            onClick={toggleFullscreen}
            disabled={!selectedEventId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Maximize className="h-5 w-5 mr-2" />
            Fullscreen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Settings className="h-6 w-6 mr-2" />
            Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {userCompany && events.length <= 1 ? 'Event' : 'Select Event'}
              </label>
              {userCompany && events.length === 1 ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                  {events[0].name}
                </div>
              ) : (
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {!userCompany && <option value="">Select an event</option>}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {userCompany ? event.name : `${event.name} (${event.company.name})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-3">
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showPhoto} onChange={(e) => setSettings({ ...settings, showPhoto: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Attendee Photo</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showCompany} onChange={(e) => setSettings({ ...settings, showCompany: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Company</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showTableInfo} onChange={(e) => setSettings({ ...settings, showTableInfo: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Table Information</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showTime} onChange={(e) => setSettings({ ...settings, showTime: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Check-in Time</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showContactInfo} onChange={(e) => setSettings({ ...settings, showContactInfo: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Contact Information</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showHistory} onChange={(e) => setSettings({ ...settings, showHistory: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Recent Check-ins</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.autoHide} onChange={(e) => setSettings({ ...settings, autoHide: e.target.checked })} className="mr-2" />
                <span className="text-sm">Auto Hide</span>
              </label>
            </div>
            {settings.autoHide && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hide Delay (seconds)</label>
                <input
                  type="number"
                  value={settings.hideDelay / 1000}
                  onChange={(e) => setSettings({ ...settings, hideDelay: parseInt(e.target.value) * 1000 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="30"
                />
              </div>
            )}
            {settings.showHistory && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max History Items</label>
                <input
                  type="number"
                  value={settings.maxHistoryItems}
                  onChange={(e) => setSettings({ ...settings, maxHistoryItems: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="10"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
              <input type="color" value={settings.backgroundColor} onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })} className="w-full h-10 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
              <input type="color" value={settings.textColor} onChange={(e) => setSettings({ ...settings, textColor: e.target.value })} className="w-full h-10 border border-gray-300 rounded-md" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Monitor className="h-6 w-6 mr-2" />
              Preview
            </h2>
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              {selectedEventId ? (
                <MonitorDisplay />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select an event to see preview</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>• This preview shows how the welcome screen will appear</p>
              <p>• Click "Fullscreen" to display on external monitor</p>
              <p>• New check-ins will automatically appear in real-time</p>
              <p>• Shows detailed attendee information including photo, company, and table assignment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}