import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface VotingSession {
  id: string
  title: string
  description: string | null
  event: {
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
}

export default function VotingMonitor() {
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [photos, setPhotos] = useState<VotingPhoto[]>([])
  const [totalVotes, setTotalVotes] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  useEffect(() => {
    fetchActiveSessions()
  }, [])

  useEffect(() => {
    if (selectedSessionId) {
      fetchPhotosWithVotes()
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
  }, [selectedSessionId])

  useEffect(() => {
    if (photos.length > 0) {
      const interval = setInterval(() => {
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [photos.length])

  const fetchActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          title,
          description,
          event:events(
            name,
            company:companies(name)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      const normalized = data.map((session: any) => ({
        ...session,
        event: {
          ...session.event,
          company: Array.isArray(session.event.company)
            ? session.event.company[0] ?? { name: '' }
            : session.event.company
        }
      }))

      if (normalized.length > 0) {
        setSelectedSessionId(normalized[0].id)
      }
    } catch (error: any) {
      console.error('Error fetching voting sessions:', error)
    }
  }

  const fetchPhotosWithVotes = async () => {
    try {
      const { data: photosData, error } = await supabase
        .from('voting_photos')
        .select('*')
        .eq('voting_session_id', selectedSessionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const photosWithVotes = await Promise.all(
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

      const total = photosWithVotes.reduce((sum, photo) => sum + photo.vote_count, 0)
      setTotalVotes(total)

      const photosWithPercentages = photosWithVotes.map(photo => ({
        ...photo,
        vote_percentage: total > 0 ? (photo.vote_count / total) * 100 : 0
      }))

      photosWithPercentages.sort((a, b) => b.vote_count - a.vote_count)
      setPhotos(photosWithPercentages)
    } catch (error: any) {
      console.error('Error fetching photos with votes:', error)
    }
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  return <></> // Replace with real display
}
