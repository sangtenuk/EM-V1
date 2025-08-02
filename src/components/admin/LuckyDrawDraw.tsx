import { useState, useEffect } from 'react'
import { Gift, Play, RotateCcw, Users, Trophy, Sparkles, Table, Target, Download, BarChart, CheckCircle } from 'lucide-react'
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

interface LuckyDrawWinner {
  id: string
  event_id: string
  attendee_id?: string
  winner_name: string
  winner_company?: string
  table_number?: number
  is_table_winner: boolean
  table_type?: string
  prize_id?: string
  prize_title?: string
  prize_description?: string
  prize_position?: number
  draw_type: 'regular' | 'table' | 'custom'
  draw_session_id: string
  created_at: string
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
  const [selectedTableTypes, setSelectedTableTypes] = useState<string[]>([])
  const [customWinnerCount, setCustomWinnerCount] = useState<number>(5)
  const [customPrizes, setCustomPrizes] = useState<CustomPrize[]>([])
  const [isCustomDrawing, setIsCustomDrawing] = useState(false)
  const [customWinners, setCustomWinners] = useState<Attendee[]>([])
  const [currentCustomWinnerIndex, setCurrentCustomWinnerIndex] = useState<number>(0)
  
  // Modified custom draw state
  const [currentPrize, setCurrentPrize] = useState<CustomPrize | null>(null)
  const [showPrizeFirst, setShowPrizeFirst] = useState(false)
  const [drawSessionId, setDrawSessionId] = useState<string>('')
  const [savedWinners, setSavedWinners] = useState<LuckyDrawWinner[]>([])
  const [isSavingWinner, setIsSavingWinner] = useState(false)
  const [showAllWinners, setShowAllWinners] = useState(false)
  const [prizeDelay, setPrizeDelay] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchAttendees()
      fetchCustomPrizes()
      fetchSavedWinners()
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

