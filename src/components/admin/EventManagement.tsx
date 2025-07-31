/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { Plus, Calendar, MapPin, Users, Edit, Trash2, ExternalLink, QrCode, Image } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import toast from 'react-hot-toast'

import { useHybridDB, hybridDB, Event as HybridEvent } from '../../lib/hybridDB';
import QRCodeLib from 'qrcode'

// Extend Event type for UI compatibility
interface UIEvent extends HybridEvent {
  company: { name: string };
  attendee_count: number;
  checked_in_count: number;
  offline_qr?: string | null;
  custom_background?: string | null;
  custom_logo?: string | null;
}

interface Company {
  id: string
  name: string
}

interface EventManagementProps {
  userCompany?: any
}

// Utility to generate a color from a string (reuse from CompanyManagement)
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `#${((hash >> 24) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 16) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 8) & 0xFF).toString(16).padStart(2, '0')}`;
  return color;
}

// File upload utility functions
const uploadFileToSupabase = async (file: File, folder: string, eventId: string): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('event-assets')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return null;
    }

    return filePath;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return null;
  }
};

const storeFileLocally = (file: File, eventId: string, type: 'background' | 'logo'): string => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}_${type}_${Date.now()}.${fileExt}`;
    const url = URL.createObjectURL(file);
    
    // Store in localStorage for backup
    const key = `event_${eventId}_${type}`;
    localStorage.setItem(key, JSON.stringify({
      url,
      fileName,
      timestamp: Date.now()
    }));
    
    return url;
  } catch (error) {
    console.error('Error storing file locally:', error);
    return URL.createObjectURL(file);
  }
};

export default function EventManagement({ userCompany }: EventManagementProps) {
  const [events, setEvents] = useState<UIEvent[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<UIEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
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

  const { getEvents, syncEvents } = useHybridDB();

  useEffect(() => {
    fetchEvents()
    fetchCompanies()
  }, [])

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const events = await getEvents(userCompany ? userCompany.company_id : undefined);
      // Only add UI-specific properties if missing
      const eventsWithCompany: UIEvent[] = events.map((event: any) => {
        return {
          ...event,
          company: event.company && event.company.name ? event.company : { name: '' },
          attendee_count: typeof event.attendee_count === 'number' ? event.attendee_count : 0,
          checked_in_count: typeof event.checked_in_count === 'number' ? event.checked_in_count : 0,
          description: event.description ?? null,
          date: event.date ?? null,
          location: event.location ?? null,
          max_attendees: event.max_attendees ?? null,
          registration_qr: event.registration_qr ?? null,
          created_at: event.created_at ?? '',
        };
      });
      setEvents(eventsWithCompany);
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  const handleFileUpload = async (file: File, type: 'background' | 'logo', eventId?: string): Promise<string> => {
    setUploading(true);
    try {
      let supabasePath: string | null = null;
      let localUrl: string = '';

      // Try to upload to Supabase first (priority)
      if (eventId) {
        supabasePath = await uploadFileToSupabase(file, type === 'background' ? 'backgrounds' : 'logos', eventId);
      }

      // Always store locally as backup
      localUrl = storeFileLocally(file, eventId || 'temp', type);

      // Return Supabase path if available, otherwise local URL
      if (supabasePath) {
        toast.success(`${type === 'background' ? 'Background' : 'Logo'} uploaded to cloud storage`);
        return supabasePath;
      } else {
        toast.error(`${type === 'background' ? 'Background' : 'Logo'} stored locally (cloud upload failed)`);
        return localUrl;
      }
    } catch (error: any) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Error uploading ${type}: ${error.message}`);
      return URL.createObjectURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company_id) return;
    
    setUploading(true);
    try {
      let eventId: string;
      
      if (editingEvent) {
        // Update event
        const { error } = await supabase
          .from('events')
          .update(formData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        eventId = editingEvent.id;
        toast.success('Event updated successfully!');
      } else {
        // Create event
        const { data, error } = await supabase
          .from('events')
          .insert([formData])
          .select();
        if (error) throw error;
        eventId = data[0].id;
        
        // Generate QR code for the new event
        const registrationUrl = `${window.location.origin}/public/register/${eventId}`;
        const qrCodeDataUrl = await QRCodeLib.toDataURL(registrationUrl, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        
        // Update event with QR code
        await supabase
          .from('events')
          .update({ registration_qr: qrCodeDataUrl })
          .eq('id', eventId);
        
        toast.success('Event created successfully!');
      }

      // Handle file uploads if they exist
      const updatedFormData = { ...formData };
      
      // Handle background upload
      if (formData.custom_background && formData.custom_background.startsWith('blob:')) {
        const fileInput = document.getElementById('background-upload') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          const uploadedPath = await handleFileUpload(file, 'background', eventId);
          updatedFormData.custom_background = uploadedPath;
        }
      }

      // Handle logo upload
      if (formData.custom_logo && formData.custom_logo.startsWith('blob:')) {
        const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          const uploadedPath = await handleFileUpload(file, 'logo', eventId);
          updatedFormData.custom_logo = uploadedPath;
        }
      }

      // Update event with final file paths
      if (editingEvent || (updatedFormData.custom_background !== formData.custom_background || updatedFormData.custom_logo !== formData.custom_logo)) {
        await supabase
          .from('events')
          .update({
            custom_background: updatedFormData.custom_background,
            custom_logo: updatedFormData.custom_logo
          })
          .eq('id', eventId);
      }

      resetForm();
      fetchEvents();
    } catch (error: any) {
      toast.error('Error saving event: ' + error.message);
    } finally {
      setUploading(false);
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
   // const baseUrl = 'https://nw.hopto.org'
  //  return `${baseUrl}/public/register/${eventId}`
    // OVERIDE 
    return `${window.location.origin}/public/register/${eventId}`
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

  const getImageUrl = (path: string | null): string => {
    if (!path) return '';
    
    // If it's a Supabase path, use getStorageUrl
    if (path.includes('/') && !path.startsWith('blob:')) {
      return getStorageUrl(path);
    }
    
    // If it's a local blob URL, return as is
    if (path.startsWith('blob:')) {
      return path;
    }
    
    // If it's a local storage URL, return as is
    return path;
  };

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
            <div className="mb-2">
              <h3 className="text-xl font-bold px-3 py-1 rounded-md text-white" style={{ backgroundColor: stringToColor(event.company_id) }}>{event.name}</h3>
            </div>
            <p className="text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{event.company.name}</p>

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
                  <img 
                    src={getStorageUrl(event.registration_qr)} 
                    alt="Registration QR Code" 
                    className="w-32 h-32 border-2 border-blue-200 rounded-xl shadow-sm mx-auto"
                  />
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
                      className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-all duration-300"
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      Download QR
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    Mode: {event.mode || 'online'}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    Max: {event.max_attendees}
                  </span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => openEditModal(event)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-all duration-300"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-red-600 hover:text-red-700 text-sm font-semibold flex items-center bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </button>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Gallery Uploads
                  </label>
                  <input
                    type="number"
                    value={formData.max_gallery_uploads}
                    onChange={(e) => setFormData({ ...formData, max_gallery_uploads: parseInt(e.target.value) || 2 })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300"
                    min="1"
                    max="10"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Data Mode</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  value={formData.mode}
                  onChange={e => setFormData({ ...formData, mode: e.target.value as 'offline' | 'online' | 'hybrid' })}
                  required
                >
                  <option value="online">Online (Supabase)</option>
                  <option value="offline">Offline (Local Only)</option>
                  <option value="hybrid">Hybrid (Sync)</option>
                </select>
              </div>

              {/* Custom Background & Logo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Background (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                    {formData.custom_background ? (
                      <div className="space-y-2">
                        <img
                          src={getImageUrl(formData.custom_background)}
                          alt="Background Preview"
                          className="max-w-full h-32 object-cover mx-auto rounded-lg"
                          onError={(e) => {
                            console.error('Error loading background:', e);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, custom_background: '' })}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Remove Background
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm mb-2">Upload custom background</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const url = URL.createObjectURL(file)
                              setFormData({ ...formData, custom_background: url })
                            }
                          }}
                          className="hidden"
                          id="background-upload"
                        />
                        <label
                          htmlFor="background-upload"
                          className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Select Image
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Logo (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                    {formData.custom_logo ? (
                      <div className="space-y-2">
                        <img
                          src={getImageUrl(formData.custom_logo)}
                          alt="Logo Preview"
                          className="max-w-full h-32 object-contain mx-auto rounded-lg"
                          onError={(e) => {
                            console.error('Error loading logo:', e);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, custom_logo: '' })}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Remove Logo
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm mb-2">Upload custom logo</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const url = URL.createObjectURL(file)
                              setFormData({ ...formData, custom_logo: url })
                            }
                          }}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Select Image
                        </label>
                      </div>
                    )}
                  </div>
                </div>
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
                  disabled={uploading}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {uploading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
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