import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, getStorageUrl } from '../../lib/supabase'
import { CheckCircle, UserCheck, MapPin, Calendar, Clock, User, Building, Hash } from 'lucide-react'
import toast from 'react-hot-toast'

interface Event {
  id: string
  name: string
  description: string
  date: string
  location: string
  custom_logo?: string | null
  custom_background?: string | null
  company: {
    name: string
  }
}

interface CheckInResult {
  success: boolean
  message: string
  attendee?: any
}

export default function CheckIn() {
  const { eventId } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [identificationNumber, setIdentificationNumber] = useState('')
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  useEffect(() => {
    if (eventId) {
      fetchEvent()
    }
  }, [eventId])

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          description,
          date,
          location,
          custom_logo,
          custom_background,
          company:companies(name)
        `)
        .eq('id', eventId)
        .single()

      if (error) throw error
      // Handle different data structures
      let eventData: any = data
      if (Array.isArray(eventData.company)) {
        eventData = {
          ...eventData,
          company: eventData.company[0]
        }
      }
      setEvent(eventData)
    } catch (error: any) {
      toast.error('Error fetching event: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identificationNumber.trim()) {
      toast.error('Please enter your identification number or staff ID')
      return
    }

    setIsCheckingIn(true)
    setCheckInResult(null)

    try {
      const result = await processCheckIn(identificationNumber)
      setCheckInResult(result)
      
      if (result.success) {
        toast.success(result.message)
        setIdentificationNumber('')
      } else {
        toast.error(result.message)
      }
    } catch (error: any) {
      toast.error('Error processing check-in: ' + error.message)
    } finally {
      setIsCheckingIn(false)
    }
  }

  const processCheckIn = async (idNumber: string): Promise<CheckInResult> => {
    try {
      // Search for attendee by identification_number or staff_id
      const { data: attendees, error } = await supabase
        .from('attendees')
        .select(`
          id,
          name,
          identification_number,
          staff_id,
          checked_in,
          check_in_time,
          event_id,
          table_assignment,
          table_number,
          seat_number,
          face_photo_url,
          company,
          email,
          phone,
          created_at,
          event:events(name)
        `)
        .eq('event_id', eventId)
        .or(`identification_number.eq.${idNumber},staff_id.eq.${idNumber}`)

      if (error) throw error

      if (!attendees || attendees.length === 0) {
        return { success: false, message: 'No attendee found with this ID number' }
      }

      const attendee = attendees[0]

      if (attendee.checked_in) {
        return { 
          success: false, 
          message: `${attendee.name} is already checked in at ${new Date(attendee.check_in_time).toLocaleString()}` 
        }
      }

      // Check in the attendee
      console.log('Updating attendee check-in:', attendee.id, {
        checked_in: true,
        check_in_time: new Date().toISOString()
      })
      
      const { error: updateError } = await supabase
        .from('attendees')
        .update({
          checked_in: true,
          check_in_time: new Date().toISOString()
        })
        .eq('id', attendee.id)

      if (updateError) {
        console.error('Error updating attendee:', updateError)
        throw updateError
      }
      
      console.log('Successfully updated attendee check-in')

      // Get table position if table_number exists
      let tableInfo = ''
      if (attendee.table_number) {
        tableInfo = `Table ${attendee.table_number}`
        if (attendee.seat_number) {
          tableInfo += ` - Seat ${attendee.seat_number}`
        }
      } else if (attendee.table_assignment) {
        tableInfo = attendee.table_assignment
      }

      return {
        success: true,
        attendee: {
          ...attendee,
          table_position: tableInfo
        },
        message: `${attendee.name} checked in successfully!${tableInfo ? ` Your table assignment is: ${tableInfo}` : ''}`
      }
    } catch (error: any) {
      return { success: false, message: 'Error processing check-in: ' + error.message }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-600">The event you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    )
  }

  const sectionStyle = event?.custom_background
    ? { 
        backgroundImage: event.custom_background.startsWith('blob:') 
          ? `url(${event.custom_background})` 
          : `url(${getStorageUrl(event.custom_background)})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : {}

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={sectionStyle} className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-8 max-w-md w-full">
          {/* Event Logo */}
          {event?.custom_logo && (
            <div className="flex justify-center mb-6">
              <img src={getStorageUrl(event.custom_logo)} alt="Event Logo" className="h-16 object-contain" />
            </div>
          )}

          {/* Event Info */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.name}</h1>
            <p className="text-gray-600 mb-4">{event?.company?.name ?? 'No Company'}</p>
            
            <div className="space-y-2 text-sm text-gray-600">
              {event.date && (
                <div className="flex items-center justify-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(event.date).toLocaleDateString()}
                </div>
              )}
              {event.location && (
                <div className="flex items-center justify-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  {event.location}
                </div>
              )}
            </div>
          </div>

          {/* Check-in Form */}
          {!checkInResult?.success ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Self Check-In</h2>
                <p className="text-gray-600">Enter your identification number or staff ID to check in</p>
              </div>

              <form onSubmit={handleCheckIn} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={identificationNumber}
                    onChange={(e) => setIdentificationNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                    placeholder="Enter ID Number or Staff ID"
                    autoFocus
                    disabled={isCheckingIn}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCheckingIn || !identificationNumber.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCheckingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Checking In...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-5 w-5 mr-2" />
                      Check In
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Success State */
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-4">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-green-900 mb-2">Welcome!</h2>
                <p className="text-green-700 text-lg mb-4">{checkInResult.attendee?.name}</p>
                <p className="text-gray-600 mb-4">{checkInResult.message}</p>
                
                {/* Enhanced Attendee Details */}
                <div className="space-y-3">
                  {/* Staff ID */}
                  {checkInResult.attendee?.staff_id && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-center text-blue-800">
                        <Hash className="h-4 w-4 mr-2" />
                        <span className="font-semibold">Staff ID: {checkInResult.attendee.staff_id}</span>
                      </div>
                    </div>
                  )}

                  {/* Company */}
                  {checkInResult.attendee?.company && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center justify-center text-purple-800">
                        <Building className="h-4 w-4 mr-2" />
                        <span className="font-semibold">{checkInResult.attendee.company}</span>
                      </div>
                    </div>
                  )}

                  {/* Table Assignment */}
                  {checkInResult.attendee?.table_position && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center justify-center text-green-800">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span className="font-semibold">Table: {checkInResult.attendee.table_position}</span>
                      </div>
                    </div>
                  )}

                  {/* Contact Info */}
                  {(checkInResult.attendee?.email || checkInResult.attendee?.phone) && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="space-y-1 text-sm">
                        {checkInResult.attendee.email && (
                          <div className="flex items-center justify-center text-gray-700">
                            <User className="h-3 w-3 mr-1" />
                            <span>{checkInResult.attendee.email}</span>
                          </div>
                        )}
                        {checkInResult.attendee.phone && (
                          <div className="flex items-center justify-center text-gray-700">
                            <User className="h-3 w-3 mr-1" />
                            <span>{checkInResult.attendee.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center text-gray-600 text-sm">
                  <Clock className="h-4 w-4 mr-2" />
                  Checked in at {new Date().toLocaleTimeString()}
                </div>
              </div>

              <button
                onClick={() => {
                  setCheckInResult(null)
                  setIdentificationNumber('')
                }}
                className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Check In Another Person
              </button>
            </div>
          )}

          {/* Error State */}
          {checkInResult && !checkInResult.success && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <p className="text-red-700 text-center">{checkInResult.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 