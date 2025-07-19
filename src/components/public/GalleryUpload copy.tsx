/* import React, { useState, useEffect } from 'react' */
 import { useState, useEffect } from 'react' 
import { useParams } from 'react-router-dom'
import { Upload, Image, Camera, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Event {
  id: string
  name: string
  description: string | null
  company: {
    name: string
  }
}

export default function GalleryUpload() {
  const { eventId } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [attendeeName, setAttendeeName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
          company:companies(name)
        `)
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (error: any) {
      toast.error('Event not found')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
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

    setUploading(true)

    try {
      // Convert file to base64 for storage (in a real app, you'd use proper file storage)
      const reader = new FileReader()
      reader.onload = async (e) => {
        const photoUrl = e.target?.result as string

        const { error } = await supabase
          .from('gallery_photos')
          .insert([{
            event_id: event.id,
            attendee_name: attendeeName.trim() || null,
            photo_url: photoUrl
          }])

        if (error) throw error

        toast.success('Photo uploaded successfully!')
        setUploaded(true)
        setSelectedFile(null)
        setPreviewUrl(null)
        setAttendeeName('')
      }
      reader.readAsDataURL(selectedFile)
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
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-4 md:px-6 py-6 md:py-8 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4" />
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Share Your Photo</h1>
            <p className="text-blue-100">{event.name}</p>
            <p className="text-blue-200 text-sm">{event.company.name}</p>
          </div>

          {/* Upload Form */}
          <div className="px-4 md:px-6 py-6 md:py-8">
            <div className="space-y-6">
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 text-center hover:border-blue-400 transition-colors">
                  {previewUrl ? (
                    <div className="space-y-4">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-full h-48 md:h-64 object-contain mx-auto rounded-lg"
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
                      <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">Click to select a photo</p>
                      <p className="text-sm text-gray-500">PNG, JPG up to 10MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
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
                  disabled={uploading}
                  className="w-full bg-green-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm md:text-base"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              )}
            </div>

            <div className="mt-8 text-center text-sm text-gray-600">
              <p>• Your photo will be added to the event gallery</p>
              <p>• Photos may be displayed during the event</p>
              <p>• By uploading, you consent to public display</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}