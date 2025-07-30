import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, getStorageUrl } from '../../lib/supabase'
import { Calendar, MapPin, Camera, Upload, X } from 'lucide-react'
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

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
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
  const [facePhoto, setFacePhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setShowCamera(true)
      }
    } catch (error) {
      toast.error('Camera access denied')
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)
        
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setFacePhoto(photoDataUrl)
        stopCamera()
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setFacePhoto(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = () => {
    setFacePhoto(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event || !formData.name.trim() || !formData.identification_number.trim()) return
    setSubmitting(true)
    try {
      const attendeeId = uuidv4()
      const qrData = `${attendeeId}|${event.id}|${formData.name}`
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'L'
      } as any)

      // Upload face photo if provided
      let facePhotoUrl = null
      if (facePhoto) {
        const photoBlob = await fetch(facePhoto).then(r => r.blob())
        const fileName = `face_photos/${attendeeId}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attendee-photos')
          .upload(fileName, photoBlob, {
            contentType: 'image/jpeg'
          })
        
        if (uploadError) {
          console.error('Error uploading photo:', uploadError)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('attendee-photos')
            .getPublicUrl(fileName)
          facePhotoUrl = publicUrl
        }
      }

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
          table_type: 'Regular',
          qr_code: qrCodeDataUrl,
          face_photo_url: facePhotoUrl
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-2">Event Registration</h1>
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold">{event.name}</div>
          {event.date && (
            <div className="text-gray-500 flex items-center justify-center">
              <Calendar className="h-4 w-4 mr-1" />
              {new Date(event.date).toLocaleString()}
            </div>
          )}
          {event.location && (
            <div className="text-gray-500 flex items-center justify-center">
              <MapPin className="h-4 w-4 mr-1" />
              {event.location}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Full Name *"
            required
          />
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Email"
          />
          <input
            type="tel"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Phone Number"
          />
          <input
            type="text"
            value={formData.identification_number}
            onChange={e => setFormData({ ...formData, identification_number: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Identification Number *"
            required
          />
          <input
            type="text"
            value={formData.staff_id}
            onChange={e => setFormData({ ...formData, staff_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Staff ID (Optional)"
          />
          
          {/* Face Photo Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Face Photo (Optional)</label>
            
            {!facePhoto && !showCamera && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </button>
              </div>
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
                      onClick={capturePhoto}
                      className="bg-white text-black px-6 py-2 rounded-full hover:bg-gray-100 flex items-center"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Capture
                    </button>
                  </div>
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
            
            {facePhoto && (
              <div className="relative">
                <img
                  src={facePhoto}
                  alt="Face photo"
                  className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            disabled={submitting}
          >
            {submitting ? 'Registering...' : 'Register for Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
