/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect, useRef } from 'react' 
import { QrCode, UserCheck, Users, CheckCircle, Camera } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'

interface Event {
  id: string
  name: string
  registration_qr: string | null
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
    event: {
     name: string
   }[]
  }
  message: string
}

interface CheckInSystemProps {
  userCompany?: any
}

export default function CheckInSystem({ userCompany }: CheckInSystemProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const [manualId, setManualId] = useState('')
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [eventQR, setEventQR] = useState('')

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

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
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
      
      // OVERIDE const checkInUrl = `${window.location.origin}/admin/checkin?event=${selectedEventId}`
      const baseUrl = 'https://nw.hopto.org/'
      const checkInUrl = `${baseUrl}//admin/checkin?event=${selectedEventId}`
      const qrDataUrl = await QRCodeLib.toDataURL(checkInUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      setEventQR(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
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
          check_in_time,
          event:events(name)
        `)
        .eq('event_id', selectedEventId)
        .eq('checked_in', true)
        .order('check_in_time', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentCheckIns(data)
    } catch (error: any) {
      console.error('Error fetching recent check-ins:', error)
    }
  }

  const startScanner = () => {
    if (!selectedEventId) {
      toast.error('Please select an event first')
      return
    }

    setScannerActive(true)
    
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      },
      false
    )

    scanner.render(
      (decodedText) => {
        handleQRScan(decodedText)
        scanner.clear()
        setScannerActive(false)
      },
      (error) => {
        console.log('QR scan error:', error)
      }
    )

    scannerRef.current = scanner
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setScannerActive(false)
  }

  const handleQRScan = async (qrData: string) => {
    try {
      const result = await processCheckIn(qrData)
      
      if (result.success) {
        toast.success(result.message)
        fetchEventStats()
        fetchRecentCheckIns()
      } else {
        toast.error(result.message)
      }
    } catch (error: any) {
      toast.error('Error processing check-in: ' + error.message)
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

        return {
          success: true,
          attendee,
          message: `${attendee.name} checked in successfully!`
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
    if (!manualId.trim()) return

    const result = await processCheckIn(manualId)
    
    if (result.success) {
      toast.success(result.message)
      setManualId('')
      fetchEventStats()
      fetchRecentCheckIns()
    } else {
      toast.error(result.message)
    }
  }

  return (
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

      {selectedEventId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Scanner */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Camera className="h-6 w-6 mr-2" />
              Camera Scanner
            </h2>
            
            <div className="space-y-4">
              {!scannerActive ? (
                <div>
                  <button
                    onClick={startScanner}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Start Camera Scanner
                  </button>
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    Click to activate camera and scan QR codes
                  </p>
                </div>
              ) : (
                <div>
                  <div id="qr-reader" className="w-full"></div>
                  <button
                    onClick={stopScanner}
                    className="w-full mt-4 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Stop Scanner
                  </button>
                </div>
              )}

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
        </div>
      )}

      {!selectedEventId && (
        <div className="text-center py-12">
          <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Event</h3>
          <p className="text-gray-600">Choose an event from the dropdown above to start checking in attendees</p>
        </div>
      )}
    </div>
  )
}