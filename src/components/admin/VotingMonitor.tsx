import { useState, useEffect } from 'react'
/* import { Monitor, Vote, Trophy, Users, BarChart3 } from 'lucide-react' */
 import { Monitor, Vote, Trophy, BarChart3 } from 'lucide-react' 
import { supabase, getStorageUrl } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

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
}

interface VotingMonitorProps {
  userCompany?: any
}

export default function VotingMonitor({ userCompany }: VotingMonitorProps) {
  const [votingSessions, setVotingSessions] = useState<VotingSession[]>([])
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
      
      // Set up real-time subscription for vote updates
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
      let query = supabase
        .from('voting_sessions')
        .select(`
          id,
          title,
          description,
          event:events(
            id,
            name,
            company_id,
            company:companies(name)
          )
        `)
        .eq('is_active', true)

      // Filter by company if user is a company user
      if (userCompany) {
        const { data: companyEvents } = await supabase
          .from('events')
          .select('id')
          .eq('company_id', userCompany.company_id)
        
        const eventIds = companyEvents?.map(e => e.id) || []
        if (eventIds.length > 0) {
          query = query.in('event_id', eventIds)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Transform data to ensure proper structure
      const transformedData = data?.map(session => ({
        ...session,
        event: {
          id: session.event[0]?.id,
          name: session.event[0]?.name,
          company: Array.isArray(session.event[0]?.company) 
            ? session.event[0].company[0] 
            : session.event[0]?.company
        }
      })) || []

      setVotingSessions(transformedData)
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

      // Fetch vote counts for each photo
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

      // Calculate percentages
      const photosWithPercentages = photosWithVotes.map(photo => ({
        ...photo,
        vote_percentage: total > 0 ? (photo.vote_count / total) * 100 : 0
      }))

      // Sort by vote count (highest first)
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

  const MonitorDisplay = () => (
    <div className="h-full bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full opacity-20"
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="text-center py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <h1 className="text-4xl md:text-6xl font-bold">Live Voting Results</h1>
            {selectedSessionId && (
              <div className="text-xl md:text-2xl opacity-80">
                {votingSessions.find(s => s.id === selectedSessionId)?.title}
              </div>
            )}
            <div className="text-lg md:text-xl opacity-60">
              Total Votes: {totalVotes}
            </div>
          </motion.div>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 pb-8">
          {photos.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              {/* Current Photo Display */}
              <div className="flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPhotoIndex}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 bg-white bg-opacity-10 rounded-lg p-6 flex flex-col"
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <img
                        src={getStorageUrl(photos[currentPhotoIndex]?.photo_url)}
                        alt={photos[currentPhotoIndex]?.title}
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <h3 className="text-2xl font-bold mb-2">
                        {photos[currentPhotoIndex]?.title}
                      </h3>
                      <div className="text-4xl font-bold text-yellow-300">
                        {photos[currentPhotoIndex]?.vote_count} votes
                      </div>
                      <div className="text-xl opacity-80">
                        {photos[currentPhotoIndex]?.vote_percentage.toFixed(1)}%
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Leaderboard */}
              <div className="bg-white bg-opacity-10 rounded-lg p-6">
                <h2 className="text-3xl font-bold mb-6 text-center flex items-center justify-center">
                  <Trophy className="h-8 w-8 mr-3 text-yellow-300" />
                  Leaderboard
                </h2>
                <div className="space-y-4">
                  {photos.slice(0, 5).map((photo, index) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center space-x-4 bg-white bg-opacity-10 rounded-lg p-4"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <img
                        src={getStorageUrl(photo.photo_url)}
                        alt={photo.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{photo.title}</div>
                        <div className="flex items-center space-x-4">
                          <span className="text-2xl font-bold">{photo.vote_count}</span>
                          <div className="flex-1 bg-white bg-opacity-20 rounded-full h-3">
                            <motion.div
                              className="bg-yellow-400 h-3 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${photo.vote_percentage}%` }}
                              transition={{ duration: 1, delay: index * 0.1 }}
                            />
                          </div>
                          <span className="text-lg font-semibold">
                            {photo.vote_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <Vote className="h-32 w-32 mx-auto mb-8 opacity-50" />
                <h2 className="text-4xl font-bold mb-4">Waiting for Votes</h2>
                <p className="text-xl opacity-80">No votes cast yet</p>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50">
        <MonitorDisplay />
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-colors"
        >
          Exit Fullscreen
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voting Monitor</h1>
          <p className="text-gray-600 mt-2">Display live voting results</p>
        </div>
        <button
          onClick={toggleFullscreen}
          disabled={!selectedSessionId}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Monitor className="h-5 w-5 mr-2" />
          Fullscreen Monitor
        </button>
      </div>

      {/* Session Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Active Voting Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select an active voting session</option>
              {votingSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} - {session.event.name}
                </option>
              ))}
            </select>
          </div>
          
          {selectedSessionId && (
            <div className="flex items-end">
              <div className="bg-purple-50 rounded-lg p-4 w-full">
                <div className="text-sm text-purple-600 font-medium">Live Stats</div>
                <div className="text-2xl font-bold text-purple-900">{totalVotes}</div>
                <div className="text-sm text-purple-600">Total Votes Cast</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <BarChart3 className="h-6 w-6 mr-2" />
          Monitor Preview
        </h2>
        
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
          {selectedSessionId ? (
            <MonitorDisplay />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Vote className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select an active voting session to see preview</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>• This preview shows how the voting monitor will appear</p>
          <p>• Click "Fullscreen Monitor" to display on external screen</p>
          <p>• Results update automatically in real-time</p>
          <p>• Photos rotate every 5 seconds in fullscreen mode</p>
        </div>
      </div>
    </div>
  )
}