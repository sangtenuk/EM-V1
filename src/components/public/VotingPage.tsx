import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Vote, CheckCircle, Users, BarChart3 } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface VotingSession {
  id: string
  title: string
  description: string | null
  is_active: boolean
  event: {
    id: string
    name: string
    company: {
      name: string
    }
  }
}

interface VotingPhoto {
  id: string
  title: string
  photo_url: string
  vote_count: number
  vote_percentage: number
  user_voted: boolean
}

interface Attendee {
  id: string
  name: string
  identification_number: string
  event_id: string
}

export default function VotingPage() {
  const { sessionId } = useParams()
  const [session, setSession] = useState<VotingSession | null>(null)
  const [photos, setPhotos] = useState<VotingPhoto[]>([])
  const [attendee, setAttendee] = useState<Attendee | null>(null)
  const [totalVotes, setTotalVotes] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [identificationNumber, setIdentificationNumber] = useState('')
  const [showLogin, setShowLogin] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (sessionId) {
      fetchSession()
    }
  }, [sessionId])

  // Timer functionality for VotingPage
  useEffect(() => {
    if (session && session.is_active) {
      // Fetch session details to get timer information
      const checkTimer = async () => {
        try {
          const { data: sessionData, error } = await supabase
            .from('voting_sessions')
            .select('timer_duration, timer_start')
            .eq('id', sessionId)
            .single()

          if (error || !sessionData) return

          if (sessionData.timer_duration && sessionData.timer_start) {
            const startTime = new Date(sessionData.timer_start).getTime()
            const durationMs = sessionData.timer_duration * 60 * 1000
            const endTime = startTime + durationMs
            const now = Date.now()
            
            if (now < endTime) {
              const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
              setTimeRemaining(remaining)
              
              const timerInterval = setInterval(() => {
                const currentTime = Date.now()
                if (currentTime < endTime) {
                  const remaining = Math.max(0, Math.floor((endTime - currentTime) / 1000))
                  setTimeRemaining(remaining)
                } else {
                  setTimeRemaining(0)
                  // End voting when timer finishes
                  endVotingSession()
                  clearInterval(timerInterval)
                }
              }, 1000)
              
              return () => clearInterval(timerInterval)
            } else {
              setTimeRemaining(0)
              endVotingSession()
            }
          }
        } catch (error) {
          console.error('Error checking timer:', error)
        }
      }

      checkTimer()
    }
  }, [session, sessionId])

  const endVotingSession = async () => {
    try {
      // Deactivate the voting session
      const { error } = await supabase
        .from('voting_sessions')
        .update({ 
          is_active: false,
          timer_start: null
        })
        .eq('id', sessionId)

      if (error) {
        console.error('Error ending voting session:', error)
        return
      }

      console.log('Voting session ended successfully')
      toast.success('Voting session has ended')
      
      // Refresh session data
      fetchSession()
    } catch (error: any) {
      console.error('Error ending voting session:', error)
    }
  }

  useEffect(() => {
    if (sessionId && attendee) {
      fetchPhotosWithVotes()
      checkIfUserVoted()

      const subscription = supabase
        .channel('votes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'votes'
          },
          () => {
            fetchPhotosWithVotes()
            checkIfUserVoted()
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [sessionId, attendee])

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          title,
          description,
          is_active,
          event:events(
            id,
            name,
            company:companies(name)
          )
        `)
        .eq('id', sessionId)
        .eq('is_active', true)
        .single()

      if (error || !data) throw error

      // Handle different data structures
      let eventData: any = data.event
      if (Array.isArray(eventData)) {
        eventData = eventData[0]
      }

      if (!eventData) {
        throw new Error('Event data not found')
      }

      const cleanedSession: VotingSession = {
        id: data.id,
        title: data.title,
        description: data.description,
        is_active: data.is_active,
        event: {
          id: eventData.id,
          name: eventData.name,
          company: Array.isArray(eventData.company)
            ? eventData.company[0]
            : eventData.company
        }
      }

      setSession(cleanedSession)
    } catch (error: any) {
      console.error('Error fetching session:', error)
      toast.error('Voting session not found or not active')
    } finally {
      setLoading(false)
    }
  }


  const fetchPhotosWithVotes = async () => {
    try {
      const { data: photosData, error } = await supabase
        .from('voting_photos')
        .select('*')
        .eq('voting_session_id', sessionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const photosWithVotes = await Promise.all(
        photosData.map(async (photo) => {
          const { data: votes } = await supabase
            .from('votes')
            .select('id, attendee_id')
            .eq('voting_photo_id', photo.id)

          const userVoted = attendee ? votes?.some(vote => vote.attendee_id === attendee.id) || false : false

          return {
            ...photo,
            vote_count: votes?.length || 0,
            user_voted: userVoted
          }
        })
      )

      const total = photosWithVotes.reduce((sum, photo) => sum + photo.vote_count, 0)
      setTotalVotes(total)

      const photosWithPercentages = photosWithVotes.map(photo => ({
        ...photo,
        vote_percentage: total > 0 ? (photo.vote_count / total) * 100 : 0
      }))

      setPhotos(photosWithPercentages)
    } catch (error: any) {
      console.error('Error fetching photos:', error)
    }
  }

  const checkIfUserVoted = async () => {
    if (!attendee || photos.length === 0) return

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('id')
        .eq('attendee_id', attendee.id)
        .in('voting_photo_id', photos.map(p => p.id))

      if (error) throw error
      setHasVoted((data?.length || 0) > 0)
    } catch (error: any) {
      console.error('Error checking vote status:', error)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identificationNumber.trim()) return

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('attendees')
        .select('id, name, identification_number, event_id')
        .eq('identification_number', identificationNumber.trim())
        .single()

      if (error || !data) {
        toast.error('Attendee not found. Please check your identification number.')
        return
      }

      if (session && data.event_id !== session.event.id) {
        toast.error('You are not registered for this event.')
        return
      }

      setAttendee(data)
      setShowLogin(false)
      toast.success(`Welcome, ${data.name}!`)
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error('Error logging in: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (photoId: string) => {
    if (!attendee || voting) return

    // Check if session is still active
    if (!session || !session.is_active) {
      toast.error('Voting has ended for this session')
      return
    }

    try {
      setVoting(true)

      const { data: existingVotes } = await supabase
        .from('votes')
        .select('id')
        .eq('attendee_id', attendee.id)
        .in('voting_photo_id', photos.map(p => p.id))

      if (existingVotes && existingVotes.length > 0) {
        toast.error('You have already voted in this session')
        setHasVoted(true)
        return
      }

      const { error } = await supabase
        .from('votes')
        .insert([{
          voting_photo_id: photoId,
          attendee_id: attendee.id
        }])

      if (error) throw error

      toast.success('Vote cast successfully!')
      setHasVoted(true)
      fetchPhotosWithVotes()
    } catch (error: any) {
      toast.error('Error casting vote: ' + error.message)
    } finally {
      setVoting(false)
    }
  }

  // Remaining JSX rendering code remains the same...

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Voting Session Not Found</h1>
          <p className="text-gray-600">The voting session may have ended or doesn't exist.</p>
        </div>
      </div>
    )
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            <div className="text-center mb-8">
              <Vote className="h-16 w-16 text-purple-600 mx-auto mb-4" />
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Join Voting</h1>
              <h2 className="text-lg md:text-xl text-purple-600 mb-2">{session.title}</h2>
              <p className="text-gray-600">{session.event.name}</p>
              <p className="text-sm text-gray-500">{session.event?.company?.name ?? 'No Company'}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Identification Number
                </label>
                <input
                  type="text"
                  value={identificationNumber}
                  onChange={(e) => setIdentificationNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your identification number"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Join Voting'}
              </button>
            </form>

            {session.description && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-700">{session.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{session.title}</h1>
            <p className="text-base md:text-lg text-purple-600 mb-2">{session.event.name}</p>
            <p className="text-gray-600">{session.event?.company?.name ?? 'No Company'}</p>
            {session.description && (
              <p className="text-gray-600 mt-2">{session.description}</p>
            )}
            <div className="mt-4 flex flex-col md:flex-row items-center justify-center space-y-2 md:space-y-0 md:space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                <span>Welcome, {attendee?.name}</span>
              </div>
              <div className="flex items-center">
                <BarChart3 className="h-4 w-4 mr-1" />
                <span>{totalVotes} total votes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Voting Status */}
        {hasVoted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">Thank you for voting! Your vote has been recorded.</span>
            </div>
          </div>
        )}

        {/* Session Ended Status */}
        {session && !session.is_active && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800 font-medium">Voting has ended for this session</span>
            </div>
          </div>
        )}





        {/* Photos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {photos.map((photo) => (
            <div 
              key={photo.id} 
              className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
                hasVoted && photo.user_voted 
                  ? 'ring-4 ring-green-500 ring-opacity-75 shadow-xl scale-105' 
                  : hasVoted 
                    ? 'opacity-60' 
                    : ''
              }`}
            >
              <img
                src={getStorageUrl(photo.photo_url)}
                alt={photo.title}
                className="w-full h-48 md:h-64 object-cover"
              />
              <div className="p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">{photo.title}</h3>
                
                {!hasVoted ? (
                  <button
                    onClick={() => handleVote(photo.id)}
                    disabled={voting || !session?.is_active}
                    className="w-full bg-purple-600 text-white py-2 md:py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center text-sm md:text-base"
                  >
                    <Vote className="h-5 w-5 mr-2" />
                    {voting ? 'Voting...' : !session?.is_active ? 'Voting Ended' : 'Vote for This'}
                  </button>
                ) : (
                  <div className="text-center py-2 md:py-3">
                    {photo.user_voted ? (
                      <div className="flex items-center justify-center text-green-600">
                        <CheckCircle className="h-6 w-6 mr-2" />
                        <span className="font-semibold">You voted for this</span>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <span className="text-sm">Vote recorded</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {photos.length === 0 && (
          <div className="text-center py-12">
            <Vote className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Photos Available</h3>
            <p className="text-gray-600">No photos have been added to this voting session yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
