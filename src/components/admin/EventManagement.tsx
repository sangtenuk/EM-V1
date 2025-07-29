/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { Plus, Calendar, MapPin, Users, Edit, Trash2, ExternalLink, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'

interface Event {
  id: string
  company_id: string
  name: string
  description: string | null
  date: string | null
  location: string | null
  max_attendees: number | null
  created_at: string
  company: {
    name: string
  }
  attendee_count?: number
  checked_in_count?: number
  registration_qr?: string
}

interface Company {
  id: string
  name: string
}

interface EventManagementProps {
  userCompany?: any
}

export default function EventManagement({ userCompany }: EventManagementProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    company_id: '',
    name: '',
    description: '',
    date: '',
    location: '',
    max_attendees: 1000
  })

  useEffect(() => {
    fetchEvents()
    fetchCompanies()
  }, [])

  const fetchEvents = async () => {
    try {
      let query = supabase.from('events').select(`
          *,
          company:companies(name)
        `)

      // Filter by company if user is a company user
      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data: eventsData, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Ensure company is a single object, not an array
      const formattedEvents = eventsData?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      })) || []

      // Fetch attendee counts for each event
      const eventsWithCounts = await Promise.all(
        formattedEvents.map(async (event) => {
          const { data: attendees } = await supabase
            .from('attendees')
            .select('id, checked_in')
            .eq('event_id', event.id)

          return {
            ...event,
            attendee_count: attendees?.length || 0,
            checked_in_count: attendees?.filter(a => a.checked_in).length || 0
          }
        })
      )

      setEvents(eventsWithCounts)
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanies = async () => {
    try {
      let query = supabase.from('companies').select('*').order('name')

      // Filter to only user's company if they are a company user
      if (userCompany) {
        query = query.eq('id', userCompany.company_id)
      }

      const { data, error } = await query

      if (error) throw error
      setCompanies(data)
    } catch (error: any) {
      toast.error('Error fetching companies: ' + error.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.company_id) return

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update({
            company_id: formData.company_id,
            name: formData.name,
            description: formData.description || null,
            date: formData.date || null,
            location: formData.location || null,
            max_attendees: formData.max_attendees
          })
          .eq('id', editingEvent.id)

        if (error) throw error
        toast.success('Event updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert([{
            company_id: formData.company_id,
            name: formData.name,
            description: formData.description || null,
            date: formData.date || null,
            location: formData.location || null,
            max_attendees: formData.max_attendees
          }])
          .select()

        if (error) throw error

        // Generate QR code for event registration
        const baseUrl = 'https://nw.hopto.org'
      // OVERIDE const registrationUrl = `${window.location.origin}/public/register/${data[0].id}`
        const registrationUrl = `${baseUrl}/public/register/${data[0].id}`
        const qrCodeDataUrl = await QRCodeLib.toDataURL(registrationUrl, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M'
        })

        // Update event with QR code
        await supabase
          .from('events')
          .update({ registration_qr: qrCodeDataUrl })
          .eq('id', data[0].id)

        toast.success('Event created successfully!')
      }

      resetForm()
      fetchEvents()
    } catch (error: any) {
      toast.error('Error saving event: ' + error.message)
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also delete all attendees.')) return

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      toast.success('Event deleted successfully!')
      fetchEvents()
    } catch (error: any) {
      toast.error('Error deleting event: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      company_id: userCompany ? userCompany.company_id : '',
      name: '',
      description: '',
      date: '',
      location: '',
      max_attendees: 1000
    })
    setEditingEvent(null)
    setShowModal(false)
  }

  const openEditModal = (event: Event) => {
    setEditingEvent(event)
    setFormData({
      company_id: userCompany ? userCompany.company_id : event.company_id,
      name: event.name,
      description: event.description || '',
      date: event.date ? new Date(event.date).toISOString().slice(0, 16) : '',
      location: event.location || '',
      max_attendees: event.max_attendees || 1000
    })
    setShowModal(true)
  }

  const getRegistrationUrl = (eventId: string) => {
    const baseUrl = 'https://nw.hopto.org'
    return `${baseUrl}/public/register/${eventId}`
    // OVERIDE return `${window.location.origin}/public/register/${eventId}`
  }

  const downloadQRCode = (event: Event) => {
    if (!event.registration_qr) return
    
    const link = document.createElement('a')
    link.href = event.registration_qr
    link.download = `${event.name}-registration-qr.png`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-lg mr-4">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Event Management</h1>
              <p className="text-gray-600 text-lg">Manage events across all companies</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 card-hover">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{event.name}</h3>
                <p className="text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{event.company.name}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(event)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {event.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2 bg-gray-50 p-3 rounded-lg">{event.description}</p>
            )}

            <div className="space-y-3 mb-4">
              {event.date && (
                <div className="flex items-center text-gray-600 text-sm bg-blue-50 p-2 rounded-lg">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>{new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center text-gray-600 text-sm bg-green-50 p-2 rounded-lg">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              <div className="flex items-center text-gray-600 text-sm bg-purple-50 p-2 rounded-lg">
                <Users className="h-4 w-4 mr-2" />
                <span>{event.attendee_count} registered • {event.checked_in_count} checked in</span>
              </div>
            </div>

            {/* QR Code Display */}
            {event.registration_qr && (
              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="text-center">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Registration QR Code</h4>
                  <div className="flex justify-center mb-3">
                    <img 
                      src={event.registration_qr} 
                      alt="Registration QR Code" 
                      className="w-32 h-32 border-2 border-gray-200 rounded-xl shadow-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mb-2 bg-gray-50 px-3 py-1 rounded-full">
                    Scan to register for this event
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(getRegistrationUrl(event.id))}
                    className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-all duration-300"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Copy Link
                  </button>
                  {event.registration_qr && (
                    <button
                      onClick={() => downloadQRCode(event)}
                      className="text-green-600 hover:text-green-700 text-sm font-semibold flex items-center bg-green-50 px-3 py-2 rounded-lg hover:bg-green-100 transition-all duration-300"
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      Download
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  Max: {event.max_attendees}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl w-fit mx-auto mb-6">
            <Calendar className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No events found</h3>
          <p className="text-gray-600 mb-6 text-lg">Create your first event to get started</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg font-semibold"
          >
            Add Event
          </button>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {userCompany ? 'Company' : 'Company *'}
                </label>
                {userCompany ? (
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                    {companies.find(c => c.id === userCompany.company_id)?.name || 'Your Company'}
                  </div>
                ) : (
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                    required
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  placeholder="Enter event name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  rows={3}
                  placeholder="Enter event description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Attendees
                  </label>
                  <input
                    type="number"
                    value={formData.max_attendees}
                    onChange={(e) => setFormData({ ...formData, max_attendees: parseInt(e.target.value) || 1000 })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                  placeholder="Enter event location"
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
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 font-semibold shadow-lg"
                >
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}