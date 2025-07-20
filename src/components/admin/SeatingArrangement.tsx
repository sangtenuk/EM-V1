import { useState, useEffect } from 'react'
import { Users, MapPin, Edit, Trash2, Plus, Download } from 'lucide-react'
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

interface Attendee {
  id: string
  name: string
  email: string
  company: string
  table_number?: number
  seat_number?: number
}

interface SeatingArrangementProps {
  userCompany?: any
}

export default function SeatingArrangement({ userCompany }: SeatingArrangementProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [tables, setTables] = useState<number>(10)
  const [seatsPerTable, setSeatsPerTable] = useState<number>(8)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null)
  const [assignForm, setAssignForm] = useState({
    table_number: '',
    seat_number: ''
  })

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
        .select('*')
        .eq('event_id', selectedEventId)
        .order('name')

      if (error) throw error
      setAttendees(data)
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    }
  }

  const handleAssignSeat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAttendee) return

    try {
      const { error } = await supabase
        .from('attendees')
        .update({
          table_number: parseInt(assignForm.table_number),
          seat_number: parseInt(assignForm.seat_number)
        })
        .eq('id', selectedAttendee.id)

      if (error) throw error
      toast.success('Seat assigned successfully')
      setShowAssignModal(false)
      setSelectedAttendee(null)
      setAssignForm({ table_number: '', seat_number: '' })
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error assigning seat: ' + error.message)
    }
  }

  const autoAssignSeats = async () => {
    if (!confirm('This will automatically assign seats to all unassigned attendees. Continue?')) return

    try {
      const unassignedAttendees = attendees.filter(a => !a.table_number)
      let currentTable = 1
      let currentSeat = 1

      for (const attendee of unassignedAttendees) {
        const { error } = await supabase
          .from('attendees')
          .update({
            table_number: currentTable,
            seat_number: currentSeat
          })
          .eq('id', attendee.id)

        if (error) throw error

        currentSeat++
        if (currentSeat > seatsPerTable) {
          currentSeat = 1
          currentTable++
        }
      }

      toast.success('Seats assigned automatically')
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error auto-assigning seats: ' + error.message)
    }
  }

  const clearAllSeats = async () => {
    if (!confirm('This will clear all seat assignments. Continue?')) return

    try {
      const { error } = await supabase
        .from('attendees')
        .update({
          table_number: null,
          seat_number: null
        })
        .eq('event_id', selectedEventId)

      if (error) throw error
      toast.success('All seat assignments cleared')
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error clearing seats: ' + error.message)
    }
  }

  const exportSeatingChart = () => {
    const seatingData = attendees
      .filter(a => a.table_number)
      .map(a => ({
        Name: a.name,
        Email: a.email,
        Company: a.company,
        Table: a.table_number,
        Seat: a.seat_number
      }))

    const csv = [
      Object.keys(seatingData[0] || {}).join(','),
      ...seatingData.map(row => Object.values(row).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seating-chart-${selectedEventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openAssignModal = (attendee: Attendee) => {
    setSelectedAttendee(attendee)
    setAssignForm({
      table_number: attendee.table_number?.toString() || '',
      seat_number: attendee.seat_number?.toString() || ''
    })
    setShowAssignModal(true)
  }

  const getTableAttendees = (tableNumber: number) => {
    return attendees
      .filter(a => a.table_number === tableNumber)
      .sort((a, b) => (a.seat_number || 0) - (b.seat_number || 0))
  }

  const assignedCount = attendees.filter(a => a.table_number).length
  const unassignedCount = attendees.length - assignedCount

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Seating Arrangement</h1>
          <p className="text-gray-600 mt-2">Manage table assignments for event attendees</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportSeatingChart}
            disabled={assignedCount === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Download className="h-5 w-5 mr-2" />
            Export Chart
          </button>
          <button
            onClick={autoAssignSeats}
            disabled={unassignedCount === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Users className="h-5 w-5 mr-2" />
            Auto Assign
          </button>
          <button
            onClick={clearAllSeats}
            disabled={assignedCount === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Clear All
          </button>
        </div>
      </div>

      {/* Event Selection and Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Tables
            </label>
            <input
              type="number"
              value={tables}
              onChange={(e) => setTables(parseInt(e.target.value) || 1)}
              min="1"
              max="50"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seats per Table
            </label>
            <input
              type="number"
              value={seatsPerTable}
              onChange={(e) => setSeatsPerTable(parseInt(e.target.value) || 1)}
              min="1"
              max="20"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Status
            </label>
            <div className="text-sm">
              <div className="text-green-600">Assigned: {assignedCount}</div>
              <div className="text-orange-600">Unassigned: {unassignedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {selectedEventId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unassigned Attendees */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Users className="h-6 w-6 mr-2" />
              Unassigned Attendees ({unassignedCount})
            </h2>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {attendees
                .filter(attendee => !attendee.table_number)
                .map((attendee) => (
                  <div key={attendee.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{attendee.name}</div>
                      <div className="text-sm text-gray-600">{attendee.company}</div>
                    </div>
                    <button
                      onClick={() => openAssignModal(attendee)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              
              {unassignedCount === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>All attendees have been assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Seating Chart */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <MapPin className="h-6 w-6 mr-2" />
                Seating Chart
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {Array.from({ length: tables }, (_, i) => i + 1).map((tableNumber) => {
                  const tableAttendees = getTableAttendees(tableNumber)
                  
                  return (
                    <div key={tableNumber} className="border rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3 text-center">
                        Table {tableNumber}
                      </h3>
                      
                      <div className="space-y-2">
                        {Array.from({ length: seatsPerTable }, (_, i) => i + 1).map((seatNumber) => {
                          const attendee = tableAttendees.find(a => a.seat_number === seatNumber)
                          
                          return (
                            <div
                              key={seatNumber}
                              className={`p-2 rounded text-sm ${
                                attendee
                                  ? 'bg-blue-100 border border-blue-300'
                                  : 'bg-gray-50 border border-gray-200'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium">Seat {seatNumber}</span>
                                {attendee && (
                                  <button
                                    onClick={() => openAssignModal(attendee)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {attendee && (
                                <div className="mt-1">
                                  <div className="font-medium text-gray-900">{attendee.name}</div>
                                  <div className="text-xs text-gray-600">{attendee.company}</div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedAttendee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Assign Seat</h2>
            <div className="mb-4">
              <h3 className="font-medium text-gray-900">{selectedAttendee.name}</h3>
              <p className="text-sm text-gray-600">{selectedAttendee.company}</p>
            </div>
            
            <form onSubmit={handleAssignSeat} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table Number *
                </label>
                <select
                  value={assignForm.table_number}
                  onChange={(e) => setAssignForm({ ...assignForm, table_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select table</option>
                  {Array.from({ length: tables }, (_, i) => i + 1).map((tableNumber) => (
                    <option key={tableNumber} value={tableNumber}>
                      Table {tableNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seat Number *
                </label>
                <select
                  value={assignForm.seat_number}
                  onChange={(e) => setAssignForm({ ...assignForm, seat_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!assignForm.table_number}
                >
                  <option value="">Select seat</option>
                  {assignForm.table_number && Array.from({ length: seatsPerTable }, (_, i) => i + 1).map((seatNumber) => {
                    const isOccupied = attendees.some(a => 
                      a.table_number === parseInt(assignForm.table_number) && 
                      a.seat_number === seatNumber &&
                      a.id !== selectedAttendee.id
                    )
                    
                    return (
                      <option key={seatNumber} value={seatNumber} disabled={isOccupied}>
                        Seat {seatNumber} {isOccupied ? '(Occupied)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedAttendee(null)
                    setAssignForm({ table_number: '', seat_number: '' })
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Assign Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}