import { useState, useEffect } from 'react'
import { Image, QrCode, Shuffle, Download, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'

interface Event {
  id: string
  name: string
  company_id: string
  company: {
    name: string
  }
}

interface GalleryPhoto {
  id: string
  attendee_name: string | null
  photo_url: string
  created_at: string
}

interface EventGalleryProps {
  userCompany?: any
}

export default function EventGallery({ userCompany }: EventGalleryProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isSlideshow, setIsSlideshow] = useState(false)
  const [galleryQR, setGalleryQR] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchPhotos()
      generateGalleryQR()
    }
  }, [selectedEventId])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSlideshow && photos.length > 0) {
      interval = setInterval(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % photos.length)
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [isSlideshow, photos.length])

  const fetchEvents = async () => {
    try {
      let query = supabase.from('events').select(`
          id,
          name,
          company_id,
          company:companies(name)
        `)

      // Filter by company if user is a company user
      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform data to ensure company is a single object, not an array
      const transformedData = data.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      }))
      
      setEvents(transformedData)

      // Auto-select first event for company users
      if (userCompany && transformedData && transformedData.length > 0) {
        setSelectedEventId(transformedData[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    }
  }

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('gallery_photos')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhotos(data)
    } catch (error: any) {
      toast.error('Error fetching photos: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const generateGalleryQR = async () => {
    try {
      const galleryUrl = `${window.location.origin}/public/gallery/${selectedEventId}`
      const qrDataUrl = await QRCodeLib.toDataURL(galleryUrl)
      setGalleryQR(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    try {
      const { error } = await supabase
        .from('gallery_photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error
      toast.success('Photo deleted successfully')
      fetchPhotos()
    } catch (error: any) {
      toast.error('Error deleting photo: ' + error.message)
    }
  }

  const shufflePhotos = () => {
    const shuffled = [...photos].sort(() => Math.random() - 0.5)
    setPhotos(shuffled)
    setCurrentSlideIndex(0)
  }

  const downloadPhoto = (photoUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = photoUrl
    link.download = `gallery-photo-${index + 1}.jpg`
    link.click()
  }

  const SlideshowDisplay = () => (
    <div className="h-full bg-black flex items-center justify-center relative">
      {photos.length > 0 ? (
        <div className="relative w-full h-full">
          <img
            src={photos[currentSlideIndex]?.photo_url}
            alt="Gallery"
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-8 left-8 text-white bg-black bg-opacity-50 rounded-lg p-4">
            <div className="text-lg font-semibold">
              {photos[currentSlideIndex]?.attendee_name || 'Anonymous'}
            </div>
            <div className="text-sm opacity-80">
              {new Date(photos[currentSlideIndex]?.created_at).toLocaleString()}
            </div>
          </div>
          <div className="absolute bottom-8 right-8 text-white bg-black bg-opacity-50 rounded-lg px-4 py-2">
            {currentSlideIndex + 1} / {photos.length}
          </div>
        </div>
      ) : (
        <div className="text-white text-center">
          <Image className="h-24 w-24 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">No Photos Yet</h2>
          <p className="opacity-80">Waiting for attendees to upload photos...</p>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Gallery</h1>
          <p className="text-gray-600 mt-2">Manage photo uploads and slideshow display</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={shufflePhotos}
            disabled={photos.length === 0}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Shuffle className="h-5 w-5 mr-2" />
            Shuffle
          </button>
          <button
            onClick={() => setIsSlideshow(!isSlideshow)}
            disabled={photos.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSlideshow ? 'Stop Slideshow' : 'Start Slideshow'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <QrCode className="h-6 w-6 mr-2" />
            Gallery Setup
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {userCompany && events.length <= 1 ? 'Event' : 'Select Event'}
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
                  {!userCompany && <option value="">Select an event</option>}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {userCompany ? event.name : `${event.name} (${event.company.name})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedEventId && galleryQR && (
              <div className="text-center">
                <h3 className="font-medium mb-2">Upload QR Code</h3>
                <img src={galleryQR} alt="Gallery QR Code" className="w-48 h-48 mx-auto border rounded-lg" />
                <p className="text-sm text-gray-600 mt-2">
                  Attendees scan this to upload photos
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/public/gallery/${selectedEventId}`)}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  Copy Upload Link
                </button>
              </div>
            )}

            {selectedEventId && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-blue-700 font-medium mb-1">Gallery Stats</div>
                <div className="text-2xl font-bold text-blue-900">{photos.length}</div>
                <div className="text-sm text-blue-600">Photos uploaded</div>
              </div>
            )}
          </div>
        </div>

        {/* Display */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Image className="h-6 w-6 mr-2" />
              Gallery Display
            </h2>
            
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
              {selectedEventId ? (
                <SlideshowDisplay />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Image className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select an event to see gallery</p>
                  </div>
                </div>
              )}
            </div>

            {photos.length > 0 && (
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 bg-gray-100 rounded">
                  {currentSlideIndex + 1} / {photos.length}
                </span>
                <button
                  onClick={() => setCurrentSlideIndex(Math.min(photos.length - 1, currentSlideIndex + 1))}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Photo Grid */}
          {photos.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">All Photos</h2>
              
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {photos.map((photo, index) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.photo_url}
                        alt="Gallery"
                        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setCurrentSlideIndex(index)}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 flex space-x-2">
                          <button
                            onClick={() => downloadPhoto(photo.photo_url, index)}
                            className="text-white hover:text-blue-300 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deletePhoto(photo.id)}
                            className="text-white hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {photo.attendee_name && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded-b-lg truncate">
                          {photo.attendee_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}