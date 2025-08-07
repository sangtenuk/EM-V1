import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Upload, Image, Camera, CheckCircle, Eye } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { uploadToPublicFolder } from '../../lib/fileUpload'

interface Event {
  id: string
  name: string
  description: string | null
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

export default function GalleryUpload() {
  const { eventId } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [attendeeName, setAttendeeName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadCount, setUploadCount] = useState(0)
  const [maxUploads, setMaxUploads] = useState(2)
<<<<<<< Updated upstream
=======
  const [showGallery, setShowGallery] = useState(false)
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [newPhotoIndicator, setNewPhotoIndicator] = useState(false)
>>>>>>> Stashed changes

  useEffect(() => {
    if (eventId) {
      fetchEvent()
      setupRealtimeSubscription()
    }
  }, [eventId])

  // Setup real-time subscription for gallery photos
  const setupRealtimeSubscription = () => {
    if (!eventId) return

    const subscription = supabase
      .channel(`gallery_photos_public_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gallery_photos',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          
          if (payload.eventType === 'INSERT') {
            // New photo added
            const newPhoto = payload.new as GalleryPhoto
            setPhotos(prevPhotos => [newPhoto, ...prevPhotos])
            
            // Show indicator for new photos
            setNewPhotoIndicator(true)
            setTimeout(() => setNewPhotoIndicator(false), 3000)
            
            toast.success(`New photo uploaded by ${newPhoto.attendee_name || 'Anonymous'}!`)
          } else if (payload.eventType === 'DELETE') {
            // Photo deleted
            const deletedPhotoId = payload.old.id
            setPhotos(prevPhotos => prevPhotos.filter(photo => photo.id !== deletedPhotoId))
          }
        }
      )
      .subscribe()

    // Cleanup subscription when component unmounts
    return () => {
      subscription.unsubscribe()
    }
  }

  const fetchPhotos = async () => {
    if (!eventId) return
    
    try {
      const { data, error } = await supabase
        .from('gallery_photos')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (error: any) {
      console.error('Error fetching photos:', error)
    }
  }

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          description,
          max_gallery_uploads,
          company:companies(name)
        `)
        .eq('id', eventId)
        .single()

      if (error) throw error

      const normalizedEvent = {
        ...data,
        company: Array.isArray(data.company)
          ? data.company[0] ?? { name: '' }
          : data.company
      }

      setEvent(normalizedEvent)
      setMaxUploads(normalizedEvent.max_gallery_uploads || 2)
      
      // Check upload count for this attendee
      await checkUploadCount()
      
      // Fetch existing photos
      await fetchPhotos()
    } catch (error: any) {
      toast.error('Event not found')
    }
  }

  const checkUploadCount = async () => {
    if (!eventId) return
    
    try {
      const { data, error } = await supabase
        .from('gallery_photos')
        .select('id')
        .eq('event_id', eventId)
        .eq('attendee_name', attendeeName.trim() || 'Anonymous')

      if (error) throw error
      
      setUploadCount(data?.length || 0)
    } catch (error: any) {
      console.error('Error checking upload count:', error)
    }
  }

