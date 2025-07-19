import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Vote, CheckCircle, Users, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface VotingSession {
  id: string
  title: string
  description: string | null
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
  const [showResults, setShowResults] = useState(false)
  const [identificationNumber, setIdentificationNumber] = useState('')
  const [showLogin, setShowLogin] = useState(true)

  useEffect(() => {
    if (sessionId) {
      fetchSession()
    }
  }, [sessionId])

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

      // transform event.company array to single object
      const cleanedSession: VotingSession = {
        ...data,
        event: {
          ...data.event,
          company: Array.isArray(data.event.company)
            ? data.event.company[0]
            : data.event.company
        }
      }

      setSession(cleanedSession)
    } catch (error: any) {
      toast.error('Voting session not found or not active')
    } finally {
      setLoading(false)
    }
  }

  const fetchPhotosWithVotes = async () => {
    if (!attendee) return

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

          const userVoted = votes?.some(vote => vote.attendee_id === attendee.id) || false

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
      toast.error('Error logging in: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (photoId: string) => {
    if (!attendee || voting) return

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
      setShowResults(true)
      fetchPhotosWithVotes()
    } catch (error: any) {
      toast.error('Error casting vote: ' + error.message)
    } finally {
      setVoting(false)
    }
  }

  // Remaining JSX rendering code remains the same...

