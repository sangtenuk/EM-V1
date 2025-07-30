import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import VenueLayout from '../admin/VenueLayout'
import { MapPin, Users } from 'lucide-react'

interface Attendee {
  id: string
  name: string
  table_assignment: string | null
}

export default function AttendeeVenueView() {
  const { eventId, attendeeId } = useParams()
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
        .select('id, name, table_assignment')
        .eq('id', attendeeId)
        .single()

      if (error) throw error
      setAttendee(data)
    } catch (error: any) {
      console.error('Error fetching attendee:', error)
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Attendee Not Found</h1>
          <p className="text-gray-600">The attendee you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {attendee.name}!</h1>
            <p className="text-gray-600">Here's your venue layout and seating information</p>
          </div>
        </div>

        {/* Venue Layout */}
        {eventId && (
          <VenueLayout
            eventId={eventId}
            isAttendeeView={true}
            attendeeTable={attendee.table_assignment}
          />
        )}

        {/* Seating Information */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <MapPin className="h-6 w-6 mr-2" />
            Your Seating Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Attendee Details</h3>
              <div className="space-y-2">
                <div><span className="font-medium">Name:</span> {attendee.name}</div>
                <div><span className="font-medium">Attendee ID:</span> {attendee.id}</div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">Table Assignment</h3>
              {attendee.table_assignment ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-700">Table {attendee.table_assignment}</div>
                  <p className="text-green-600">Please find your table in the venue layout above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-gray-500">No table assigned yet</div>
                  <p className="text-sm text-gray-600">Please check with event organizers for your seating assignment.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            Venue Instructions
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</div>
              <div>
                <h3 className="font-semibold">Find Your Table</h3>
                <p className="text-gray-600">Look for your highlighted table in the venue layout above.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</div>
              <div>
                <h3 className="font-semibold">Table Types</h3>
                <p className="text-gray-600">Different colored tables indicate different seating categories (VVIP, VIP, Regular, Staff).</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</div>
              <div>
                <h3 className="font-semibold">Need Help?</h3>
                <p className="text-gray-600">If you can't find your table or need assistance, please contact event staff.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 