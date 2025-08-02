import { useState, useEffect, useCallback } from 'react'
import { Gift, Play, RotateCcw, Users, Trophy, Sparkles, Table, Target, CheckCircle } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
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

interface LuckyDrawProps {
  userCompany?: any
}

type DrawType = 'table' | 'custom' | 'regular'

export default function LuckyDraw({ userCompany }: LuckyDrawProps) {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [winner, setWinner] = useState<Attendee | null>(null)
  const [previousWinners, setPreviousWinners] = useState<Attendee[]>([])
  const [currentName, setCurrentName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
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
  
  // Prize management
  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [editingPrize, setEditingPrize] = useState<Partial<CustomPrize> | null>(null)
  
  // Modified custom draw state
  const [currentPrize, setCurrentPrize] = useState<CustomPrize | null>(null)
  const [showPrizeFirst, setShowPrizeFirst] = useState(false)
  const [drawSessionId, setDrawSessionId] = useState<string>('')
  const [savedWinners, setSavedWinners] = useState<LuckyDrawWinner[]>([])
  const [isSavingWinner, setIsSavingWinner] = useState(false)
  const [showAllWinners, setShowAllWinners] = useState(false)
  const [prizeDelay, setPrizeDelay] = useState(false)
  const [isFirstCustomDraw, setIsFirstCustomDraw] = useState(true)
  const [forceUpdate, setForceUpdate] = useState(0)

  useEffect(() => {
    fetchEvents()
  }, [])

  // Handle eventId from URL parameters
  useEffect(() => {
    const eventIdFromUrl = searchParams.get('eventId')
    if (eventIdFromUrl && events.length > 0) {
      setSelectedEventId(eventIdFromUrl)
    }
  }, [searchParams, events])

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
      // Reset the first draw flag when starting a new custom draw session
      setIsFirstCustomDraw(true)
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
    
    // Show the current prize first
    const position = customWinnerCount - currentCustomWinnerIndex
    const prize = customPrizes.find(p => p.position === position)
    
    if (prize) {
      setCurrentPrize(prize)
      setShowPrizeFirst(true)
      setPrizeDelay(false)
      setIsCustomDrawing(false)
    } else {
      toast.error('No prize found for this position')
    }
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
    // Clear current name at the start of drawing
    setCurrentName('')
    
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
            // Move to next prize
            setCurrentCustomWinnerIndex(currentCustomWinnerIndex + 1)
            const nextPosition = customWinnerCount - (currentCustomWinnerIndex + 1)
            const nextPrize = customPrizes.find(p => p.position === nextPosition)
            if (nextPrize) {
              setCurrentPrize(nextPrize)
              setShowPrizeFirst(true)
            }
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
    // Skip current winner and draw again for the same prize
    setWinner(null)
    setCurrentName('')
    setSelectedTable(null)
    setIsCustomDrawing(true)
    
    // For custom draws, remove the last winner from both lists and redraw the same prize
    if (drawType === 'custom') {
      // Remove the last winner from customWinners list and force immediate update
      setCustomWinners(prev => {
        const newList = prev.slice(0, -1)
        console.log('Removed last winner, new list:', newList.map(w => w.name))
        return newList
      })
      // Remove the last winner from previousWinners list (only custom winners)
      setPreviousWinners(prev => {
        const nonTableWinners = prev.filter(w => !w.id?.startsWith('table-'))
        const tableWinners = prev.filter(w => w.id?.startsWith('table-'))
        const newList = [...tableWinners, ...nonTableWinners.slice(0, -1)]
        console.log('Updated previousWinners:', newList.map(w => w.name))
        return newList
      })
      // Clear any remaining winner state
      setWinner(null)
      setCurrentName('')
      setIsSavingWinner(false)
      // Force UI update
      setForceUpdate(prev => prev + 1)
      // Clear current name and start drawing with a small delay to ensure UI updates
      setTimeout(() => {
        setCurrentName('')
        startDrawingAfterPrize()
      }, 50)
    } else {
      // For regular and table draws, just redraw without removing from lists
      startDrawingAfterPrize()
    }
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
      setCurrentPrize(null)
      setShowPrizeFirst(false)
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
    setIsFirstCustomDraw(true)
  }

  const resetWinners = async () => {
    // Clear all winners (both session and saved)
    setPreviousWinners([])
    setCustomWinners([])
    setCurrentCustomWinnerIndex(0)
    setWinner(null)
    setCurrentName('')
    
    // Clear saved winners from database
    try {
      if (selectedEventId) {
        const { error } = await supabase
          .from('lucky_draw_winners')
          .delete()
          .eq('event_id', selectedEventId)
        
        if (error) {
          console.error('Error clearing saved winners:', error)
          toast.error('Error clearing saved winners')
        } else {
          setSavedWinners([])
          toast.success('All winners cleared successfully!')
        }
      }
    } catch (error: any) {
      console.error('Error clearing winners:', error)
      toast.error('Error clearing winners: ' + error.message)
    }
  }

  const resetEverything = async () => {
    // Reset all state to default
    setWinner(null)
    setCurrentName('')
    setIsDrawing(false)
    setPreviousWinners([])
    setCustomWinners([])
    setIsCustomDrawing(false)
    setCurrentCustomWinnerIndex(0)
    setSelectedTable(null)
    setCurrentPrize(null)
    setShowPrizeFirst(false)
    setDrawSessionId('')
    setIsSavingWinner(false)
    setShowAllWinners(false)
    setPrizeDelay(false)
    setSelectedTableTypes([])
    setIsFirstCustomDraw(true)
    setDrawType('regular')
    setCustomWinnerCount(5)
    setCurrentPrize(null)
    setShowPrizeFirst(false)
    
    // Clear saved winners from database
    try {
      if (selectedEventId) {
        const { error } = await supabase
          .from('lucky_draw_winners')
          .delete()
          .eq('event_id', selectedEventId)
        
        if (error) {
          console.error('Error clearing saved winners:', error)
        } else {
          setSavedWinners([])
        }
      }
    } catch (error: any) {
      console.error('Error clearing winners:', error)
    }
    
    // Clear custom prizes
    try {
      if (selectedEventId) {
        const { error } = await supabase
          .from('custom_prizes')
          .delete()
          .eq('event_id', selectedEventId)
        
        if (error) {
          console.error('Error clearing prizes:', error)
        } else {
          setCustomPrizes([])
        }
      }
    } catch (error: any) {
      console.error('Error clearing prizes:', error)
    }
    
    toast.success('Everything reset to default!')
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  const saveCustomPrize = async (prize: Partial<CustomPrize>) => {
    try {
      // Clean the prize object - remove empty strings and undefined values
      const cleanPrize = Object.fromEntries(
        Object.entries(prize).filter(([_, value]) => 
          value !== undefined && value !== null && value !== ''
        )
      ) as Partial<CustomPrize>

      if (editingPrize?.id) {
        // Update existing prize
        const { error } = await supabase
          .from('custom_prizes')
          .update(cleanPrize)
          .eq('id', editingPrize.id)
        
        if (error) throw error
        toast.success('Prize updated!')
      } else {
        // Create new prize - ensure we don't include id field for new prizes
        const { id, ...prizeWithoutId } = cleanPrize
        const { error } = await supabase
          .from('custom_prizes')
          .insert([{ ...prizeWithoutId, event_id: selectedEventId }])
        
        if (error) throw error
        toast.success('Prize created!')
      }
      
      // Clear editing state first
      setShowPrizeModal(false)
      setEditingPrize(null)
      
      // Then fetch updated data
      await fetchCustomPrizes()
    } catch (error: any) {
      console.error('Error saving prize:', error)
      toast.error('Error saving prize: ' + error.message)
    }
  }

  const deleteCustomPrize = async (prizeId: string) => {
    try {
      const { error } = await supabase
        .from('custom_prizes')
        .delete()
        .eq('id', prizeId)
      
      if (error) throw error
      toast.success('Prize deleted!')
      fetchCustomPrizes()
    } catch (error: any) {
      toast.error('Error deleting prize: ' + error.message)
    }
  }

  // Custom Prize Modal - Separate Component to prevent re-rendering
  const CustomPrizeModal = () => {
    const [localPrize, setLocalPrize] = useState<Partial<CustomPrize>>(editingPrize || {})

    // Update local state when editingPrize changes
    useEffect(() => {
      setLocalPrize(editingPrize || {})
    }, [editingPrize])

    const handleInputChange = (field: keyof CustomPrize, value: string | number) => {
      setLocalPrize(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      saveCustomPrize(localPrize)
    }

    const handleCancel = () => {
      setShowPrizeModal(false)
      setEditingPrize(null)
    }

    if (!showPrizeModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-xl font-semibold mb-4">
            {localPrize?.id ? 'Edit Prize' : 'Add Prize'}
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="prize-position" className="block text-sm font-medium text-gray-700 mb-2">
                  Position (Descending Order)
                </label>
                <input
                  id="prize-position"
                  name="position"
                  type="number"
                  min="1"
                  max={customWinnerCount}
                  value={localPrize?.position || 1}
                  onChange={(e) => handleInputChange('position', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">1 = Highest, {customWinnerCount} = Lowest</p>
              </div>
              
              <div>
                <label htmlFor="prize-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Prize Title
                </label>
                <input
                  id="prize-title"
                  name="title"
                  type="text"
                  value={localPrize?.title || ''}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter prize title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="prize-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="prize-description"
                  name="description"
                  value={localPrize?.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter prize description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label htmlFor="prize-image-url" className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL
                </label>
                <input
                  id="prize-image-url"
                  name="image_url"
                  type="url"
                  value={localPrize?.image_url || ''}
                  onChange={(e) => handleInputChange('image_url', e.target.value)}
                  placeholder="Enter image URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                type="submit"
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Save Prize
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600">
          <div className="text-center text-white z-10">
            <AnimatePresence>
              {prizeDelay && (
                <motion.div
                  key="prize-delay"
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

              {showPrizeFirst && currentPrize && !prizeDelay && (
                <motion.div
                  key="show-prize-first"
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

              {(isDrawing || isCustomDrawing) && !prizeDelay && !showPrizeFirst && (
                <motion.div
                  key="drawing"
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
                      key={`previous-winners-${customWinners.length}-${forceUpdate}`}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-xl md:text-2xl opacity-80"
                    >
                      Previous Winners: {customWinners.map(w => w.name).join(', ')}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {winner && !prizeDelay && !showPrizeFirst && !isDrawing && !isCustomDrawing && (
                <motion.div
                  key="winner"
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

              {showAllWinners && previousWinners.length > 0 && !prizeDelay && !showPrizeFirst && !isDrawing && !isCustomDrawing && !winner && (
                <motion.div
                  key="all-winners"
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
                          key={`previous-winner-${winner.id}-${position}-${index}`}
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

              {customWinners.length > 0 && !showAllWinners && !prizeDelay && !showPrizeFirst && !isDrawing && !isCustomDrawing && !winner && (
                <motion.div
                  key="custom-winners"
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
                          key={`custom-winner-${winner.id}-${position}-${index}`}
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

              {!prizeDelay && !showPrizeFirst && !isDrawing && !isCustomDrawing && !winner && !showAllWinners && customWinners.length === 0 && (
                <motion.div
                  key="lucky-draw-ready"
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
            </AnimatePresence>
          </div>
        </div>
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
              Start Drawing
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
              Redraw
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
                onClick={drawAgain}
                className="bg-purple-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-purple-700 transition-colors"
              >
                Redraw
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

      {/* Main Layout: Controls on Left, Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Draw Controls Section - Left Side */}
        <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Gift className="h-6 w-6 mr-2" />
          Draw Controls
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-2">
              {userCompany && events.length <= 1 ? 'Event' : 'Select Event'}
            </label>
            {userCompany && events.length === 1 ? (
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                {events[0].name}
              </div>
            ) : (
              <select
                id="event-select"
                name="event-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {!userCompany && <option value="">Select an event</option>}
                {events.map((event) => (
                  <option key={`event-${event.id}`} value={event.id}>
                    {userCompany ? event.name : `${event.name} (${event.company.name})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Draw Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Draw Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDrawType('regular')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  drawType === 'regular' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users className="h-4 w-4 mr-1 inline" />
                Regular
              </button>
              <button
                type="button"
                onClick={() => setDrawType('table')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  drawType === 'table' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Table className="h-4 w-4 mr-1 inline" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setDrawType('custom')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  drawType === 'custom' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Target className="h-4 w-4 mr-1 inline" />
                Custom
              </button>
            </div>
          </div>

          {/* Table Type Selection */}
          {drawType === 'table' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Table Types to Include</label>
              <div className="space-y-2">
                {getUniqueTableTypes().map((tableType, index) => (
                  <label key={`table-type-${tableType}-${index}`} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedTableTypes.includes(tableType)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTableTypes([...selectedTableTypes, tableType])
                        } else {
                          setSelectedTableTypes(selectedTableTypes.filter(type => type !== tableType))
                        }
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{tableType}</span>
                    <span className="text-xs text-gray-500">
                      ({tables.filter(t => t.table_type === tableType).length} tables)
                    </span>
                  </label>
                ))}
                {getUniqueTableTypes().length === 0 && (
                  <p className="text-xs text-gray-500">No table types found</p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedTableTypes.length === 0 
                  ? 'All table types will be included' 
                  : `${getFilteredTables().length} tables selected`}
              </p>
            </div>
          )}

          {/* Custom Winner Count */}
          {drawType === 'custom' && (
            <div>
              <label htmlFor="winner-count" className="block text-sm font-medium text-gray-700 mb-2">Number of Winners</label>
              <input
                id="winner-count"
                name="winner-count"
                type="number"
                min="1"
                max="20"
                value={customWinnerCount}
                onChange={(e) => setCustomWinnerCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Winners will be drawn in descending order (highest to lowest)</p>
            </div>
          )}

          {/* Custom Prizes Management */}
          {drawType === 'custom' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Custom Prizes</label>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPrize({ position: 1, title: '', description: '', image_url: '' })
                    setShowPrizeModal(true)
                  }}
                  className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                >
                  + Add Prize
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {customPrizes.map((prize) => (
                  <div key={`prize-${prize.id}`} className="border border-gray-200 rounded-lg p-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                            #{prize.position}
                          </span>
                          <span className="font-medium text-gray-900 text-sm">{prize.title}</span>
                        </div>
                        {prize.description && (
                          <p className="text-xs text-gray-600 mt-1">{prize.description}</p>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPrize(prize)
                            setShowPrizeModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomPrize(prize.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {customPrizes.length === 0 && (
                  <p className="text-gray-500 text-xs">No prizes configured. Add prizes for specific positions.</p>
                )}
              </div>
            </div>
          )}

          {selectedEventId && (
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center text-purple-700 mb-2">
                <Users className="h-5 w-5 mr-2" />
                <span className="font-medium">
                  {drawType === 'table' ? 'Available Tables' : 'Eligible Participants'}
                </span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {drawType === 'table' 
                  ? getFilteredTables().filter(table => 
                      !previousWinners.find(w => w.id === `table-${table.table_number}`)
                    ).length
                  : drawType === 'custom'
                  ? getEligibleAttendees().length
                  : getEligibleAttendees().length
                }
              </div>
              <div className="text-sm text-purple-600">
                {drawType === 'table' ? (
                  <span>
                    {getFilteredTables().filter(table => 
                      !previousWinners.find(w => w.id === `table-${table.table_number}`)
                    ).length} available tables • {previousWinners.filter(w => w.id?.startsWith('table-')).length} tables already won
                    {selectedTableTypes.length > 0 && (
                      <span> • {selectedTableTypes.join(', ')} types selected</span>
                    )}
                  </span>
                ) : drawType === 'custom' ? (
                  <span>{attendees.length} total checked-in • {previousWinners.filter(w => !w.id?.startsWith('table-')).length} already won • {customWinnerCount} winners with prizes • {customPrizes.length} prizes configured</span>
                ) : (
                  <span>{attendees.length} total checked-in • {previousWinners.filter(w => !w.id?.startsWith('table-')).length} already won</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={startDraw}
              disabled={!selectedEventId || isDrawing || isCustomDrawing || showPrizeFirst || 
                (drawType === 'table' 
                  ? getFilteredTables().filter(table => 
                      !previousWinners.find(w => w.id === `table-${table.table_number}`)
                    ).length === 0
                  : drawType === 'custom'
                  ? getEligibleAttendees().length < customWinnerCount || customPrizes.length === 0
                  : getEligibleAttendees().length === 0
                )
              }
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-5 w-5 mr-2" />
              {isDrawing || isCustomDrawing ? 'Drawing...' : 'Start Lucky Draw'}
            </button>

            {showPrizeFirst && currentPrize && (
              <button
                type="button"
                onClick={startDrawingAfterPrize}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Drawing for Prize #{currentPrize.position}
              </button>
            )}

            {winner && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={confirmWinner}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirm Winner
                </button>
                <button
                  type="button"
                  onClick={drawAgain}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Redraw
                </button>
              </div>
            )}

            {customWinners.length > 0 && !isCustomDrawing && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={confirmCustomWinners}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirm {customWinners.length} Winners
                </button>
                {currentCustomWinnerIndex + 1 < customWinnerCount && (
                  <button
                    type="button"
                    onClick={continueCustomDraw}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Continue Drawing ({customWinnerCount - currentCustomWinnerIndex - 1} more)
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={resetDraw}
                className="bg-gray-600 text-white py-1 px-2 rounded text-xs hover:bg-gray-700 transition-colors flex items-center justify-center"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Current
              </button>
              <button
                type="button"
                onClick={resetWinners}
                className="bg-orange-600 text-white py-1 px-2 rounded text-xs hover:bg-orange-700 transition-colors flex items-center justify-center"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Winners
              </button>
              <button
                type="button"
                onClick={resetEverything}
                className="bg-red-600 text-white py-1 px-2 rounded text-xs hover:bg-red-700 transition-colors flex items-center justify-center"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                All
              </button>
            </div>
          </div>
        </div>
              {/* Preview Section - Right Side */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Play className="h-6 w-6 mr-2" />
            Preview
          </h2>
          
          <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 rounded-lg p-8 text-center text-white min-h-[400px] flex items-center justify-center">
            <div className="space-y-6">
              {!isDrawing && !winner && !isCustomDrawing && customWinners.length === 0 && !showPrizeFirst && (
                <div>
                  <Gift className="h-24 w-24 mx-auto mb-6" />
                  <h1 className="text-4xl font-bold mb-4">Lucky Draw</h1>
                  <p className="text-xl opacity-80">
                    {drawType === 'table' ? 'Random Table Selection' :
                     drawType === 'custom' ? `Custom Draw (${customWinnerCount} winners)` :
                     'Ready to pick a winner?'}
                  </p>
                </div>
              )}

              {showPrizeFirst && currentPrize && (
                <div>
                  <Trophy className="h-24 w-24 mx-auto mb-6 text-yellow-300" />
                  <h1 className="text-3xl font-bold mb-4">Prize #{currentPrize.position}</h1>
                  <div className="text-2xl font-bold bg-white bg-opacity-20 rounded-lg p-4 mb-4">
                    {currentPrize.title}
                  </div>
                  {currentPrize.description && (
                    <div className="text-lg opacity-80 mb-2">
                      {currentPrize.description}
                    </div>
                  )}
                  <div className="text-sm opacity-80">
                    Position #{currentPrize.position} • {customWinnerCount - currentCustomWinnerIndex} of {customWinnerCount} winners
                  </div>
                </div>
              )}

              {(isDrawing || isCustomDrawing) && (
                <div>
                  <div className="animate-spin mb-6">
                    <Sparkles className="h-16 w-16 mx-auto" />
                  </div>
                  <h1 className="text-3xl font-bold mb-4">
                    {isCustomDrawing ? `Drawing Winner #${customWinnerCount - currentCustomWinnerIndex}...` : 'Drawing...'}
                  </h1>
                  {isCustomDrawing && (
                    <div className="text-lg opacity-80 mb-4">
                      {(() => {
                        const position = customWinnerCount - currentCustomWinnerIndex
                        const prize = customPrizes.find(p => p.position === position)
                        return prize ? `Prize: ${prize.title}` : `Position #${position}`
                      })()}
                    </div>
                  )}
                  <div className="text-2xl font-semibold bg-white bg-opacity-20 rounded-lg p-4">
                    {currentName}
                  </div>
                  {isCustomDrawing && customWinners.length > 0 && (
                    <div key={`main-previous-winners-${customWinners.length}-${forceUpdate}`} className="text-lg opacity-80 mt-4">
                      Previous Winners: {customWinners.map(w => w.name).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {winner && (
                <div>
                  <div className="animate-bounce mb-6">
                    <Trophy className="h-24 w-24 mx-auto text-yellow-300" />
                  </div>
                  <h1 className="text-3xl font-bold mb-4">
                    🎉 {winner.id?.startsWith('table-') ? 'TABLE WINNER!' : 'WINNER!'} 🎉
                  </h1>
                  <div className="text-4xl md:text-5xl font-bold bg-white bg-opacity-20 rounded-lg p-8">
                    {winner.name}
                  </div>
                  {winner.company && !winner.id?.startsWith('table-') && (
                    <div className="text-lg opacity-80 mt-2">
                      {winner.company}
                    </div>
                  )}
                  {winner.table_number && !winner.id?.startsWith('table-') && (
                    <div className="text-lg opacity-80 mt-1">
                      Table {winner.table_number}
                    </div>
                  )}
                </div>
              )}

              {customWinners.length > 0 && (
                <div>
                  <div className="animate-bounce mb-6">
                    <Trophy className="h-24 w-24 mx-auto text-yellow-300" />
                  </div>
                  <h1 className="text-3xl font-bold mb-4">🎉 WINNERS! 🎉</h1>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {customWinners.map((winner, index) => {
                      const position = customWinnerCount - index // Descending order
                      const prize = customPrizes.find(p => p.position === position)
                      
                      return (
                        <div key={`preview-winner-${winner.id}-${position}-${index}`} className="text-xl md:text-2xl font-bold bg-white bg-opacity-20 rounded-lg p-4 relative">
                          <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {position}
                          </div>
                          <div className="text-center">
                            <div className="mb-1">{winner.name}</div>
                            {prize && (
                              <div className="text-sm opacity-80">
                                🎁 {prize.title}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Winner Lists - Bottom Section */}
      <div className="space-y-6">
        {/* Saved Winners from Database */}
        {savedWinners.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
            Saved Winners
          </h2>
          <div className="space-y-2">
            {savedWinners.map((winner, index) => {
              const isTableWinner = winner.is_table_winner
              
              return (
                <div key={`saved-winner-${winner.id}-${index}`} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                  <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{winner.winner_name}</div>
                    {winner.winner_company && !isTableWinner && (
                      <div className="text-sm text-gray-600">{winner.winner_company}</div>
                    )}
                    {winner.table_number && !isTableWinner && (
                      <div className="text-sm text-gray-600">Table {winner.table_number}</div>
                    )}
                    {isTableWinner && (
                      <div className="text-sm text-blue-600 font-medium">🏆 Table Winner</div>
                    )}
                    {winner.prize_title && !isTableWinner && (
                      <div className="mt-2 p-2 bg-purple-50 rounded border-l-4 border-purple-400">
                        <div className="flex items-center space-x-2">
                          <span className="text-purple-600 font-medium">🎁</span>
                          <span className="text-sm font-medium text-purple-900">{winner.prize_title}</span>
                        </div>
                        {winner.prize_description && (
                          <div className="text-xs text-purple-700 mt-1">{winner.prize_description}</div>
                        )}
                        <div className="text-xs text-purple-600 mt-1">Position #{winner.prize_position}</div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {winner.draw_type} • {new Date(winner.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Previous Winners (Session) */}
      {previousWinners.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
            Current Session Winners
          </h2>
          <div className="space-y-2">
            {previousWinners.map((winner, index) => {
              const winnerIndex = index + 1
              const prize = customPrizes.find(p => p.position === winnerIndex)
              const isTableWinner = winner.id?.startsWith('table-')
              
              return (
                <div key={`session-winner-${winner.id}-${index}`} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                  <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{winner.name}</div>
                    {winner.company && !isTableWinner && (
                      <div className="text-sm text-gray-600">{winner.company}</div>
                    )}
                    {winner.table_number && !isTableWinner && (
                      <div className="text-sm text-gray-600">Table {winner.table_number}</div>
                    )}
                    {isTableWinner && (
                      <div className="text-sm text-blue-600 font-medium">🏆 Table Winner</div>
                    )}
                    {prize && !isTableWinner && (
                      <div className="mt-2 p-2 bg-purple-50 rounded border-l-4 border-purple-400">
                        <div className="flex items-center space-x-2">
                          <span className="text-purple-600 font-medium">🎁</span>
                          <span className="text-sm font-medium text-purple-900">{prize.title}</span>
                        </div>
                        {prize.description && (
                          <div className="text-xs text-purple-700 mt-1">{prize.description}</div>
                        )}
                        <div className="text-xs text-purple-600 mt-1">Position #{prize.position}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

        </div>
      </div>

      {/* Custom Prize Modal */}
      <CustomPrizeModal />
    </div>
  )
}