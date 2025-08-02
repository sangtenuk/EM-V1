import { useState, useEffect } from 'react' 
import { Plus, Calendar, MapPin, Users, Edit, Trash2, ExternalLink, QrCode, Image, ArrowLeft, Vote, Gift, Monitor, BarChart3, Download, Building2, Search, Filter, SortAsc, SortDesc } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useParams, useNavigate } from 'react-router-dom'
import { useHybridDB, hybridDB, Event as HybridEvent } from '../../lib/hybridDB'
import QRCodeLib from 'qrcode'

interface UIEvent extends HybridEvent {
  company: { name: string; logo_url?: string };
  attendee_count: number;
  checked_in_count: number;
  offline_qr?: string | null;
  custom_background?: string | null;
  custom_logo?: string | null;
  max_gallery_uploads?: number;
}

interface Company {
  id: string
  name: string
  logo_url?: string
}

interface EventManagementProps {
  userCompany?: any
}

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `#${((hash >> 24) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 16) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 8) & 0xFF).toString(16).padStart(2, '0')}`;
  return color;
}

function getGradientColors(baseColor: string) {
  return {
    from: baseColor + '20',
    to: baseColor + '10',
    border: baseColor + '30'
  }
}

export default function EventManagement({ userCompany }: EventManagementProps) {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [events, setEvents] = useState<UIEvent[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<UIEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'attendees'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterCompany, setFilterCompany] = useState('')
  
  const [formData, setFormData] = useState({
    company_id: '',
    name: '',
    description: '',
    date: '',
    location: '',
    max_attendees: 1000,
    max_gallery_uploads: 2,
    mode: 'online' as 'offline' | 'online' | 'hybrid',
    custom_background: '',
    custom_logo: '',
  })

  useEffect(() => {
    fetchCompanies()
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          name,
          description,
          date,
          location,
          max_attendees,
          max_gallery_uploads,
          registration_qr,
          created_at,
          company_id,
          company:companies(name, logo_url)
        `)
        .order('created_at', { ascending: false });

      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id);
      }

      const { data: events, error } = await query;
      if (error) throw error;

      const eventIds = events?.map(e => e.id) || [];
      const { data: attendees, error: attendeesError } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in')
        .in('event_id', eventIds);

      if (attendeesError) throw attendeesError;

      const eventsWithStats: UIEvent[] = (events || []).map((event: any) => {
        const eventAttendees = attendees?.filter(a => a.event_id === event.id) || [];
        const attendee_count = eventAttendees.length;
        const checked_in_count = eventAttendees.filter(a => a.checked_in).length;

        return {
          ...event,
          company: Array.isArray(event.company) ? event.company[0] : event.company,
          attendee_count,
          checked_in_count,
          description: event.description ?? null,
          date: event.date ?? null,
          location: event.location ?? null,
          max_attendees: event.max_attendees ?? null,
          max_gallery_uploads: event.max_gallery_uploads ?? 2,
          registration_qr: event.registration_qr ?? null,
          created_at: event.created_at ?? '',
        };
      });

      setEvents(eventsWithStats);
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      let query = supabase.from('companies').select('id, name, logo_url').order('name')

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

  const filteredAndSortedEvents = events
    .filter(event => {
      const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.location?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCompany = !filterCompany || event.company_id === filterCompany
      return matchesSearch && matchesCompany
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date || '').getTime() - new Date(b.date || '').getTime()
          break
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'attendees':
          comparison = a.attendee_count - b.attendee_count
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company_id) return;
    
    try {
      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(formData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Event updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert([formData])
          .select();
        if (error) throw error;
        
        const eventId = data[0].id;
        const currentPort = window.location.port || '5174';
        const baseUrl = window.location.port 
          ? `${window.location.protocol}//${window.location.hostname}:${currentPort}`
          : window.location.origin;
        const registrationUrl = `${baseUrl}/public/register/${eventId}`;
        const qrCodeDataUrl = await QRCodeLib.toDataURL(registrationUrl, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        
        await supabase
          .from('events')
          .update({ registration_qr: qrCodeDataUrl })
          .eq('id', eventId);
        
        toast.success('Event created successfully!');
      }

      resetForm();
      fetchEvents();
    } catch (error: any) {
      toast.error('Error saving event: ' + error.message);
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also delete all attendees.')) return;
    try {
      await hybridDB.events.delete(eventId);
      await supabase.from('events').delete().eq('id', eventId);
      toast.success('Event deleted successfully!');
      fetchEvents();
    } catch (error: any) {
      toast.error('Error deleting event: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      company_id: userCompany ? userCompany.company_id : '',
      name: '',
      description: '',
      date: '',
      location: '',
      max_attendees: 1000,
      max_gallery_uploads: 2,
      mode: 'online',
      custom_background: '',
      custom_logo: '',
    })
    setEditingEvent(null)
    setShowModal(false)
  }

  const openEditModal = (event: UIEvent) => {
    setEditingEvent(event)
    setFormData({
      company_id: userCompany ? userCompany.company_id : event.company_id,
      name: event.name,
      description: event.description || '',
      date: event.date ? new Date(event.date).toISOString().slice(0, 16) : '',
      location: event.location || '',
      max_attendees: event.max_attendees || 1000,
      max_gallery_uploads: event.max_gallery_uploads || 2,
      mode: event.mode || 'online',
      custom_background: event.custom_background || '',
      custom_logo: event.custom_logo || '',
    })
    setShowModal(true)
  }

  const getRegistrationUrl = (eventId: string) => {
    const currentPort = window.location.port || '5174';
    const baseUrl = window.location.port 
      ? `${window.location.protocol}//${window.location.hostname}:${currentPort}`
      : window.location.origin;
    return `${baseUrl}/public/register/${eventId}`
  }

  const downloadQRCode = (event: UIEvent) => {
    if (!event.registration_qr) return;
    
    const link = document.createElement('a');
    link.href = event.registration_qr;
    link.download = `${event.name}-registration-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateNewQRCode = async (event: UIEvent) => {
    try {
      const currentPort = window.location.port || '5174';
      const baseUrl = window.location.port 
        ? `${window.location.protocol}//${window.location.hostname}:${currentPort}`
        : window.location.origin;
      const registrationUrl = `${baseUrl}/public/register/${event.id}`;
      
      const qrCodeDataUrl = await QRCodeLib.toDataURL(registrationUrl, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

      const { error } = await supabase
        .from('events')
        .update({ registration_qr: qrCodeDataUrl })
        .eq('id', event.id);

      if (error) throw error;

      toast.success('QR Code regenerated successfully!');
      fetchEvents();
    } catch (error: any) {
      toast.error('Error generating QR code: ' + error.message);
    }
  };

  const exportEventCSV = async (event: UIEvent) => {
    try {
      const { data: attendees, error: attendeesError } = await supabase
        .from('attendees')
        .select('*')
        .eq('event_id', event.id)

      if (attendeesError) throw attendeesError;

      let csvContent = `Event: ${event.name}\nDate: ${event.date || 'N/A'}\nLocation: ${event.location || 'N/A'}\n\nName,Email,Phone,Company,Staff ID,Status,Registration Date\n`;
      
      attendees?.forEach((attendee: any) => {
        const status = attendee.checked_in ? 'Checked In' : 'Not Checked'
        const registrationDate = new Date(attendee.created_at).toLocaleDateString()
        csvContent += `${attendee.name || 'N/A'},${attendee.email || 'N/A'},${attendee.phone || 'N/A'},${attendee.company || 'N/A'},${attendee.staff_id || 'N/A'},${status},${registrationDate}\n`
      })
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `event-export-${event.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Event CSV exported successfully!')
    } catch (error: any) {
      toast.error('Error exporting event: ' + error.message)
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Event Management
            </h1>
            <p className="text-gray-600 mt-1">Manage events across all companies</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/admin/events/quick-tools')}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-200 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              Quick Tools
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Event
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-xl font-bold text-gray-900">{events.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Attendees</p>
                <p className="text-xl font-bold text-gray-900">
                  {events.reduce((sum, event) => sum + event.attendee_count, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <QrCode className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-xl font-bold text-gray-900">
                  {events.reduce((sum, event) => sum + event.checked_in_count, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Companies</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Set(events.map(e => e.company_id)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'attendees')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="attendees">Sort by Attendees</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAndSortedEvents.map((event) => {
            const eventColor = stringToColor(event.company_id)
            const gradients = getGradientColors(eventColor)
            return (
              <div key={event.id} className="group bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
                {/* Event Header with Gradient */}
                <div 
                  className="p-4 text-white relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${eventColor}, ${eventColor}dd)`
                  }}
                >
                  <div className="absolute inset-0 bg-black opacity-10"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className="p-1.5 bg-white bg-opacity-20 rounded-lg mr-2">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold truncate">{event.name}</h3>
                          <p className="text-xs opacity-90">{event.company.name}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => openEditModal(event)}
                          className="p-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-all duration-200"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="p-1 bg-red-500 bg-opacity-20 rounded hover:bg-opacity-30 transition-all duration-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-lg font-bold">{event.attendee_count}</div>
                        <div className="text-xs opacity-90">Registered</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">{event.checked_in_count}</div>
                        <div className="text-xs opacity-90">Checked In</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold">
                          {event.attendee_count > 0 ? Math.round((event.checked_in_count / event.attendee_count) * 100) : 0}%
                        </div>
                        <div className="text-xs opacity-90">Rate</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-4">
                  {/* Event Details */}
                  <div className="space-y-2 mb-3">
                    {event.date && (
                      <div className="flex items-center text-gray-600 text-xs">
                        <Calendar className="h-3 w-3 mr-1.5 text-blue-500" />
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center text-gray-600 text-xs">
                        <MapPin className="h-3 w-3 mr-1.5 text-green-500" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {event.description && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {event.description}
                      </div>
                    )}
                  </div>

                  {/* QR Code Section */}
                  {event.registration_qr && (
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center text-xs">
                        <QrCode className="h-3 w-3 mr-1.5 text-purple-500" />
                        Registration QR
                      </h4>
                      <div className="flex items-center space-x-2">
                        <img 
                          src={event.registration_qr} 
                          alt="Registration QR Code" 
                          className="w-16 h-16 border border-gray-200 rounded shadow-sm"
                        />
                        <div className="flex-1 space-y-1">
                          <button
                            onClick={() => navigator.clipboard.writeText(getRegistrationUrl(event.id))}
                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-all duration-300"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Copy Link
                          </button>
                          <button
                            onClick={() => downloadQRCode(event)}
                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-all duration-300"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download QR
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="border-t pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigate(`/admin/attendees?eventId=${event.id}`)}
                        className="text-purple-600 hover:text-purple-700 text-xs font-semibold flex items-center bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition-all duration-300"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Attendees
                      </button>
                      <button
                        onClick={() => navigate(`/admin/checkin?eventId=${event.id}`)}
                        className="text-green-600 hover:text-green-700 text-xs font-semibold flex items-center bg-green-50 px-2 py-1 rounded hover:bg-green-100 transition-all duration-300"
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        Check-in
                      </button>
                      <button
                        onClick={() => exportEventCSV(event)}
                        className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold flex items-center bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-all duration-300"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export
                      </button>
                      <button
                        onClick={() => generateNewQRCode(event)}
                        className="text-orange-600 hover:text-orange-700 text-xs font-semibold flex items-center bg-orange-50 px-2 py-1 rounded hover:bg-orange-100 transition-all duration-300"
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        {event.registration_qr ? 'Refresh QR' : 'Generate QR'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!loading && filteredAndSortedEvents.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-100 max-w-md mx-auto">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">No events found</h3>
              <p className="text-gray-600 mb-6">
                {userCompany ? 'Create your first event for your company' : 'Create your first event to get started'}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-lg font-semibold"
              >
                Add Event
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Event Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {userCompany ? 'Company' : 'Company *'}
                  </label>
                  {userCompany ? (
                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
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
    </div>
  )
} 