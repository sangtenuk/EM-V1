import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import { Play, Pause, RotateCcw, Users, Trophy, Clock, Eye, QrCode, Monitor, RefreshCw, Brain } from 'lucide-react'
import { generateQuizQRCode } from '../../lib/quizQRGenerator'
import { motion, AnimatePresence } from 'framer-motion'

interface QuizSession {
  id: string
  event_id: string
  title: string
  description: string | null
  qr_code_url: string | null
  status: 'waiting' | 'welcoming' | 'active' | 'paused' | 'finished'
  current_question_index: number
  host_id: string | null
  created_at: string
  updated_at: string
  event?: {
    name: string
  }
  participants?: QuizParticipant[]
  questions?: Question[]
  winners?: QuizWinner[]
}

interface QuizWinner {
  id: string
  session_id: string
  participant_id: string
  player_name: string
  final_score: number
  rank_position: number
  created_at: string
}

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'timed'
  time_limit: number
  points: number
  order_index: number
  media_url: string | null
}

interface QuizParticipant {
  id: string
  session_id: string
  attendee_id: string
  player_name: string
  total_score: number
  joined_at: string
}

interface QuizMonitorProps {
  userCompany: any
}

const QuizMonitor: React.FC<QuizMonitorProps> = ({ userCompany }) => {
  const [sessions, setSessions] = useState<QuizSession[]>([])
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQRModal, setShowQRModal] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    fetchActiveSessions()
    setupRealtimeSubscriptions()
  }, [])

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

  const fetchActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          event:events(name),
          participants:quiz_participants(*),
          questions:quiz_questions(*),
          winners:quiz_winners(*)
        `)
        .in('status', ['waiting', 'active', 'paused', 'finished'])
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // For finished sessions, if no winners in database, use participants as winners
      const sessionsWithWinners = data?.map(session => {
        if (session.status === 'finished' && (!session.winners || session.winners.length === 0)) {
          // Use participants as winners if no winners saved in database
          const sortedParticipants = session.participants?.sort((a: QuizParticipant, b: QuizParticipant) => b.total_score - a.total_score) || []
          return {
            ...session,
            winners: sortedParticipants.map((participant: QuizParticipant, index: number) => ({
              id: `temp-${participant.id}`,
              session_id: session.id,
              participant_id: participant.id,
              player_name: participant.player_name,
              final_score: participant.total_score,
              rank_position: index + 1,
              created_at: new Date().toISOString()
            }))
          }
        }
        return session
      })
      
      setSessions(sessionsWithWinners || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Failed to fetch quiz sessions')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = () => {
    // Subscribe to session updates
    const sessionSubscription = supabase
      .channel('quiz_monitor_sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_sessions'
      }, () => {
        fetchActiveSessions()
      })
      .subscribe()

    // Subscribe to participant updates
    const participantSubscription = supabase
      .channel('quiz_monitor_participants')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_participants'
      }, () => {
        fetchActiveSessions()
      })
      .subscribe()

    return () => {
      sessionSubscription.unsubscribe()
      participantSubscription.unsubscribe()
    }
  }

  const startSession = async (session: QuizSession) => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'welcoming',
          current_question_index: 0
        })
        .eq('id', session.id)

      if (error) throw error

      toast.success('Quiz session started - Welcome screen active')
      fetchActiveSessions()
    } catch (error) {
      console.error('Error starting session:', error)
      toast.error('Failed to start session')
    }
  }

  const pauseSession = async (session: QuizSession) => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ status: 'paused' })
        .eq('id', session.id)

      if (error) throw error

      toast.success('Quiz session paused')
      fetchActiveSessions()
    } catch (error) {
      console.error('Error pausing session:', error)
      toast.error('Failed to pause session')
    }
  }

  const startFirstQuestion = async (session: QuizSession) => {
    try {
      // Check if there are questions available
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id')
        .eq('session_id', session.id)
        .order('order_index')

      if (questionsError) {
        console.error('Error checking questions:', questionsError)
        throw questionsError
      }

      if (!questions || questions.length === 0) {
        toast.error('No questions available for this session')
        return
      }

      // Start the first question
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'active',
          current_question_index: 1
        })
        .eq('id', session.id)

      if (error) throw error

      toast.success('First question started!')
      fetchActiveSessions()
    } catch (error) {
      console.error('Error starting first question:', error)
      toast.error('Failed to start first question')
    }
  }

  const nextQuestion = async (session: QuizSession) => {
    try {
      const nextIndex = session.current_question_index + 1
      
      // Check if there are more questions available
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id')
        .eq('session_id', session.id)
        .order('order_index')

      if (questionsError) {
        console.error('Error checking questions:', questionsError)
        throw questionsError
      }

      if (nextIndex > questions.length) {
        // No more questions, end the quiz
        const { error: endError } = await supabase
          .from('quiz_sessions')
          .update({ status: 'finished' })
          .eq('id', session.id)

        if (endError) throw endError

        toast.success('Quiz completed! No more questions available.')
      } else {
        // Load next question
        const { error } = await supabase
          .from('quiz_sessions')
          .update({ current_question_index: nextIndex })
          .eq('id', session.id)

        if (error) throw error

        toast.success(`Question ${nextIndex} loaded`)
      }
      
      fetchActiveSessions()
    } catch (error) {
      console.error('Error loading next question:', error)
      toast.error('Failed to load next question')
    }
  }

  const finishSession = async (session: QuizSession) => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ status: 'finished' })
        .eq('id', session.id)

      if (error) throw error

      toast.success('Quiz session finished')
      fetchActiveSessions()
    } catch (error) {
      console.error('Error finishing session:', error)
      toast.error('Failed to finish session')
    }
  }

  const resetSession = async (session: QuizSession) => {
    if (!confirm('Are you sure you want to reset this session? This will remove all participants and responses.')) return

    try {
      console.log('Resetting session:', session.id)
      
      // Delete all responses first (due to foreign key constraints)
      const { error: responsesError } = await supabase
        .from('quiz_responses')
        .delete()
        .eq('session_id', session.id)

      if (responsesError) {
        console.error('Error deleting responses:', responsesError)
        throw responsesError
      }

      console.log('Responses deleted successfully')

      // Delete all participants
      const { error: participantsError } = await supabase
        .from('quiz_participants')
        .delete()
        .eq('session_id', session.id)

      if (participantsError) {
        console.error('Error deleting participants:', participantsError)
        throw participantsError
      }

      console.log('Participants deleted successfully')

      // Reset session status completely
      const { error: sessionError } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'waiting',
          current_question_index: 0,
          qr_code_url: null // Clear QR code to force regeneration
        })
        .eq('id', session.id)

      if (sessionError) {
        console.error('Error updating session:', sessionError)
        throw sessionError
      }

      console.log('Session reset successfully')
      toast.success('Session reset successfully - All participants cleared!')
      
      // Force immediate refresh of sessions
      await fetchActiveSessions()
      
      // If this session is currently selected, update the selected session
      if (selectedSession?.id === session.id) {
        // Refresh the selected session data
        const { data: updatedSessionData, error } = await supabase
          .from('quiz_sessions')
          .select(`
            *,
            event:events(name),
            participants:quiz_participants(*),
            questions:quiz_questions(*)
          `)
          .eq('id', session.id)
          .single()
        
        if (!error && updatedSessionData) {
          setSelectedSession(updatedSessionData)
        }
      }
    } catch (error) {
      console.error('Error resetting session:', error)
      toast.error('Failed to reset session')
    }
  }

  const updateStatistics = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true)
      }
      
      await fetchActiveSessions()
      setLastUpdate(new Date())
      
    } catch (error) {
      console.error('Error updating statistics:', error)
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false)
      }
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

  const showQRCode = (session: QuizSession) => {
    setSelectedSession(session)
    setShowQRModal(true)
  }

  const generateQRCode = async (session: QuizSession) => {
    try {
      const { qrCodeUrl } = await generateQuizQRCode(session.id, session.title)
      
      await supabase
        .from('quiz_sessions')
        .update({ qr_code_url: qrCodeUrl })
        .eq('id', session.id)

      toast.success('QR code generated successfully')
      fetchActiveSessions()
    } catch (error) {
      console.error('Error generating QR code:', error)
      toast.error('Failed to generate QR code')
    }
  }

  const saveWinners = async (session: QuizSession) => {
    if (!session.participants || session.participants.length === 0) {
      toast.error('No participants to save as winners')
      return
    }

    try {
      // Sort participants by score (highest first)
      const sortedParticipants = [...session.participants].sort((a, b) => b.total_score - a.total_score)
      
      // Prepare winners data
      const winnersData = sortedParticipants.map((participant, index) => ({
        session_id: session.id,
        participant_id: participant.id,
        player_name: participant.player_name,
        final_score: participant.total_score,
        rank_position: index + 1
      }))

      // Delete existing winners for this session
      await supabase
        .from('quiz_winners')
        .delete()
        .eq('session_id', session.id)

      // Insert new winners
      const { error } = await supabase
        .from('quiz_winners')
        .insert(winnersData)

      if (error) throw error

      toast.success(`Saved ${winnersData.length} winners to database`)
      fetchActiveSessions()
    } catch (error) {
      console.error('Error saving winners:', error)
      toast.error('Failed to save winners')
    }
  }

  const MonitorDisplay = () => {
    const session = sessions.find(s => s.id === selectedSession?.id)
    
    // Helper function to get score from winner or participant
    const getScore = (item: QuizWinner | QuizParticipant): number => {
      return 'final_score' in item ? item.final_score : item.total_score
    }
    
    if (!session) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No active quiz session selected</p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full text-gray-900 relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Content container */}
        <div className="relative z-10 h-full p-8">
          {/* Header */}
          <div className="flex justify-center items-center gap-12 py-10">
            {/* Quiz Info Card */}
            <div className="bg-white bg-opacity-95 rounded-2xl px-10 py-8 shadow-2xl border border-gray-200 flex flex-col items-center min-w-[320px] max-w-[420px]">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-3 text-gray-900 tracking-tight text-center">{session.title}</h1>
              <div className="text-lg md:text-2xl font-bold text-blue-600 mb-2 text-center">Quiz Session</div>
              {session.event?.name && (
                <div className="text-base md:text-lg font-semibold text-gray-700 text-center opacity-80 mb-2">{session.event.name}</div>
              )}
              <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                session.status === 'active' ? 'bg-green-100 text-green-800' :
                session.status === 'welcoming' ? 'bg-purple-100 text-purple-800' :
                session.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {session.status === 'welcoming' ? 'Welcome Screen' : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </div>
            </div>

            {/* QR Code Card */}
            {session.qr_code_url && (
              <div className="bg-white bg-opacity-95 rounded-2xl px-10 py-8 shadow-2xl border border-gray-200 flex flex-col items-center min-w-[240px] max-w-[320px]">
                <div className="mb-3 text-center">
                  <span className="text-gray-900 font-bold text-lg tracking-wide">Scan to Join</span>
                </div>
                <img 
                  src={session.qr_code_url} 
                  alt="Quiz QR Code" 
                  className="w-40 h-40 mx-auto border-2 border-gray-300 rounded-xl shadow-lg bg-white"
                />
                <p className="text-gray-700 text-base mt-4 opacity-80 text-center font-medium">Scan with your phone</p>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex justify-center space-x-12 text-lg md:text-xl mb-8">
            <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
              <Users className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-gray-900">Participants: </span>
              <motion.span 
                key={`participants-${session.participants?.length || 0}`}
                initial={{ scale: 1.2, color: "#2563eb" }}
                animate={{ scale: 1, color: "#111827" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="font-bold text-blue-600"
              >
                {session.participants?.length || 0}
              </motion.span>
            </div>
            <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
              <Brain className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-gray-900">Questions: </span>
              <motion.span 
                key={`questions-${session.questions?.length || 0}`}
                initial={{ scale: 1.2, color: "#2563eb" }}
                animate={{ scale: 1, color: "#111827" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="font-bold text-blue-600"
              >
                {session.questions?.length || 0}
              </motion.span>
            </div>
            {session.status === 'active' && session.current_question_index > 0 && (
              <div className="flex items-center space-x-3 bg-white bg-opacity-95 rounded-xl px-6 py-3 shadow-lg border border-gray-200">
                <Clock className="h-6 w-6 text-blue-600" />
                <span className="font-semibold text-gray-900">Current: </span>
                <motion.span 
                  key={`current-${session.current_question_index}`}
                  initial={{ scale: 1.2, color: "#2563eb" }}
                  animate={{ scale: 1, color: "#111827" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="font-bold text-blue-600"
                >
                  Q{session.current_question_index}
                </motion.span>
              </div>
            )}
          </div>

          {/* Welcome Screen */}
          {session.status === 'welcoming' && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="bg-white bg-opacity-95 rounded-2xl px-12 py-16 shadow-2xl border border-gray-200"
                >
                  <div className="mb-8">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Brain className="w-24 h-24 text-purple-600 mx-auto mb-6" />
                    </motion.div>
                    <h2 className="text-4xl font-bold text-gray-900 mb-4">Welcome to the Quiz!</h2>
                    <p className="text-xl text-gray-600 mb-6">Get ready to test your knowledge</p>
                    <div className="bg-purple-50 rounded-lg p-6 mb-8">
                      <h3 className="text-2xl font-semibold text-purple-900 mb-4">📋 Instructions</h3>
                      <ul className="text-left text-purple-800 space-y-2">
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-purple-800 font-bold text-sm mr-3">1</span>
                          Read each question carefully
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-purple-800 font-bold text-sm mr-3">2</span>
                          Select your answer before time runs out
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-purple-800 font-bold text-sm mr-3">3</span>
                          Earn points for correct answers
                        </li>
                        <li className="flex items-center">
                          <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-purple-800 font-bold text-sm mr-3">4</span>
                          Check the leaderboard to see your ranking
                        </li>
                      </ul>
                    </div>
                    <div className="flex justify-center space-x-8 text-lg">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{session.participants?.length || 0}</div>
                        <div className="text-gray-600">Participants</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{session.questions?.length || 0}</div>
                        <div className="text-gray-600">Questions</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          )}

          {/* Participants Leaderboard or Winners */}
          {session.participants && session.participants.length > 0 && (
            <div className="max-w-4xl mx-auto">
              {session.status === 'finished' ? (
                // Show Winners
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">🏆 Final Winners</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(session.winners && session.winners.length > 0 
                      ? session.winners 
                      : session.participants?.sort((a: QuizParticipant, b: QuizParticipant) => b.total_score - a.total_score)
                    )
                      ?.slice(0, 6)
                      .map((winner: QuizWinner | QuizParticipant, index) => (
                        <motion.div
                          key={winner.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                          className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${
                            index === 0 ? 'border-yellow-400 bg-yellow-50' :
                            index === 1 ? 'border-gray-400 bg-gray-50' :
                            index === 2 ? 'border-amber-500 bg-amber-50' :
                            'border-blue-200'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                  index === 0 ? 'bg-yellow-500' :
                                  index === 1 ? 'bg-gray-400' :
                                  index === 2 ? 'bg-amber-600' :
                                  'bg-blue-500'
                                }`}>
                                  {index + 1}
                                </div>
                                <span className="font-semibold text-gray-900">{winner.player_name}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                  {getScore(winner)}
                                </div>
                                <div className="text-sm text-gray-500">points</div>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                                style={{ 
                                  width: `${session.winners && session.winners.length > 0 
                                    ? (getScore(winner) / Math.max(...session.winners.map(w => getScore(w)))) * 100 
                                    : 0}%` 
                                }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              ) : (
                // Show Live Leaderboard
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Live Leaderboard</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {session.participants
                      .sort((a, b) => b.total_score - a.total_score)
                      .slice(0, 6)
                      .map((participant, index) => (
                        <motion.div
                          key={participant.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                          className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200"
                        >
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                  index === 0 ? 'bg-yellow-500' :
                                  index === 1 ? 'bg-gray-400' :
                                  index === 2 ? 'bg-amber-600' :
                                  'bg-blue-500'
                                }`}>
                                  {index + 1}
                                </div>
                                <span className="font-semibold text-gray-900">{participant.player_name}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">{participant.total_score}</div>
                                <div className="text-sm text-gray-500">points</div>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                                style={{ 
                                  width: `${session.participants && session.participants.length > 0 
                                    ? (participant.total_score / Math.max(...session.participants.map(p => p.total_score))) * 100 
                                    : 0}%` 
                                }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900">
        <MonitorDisplay />
        
        {/* Control buttons */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {selectedSession && selectedSession.status === 'active' && (
            <button
              onClick={() => nextQuestion(selectedSession)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Clock className="h-5 w-5 mr-2" />
              Next Question
            </button>
          )}
          {selectedSession && selectedSession.status === 'finished' && (
            <button
              onClick={() => saveWinners(selectedSession)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
            >
              <Trophy className="h-5 w-5 mr-2" />
              Save Winners
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="bg-black bg-opacity-70 text-white p-3 rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Exit Fullscreen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quiz Monitor</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => updateStatistics(true)}
            disabled={!selectedSession || isRefreshing}
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
            disabled={!selectedSession}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Monitor className="h-5 w-5 mr-2" />
            Fullscreen Monitor
          </button>
          {selectedSession && selectedSession.status === 'active' && (
            <button
              onClick={() => nextQuestion(selectedSession)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Clock className="h-5 w-5 mr-2" />
              Next Question
            </button>
          )}
          {selectedSession && selectedSession.status === 'finished' && (
            <button
              onClick={() => saveWinners(selectedSession)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
            >
              <Trophy className="h-5 w-5 mr-2" />
              Save Winners
            </button>
          )}
        </div>
      </div>

      {/* Session Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Active Quiz Session
            </label>
            <select
              value={selectedSession?.id || ''}
              onChange={(e) => {
                const session = sessions.find(s => s.id === e.target.value)
                setSelectedSession(session || null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an active quiz session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} - {session.event?.name}
                </option>
              ))}
            </select>
          </div>
          
          {selectedSession && (
            <div className="flex items-end">
              <div className="bg-blue-50 rounded-lg p-4 w-full">
                <div className="text-sm text-blue-600 font-medium">Live Stats</div>
                <div className="text-2xl font-bold text-blue-900">{selectedSession.participants?.length || 0}</div>
                <div className="text-sm text-blue-600">Active Participants</div>
                {lastUpdate && (
                  <div className="text-xs text-blue-500 mt-1">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Brain className="h-6 w-6 mr-2" />
          Monitor Preview
        </h2>
        
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
          {selectedSession ? (
            <MonitorDisplay />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Brain className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select an active quiz session to see preview</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>• This preview shows how the quiz monitor will appear</p>
          <p>• Click "Fullscreen Monitor" to display on external screen</p>
          <p>• Results update automatically in real-time</p>
          <p>• Shows live leaderboard and participant count</p>
        </div>
      </div>

      {/* Session Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Session Management</h2>
        
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Sessions</h3>
            <p className="text-gray-600">No quiz sessions are currently active or waiting.</p>
          </div>
        ) : (
          <div className="grid gap-6">
          {sessions.map((session) => (
            <div key={session.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                  <p className="text-gray-600 mt-1">{session.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>Event: {session.event?.name}</span>
                    <span>Questions: {session.questions?.length || 0}</span>
                    <span className="font-bold">Participants: {session.participants?.length || 0}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      session.status === 'active' ? 'bg-green-100 text-green-800' :
                      session.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => showQRCode(session)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                    title="Show QR Code"
                  >
                    <QrCode className="w-5 h-5" />
                  </button>
                  {session.status === 'waiting' && (
                    <button
                      onClick={() => startSession(session)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                      title="Start Session"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                  {session.status === 'welcoming' && (
                    <button
                      onClick={() => startFirstQuestion(session)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                      title="Start First Question"
                    >
                      <Clock className="w-5 h-5" />
                    </button>
                  )}
                  {session.status === 'active' && (
                    <>
                      <button
                        onClick={() => pauseSession(session)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                        title="Pause Session"
                      >
                        <Pause className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => nextQuestion(session)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Next Question"
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => finishSession(session)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Finish Session"
                      >
                        <Trophy className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  {session.status === 'paused' && (
                    <button
                      onClick={() => startSession(session)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                      title="Resume Session"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                  {session.status === 'finished' && (
                    <button
                      onClick={() => saveWinners(session)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                      title="Save Winners to Database"
                    >
                      <Trophy className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => resetSession(session)}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                    title="Reset Session"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Current Question Info */}
              {session.status === 'active' && session.current_question_index > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Current Question</h4>
                  <p className="text-blue-800">
                    Question {session.current_question_index} of {session.questions?.length || 0}
                  </p>
                </div>
              )}

              {/* Participants */}
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-3">Participants</h4>
                {session.participants && session.participants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {session.participants
                      .sort((a, b) => b.total_score - a.total_score)
                      .map((participant) => (
                        <div key={participant.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900">{participant.player_name}</p>
                              <p className="text-sm text-gray-600">Joined: {new Date(participant.joined_at).toLocaleTimeString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-600">{participant.total_score} pts</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No participants yet</p>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">Quiz QR Code</h2>
              <p className="text-gray-600 mb-4">{selectedSession.title}</p>
              
              {selectedSession.qr_code_url ? (
                <div className="mb-4">
                  <img 
                    src={selectedSession.qr_code_url} 
                    alt="Quiz QR Code" 
                    className="mx-auto border rounded-lg"
                  />
                </div>
              ) : (
                <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                  <p className="text-gray-500 mb-4">No QR code generated yet</p>
                  <button
                    onClick={() => generateQRCode(selectedSession)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate QR Code
                  </button>
                </div>
              )}
              
              <div className="bg-blue-100 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-blue-900">Quiz Information</h3>
                <p className="text-sm text-blue-700 mt-2">
                  Attendees can scan this QR code to join and play this quiz directly.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                {!selectedSession.qr_code_url && (
                  <button
                    onClick={() => generateQRCode(selectedSession)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate QR Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuizMonitor 