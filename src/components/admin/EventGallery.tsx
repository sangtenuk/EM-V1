import { useState, useEffect } from 'react'
import { Image, QrCode, Shuffle, Download, Trash2, Maximize2, Minimize2 } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'

import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'

interface Event {
  id: string
  name: string
  company_id: string
  max_gallery_uploads?: number
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [maxUploads, setMaxUploads] = useState(2)
  const [updatingMaxUploads, setUpdatingMaxUploads] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchPhotos()
      generateGalleryQR()
      fetchEventDetails()
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
          max_gallery_uploads,
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

  const fetchEventDetails = async () => {
    if (!selectedEventId) return
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('max_gallery_uploads')
        .eq('id', selectedEventId)
        .single()

      if (error) throw error
      
      setMaxUploads(data.max_gallery_uploads || 2)
    } catch (error: any) {
      console.error('Error fetching event details:', error)
    }
  }

  const updateMaxUploads = async () => {
    if (!selectedEventId) return
    
    try {
      setUpdatingMaxUploads(true)
      const { error } = await supabase
        .from('events')
        .update({ max_gallery_uploads: maxUploads })
        .eq('id', selectedEventId)

      if (error) throw error
      
      toast.success('Upload limit updated successfully')
    } catch (error: any) {
      toast.error('Error updating upload limit: ' + error.message)
    } finally {
      setUpdatingMaxUploads(false)
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
    <div className="h-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {photos.length > 0 ? (
        <>
          {/* Multiple Photo Flying Animation */}
          <div className="absolute inset-0">
            {photos.map((photo, index) => {
              // Calculate position based on index for flying effect
              const angle = (index / photos.length) * 360;
              const radius = 200 + (index % 3) * 50; // Varying distances
              const centerX = window.innerWidth / 2;
              const centerY = window.innerHeight / 2;
              
              // Calculate flying position
              const x = centerX + Math.cos(angle * Math.PI / 180) * radius;
              const y = centerY + Math.sin(angle * Math.PI / 180) * radius;
              
              // Determine if this photo is active (current slide)
              const isActive = index === currentSlideIndex;
              const isNearby = Math.abs(index - currentSlideIndex) <= 2;
              
              return (
                <motion.div
                  key={photo.id}
                  className="absolute"
                  initial={{ 
                    x: centerX - 100, 
                    y: centerY - 100, 
                    scale: 0.3, 
                    opacity: 0,
                    rotate: 0
                  }}
                  animate={{
                    x: isActive ? centerX - 150 : x,
                    y: isActive ? centerY - 150 : y,
                    scale: isActive ? 1.2 : (isNearby ? 0.8 : 0.4),
                    opacity: isActive ? 1 : (isNearby ? 0.7 : 0.3),
                    rotate: isActive ? 0 : angle * 0.1
                  }}
                  transition={{
                    duration: 0.8,
                    ease: "easeOut",
                    delay: index * 0.1
                  }}
                  whileHover={{
                    scale: isActive ? 1.3 : 0.9,
                    zIndex: 10
                  }}
                  onClick={() => setCurrentSlideIndex(index)}
                >
                  <div className="relative cursor-pointer">
                    <img
                      src={getStorageUrl(photo.photo_url)}
                      alt="Gallery"
                      className="w-32 h-32 object-cover rounded-xl shadow-2xl border-2 border-white/30 hover:border-white/60 transition-all duration-300"
                      style={{
                        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.4))',
                      }}
                    />
                    
                    {/* Photo Info - Only show for active photo */}
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-lg p-2 text-white text-center min-w-[140px]"
                      >
                        <div className="text-sm font-semibold truncate">
                          {photo.attendee_name || 'Anonymous'}
                        </div>
                        <div className="text-xs opacity-80">
                          {new Date(photo.created_at).toLocaleDateString()}
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Zoom indicator for active photo */}
                    {isActive && (
                      <motion.div
                        className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                      >
                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Central Active Photo Display */}
          {photos[currentSlideIndex] && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="relative max-w-2xl max-h-96">
                <motion.img
                  key={currentSlideIndex}
                  src={getStorageUrl(photos[currentSlideIndex]?.photo_url)}
                  alt="Active Gallery"
                  className="w-full h-auto object-contain rounded-2xl shadow-2xl border-4 border-white/40"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))',
                  }}
                />
                
                {/* Active Photo Info */}
                <motion.div
                  className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                >
                  <div className="text-lg font-semibold">
                    {photos[currentSlideIndex]?.attendee_name || 'Anonymous'}
                  </div>
                  <div className="text-sm opacity-80">
                    {new Date(photos[currentSlideIndex]?.created_at).toLocaleString()}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
          
          {/* Navigation Controls */}
          <div className="absolute bottom-8 left-8 text-white bg-black/50 backdrop-blur-sm rounded-lg p-4">
            <div className="text-lg font-semibold">
              {photos[currentSlideIndex]?.attendee_name || 'Anonymous'}
            </div>
            <div className="text-sm opacity-80">
              {new Date(photos[currentSlideIndex]?.created_at).toLocaleString()}
            </div>
          </div>
          
          <div className="absolute bottom-8 right-8 text-white bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
            {currentSlideIndex + 1} / {photos.length}
          </div>
          
          {/* Navigation Dots */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlideIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentSlideIndex 
                    ? 'bg-white scale-125' 
                    : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
          
          {/* Flying Animation Controls */}
          <div className="absolute top-8 left-8 text-white bg-black/50 backdrop-blur-sm rounded-lg p-3">
            <div className="text-sm font-semibold">Flying Gallery</div>
            <div className="text-xs opacity-80">Click photos to focus</div>
          </div>
        </>
      ) : (
        <div className="text-white text-center flex items-center justify-center h-full">
          <div className="text-center">
            <Image className="h-24 w-24 mx-auto mb-4 opacity-50 animate-pulse" />
            <h2 className="text-2xl font-bold mb-2">No Photos Yet</h2>
            <p className="opacity-80">Waiting for attendees to upload photos...</p>
          </div>
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
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            disabled={photos.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5 mr-2" /> : <Maximize2 className="h-5 w-5 mr-2" />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
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
              <>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="text-blue-700 font-medium mb-1">Gallery Stats</div>
                  <div className="text-2xl font-bold text-blue-900">{photos.length}</div>
                  <div className="text-sm text-blue-600">Photos uploaded</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-green-700 font-medium mb-2">Upload Limit</div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxUploads}
                      onChange={(e) => setMaxUploads(parseInt(e.target.value) || 2)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                    />
                    <span className="text-sm text-green-600">photos per attendee</span>
                    <button
                      onClick={updateMaxUploads}
                      disabled={updatingMaxUploads}
                      className="ml-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {updatingMaxUploads ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Default: 2 photos per attendee
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Display */}
        <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'lg:col-span-2'}`}>
          <div className={`${isFullscreen ? 'h-full' : 'bg-white rounded-lg shadow-md p-6'}`}>
            {!isFullscreen && (
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Image className="h-6 w-6 mr-2" />
                Gallery Display
              </h2>
            )}
            
            <div className={`${isFullscreen ? 'h-full' : 'aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4'}`}>
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