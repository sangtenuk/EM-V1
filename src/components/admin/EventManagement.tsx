/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { Plus, Calendar, MapPin, Users, Edit, Trash2, ExternalLink, QrCode, Image, ArrowLeft, Vote, Gift, Monitor, BarChart3, Download, Building2 } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useParams, useNavigate } from 'react-router-dom'

import { useHybridDB, hybridDB, Event as HybridEvent } from '../../lib/hybridDB';
import QRCodeLib from 'qrcode'
import { uploadToPublicFolder, getFileUrl } from '../../lib/fileUpload';

// Extend Event type for UI compatibility
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

// Utility to generate a color from a string (reuse from CompanyManagement)
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `#${((hash >> 24) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 16) & 0xFF).toString(16).padStart(2, '0')}${((hash >> 8) & 0xFF).toString(16).padStart(2, '0')}`;
  return color;
}

// File upload utility functions - now using public folder
const uploadFileToPublicFolder = async (file: File, type: 'background' | 'logo', eventId: string): Promise<string> => {
  try {
    const uploadedFile = await uploadToPublicFolder(file, type, eventId);
    return uploadedFile.url;
  } catch (error) {
    console.error('Error uploading to public folder:', error);
    throw error;
  }
};

export default function EventManagement({ userCompany }: EventManagementProps) {
  const { getEvents: getEventsHybrid, createEvent: createEventHybrid, updateEvent: updateEventHybrid, deleteEvent: deleteEventHybrid, getCompanies } = useHybridDB();
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [events, setEvents] = useState<UIEvent[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<UIEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<UIEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [inlineEditing, setInlineEditing] = useState<{
    field: string;
    value: string;
    originalValue: string;
  } | null>(null)
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
  }, [])

  useEffect(() => {
    if (eventId) {
      fetchEventDetails(eventId)
    } else {
      // Only fetch all events if we're not viewing a specific event
      fetchEvents()
    }
  }, [eventId])

  const fetchEventDetails = async (eventId: string) => {
    setLoading(true);
    try {
      const { data: event, error } = await supabase
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
          custom_background,
          custom_logo,
          company:companies(name, logo_url)
        `)
        .eq('id', eventId)
        .single();

      if (error) throw error;

      // Fetch attendees for this event
      const { data: attendees, error: attendeesError } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in, name, email, phone, created_at')
        .eq('event_id', eventId);

      if (attendeesError) throw attendeesError;

      const eventWithStats: UIEvent = {
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company,
        attendee_count: attendees?.length || 0,
        checked_in_count: attendees?.filter(a => a.checked_in).length || 0,
        description: event.description ?? null,
        date: event.date ?? null,
        location: event.location ?? null,
        max_attendees: event.max_attendees ?? null,
        max_gallery_uploads: event.max_gallery_uploads ?? 2,
        registration_qr: event.registration_qr ?? null,
        created_at: event.created_at ?? '',
        custom_background: event.custom_background ?? null,
        custom_logo: event.custom_logo ?? null,
      };

      setSelectedEvent(eventWithStats);
    } catch (error: any) {
      toast.error('Error fetching event details: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Fetch events using hybrid database
      const events = await getEventsHybrid(userCompany?.company_id);

      // Fetch attendee counts for all events
      const eventIds = events?.map(e => e.id) || [];
      let attendees: any[] = [];
      
      try {
        const { data: attendeesData, error: attendeesError } = await supabase
          .from('attendees')
          .select('id, event_id, checked_in')
          .in('event_id', eventIds);

        if (!attendeesError) {
          attendees = attendeesData || [];
        }
      } catch (error) {
        console.warn('Could not fetch attendees, using local data');
      }

      // Calculate stats for each event
      const eventsWithStats: UIEvent[] = (events || []).map((event: any) => {
        const eventAttendees = attendees?.filter(a => a.event_id === event.id) || [];
        const attendee_count = eventAttendees.length;
        const checked_in_count = eventAttendees.filter(a => a.checked_in).length;

        return {
          ...event,
          company: { name: 'Company', logo_url: null }, // Will be populated from companies
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
      // Upload to public folder using the new utility
      const uploadedUrl = await uploadFileToPublicFolder(file, type, eventId || 'temp');
      toast.success(`${type === 'background' ? 'Background' : 'Logo'} uploaded to public folder`);
      return uploadedUrl;
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
        // Update event using hybrid database
        await updateEventHybrid(editingEvent.id, formData);
        eventId = editingEvent.id;
        toast.success('Event updated successfully!');
      } else {
        // Create event using hybrid database
        const newEvent = await createEventHybrid(formData);
        eventId = newEvent.id;
        
        // Generate QR code for the new event with correct port
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
        
        // Update event with QR code
        await updateEventHybrid(eventId, { registration_qr: qrCodeDataUrl });
        
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
        await updateEventHybrid(eventId, {
          custom_background: updatedFormData.custom_background,
          custom_logo: updatedFormData.custom_logo
        });
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
      await deleteEventHybrid(eventId);
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

      // Update event with new QR code
      const { error } = await supabase
        .from('events')
        .update({ registration_qr: qrCodeDataUrl })
        .eq('id', event.id);

      if (error) throw error;

      toast.success('QR Code regenerated successfully!');
      fetchEvents(); // Refresh the events list
    } catch (error: any) {
      toast.error('Error generating QR code: ' + error.message);
    }
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

  const startInlineEdit = (field: string, value: string) => {
    setInlineEditing({
      field,
      value,
      originalValue: value
    });
  };

  const saveInlineEdit = async () => {
    if (!inlineEditing || !selectedEvent) return;

    try {
      const { error } = await supabase
        .from('events')
        .update({ [inlineEditing.field]: inlineEditing.value })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      // Update local state
      setSelectedEvent({
        ...selectedEvent,
        [inlineEditing.field]: inlineEditing.value
      });

      toast.success('Event updated successfully');
      setInlineEditing(null);
    } catch (error: any) {
      toast.error('Error updating event: ' + error.message);
      // Revert to original value
      setInlineEditing({
        ...inlineEditing,
        value: inlineEditing.originalValue
      });
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditing(null);
  };

  const handleInlineEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveInlineEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEdit();
    }
  };

  const exportEventCSV = async (event: UIEvent) => {
    try {
      // Fetch detailed event data
      const { data: eventDetails, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          name,
          date,
          description,
          location
        `)
        .eq('id', event.id)
        .single()

      if (eventError) {
        toast.error('Error fetching event details')
        return
      }

      // Fetch attendees separately to avoid nested query issues
      const { data: attendees, error: attendeesError } = await supabase
        .from('attendees')
        .select(`
          id,
          name,
          email,
          phone,
          checked_in,
          created_at,
          check_in_time,
          company,
          staff_id,
          identification_number,
          table_number,
          seat_number,
          table_assignment
        `)
        .eq('event_id', event.id)

      if (attendeesError) {
        toast.error('Error fetching attendees')
        return
      }

      // Generate CSV content
      let csvContent = ''
      
      // Header
      csvContent += '🎉 EVENT EXPORT REPORT\n'
      csvContent += '='.repeat(80) + '\n'
      csvContent += `📅 Report Generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}\n`
      csvContent += `🎯 Event: ${eventDetails.name}\n`
      csvContent += `📅 Event Date: ${eventDetails.date || 'N/A'}\n`
      csvContent += `📍 Location: ${eventDetails.location || 'N/A'}\n`
      csvContent += `📝 Description: ${eventDetails.description || 'N/A'}\n`
      csvContent += '='.repeat(80) + '\n\n'
      
      // Event Overview Section
      csvContent += '📊 EVENT OVERVIEW\n'
      csvContent += '-'.repeat(40) + '\n'
      csvContent += `Total Attendees,${attendees?.length || 0}\n`
      csvContent += `Checked In,${attendees?.filter(a => a.checked_in).length || 0}\n`
      csvContent += `Check-in Rate,${attendees?.length > 0 ? Math.round((attendees?.filter(a => a.checked_in).length / attendees?.length) * 100) : 0}%\n`
      csvContent += '\n'
      
      // Attendees Section
      if (attendees && attendees.length > 0) {
        csvContent += '👥 ATTENDEE DETAILS\n'
        csvContent += '-'.repeat(40) + '\n'
        csvContent += 'Name,Email,Phone,Company,Staff ID,ID Number,Status,Registration Date,Check-in Time,Table Info\n'
        attendees.forEach((attendee: any) => {
          const status = attendee.checked_in ? '✓ Checked In' : '○ Not Checked'
          const registrationDate = new Date(attendee.created_at).toLocaleDateString()
          const checkInTime = attendee.check_in_time ? new Date(attendee.check_in_time).toLocaleString() : 'N/A'
          
          let tableInfo = 'N/A'
          if (attendee.table_number) {
            tableInfo = `Table ${attendee.table_number}`
            if (attendee.seat_number) {
              tableInfo += ` - Seat ${attendee.seat_number}`
            }
          } else if (attendee.table_assignment) {
            tableInfo = attendee.table_assignment
          }
          
          csvContent += `${attendee.name || 'N/A'},${attendee.email || 'N/A'},${attendee.phone || 'N/A'},${attendee.company || 'N/A'},${attendee.staff_id || 'N/A'},${attendee.identification_number || 'N/A'},${status},${registrationDate},${checkInTime},${tableInfo}\n`
        })
        csvContent += '\n'
      }
      
      // Footer
      csvContent += '='.repeat(80) + '\n'
      csvContent += '📋 Report Summary\n'
      csvContent += '-'.repeat(40) + '\n'
      csvContent += `• Total Records: ${attendees?.length || 0}\n`
      csvContent += `• Report Type: Event Export Report\n`
      csvContent += `• Generated By: Event Management System\n`
      csvContent += `• Format: CSV (Comma Separated Values)\n`
      csvContent += '='.repeat(80) + '\n'
      
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `event-export-${eventDetails.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
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

  // Show individual event details if eventId is provided
  if (eventId && selectedEvent) {
    return (
      <div>
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/admin/events')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Event Details
            </h1>
            <p className="text-gray-600">Detailed view of {selectedEvent.name}</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-8">
          {/* Event Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedEvent.name}</h2>
              <p className="text-gray-600">{selectedEvent.company.name}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => openEditModal(selectedEvent)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Event
              </button>
              <button
                onClick={() => deleteEvent(selectedEvent.id)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Event Info */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Event Information</h3>
                <div className="space-y-4">
                  {/* Event Name - Inline Editable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                    {inlineEditing?.field === 'name' ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={inlineEditing.value}
                          onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                          className="flex-1 bg-white p-3 rounded border focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={saveInlineEdit}
                          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelInlineEdit}
                          className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-white p-3 rounded border group">
                        <span className="text-gray-900 font-medium">{selectedEvent.name}</span>
                        <button
                          onClick={() => startInlineEdit('name', selectedEvent.name)}
                          className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description - Inline Editable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    {inlineEditing?.field === 'description' ? (
                      <div className="space-y-2">
                                                 <textarea
                           value={inlineEditing.value}
                           onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                           onKeyDown={handleInlineEditKeyDown}
                           className="w-full bg-white p-3 rounded border focus:ring-2 focus:ring-blue-500"
                           rows={3}
                           autoFocus
                         />
                        <div className="flex space-x-2">
                          <button
                            onClick={saveInlineEdit}
                            className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelInlineEdit}
                            className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between bg-white p-3 rounded border group">
                        <span className="text-gray-900 flex-1">
                          {selectedEvent.description || 'No description'}
                        </span>
                        <button
                          onClick={() => startInlineEdit('description', selectedEvent.description || '')}
                          className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 transition-all ml-2"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Date & Time - Inline Editable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                    {inlineEditing?.field === 'date' ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="datetime-local"
                          value={inlineEditing.value}
                          onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                          onKeyDown={handleInlineEditKeyDown}
                          className="flex-1 bg-white p-3 rounded border focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={saveInlineEdit}
                          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelInlineEdit}
                          className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-white p-3 rounded border group">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                          <span>
                            {selectedEvent.date ? new Date(selectedEvent.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'No date set'}
                          </span>
                        </div>
                        <button
                          onClick={() => startInlineEdit('date', selectedEvent.date || '')}
                          className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Location - Inline Editable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    {inlineEditing?.field === 'location' ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={inlineEditing.value}
                          onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                          onKeyDown={handleInlineEditKeyDown}
                          className="flex-1 bg-white p-3 rounded border focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={saveInlineEdit}
                          className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelInlineEdit}
                          className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-white p-3 rounded border group">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-green-600" />
                          <span>{selectedEvent.location || 'No location set'}</span>
                        </div>
                        <button
                          onClick={() => startInlineEdit('location', selectedEvent.location || '')}
                          className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700 transition-all"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Attendees</label>
                      <div className="bg-white p-3 rounded border text-center">
                        <span className="text-lg font-semibold">{selectedEvent.max_attendees}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Gallery Uploads</label>
                      <div className="bg-white p-3 rounded border text-center">
                        <span className="text-lg font-semibold">{selectedEvent.max_gallery_uploads}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendee Statistics */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Attendee Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{selectedEvent.attendee_count}</div>
                    <div className="text-sm text-gray-600">Total Registered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{selectedEvent.checked_in_count}</div>
                    <div className="text-sm text-gray-600">Checked In</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Check-in Rate</span>
                    <span>{selectedEvent.attendee_count > 0 ? Math.round((selectedEvent.checked_in_count / selectedEvent.attendee_count) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${selectedEvent.attendee_count > 0 ? (selectedEvent.checked_in_count / selectedEvent.attendee_count) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - QR Code and Actions */}
            <div className="space-y-6">
              {/* QR Code Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Registration QR Code</h3>
                <div className="text-center">
                  {selectedEvent.registration_qr ? (
                    <div>
                      <img 
                        src={getImageUrl(selectedEvent.registration_qr)} 
                        alt="Registration QR Code" 
                        className="w-48 h-48 mx-auto border border-gray-200 rounded-lg shadow-sm"
                      />
                      <div className="mt-4 space-y-2">
                        <button
                          onClick={() => downloadQRCode(selectedEvent)}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Download QR Code
                        </button>
                        <button
                          onClick={() => generateNewQRCode(selectedEvent)}
                          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Regenerate QR Code
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">No QR code generated yet</p>
                      <button
                        onClick={() => generateNewQRCode(selectedEvent)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Generate QR Code
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(getRegistrationUrl(selectedEvent.id))}
                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center"
                    title="Copy registration link"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Copy Link
                  </button>
                  <button
                    onClick={() => navigate(`/admin/attendees?eventId=${selectedEvent.id}`)}
                    className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700 transition-colors flex items-center justify-center"
                    title="View and manage attendees"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Attendees
                  </button>
                  <button
                    onClick={() => navigate(`/admin/checkin?eventId=${selectedEvent.id}`)}
                    className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center"
                    title="Check-in system"
                  >
                    <QrCode className="h-3 w-3 mr-1" />
                    Check-in
                  </button>
                  <button
                    onClick={() => navigate(`/admin/seating?eventId=${selectedEvent.id}`)}
                    className="bg-orange-600 text-white px-3 py-2 rounded text-sm hover:bg-orange-700 transition-colors flex items-center justify-center"
                    title="Manage seating arrangement"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Seating
                  </button>
                  <button
                    onClick={() => navigate(`/admin/gallery?eventId=${selectedEvent.id}`)}
                    className="bg-pink-600 text-white px-3 py-2 rounded text-sm hover:bg-pink-700 transition-colors flex items-center justify-center"
                    title="Event gallery management"
                  >
                    <Image className="h-3 w-3 mr-1" />
                    Gallery
                  </button>
                  <button
                    onClick={() => navigate(`/admin/voting?eventId=${selectedEvent.id}`)}
                    className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center"
                    title="Voting system"
                  >
                    <Vote className="h-3 w-3 mr-1" />
                    Voting
                  </button>
                  <button
                    onClick={() => navigate(`/admin/lucky-draw?eventId=${selectedEvent.id}`)}
                    className="bg-yellow-600 text-white px-3 py-2 rounded text-sm hover:bg-yellow-700 transition-colors flex items-center justify-center"
                    title="Lucky draw system"
                  >
                    <Gift className="h-3 w-3 mr-1" />
                    Lucky Draw
                  </button>
                  <button
                    onClick={() => navigate(`/admin/welcome-monitor?eventId=${selectedEvent.id}`)}
                    className="bg-cyan-600 text-white px-3 py-2 rounded text-sm hover:bg-cyan-700 transition-colors flex items-center justify-center"
                    title="Welcome monitor display"
                  >
                    <Monitor className="h-3 w-3 mr-1" />
                    Welcome
                  </button>
                  <button
                    onClick={() => navigate(`/admin/voting-monitor?eventId=${selectedEvent.id}`)}
                    className="bg-violet-600 text-white px-3 py-2 rounded text-sm hover:bg-violet-700 transition-colors flex items-center justify-center"
                    title="Voting monitor display"
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Monitor
                  </button>
                  <button
                    onClick={() => exportEventCSV(selectedEvent)}
                    className="bg-emerald-600 text-white px-3 py-2 rounded text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center"
                    title="Export event data to CSV"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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

        {/* Events Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {events.map((event) => (
          <div key={event.id} className="bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 p-4 hover:shadow-xl transition-all duration-300 card-hover">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold px-2 py-1 rounded text-white text-sm" style={{ backgroundColor: stringToColor(event.company_id) }}>{event.name}</h3>
              {event.company.logo_url && (
                <img 
                  src={getStorageUrl(event.company.logo_url)} 
                  alt="Company Logo" 
                  className="h-6 w-6 object-contain rounded"
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
              )}
            </div>
            <p className="text-xs font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{event.company.name}</p>

            {event.description && (
              <p className="text-gray-600 text-xs mb-3 line-clamp-2 bg-gray-50 p-2 rounded">{event.description}</p>
            )}

            <div className="space-y-2 mb-3">
              {event.date && (
                <div className="flex items-center text-gray-600 text-xs bg-blue-50 p-1.5 rounded">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>{new Date(event.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center text-gray-600 text-xs bg-green-50 p-1.5 rounded">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              <div className="flex items-center text-gray-600 text-xs bg-purple-50 p-1.5 rounded">
                <Users className="h-3 w-3 mr-1" />
                <span>{event.attendee_count} registered • {event.checked_in_count} checked in</span>
              </div>
            </div>

            {/* QR Code and Details Layout */}
            <div className="border-t border-gray-200 pt-3 mb-3">
              <div className="flex items-start space-x-3">
                {/* QR Code on the left */}
                {event.registration_qr && (
                  <div className="flex-shrink-0">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Registration QR</h4>
                    <img 
                      src={getStorageUrl(event.registration_qr)} 
                      alt="Registration QR Code" 
                      className="w-24 h-24 border border-blue-200 rounded shadow-sm"
                    />
                  </div>
                )}
                
                {/* Details on the right */}
                <div className="flex-1 space-y-2">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(getRegistrationUrl(event.id))}
                      className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-all duration-300"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Copy Link
                    </button>
                    {event.registration_qr && (
                      <button
                        onClick={() => downloadQRCode(event)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-all duration-300"
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        Download QR
                      </button>
                    )}
                    <button
                      onClick={() => generateNewQRCode(event)}
                      className="text-green-600 hover:text-green-700 text-xs font-semibold flex items-center bg-green-50 px-2 py-1 rounded hover:bg-green-100 transition-all duration-300"
                      title="Generate/Refresh QR Code"
                    >
                      <QrCode className="h-3 w-3 mr-1" />
                      {event.registration_qr ? 'Refresh QR' : 'Generate QR'}
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      Mode: {event.mode || 'online'}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      Max: {event.max_attendees}
                    </span>
                    {event.max_gallery_uploads && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        Gallery: {event.max_gallery_uploads}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => exportEventCSV(event)}
                  className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold flex items-center bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-all duration-300"
                  title="Export event data to CSV"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </button>
                <button
                  onClick={() => openEditModal(event)}
                  className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-all duration-300"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-all duration-300"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && events.length === 0 && (
        <div className="text-center py-12">
          <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl w-fit mx-auto mb-6">
            <Calendar className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No events found</h3>
          <p className="text-gray-600 mb-6 text-lg">
            {userCompany ? 'Create your first event for your company' : 'Create your first event to get started'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg font-semibold"
          >
            Add Event
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
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

      {/* Modal - Always render this outside conditional returns */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                    <select
                      value={formData.company_id}
                      onChange={e => setFormData({ ...formData, company_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                      required
                    >
                      <option value="">Select Company</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.date || ''}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Attendees</label>
                    <input
                      type="number"
                      value={formData.max_attendees || ''}
                      onChange={e => setFormData({ ...formData, max_attendees: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Gallery Uploads</label>
                    <input
                      type="number"
                      value={formData.max_gallery_uploads || 2}
                      onChange={e => setFormData({ ...formData, max_gallery_uploads: parseInt(e.target.value) || 2 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                    />
                  </div>
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
        </div>
      )}
    </div>
  </div>
  )
}