  // Check upload count when attendee name changes
  useEffect(() => {
    if (eventId && attendeeName) {
      checkUploadCount()
    }
  }, [attendeeName, eventId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }

      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const uploadPhoto = async () => {
    if (!selectedFile || !event) return

    // Check upload limit
    if (uploadCount >= maxUploads) {
      toast.error(`You have reached the maximum upload limit of ${maxUploads} photos`)
      return
    }

    setUploading(true)

    try {
      // Upload to public folder using the new utility
      const uploadedFile = await uploadToPublicFolder(selectedFile, 'image', event.id);
      
      // Save photo record to database
      const { error } = await supabase
        .from('gallery_photos')
        .insert([{
          event_id: event.id,
          attendee_name: attendeeName.trim() || null,
          photo_url: uploadedFile.url
        }])

      if (error) throw error

      toast.success('Photo uploaded to public folder successfully!')
      setUploaded(true)
      setSelectedFile(null)
      setPreviewUrl(null)
      setAttendeeName('')
      setUploadCount(prev => prev + 1)
<<<<<<< Updated upstream
=======
      
      // Show gallery after successful upload
      setShowGallery(true)
>>>>>>> Stashed changes
    } catch (error: any) {
      toast.error('Error uploading photo: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setUploaded(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setAttendeeName('')
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (uploaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Photo Uploaded!</h1>
            <p className="text-gray-600 mb-6">
              Thank you for sharing your moment from {event.name}
            </p>
            <button
              onClick={resetForm}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Another Photo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-4">
<<<<<<< Updated upstream
      <div className="max-w-xl mx-auto">
=======
      <div className="max-w-4xl mx-auto">
>>>>>>> Stashed changes
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 text-white px-4 md:px-6 py-4 md:py-6 text-center">
            <div className="flex items-center justify-center mb-3">
              <Camera className="h-8 w-8" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-2">Share Your Photo</h1>
            <p className="text-blue-100 text-sm">{event.name}</p>
            <p className="text-blue-200 text-xs">{event?.company?.name ?? 'No Company'}</p>
<<<<<<< Updated upstream
          </div>

          <div className="px-4 md:px-6 py-4 md:py-6">
=======
            
            {/* Real-time indicator */}
            <div className="flex items-center justify-center space-x-2 mt-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-200">Live updates enabled</span>
            </div>
          </div>

          <div className="px-4 md:px-6 py-4 md:py-6">
            {/* Gallery Toggle */}
            <div className="flex justify-center mb-6">
              <button
                onClick={() => setShowGallery(!showGallery)}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>{showGallery ? 'Hide Gallery' : 'View Gallery'}</span>
                {photos.length > 0 && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    {photos.length}
                  </span>
                )}
              </button>
            </div>

            {/* Gallery View */}
            {showGallery && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Image className="h-5 w-5 mr-2" />
                  Live Gallery
                  {newPhotoIndicator && (
                    <div className="ml-2 flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600">New!</span>
                    </div>
                  )}
                </h3>
                
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={getStorageUrl(photo.photo_url)}
                          alt="Gallery"
                          className={`w-full h-24 object-cover rounded-lg transition-all duration-300 ${
                            index === 0 && newPhotoIndicator ? 'ring-2 ring-green-500 scale-105' : ''
                          }`}
                        />
                        {photo.attendee_name && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded-b-lg truncate">
                            {photo.attendee_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No photos uploaded yet</p>
                    <p className="text-sm">Be the first to share a photo!</p>
                  </div>
                )}
              </div>
            )}

>>>>>>> Stashed changes
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Photo
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 md:p-4 text-center hover:border-blue-400 transition-colors">
                  {previewUrl ? (
                    <div className="space-y-3">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-full h-32 md:h-40 object-contain mx-auto rounded"
                      />
                      <button
                        onClick={() => {
                          setSelectedFile(null)
                          setPreviewUrl(null)
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Choose Different Photo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm mb-1">Click to select a photo</p>
                      <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="mt-2 inline-block bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Select Photo
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {selectedFile && (
                <button
                  onClick={uploadPhoto}
                  disabled={uploading || uploadCount >= maxUploads}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : uploadCount >= maxUploads ? 'Upload Limit Reached' : 'Upload Photo'}
                </button>
              )}
            </div>

            <div className="mt-4 text-center text-xs text-gray-600">
              <p>• Your photo will be added to the event gallery</p>
              <p>• Photos may be displayed during the event</p>
              <p>• By uploading, you consent to public display</p>
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                <p className="text-blue-800 font-medium text-sm">
                  Upload Limit: {uploadCount}/{maxUploads} photos
                </p>
                {uploadCount >= maxUploads && (
                  <p className="text-red-600 text-xs mt-1">
                    You have reached the maximum upload limit
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}