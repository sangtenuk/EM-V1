import { useState, useEffect } from 'react'
import { MapPin, Plus, Users, Edit, Trash2, Save, Shuffle } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import toast from 'react-hot-toast'
import VenueLayout from './VenueLayout'
import { useSearchParams } from 'react-router-dom'

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
  identification_number: string
}

interface SeatingArrangementProps {
  userCompany?: any
}

export default function SeatingArrangement({ userCompany }: SeatingArrangementProps) {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [tables, setTables] = useState<Table[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [draggedAttendee, setDraggedAttendee] = useState<Attendee | null>(null)
  const [loading, setLoading] = useState(true)
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

  // Handle eventId from URL parameters
  useEffect(() => {
    const eventIdFromUrl = searchParams.get('eventId')
    if (eventIdFromUrl && events.length > 0) {
      setSelectedEventId(eventIdFromUrl)
    }
  }, [searchParams, events])

  useEffect(() => {
    console.log('Selected event changed:', selectedEventId)
    if (selectedEventId) {
      fetchTables()
      fetchAttendees()
    }
  }, [selectedEventId])

  const fetchEvents = async () => {
    try {
      setLoading(true)
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
      
      console.log('Fetched events:', transformedData) // Debug log
      setEvents(transformedData)

      // Auto-select first event for company users
      if (userCompany && transformedData && transformedData.length > 0) {
        setSelectedEventId(transformedData[0].id)
      }
    } catch (error: any) {
      console.error('Error fetching events:', error) // Debug log
      toast.error('Error fetching events: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTables = async () => {
    try {
      console.log('Fetching tables for event:', selectedEventId)
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('table_number')

      if (error) throw error
      console.log('Fetched tables:', data)
      setTables(data || [])
    } catch (error: any) {
      console.error('Error fetching tables:', error)
      toast.error('Error fetching tables: ' + error.message)
    }
  }

  const fetchAttendees = async () => {
    try {
      console.log('Fetching attendees for event:', selectedEventId)
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('name')

      if (error) throw error
      console.log('Fetched attendees:', data)
      setAttendees(data || [])
    } catch (error: any) {
      console.error('Error fetching attendees:', error)
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
            table_number: tableForm.table_number,
            table_type: tableForm.table_type,
            capacity: tableForm.capacity
          })
          .eq('id', editingTable.id)

        if (error) throw error
        toast.success('Table updated successfully!')
      } else {
        // Create multiple tables based on quantity
        const tablesToCreate = []
        for (let i = 0; i < tableForm.quantity; i++) {
          tablesToCreate.push({
            event_id: selectedEventId,
            table_number: tableForm.table_number + i,
            table_type: tableForm.table_type,
            capacity: tableForm.capacity,
            x: 100 + (i * 150),
            y: 100 + (i * 100),
            rotation: 0
          })
        }

        const { error } = await supabase
          .from('tables')
          .insert(tablesToCreate)

        if (error) throw error
        toast.success(`${tableForm.quantity} table(s) created successfully!`)
      }

      setShowTableModal(false)
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

      toast.success(`${assignments.length} attendees randomly assigned to tables`)
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error randomizing seating: ' + error.message)
    }
  }

  const handleDragStart = (e: React.DragEvent, attendee: Attendee) => {
    setDraggedAttendee(attendee)
    e.dataTransfer.setData('text/plain', attendee.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, tableNumber: number) => {
    e.preventDefault()
    if (!draggedAttendee) return

    await assignAttendeeToTable(draggedAttendee.id, tableNumber)
    setDraggedAttendee(null)
  }

  const handleDropUnassigned = async (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedAttendee) return

    await assignAttendeeToTable(draggedAttendee.id, null)
    setDraggedAttendee(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  if (!selectedEventId) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Seating Arrangement</h1>
            <p className="text-gray-600 mt-2">Manage table layouts and assign attendees to tables</p>
          </div>
        </div>

        {/* Event Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Event
              </label>
              {events.length === 0 ? (
                <div className="w-full px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    No events found. {userCompany ? 'Create an event first to manage seating.' : 'Please create events to manage seating arrangements.'}
                  </div>
                </div>
              ) : userCompany && events.length === 1 ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                  {events[0].name}
                </div>
              ) : (
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose an event to manage seating</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {userCompany ? event.name : `${event.name} (${event.company.name})`}
                    </option>
                  ))}
                </select>
              )}
              
              {events.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  {events.length} event{events.length !== 1 ? 's' : ''} available
                </div>
              )}
            </div>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Available</h3>
            <p className="text-gray-600 mb-4">You need to create events first before managing seating arrangements.</p>
            <a
              href="/admin/events"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </a>
          </div>
        ) : (
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Event</h3>
            <p className="text-gray-600">Choose an event from the dropdown above to manage seating arrangements</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Seating Arrangement</h1>
          <p className="text-gray-600 mt-2">Manage table layouts and assign attendees to tables</p>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-yellow-800">Debug Info:</h3>
        <p className="text-sm text-yellow-700">Selected Event ID: {selectedEventId}</p>
        <p className="text-sm text-yellow-700">Tables Count: {tables.length}</p>
        <p className="text-sm text-yellow-700">Attendees Count: {attendees.length}</p>
        <p className="text-sm text-yellow-700">Events Count: {events.length}</p>
      </div>

      {/* Event Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Event
            </label>
            {events.length === 0 ? (
              <div className="w-full px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  No events found. {userCompany ? 'Create an event first to manage seating.' : 'Please create events to manage seating arrangements.'}
                </div>
              </div>
            ) : userCompany && events.length === 1 ? (
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                {events[0].name}
              </div>
            ) : (
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an event to manage seating</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {userCompany ? event.name : `${event.name} (${event.company.name})`}
                  </option>
                ))}
              </select>
            )}
            
            {events.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {events.length} event{events.length !== 1 ? 's' : ''} available
              </div>
            )}
          </div>
          
          {selectedEventId && (
            <div className="flex items-end">
              <div className="bg-blue-50 rounded-lg p-4 w-full">
                <div className="text-sm text-blue-600 font-medium">Seating Summary</div>
                <div className="text-2xl font-bold text-blue-900">
                  {tables.length} tables
                </div>
                <div className="text-sm text-blue-600">
                  {attendees.filter(a => a.table_assignment).length} assigned
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEventId && (
        <>
          {/* Venue Layout */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Venue Layout</h2>
              <button
                onClick={() => {
                  setEditingTable(null)
                  resetTableForm()
                  setShowTableModal(true)
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </button>
            </div>
            {selectedEventId ? (
              <VenueLayout 
                eventId={selectedEventId} 
                userCompany={userCompany}
                isAttendeeView={false}
              />
            ) : (
              <div className="min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Please select an event to view venue layout</p>
                </div>
              </div>
            )}
          </div>

          {/* Attendee Assignment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Unassigned Attendees */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Unassigned Attendees</h2>
                <div className="flex gap-2">
                  {attendees.length === 0 && (
                    <button
                      onClick={() => window.open(`/admin/checkin`, '_blank')}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center text-sm"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Attendees
                    </button>
                  )}
                  <button
                    onClick={randomizeSeating}
                    disabled={attendees.length === 0}
                    className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 flex items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shuffle className="h-3 w-3 mr-1" />
                    Randomize
                  </button>
                </div>
              </div>
              
              <div
                className="min-h-[200px] border-2 border-dashed border-gray-300 rounded-lg p-4"
                onDragOver={handleDragOver}
                onDrop={handleDropUnassigned}
              >
                {attendees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No attendees found for this event</p>
                    <p className="text-sm mt-2">Attendees will appear here when they register</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-gray-400">You can:</p>
                      <div className="flex flex-col gap-2">
                        <a
                          href="/admin/checkin"
                          className="text-blue-600 hover:text-blue-700 text-sm underline"
                        >
                          Add attendees manually in Check-In System
                        </a>
                        <a
                          href={`/public/register/${selectedEventId}`}
                          target="_blank"
                          className="text-blue-600 hover:text-blue-700 text-sm underline"
                        >
                          Share registration link with attendees
                        </a>
                      </div>
                    </div>
                  </div>
                ) : unassignedAttendees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>All attendees assigned</p>
                  </div>
                ) : (
                  unassignedAttendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, attendee)}
                      className="bg-gray-50 p-3 rounded-lg mb-2 cursor-move hover:bg-gray-100"
                    >
                      <div className="font-medium">{attendee.name}</div>
                      <div className="text-sm text-gray-600">ID: {attendee.identification_number}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Table Assignments */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Table Assignments</h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {tables.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No tables created yet</p>
                    <p className="text-sm mt-2">Create tables to start assigning attendees</p>
                    <button
                      onClick={() => setShowTableModal(true)}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center mx-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Table
                    </button>
                  </div>
                ) : (
                  tables.map((table) => {
                const tableAttendees = getTableAttendees(table.table_number)
                return (
                  <div
                    key={table.id}
                        className={`${tableColors[table.table_type as keyof typeof tableColors]} text-white rounded-lg p-4`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, table.table_number)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">Table {table.table_number}</div>
                        <div className="text-sm opacity-90">{table.table_type}</div>
                      </div>
                          <div className="text-sm">
                            {tableAttendees.length}/{table.capacity}
                      </div>
                    </div>
                        
                        <div className="space-y-2">
                          {tableAttendees.map((attendee) => (
                        <div 
                          key={attendee.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, attendee)}
                              className="bg-white/20 p-2 rounded cursor-move hover:bg-white/30"
                        >
                              <div className="font-medium">{attendee.name}</div>
                              <div className="text-xs opacity-90">ID: {attendee.identification_number}</div>
                        </div>
                      ))}
                          
                          {tableAttendees.length === 0 && (
                            <div className="text-center py-4 text-white/70">
                              <p>No attendees assigned</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

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
                  value={tableForm.table_number}
                  onChange={(e) => setTableForm({ ...tableForm, table_number: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Table Type</label>
                <select
                  value={tableForm.table_type}
                  onChange={(e) => setTableForm({ ...tableForm, table_type: e.target.value })}
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
                  value={tableForm.capacity}
                  onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                  required
                />
              </div>
              {!editingTable && (
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    value={tableForm.quantity}
                    onChange={(e) => setTableForm({ ...tableForm, quantity: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                    min="1"
                    max="10"
                    required
                  />
                </div>
              )}
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