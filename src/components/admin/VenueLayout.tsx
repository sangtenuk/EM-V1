import { useState, useEffect, useRef } from 'react'
import { RotateCw, Plus, ZoomIn, ZoomOut, Move, Edit, Trash2 } from 'lucide-react'
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
  
  const venueRef = useRef<HTMLDivElement>(null)
  const tableForm = useRef({
    table_number: 1,
    table_type: 'Regular',
    capacity: 8,
    x: 100,
    y: 100,
    rotation: 0
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

  const handleTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingTable) {
        // Update table
        const { error } = await supabase
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
        
        if (error) throw error
        toast.success('Table updated successfully!')
      } else {
        // Create new table
        const { error } = await supabase
          .from('tables')
          .insert([{
            event_id: eventId,
            table_number: tableForm.current.table_number,
            table_type: tableForm.current.table_type,
            capacity: tableForm.current.capacity,
            x: tableForm.current.x,
            y: tableForm.current.y,
            rotation: tableForm.current.rotation,

          }])
        
        if (error) throw error
        toast.success('Table created successfully!')
      }
      
      setShowTableModal(false)
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

  const handleDragStart = (e: React.DragEvent, table: Table) => {
    if (isAttendeeView) return // Disable drag in attendee view
    
    if (isMultiSelectMode) {
      e.preventDefault()
      const newSelected = new Set(selectedTables)
      if (newSelected.has(table.id)) {
        newSelected.delete(table.id)
      } else {
        newSelected.add(table.id)
      }
      setSelectedTables(newSelected)
      return
    }
    
    setDraggedTable(table)
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', table.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedTable || isAttendeeView) return
    
    const rect = venueRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom
    
    try {
      const { error } = await supabase
        .from('tables')
        .update({ x, y })
        .eq('id', draggedTable.id)
      
      if (error) throw error
      
      // Update local state
      setTables(prev => prev.map(t => 
        t.id === draggedTable.id ? { ...t, x, y } : t
      ))
    } catch (error: any) {
      toast.error('Error updating table position: ' + error.message)
    }
    
    setDraggedTable(null)
    setIsDragging(false)
  }

  const rotateTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    
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



  const arrangeInGrid = () => {
    const gridTables = tables.map((table, index) => {
      const row = Math.floor(index / 4) // 4 tables per row
      const col = index % 4
      return {
        ...table,
        x: 50 + (col * 200),
        y: 50 + (row * 150)
      }
    })
    
    setTables(gridTables)
    
    // Update in database
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
                >
                  <Move className="h-4 w-4 mr-2" />
                  Multi-Select
                </button>
                <button
                  onClick={arrangeInGrid}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Move className="h-4 w-4 mr-2" />
                  Arrange Grid
                </button>
                <button
                  onClick={handleZoomIn}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center"
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
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Zoom Info */}
        <div className="mb-2 text-sm text-gray-600">
          Zoom: {Math.round(zoom * 100)}%
        </div>
        
        {/* Venue Canvas */}
        <div
          ref={venueRef}
          className="relative w-full h-96 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left'
          }}
        >
          {tables.map((table) => {
            const tableAttendees = getTableAttendees(table.table_number)
            const isHighlighted = isAttendeeView && attendeeTable === table.table_number.toString()
            const isSelected = isTableSelected(table.id)
            
            return (
              <div
                key={table.id}
                draggable={!isAttendeeView}
                onDragStart={(e) => handleDragStart(e, table)}
                onClick={() => handleTableClick(table)}
                className={`absolute cursor-move ${
                  isHighlighted ? 'ring-4 ring-green-500 ring-opacity-75' : ''
                } ${
                  isSelected ? 'ring-4 ring-purple-500 ring-opacity-75' : ''
                }`}
                style={{
                  left: table.x,
                  top: table.y,
                  transform: `rotate(${table.rotation}deg)`,
                  width: 120,
                  height: 80
                }}
              >
                <div className={`${tableColors[table.table_type as keyof typeof tableColors]} text-white rounded-lg p-3 shadow-lg h-full relative`}>
                  <div className="text-center">
                    <div className="font-bold text-lg">Table {table.table_number}</div>
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
                          openEditModal(table)
                        }}
                        className="bg-white/20 hover:bg-white/30 rounded p-1"
                        title="Edit Table"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          rotateTable(table.id)
                        }}
                        className="bg-white/20 hover:bg-white/30 rounded p-1"
                        title="Rotate Table"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTable(table.id)
                        }}
                        className="bg-white/20 hover:bg-white/30 rounded p-1"
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
          
          {isAttendeeView && attendeeTable && (
            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-2 rounded-lg">
              <div className="font-bold">Your Table: {attendeeTable}</div>
            </div>
          )}
        </div>
        
        {/* Multi-select info */}
        {isMultiSelectMode && selectedTables.size > 0 && (
          <div className="mt-2 p-2 bg-purple-100 rounded-lg">
            <p className="text-sm text-purple-800">
              {selectedTables.size} table(s) selected
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