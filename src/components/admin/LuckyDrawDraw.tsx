import { useState, useEffect } from 'react'
import { Gift, Play, RotateCcw, Users, Trophy, Sparkles, Table, Target } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface Event {
  id: string
  name: string
  company_id: string
  custom_background?: string | null
  custom_logo?: string | null
  company: {
    name: string
  }
}

interface Attendee {
  id: string
  name: string
  company: string | null
  table_number?: number | null
}

interface CustomPrize {
  id: string
  position: number
  title: string
  description?: string
  image_url?: string
  event_id: string
}

interface LuckyDrawDrawProps {
  userCompany?: any
  eventId?: string
}

type DrawType = 'table' | 'custom' | 'regular'

export default function LuckyDrawDraw({ userCompany, eventId }: LuckyDrawDrawProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState(eventId || '')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [winner, setWinner] = useState<Attendee | null>(null)
  const [previousWinners, setPreviousWinners] = useState<Attendee[]>([])
  const [currentName, setCurrentName] = useState('')
  
  // Draw configuration
  const [drawType, setDrawType] = useState<DrawType>('regular')
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [tables, setTables] = useState<{ table_number: number; table_type: string; capacity: number }[]>([])
  const [customWinnerCount, setCustomWinnerCount] = useState<number>(5)
  const [customPrizes, setCustomPrizes] = useState<CustomPrize[]>([])
  const [isCustomDrawing, setIsCustomDrawing] = useState(false)
  const [customWinners, setCustomWinners] = useState<Attendee[]>([])
  const [currentCustomWinnerIndex, setCurrentCustomWinnerIndex] = useState<number>(0)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchAttendees()
      fetchCustomPrizes()
    }
  }, [selectedEventId])

  const fetchEvents = async () => {
    try {
      let query = supabase.from('events').select(`
          id,
          name,
          company_id,
          custom_background,
          custom_logo,
          company:companies(name)
        `)

      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      const transformedData = data?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      })) || []
      
      setEvents(transformedData)

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
        .select('id, name, company, table_number')
        .eq('event_id', selectedEventId)
        .eq('checked_in', true)

      if (error) throw error
      setAttendees(data)
      
      // Fetch tables from seating arrangement
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('table_number, table_type, capacity')
        .eq('event_id', selectedEventId)
        .order('table_number')

      if (tablesError) {
        console.error('Error fetching tables:', tablesError)
        // If tables don't exist, extract from attendees
        const uniqueTables = [...new Set(data?.filter(a => a.table_number).map(a => a.table_number))].sort((a, b) => a - b)
        setTables(uniqueTables.map(tableNum => ({ table_number: tableNum, table_type: 'Regular', capacity: 8 })))
      } else {
        setTables(tablesData || [])
      }
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    }
  }

  const fetchCustomPrizes = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_prizes')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('position', { ascending: false })

      if (error) throw error
      setCustomPrizes(data || [])
    } catch (error: any) {
      console.error('Error fetching custom prizes:', error)
    }
  }

  const getEligibleAttendees = () => {
    let eligible = attendees.filter(
      attendee => !previousWinners.find(winner => winner.id === attendee.id)
    )

    // Filter by table if table draw is selected
    if (drawType === 'table' && selectedTable) {
      eligible = eligible.filter(attendee => attendee.table_number === selectedTable)
    }

    return eligible
  }

  const startDraw = () => {
    if (drawType === 'table') {
      startTableDraw()
    } else if (drawType === 'custom') {
      startCustomDraw()
    } else {
      startRegularDraw()
    }
  }

  const startTableDraw = () => {
    // Get all tables that haven't been won yet
    const availableTables = tables.filter(table => 
      !previousWinners.find(w => w.id === `table-${table.table_number}`)
    )
    
    if (availableTables.length === 0) {
      toast.error('No tables available for drawing')
      return
    }
    
    // Select random table
    const randomTable = availableTables[Math.floor(Math.random() * availableTables.length)]
    setSelectedTable(randomTable.table_number)
    
    setIsDrawing(true)
    setWinner(null)

    // Animate through random table numbers
    let counter = 0
    const maxIterations = 30
    const interval = setInterval(() => {
      const randomTableObj = availableTables[Math.floor(Math.random() * availableTables.length)]
      setCurrentName(`Table ${randomTableObj.table_number} (${randomTableObj.table_type})`)
      
      counter++
      if (counter >= maxIterations) {
        clearInterval(interval)
        
        // Final result is the selected table
        setWinner({ 
          id: `table-${randomTable.table_number}`, 
          name: `Table ${randomTable.table_number} (${randomTable.table_type})`, 
          company: null, 
          table_number: randomTable.table_number 
        })
        setCurrentName(`Table ${randomTable.table_number} (${randomTable.table_type})`)
        setIsDrawing(false)
        
        toast.success(`🎉 Table ${randomTable.table_number} (${randomTable.table_type}) wins!`)
      }
    }, 100)
  }

  const startRegularDraw = () => {
    const eligibleAttendees = getEligibleAttendees()

    if (eligibleAttendees.length === 0) {
      toast.error('No eligible attendees available')
      return
    }

    setIsDrawing(true)
    setWinner(null)

    // Animate through random names
    let counter = 0
    const maxIterations = 30
    const interval = setInterval(() => {
      const randomAttendee = eligibleAttendees[Math.floor(Math.random() * eligibleAttendees.length)]
      setCurrentName(randomAttendee.name)
      
      counter++
      if (counter >= maxIterations) {
        clearInterval(interval)
        
        // Select final winner
        const finalWinner = eligibleAttendees[Math.floor(Math.random() * eligibleAttendees.length)]
        setWinner(finalWinner)
        setCurrentName(finalWinner.name)
        setIsDrawing(false)
        
        toast.success(`🎉 ${finalWinner.name} wins!`)
      }
    }, 100)
  }

  const startCustomDraw = () => {
    const eligibleAttendees = getEligibleAttendees()

    if (eligibleAttendees.length < customWinnerCount) {
      toast.error(`Not enough eligible attendees. Need ${customWinnerCount}, have ${eligibleAttendees.length}`)
      return
    }

    // Check if we have prizes configured
    if (customPrizes.length === 0) {
      toast.error('Please configure prizes first before starting custom draw')
      return
    }

    setIsCustomDrawing(true)
    setCustomWinners([])
    setCurrentCustomWinnerIndex(0)

    // Start drawing the first winner
    drawNextCustomWinner()
  }

  const drawNextCustomWinner = () => {
    const eligibleAttendees = getEligibleAttendees()
    const position = customWinnerCount - currentCustomWinnerIndex // Descending order
    
    if (eligibleAttendees.length === 0) {
      setIsCustomDrawing(false)
      setCurrentCustomWinnerIndex(0)
      toast.error('No more eligible attendees available')
      return
    }
    
    // Get the prize for this position
    const prize = customPrizes.find(p => p.position === position)
    
    // Animate through random names
    let counter = 0
    const maxIterations = 20
    const interval = setInterval(() => {
      const randomAttendee = eligibleAttendees[Math.floor(Math.random() * eligibleAttendees.length)]
      setCurrentName(randomAttendee.name)
      
      counter++
      if (counter >= maxIterations) {
        clearInterval(interval)
        
        // Select final winner
        const finalWinner = eligibleAttendees[Math.floor(Math.random() * eligibleAttendees.length)]
        setCurrentName(finalWinner.name)
        
        // Add winner to the list
        const newWinners = [...customWinners, finalWinner]
        setCustomWinners(newWinners)
        
        // Show prize information
        if (prize) {
          toast.success(`🎉 ${finalWinner.name} wins ${prize.title}!`)
        } else {
          toast.success(`🎉 ${finalWinner.name} wins!`)
        }
        
        // Stop here and wait for confirmation
        setIsCustomDrawing(false)
      }
    }, 100)
  }

  const confirmWinner = () => {
    if (winner) {
      setPreviousWinners(prev => [...prev, winner])
      setWinner(null)
      setCurrentName('')
      setSelectedTable(null)
      setIsDrawing(false)
    }
  }

  const confirmCustomWinners = () => {
    if (customWinners.length > 0) {
      setPreviousWinners(prev => [...prev, ...customWinners])
      setCustomWinners([])
      setCurrentCustomWinnerIndex(0)
      setIsCustomDrawing(false)
      setCurrentName('')
    }
  }

  const continueCustomDraw = () => {
    if (currentCustomWinnerIndex + 1 < customWinnerCount) {
      setCurrentCustomWinnerIndex(currentCustomWinnerIndex + 1)
      setCurrentName('')
      setIsCustomDrawing(true)
      drawNextCustomWinner()
    } else {
      // All winners drawn
      setCurrentName('')
      setIsCustomDrawing(false)
      setCurrentCustomWinnerIndex(0)
      toast.success(`🎉 All ${customWinnerCount} winners selected with prizes!`)
    }
  }

  const resetDraw = () => {
    setWinner(null)
    setCurrentName('')
    setIsDrawing(false)
    setPreviousWinners([])
    setCustomWinners([])
    setIsCustomDrawing(false)
    setCurrentCustomWinnerIndex(0)
    setSelectedTable(null)
  }

  const selectedEvent = events.find(e => e.id === selectedEventId)
  
  // Get background from Supabase storage or use default gradient
  const backgroundStyle = selectedEvent?.custom_background
    ? { 
        backgroundImage: selectedEvent.custom_background.startsWith('blob:') 
          ? 'none' // Don't use blob URLs in CSS
          : `url(${getStorageUrl(selectedEvent.custom_background)})`, 
        backgroundColor: selectedEvent.custom_background.startsWith('blob:') 
          ? '#1e293b' // Fallback color for blob URLs
          : 'transparent',
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : { 
        background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #6366f1 100%)'
      }

  return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden" style={backgroundStyle}>
      {/* Dark overlay for custom backgrounds */}
      {selectedEvent?.custom_background && !selectedEvent.custom_background.startsWith('blob:') && (
        <div className="absolute inset-0 bg-black bg-opacity-70"></div>
      )}
      
      {/* Background Animation - only show on default background */}
      {(!selectedEvent?.custom_background || selectedEvent.custom_background.startsWith('blob:')) && (
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
      )}

      <div className="text-center text-white z-10">
        <AnimatePresence mode="wait">
          {!isDrawing && !winner && !isCustomDrawing && customWinners.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="space-y-8"
            >
              <Gift className="h-32 w-32 mx-auto mb-8" />
              <h1 className="text-6xl md:text-8xl font-bold mb-4">Lucky Draw</h1>
              <p className="text-2xl md:text-3xl opacity-80">
                {drawType === 'table' ? 'Random Table Selection' :
                 drawType === 'custom' ? `Custom Draw (${customWinnerCount} winners)` :
                 drawType === 'regular' ? 'Single Winner Selection' :
                 'Ready to pick a winner?'}
              </p>
            </motion.div>
          )}

          {(isDrawing || isCustomDrawing) && (
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
              <h1 className="text-4xl md:text-6xl font-bold mb-8">
                {isCustomDrawing ? `Drawing Winner #${customWinnerCount - currentCustomWinnerIndex}...` : 'Drawing...'}
              </h1>
              {isCustomDrawing && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-xl md:text-2xl opacity-80 mb-4"
                >
                  {(() => {
                    const position = customWinnerCount - currentCustomWinnerIndex
                    const prize = customPrizes.find(p => p.position === position)
                    return prize ? `Prize: ${prize.title}` : `Position #${position}`
                  })()}
                </motion.div>
              )}
              <motion.div
                key={currentName}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl md:text-5xl font-semibold bg-white bg-opacity-20 rounded-lg p-6"
              >
                {currentName}
              </motion.div>
              {isCustomDrawing && customWinners.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-xl md:text-2xl opacity-80"
                >
                  Previous Winners: {customWinners.map(w => w.name).join(', ')}
                </motion.div>
              )}
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
                🎉 {winner.id?.startsWith('table-') ? 'TABLE WINNER!' : 'WINNER!'} 🎉
              </motion.h1>
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-4xl md:text-6xl font-bold bg-white bg-opacity-20 rounded-lg p-8"
              >
                {winner.name}
              </motion.div>
              {winner.company && !winner.id?.startsWith('table-') && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-2xl md:text-3xl opacity-80"
                >
                  {winner.company}
                </motion.div>
              )}
              {winner.table_number && !winner.id?.startsWith('table-') && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-xl md:text-2xl opacity-80"
                >
                  Table {winner.table_number}
                </motion.div>
              )}
            </motion.div>
          )}

          {customWinners.length > 0 && (
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
                🎉 WINNERS! 🎉
              </motion.h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {customWinners.map((winner, index) => {
                  const position = customWinnerCount - index // Descending order
                  const prize = customPrizes.find(p => p.position === position)
                  
                  return (
                    <motion.div
                      key={winner.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: index * 0.2 }}
                      className="text-2xl md:text-3xl font-bold bg-white bg-opacity-20 rounded-lg p-4 relative"
                    >
                      <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                        {position}
                      </div>
                      <div className="text-center">
                        <div className="mb-2">{winner.name}</div>
                        {prize && (
                          <div className="text-sm opacity-80">
                            🎁 {prize.title}
                            {prize.description && (
                              <div className="text-xs mt-1">{prize.description}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Buttons */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
        {!isDrawing && !winner && !isCustomDrawing && customWinners.length === 0 && (
          <button
            onClick={startDraw}
            className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-xl hover:bg-gray-100 transition-colors"
          >
            Start {drawType === 'table' ? 'Table' : drawType === 'custom' ? 'Custom' : 'Regular'} Draw
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
        {customWinners.length > 0 && !isCustomDrawing && (
          <>
            <button
              onClick={confirmCustomWinners}
              className="bg-green-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-green-700 transition-colors"
            >
              Confirm Winners
            </button>
            {currentCustomWinnerIndex + 1 < customWinnerCount && (
              <button
                onClick={continueCustomDraw}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-blue-700 transition-colors"
              >
                Continue Drawing
              </button>
            )}
            <button
              onClick={startDraw}
              className="bg-purple-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-purple-700 transition-colors"
            >
              Draw Again
            </button>
          </>
        )}
        <button
          onClick={resetDraw}
          className="bg-gray-600 text-white px-6 py-4 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  )
} 