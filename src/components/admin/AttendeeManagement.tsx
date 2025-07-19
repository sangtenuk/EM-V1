import React, { useState, useEffect } from 'react'
import { Users, Search, Download, UserPlus, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'

interface Attendee {
  id: string
  event_id: string
  name: string
  email: string | null
  phone: string | null
  identification_number: string
  staff_id: string | null
  table_assignment: string | null
  qr_code: string | null
  checked_in: boolean
  check_in_time: string | null
  created_at: string
  event: {
    name: string
    company: {
      name: string
    }
  }
}

interface Event {
  id: string
  name: string
  company_id: string
  company: {
    name: string
  }
}

interface AttendeeManagementProps {
  userCompany?: any
}

export default function AttendeeManagement({ userCompany }: AttendeeManagementProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    event_id: '',
    name: '',
    email: '',
    phone: '',
    identification_number: '',
    staff_id: ''
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchAttendees()
    } else {
      fetchAllAttendees()
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
      setEvents(data as unknown as Event[])

      // Auto-select first event for company users
      if (userCompany && data && data.length > 0) {
        setSelectedEventId(data[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    }
  }

  const fetchAttendees = async () => {
    try {
      setLoading(true)
      let query = supabase.from('attendees').select(`
          *,
          event:events(
            name,
            company:companies(name)
          )
        `)

      if (selectedEventId) {
        query = query.eq('event_id', selectedEventId)
      } else if (userCompany) {
        // Filter by company events if no specific event selected
        const companyEventIds = events.map(e => e.id)
        if (companyEventIds.length > 0) {
          query = query.in('event_id', companyEventIds)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setAttendees(data)
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllAttendees = async () => {
    try {
      setLoading(true)
      let query = supabase.from('attendees').select(`
          *,
          event:events(
            name,
            company:companies(name)
          )
        `)

      // Filter by company events for company users
      if (userCompany) {
        const companyEventIds = events.map(e => e.id)
        if (companyEventIds.length > 0) {
          query = query.in('event_id', companyEventIds)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      setAttendees(data)
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.event_id) return

    try {
      const attendeeId = crypto.randomUUID()
      
      // Create a simple QR data string instead of JSON to reduce size
      const qrData = `${attendeeId}|${formData.event_id}|${formData.name}`
      
      // Generate QR code with smaller size and lower error correction
      const qrCodeDataUrl = await QRCodeLib.toDataURL(qrData, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'L'
      })

      const { error } = await supabase
        .from('attendees')
        .insert([{
          id: attendeeId,
          event_id: formData.event_id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          identification_number: formData.identification_number,
          staff_id: formData.staff_id || null,
          qr_code: qrCodeDataUrl
        }])

      if (error) throw error

      toast.success('Attendee added successfully!')
      resetForm()
      if (selectedEventId) {
        fetchAttendees()
      } else {
        fetchAllAttendees()
      }
    } catch (error: any) {
      toast.error('Error adding attendee: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      event_id: selectedEventId,
      name: '',
      email: '',
      phone: '',
      identification_number: '',
      staff_id: ''
    })
    setShowModal(false)
  }

  const exportAttendees = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Event', 'Checked In', 'Check-in Time'],
      ...filteredAttendees.map(attendee => [
        attendee.name,
        attendee.email || '',
        attendee.phone || '',
        attendee.event.name,
        attendee.checked_in ? 'Yes' : 'No',
        attendee.check_in_time ? new Date(attendee.check_in_time).toLocaleString() : ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendees-${selectedEventId ? events.find(e => e.id === selectedEventId)?.name : 'all'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredAttendees = attendees.filter(attendee =>
    attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (attendee.identification_number && attendee.identification_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (attendee.staff_id && attendee.staff_id.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendee Management</h1>
          <p className="text-gray-600 mt-2">Manage event attendees and registrations</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportAttendees}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, event_id: selectedEventId })
              setShowModal(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Add Attendee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!userCompany && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Events</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.company.name})
                  </option>
                ))}
              </select>
            </div>
          )}
          {userCompany && events.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={userCompany && events.length <= 1 ? 'md:col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Attendees
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by name, email, ID number, or staff ID"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendees List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Identification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{attendee.name}</div>
                        {attendee.staff_id && (
                          <div className="text-sm text-gray-500">Staff: {attendee.staff_id}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{attendee.identification_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{attendee.event.name}</div>
                        <div className="text-sm text-gray-500">{attendee.event.company.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {attendee.email && <div>{attendee.email}</div>}
                        {attendee.phone && <div>{attendee.phone}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        attendee.checked_in
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {attendee.checked_in ? 'Checked In' : 'Registered'}
                      </span>
                      {attendee.check_in_time && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(attendee.check_in_time).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => window.open(`/public/ticket/${attendee.id}`, '_blank')}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        View Ticket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredAttendees.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No attendees found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No attendees match your search criteria' : 'No attendees registered yet'}
            </p>
          </div>
        )}
      </div>

      {/* Add Attendee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Attendee</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event *
                </label>
                <select
                  value={formData.event_id}
                  onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {userCompany ? event.name : `${event.name} (${event.company.name})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Identification Number *
                </label>
                <input
                  type="text"
                  value={formData.identification_number}
                  onChange={(e) => setFormData({ ...formData, identification_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter identification number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff ID
                </label>
                <input
                  type="text"
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter staff ID (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Attendee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}