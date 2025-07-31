import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCw, Plus, ZoomIn, ZoomOut, Move, Edit, Trash2, Grid, MousePointer, Hand, AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, Minus, Lock, Unlock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Table {
  id: string
  table_number: number
  table_type: string
  capacity: number
  x: number
  y: number
  rotation: number
  is_locked?: boolean
}

interface Attendee {
  id: string
  name: string
  table_assignment: string | null
}

interface VenueLayoutProps {
  eventId: string
  userCompany?: any
  isAttendeeView?: boolean
  attendeeTable?: string | null
}

export default function VenueLayout({ eventId, userCompany, isAttendeeView = false, attendeeTable = null }: VenueLayoutProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set())
  const [draggedTable, setDraggedTable] = useState<Table | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'free' | 'grid'>('free')
  const [gridSize, setGridSize] = useState(20)
  const [showGrid, setShowGrid] = useState(true)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [groupDragOffset, setGroupDragOffset] = useState<{ [key: string]: { x: number, y: number } }>({})
  const [isGroupDragging, setIsGroupDragging] = useState(false)
  
  const venueRef = useRef<HTMLDivElement>(null)
  const tableForm = useRef({
    table_number: 1,
    table_type: 'Regular',
    capacity: 8,
    x: 100,
    y: 100,
    rotation: 0,
    is_locked: false
  })

  const tableTypes = ['VVIP', 'VIP', 'Regular', 'Staff']
  const tableColors = {
    'VVIP': 'bg-purple-500',
    'VIP': 'bg-yellow-500',
    'Regular': 'bg-blue-500',
    'Staff': 'bg-gray-500'
  }

  useEffect(() => {
    console.log('VenueLayout: eventId changed to:', eventId)
    if (eventId) {
      fetchTables()
      fetchAttendees()
    }
  }, [eventId])

  const fetchTables = async () => {
    try {
      console.log('VenueLayout: Fetching tables for event:', eventId)
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('event_id', eventId)
        .order('table_number')
      
      if (error) throw error
      
      // Set default positions if not set
      const tablesWithPositions = data?.map((table, index) => ({
        ...table,
        x: table.x || 100 + (index * 150),
        y: table.y || 100 + (index * 100),
        rotation: table.rotation || 0
      })) || []
      
      console.log('VenueLayout: Fetched tables:', tablesWithPositions)
      setTables(tablesWithPositions)
    } catch (error: any) {
      console.error('VenueLayout: Error fetching tables:', error)
      toast.error('Error fetching tables: ' + error.message)
    }
  }

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('id, name, table_assignment')
        .eq('event_id', eventId)
      
      if (error) throw error
      setAttendees(data || [])
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    }
  }

  const snapToGrid = useCallback((x: number, y: number) => {
    if (layoutMode === 'grid') {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
      }
    }
    return { x, y }
  }, [layoutMode, gridSize])

  const getSelectedTables = useCallback(() => {
    return tables.filter(table => selectedTables.has(table.id))
  }, [tables, selectedTables])

  const handleTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingTable) {
        // Update table
        const { data, error } = await supabase
          .from('tables')
          .update({
            table_number: tableForm.current.table_number,
            table_type: tableForm.current.table_type,
            capacity: tableForm.current.capacity,
            x: tableForm.current.x,
            y: tableForm.current.y,
            rotation: tableForm.current.rotation
          })
          .eq('id', editingTable.id)
          .select()
        
        if (error) throw error
        
        // Immediately update the table in local state
        if (data && data.length > 0) {
          const updatedTable = data[0]
          setTables(prev => prev.map(t => 
            t.id === editingTable.id ? updatedTable : t
          ))
          toast.success('Table updated successfully!')
        } else {
          // Fallback: fetch tables if we couldn't get the updated table data
          fetchTables()
          toast.success('Table updated successfully!')
        }
      } else {
        // Create new table
        const { data, error } = await supabase
          .from('tables')
          .insert([{
            event_id: eventId,
            table_number: tableForm.current.table_number,
            table_type: tableForm.current.table_type,
            capacity: tableForm.current.capacity,
            x: tableForm.current.x,
            y: tableForm.current.y,
            rotation: tableForm.current.rotation,
            is_locked: false,
          }])
          .select()
        
        if (error) throw error
        
        // Immediately add the new table to local state for instant feedback
        if (data && data.length > 0) {
          const newTable = data[0]
          setTables(prev => [...prev, newTable])
          toast.success('Table created successfully!')
        } else {
          // Fallback: fetch tables if we couldn't get the created table data
          fetchTables()
          toast.success('Table created successfully!')
        }
      }
      
      setShowTableModal(false)
      // Fetch tables to get the real ID and ensure consistency
      fetchTables()
    } catch (error: any) {
      toast.error('Error saving table: ' + error.message)
    }
  }

  const deleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return
    
    try {
      // Unassign attendees from this table
      const table = tables.find(t => t.id === tableId)
      if (table) {
        await supabase
          .from('attendees')
          .update({ table_assignment: null })
          .eq('table_assignment', table.table_number.toString())
      }
      
      // Delete table
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId)
      
      if (error) throw error
      toast.success('Table deleted successfully!')
      fetchTables()
    } catch (error: any) {
      toast.error('Error deleting table: ' + error.message)
    }
  }

  const deleteSelectedTables = async () => {
    if (selectedTables.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedTables.size} selected table(s)?`)) return
    
    try {
      const selectedTableIds = Array.from(selectedTables)
      
      // Unassign attendees from selected tables
      const selectedTableNumbers = tables
        .filter(t => selectedTableIds.includes(t.id))
        .map(t => t.table_number.toString())
      
      if (selectedTableNumbers.length > 0) {
        await supabase
          .from('attendees')
          .update({ table_assignment: null })
          .in('table_assignment', selectedTableNumbers)
      }
      
      // Delete selected tables
      const { error } = await supabase
        .from('tables')
        .delete()
        .in('id', selectedTableIds)
      
      if (error) throw error
      toast.success(`${selectedTables.size} table(s) deleted successfully!`)
      setSelectedTables(new Set())
      fetchTables()
    } catch (error: any) {
      toast.error('Error deleting tables: ' + error.message)
    }
  }

  const handleDragStart = (e: React.DragEvent, table: Table) => {
    if (isAttendeeView) return // Disable drag in attendee view
    if (table.is_locked) {
      e.preventDefault()
      toast.error('This table is locked and cannot be moved')
      return
    }
    
    if (isMultiSelectMode) {
      e.preventDefault()
      
      // Check if any selected table is locked
      const selectedTableList = getSelectedTables()
      const hasLockedTable = selectedTableList.some(t => t.is_locked)
      if (hasLockedTable) {
        toast.error('Cannot move group: some tables are locked')
        return
      }
      
      // If dragging a selected table, start group drag
      if (selectedTables.has(table.id) && selectedTables.size > 1) {
        const rect = e.currentTarget.getBoundingClientRect()
        const offsetX = e.clientX - rect.left
        const offsetY = e.clientY - rect.top
        
        setDragOffset({ x: offsetX, y: offsetY })
        setDraggedTable(table)
        setIsGroupDragging(true)
        
        // Calculate relative positions of all selected tables
        const groupOffsets: { [key: string]: { x: number, y: number } } = {}
        
        selectedTableList.forEach(selectedTable => {
          if (selectedTable.id !== table.id) {
            groupOffsets[selectedTable.id] = {
              x: selectedTable.x - table.x,
              y: selectedTable.y - table.y
            }
          }
        })
        
        setGroupDragOffset(groupOffsets)
        e.dataTransfer.setData('text/plain', 'group-drag')
        e.dataTransfer.effectAllowed = 'move'
        return
      }
      
      // Single table selection/deselection
      const newSelected = new Set(selectedTables)
      if (newSelected.has(table.id)) {
        newSelected.delete(table.id)
      } else {
        newSelected.add(table.id)
      }
      setSelectedTables(newSelected)
      return
    }
    
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    
    setDragOffset({ x: offsetX, y: offsetY })
    setDraggedTable(table)
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', table.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedTable || isAttendeeView) return
    
    const rect = venueRef.current?.getBoundingClientRect()
    if (!rect) return
    
    // Calculate position with offset correction
    const rawX = (e.clientX - rect.left - dragOffset.x) / zoom
    const rawY = (e.clientY - rect.top - dragOffset.y) / zoom
    
    // Apply grid snapping if enabled
    const { x, y } = snapToGrid(rawX, rawY)
    
    // Ensure table stays within bounds and convert to integers
    const clampedX = Math.round(Math.max(0, Math.min(x, rect.width / zoom - 120)))
    const clampedY = Math.round(Math.max(0, Math.min(y, rect.height / zoom - 80)))
    
    try {
      if (isGroupDragging && selectedTables.size > 1) {
        // Move group of tables
        const selectedTableList = getSelectedTables()
        const updates: { id: string; x: number; y: number }[] = []
        
        for (const selectedTable of selectedTableList) {
          if (selectedTable.id === draggedTable.id) {
            updates.push({
              id: selectedTable.id,
              x: clampedX,
              y: clampedY
            })
          } else {
            const offset = groupDragOffset[selectedTable.id]
            if (offset) {
              const newX = Math.round(Math.max(0, Math.min(clampedX + offset.x, rect.width / zoom - 120)))
              const newY = Math.round(Math.max(0, Math.min(clampedY + offset.y, rect.height / zoom - 80)))
              updates.push({
                id: selectedTable.id,
                x: newX,
                y: newY
              })
            }
          }
        }
        
        // Update all tables in the group
        for (const update of updates) {
          await supabase
            .from('tables')
            .update({ x: update.x, y: update.y })
            .eq('id', update.id)
        }
        
        // Update local state
        setTables(prev => prev.map(t => {
          const update = updates.find(u => u.id === t.id)
          return update ? { ...t, x: update.x, y: update.y } : t
        }))
        
        toast.success(`${updates.length} tables moved successfully!`)
      } else {
        // Move single table
        const { error } = await supabase
          .from('tables')
          .update({ x: clampedX, y: clampedY })
          .eq('id', draggedTable.id)
        
        if (error) throw error
        
        // Update local state
        setTables(prev => prev.map(t => 
          t.id === draggedTable.id ? { ...t, x: clampedX, y: clampedY } : t
        ))
        
        toast.success('Table position updated!')
      }
    } catch (error: any) {
      toast.error('Error updating table position: ' + error.message)
    }
    
    setDraggedTable(null)
    setIsDragging(false)
    setIsGroupDragging(false)
    setDragOffset({ x: 0, y: 0 })
    setGroupDragOffset({})
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left click
      e.preventDefault()
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x
      const deltaY = e.clientY - lastPanPoint.y
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const rotateTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    
    if (table.is_locked) {
      toast.error('This table is locked and cannot be rotated')
      return
    }
    
    const newRotation = (table.rotation + 45) % 360
    
    try {
      const { error } = await supabase
        .from('tables')
        .update({ rotation: newRotation })
        .eq('id', tableId)
      
      if (error) throw error
      
      setTables(prev => prev.map(t => 
        t.id === tableId ? { ...t, rotation: newRotation } : t
      ))
    } catch (error: any) {
      toast.error('Error rotating table: ' + error.message)
    }
  }

  const toggleTableLock = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    
    const newLockState = !table.is_locked
    
    try {
      const { error } = await supabase
        .from('tables')
        .update({ is_locked: newLockState })
        .eq('id', tableId)
      
      if (error) throw error
      
      setTables(prev => prev.map(t => 
        t.id === tableId ? { ...t, is_locked: newLockState } : t
      ))
      
      toast.success(`Table ${newLockState ? 'locked' : 'unlocked'} successfully!`)
    } catch (error: any) {
      toast.error('Error updating table lock: ' + error.message)
    }
  }

  const lockSelectedTables = async () => {
    if (selectedTables.size === 0) {
      toast.error('No tables selected')
      return
    }
    
    try {
      const { error } = await supabase
        .from('tables')
        .update({ is_locked: true })
        .in('id', Array.from(selectedTables))
      
      if (error) throw error
      
      setTables(prev => prev.map(t => 
        selectedTables.has(t.id) ? { ...t, is_locked: true } : t
      ))
      
      toast.success(`${selectedTables.size} table(s) locked successfully!`)
    } catch (error: any) {
      toast.error('Error locking tables: ' + error.message)
    }
  }

  const unlockSelectedTables = async () => {
    if (selectedTables.size === 0) {
      toast.error('No tables selected')
      return
    }
    
    try {
      const { error } = await supabase
        .from('tables')
        .update({ is_locked: false })
        .in('id', Array.from(selectedTables))
      
      if (error) throw error
      
      setTables(prev => prev.map(t => 
        selectedTables.has(t.id) ? { ...t, is_locked: false } : t
      ))
      
      toast.success(`${selectedTables.size} table(s) unlocked successfully!`)
    } catch (error: any) {
      toast.error('Error unlocking tables: ' + error.message)
    }
  }

  const alignSelectedTables = async (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedTables.size < 2) {
      toast.error('Select at least 2 tables to align')
      return
    }
    
    const selectedTableList = getSelectedTables()
    const updates: { id: string; x?: number; y?: number }[] = []
    
    if (alignment === 'left') {
      const minX = Math.min(...selectedTableList.map(t => t.x))
      for (const table of selectedTableList) {
        updates.push({ id: table.id, x: Math.round(minX) })
      }
    } else if (alignment === 'center') {
      const centerX = selectedTableList.reduce((sum, t) => sum + t.x, 0) / selectedTableList.length
      for (const table of selectedTableList) {
        updates.push({ id: table.id, x: Math.round(centerX) })
      }
    } else if (alignment === 'right') {
      const maxX = Math.max(...selectedTableList.map(t => t.x))
      for (const table of selectedTableList) {
        updates.push({ id: table.id, x: Math.round(maxX) })
      }
    } else if (alignment === 'top') {
      const minY = Math.min(...selectedTableList.map(t => t.y))
      for (const table of selectedTableList) {
        updates.push({ id: table.id, y: Math.round(minY) })
      }
    } else if (alignment === 'middle') {
      const centerY = selectedTableList.reduce((sum, t) => sum + t.y, 0) / selectedTableList.length
      for (const table of selectedTableList) {
        updates.push({ id: table.id, y: Math.round(centerY) })
      }
    } else if (alignment === 'bottom') {
      const maxY = Math.max(...selectedTableList.map(t => t.y))
      for (const table of selectedTableList) {
        updates.push({ id: table.id, y: Math.round(maxY) })
      }
    }
    
    try {
      for (const update of updates) {
        await supabase
          .from('tables')
          .update(update)
          .eq('id', update.id)
      }
      
      setTables(prev => prev.map(t => {
        const update = updates.find(u => u.id === t.id)
        return update ? { ...t, ...update } : t
      }))
      
      toast.success(`Tables aligned to ${alignment}!`)
    } catch (error: any) {
      toast.error('Error aligning tables: ' + error.message)
    }
  }

  const distributeSelectedTables = async (direction: 'horizontal' | 'vertical') => {
    const selectedTableList = getSelectedTables()
    if (selectedTableList.length < 3) {
      toast.error('Select at least 3 tables to distribute')
      return
    }
    
    const sortedTables = [...selectedTableList].sort((a, b) => 
      direction === 'horizontal' ? a.x - b.x : a.y - b.y
    )
    
    const updates: { id: string; x?: number; y?: number }[] = []
    const first = sortedTables[0]
    const last = sortedTables[sortedTables.length - 1]
    
    if (direction === 'horizontal') {
      const totalDistance = last.x - first.x
      const spacing = totalDistance / (sortedTables.length - 1)
      
      for (let i = 1; i < sortedTables.length - 1; i++) {
        const newX = first.x + (spacing * i)
        updates.push({ id: sortedTables[i].id, x: Math.round(newX) })
      }
    } else {
      const totalDistance = last.y - first.y
      const spacing = totalDistance / (sortedTables.length - 1)
      
      for (let i = 1; i < sortedTables.length - 1; i++) {
        const newY = first.y + (spacing * i)
        updates.push({ id: sortedTables[i].id, y: Math.round(newY) })
      }
    }
    
    try {
      for (const update of updates) {
        await supabase
          .from('tables')
          .update(update)
          .eq('id', update.id)
      }
      
      setTables(prev => prev.map(t => {
        const update = updates.find(u => u.id === t.id)
        return update ? { ...t, ...update } : t
      }))
      
      toast.success(`Tables distributed ${direction}ly!`)
    } catch (error: any) {
      toast.error('Error distributing tables: ' + error.message)
    }
  }

  const getTableAttendees = (tableNumber: number) => {
    return attendees.filter(a => a.table_assignment === tableNumber.toString())
  }

  const openEditModal = (table: Table) => {
    setEditingTable(table)
    tableForm.current = {
      table_number: table.table_number,
      table_type: table.table_type,
      capacity: table.capacity,
      x: table.x,
      y: table.y,
      rotation: table.rotation,
      is_locked: table.is_locked || false,
    }
    setShowTableModal(true)
  }

  const resetForm = () => {
    tableForm.current = {
      table_number: Math.max(...tables.map(t => t.table_number), 0) + 1,
      table_type: 'Regular',
      capacity: 8,
      x: 100,
      y: 100,
      rotation: 0,
      is_locked: false,
    }
    setEditingTable(null)
    setShowTableModal(false)
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.3))
  }

  const resetView = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const arrangeInGrid = () => {
    // Filter out locked tables and get only movable tables
    const movableTables = tables.filter(table => !table.is_locked)
    const lockedTables = tables.filter(table => table.is_locked)
    
    if (movableTables.length === 0) {
      toast.error('No movable tables found. All tables are locked.')
      return
    }
    
    // Arrange only movable tables in grid
    const gridTables = movableTables.map((table, index) => {
      const row = Math.floor(index / 4) // 4 tables per row
      const col = index % 4
      const { x, y } = snapToGrid(50 + (col * 200), 50 + (row * 150))
      return {
        ...table,
        x,
        y
      }
    })
    
    // Combine movable tables (with new positions) and locked tables (with original positions)
    const updatedTables = [...gridTables, ...lockedTables]
    setTables(updatedTables)
    
    // Update only movable tables in database
    gridTables.forEach(async (table) => {
      try {
        await supabase
          .from('tables')
          .update({ x: table.x, y: table.y })
          .eq('id', table.id)
      } catch (error) {
        console.error('Error updating table position:', error)
      }
    })
    
    const lockedCount = lockedTables.length
    const movedCount = gridTables.length
    
    if (lockedCount > 0) {
      toast.success(`${movedCount} tables arranged in grid. ${lockedCount} locked table(s) were not moved.`)
    } else {
      toast.success(`${movedCount} tables arranged in grid successfully!`)
    }
  }

  const handleTableClick = (table: Table) => {
    if (isMultiSelectMode) {
      const newSelected = new Set(selectedTables)
      if (newSelected.has(table.id)) {
        newSelected.delete(table.id)
      } else {
        newSelected.add(table.id)
      }
      setSelectedTables(newSelected)
    } else {
      setSelectedTable(table)
    }
  }

  const isTableSelected = (tableId: string) => {
    return selectedTables.has(tableId)
  }

  const clearSelection = () => {
    setSelectedTables(new Set())
  }

  const renderGrid = () => {
    if (!showGrid) return null
    
    const gridLines = []
    const width = 800
    const height = 600
    
    for (let x = 0; x <= width; x += gridSize) {
      gridLines.push(
        <line
          key={`v${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="#e5e7eb"
          strokeWidth="1"
          opacity="0.5"
        />
      )
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      gridLines.push(
        <line
          key={`h${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="#e5e7eb"
          strokeWidth="1"
          opacity="0.5"
        />
      )
    }
    
    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'top left'
        }}
      >
        {gridLines}
      </svg>
    )
  }

  const selectedTableList = getSelectedTables()

  return (
    <div className="space-y-6">
      {/* Venue Layout */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Venue Layout</h2>
          <div className="flex gap-2">
            {!isAttendeeView && (
              <>
                <button
                  onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
                  className={`px-3 py-2 rounded-lg flex items-center ${
                    isMultiSelectMode 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Toggle multi-select mode"
                >
                  <MousePointer className="h-4 w-4 mr-2" />
                  Multi-Select
                </button>
                
                {/* Multi-select controls */}
                {isMultiSelectMode && selectedTables.size > 0 && (
                  <>
                    <div className="flex gap-1 border-l border-gray-300 pl-2">
                      <button
                        onClick={() => alignSelectedTables('left')}
                        className="bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700"
                        title="Align left"
                      >
                        <AlignLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => alignSelectedTables('center')}
                        className="bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700"
                        title="Align center"
                      >
                        <AlignCenter className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => alignSelectedTables('right')}
                        className="bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700"
                        title="Align right"
                      >
                        <AlignRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => alignSelectedTables('top')}
                        className="bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700"
                        title="Align top"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => alignSelectedTables('middle')}
                        className="bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700"
                        title="Align middle"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => alignSelectedTables('bottom')}
                        className="bg-blue-600 text-white px-2 py-2 rounded hover:bg-blue-700"
                        title="Align bottom"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => distributeSelectedTables('horizontal')}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                      title="Distribute horizontally"
                    >
                      Distribute H
                    </button>
                    <button
                      onClick={() => distributeSelectedTables('vertical')}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                      title="Distribute vertically"
                    >
                      Distribute V
                    </button>
                    <button
                      onClick={lockSelectedTables}
                      className="bg-orange-600 text-white px-3 py-2 rounded hover:bg-orange-700"
                      title="Lock selected tables"
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      Lock
                    </button>
                    <button
                      onClick={unlockSelectedTables}
                      className="bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700"
                      title="Unlock selected tables"
                    >
                      <Unlock className="h-4 w-4 mr-1" />
                      Unlock
                    </button>
                    <button
                      onClick={deleteSelectedTables}
                      className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
                      title="Delete selected tables"
                    >
                      Delete ({selectedTables.size})
                    </button>
                    <button
                      onClick={clearSelection}
                      className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700"
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => setLayoutMode(layoutMode === 'free' ? 'grid' : 'free')}
                  className={`px-3 py-2 rounded-lg flex items-center ${
                    layoutMode === 'grid' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Toggle grid snapping"
                >
                  <Grid className="h-4 w-4 mr-2" />
                  {layoutMode === 'grid' ? 'Grid On' : 'Grid Off'}
                </button>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`px-3 py-2 rounded-lg flex items-center ${
                    showGrid 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Toggle grid visibility"
                >
                  <Grid className="h-4 w-4 mr-2" />
                  Grid
                </button>
                <button
                  onClick={arrangeInGrid}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center"
                  title="Arrange tables in grid"
                >
                  <Move className="h-4 w-4 mr-2" />
                  Arrange Grid
                </button>
                <button
                  onClick={resetView}
                  className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center"
                  title="Reset view"
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Reset
                </button>
                <button
                  onClick={handleZoomIn}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingTable(null)
                    resetForm()
                    setShowTableModal(true)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                  title="Add new table"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Controls Info */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="flex items-center gap-4">
              <span>Zoom: {Math.round(zoom * 100)}%</span>
              <span>Grid: {layoutMode === 'grid' ? 'On' : 'Off'}</span>
              <span>Grid Size: {gridSize}px</span>
              {isMultiSelectMode && (
                <span className="text-purple-600 font-medium">
                  Multi-Select: {selectedTables.size} table(s) selected
                </span>
              )}
            </div>
            <div className="text-xs mt-1 text-blue-600">
              <span>
                {isMultiSelectMode 
                  ? 'Click to select/deselect • Drag selected table to move group • Use alignment tools'
                  : 'Drag to move tables • Alt+Click to pan • Middle click to pan • Grid snapping: ' + (layoutMode === 'grid' ? 'Enabled' : 'Disabled')
                }
              </span>
            </div>
          </div>
        </div>
        
        {/* Venue Canvas */}
        <div
          ref={venueRef}
          className="relative w-full h-96 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isPanning ? 'grabbing' : 'grab'
          }}
        >
          {/* Grid Background */}
          {renderGrid()}
          
          {/* Tables */}
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            {tables.map((table) => {
              const tableAttendees = getTableAttendees(table.table_number)
              const isHighlighted = isAttendeeView && attendeeTable === table.table_number.toString()
              const isSelected = isTableSelected(table.id)
              const isBeingDragged = draggedTable?.id === table.id
              
              return (
                <div
                  key={table.id}
                  draggable={!isAttendeeView}
                  onDragStart={(e) => handleDragStart(e, table)}
                  onClick={() => handleTableClick(table)}
                  className={`absolute transition-all duration-200 ${
                    isHighlighted ? 'ring-4 ring-green-500 ring-opacity-75' : ''
                  } ${
                    isSelected ? 'ring-4 ring-purple-500 ring-opacity-75' : ''
                  } ${
                    isBeingDragged ? 'opacity-50 scale-105' : ''
                  }`}
                  style={{
                    left: table.x,
                    top: table.y,
                    transform: `rotate(${table.rotation}deg)`,
                    width: 120,
                    height: 80,
                    zIndex: isBeingDragged ? 1000 : (isSelected ? 100 : 1)
                  }}
                >
                  <div className={`${tableColors[table.table_type as keyof typeof tableColors]} text-white rounded-lg p-3 shadow-lg h-full relative hover:shadow-xl transition-shadow ${
                    table.is_locked ? 'ring-2 ring-yellow-400 ring-opacity-75' : ''
                  }`}>
                    <div className="text-center">
                      <div className="font-bold text-lg flex items-center justify-center gap-1">
                        Table {table.table_number}
                        {table.is_locked && (
                          <Lock className="h-3 w-3 text-yellow-300" />
                        )}
                      </div>
                      <div className="text-xs opacity-90">{table.table_type}</div>
                      <div className="text-xs mt-1">
                        {tableAttendees.length}/{table.capacity} guests
                      </div>
                    </div>
                    
                    {!isAttendeeView && (
                      <div className="flex justify-center gap-1 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleTableLock(table.id)
                          }}
                          className={`rounded p-1 transition-colors ${
                            table.is_locked 
                              ? 'bg-yellow-500/30 hover:bg-yellow-500/50' 
                              : 'bg-white/20 hover:bg-white/30'
                          }`}
                          title={table.is_locked ? 'Unlock Table' : 'Lock Table'}
                        >
                          {table.is_locked ? (
                            <Unlock className="h-3 w-3" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(table)
                          }}
                          className="bg-white/20 hover:bg-white/30 rounded p-1 transition-colors"
                          title="Edit Table"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            rotateTable(table.id)
                          }}
                          className="bg-white/20 hover:bg-white/30 rounded p-1 transition-colors"
                          title="Rotate Table"
                        >
                          <RotateCw className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTable(table.id)
                          }}
                          className="bg-white/20 hover:bg-white/30 rounded p-1 transition-colors"
                          title="Delete Table"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          
          {isAttendeeView && attendeeTable && (
            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-2 rounded-lg z-10">
              <div className="font-bold">Your Table: {attendeeTable}</div>
            </div>
          )}
        </div>
        
        {/* Multi-select info */}
        {isMultiSelectMode && selectedTables.size > 0 && (
          <div className="mt-2 p-2 bg-purple-100 rounded-lg">
            <p className="text-sm text-purple-800">
              {selectedTables.size} table(s) selected • Drag any selected table to move the entire group
            </p>
          </div>
        )}
      </div>

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingTable ? 'Edit Table' : 'Add Table'}
            </h3>
            <form onSubmit={handleTableSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Table Number</label>
                <input
                  type="number"
                  value={tableForm.current.table_number}
                  onChange={(e) => tableForm.current.table_number = parseInt(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Table Type</label>
                <select
                  value={tableForm.current.table_type}
                  onChange={(e) => tableForm.current.table_type = e.target.value}
                  className="w-full border rounded px-3 py-2"
                >
                  {tableTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity</label>
                <input
                  type="number"
                  value={tableForm.current.capacity}
                  onChange={(e) => tableForm.current.capacity = parseInt(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {editingTable ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 