  const fetchSavedWinners = async () => {
    try {
      const { data, error } = await supabase
        .from('lucky_draw_winners')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching saved winners:', error)
        // If table doesn't exist yet, just set empty array
        if (error.code === '42P01') { // Table doesn't exist
          console.warn('Lucky draw winners table does not exist yet. Please run the migration.')
          setSavedWinners([])
          return
        }
        throw error
      }
      setSavedWinners(data || [])
    } catch (error: any) {
      console.error('Error fetching saved winners:', error)
      setSavedWinners([])
      }
    }

  const getEligibleAttendees = () => {
    // Filter out attendees with empty or null IDs
    let eligible = attendees.filter(
      attendee => attendee.id && attendee.id.trim() !== '' && 
      !previousWinners.find(winner => winner.id === attendee.id)
    )

    // Filter by table if table draw is selected
    if (drawType === 'table' && selectedTable) {
      eligible = eligible.filter(attendee => attendee.table_number === selectedTable)
    }

    return eligible
  }

  const getUniqueTableTypes = () => {
    const types = [...new Set(tables.map(table => table.table_type))]
    return types.sort()
  }

  const getFilteredTables = () => {
    if (selectedTableTypes.length === 0) {
      return tables
    }
    return tables.filter(table => selectedTableTypes.includes(table.table_type))
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
    // Get filtered tables that haven't been won yet
    const availableTables = getFilteredTables().filter(table => 
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

    // Generate new session ID for this draw
    setDrawSessionId(crypto.randomUUID())
    setShowAllWinners(false)
    
    // Start with 5-second delay before showing prize
    setPrizeDelay(true)
    setShowPrizeFirst(false)
    setCurrentPrize(null)
    
    setTimeout(() => {
      // Show the first prize after 5 seconds
      const position = customWinnerCount - currentCustomWinnerIndex
      const prize = customPrizes.find(p => p.position === position)
      
      if (prize) {
        setCurrentPrize(prize)
        setShowPrizeFirst(true)
        setPrizeDelay(false)
        setIsCustomDrawing(false)
      } else {
        toast.error('No prize found for this position')
        setPrizeDelay(false)
      }
    }, 5000)
  }

  const startDrawingAfterPrize = () => {
    const eligibleAttendees = getEligibleAttendees()
    const position = customWinnerCount - currentCustomWinnerIndex
    
    if (eligibleAttendees.length === 0) {
      setIsCustomDrawing(false)
      setCurrentCustomWinnerIndex(0)
      setShowPrizeFirst(false)
      setCurrentPrize(null)
      toast.error('No more eligible attendees available')
      return
    }
    
    setIsCustomDrawing(true)
    setShowPrizeFirst(false)
    
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
        if (currentPrize) {
          toast.success(`🎉 ${finalWinner.name} wins ${currentPrize.title}!`)
        } else {
          toast.success(`🎉 ${finalWinner.name} wins!`)
        }
        
        // Stop here and wait for confirmation
        setIsCustomDrawing(false)
      }
    }, 100)
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

  const confirmWinner = async () => {
    if (winner) {
      setIsSavingWinner(true)
      
      // For custom draws, get the current prize
      let prize: CustomPrize | undefined
      if (drawType === 'custom' && currentPrize) {
        prize = currentPrize
      }
      
      // Save winner to database
      const success = await saveWinnerToDatabase(winner, prize)
      
      if (success) {
        setPreviousWinners(prev => [...prev, winner])
        
        // Show success message first
        toast.success('Winner saved successfully!')
        
        // For custom draws, move to next prize after a short delay
        if (drawType === 'custom' && currentCustomWinnerIndex + 1 < customWinnerCount) {
          setTimeout(() => {
            setWinner(null)
            setCurrentName('')
            setSelectedTable(null)
            setIsSavingWinner(false)
            continueCustomDraw()
          }, 2000) // Show winner for 2 seconds before moving to next prize
        } else if (drawType === 'custom' && currentCustomWinnerIndex + 1 >= customWinnerCount) {
          // All prizes drawn - show final winners display
          setTimeout(() => {
            setWinner(null)
            setCurrentName('')
            setSelectedTable(null)
            setIsSavingWinner(false)
            setShowAllWinners(true)
          }, 2000)
        } else {
          // For regular draws, clear immediately
          setWinner(null)
          setCurrentName('')
          setSelectedTable(null)
          setIsSavingWinner(false)
        }
        
        // Refresh saved winners
        await fetchSavedWinners()
      } else {
        setIsSavingWinner(false)
      }
    }
  }

  const saveWinnerToDatabase = async (winner: Attendee, prize?: CustomPrize) => {
    try {
      if (!selectedEventId) {
        throw new Error('No event selected')
      }

      // Handle table winners differently - don't set attendee_id for table winners
      const isTableWinner = winner.id?.startsWith('table-')
      
      const winnerData = {
        event_id: selectedEventId,
        attendee_id: isTableWinner ? null : winner.id, // Set to null for table winners
        winner_name: winner.name || 'Unknown Winner', // Ensure winner name is always saved
        winner_company: winner.company,
        table_number: winner.table_number,
        is_table_winner: isTableWinner,
        table_type: isTableWinner ? 'Table' : undefined,
        prize_id: prize?.id,
        prize_title: prize?.title,
        prize_description: prize?.description,
        prize_position: prize?.position,
        draw_type: drawType,
        draw_session_id: drawSessionId || crypto.randomUUID()
      }

      console.log('Saving winner data:', winnerData)
      console.log('Winner name to save:', winnerData.winner_name)
      console.log('Is table winner:', isTableWinner)
      console.log('Prize data being saved:', {
        prize_id: winnerData.prize_id,
        prize_title: winnerData.prize_title,
        prize_description: winnerData.prize_description,
        prize_position: winnerData.prize_position
      })

      const { data, error } = await supabase
        .from('lucky_draw_winners')
        .insert([winnerData])
        .select()

      if (error) {
        console.error('Supabase error:', error)
        // If table doesn't exist yet, just return true to avoid blocking the UI
        if (error.code === '42P01') { // Table doesn't exist
          console.warn('Lucky draw winners table does not exist yet')
          return true
        }
        throw error
      }

      console.log('Winner saved successfully:', data)
      console.log('Saved winner name:', data?.[0]?.winner_name)
      return true
    } catch (error: any) {
      console.error('Error saving winner:', error)
      toast.error('Error saving winner: ' + (error.message || 'Unknown error'))
      return false
    }
  }

  const confirmCustomWinners = async () => {
    if (customWinners.length > 0) {
      // Save all winners to database
      const savePromises = customWinners.map((winner, index) => {
        const position = customWinnerCount - index
        const prize = customPrizes.find(p => p.position === position)
        return saveWinnerToDatabase(winner, prize)
      })

      const results = await Promise.all(savePromises)
      
      if (results.every(result => result)) {
        setPreviousWinners(prev => [...prev, ...customWinners])
        setCustomWinners([])
        setCurrentCustomWinnerIndex(0)
        setCurrentName('')
        
        // Move to next prize if there are more to draw
        if (currentCustomWinnerIndex + 1 < customWinnerCount) {
          continueCustomDraw()
        } else {
          // All prizes drawn
          setCurrentPrize(null)
          setShowPrizeFirst(false)
          toast.success('All winners saved successfully!')
        }
        
        // Refresh saved winners
        await fetchSavedWinners()
      }
    }
  }

  const continueCustomDraw = () => {
    if (currentCustomWinnerIndex + 1 < customWinnerCount) {
      setCurrentCustomWinnerIndex(currentCustomWinnerIndex + 1)
      setCurrentName('')
      
      // Show the next prize
      const position = customWinnerCount - (currentCustomWinnerIndex + 1)
      const prize = customPrizes.find(p => p.position === position)
      
      if (prize) {
        setCurrentPrize(prize)
        setShowPrizeFirst(true)
        // Don't reset isCustomDrawing - it will be set when drawing starts
      } else {
        toast.error('No prize found for this position')
      }
    } else {
      // All winners drawn
      setCurrentName('')
      setCurrentCustomWinnerIndex(0)
      setCurrentPrize(null)
      setShowPrizeFirst(false)
      setShowAllWinners(true)
      toast.success(`🎉 All ${customWinnerCount} winners selected with prizes!`)
    }
  }

  const drawAgain = () => {
    // Skip current winner and draw again
    setWinner(null)
    setCurrentName('')
    setSelectedTable(null)
    setIsCustomDrawing(true)
    startDrawingAfterPrize()
  }

  const resetDraw = () => {
    setWinner(null)
    setCurrentName('')
    setIsDrawing(false)
    
    // Reset winners based on current draw type
    if (drawType === 'table') {
      // For table draws, only clear table winners
      setPreviousWinners(prev => prev.filter(w => !w.id?.startsWith('table-')))
    } else if (drawType === 'custom') {
      // For custom draws, only clear custom winners (non-table winners)
      setPreviousWinners(prev => prev.filter(w => w.id?.startsWith('table-')))
      setCustomWinners([])
      setCurrentCustomWinnerIndex(0)
    } else {
      // For regular draws, only clear regular winners (non-table winners)
      setPreviousWinners(prev => prev.filter(w => w.id?.startsWith('table-')))
    }
    
    setIsCustomDrawing(false)
    setSelectedTable(null)
    setCurrentPrize(null)
    setShowPrizeFirst(false)
    setDrawSessionId('')
    setIsSavingWinner(false)
    setShowAllWinners(false)
    setPrizeDelay(false)
    setSelectedTableTypes([])
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

  const generateLuckyDrawReport = (winners: LuckyDrawWinner[], event: Event | undefined, attendees: Attendee[]) => {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    let csvContent = ''
    
    // PAGE 1: WINNERS REPORT
    csvContent += '🎉 LUCKY DRAW WINNERS REPORT\n'
    csvContent += '='.repeat(80) + '\n'
    csvContent += `📅 Report Generated: ${currentDate}\n`
    csvContent += `🎯 Event: ${event?.name || 'N/A'}\n`
    csvContent += `🏢 Company: ${event?.company?.name || 'N/A'}\n`
    csvContent += `📊 Total Winners: ${winners.length}\n`
    csvContent += `👥 Total Attendees: ${attendees.length}\n`
    csvContent += '='.repeat(80) + '\n\n'
    
    // Event Overview Section
    csvContent += '📊 EVENT OVERVIEW\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += `Event Name,${event?.name || 'N/A'}\n`
    csvContent += `Company,${event?.company?.name || 'N/A'}\n`
    csvContent += `Total Attendees,${attendees.length}\n`
    csvContent += `Total Winners,${winners.length}\n`
    csvContent += `Win Rate,${attendees.length > 0 ? Math.round((winners.length / attendees.length) * 100) : 0}%\n`
    csvContent += `Regular Winners,${winners.filter(w => w.draw_type === 'regular').length}\n`
    csvContent += `Table Winners,${winners.filter(w => w.draw_type === 'table').length}\n`
    csvContent += `Custom Winners,${winners.filter(w => w.draw_type === 'custom').length}\n`
    csvContent += '\n'
    
    // Winners Summary by Type with Chart Data
    csvContent += '🏆 WINNERS SUMMARY BY TYPE\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Draw Type,Count,Percentage,Chart Data\n'
    
    const regularCount = winners.filter(w => w.draw_type === 'regular').length
    const tableCount = winners.filter(w => w.draw_type === 'table').length
    const customCount = winners.filter(w => w.draw_type === 'custom').length
    const total = winners.length
    
    csvContent += `Regular Draw,${regularCount},${total > 0 ? Math.round((regularCount / total) * 100) : 0}%,${regularCount}\n`
    csvContent += `Table Draw,${tableCount},${total > 0 ? Math.round((tableCount / total) * 100) : 0}%,${tableCount}\n`
    csvContent += `Custom Draw,${customCount},${total > 0 ? Math.round((customCount / total) * 100) : 0}%,${customCount}\n`
    csvContent += '\n'
    
    // Detailed Winners List
    if (winners.length > 0) {
      csvContent += '👥 DETAILED WINNERS LIST\n'
      csvContent += '-'.repeat(40) + '\n'
      csvContent += 'Position,Draw Type,Winner Name,Company,Table Number,Prize,Draw Session,Date\n'
      
      winners.forEach((winner, index) => {
        const position = winner.prize_position || index + 1
        const drawType = winner.draw_type.charAt(0).toUpperCase() + winner.draw_type.slice(1)
        const winnerName = winner.winner_name || 'N/A'
        const company = winner.winner_company || 'N/A'
        const tableNumber = winner.table_number ? `Table ${winner.table_number}` : 'N/A'
        const prize = winner.prize_title || 'N/A'
        const session = winner.draw_session_id ? winner.draw_session_id.slice(0, 8) : 'N/A'
        const date = new Date(winner.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        csvContent += `${position},${drawType},${winnerName},${company},${tableNumber},${prize},${session},${date}\n`
      })
      csvContent += '\n'
    }
    
    // Prize Distribution with Chart Data
    const prizes = winners.filter(w => w.prize_title).map(w => w.prize_title)
    if (prizes.length > 0) {
      csvContent += '🎁 PRIZE DISTRIBUTION\n'
      csvContent += '-'.repeat(40) + '\n'
      csvContent += 'Prize,Count,Percentage,Chart Data\n'
      
      const prizeCounts: { [key: string]: number } = {}
      prizes.forEach(prize => {
        if (prize) {
          prizeCounts[prize] = (prizeCounts[prize] || 0) + 1
        }
      })
      
      Object.entries(prizeCounts).forEach(([prize, count]) => {
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0
        csvContent += `${prize},${count},${percentage}%,${count}\n`
      })
      csvContent += '\n'
    }
    
    // Table Winners Analysis
    const tableWinners = winners.filter(w => w.draw_type === 'table')
    if (tableWinners.length > 0) {
      csvContent += '🪑 TABLE WINNERS ANALYSIS\n'
      csvContent += '-'.repeat(40) + '\n'
      csvContent += 'Table Number,Table Type,Draw Date,Chart Data\n'
      
      tableWinners.forEach(winner => {
        const tableNumber = winner.table_number || 'N/A'
        const tableType = winner.table_type || 'Regular'
        const date = new Date(winner.created_at).toLocaleDateString()
        csvContent += `${tableNumber},${tableType},${date},1\n`
      })
      csvContent += '\n'
    }
    
    // Custom Draw Sessions Analysis
    const customSessions = [...new Set(winners.filter(w => w.draw_type === 'custom').map(w => w.draw_session_id))]
    if (customSessions.length > 0) {
      csvContent += '🎯 CUSTOM DRAW SESSIONS\n'
      csvContent += '-'.repeat(40) + '\n'
      csvContent += 'Session ID,Winners Count,Session Date,Chart Data\n'
      
      customSessions.forEach(sessionId => {
        const sessionWinners = winners.filter(w => w.draw_session_id === sessionId)
        const date = sessionWinners.length > 0 ? new Date(sessionWinners[0].created_at).toLocaleDateString() : 'N/A'
        csvContent += `${sessionId.slice(0, 8)},${sessionWinners.length},${date},${sessionWinners.length}\n`
      })
      csvContent += '\n'
    }
    
    // Data Visualization Instructions
    csvContent += '📈 DATA VISUALIZATION GUIDE\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Chart Type,Data Range,Instructions\n'
    csvContent += 'Pie Chart,Winners Summary by Type,Use "Chart Data" column for pie chart\n'
    csvContent += 'Bar Chart,Prize Distribution,Use "Count" column for bar chart\n'
    csvContent += 'Line Chart,Custom Draw Sessions,Use "Winners Count" for trend analysis\n'
    csvContent += 'Doughnut Chart,Table Winners,Use "Chart Data" column\n'
    csvContent += '\n'
    
    // Footer
    csvContent += '='.repeat(80) + '\n'
    csvContent += '📋 REPORT SUMMARY\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += `• Total Winners: ${winners.length}\n`
    csvContent += `• Total Attendees: ${attendees.length}\n`
    csvContent += `• Win Rate: ${attendees.length > 0 ? Math.round((winners.length / attendees.length) * 100) : 0}%\n`
    csvContent += `• Report Type: Lucky Draw Winners Report\n`
    csvContent += `• Generated By: Event Management System\n`
    csvContent += `• Format: CSV (Comma Separated Values)\n`
    csvContent += `• Export Date: ${currentDate}\n`
    csvContent += '='.repeat(80) + '\n\n'
    
    // PAGE 2: ATTENDEE LIST
    csvContent += '👥 ATTENDEE LIST - PAGE 2\n'
    csvContent += '='.repeat(80) + '\n'
    csvContent += `📅 Report Generated: ${currentDate}\n`
    csvContent += `🎯 Event: ${event?.name || 'N/A'}\n`
    csvContent += `📊 Total Attendees: ${attendees.length}\n`
    csvContent += '='.repeat(80) + '\n\n'
    
    // Attendee Overview
    csvContent += '📊 ATTENDEE OVERVIEW\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += `Total Attendees,${attendees.length}\n`
    csvContent += `Attendees with Company,${attendees.filter(a => a.company).length}\n`
    csvContent += `Attendees with Table,${attendees.filter(a => a.table_number).length}\n`
    csvContent += `Winners,${winners.length}\n`
    csvContent += `Non-Winners,${attendees.length - winners.length}\n`
    csvContent += '\n'
    
    // Company Distribution
    const companyCounts: { [key: string]: number } = {}
    attendees.forEach(attendee => {
      const company = attendee.company || 'No Company'
      companyCounts[company] = (companyCounts[company] || 0) + 1
    })
    
    csvContent += '🏢 COMPANY DISTRIBUTION\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Company,Count,Percentage,Chart Data\n'
    
    Object.entries(companyCounts).forEach(([company, count]) => {
      const percentage = attendees.length > 0 ? Math.round((count / attendees.length) * 100) : 0
      csvContent += `${company},${count},${percentage}%,${count}\n`
    })
    csvContent += '\n'
    
    // Table Distribution
    const tableCounts: { [key: number]: number } = {}
    attendees.forEach(attendee => {
      if (attendee.table_number) {
        tableCounts[attendee.table_number] = (tableCounts[attendee.table_number] || 0) + 1
      }
    })
    
    csvContent += '🪑 TABLE DISTRIBUTION\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Table Number,Attendee Count,Chart Data\n'
    
    Object.entries(tableCounts).forEach(([tableNum, count]) => {
      csvContent += `Table ${tableNum},${count},${count}\n`
    })
    csvContent += '\n'
    
    // Detailed Attendee List
    csvContent += '👥 DETAILED ATTENDEE LIST\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Name,Company,Table Number,Winner Status,Prize Won\n'
    
    attendees.forEach(attendee => {
      const winner = winners.find(w => w.attendee_id === attendee.id)
      const winnerStatus = winner ? 'Winner' : 'Non-Winner'
      const prizeWon = winner?.prize_title || 'N/A'
      
      csvContent += `${attendee.name},${attendee.company || 'N/A'},${attendee.table_number ? `Table ${attendee.table_number}` : 'N/A'},${winnerStatus},${prizeWon}\n`
    })
    csvContent += '\n'
    
    // Winner vs Non-Winner Analysis
    csvContent += '🏆 WINNER ANALYSIS\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Category,Count,Percentage,Chart Data\n'
    csvContent += `Winners,${winners.length},${attendees.length > 0 ? Math.round((winners.length / attendees.length) * 100) : 0}%,${winners.length}\n`
    csvContent += `Non-Winners,${attendees.length - winners.length},${attendees.length > 0 ? Math.round(((attendees.length - winners.length) / attendees.length) * 100) : 0}%,${attendees.length - winners.length}\n`
    csvContent += '\n'
    
    // Data Visualization Instructions for Page 2
    csvContent += '📈 PAGE 2 VISUALIZATION GUIDE\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += 'Chart Type,Data Range,Instructions\n'
    csvContent += 'Pie Chart,Company Distribution,Use "Chart Data" column\n'
    csvContent += 'Bar Chart,Table Distribution,Use "Attendee Count" column\n'
    csvContent += 'Doughnut Chart,Winner Analysis,Use "Chart Data" column\n'
    csvContent += 'Scatter Plot,Table vs Winners,Cross-reference table and winner data\n'
    csvContent += '\n'
    
    // Footer for Page 2
    csvContent += '='.repeat(80) + '\n'
    csvContent += '📋 PAGE 2 SUMMARY\n'
    csvContent += '-'.repeat(40) + '\n'
    csvContent += `• Total Attendees: ${attendees.length}\n`
    csvContent += `• Companies Represented: ${Object.keys(companyCounts).length}\n`
    csvContent += `• Tables Used: ${Object.keys(tableCounts).length}\n`
    csvContent += `• Winners: ${winners.length}\n`
    csvContent += `• Non-Winners: ${attendees.length - winners.length}\n`
    csvContent += `• Page: 2 of 2 (Attendee List)\n`
    csvContent += '='.repeat(80) + '\n'
    
    return csvContent
  }

  const exportLuckyDrawReport = async () => {
    try {
      if (!selectedEventId) {
        toast.error('Please select an event first')
        return
      }

      if (savedWinners.length === 0) {
        toast.error('No winners to export')
        return
      }

      const selectedEvent = events.find(e => e.id === selectedEventId)
      const csvContent = generateLuckyDrawReport(savedWinners, selectedEvent, attendees)
      
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lucky-draw-complete-report-${selectedEvent?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'event'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Complete lucky draw report exported successfully!')
    } catch (error: any) {
      toast.error('Error exporting report: ' + error.message)
    }
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

      {/* Configuration Panel */}
      <div className="absolute top-8 left-8 bg-white bg-opacity-90 rounded-lg p-4 max-w-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Draw Configuration</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select Event</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Draw Type</label>
            <select
              value={drawType}
              onChange={(e) => setDrawType(e.target.value as DrawType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="regular">Regular Draw</option>
              <option value="table">Table Draw</option>
              <option value="custom">Custom Draw</option>
            </select>
          </div>
          
          {drawType === 'table' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Tables</label>
              <div className="text-xs text-gray-600">
                {tables.length} tables available
              </div>
            </div>
          )}
          
          {drawType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Winners</label>
              <input
                type="number"
                min="1"
                max="20"
                value={customWinnerCount}
                onChange={(e) => setCustomWinnerCount(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}
          
          <div className="text-xs text-gray-600">
            <div>Eligible Attendees: {getEligibleAttendees().length}</div>
            <div>Previous Winners: {previousWinners.length}</div>
          </div>
        </div>
      </div>

      <div className="text-center text-white z-10">
        <AnimatePresence mode="wait">
          {!isDrawing && !winner && !isCustomDrawing && customWinners.length === 0 && !showPrizeFirst && (
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

          {prizeDelay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="space-y-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-32 w-32 mx-auto mb-8" />
              </motion.div>
              <h1 className="text-6xl md:text-8xl font-bold mb-4">Preparing Prize</h1>
              <div className="text-2xl md:text-3xl opacity-80">
                Loading prize information...
              </div>
            </motion.div>
          )}

          {showPrizeFirst && currentPrize && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="space-y-8"
            >
              <Trophy className="h-32 w-32 mx-auto mb-8 text-yellow-300" />
              <h1 className="text-6xl md:text-8xl font-bold mb-4">Prize #{currentPrize.position}</h1>
              <div className="text-4xl md:text-6xl font-bold bg-white bg-opacity-20 rounded-lg p-8">
                {currentPrize.title}
              </div>
              {currentPrize.description && (
                <div className="text-2xl md:text-3xl opacity-80">
                  {currentPrize.description}
                </div>
              )}
              <div className="text-xl md:text-2xl opacity-80">
                Position #{currentPrize.position} • {customWinnerCount - currentCustomWinnerIndex} of {customWinnerCount} winners
              </div>
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
                key={`drawing-${Date.now()}-${currentName}`}
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
              {isSavingWinner && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Saving winner...</span>
                </motion.div>
              )}
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
                className="text-6xl md:text-8xl lg:text-9xl font-bold bg-white bg-opacity-20 rounded-lg p-12"
              >
                {winner.name}
              </motion.div>
              
              {/* Draw type indicator */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xl md:text-2xl opacity-80"
              >
                {drawType === 'custom' ? 'Custom Draw' : 
                 drawType === 'table' ? 'Table Draw' : 
                 'Regular Draw'}
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
              
              {/* Show prize information for custom draws */}
              {drawType === 'custom' && currentPrize && !winner.id?.startsWith('table-') && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-2xl md:text-3xl opacity-80 bg-yellow-500 bg-opacity-20 rounded-lg p-4"
                >
                  🎁 {currentPrize.title}
                  {currentPrize.description && (
                    <div className="text-lg opacity-80 mt-2">
                      {currentPrize.description}
                    </div>
                  )}
                  <div className="text-lg opacity-80 mt-1">
                    Position #{currentPrize.position}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {showAllWinners && previousWinners.length > 0 && (
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
                🎉 ALL WINNERS! 🎉
              </motion.h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {previousWinners.map((winner, index) => {
                  const position = index + 1
                  const prize = customPrizes.find(p => p.position === position)
                  
                  return (
                                            <motion.div
                          key={winner.id || `winner-${index}-${Date.now()}`}
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: index * 0.2 }}
                          className="text-2xl md:text-3xl font-bold bg-white bg-opacity-20 rounded-lg p-6 relative"
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

          {customWinners.length > 0 && !showAllWinners && (
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
                      className="text-3xl md:text-4xl lg:text-5xl font-bold bg-white bg-opacity-20 rounded-lg p-6 relative"
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

      {/* Saved Winners Display */}
      {savedWinners.length > 0 && (
        <div className="absolute top-8 right-8 bg-white bg-opacity-90 rounded-lg p-4 max-w-md max-h-96 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
            Saved Winners ({savedWinners.length})
          </h3>
          <div className="space-y-2">
            {savedWinners.slice(0, 10).map((winner, index) => (
              <div key={winner.id} className="text-sm bg-gray-50 rounded p-2">
                <div className="font-semibold text-gray-800">
                  {winner.winner_name}
                </div>
                <div className="text-gray-600 text-xs">
                  {winner.winner_company && `${winner.winner_company} • `}
                  {winner.prize_title && `🎁 ${winner.prize_title} • `}
                  {winner.draw_type.charAt(0).toUpperCase() + winner.draw_type.slice(1)}
                </div>
              </div>
            ))}
            {savedWinners.length > 10 && (
              <div className="text-xs text-gray-500 text-center">
                +{savedWinners.length - 10} more winners
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Analysis Charts */}
      {savedWinners.length > 0 && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 rounded-lg p-4 max-w-2xl">
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                            <BarChart className="h-5 w-5 mr-2 text-blue-500" />
            Data Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Winners by Type</div>
              <div className="space-y-1">
                {(() => {
                  const regularCount = savedWinners.filter(w => w.draw_type === 'regular').length
                  const tableCount = savedWinners.filter(w => w.draw_type === 'table').length
                  const customCount = savedWinners.filter(w => w.draw_type === 'custom').length
                  const total = savedWinners.length
                  
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>Regular: {regularCount}</span>
                        <span className="text-blue-600 font-semibold">
                          {total > 0 ? Math.round((regularCount / total) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Table: {tableCount}</span>
                        <span className="text-green-600 font-semibold">
                          {total > 0 ? Math.round((tableCount / total) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Custom: {customCount}</span>
                        <span className="text-purple-600 font-semibold">
                          {total > 0 ? Math.round((customCount / total) * 100) : 0}%
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-semibold text-gray-700">Win Rate</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Winners: {savedWinners.length}</span>
                  <span className="text-green-600 font-semibold">
                    {attendees.length > 0 ? Math.round((savedWinners.length / attendees.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Non-Winners: {attendees.length - savedWinners.length}</span>
                  <span className="text-gray-600">
                    {attendees.length > 0 ? Math.round(((attendees.length - savedWinners.length) / attendees.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-600">
            💡 Export CSV for detailed charts and graphs in Excel
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4">
        {!isDrawing && !winner && !isCustomDrawing && customWinners.length === 0 && !showPrizeFirst && (
          <button
            onClick={startDraw}
            className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-xl hover:bg-gray-100 transition-colors"
          >
            Start {drawType === 'table' ? 'Table' : drawType === 'custom' ? 'Custom' : 'Regular'} Draw
          </button>
        )}
        
                  {showPrizeFirst && currentPrize && (
            <button
              onClick={startDrawingAfterPrize}
              className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-xl hover:bg-gray-100 transition-colors"
            >
              Draw
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
                onClick={drawAgain}
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
        {savedWinners.length > 0 && (
          <button
            onClick={exportLuckyDrawReport}
            className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export Report
          </button>
        )}
      </div>
    </div>
  )
} 