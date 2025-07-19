import { useState, useEffect } from 'react'
import { Gift, Play, RotateCcw, Users, Trophy, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface Event {
  id: string
  name: string
  company_id: string
  company: {
    name: string
  }
}

interface Attendee {
  id: string
  name: string
  company: string | null
}

interface LuckyDrawProps {
  userCompany?: any
}

export default function LuckyDraw({ userCompany }: LuckyDrawProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [winner, setWinner] = useState<Attendee | null>(null)
  const [previousWinners, setPreviousWinners] = useState<Attendee[]>([])
  const [currentName, setCurrentName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchAttendees()
    }
  }, [selectedEventId])

  const fetchEvents = async () => {
    try {
      let query = supabase.from('events').select(`
          id,
          name,
          company_id,
          company:companies(name)
        `)

      // Filter by company if user is a company user
      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform data to ensure company is a single object, not an array
      const transformedData = data?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      })) || []
      
      setEvents(transformedData)

      // Auto-select first event for company users
      if (userCompany && transformedData && transformedData.length > 0) {
        setSelectedEventId(transformedData[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    }
  }

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('id, name, company')
        .eq('event_id', selectedEventId)
        .eq('checked_in', true)

      if (error) throw error
      setAttendees(data)
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    }
  }

  const startDraw = () => {
    if (attendees.length === 0) {
      toast.error('No checked-in attendees available for draw')
      return
    }

    // Filter out previous winners
    const availableAttendees = attendees.filter(
      attendee => !previousWinners.find(winner => winner.id === attendee.id)
    )

    if (availableAttendees.length === 0) {
      toast.error('All attendees have already won!')
      return
    }

    setIsDrawing(true)
    setWinner(null)

    // Animate through random names
    let counter = 0
    const maxIterations = 30
    const interval = setInterval(() => {
      const randomAttendee = availableAttendees[Math.floor(Math.random() * availableAttendees.length)]
      setCurrentName(randomAttendee.name)
      
      counter++
      if (counter >= maxIterations) {
        clearInterval(interval)
        
        // Select final winner
        const finalWinner = availableAttendees[Math.floor(Math.random() * availableAttendees.length)]
        setWinner(finalWinner)
        setCurrentName(finalWinner.name)
        setIsDrawing(false)
        
        toast.success(`🎉 ${finalWinner.name} wins!`)
      }
    }, 100)
  }

  const confirmWinner = () => {
    if (winner) {
      setPreviousWinners([...previousWinners, winner])
      setWinner(null)
      setCurrentName('')
    }
  }

  const resetDraw = () => {
    setWinner(null)
    setCurrentName('')
    setIsDrawing(false)
    setPreviousWinners([])
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  const DrawDisplay = () => (
    <div className="h-full bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-30"
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="text-center text-white z-10">
        <AnimatePresence mode="wait">
          {!isDrawing && !winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="space-y-8"
            >
              <Gift className="h-32 w-32 mx-auto mb-8" />
              <h1 className="text-6xl md:text-8xl font-bold mb-4">Lucky Draw</h1>
              <p className="text-2xl md:text-3xl opacity-80">Ready to pick a winner?</p>
            </motion.div>
          )}

          {isDrawing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-24 w-24 mx-auto mb-8" />
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-bold mb-8">Drawing...</h1>
              <motion.div
                key={currentName}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl md:text-5xl font-semibold bg-white bg-opacity-20 rounded-lg p-6"
              >
                {currentName}
              </motion.div>
            </motion.div>
          )}

          {winner && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Trophy className="h-32 w-32 mx-auto mb-8 text-yellow-300" />
              </motion.div>
              <motion.h1 
                className="text-4xl md:text-6xl font-bold mb-4"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🎉 WINNER! 🎉
              </motion.h1>
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-4xl md:text-6xl font-bold bg-white bg-opacity-20 rounded-lg p-8"
              >
                {winner.name}
              </motion.div>
              {winner.company && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-2xl md:text-3xl opacity-80"
                >
                  {winner.company}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50">
        <DrawDisplay />
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
          {!isDrawing && !winner && (
            <button
              onClick={startDraw}
              className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-xl hover:bg-gray-100 transition-colors"
            >
              Start Draw
            </button>
          )}
          {winner && (
            <>
              <button
                onClick={confirmWinner}
                className="bg-green-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-green-700 transition-colors"
              >
                Confirm Winner
              </button>
              <button
                onClick={startDraw}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-blue-700 transition-colors"
              >
                Draw Again
              </button>
            </>
          )}
          <button
            onClick={toggleFullscreen}
            className="bg-gray-600 text-white px-6 py-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lucky Draw</h1>
          <p className="text-gray-600 mt-2">Random winner selection from checked-in attendees</p>
        </div>
        <button
          onClick={toggleFullscreen}
          disabled={!selectedEventId}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Gift className="h-5 w-5 mr-2" />
          Fullscreen Draw
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Gift className="h-6 w-6 mr-2" />
            Draw Controls
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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

            {selectedEventId && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center text-purple-700 mb-2">
                  <Users className="h-5 w-5 mr-2" />
                  <span className="font-medium">Eligible Participants</span>
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {attendees.filter(a => !previousWinners.find(w => w.id === a.id)).length}
                </div>
                <div className="text-sm text-purple-600">
                  {attendees.length} total checked-in • {previousWinners.length} already won
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={startDraw}
                disabled={!selectedEventId || isDrawing || attendees.length === 0}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="h-5 w-5 mr-2" />
                {isDrawing ? 'Drawing...' : 'Start Lucky Draw'}
              </button>

              {winner && (
                <button
                  onClick={confirmWinner}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirm Winner
                </button>
              )}

              <button
                onClick={resetDraw}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              {selectedEventId ? (
                <DrawDisplay />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Gift className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select an event to see preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Previous Winners */}
          {previousWinners.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
                Previous Winners
              </h2>
              <div className="space-y-2">
                {previousWinners.map((winner, index) => (
                  <div key={winner.id} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                    <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{winner.name}</div>
                      {winner.company && (
                        <div className="text-sm text-gray-600">{winner.company}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}