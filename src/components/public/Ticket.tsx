/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, MapPin, CheckCircle, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'

interface Attendee {
  id: string
  name: string
  email: string
  phone: string
  identification_number: string
  staff_id: string | null
  qr_code: string
  checked_in: boolean
  check_in_time: string
  event: {
    name: string
    description: string
    date: string
    location: string
  }
}

export default function Ticket() {
  const { attendeeId } = useParams()
  const [attendee, setAttendee] = useState<Attendee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (attendeeId) {
      fetchAttendee()
    }
  }, [attendeeId])

  const fetchAttendee = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select(`
          *,
          event:events (
            name,
            description,
            date,
            location
          )
        `)
        .eq('id', attendeeId)
        .single()

      if (error) throw error
      setAttendee(data)
    } catch (error: any) {
      toast.error('Ticket not found')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!attendee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ticket Not Found</h1>
          <p className="text-gray-600">The ticket you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 md:px-6 py-6 md:py-8 text-center">
            <QrCode className="h-12 w-12 mx-auto mb-4" />
            <h1 className="text-xl md:text-2xl font-bold">Event Ticket</h1>
            {attendee.checked_in && (
              <div className="mt-4 flex items-center justify-center text-green-200">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span>Checked In</span>
              </div>
            )}
          </div>

          {/* Event Info */}
          <div className="px-4 md:px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3">{attendee.event.name}</h2>
            {attendee.event.description && (
              <p className="text-gray-600 mb-4">{attendee.event.description}</p>
            )}
            <div className="space-y-2">
              {attendee.event.date && (
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="text-sm">
                    {new Date(attendee.event.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              {attendee.event.location && (
                <div className="flex items-center text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span className="text-sm">{attendee.event.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Attendee Info */}
          <div className="px-4 md:px-6 py-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Attendee Information</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div><strong>Name:</strong> {attendee.name}</div>
              <div><strong>ID Number:</strong> {attendee.identification_number}</div>
              {attendee.staff_id && <div><strong>Staff ID:</strong> {attendee.staff_id}</div>}
              {attendee.email && <div><strong>Email:</strong> {attendee.email}</div>}
              {attendee.phone && <div><strong>Phone:</strong> {attendee.phone}</div>}
            </div>
          </div>

          {/* QR Code */}
          <div className="px-4 md:px-6 py-6 md:py-8 text-center">
            <h3 className="font-semibold text-gray-900 mb-4">Check-in QR Code</h3>
            {attendee.qr_code && (
              <div className="flex justify-center">
                <img 
                  src={attendee.qr_code} 
                  alt="QR Code for check-in" 
                  className="w-40 h-40 md:w-48 md:h-48 border border-gray-200 rounded-lg"
                />
              </div>
            )}
            <p className="text-sm text-gray-600 mt-4">
              Present this QR code at the event for check-in
            </p>
          </div>

          {attendee.checked_in && attendee.check_in_time && (
            <div className="bg-green-50 px-4 md:px-6 py-4">
              <div className="flex items-center justify-center text-green-800">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">
                  Checked in at {new Date(attendee.check_in_time).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}