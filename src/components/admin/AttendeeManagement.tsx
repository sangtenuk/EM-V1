import { useState, useEffect } from 'react'
import { Users, Plus, Edit, Trash2, Search, Download, Upload, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHybridDB } from '../../lib/hybridDB'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'
import { useSearchParams } from 'react-router-dom'

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
  email: string | null
  phone: string | null
  identification_number: string
  staff_id: string | null
  table_assignment: string | null
  table_type: string
  checked_in: boolean
  check_in_time: string | null
  created_at: string
  event_id: string
  qr_code?: string
}

interface AttendeeManagementProps {
  userCompany?: any
}

export default function AttendeeManagement({ userCompany }: AttendeeManagementProps) {
  const { getEvents: getEventsHybrid, getAttendees: getAttendeesHybrid, createAttendee: createAttendeeHybrid, updateAttendee: updateAttendeeHybrid, deleteAttendee: deleteAttendeeHybrid } = useHybridDB();
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loading, setLoading] = useState(true)
  const [attendeeLoading, setAttendeeLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'checked-in' | 'not-checked-in'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null)
  const [attendeeForm, setAttendeeForm] = useState({
    name: '',
    email: '',
    phone: '',
    identification_number: '',
    staff_id: '',
    table_type: 'Regular'
  })

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
    }
  }, [selectedEventId])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const events = await getEventsHybrid(userCompany?.company_id)
      
      const transformedData = events?.map(event => ({
        ...event,
        company: { name: 'Company' } // Will be populated from companies
      })) || []
      
      setEvents(transformedData)

      if (userCompany && transformedData && transformedData.length > 0) {
        setSelectedEventId(transformedData[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendees = async () => {
    try {
      setAttendeeLoading(true)
      const attendees = await getAttendeesHybrid(selectedEventId)
      setAttendees(attendees || [])
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    } finally {
      setAttendeeLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingAttendee(null)
    setAttendeeForm({
      name: '',
      email: '',
      phone: '',
      identification_number: '',
      staff_id: '',
      table_type: 'Regular'
    })
    setShowModal(true)
  }

  const openEditModal = (attendee: Attendee) => {
    setEditingAttendee(attendee)
    setAttendeeForm({
      name: attendee.name,
      email: attendee.email || '',
      phone: attendee.phone || '',
      identification_number: attendee.identification_number,
      staff_id: attendee.staff_id || '',
      table_type: attendee.table_type || 'Regular'
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!attendeeForm.name.trim() || !attendeeForm.identification_number.trim()) {
      toast.error('Name and Identification Number are required')
      return
    }

    try {
      // Check uniqueness before saving
      const conflicts = await checkUniqueness(
        attendeeForm.name,
        attendeeForm.identification_number,
        attendeeForm.staff_id,
        editingAttendee?.id
      );

      if (conflicts.length > 0) {
        toast.error(`Validation failed: ${conflicts.join(', ')}`);
        return;
      }

      if (editingAttendee) {
        // Update attendee using hybrid database
        await updateAttendeeHybrid(editingAttendee.id, {
          name: attendeeForm.name,
          email: attendeeForm.email || null,
          phone: attendeeForm.phone || null,
          identification_number: attendeeForm.identification_number,
          staff_id: attendeeForm.staff_id || null,
          table_type: attendeeForm.table_type
        })
        toast.success('Attendee updated successfully!')
      } else {
        // Create new attendee using hybrid database
        await createAttendeeHybrid({
          ...attendeeForm,
          event_id: selectedEventId,
          checked_in: false,
          check_in_time: null,
          table_type: attendeeForm.table_type
        })
        toast.success('Attendee created successfully!')
      }

      setShowModal(false)
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error saving attendee: ' + error.message)
    }
  }

  const deleteAttendee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendee?')) return

    try {
      await deleteAttendeeHybrid(id)
      toast.success('Attendee deleted successfully!')
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error deleting attendee: ' + error.message)
    }
  }

  const resetCheckIn = async (id: string) => {
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ checked_in: false, check_in_time: null })
        .eq('id', id)

      if (error) throw error
      toast.success('Check-in status reset!')
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error resetting check-in: ' + error.message)
    }
  }

  const generateAttendeeQRCode = async (attendee: Attendee) => {
    try {
      const currentPort = window.location.port || '5174';
      const baseUrl = window.location.port 
        ? `${window.location.protocol}//${window.location.hostname}:${currentPort}`
        : window.location.origin;
      const checkInUrl = `${baseUrl}/public/checkin?event=${selectedEventId}&attendee=${attendee.id}`;
      
      const qrCodeDataUrl = await QRCodeLib.toDataURL(checkInUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

      // Update attendee with QR code
      const { error } = await supabase
        .from('attendees')
        .update({ qr_code: qrCodeDataUrl })
        .eq('id', attendee.id);

      if (error) throw error;

      toast.success('QR Code generated successfully!');
      fetchAttendees(); // Refresh the attendees list
    } catch (error: any) {
      toast.error('Error generating QR code: ' + error.message);
    }
  }

  const downloadAttendeeQRCode = (attendee: Attendee) => {
    if (!attendee.qr_code) return;
    
    const link = document.createElement('a');
    link.href = attendee.qr_code;
    link.download = `${attendee.name}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const generateAllQRCodes = async () => {
    try {
      const attendeesWithoutQR = attendees.filter(a => !a.qr_code);
      
      if (attendeesWithoutQR.length === 0) {
        toast.success('All attendees already have QR codes!');
        return;
      }

      toast.loading(`Generating QR codes for ${attendeesWithoutQR.length} attendees...`);

      for (const attendee of attendeesWithoutQR) {
        await generateAttendeeQRCode(attendee);
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success(`Generated QR codes for ${attendeesWithoutQR.length} attendees!`);
    } catch (error: any) {
      toast.error('Error generating QR codes: ' + error.message);
    }
  }

  const checkUniqueness = async (name: string, identification_number: string, staff_id: string, excludeId?: string) => {
    try {
      let query = supabase
        .from('attendees')
        .select('id, name, identification_number, staff_id')
        .eq('event_id', selectedEventId)
        .or(`name.eq.${name},identification_number.eq.${identification_number}`);

      if (staff_id) {
        query = query.or(`staff_id.eq.${staff_id}`);
      }

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const conflicts: string[] = [];
      if (data) {
        data.forEach(attendee => {
          if (attendee.name.toLowerCase() === name.toLowerCase()) {
            conflicts.push('Name already exists');
          }
          if (attendee.identification_number === identification_number) {
            conflicts.push('Identification number already exists');
          }
          if (staff_id && attendee.staff_id === staff_id) {
            conflicts.push('Staff ID already exists');
          }
        });
      }

      return conflicts;
    } catch (error: any) {
      console.error('Error checking uniqueness:', error);
      return ['Error checking uniqueness'];
    }
  }

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!selectedEventId) {
      toast.error('Please select an event first')
      return
    }

    try {
      const text = await file.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim())
      
      // Expected headers: Name, Email, Phone, ID Number, Staff ID, Table Type
      const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'))
      const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'))
      const phoneIndex = headers.findIndex(h => h.toLowerCase().includes('phone'))
      const idIndex = headers.findIndex(h => h.toLowerCase().includes('id') && !h.toLowerCase().includes('staff'))
      const staffIdIndex = headers.findIndex(h => h.toLowerCase().includes('staff'))
      const tableTypeIndex = headers.findIndex(h => h.toLowerCase().includes('table'))

      if (nameIndex === -1 || idIndex === -1) {
        toast.error('CSV must contain Name and ID Number columns')
        return
      }

      const attendees = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map(v => v.trim())
        const attendee = {
          name: values[nameIndex] || '',
          email: values[emailIndex] || null,
          phone: values[phoneIndex] || null,
          identification_number: values[idIndex] || '',
          staff_id: values[staffIdIndex] || null,
          table_type: values[tableTypeIndex] || 'Regular',
          event_id: selectedEventId,
          checked_in: false,
          check_in_time: null
        }

        if (attendee.name && attendee.identification_number) {
          attendees.push(attendee)
        }
      }

      if (attendees.length === 0) {
        toast.error('No valid attendees found in CSV')
        return
      }

      const { error } = await supabase
        .from('attendees')
        .insert(attendees)

      if (error) throw error

      toast.success(`${attendees.length} attendees imported successfully!`)
      fetchAttendees()
    } catch (error: any) {
      toast.error('Error importing CSV: ' + error.message)
    }

    // Reset file input
    event.target.value = ''
  }

  const exportAttendees = () => {
    const filteredAttendees = getFilteredAttendees()
    const csvContent = [
      ['Name', 'Email', 'Phone', 'ID Number', 'Staff ID', 'Table Type', 'Checked In', 'Check-in Time'],
      ...filteredAttendees.map(a => [
        a.name,
        a.email || '',
        a.phone || '',
        a.identification_number,
        a.staff_id || '',
        a.table_type || 'Regular',
        a.checked_in ? 'Yes' : 'No',
        a.check_in_time ? new Date(a.check_in_time).toLocaleString() : ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendees-${selectedEventId}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const getFilteredAttendees = () => {
    let filtered = attendees

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.identification_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.staff_id && a.staff_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.email && a.email.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filter by status
    if (filterStatus === 'checked-in') {
      filtered = filtered.filter(a => a.checked_in)
    } else if (filterStatus === 'not-checked-in') {
      filtered = filtered.filter(a => !a.checked_in)
    }

    return filtered
  }

  const filteredAttendees = getFilteredAttendees()

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

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendee Management</h1>
          <p className="text-gray-600 mt-2">Manage attendees for your events</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAddModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Attendee
          </button>
          <label className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </label>
          <button
            onClick={generateAllQRCodes}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center"
            title="Generate QR codes for all attendees"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Generate All QR
          </button>
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
                No events found. Create an event first.
              </div>
            ) : (
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an event</option>
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
                <div className="text-sm text-blue-600 font-medium">Attendee Summary</div>
                <div className="text-2xl font-bold text-blue-900">
                  {attendees.length} total
                </div>
                <div className="text-sm text-blue-600">
                  {attendees.filter(a => a.checked_in).length} checked in
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEventId && (
        <>
          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Attendees
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, ID, email..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Attendees</option>
                  <option value="checked-in">Checked In</option>
                  <option value="not-checked-in">Not Checked In</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={exportAttendees}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Attendees Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Attendees ({filteredAttendees.length})</h2>
            </div>
            
            {attendeeLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading attendees...</p>
              </div>
            ) : filteredAttendees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendees found</p>
                <p className="text-sm mt-2">Add attendees or adjust your search/filter</p>
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
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Table Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        QR Code
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
                            <div className="text-sm text-gray-500">ID: {attendee.identification_number}</div>
                            {attendee.staff_id && (
                              <div className="text-sm text-gray-500">Staff: {attendee.staff_id}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {attendee.email && <div>{attendee.email}</div>}
                            {attendee.phone && <div>{attendee.phone}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {attendee.table_type || 'Regular'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            attendee.checked_in 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {attendee.checked_in ? 'Checked In' : 'Not Checked In'}
                          </span>
                          {attendee.check_in_time && (
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(attendee.check_in_time).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {attendee.qr_code ? (
                              <img 
                                src={attendee.qr_code} 
                                alt="QR Code" 
                                className="w-8 h-8 border rounded"
                                title="Click to download"
                                onClick={() => downloadAttendeeQRCode(attendee)}
                                style={{ cursor: 'pointer' }}
                              />
                            ) : (
                              <button
                                onClick={() => generateAttendeeQRCode(attendee)}
                                className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-all duration-300"
                                title="Generate QR Code"
                              >
                                <QrCode className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditModal(attendee)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteAttendee(attendee.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {attendee.checked_in && (
                              <button
                                onClick={() => resetCheckIn(attendee.id)}
                                className="text-orange-600 hover:text-orange-900"
                                title="Reset Check-in"
                              >
                                <Users className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Attendee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingAttendee ? 'Edit Attendee' : 'Add Attendee'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={attendeeForm.name}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={attendeeForm.email}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={attendeeForm.phone}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, phone: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Identification Number *</label>
                <input
                  type="text"
                  value={attendeeForm.identification_number}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, identification_number: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Staff ID</label>
                <input
                  type="text"
                  value={attendeeForm.staff_id}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, staff_id: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Table Type</label>
                <select
                  value={attendeeForm.table_type}
                  onChange={(e) => setAttendeeForm({ ...attendeeForm, table_type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="Regular">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="VVIP">VVIP</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {editingAttendee ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}