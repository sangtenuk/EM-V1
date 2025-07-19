import React, { useState, useEffect } from 'react'
import { Monitor, Users, Settings, Maximize, Palette } from 'lucide-react'
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

export default function WelcomeMonitor() {
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
    textColor: '#ffffff',
    title: 'Welcome to the Event',
    subtitle: 'Waiting for check-ins...'
  })

  useEffect(() => {
    fetchEvents()
  }, [])

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
            if (payload.new.checked_in && !payload.old.checked_in) {
              setLatestCheckIn({
                id: payload.new.id,
                name: payload.new.name,
                company: payload.new.company,
                check_in_time: payload.new.check_in_time
              })
            }
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
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
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data)
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
    <div 
      className="h-full flex items-center justify-center relative"
      style={{ 
        backgroundColor: settings.backgroundColor,
        color: settings.textColor 
      }}
    >
      <AnimatePresence>
        {latestCheckIn ? (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="mb-4 md:mb-8"
            >
              <h1 className="text-3xl md:text-6xl lg:text-8xl font-bold mb-2 md:mb-4">Welcome!</h1>
              <div className="text-2xl md:text-4xl lg:text-6xl font-semibold mb-1 md:mb-2">
                {latestCheckIn.name}
              </div>
              {settings.showCompany && latestCheckIn.company && (
                <div className="text-lg md:text-2xl lg:text-4xl opacity-80">
                  {latestCheckIn.company}
                </div>
              )}
              {settings.showTime && (
                <div className="text-base md:text-xl lg:text-2xl opacity-60 mt-2 md:mt-4">
                  {new Date(latestCheckIn.check_in_time).toLocaleTimeString()}
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <Users className="h-16 w-16 md:h-32 md:w-32 mx-auto mb-4 md:mb-8 opacity-50" />
            <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold mb-2 md:mb-4 px-4">
              {settings.title}
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl opacity-80 px-4">
              {settings.subtitle}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50">
        <MonitorDisplay />
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 md:top-4 md:right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-colors text-sm md:text-base"
        >
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
          <span className="hidden md:inline">Fullscreen</span>
          <span className="md:hidden">Monitor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Settings className="h-6 w-6 mr-2" />
            Settings
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.company.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Welcome Title
              </label>
              <input
                type="text"
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Welcome to the Event"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={settings.subtitle}
                onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Waiting for check-ins..."
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showCompany}
                  onChange={(e) => setSettings({ ...settings, showCompany: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Show Company</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showTime}
                  onChange={(e) => setSettings({ ...settings, showTime: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Show Check-in Time</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoHide}
                  onChange={(e) => setSettings({ ...settings, autoHide: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm">Auto Hide</span>
              </label>
            </div>

            {settings.autoHide && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hide Delay (seconds)
                </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded-md"
                />
                <input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#1e40af"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Color
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
                  className="w-12 h-10 border border-gray-300 rounded-md"
                />
                <input
                  type="text"
                  value={settings.textColor}
                  onChange={(e) => setSettings({ ...settings, textColor: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2 flex items-center">
                <Palette className="h-4 w-4 mr-2" />
                Quick Themes
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSettings({ ...settings, backgroundColor: '#1e40af', textColor: '#ffffff' })}
                  className="p-2 rounded text-white text-xs"
                  style={{ backgroundColor: '#1e40af' }}
                >
                  Blue
                </button>
                <button
                  onClick={() => setSettings({ ...settings, backgroundColor: '#7c3aed', textColor: '#ffffff' })}
                  className="p-2 rounded text-white text-xs"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  Purple
                </button>
                <button
                  onClick={() => setSettings({ ...settings, backgroundColor: '#059669', textColor: '#ffffff' })}
                  className="p-2 rounded text-white text-xs"
                  style={{ backgroundColor: '#059669' }}
                >
                  Green
                </button>
                <button
                  onClick={() => setSettings({ ...settings, backgroundColor: '#dc2626', textColor: '#ffffff' })}
                  className="p-2 rounded text-white text-xs"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Red
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
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

            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <p>• This preview shows how the welcome screen will appear</p>
              <p>• Click "Fullscreen" to display on external monitor</p>
              <p>• New check-ins will automatically appear in real-time</p>
              <p>• Customize title, colors, and display options in settings</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}