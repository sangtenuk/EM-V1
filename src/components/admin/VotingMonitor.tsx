import { useState, useEffect } from 'react'
import { Monitor, Vote, BarChart3, QrCode, RefreshCw, Trophy, RotateCcw } from 'lucide-react' 
import { supabase, getStorageUrl } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import QRCodeLib from 'qrcode'
import toast from 'react-hot-toast'

interface VotingSession {
  id: string
  title: string
  description: string | null
  timer_duration?: number | null
  timer_start?: string | null
  event: {
    id: string
    name: string
    custom_background?: string | null
    custom_logo?: string | null
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
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [votingQR, setVotingQR] = useState('')
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [winner, setWinner] = useState<VotingPhoto | null>(null)
  const [isTie, setIsTie] = useState(false)
  const [tiedPhotos, setTiedPhotos] = useState<VotingPhoto[]>([])
  const [redrawCount, setRedrawCount] = useState(0)

  useEffect(() => {
    fetchActiveSessions()
  }, [])

  useEffect(() => {
    if (selectedSessionId) {
      fetchPhotosWithVotes()
      
      // Set up real-time subscription for vote updates - only when not showing results
      if (!showResults) {
        const subscription = supabase
          .channel(`voting-${selectedSessionId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'votes'
            },
            (payload) => {
              console.log('Vote change detected:', payload)
              // Force immediate update with smooth transition
              setTimeout(() => {
                updateStatistics(false)
              }, 100)
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'voting_photos'
            },
            (payload) => {
              console.log('Photo change detected:', payload)
              // Force immediate update with smooth transition
              setTimeout(() => {
                updateStatistics(false)
              }, 100)
            }
          )
          .subscribe()

        return () => {
          subscription.unsubscribe()
        }
      }
    }
  }, [selectedSessionId, showResults])

  // Separate useEffect for QR code generation to prevent reloading
  useEffect(() => {
    if (selectedSessionId) {
      generateVotingQR()
    }
  }, [selectedSessionId])

  useEffect(() => {
    if (photos.length > 0) {
      const interval = setInterval(() => {
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
      }, 5000) // 5 seconds
      return () => clearInterval(interval)
    }
  }, [photos.length])

  // Timer functionality - Only for display, not for ending sessions
  useEffect(() => {
    if (selectedSessionId) {
      const session = votingSessions.find(s => s.id === selectedSessionId)
      if (session?.timer_duration && session?.timer_start) {
        const startTime = new Date(session.timer_start).getTime()
        const durationMs = session.timer_duration * 60 * 1000 // Convert minutes to milliseconds
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
              // Show results when timer finishes (but don't deactivate session)
              setShowResults(true)
              // Detect winner and ties
              detectWinnerAndTies()
              clearInterval(timerInterval)
            }
          }, 1000)
          
          return () => clearInterval(timerInterval)
        } else {
          setTimeRemaining(0)
          // Show results when timer finishes (but don't deactivate session)
          setShowResults(true)
          // Detect winner and ties
          detectWinnerAndTies()
        }
      } else {
        setTimeRemaining(null)
        setShowResults(false)
      }
    }
  }, [selectedSessionId, votingSessions])

  // Handle results display - freeze after showing
  useEffect(() => {
    if (showResults) {
      // Results are now frozen - no auto-hide
      // The results will stay displayed until manually reset
    }
  }, [showResults])

  // Fetch total participants when photos change
  useEffect(() => {
    if (photos.length > 0) {
      fetchTotalParticipants()
    } else {
      setTotalParticipants(0)
    }
  }, [photos])

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Periodic refresh as fallback (every 5 seconds) - only when not showing results
  useEffect(() => {
    if (selectedSessionId && !showResults) {
      const interval = setInterval(() => {
        console.log('Periodic refresh triggered')
        updateStatistics(false)
      }, 5000) // 5 seconds

      return () => clearInterval(interval)
    }
  }, [selectedSessionId, showResults])

  const fetchActiveSessions = async () => {
    try {
      let query = supabase
        .from('voting_sessions')
        .select(`
          id,
          title,
          description,
          timer_duration,
          timer_start,
          event_id,
          events!inner(
            id,
            name,
            company_id,
            custom_background,
            custom_logo,
            companies!inner(name)
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
      const transformedData = data?.map(session => {
        console.log('Raw session data:', session)
        console.log('Session events:', session.events)
        
        // Handle different possible data structures
        let eventData: any = session.events
        if (Array.isArray(eventData)) {
          eventData = eventData[0]
        }
        
        console.log('Processed event data:', eventData)
        
        return {
          ...session,
          event: {
            id: eventData?.id,
            name: eventData?.name,
            custom_background: eventData?.custom_background,
            custom_logo: eventData?.custom_logo,
            company: Array.isArray(eventData?.companies) 
              ? eventData.companies[0] 
              : eventData?.companies
          }
        }
      }) || []

      setVotingSessions(transformedData)
    } catch (error: any) {
      console.error('Error fetching voting sessions:', error)
    }
  }

  const fetchTotalParticipants = async () => {
    try {
      // Only fetch if we have photos
      if (photos.length === 0) {
        setTotalParticipants(0)
        return
      }

      const { data, error } = await supabase
        .from('votes')
        .select('attendee_id')
        .in('voting_photo_id', photos.map(p => p.id))

      if (error) throw error
      
      // Count unique attendees
      const uniqueAttendees = new Set(data?.map(vote => vote.attendee_id) || [])
      setTotalParticipants(uniqueAttendees.size)
    } catch (error: any) {
      console.error('Error fetching total participants:', error)
      setTotalParticipants(0)
    }
  }

  const updateStatistics = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true)
      }
      
      console.log('Updating statistics for session:', selectedSessionId)
      
      // Fetch fresh data from database
      const { data: photosData, error } = await supabase
        .from('voting_photos')
        .select('*')
        .eq('voting_session_id', selectedSessionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // If no photos, set empty array and return
      if (!photosData || photosData.length === 0) {
        console.log('No photos found, clearing data')
        setPhotos([])
        setTotalVotes(0)
        setTotalParticipants(0)
        return
      }

      console.log('Found photos:', photosData.length)

      // Fetch vote counts for each photo
      const photosWithVotes = await Promise.all(
        photosData.map(async (photo) => {
          const { data: votes, error: voteError } = await supabase
            .from('votes')
            .select('id')
            .eq('voting_photo_id', photo.id)

          if (voteError) {
            console.error('Error fetching votes for photo:', photo.id, voteError)
          }

          const voteCount = votes?.length || 0
          console.log(`Photo ${photo.title}: ${voteCount} votes`)

          return {
            ...photo,
            vote_count: voteCount
          }
        })
      )

      const total = photosWithVotes.reduce((sum, photo) => sum + photo.vote_count, 0)
      console.log('Total votes:', total)

      // Calculate percentages
      const photosWithPercentages = photosWithVotes.map(photo => ({
        ...photo,
        vote_percentage: total > 0 ? (photo.vote_count / total) * 100 : 0
      }))

      // Sort by vote count (highest first)
      photosWithPercentages.sort((a, b) => b.vote_count - a.vote_count)
      
      console.log('Updated photos with percentages:', photosWithPercentages)
      
      // Smooth state updates with staggered timing
      setTotalVotes(prev => {
        if (prev !== total) {
          console.log(`Votes updated: ${prev} → ${total}`)
        }
        return total
      })
      
      setPhotos(prevPhotos => {
        // Only update if there are actual changes
        const hasChanges = JSON.stringify(prevPhotos) !== JSON.stringify(photosWithPercentages)
        if (hasChanges) {
          console.log('Photos updated with smooth transition')
        }
        return photosWithPercentages
      })
      
      // Update participant count
      await fetchTotalParticipants()
      
      // Update last update timestamp
      setLastUpdate(new Date())
      
      console.log('Statistics updated successfully')
    } catch (error: any) {
      console.error('Error updating statistics:', error)
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false)
      }
    }
  }

