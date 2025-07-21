import { useState, useEffect } from 'react'
import { MapPin, Plus, Users, Edit, Trash2, Save, Shuffle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Event {
  id: string
  name: string
  company_id: string
  company: {
    name: string
  }
}

interface Table {
  id: string
  table_number: number
  table_type: string
  capacity: number
  attendees?: Attendee[]
}

interface Attendee {
  id: string
  name: string
  company: string | null
  table_assignment: string | null
}

interface SeatingArrangementProps {
  userCompany?: any
}

export default function SeatingArrangement({ userCompany }: SeatingArrangementProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [tables, setTables] = useState<Table[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [draggedAttendee, setDraggedAttendee] = useState<Attendee | null>(null)
  const [tableForm, setTableForm] = useState({
    table_number: 1,
    table_type: 'Regular',
    capacity: 8,
    quantity: 1
  })

  const tableTypes = ['VVIP', 'VIP', 'Regular', 'Staff']
  const tableColors = {
    'VVIP': 'bg-purple-500',
    'VIP': 'bg-yellow-500',
    'Regular': 'bg-blue-500',
    'Staff': 'bg-gray-500'
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchTables()
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

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('table_number')

      if (error) throw error
      setTables(data)
    } catch (error: any) {
      toast.error('Error fetching tables: ' + error.message)
    }
  }

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('id, name, company, table_assignment')
        .eq('event_id', selectedEventId)

      if (error) throw error
      setAttendees(data)
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    }
  }

  const handleTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingTable) {
        const { error } = await supabase
          .from('tables')
          .update({
            table_number: tableForm.table_number,
            table_type: tableForm.table_type,
            capacity: tableForm.capacity
          })
          .eq('id', editingTable.id)

        if (error) throw error
        toast.success('Table updated successfully')
      } else {
        // Create multiple tables
        const tablesToInsert = []
        const startingNumber = tableForm.table_number
        
        for (let i = 0; i < tableForm.quantity; i++) {
          tablesToInsert.push({
            event_id: selectedEventId,
            table_number: startingNumber + i,
            table_type: tableForm.table_type,
            capacity: tableForm.capacity
          })
        }

        const { error } = await supabase
          .from('tables')
          .insert(tablesToInsert)

        if (error) throw error
        toast.success(`${tableForm.quantity} table(s) created successfully`)
      }

      resetTableForm()
      fetchTables()
    } catch (error: any) {
      toast.error('Error saving table: ' + error.message)
    }
  }

  const deleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table? Attendees will be unassigned.')) return

    try {
      // First, unassign attendees from this table
      await supabase
        .from('attendees')
        .update({ table_assignment: null })
        .eq('table_assignment', tables.find(t => t.id === tableId)?.table_number.toString())

      // Then delete the table
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId)

      if (error) throw error
      toast.success('Table deleted successfully')
      fetchTables()
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error deleting table: ' + error.message)
    }
  }

  const assignAttendeeToTable = async (attendeeId: string, tableNumber: number | null) => {
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ table_assignment: tableNumber?.toString() || null })
        .eq('id', attendeeId)

      if (error) throw error
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error assigning attendee: ' + error.message)
    }
  }

  const resetTableForm = () => {
    setTableForm({
      table_number: Math.max(...tables.map(t => t.table_number), 0) + 1,
      table_type: 'Regular',
      capacity: 8,
      quantity: 1
    })
    setEditingTable(null)
    setShowTableModal(false)
  }

  const openEditModal = (table: Table) => {
    setEditingTable(table)
    setTableForm({
      table_number: table.table_number,
      table_type: table.table_type,
      capacity: table.capacity,
      quantity: 1
    })
    setShowTableModal(true)
  }

  const getTableAttendees = (tableNumber: number) => {
    return attendees.filter(a => a.table_assignment === tableNumber.toString())
  }

  const unassignedAttendees = attendees.filter(a => !a.table_assignment)

  const randomizeSeating = async () => {
    if (!confirm('This will randomly assign all unassigned attendees to available regular tables. Continue?')) return

    try {
      // Get all regular tables with available seats
      const regularTables = tables.filter(table => table.table_type === 'Regular')
      const availableSeats: { tableNumber: number; availableSeats: number }[] = []
      
      regularTables.forEach(table => {
        const currentAttendees = getTableAttendees(table.table_number)
        const available = table.capacity - currentAttendees.length
        if (available > 0) {
          availableSeats.push({
            tableNumber: table.table_number,
            availableSeats: available
          })
        }
      })

      if (availableSeats.length === 0) {
        toast.error('No available seats in regular tables')
        return
      }

      // Shuffle unassigned attendees
      const shuffledAttendees = [...unassignedAttendees].sort(() => Math.random() - 0.5)
      const assignments: { attendeeId: string; tableNumber: number }[] = []

      // Assign attendees to tables
      let currentTableIndex = 0
      let currentTableSeatsUsed = 0

      for (const attendee of shuffledAttendees) {
        if (currentTableIndex >= availableSeats.length) break

        const currentTable = availableSeats[currentTableIndex]
        assignments.push({
          attendeeId: attendee.id,
          tableNumber: currentTable.tableNumber
        })

        currentTableSeatsUsed++
        if (currentTableSeatsUsed >= currentTable.availableSeats) {
          currentTableIndex++
          currentTableSeatsUsed = 0
        }
      }

      // Update database with assignments
      for (const assignment of assignments) {
        await supabase
          .from('attendees')
          .update({ table_assignment: assignment.tableNumber.toString() })
          .eq('id', assignment.attendeeId)
      }

      toast.success(`${assignments.length} attendees randomly assigned to regular tables`)
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error randomizing seating: ' + error.message)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, attendee: Attendee) => {
    setDraggedAttendee(attendee)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, tableNumber: number) => {
    e.preventDefault()
    
    if (!draggedAttendee) return

    const table = tables.find(t => t.table_number === tableNumber)
    if (!table) return

    const currentAttendees = getTableAttendees(tableNumber)
    if (currentAttendees.length >= table.capacity) {
      toast.error('Table is full')
      return
    }

    await assignAttendeeToTable(draggedAttendee.id, tableNumber)
    setDraggedAttendee(null)
  }

  const handleDropUnassigned = async (e: React.DragEvent) => {
    e.preventDefault()
    
    if (!draggedAttendee) return

    await assignAttendeeToTable(draggedAttendee.id, null)
    setDraggedAttendee(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Seating Arrangement</h1>
          <p className="text-gray-600 mt-2">Manage tables and assign attendees</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={randomizeSeating}
            disabled={!selectedEventId || unassignedAttendees.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Shuffle className="h-5 w-5 mr-2" />
            Randomize Seating
          </button>
          <button
            onClick={() => setShowTableModal(true)}
            disabled={!selectedEventId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Table
          </button>
        </div>
      </div>

      {/* Event Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {!userCompany && <option value="">Choose an event</option>}
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {userCompany ? event.name : `${event.name} (${event.company.name})`}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {selectedEventId && (
            <div className="flex items-end">
              <div className="bg-blue-50 rounded-lg p-4 w-full">
                <div className="text-sm text-blue-600 font-medium">Seating Summary</div>
                <div className="text-2xl font-bold text-blue-900">
                  {tables.reduce((sum, table) => sum + table.capacity, 0)} seats
                </div>
                <div className="text-sm text-blue-600">
                  {tables.length} tables • {attendees.filter(a => a.table_assignment).length} assigned
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEventId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table Layout */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <MapPin className="h-6 w-6 mr-2" />
              Table Layout
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {tables.map((table) => {
                const tableAttendees = getTableAttendees(table.table_number)
                return (
                  <div
                    key={table.id}
                    className={`relative p-4 rounded-lg text-white ${tableColors[table.table_type as keyof typeof tableColors]} hover:opacity-80 transition-opacity`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, table.table_number)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">Table {table.table_number}</div>
                        <div className="text-sm opacity-90">{table.table_type}</div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => openEditModal(table)}
                          className="text-white hover:text-gray-200 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTable(table.id)}
                          className="text-white hover:text-red-200 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm">
                      {tableAttendees.length} / {table.capacity} seats
                    </div>
                    <div className="mt-2 space-y-1">
                      {tableAttendees.slice(0, 3).map((attendee) => (
                        <div 
                          key={attendee.id} 
                          className="text-xs bg-white bg-opacity-20 rounded px-2 py-1 truncate cursor-move"
                          draggable
                          onDragStart={(e) => handleDragStart(e, attendee)}
                        >
                          {attendee.name}
                        </div>
                      ))}
                      {tableAttendees.length > 3 && (
                        <div className="text-xs opacity-75">
                          +{tableAttendees.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {tables.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>No tables created yet</p>
                <p className="text-sm">Add tables to start arranging seating</p>
              </div>
            )}

            {/* Legend */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Table Types</h3>
              <div className="flex flex-wrap gap-2">
                {tableTypes.map((type) => (
                  <div key={type} className="flex items-center">
                    <div className={`w-4 h-4 rounded ${tableColors[type as keyof typeof tableColors]} mr-2`}></div>
                    <span className="text-sm">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attendee Assignment */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Users className="h-6 w-6 mr-2" />
              Unassigned Attendees
            </h2>
            
            <div 
              className="space-y-2 max-h-96 overflow-y-auto border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-32"
              onDragOver={handleDragOver}
              onDrop={handleDropUnassigned}
            >
              {unassignedAttendees.map((attendee) => (
                <div 
                  key={attendee.id} 
                  className="p-3 border border-gray-200 rounded-lg cursor-move hover:bg-gray-50 transition-colors"
                  draggable
                  onDragStart={(e) => handleDragStart(e, attendee)}
                >
                  <div className="font-medium text-gray-900">{attendee.name}</div>
                  {attendee.company && (
                    <div className="text-sm text-gray-600">{attendee.company}</div>
                  )}
                  <select
                    value=""
                    onChange={(e) => assignAttendeeToTable(attendee.id, e.target.value ? parseInt(e.target.value) : null)}
                    className="mt-2 w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">Assign to table...</option>
                    {tables.map((table) => {
                      const tableAttendees = getTableAttendees(table.table_number)
                      const isAvailable = tableAttendees.length < table.capacity
                      return (
                        <option 
                          key={table.id} 
                          value={table.table_number}
                          disabled={!isAvailable}
                        >
                          Table {table.table_number} ({table.table_type}) - {tableAttendees.length}/{table.capacity}
                          {!isAvailable && ' (Full)'}
                        </option>
                      )
                    })}
                  </select>
                </div>
              ))}
              
              {unassignedAttendees.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>All attendees assigned</p>
                  <p className="text-xs mt-1">Drag attendees here to unassign</p>
                </div>
              )}
            </div>

            {/* Assigned Attendees Summary */}
            {attendees.filter(a => a.table_assignment).length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-medium mb-2">Assigned Attendees</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {attendees.filter(a => a.table_assignment).map((attendee) => (
                    <div key={attendee.id} className="flex justify-between items-center text-sm">
                      <span>{attendee.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600">Table {attendee.table_assignment}</span>
                        <button
                          onClick={() => assignAttendeeToTable(attendee.id, null)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingTable ? 'Edit Table' : 'Add New Table'}
            </h2>
            <form onSubmit={handleTableSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table Number
                </label>
                <input
                  type="number"
                  value={tableForm.table_number}
                  onChange={(e) => setTableForm({ ...tableForm, table_number: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
                {!editingTable && (
                  <p className="text-sm text-gray-600 mt-1">
                    Starting table number (will increment for multiple tables)
                  </p>
                )}
              </div>

              {!editingTable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={tableForm.quantity}
                    onChange={(e) => setTableForm({ ...tableForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="20"
                    required
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Number of tables to create with these settings
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table Type
                </label>
                <select
                  value={tableForm.table_type}
                  onChange={(e) => setTableForm({ ...tableForm, table_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tableTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity
                </label>
                <input
                  type="number"
                  value={tableForm.capacity}
                  onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 8 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="20"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetTableForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingTable ? 'Update Table' : `Create ${tableForm.quantity} Table${tableForm.quantity > 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}