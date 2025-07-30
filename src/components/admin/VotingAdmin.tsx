import { useState, useEffect } from 'react'
import { Plus, Vote, Image, Edit, Trash2, Play, Pause, Upload } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'

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

interface VotingSession {
  id: string
  event_id: string
  title: string
  description: string | null
  is_active: boolean
  created_at: string
  photos?: VotingPhoto[]
}

interface VotingPhoto {
  id: string
  voting_session_id: string
  title: string
  photo_url: string
  created_at: string
  vote_count?: number
}

interface VotingAdminProps {
  userCompany?: any
}

export default function VotingAdmin({ userCompany }: VotingAdminProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [votingSessions, setVotingSessions] = useState<VotingSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [photos, setPhotos] = useState<VotingPhoto[]>([])
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [editingSession, setEditingSession] = useState<VotingSession | null>(null)
  const [votingQR, setVotingQR] = useState('')
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: ''
  })
  const [photoForm, setPhotoForm] = useState({
    title: '',
    photo_url: ''
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchVotingSessions()
    }
  }, [selectedEventId])

  useEffect(() => {
    if (selectedSessionId) {
      fetchPhotos()
      generateVotingQR()
    }
  }, [selectedSessionId])

  const fetchEvents = async () => {
    try {
      let query = supabase.from('events').select(`
          id,
          name,
          company_id,
          company:companies(name)
        `)

      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      const transformedData = data?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      })) || []
      
      setEvents(transformedData)

      if (userCompany && transformedData && transformedData.length > 0) {
        setSelectedEventId(transformedData[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    }
  }

  const fetchVotingSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVotingSessions(data)
    } catch (error: any) {
      toast.error('Error fetching voting sessions: ' + error.message)
    }
  }

  const fetchPhotos = async () => {
    try {
      const { data: photosData, error } = await supabase
        .from('voting_photos')
        .select('*')
        .eq('voting_session_id', selectedSessionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const photosWithCounts = await Promise.all(
        photosData.map(async (photo) => {
          const { data: votes } = await supabase
            .from('votes')
            .select('id')
            .eq('voting_photo_id', photo.id)

          return {
            ...photo,
            vote_count: votes?.length || 0
          }
        })
      )

      setPhotos(photosWithCounts)
    } catch (error: any) {
      toast.error('Error fetching photos: ' + error.message)
    }
  }

  const generateVotingQR = async () => {
    try {
      const votingUrl = `${window.location.origin}/public/voting/${selectedSessionId}`
      const qrDataUrl = await QRCodeLib.toDataURL(votingUrl)
      setVotingQR(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingSession) {
        const { error } = await supabase
          .from('voting_sessions')
          .update({
            title: sessionForm.title,
            description: sessionForm.description || null
          })
          .eq('id', editingSession.id)

        if (error) throw error
        toast.success('Voting session updated successfully')
      } else {
        const { error } = await supabase
          .from('voting_sessions')
          .insert([{
            event_id: selectedEventId,
            title: sessionForm.title,
            description: sessionForm.description || null
          }])

        if (error) throw error
        toast.success('Voting session created successfully')
      }

      resetSessionForm()
      fetchVotingSessions()
    } catch (error: any) {
      toast.error('Error saving voting session: ' + error.message)
    }
  }

  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { error } = await supabase
        .from('voting_photos')
        .insert([{
          voting_session_id: selectedSessionId,
          title: photoForm.title,
          photo_url: photoForm.photo_url
        }])

      if (error) throw error
      toast.success('Photo added successfully')
      resetPhotoForm()
      fetchPhotos()
    } catch (error: any) {
      toast.error('Error adding photo: ' + error.message)
    }
  }

  const toggleSessionStatus = async (sessionId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await supabase
          .from('voting_sessions')
          .update({ is_active: false })
          .eq('event_id', selectedEventId)
      }

      const { error } = await supabase
        .from('voting_sessions')
        .update({ is_active: isActive })
        .eq('id', sessionId)

      if (error) throw error
      toast.success(`Voting session ${isActive ? 'activated' : 'deactivated'}`)
      fetchVotingSessions()
    } catch (error: any) {
      toast.error('Error updating session status: ' + error.message)
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this voting session? This will also delete all photos and votes.')) return

    try {
      const { error } = await supabase
        .from('voting_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) throw error
      toast.success('Voting session deleted successfully')
      fetchVotingSessions()
      if (selectedSessionId === sessionId) {
        setSelectedSessionId('')
        setPhotos([])
      }
    } catch (error: any) {
      toast.error('Error deleting session: ' + error.message)
    }
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo? This will also delete all votes for it.')) return

    try {
      const { error } = await supabase
        .from('voting_photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error
      toast.success('Photo deleted successfully')
      fetchPhotos()
    } catch (error: any) {
      toast.error('Error deleting photo: ' + error.message)
    }
  }

  const resetSessionForm = () => {
    setSessionForm({ title: '', description: '' })
    setEditingSession(null)
    setShowSessionModal(false)
  }

  const resetPhotoForm = () => {
    setPhotoForm({ title: '', photo_url: '' })
    setShowPhotoModal(false)
  }

  const openEditModal = (session: VotingSession) => {
    setEditingSession(session)
    setSessionForm({
      title: session.title,
      description: session.description || ''
    })
    setShowSessionModal(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = (event) => {
        const photoUrl = event.target?.result as string
        setPhotoForm({ ...photoForm, photo_url: photoUrl })
      }
      reader.readAsDataURL(file)
    } catch (error: any) {
      toast.error('Error uploading file: ' + error.message)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voting Administration</h1>
          <p className="text-gray-600 mt-2">Manage voting sessions and photos</p>
        </div>
        <button
          onClick={() => setShowSessionModal(true)}
          disabled={!selectedEventId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Voting Session
        </button>
      </div>

      {/* Event Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Voting Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a voting session</option>
              {votingSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} {session.is_active && '(Active)'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Voting Sessions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Vote className="h-6 w-6 mr-2" />
            Voting Sessions
          </h2>
          
          <div className="space-y-3">
            {votingSessions.map((session) => (
              <div key={session.id} className={`p-4 border rounded-lg ${session.is_active ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{session.title}</h3>
                    {session.description && (
                      <p className="text-sm text-gray-600">{session.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => toggleSessionStatus(session.id, !session.is_active)}
                      className={`p-1 rounded ${session.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                    >
                      {session.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(session)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Created {new Date(session.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            
            {votingSessions.length === 0 && selectedEventId && (
              <div className="text-center py-8 text-gray-500">
                <Vote className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No voting sessions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Photos Management */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <Image className="h-6 w-6 mr-2" />
                Voting Photos
              </h2>
              <button
                onClick={() => setShowPhotoModal(true)}
                disabled={!selectedSessionId}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Photo
              </button>
            </div>

            {selectedSessionId && votingQR && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-900 mb-2">Voting QR Code</h3>
                    <p className="text-sm text-blue-700">Share this QR code for attendees to vote</p>
                  </div>
                  <img src={votingQR} alt="Voting QR Code" className="w-24 h-24 border rounded-lg" />
                </div>
              </div>
            )}
            
            {photos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="border rounded-lg overflow-hidden">
                    <img
                      src={getStorageUrl(photo.photo_url)}
                      alt={photo.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 mb-2">{photo.title}</h3>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {photo.vote_count} votes
                        </span>
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedSessionId ? (
              <div className="text-center py-12 text-gray-500">
                <Image className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>No photos added yet</p>
                <p className="text-sm">Add photos for attendees to vote on</p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Vote className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a voting session to manage photos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingSession ? 'Edit Voting Session' : 'Create Voting Session'}
            </h2>
            <form onSubmit={handleSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter voting session title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter description (optional)"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetSessionForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSession ? 'Update Session' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Voting Photo</h2>
            <form onSubmit={handlePhotoSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo Title *
                </label>
                <input
                  type="text"
                  value={photoForm.title}
                  onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter photo title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Photo *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {photoForm.photo_url ? (
                    <div className="space-y-2">
                      <img
                        src={photoForm.photo_url}
                        alt="Preview"
                        className="max-w-full h-32 object-contain mx-auto rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotoForm({ ...photoForm, photo_url: '' })}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Choose Different Photo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">Click to upload photo</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Select Photo
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetPhotoForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!photoForm.photo_url}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Add Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}