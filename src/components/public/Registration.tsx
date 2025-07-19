import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

interface Event {
  id: string
  name: string
  description: string
  date: string
  location: string
  max_attendees: number
}

export default function Registration() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    identification_number: '',
    staff_id: ''
  })

  useEffect(() => {
    if (eventId) {
      fetchEvent()
    }
  }, [eventId])

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (error: any) {
      toast.error('Event not found')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event || !formData.name.trim() || !formData.identification_number.trim()) return

    setSubmitting(true)

    try {
      const attendeeId = crypto.randomUUID()

      const qrData = `${attendeeId}|${event.id}|${formData.name}`

      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'L'
      } as any)

      const { error } = await supabase
        .from('attendees')
        .insert([{
          id: attendeeId,
          event_id: event.id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          identification_number: formData.identification_number,
          staff_id: formData.staff_id || null,
          qr_code: qrCodeDataUrl
        }])

      if (error) throw error

      toast.success('Registration successful!')
      navigate(`/public/ticket/${attendeeId}`)
    } catch (error: any) {
      toast.error('Registration failed: ' + error.message)
    } finally {
      setSubmitting(false)
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h1>
          <p className="text-gray-600">The event you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Event Header */}
          <div className="bg-blue-600 text-white px-4 md:px-6 py-6 md:py-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-4">{event.name}</h1>
            {event.description && (
              <p className="text-blue-100 mb-4">{event.description}</p>
            )}
            <div className="space-y-2">
              {event.date && (
                <div className="flex items-center text-blue-100">
                  <Calendar className="h-5 w-5 mr-2" />
                  <span className="text-sm md:text-base">{new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center text-blue-100">
                  <MapPin className="h-5 w-5 mr-2" />
                  <span className="text-sm md:text-base">{event.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Registration Form */}
          <div className="px-4 md:px-6 py-6 md:py-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Register for Event</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="identification_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Identification Number *
                </label>
                <input
                  type="text"
                  id="identification_number"
                  required
                  value={formData.identification_number}
                  onChange={(e) => setFormData({ ...formData, identification_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your identification number"
                />
              </div>

              <div>
                <label htmlFor="staff_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Staff ID
                </label>
                <input
                  type="text"
                  id="staff_id"
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your staff ID (optional)"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your phone number"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 font-medium text-sm md:text-base"
              >
                {submitting ? 'Registering...' : 'Register Now'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
