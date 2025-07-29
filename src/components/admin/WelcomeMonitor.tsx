import { useState, useEffect } from 'react'
import { Monitor, Users, Settings, Maximize } from 'lucide-react'
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
}

interface WelcomeMonitorProps {
  userCompany?: any
}

export default function WelcomeMonitor({ userCompany }: WelcomeMonitorProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [latestCheckIn, setLatestCheckIn] = useState<LatestCheckIn | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [settings, setSettings] = useState({
    showCompany: true,
    showTime: true,
    autoHide: true,
    hideDelay: 5000,
    backgroundColor: '#1e40af',
    textColor: '#ffffff'
  })

  useEffect(() => {
    fetchEvents()
  }, [userCompany])

  useEffect(() => {
    if (selectedEventId) {
      // Set up real-time subscription for new check-ins
      const subscription = supabase
        .channel('check-ins')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'attendees',
            filter: `event_id=eq.${selectedEventId}`
          },
          (payload) => {
            // Check if this is a new check-in (checked_in changed from false to true)
            if (payload.new && payload.old && 
                payload.new.checked_in === true && 
                payload.old.checked_in === false) {
              setLatestCheckIn({
                id: payload.new.id,
                name: payload.new.name,
                company: payload.new.company,
                check_in_time: payload.new.check_in_time
              })
              console.log('New check-in detected:', payload.new.name)
            }
          }
        )
        .subscribe()

      // Also listen for INSERT events (new attendees checking in)
      const insertSubscription = supabase
        .channel('new-checkins')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'attendees',
            filter: `event_id=eq.${selectedEventId}`
          },
          (payload) => {
            if (payload.new && payload.new.checked_in === true) {
              setLatestCheckIn({
                id: payload.new.id,
                name: payload.new.name,
                company: payload.new.company,
                check_in_time: payload.new.check_in_time
              })
              console.log('New attendee checked in:', payload.new.name)
            }
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
        insertSubscription.unsubscribe()
      }
    }
  }, [selectedEventId])

  useEffect(() => {
    if (latestCheckIn && settings.autoHide) {
      const timer = setTimeout(() => {
        setLatestCheckIn(null)
      }, settings.hideDelay)

      return () => clearTimeout(timer)
    }
  }, [latestCheckIn, settings.autoHide, settings.hideDelay])

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

  const MonitorDisplay = () => (
    <div className="h-full flex items-center justify-center relative" style={{ backgroundColor: settings.backgroundColor, color: settings.textColor }}>
      <AnimatePresence>
        {latestCheckIn ? (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="text-center"
          >
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="mb-8">
              <h1 className="text-6xl md:text-8xl font-bold mb-4">Welcome!</h1>
              <div className="text-4xl md:text-6xl font-semibold mb-2">{latestCheckIn.name}</div>
              {settings.showCompany && latestCheckIn.company && (
                <div className="text-2xl md:text-4xl opacity-80">{latestCheckIn.company}</div>
              )}
              {settings.showTime && (
                <div className="text-xl md:text-2xl opacity-60 mt-4">{new Date(latestCheckIn.check_in_time).toLocaleTimeString()}</div>
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
          <p className="text-gray-600 mt-2">Display latest check-ins on external monitor</p>
        </div>
        <button
          onClick={toggleFullscreen}
          disabled={!selectedEventId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Maximize className="h-5 w-5 mr-2" />
          Fullscreen
        </button>
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
                <input type="checkbox" checked={settings.showCompany} onChange={(e) => setSettings({ ...settings, showCompany: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Company</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showTime} onChange={(e) => setSettings({ ...settings, showTime: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Check-in Time</span>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}