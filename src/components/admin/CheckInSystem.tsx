import React, { useState, useEffect, useRef } from 'react' 
import { QrCode, UserCheck, Users, CheckCircle, Camera, MapPin, X } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import Scanner from './Scanner'

import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'

interface Event {
  id: string
  name: string
  registration_qr: string | null
  custom_logo?: string | null
  custom_background?: string | null
  company: {
    name: string
  }
}

interface CheckInResult {
  success: boolean
  attendee?: {
    id: string
    name: string
    identification_number: string
    staff_id: string | null
    table_assignment?: string | null
    event: {
     name: string
   }[]
  }
  message: string
}

interface CheckInSystemProps {
  userCompany?: any
}

// Add a type for recentCheckIns attendee objects
interface RecentCheckInAttendee {
  id: string;
  name: string;
  identification_number: string;
  staff_id: string | null;
  table_assignment?: string | null;
  check_in_time: string;
  event: { name: string }[];
}

// ErrorBoundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="bg-white border border-red-300 rounded-lg p-8 max-w-lg w-full text-center">
            <h1 className="text-2xl font-bold text-red-700 mb-4">Something went wrong</h1>
            <pre className="text-sm text-red-600 mb-4 whitespace-pre-wrap">{String(this.state.error)}</pre>
            <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Reload Page</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function CheckInSystem({ userCompany }: CheckInSystemProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [manualId, setManualId] = useState('')
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckInAttendee[]>([])
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const [eventQR, setEventQR] = useState('')
  const [checkedInName, setCheckedInName] = useState<string | null>(null)
  const [checkedInTable, setCheckedInTable] = useState<string | null>(null)

  // Add attendee management state
  const [attendees, setAttendees] = useState<any[]>([])
  const [attendeeLoading, setAttendeeLoading] = useState(false)
  const [editingAttendee, setEditingAttendee] = useState<any | null>(null)
  const [showAttendeeModal, setShowAttendeeModal] = useState(false)
  const [attendeeForm, setAttendeeForm] = useState({
    name: '',
    email: '',
    phone: '',
    identification_number: '',
    staff_id: '',
    table_assignment: ''
  })

  // Face detection state
  const [showFaceDetection, setShowFaceDetection] = useState(false)
  const [currentAttendee, setCurrentAttendee] = useState<any>(null)
  const [facePhoto, setFacePhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
 

  useEffect(() => {
    fetchEvents()
  }, [])



  useEffect(() => {
    if (selectedEventId) {
      fetchEventStats()
      fetchRecentCheckIns()
      generateEventQR()
    }
  }, [selectedEventId])

  // Fetch attendees for selected event
  useEffect(() => {
    if (selectedEventId) fetchAttendees()
  }, [selectedEventId])

  useEffect(() => {
    return () => {
      // Cleanup face detection camera
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [])



  // Cleanup face detection when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [])

  const fetchEvents = async () => {
    try {
      let query = supabase.from('events').select(`
          id,
          name,
          company_id,
          registration_qr,
          custom_logo,
          custom_background,
          company:companies(name)
        `)

      // Filter by company if user is a company user
      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      // Ensure company is a single object, not an array
      const formattedEvents = data?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      })) || []
      
      setEvents(formattedEvents)

      // Auto-select first event for company users
      if (userCompany && formattedEvents && formattedEvents.length > 0) {
        setSelectedEventId(formattedEvents[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    }
  }

  const generateEventQR = async () => {
    try {
      if (!selectedEventId) return
      
      // OVERIDE 
      const checkInUrl = `${window.location.origin}/admin/checkin?event=${selectedEventId}`
      // const baseUrl = 'https://nw.hopto.org'
      // const checkInUrl = `${baseUrl}/admin/checkin?event=${selectedEventId}`
      const qrDataUrl = await QRCodeLib.toDataURL(checkInUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      setEventQR(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
      setEventQR('')
    }
  }

  const fetchEventStats = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('id, checked_in')
        .eq('event_id', selectedEventId)

      if (error) throw error

      setStats({
        total: data.length,
        checkedIn: data.filter(a => a.checked_in).length
      })
    } catch (error: any) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchRecentCheckIns = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select(`
          id,
          name,
          identification_number,
          staff_id,
          table_assignment,
          check_in_time,
          event:events(name)
        `)
        .eq('event_id', selectedEventId)
        .eq('checked_in', true)
        .order('check_in_time', { ascending: false })
        .limit(10)

      if (error) throw error
      // Add table_assignment to the attendee type for recentCheckIns
      // In fetchRecentCheckIns, after fetching data, map to add table_assignment if missing
      const formattedData = (data || []).map(a => ({
        ...a,
        table_assignment: a.table_assignment || null
      })) as RecentCheckInAttendee[]
      setRecentCheckIns(formattedData)
    } catch (error: any) {
      console.error('Error fetching recent check-ins:', error)
    }
  }

  const fetchAttendees = async () => {
    setAttendeeLoading(true)
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setAttendees(data)
    } catch (error: any) {
      toast.error('Error fetching attendees: ' + error.message)
    } finally {
      setAttendeeLoading(false)
    }
  }

  const openAddAttendee = () => {
    setEditingAttendee(null)
    setAttendeeForm({
      name: '', email: '', phone: '', identification_number: '', staff_id: '', table_assignment: ''
    })
    setShowAttendeeModal(true)
  }

  const openEditAttendee = (attendee: any) => {
    setEditingAttendee(attendee)
    setAttendeeForm({
      name: attendee.name || '',
      email: attendee.email || '',
      phone: attendee.phone || '',
      identification_number: attendee.identification_number || '',
      staff_id: attendee.staff_id || '',
      table_assignment: attendee.table_assignment || ''
    })
    setShowAttendeeModal(true)
  }

  const handleAttendeeForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!attendeeForm.name.trim() || !attendeeForm.identification_number.trim()) return
    if (editingAttendee) {
      // Update
      supabase.from('attendees').update(attendeeForm).eq('id', editingAttendee.id).then(({ error }) => {
        if (error) toast.error('Error updating attendee: ' + error.message)
        else toast.success('Attendee updated!')
        setShowAttendeeModal(false)
        fetchAttendees()
      })
    } else {
      // Add
      const attendeeId = crypto.randomUUID()
      supabase.from('attendees').insert([
        { ...attendeeForm, id: attendeeId, event_id: selectedEventId }
      ]).then(({ error }) => {
        if (error) toast.error('Error adding attendee: ' + error.message)
        else toast.success('Attendee added!')
        setShowAttendeeModal(false)
        fetchAttendees()
      })
    }
  }

  const deleteAttendee = (id: string) => {
    if (!confirm('Delete this attendee?')) return
    supabase.from('attendees').delete().eq('id', id).then(({ error }) => {
      if (error) toast.error('Error deleting attendee: ' + error.message)
      else toast.success('Attendee deleted!')
      fetchAttendees()
    })
  }

  const resetCheckIn = (id: string) => {
    supabase.from('attendees').update({ checked_in: false, check_in_time: null }).eq('id', id).then(({ error }) => {
      if (error) toast.error('Error resetting check-in: ' + error.message)
      else toast.success('Check-in reset!')
      fetchAttendees()
    })
  }

  const resetAllCheckIn = () => {
    if (!confirm('Reset check-in for all attendees?')) return
    supabase.from('attendees').update({ checked_in: false, check_in_time: null }).eq('event_id', selectedEventId).then(({ error }) => {
      if (error) toast.error('Error resetting all: ' + error.message)
      else toast.success('All check-ins reset!')
      fetchAttendees()
    })
  }

  const handleQRScan = async (result: string) => {
    try {
      const checkInResult = await processCheckIn(result)
      
      if (checkInResult.success) {
        toast.success(checkInResult.message)
        fetchEventStats()
        fetchRecentCheckIns()
        setCheckedInName(checkInResult.attendee?.name || null)
        setCheckedInTable(checkInResult.attendee?.table_assignment || null)
      } else {
        toast.error(checkInResult.message)
      }
    } catch (error: any) {
      toast.error('Error processing QR scan: ' + error.message)
    }
  }



  const processCheckIn = async (qrData: string): Promise<CheckInResult> => {
    try {
      // Check if it's a QR code (contains |) or manual ID entry
      if (qrData.includes('|')) {
        // Parse QR code data (format: attendeeId|eventId|name)
        const parts = qrData.split('|')
        if (parts.length !== 3) {
          return { success: false, message: 'Invalid QR code format' }
        }

       const attendeeId = parts[0]

        // Verify attendee exists and belongs to selected event
        const { data: attendee, error } = await supabase
          .from('attendees')
          .select(`
            id,
            name,
            identification_number,
            staff_id,
            checked_in,
            event_id,
            table_assignment,
            face_photo_url,
            event:events(name)
          `)
          .eq('id', attendeeId)
          .single()

        if (error || !attendee) {
          return { success: false, message: 'Attendee not found' }
        }

        if (attendee.event_id !== selectedEventId) {
          return { success: false, message: 'This ticket is not valid for the selected event' }
        }

        if (attendee.checked_in) {
          return { success: false, message: `${attendee.name} is already checked in` }
        }


        // Check in the attendee
        const { error: updateError } = await supabase
          .from('attendees')
          .update({
            checked_in: true,
            check_in_time: new Date().toISOString()
          })
          .eq('id', attendee.id)

        if (updateError) throw updateError

        // Fetch updated attendee for table_assignment
        const { data: updatedAttendee } = await supabase
          .from('attendees')
          .select('id, name, identification_number, staff_id, table_assignment, event:events(name)')
          .eq('id', attendee.id)
          .single()
        let seatMsg = ''
        let attendeeResult = attendee
        if (updatedAttendee) {
          seatMsg = updatedAttendee.table_assignment ? ` | Table: ${updatedAttendee.table_assignment}` : ''
          attendeeResult = { ...attendee, ...updatedAttendee }
          if (updatedAttendee.table_assignment) {
            toast.success(`${attendee.name} checked in! Assigned to table ${updatedAttendee.table_assignment}`)
          } else {
            toast.success(`${attendee.name} checked in! No table assigned`)
          }
        } else {
          toast.success(`${attendee.name} checked in! No table assigned`)
        }
        return {
          success: true,
          attendee: attendeeResult,
          message: `${attendee.name} checked in successfully!${seatMsg}`
        }
      } else {
        // Manual ID entry - search by identification_number or staff_id
        const { data: attendees, error } = await supabase
          .from('attendees')
          .select(`
            id,
            name,
            identification_number,
            staff_id,
            checked_in,
            event_id,
            event:events(name)
          `)
          .eq('event_id', selectedEventId)
          .or(`identification_number.eq.${qrData},staff_id.eq.${qrData}`)

        if (error) throw error

        if (!attendees || attendees.length === 0) {
          return { success: false, message: 'No attendee found with this ID' }
        }

        const attendee = attendees[0]

        if (attendee.checked_in) {
          return { success: false, message: `${attendee.name} is already checked in` }
        }

        // Check in the attendee
        const { error: updateError } = await supabase
          .from('attendees')
          .update({
            checked_in: true,
            check_in_time: new Date().toISOString()
          })
          .eq('id', attendee.id)

        if (updateError) throw updateError

        return {
          success: true,
          attendee,
          message: `${attendee.name} checked in successfully!`
        }
      }
    } catch (error: any) {
      return { success: false, message: 'Error processing check-in: ' + error.message }
    }
  }

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEventId) {
      toast.error('Please select an event first')
      return
    }
    if (!manualId.trim()) return
    setCheckedInName(null)
    setCheckedInTable(null)
    const result = await processCheckIn(manualId)
    
    if (result.success) {
      toast.success(result.message)
      setManualId('')
      fetchEventStats()
      fetchRecentCheckIns()
      setCheckedInName(result.attendee?.name || null)
      setCheckedInTable(result.attendee?.table_assignment || null)
    } else {
      toast.error(result.message)
    }
  }

  // Face detection functions
  const startFaceDetectionCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setShowCamera(true)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast.error('Unable to access camera')
      setShowCamera(false)
    }
  }

  const stopFaceDetectionCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  const captureFaceForDetection = () => {
    try {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (context && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0)
          
          const photoData = canvas.toDataURL('image/jpeg')
          setFacePhoto(photoData)
          stopFaceDetectionCamera()
        } else {
          toast.error('Camera not ready. Please wait a moment and try again.')
        }
      }
    } catch (error) {
      console.error('Error capturing face:', error)
      toast.error('Error capturing photo')
    }
  }

  const proceedWithCheckIn = async () => {
    if (!currentAttendee) return
    
    try {
      // Here you would typically send the face photo to your backend for verification
      // For now, we'll just proceed with the check-in
      const result = await processCheckIn(currentAttendee.identification_number)
      
      if (result.success) {
        toast.success(result.message)
        setShowFaceDetection(false)
        setCurrentAttendee(null)
        setFacePhoto(null)
        fetchEventStats()
        fetchRecentCheckIns()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('Error during face verification check-in')
    }
  }


  return (
    <ErrorBoundary>
      <div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Check-In System</h1>
            <p className="text-gray-600 mt-2">Scan QR codes to check in attendees</p>
          </div>
        </div>

        {/* Event Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Event
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
                  {!userCompany && <option value="">Choose an event to start check-in</option>}
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
                  <div className="text-sm text-blue-600 font-medium">Check-in Progress</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {stats.checkedIn} / {stats.total}
                  </div>
                  <div className="text-sm text-blue-600">
                    {stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0}% complete
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedEventId && (() => {
          const event = events.find(e => e.id === selectedEventId)
          const sectionStyle = event?.custom_background
            ? { 
                backgroundImage: event.custom_background.startsWith('blob:') 
                  ? `url(${event.custom_background})` 
                  : `url(${getStorageUrl(event.custom_background)})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center' 
              }
            : {}
          return (
            <div style={sectionStyle} className="min-h-[200px] rounded-lg mb-6 p-6 relative">
              <div className="bg-white/80 rounded-lg shadow-md p-6 max-w-xl mx-auto">
                {event?.custom_logo && (
                  <div className="flex justify-center mb-2">
                    <img src={getStorageUrl(event.custom_logo)} alt="Event Logo" className="h-20 object-contain" />
                  </div>
                )}
                <h2 className="text-2xl font-bold mb-1 text-center">{event?.name}</h2>
                <div className="text-gray-600 text-sm mb-1 text-center">{event?.company?.name}</div>
                {checkedInName && (
                  <div className="text-center text-green-600 font-bold text-xl mb-4">
                    Welcome, {checkedInName}!<br />
                    {checkedInTable && (
                      <span className="block text-lg text-blue-700 mt-2">Your Table: {checkedInTable}</span>
                    )}
                    <div className="mt-4">
                      <a
                        href={`/public/venue/${selectedEventId}/${checkedInName ? attendees.find(a => a.name === checkedInName)?.id : ''}`}
                        target="_blank"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        View Venue Layout
                      </a>
                    </div>
                  </div>
                )}
                <form onSubmit={handleManualCheckIn} className="space-y-3 mt-4">
                  <input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ID number or Staff ID"
                    autoFocus
                    disabled={!selectedEventId}
                  />
                  <button
                    type="submit"
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                    disabled={!selectedEventId}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Check In
                  </button>
                </form>
              </div>
            </div>
          )
        })()}

        {/* QR Scanner */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Camera className="h-6 w-6 mr-2" />
            Camera Scanner
          </h2>
          
          <div className="space-y-4">
            <Scanner 
              onScan={handleQRScan}
              onError={(error) => toast.error(error)}
              autoStart={true}
              eventSelected={!!selectedEventId}
            />

            {/* Manual Entry */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Manual ID Entry</h3>
              <form onSubmit={handleManualCheckIn} className="space-y-3">
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter ID number or Staff ID"
                />
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Check In
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Event QR Code */}
        {eventQR && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <QrCode className="h-6 w-6 mr-2" />
              Event QR Code
            </h2>
            
            <div className="text-center">
              <img 
                src={eventQR} 
                alt="Event QR Code" 
                className="w-48 h-48 mx-auto border border-gray-200 rounded-lg mb-3"
              />
              <p className="text-sm text-gray-600 mb-2">
                Event Check-in QR Code
              </p>
              <p className="text-xs text-gray-500">
                Share this QR code for quick access to check-in
              </p>
            </div>
          </div>
        )}

        {/* Recent Check-ins */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            Recent Check-ins
          </h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentCheckIns.map((attendee) => (
              <div key={attendee.id} className="flex items-center p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{attendee.name}</div>
                  <div className="text-sm text-gray-600">ID: {attendee.identification_number}</div>
                  {attendee.staff_id && (
                    <div className="text-sm text-gray-600">Staff: {attendee.staff_id}</div>
                  )}
                  {attendee.table_assignment && (
                    <div className="text-sm text-blue-700 font-semibold">Table: {attendee.table_assignment}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {new Date(attendee.check_in_time).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {recentCheckIns.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No check-ins yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Below the check-in form, add attendee management table */}
        {selectedEventId && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Attendee Management</h2>
              <div className="flex gap-2">
                <button onClick={openAddAttendee} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Add Attendee</button>
                <button onClick={resetAllCheckIn} className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600">Reset All Check-In</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2">Name</th>
                    <th className="p-2">ID</th>
                    <th className="p-2">Staff ID</th>
                    <th className="p-2">Table</th>
                    <th className="p-2">Checked In</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendeeLoading ? (
                    <tr><td colSpan={6} className="text-center p-4">Loading...</td></tr>
                  ) : attendees.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-4">No attendees</td></tr>
                  ) : attendees.map(a => (
                    <tr key={a.id} className="border-b">
                      <td className="p-2">{a.name}</td>
                      <td className="p-2">{a.identification_number}</td>
                      <td className="p-2">{a.staff_id}</td>
                      <td className="p-2">{a.table_assignment}</td>
                      <td className="p-2">{a.checked_in ? <span className="text-green-600 font-bold">Yes</span> : 'No'}</td>
                      <td className="p-2 flex gap-2">
                        <button onClick={() => openEditAttendee(a)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => deleteAttendee(a.id)} className="text-red-600 hover:underline">Delete</button>
                        <button onClick={() => resetCheckIn(a.id)} className="text-orange-600 hover:underline">Reset Check-In</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Attendee Modal */}
            {showAttendeeModal && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-bold mb-4">{editingAttendee ? 'Edit Attendee' : 'Add Attendee'}</h3>
                  <form onSubmit={handleAttendeeForm} className="space-y-3">
                    <input type="text" className="w-full border px-3 py-2 rounded" placeholder="Name" value={attendeeForm.name} onChange={e => setAttendeeForm({ ...attendeeForm, name: e.target.value })} required />
                    <input type="text" className="w-full border px-3 py-2 rounded" placeholder="Identification Number" value={attendeeForm.identification_number} onChange={e => setAttendeeForm({ ...attendeeForm, identification_number: e.target.value })} required />
                    <input type="text" className="w-full border px-3 py-2 rounded" placeholder="Staff ID" value={attendeeForm.staff_id} onChange={e => setAttendeeForm({ ...attendeeForm, staff_id: e.target.value })} />
                    <input type="text" className="w-full border px-3 py-2 rounded" placeholder="Table Assignment" value={attendeeForm.table_assignment} onChange={e => setAttendeeForm({ ...attendeeForm, table_assignment: e.target.value })} />
                    <input type="email" className="w-full border px-3 py-2 rounded" placeholder="Email" value={attendeeForm.email} onChange={e => setAttendeeForm({ ...attendeeForm, email: e.target.value })} />
                    <input type="tel" className="w-full border px-3 py-2 rounded" placeholder="Phone" value={attendeeForm.phone} onChange={e => setAttendeeForm({ ...attendeeForm, phone: e.target.value })} />
                    <div className="flex justify-end gap-2 mt-4">
                      <button type="button" onClick={() => setShowAttendeeModal(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">{editingAttendee ? 'Update' : 'Add'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Face Detection Modal */}
        {showFaceDetection && (
          (() => {
            try {
              console.log('FaceDetectionModal:', { showFaceDetection, currentAttendee, facePhoto, showCamera })
              if (!currentAttendee) {
                return (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
                      <h3 className="text-lg font-bold mb-4">Face Detection Error</h3>
                      <p className="text-red-600">No attendee data found. Please try again.</p>
                      <button
                        onClick={() => { setShowFaceDetection(false); setCurrentAttendee(null); setFacePhoto(null); }}
                        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )
              }
              return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 className="text-lg font-bold mb-4">Face Detection Required</h3>
                    <p className="text-gray-600 mb-4">
                      Please look at the camera to verify your identity for {currentAttendee.name}
                    </p>
                    {currentAttendee.face_photo_url && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Registered Photo:</p>
                        <img
                          src={getStorageUrl(currentAttendee.face_photo_url)}
                          alt="Registered photo"
                          className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                        />
                      </div>
                    )}
                    {!showCamera && !facePhoto && (
                      <button
                        onClick={startFaceDetectionCamera}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Start Camera
                      </button>
                    )}
                    {showCamera && (
                      <div className="relative">
                        <div className="relative bg-black rounded-lg overflow-hidden">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-64 object-cover"
                          />
                          {/* Camera Frame */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 border-4 border-white rounded-full opacity-80"></div>
                          </div>
                          {/* Capture Button */}
                          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                            <button
                              type="button"
                              onClick={captureFaceForDetection}
                              className="bg-white text-black px-6 py-2 rounded-full hover:bg-gray-100 flex items-center"
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Capture
                            </button>
                          </div>
                          {/* Close Button */}
                          <button
                            type="button"
                            onClick={() => {
                              stopFaceDetectionCamera()
                              setShowFaceDetection(false)
                              setCurrentAttendee(null)
                            }}
                            className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}
                    {facePhoto && (
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Captured Photo:</p>
                        <img
                          src={facePhoto}
                          alt="Captured photo"
                          className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300 mx-auto mb-4"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setFacePhoto(null)
                              startFaceDetectionCamera()
                            }}
                            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                          >
                            Retake
                          </button>
                          <button
                            onClick={proceedWithCheckIn}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                          >
                            Confirm Check-in
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            } catch (err) {
              console.error('FaceDetectionModal error:', err)
              return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
                    <h3 className="text-lg font-bold mb-4">Face Detection Error</h3>
                    <p className="text-red-600">An error occurred. Please try again.</p>
                    <button
                      onClick={() => { setShowFaceDetection(false); setCurrentAttendee(null); setFacePhoto(null); }}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )
            }
          })()
        )}
      </div>
    </ErrorBoundary>
  )
}