  const fetchPhotosWithVotes = async () => {
    if (!selectedSessionId) return;
    try {
      const { data: photosData, error } = await supabase
        .from('voting_photos')
        .select('*')
        .eq('voting_session_id', selectedSessionId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // If no photos, set empty array and return
      if (!photosData || photosData.length === 0) {
        console.log('No photos found, clearing data')
        setPhotos([])
        setTotalVotes(0)
        setTotalParticipants(0)
        return
      }

      console.log('Found photos:', photosData.length)

      // Fetch vote counts for each photo
      const photosWithVotes = await Promise.all(
        photosData.map(async (photo) => {
          const { data: votes, error: voteError } = await supabase
            .from('votes')
            .select('id')
            .eq('voting_photo_id', photo.id)

          if (voteError) {
            console.error('Error fetching votes for photo:', photo.id, voteError)
          }

          const voteCount = votes?.length || 0
          console.log(`Photo ${photo.title}: ${voteCount} votes`)

          return {
            ...photo,
            vote_count: voteCount
          }
        })
      )

      const total = photosWithVotes.reduce((sum, photo) => sum + photo.vote_count, 0)
      console.log('Total votes:', total)

      // Calculate percentages
      const photosWithPercentages = photosWithVotes.map(photo => ({
        ...photo,
        vote_percentage: total > 0 ? (photo.vote_count / total) * 100 : 0
      }))

      // Sort by vote count (highest first)
      photosWithPercentages.sort((a, b) => b.vote_count - a.vote_count)
      
      console.log('Updated photos with percentages:', photosWithPercentages)
      
      // Smooth state updates with staggered timing
      setTotalVotes(prev => {
        if (prev !== total) {
          console.log(`Votes updated: ${prev} → ${total}`)
        }
        return total
      })
      
      setPhotos(prevPhotos => {
        // Only update if there are actual changes
        const hasChanges = JSON.stringify(prevPhotos) !== JSON.stringify(photosWithPercentages)
        if (hasChanges) {
          console.log('Photos updated with smooth transition')
        }
        return photosWithPercentages
      })
      
      // Update participant count
      await fetchTotalParticipants()
      
      // Update last update timestamp
      setLastUpdate(new Date())
      
      console.log('Statistics updated successfully')
    } catch (error: any) {
      console.error('Error updating statistics:', error)
    }
  }

  const generateVotingQR = async () => {
    try {
      const votingUrl = `${window.location.origin}/public/voting/${selectedSessionId}`
      const qrDataUrl = await QRCodeLib.toDataURL(votingUrl, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      setVotingQR(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
      setVotingQR('')
    }
  }

  const detectWinnerAndTies = () => {
    if (photos.length === 0) return

    const maxVotes = photos[0]?.vote_count || 0
    const winners = photos.filter(photo => photo.vote_count === maxVotes)
    
          if (winners.length > 1) {
        // Tie detected
        setIsTie(true)
        setTiedPhotos(winners)
        setWinner(null)
        toast.success(`🏆 TIE DETECTED! ${winners.length} photos with ${maxVotes} votes each!`)
      } else {
        // Clear winner
        setIsTie(false)
        setTiedPhotos([])
        setWinner(winners[0] || null)
      }
  }

  const handleRedraw = async () => {
    try {
      if (tiedPhotos.length <= 1) {
        toast.error('No tie detected for redraw')
        return
      }

      // Randomly select a winner from tied photos
      const randomIndex = Math.floor(Math.random() * tiedPhotos.length)
      const newWinner = tiedPhotos[randomIndex]
      
      // Update winner state
      setWinner(newWinner)
      setIsTie(false)
      setRedrawCount(prev => prev + 1)
      
      // Show the new winner
      toast.success(`🎲 Redraw complete! New winner: ${newWinner.title} with ${newWinner.vote_count} votes!`)
      
      // Save the redraw result to database
      await saveVotingResult(newWinner)
      
    } catch (error: any) {
      console.error('Error during redraw:', error)
      toast.error('Error during redraw')
    }
  }

  const saveVotingResult = async (winningPhoto: VotingPhoto) => {
    try {
      const { error } = await supabase
        .from('voting_results')
        .upsert([{
          voting_session_id: selectedSessionId,
          winning_photo_id: winningPhoto.id,
          winning_photo_title: winningPhoto.title,
          winning_vote_count: winningPhoto.vote_count,
          total_votes: totalVotes,
          total_participants: totalParticipants,
          is_redraw: redrawCount > 0,
          redraw_count: redrawCount,
          created_at: new Date().toISOString()
        }], {
          onConflict: 'voting_session_id'
        })

      if (error) {
        console.error('Error saving voting result:', error)
        toast.error('Error saving result to database')
      } else {
        console.log('Voting result saved successfully')
      }
    } catch (error: any) {
      console.error('Error saving voting result:', error)
    }
  }





  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen()
        } else if ((document.documentElement as any).mozRequestFullScreen) {
          await (document.documentElement as any).mozRequestFullScreen()
        }
        setIsFullscreen(true)
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen()
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen()
        }
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
      // Fallback for browsers that don't support fullscreen
      setIsFullscreen(!isFullscreen)
    }
  }

  const MonitorDisplay = () => {
    const session = votingSessions.find(s => s.id === selectedSessionId)
    
    // Debug logging
    console.log('Session:', session)
    console.log('Event:', session?.event)
    console.log('Custom background:', session?.event?.custom_background)
    console.log('Custom logo:', session?.event?.custom_logo)
    
    // Get background from Supabase storage or use clean background
    const backgroundStyle = session?.event?.custom_background
      ? { 
          backgroundImage: session.event.custom_background.startsWith('blob:') 
            ? `url(${session.event.custom_background})` 
            : `url(${getStorageUrl(session.event.custom_background)})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }
      : { 
          backgroundColor: '#f8fafc', // Clean light gray background
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
        }

    return (
      <div className="h-full text-gray-900 relative overflow-hidden" style={backgroundStyle}>
        {/* Dark overlay for custom backgrounds */}
        {session?.event?.custom_background && (
          <div className="absolute inset-0 bg-black bg-opacity-70"></div>
        )}
        
        {/* Content container with relative positioning */}
        <div className="relative z-10 h-full">
          {/* Header: Show different content based on timer status */}
          {timeRemaining === 0 && showResults ? (
            /* When timer finishes and results are showing - Show only voting title */
            <div className="flex justify-center items-center py-10">
              <div className="bg-white bg-opacity-95 rounded-2xl px-10 py-8 shadow-2xl border border-gray-200 flex flex-col items-center min-w-[320px] max-w-[420px]">
                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 text-gray-900 tracking-tight text-center">{votingSessions.find(s => s.id === selectedSessionId)?.title || 'Voting Title'}</h1>
              </div>
            </div>
          ) : (
            /* During voting - Show event details and QR code */
            <div className="flex justify-center items-center gap-12 py-10">
              {/* Event Detail Card - STATIC */}
              <div className="bg-white bg-opacity-95 rounded-2xl px-10 py-8 shadow-2xl border border-gray-200 flex flex-col items-center min-w-[320px] max-w-[420px]">
                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 text-gray-900 tracking-tight text-center">{session?.event?.name || 'Event Name'}</h1>
                <div className="text-lg md:text-2xl font-bold text-purple-600 mb-2 text-center">{votingSessions.find(s => s.id === selectedSessionId)?.title || 'Voting Title'}</div>
                {session?.event?.company?.name && (
                  <div className="text-base md:text-lg font-semibold text-gray-700 text-center opacity-80 mb-2">{session.event?.company?.name ?? 'No Company'}</div>
                )}
                {session?.event?.custom_logo && (
                  <img src={getStorageUrl(session.event.custom_logo)} alt="Event Logo" className="h-16 mt-2 object-contain mx-auto" />
                )}
              </div>
              {/* QR Code Card - STATIC */}
              {votingQR && (
                <div className="bg-white bg-opacity-95 rounded-2xl px-10 py-8 shadow-2xl border border-gray-200 flex flex-col items-center min-w-[240px] max-w-[320px]">
                  <div className="mb-3 text-center">
                    <span className="text-gray-900 font-bold text-lg tracking-wide">Scan to Vote</span>
                  </div>
                  <img 
                    src={votingQR} 
                    alt="Voting QR Code" 
                    className="w-40 h-40 mx-auto border-2 border-gray-300 rounded-xl shadow-lg bg-white"
                  />
                  <p className="text-gray-700 text-base mt-4 opacity-80 text-center font-medium">Scan with your phone</p>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Content - Only show when timer is running */}
          {timeRemaining !== 0 && !showResults && (
            <div className="mt-6">
              {/* Stats Row - Only animate the numbers */}
              <div className="flex justify-center space-x-12 text-lg md:text-xl">
                <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                  <span className="font-semibold text-gray-900">Votes: </span>
                  <motion.span 
                    key={`votes-${totalVotes}`}
                    initial={{ scale: 1.2, color: "#8b5cf6" }}
                    animate={{ scale: 1, color: "#111827" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="font-bold text-purple-600"
                  >
                    {totalVotes}
                  </motion.span>
                </div>
                <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
                  <Vote className="h-6 w-6 text-purple-600" />
                  <span className="font-semibold text-gray-900">Participants: </span>
                  <motion.span 
                    key={`participants-${totalParticipants}`}
                    initial={{ scale: 1.2, color: "#8b5cf6" }}
                    animate={{ scale: 1, color: "#111827" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="font-bold text-purple-600"
                  >
                    {totalParticipants}
                  </motion.span>
                </div>
                {timeRemaining !== null && (
                  <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
                    <motion.span 
                      key={`timer-${timeRemaining}`}
                      initial={{ scale: 1.2, color: "#8b5cf6" }}
                      animate={{ scale: 1, color: "#111827" }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="font-bold text-purple-600"
                    >
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </motion.span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos and Votes Display - Only animate percentages and vote counts */}
          {photos.length > 0 && (
            <div className="mt-8 px-6">
              <div className="max-w-4xl mx-auto">
                {/* Trophy Podium Display when timer finishes and results are showing */}
                {timeRemaining === 0 && showResults && photos.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="mb-8"
                  >
                    <h2 className="text-5xl font-bold text-center text-gray-900 mb-12">🏆 FINAL RESULTS 🏆</h2>
                    
                    {/* Trophy Podium for Winner - Only when there's a clear winner (no tie) */}
                    {winner && !isTie && (
                      <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                        className="flex justify-center items-end space-x-8 h-96 mb-8"
                      >
                        {/* 2nd Place */}
                        {photos.length >= 2 && (
                          <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, delay: 1.2, ease: "easeOut" }}
                            className="flex flex-col items-center"
                          >
                            <div className="bg-gray-300 rounded-t-lg w-48 h-48 flex items-center justify-center shadow-xl">
                              <div className="text-center">
                                <div className="text-6xl mb-4">🥈</div>
                                <div className="text-2xl font-bold text-gray-700">2nd PLACE</div>
                              </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 mt-4 shadow-xl border border-gray-200 w-48">
                              <img
                                src={getStorageUrl(photos[1]?.photo_url)}
                                alt={photos[1]?.title}
                                className="w-full h-32 object-cover rounded-lg mb-4"
                              />
                              <div className="text-lg font-bold text-gray-900 truncate mb-2">{photos[1]?.title}</div>
                              <div className="text-xl text-purple-600 font-bold">{photos[1]?.vote_count} votes</div>
                            </div>
                          </motion.div>
                        )}

                        {/* 1st Place - Winner */}
                        <motion.div
                          initial={{ opacity: 0, y: 100 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 1, delay: 1.8, ease: "easeOut" }}
                          className="flex flex-col items-center"
                        >
                          <div className="bg-yellow-400 rounded-t-lg w-64 h-64 flex items-center justify-center shadow-xl">
                            <div className="text-center">
                              <div className="text-8xl mb-4">🏆</div>
                              <div className="text-3xl font-bold text-gray-700">WINNER</div>
                            </div>
                          </div>
                          <div className="bg-white rounded-xl p-6 mt-4 shadow-xl border border-gray-200 w-64">
                            <img
                              src={getStorageUrl(winner.photo_url)}
                              alt={winner.title}
                              className="w-full h-48 object-cover rounded-lg mb-4"
                            />
                            <div className="text-xl font-bold text-gray-900 truncate mb-2">{winner.title}</div>
                            <div className="text-2xl text-purple-600 font-bold">{winner.vote_count} votes</div>
                          </div>
                        </motion.div>

                        {/* 3rd Place */}
                        {photos.length >= 3 && (
                          <motion.div
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                            className="flex flex-col items-center"
                          >
                            <div className="bg-amber-600 rounded-t-lg w-48 h-32 flex items-center justify-center shadow-xl">
                              <div className="text-center">
                                <div className="text-5xl mb-2">🥉</div>
                                <div className="text-xl font-bold text-gray-700">3rd PLACE</div>
                              </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 mt-4 shadow-xl border border-gray-200 w-48">
                              <img
                                src={getStorageUrl(photos[2]?.photo_url)}
                                alt={photos[2]?.title}
                                className="w-full h-32 object-cover rounded-lg mb-4"
                              />
                              <div className="text-lg font-bold text-gray-900 truncate mb-2">{photos[2]?.title}</div>
                              <div className="text-xl text-purple-600 font-bold">{photos[2]?.vote_count} votes</div>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}

                    {/* Tie Detection and Redraw Button - Show when tie detected */}
                    {isTie && tiedPhotos.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 2, ease: "easeOut" }}
                        className="text-center mb-8"
                      >
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 inline-block">
                          <div className="flex items-center justify-center mb-4">
                            <Trophy className="h-8 w-8 text-yellow-600 mr-3" />
                            <span className="text-xl font-bold text-yellow-800">TIE DETECTED!</span>
                          </div>
                          <p className="text-yellow-700 mb-4">
                            {tiedPhotos.length} photos have the same number of votes ({tiedPhotos[0]?.vote_count} votes each).
                          </p>
                          <button
                            onClick={handleRedraw}
                            className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors font-semibold flex items-center mx-auto"
                          >
                            <RotateCcw className="h-5 w-5 mr-2" />
                            🎲 Redraw Winner
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* All Results Grid */}
                    <div className="mt-8">
                      <h3 className="text-2xl font-bold text-center text-gray-900 mb-6">All Results</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {photos.map((photo, index) => (
                          <motion.div
                            key={photo.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                            className={`bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 ${
                              winner && photo.id === winner.id ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''
                            }`}
                          >
                            <img
                              src={getStorageUrl(photo.photo_url)}
                              alt={photo.title}
                              className="w-full h-48 object-cover"
                            />
                            <div className="p-4">
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">{photo.title}</h3>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Votes:</span>
                                <span className="text-lg font-bold text-purple-600">{photo.vote_count}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div
                                  className="h-2 rounded-full bg-purple-500 transition-all duration-500"
                                  style={{ width: `${photo.vote_percentage}%` }}
                                />
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {photo.vote_percentage.toFixed(1)}%
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Total votes and participants */}
                    <div className="flex justify-center space-x-12 text-lg md:text-xl mt-8">
                      <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
                        <BarChart3 className="h-6 w-6 text-purple-600" />
                        <span className="font-semibold text-gray-900">Total Votes: </span>
                        <span className="font-bold text-purple-600">{totalVotes}</span>
                      </div>
                      <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
                        <Vote className="h-6 w-6 text-purple-600" />
                        <span className="font-semibold text-gray-900">Total Participants: </span>
                        <span className="font-bold text-purple-600">{totalParticipants}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* Regular Grid Display - Only show when timer is running and results are not showing */
                  <>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Voting Results</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {photos.map((photo, index) => (
                        <div
                          key={photo.id}
                          className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
                        >
                          <img
                            src={getStorageUrl(photo.photo_url)}
                            alt={photo.title}
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-4">
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">{photo.title}</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">Votes</span>
                                <div className="flex items-center space-x-1">
                                  <motion.span 
                                    key={`vote-count-${photo.id}-${photo.vote_count}`}
                                    initial={{ scale: 1.2, color: "#8b5cf6" }}
                                    animate={{ scale: 1, color: "#111827" }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="text-sm font-bold text-purple-600"
                                  >
                                    {photo.vote_count}
                                  </motion.span>
                                  <span className="text-sm text-gray-500">(</span>
                                  <motion.span 
                                    key={`vote-percentage-${photo.id}-${photo.vote_percentage}`}
                                    initial={{ scale: 1.2, color: "#8b5cf6" }}
                                    animate={{ scale: 1, color: "#111827" }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="text-sm font-bold text-purple-600"
                                  >
                                    {photo.vote_percentage.toFixed(1)}
                                  </motion.span>
                                  <span className="text-sm text-gray-500">%)</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <motion.div
                                  key={`progress-${photo.id}-${photo.vote_percentage}`}
                                  className="h-3 rounded-full bg-purple-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${photo.vote_percentage}%` }}
                                  transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900">
        <MonitorDisplay />
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg hover:bg-opacity-90 transition-colors z-10"
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
          <div className="flex space-x-3">
            <button
              onClick={() => updateStatistics(true)}
              disabled={!selectedSessionId || isRefreshing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
              >
                <RefreshCw className="h-5 w-5 mr-2" />
              </motion.div>
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button
              onClick={toggleFullscreen}
              disabled={!selectedSessionId}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Monitor className="h-5 w-5 mr-2" />
              Fullscreen Monitor
            </button>
          </div>
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
                {lastUpdate && (
                  <div className="text-xs text-purple-500 mt-1">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </div>
                )}
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