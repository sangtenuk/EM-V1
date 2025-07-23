/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { Users, Search, Download, UserPlus, QrCode, Upload } from 'lucide-react'
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
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
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

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file')
      return
    }

    setImporting(true)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        toast.error('CSV file must have at least a header row and one data row')
        return
      }

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const requiredFields = ['name', 'identification_number']
      const missingFields = requiredFields.filter(field => !headers.includes(field))
      
      if (missingFields.length > 0) {
        toast.error(`Missing required columns: ${missingFields.join(', ')}`)
        return
      }

      // Parse data rows
      const attendeesToImport = []
      const errors = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row: any = {}
        
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        if (!row.name || !row.identification_number) {
          errors.push(`Row ${i + 1}: Missing name or identification number`)
          continue
        }

        const attendeeId = crypto.randomUUID()
        const qrData = `${attendeeId}|${formData.event_id}|${row.name}`
        
        try {
          const qrCodeDataUrl = await QRCodeLib.toDataURL(qrData, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'L'
          })

          attendeesToImport.push({
            id: attendeeId,
            event_id: formData.event_id,
            name: row.name,
            email: row.email || null,
            phone: row.phone || null,
            identification_number: row.identification_number,
            staff_id: row.staff_id || null,
            qr_code: qrCodeDataUrl
          })
        } catch (qrError) {
          errors.push(`Row ${i + 1}: Error generating QR code`)
        }
      }

      if (errors.length > 0) {
        toast.error(`Import errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`)
      }

      if (attendeesToImport.length === 0) {
        toast.error('No valid attendees to import')
        return
      }

      // Insert attendees in batches
      const batchSize = 50
      let imported = 0

      for (let i = 0; i < attendeesToImport.length; i += batchSize) {
        const batch = attendeesToImport.slice(i, i + batchSize)
        const { error } = await supabase
          .from('attendees')
          .insert(batch)

        if (error) {
          console.error('Batch import error:', error)
          toast.error(`Error importing batch: ${error.message}`)
        } else {
          imported += batch.length
        }
      }

      toast.success(`Successfully imported ${imported} attendees`)
      setShowImportModal(false)
      
      if (selectedEventId) {
        fetchAttendees()
      } else {
        fetchAllAttendees()
      }
    } catch (error: any) {
      toast.error('Error reading CSV file: ' + error.message)
    } finally {
      setImporting(false)
    }
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
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Download className="h-5 w-5 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Upload className="h-5 w-5 mr-2" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setFormData({ ...formData, event_id: selectedEventId })
              setShowModal(true)
            }}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Add Attendee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 mb-6">
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
                className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 bg-gray-50 focus:bg-white"
                placeholder="Search by name, email, ID number, or staff ID"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendees List */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-purple-600 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Identification
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all duration-300">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{attendee.name}</div>
                        {attendee.staff_id && (
                          <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full mt-1 inline-block">Staff: {attendee.staff_id}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">{attendee.identification_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{attendee.event.name}</div>
                        <div className="text-sm text-gray-500 bg-blue-50 px-2 py-1 rounded-full mt-1 inline-block">{attendee.event.company.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {attendee.email && <div>{attendee.email}</div>}
                        {attendee.phone && <div>{attendee.phone}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-2 text-xs font-bold rounded-full shadow-sm ${
                        attendee.checked_in
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                          : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                      }`}>
                        {attendee.checked_in ? 'Checked In' : 'Registered'}
                      </span>
                      {attendee.check_in_time && (
                        <div className="text-xs text-gray-500 mt-2 bg-gray-100 px-2 py-1 rounded-full">
                          {new Date(attendee.check_in_time).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => window.open(`/public/ticket/${attendee.id}`, '_blank')}
                        className="text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-all duration-300 font-semibold"
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
            <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl w-fit mx-auto mb-4">
              <Users className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No attendees found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'No attendees match your search criteria' : 'No attendees registered yet'}
            </p>
          </div>
        )}
      </div>

      {/* Add Attendee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Add New Attendee</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event *
                </label>
                <select
                  value={formData.event_id}
                  onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                  placeholder="Enter phone number"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 font-semibold shadow-lg"
                >
                  Add Attendee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Import Attendees from CSV</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Event *
              </label>
              <select
                value={formData.event_id}
                onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300"
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

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File *
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                disabled={!formData.event_id || importing}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 disabled:opacity-50"
              />
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6 border border-purple-100">
              <h3 className="font-semibold text-purple-900 mb-3">CSV Format Requirements:</h3>
              <ul className="text-sm text-purple-800 space-y-2">
                <li>• Required columns: <code>name</code>, <code>identification_number</code></li>
                <li>• Optional columns: <code>email</code>, <code>phone</code>, <code>staff_id</code></li>
                <li>• First row must be headers</li>
                <li>• Use comma separation</li>
              </ul>
            </div>

            {importing && (
              <div className="mb-6 text-center">
                <div className="relative mx-auto w-fit">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                  <Upload className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-purple-600 animate-pulse" />
                </div>
                <p className="text-sm text-gray-600 mt-3 font-medium">Importing attendees...</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-300 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}