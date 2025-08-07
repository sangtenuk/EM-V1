import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import { Play, Trophy, Clock, CheckCircle, XCircle, Users, Brain } from 'lucide-react'

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
}

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'timed'
  time_limit: number
  points: number
  order_index: number
  media_url: string | null
  answers: Answer[]
}

interface Answer {
  id: string
  answer_text: string
  is_correct: boolean
  order_index: number
}

interface QuizParticipant {
  id: string
  session_id: string
  attendee_id: string
  player_name: string
  total_score: number
  joined_at: string
}

interface LeaderboardEntry {
  player_name: string
  total_score: number
  rank: number
}

const QuizPlayer: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<QuizSession | null>(null)
  const [participant, setParticipant] = useState<QuizParticipant | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [gameState, setGameState] = useState<'joining' | 'waiting' | 'welcoming' | 'playing' | 'finished'>('joining')
  const [loading, setLoading] = useState(true)
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)

  // Join form state
  const [joinForm, setJoinForm] = useState({
    attendeeId: ''
  })

  useEffect(() => {
    if (sessionId) {
      joinQuiz()
    }
  }, [sessionId])

  // Load attendee ID from localStorage on component mount
  useEffect(() => {
    const storedAttendeeId = localStorage.getItem('quiz_attendee_id')
    if (storedAttendeeId) {
      setJoinForm({ attendeeId: storedAttendeeId })
    }
  }, [])

  useEffect(() => {
    if (session) {
      console.log('Setting up real-time subscriptions for session:', session.id)
      const cleanup = setupRealtimeSubscriptions()
      // Check current session status immediately
      checkSessionStatus()
      
      return cleanup
    }
  }, [session?.id]) // Only re-run when session ID changes

  // Ensure participant state is maintained
  useEffect(() => {
    console.log('Participant state changed:', participant)
  }, [participant])

  // Log selected answer changes
  useEffect(() => {
    console.log('Selected answer changed:', selectedAnswer)
  }, [selectedAnswer])

  const checkSessionStatus = async () => {
    if (!session) return

    try {
      console.log('Checking session status for:', session.id)
      
      const { data: currentSession, error } = await supabase
        .from('quiz_sessions')
        .select('status, current_question_index')
        .eq('id', session.id)
        .single()

      if (error) {
        console.error('Error checking session status:', error)
        return
      }

      if (currentSession) {
        console.log('Current session status:', currentSession)
        setSession(prev => prev ? { ...prev, ...currentSession } : null)
        
        // If session is active and has a current question, load it
        if (currentSession.status === 'active' && currentSession.current_question_index > 0) {
          console.log('Session is active, loading question:', currentSession.current_question_index)
          // Only load question if we have a participant
          if (participant) {
            loadCurrentQuestion(currentSession.current_question_index)
          } else {
            console.log('No participant found, skipping question load')
            setGameState('waiting')
          }
        } else if (currentSession.status === 'waiting') {
          console.log('Session is waiting')
          setGameState('waiting')
        } else if (currentSession.status === 'finished') {
          console.log('Session is finished')
          setGameState('finished')
        }
      }
    } catch (error) {
      console.error('Error checking session status:', error)
    }
  }

  useEffect(() => {
    console.log('Timer effect - timeLeft:', timeLeft, 'gameState:', gameState, 'HasAnswered:', hasAnswered, 'SubmittingAnswer:', submittingAnswer)
    if (timeLeft > 0 && gameState === 'playing' && !hasAnswered && !submittingAnswer) {
      const timer = setTimeout(() => {
        console.log('Timer tick - timeLeft:', timeLeft)
        setTimeLeft(prev => {
          const newTime = prev - 1
          console.log('Timer updated to:', newTime)
          if (newTime === 0) {
            console.log('Time up!')
            handleTimeUp()
          }
          return newTime
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft, gameState, hasAnswered, submittingAnswer])

  // Reset answer states when new question loads
  useEffect(() => {
    if (currentQuestion) {
      setSelectedAnswer(null)
      setHasAnswered(false)
      setShowResults(false)
      setSubmittingAnswer(false)
      setAnswerSubmitted(false)
    }
  }, [currentQuestion?.id])

  // Maintain participant state across question changes
  useEffect(() => {
    if ((gameState === 'playing' || gameState === 'waiting') && !participant) {
      console.log('No participant found during', gameState, 'state, attempting to recover...')
      recoverParticipant()
    }
  }, [gameState, participant])

  const joinQuiz = async () => {
    if (!sessionId) {
      toast.error('No session ID found')
      return
    }

    try {
      // Get the session
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          event:events(name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Session lookup error:', sessionError)
        toast.error('Error loading quiz session. Please try again.')
        return
      }

      if (!sessionData) {
        toast.error('Quiz session not found. Please check the QR code.')
        return
      }

      setSession(sessionData)
      
      // Check if we have a stored attendee ID and try to auto-join
      const storedAttendeeId = localStorage.getItem('quiz_attendee_id')
      if (storedAttendeeId) {
        console.log('Found stored attendee ID, attempting auto-join...')
        setJoinForm({ attendeeId: storedAttendeeId })
        // Try to auto-join after a short delay
        setTimeout(async () => {
          await joinAsParticipant()
        }, 500)
      } else {
        setGameState('joining')
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error joining quiz:', error)
      toast.error('Failed to join quiz')
    }
  }

  const setupRealtimeSubscriptions = () => {
    if (!session) return () => {}

    console.log('Setting up real-time subscriptions for session:', session.id)

    // Subscribe to session updates
    console.log('Setting up session subscription for:', session.id)
    const sessionSubscription = supabase
      .channel(`quiz_session_${session.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quiz_sessions',
        filter: `id=eq.${session.id}`
      }, (payload) => {
        console.log('Session update received:', payload)
        console.log('Payload new:', payload.new)
        console.log('Payload old:', payload.old)
        const updatedSession = payload.new as QuizSession
        
        // Always update session state
        setSession(updatedSession)
        
        // Handle status changes
        if (updatedSession.status === 'active' && updatedSession.current_question_index > 0) {
          // Only load new question if it's different from current question and user hasn't answered
          const currentQuestionIndex = currentQuestion ? currentQuestion.order_index + 1 : 0
          console.log('Question comparison:', {
            updatedSessionIndex: updatedSession.current_question_index,
            currentQuestionIndex,
            answerSubmitted,
            participant: !!participant
          })
          
          if (updatedSession.current_question_index !== currentQuestionIndex && !answerSubmitted) {
            console.log('Loading new question:', updatedSession.current_question_index)
            // Only load question if we have a participant
            if (participant) {
              loadCurrentQuestion(updatedSession.current_question_index)
            } else {
              console.log('No participant found, skipping question load')
              setGameState('waiting')
            }
          } else if (answerSubmitted) {
            console.log('User has already answered, not reloading question')
          } else {
            console.log('Same question, not reloading')
          }
        } else if (updatedSession.status === 'finished') {
          console.log('Quiz finished, fetching final leaderboard')
          fetchLeaderboard()
          setGameState('finished')
        } else if (updatedSession.status === 'welcoming') {
          console.log('Session is in welcoming state')
          setGameState('welcoming')
          // If no participant in welcoming state, try to recover
          if (!participant) {
            console.log('Session is welcoming but no participant found, attempting recovery...')
            setTimeout(() => recoverParticipant(), 1000) // Delay recovery slightly
          }
        } else if (updatedSession.status === 'waiting') {
          setGameState('waiting')
          // If no participant in waiting state, try to recover
          if (!participant) {
            console.log('Session is waiting but no participant found, attempting recovery...')
            setTimeout(() => recoverParticipant(), 1000) // Delay recovery slightly
          }
        }
      })
      .subscribe((status) => {
        console.log('Session subscription status:', status)
      })

    // Subscribe to leaderboard updates
    const leaderboardSubscription = supabase
      .channel(`quiz_leaderboard_${session.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_participants',
        filter: `session_id=eq.${session.id}`
      }, () => {
        console.log('Leaderboard update received')
        fetchLeaderboard()
      })
      .subscribe((status) => {
        console.log('Leaderboard subscription status:', status)
      })

    return () => {
      console.log('Cleaning up real-time subscriptions')
      sessionSubscription.unsubscribe()
      leaderboardSubscription.unsubscribe()
    }
  }

  const joinAsParticipant = async () => {
    if (!session || !joinForm.attendeeId.trim()) {
      toast.error('Please enter your staff ID or identification number')
      return
    }

    try {
      // Check if attendee exists and get their name
      // Try multiple fields: staff_id, identification_number, or any other identifier
      // Note: id is UUID, so we don't search by it since users won't know their UUID
      console.log('Looking for attendee with ID:', joinForm.attendeeId.trim())
      
      const { data: attendee, error: attendeeError } = await supabase
        .from('attendees')
        .select('id, name, staff_id, identification_number')
        .or(`staff_id.eq.${joinForm.attendeeId.trim()},identification_number.eq.${joinForm.attendeeId.trim()}`)
        .maybeSingle()

      console.log('Attendee lookup result:', attendee)
      console.log('Attendee lookup error:', attendeeError)

      if (attendeeError) {
        console.error('Attendee lookup error:', attendeeError)
        toast.error('Error looking up attendee. Please try again.')
        return
      }

      if (!attendee) {
        console.error('No attendee found for ID:', joinForm.attendeeId.trim())
        toast.error('Attendee not found. Please check your staff ID or identification number.')
        return
      }

      console.log('Found attendee:', attendee)

      // Store attendee ID in localStorage for recovery
      localStorage.setItem('quiz_attendee_id', joinForm.attendeeId.trim())

      // Check if already participating
      const { data: existingParticipant, error: checkError } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('session_id', session.id)
        .eq('attendee_id', attendee.id) // Use the attendee's UUID, not the staff_id
        .maybeSingle()

      console.log('Existing participant check:', existingParticipant)

      if (existingParticipant) {
        console.log('Participant already exists, setting participant state')
        setParticipant(existingParticipant)
        setGameState('waiting')
        fetchLeaderboard()
        toast.success('Welcome back! You are already participating in this quiz.')
        return
      }

      // Join as participant using attendee name
      console.log('Creating participant with session_id:', session.id, 'attendee_id:', attendee.id, 'player_name:', attendee.name)
      
      const { data: participantData, error: participantError } = await supabase
        .from('quiz_participants')
        .insert({
          session_id: session.id,
          attendee_id: attendee.id, // Use the attendee's UUID, not the staff_id
          player_name: attendee.name
        })
        .select()
        .single()

      console.log('Participant creation result:', participantData)
      console.log('Participant creation error:', participantError)

      if (participantError) {
        console.error('Error creating participant:', participantError)
        throw participantError
      }

      if (!participantData) {
        console.error('No participant data returned from creation')
        toast.error('Failed to create participant')
        return
      }

      console.log('Participant created successfully:', participantData)
      setParticipant(participantData)
      setGameState('waiting')
      fetchLeaderboard()
      
      toast.success('Successfully joined the quiz!')
    } catch (error) {
      console.error('Error joining as participant:', error)
      toast.error('Failed to join quiz')
    }
  }

  const loadCurrentQuestion = async (questionIndex: number) => {
    if (!session) return

    try {
      console.log('Loading question for index:', questionIndex)
      console.log('Looking for order_index:', questionIndex - 1)
      
      // First, let's check what questions exist for this session
      const { data: allQuestions, error: listError } = await supabase
        .from('quiz_questions')
        .select('id, order_index, question_text')
        .eq('session_id', session.id)
        .order('order_index')

      if (listError) {
        console.error('Error listing questions:', listError)
        toast.error('Failed to load questions')
        return
      }

      console.log('Available questions:', allQuestions)

      // Check if we've reached the end of questions
      if (questionIndex > allQuestions.length) {
        console.log('No more questions available, ending quiz')
        await endQuiz()
        return
      }

      // Find the question with the correct order_index
      let targetQuestion = allQuestions.find(q => q.order_index === questionIndex - 1)
      
      // If not found, try to find by array index (fallback)
      if (!targetQuestion && allQuestions.length > 0) {
        const arrayIndex = questionIndex - 1
        if (arrayIndex < allQuestions.length) {
          targetQuestion = allQuestions[arrayIndex]
          console.log(`Using fallback: question at array index ${arrayIndex}`)
        }
      }
      
      if (!targetQuestion) {
        console.error(`No question found with order_index ${questionIndex - 1}`)
        console.log('Available order_indexes:', allQuestions.map(q => q.order_index))
        console.log('Total questions available:', allQuestions.length)
        toast.error(`Question ${questionIndex} not found. Available questions: ${allQuestions.length}`)
        return
      }

      // Now load the full question with answers
      const { data, error } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          answers:quiz_answers(*)
        `)
        .eq('id', targetQuestion.id)
        .single()

      if (error) {
        console.error('Error loading question details:', error)
        toast.error('Failed to load question details')
        return
      }

      if (!data) {
        console.error('No question found for ID:', targetQuestion.id)
        toast.error('Question not found')
        return
      }

      console.log('Question loaded:', data)
      console.log('Answers:', data?.answers)

      // Check if this is the same question we're already on
      if (currentQuestion && currentQuestion.id === data.id) {
        console.log('Same question, not reloading')
        return
      }

      setCurrentQuestion(data)
      setTimeLeft(data.time_limit)
      setSelectedAnswer(null)
      setHasAnswered(false)
      setShowResults(false)
      setSubmittingAnswer(false)
      setAnswerSubmitted(false)
      setGameState('playing')
      
      // Ensure participant state is maintained
      console.log('Setting game state to playing, participant:', participant)
      console.log('Timer set to:', data.time_limit)
    } catch (error) {
      console.error('Error loading question:', error)
      toast.error('Failed to load question')
    }
  }

  const endQuiz = async () => {
    if (!session) return

    try {
      console.log('Ending quiz session')
      
      // Update session status to finished
      const { error: sessionError } = await supabase
        .from('quiz_sessions')
        .update({ status: 'finished' })
        .eq('id', session.id)

      if (sessionError) {
        console.error('Error ending session:', sessionError)
        throw sessionError
      }

      // Fetch final leaderboard
      await fetchLeaderboard()
      
      // Save winners to database
      await saveWinnersToDatabase()
      
      // Set game state to finished
      setGameState('finished')
      setCurrentQuestion(null)
      setTimeLeft(0)
      setSelectedAnswer(null)
      setHasAnswered(false)
      setShowResults(false)
      
      toast.success('Quiz completed!')
    } catch (error) {
      console.error('Error ending quiz:', error)
      toast.error('Failed to end quiz')
    }
  }

  const recoverParticipant = async () => {
    if (!session) {
      console.log('Cannot recover participant - missing session')
      return
    }

    // Get attendee ID from localStorage or form
    const attendeeId = localStorage.getItem('quiz_attendee_id') || joinForm.attendeeId
    if (!attendeeId) {
      console.log('Cannot recover participant - missing attendee ID')
      return
    }

    try {
      console.log('Attempting to recover participant for session:', session.id)
      console.log('Looking for staff_id:', attendeeId)
      
      // First find the attendee by staff_id
      const { data: attendee, error: attendeeError } = await supabase
        .from('attendees')
        .select('id, name, staff_id')
        .or(`staff_id.eq.${attendeeId},identification_number.eq.${attendeeId}`)
        .maybeSingle()
      
      if (attendeeError) {
        console.error('Error finding attendee:', attendeeError)
        return
      }
      
      if (!attendee) {
        console.log('No attendee found for staff_id:', attendeeId)
        return
      }
      
      console.log('Found attendee:', attendee)
      
      // Now find the participant using the attendee's UUID
      const { data: participantData, error } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('session_id', session.id)
        .eq('attendee_id', attendee.id)
        .maybeSingle()
      
      console.log('Participant lookup result:', participantData)
      console.log('Participant lookup error:', error)
      
      if (participantData) {
        setParticipant(participantData)
        console.log('Participant recovered successfully')
        toast.success('Participant data recovered!')
      } else {
        console.log('No participant data found for this attendee')
        toast.error('No participant data found. Please rejoin the quiz.')
      }
    } catch (error) {
      console.error('Error recovering participant:', error)
    }
  }

  const saveWinnersToDatabase = async () => {
    if (!session || !leaderboard.length) return

    try {
      console.log('Saving winners to database')
      
      // Get all participants for this session
      const { data: participants, error: participantsError } = await supabase
        .from('quiz_participants')
        .select('*')
        .eq('session_id', session.id)
        .order('total_score', { ascending: false })

      if (participantsError) {
        console.error('Error fetching participants:', participantsError)
        return
      }

      if (!participants || participants.length === 0) {
        console.log('No participants to save as winners')
        return
      }

      // Delete existing winners for this session
      await supabase
        .from('quiz_winners')
        .delete()
        .eq('session_id', session.id)

      // Prepare winners data
      const winnersData = participants.map((participant, index) => ({
        session_id: session.id,
        participant_id: participant.id,
        player_name: participant.player_name,
        final_score: participant.total_score,
        rank_position: index + 1
      }))

      // Insert new winners
      const { error: winnersError } = await supabase
        .from('quiz_winners')
        .insert(winnersData)

      if (winnersError) {
        console.error('Error saving winners:', winnersError)
        return
      }

      console.log(`Saved ${winnersData.length} winners to database`)
    } catch (error) {
      console.error('Error saving winners to database:', error)
    }
  }

  const fetchLeaderboard = async () => {
    if (!session) return

    try {
      const { data, error } = await supabase
        .from('quiz_participants')
        .select('player_name, total_score')
        .eq('session_id', session.id)
        .order('total_score', { ascending: false })

      if (error) throw error

      const leaderboardData = data.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }))

      setLeaderboard(leaderboardData)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    }
  }

  const submitAnswer = async (answerId: string) => {
    console.log('Submit answer called with:', answerId)
    console.log('Session:', session?.id)
    console.log('Participant:', participant?.id)
    console.log('Current question:', currentQuestion?.id)
    console.log('Has answered:', hasAnswered)
    console.log('Time left:', timeLeft)
    console.log('Submitting answer:', submittingAnswer)

    if (!session || !participant || !currentQuestion) {
      console.log('Submit answer blocked - missing data')
      console.log('Session:', !!session, 'Participant:', !!participant, 'Question:', !!currentQuestion)
      if (!participant) {
        toast.error('Participant data not found. Please try refreshing the page.')
      }
      return
    }

    if (hasAnswered || submittingAnswer) {
      console.log('Submit answer blocked - already answered or submitting')
      return
    }

    // Set states immediately to prevent multiple submissions and show visual feedback
    setSubmittingAnswer(true)
    setSelectedAnswer(answerId)
    setHasAnswered(true)
    setAnswerSubmitted(true)
    
    // Stop the timer immediately
    setTimeLeft(0)
    
    console.log('Answer selected:', answerId)
    console.log('Selected answer state set to:', answerId)
    console.log('Answer submitted flag set to true')

    const responseTime = currentQuestion.time_limit - timeLeft
    const selectedAnswerData = currentQuestion.answers.find(a => a.id === answerId)
    const isCorrect = selectedAnswerData?.is_correct || false
    const pointsEarned = isCorrect ? currentQuestion.points : 0

    console.log('Submitting answer:', {
      answerId,
      isCorrect,
      pointsEarned,
      responseTime
    })

    try {
      console.log('Submitting response to database...')
      
      // Submit response
      const { error: responseError } = await supabase
        .from('quiz_responses')
        .insert({
          session_id: session.id,
          question_id: currentQuestion.id,
          participant_id: participant.id,
          selected_answer_id: answerId,
          is_correct: isCorrect,
          response_time_ms: responseTime * 1000,
          points_earned: pointsEarned
        })

      if (responseError) {
        console.error('Error submitting response:', responseError)
        throw responseError
      }

      console.log('Response submitted successfully')

      // Update participant score
      const { error: scoreError } = await supabase
        .from('quiz_participants')
        .update({
          total_score: participant.total_score + pointsEarned
        })
        .eq('id', participant.id)

      if (scoreError) {
        console.error('Error updating score:', scoreError)
        throw scoreError
      }

      console.log('Score updated successfully')

      setParticipant(prev => prev ? { ...prev, total_score: prev.total_score + pointsEarned } : null)
      
      // Show results after a delay
      setTimeout(() => {
        setShowResults(true)
      }, 1000)

      toast.success(isCorrect ? `Correct! +${pointsEarned} points` : 'Answer submitted')

    } catch (error) {
      console.error('Error submitting answer:', error)
      toast.error('Failed to submit answer. Please try again.')
      // Reset the state on error
      setHasAnswered(false)
      setSelectedAnswer(null)
      setSubmittingAnswer(false)
      // Restart timer if there's still time
      if (timeLeft > 0) {
        setTimeLeft(timeLeft)
      }
    } finally {
      setSubmittingAnswer(false)
    }
  }

  const handleTimeUp = () => {
    console.log('Time up! Has answered:', hasAnswered)
    if (!hasAnswered) {
      console.log('Setting hasAnswered to true and showing results')
      setHasAnswered(true)
      setShowResults(true)
      setTimeLeft(0)
      toast('Time is up!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Session</h1>
          <p className="text-gray-600 mb-4">The quiz session you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'joining') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Quiz</h1>
            <p className="text-gray-600">{session.title}</p>
            <p className="text-sm text-gray-500 mt-2">Enter your staff ID or identification number to join</p>
          </div>

          <div className="space-y-4">
            <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff ID / Identification Number *
            </label>
            <input
              type="text"
              value={joinForm.attendeeId}
              onChange={(e) => setJoinForm({ ...joinForm, attendeeId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your staff ID or identification number"
            />
            </div>

            <button
              onClick={joinAsParticipant}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Join Quiz
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'waiting') {
    // If no participant, show join form instead of waiting
    if (!participant) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Quiz</h1>
              <p className="text-gray-600">{session.title}</p>
              <p className="text-sm text-gray-500 mt-2">Enter your staff ID or identification number to join</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff ID / Identification Number *
                </label>
                <input
                  type="text"
                  value={joinForm.attendeeId}
                  onChange={(e) => setJoinForm({ ...joinForm, attendeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your staff ID or identification number"
                />
              </div>

              <button
                onClick={joinAsParticipant}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Join Quiz
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md text-center">
          <div className="mb-6">
            <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for Quiz to Start</h1>
            <p className="text-gray-600">{session.title}</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-blue-800">
              Welcome, <strong>{participant?.player_name}</strong>!
            </p>
            <p className="text-sm text-blue-600 mt-2">
              The quiz will begin shortly. Please wait for the host to start the session.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Session Status: {session.status} | Question: {session.current_question_index}
            </p>
          </div>

          <div className="animate-pulse">
            <div className="h-2 bg-blue-200 rounded mb-2"></div>
            <div className="h-2 bg-blue-200 rounded mb-2"></div>
            <div className="h-2 bg-blue-200 rounded"></div>
          </div>
          
          <button
            onClick={checkSessionStatus}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Status
          </button>
          
          <button
            onClick={() => {
              console.log('Manual refresh triggered')
              checkSessionStatus()
            }}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Manual Refresh
          </button>
          
          <button
            onClick={() => {
              setGameState('joining')
              setParticipant(null)
              setCurrentQuestion(null)
              setTimeLeft(0)
              setSelectedAnswer(null)
              setHasAnswered(false)
              setShowResults(false)
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reset Player State
          </button>
          
          {!participant && (
            <button
              onClick={recoverParticipant}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Recover Participant
            </button>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'welcoming') {
    // If no participant, show join form instead of welcoming
    if (!participant) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Quiz</h1>
              <p className="text-gray-600">{session.title}</p>
              <p className="text-sm text-gray-500 mt-2">Enter your staff ID or identification number to join</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff ID / Identification Number *
                </label>
                <input
                  type="text"
                  value={joinForm.attendeeId}
                  onChange={(e) => setJoinForm({ ...joinForm, attendeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your staff ID or identification number"
                />
              </div>

              <button
                onClick={joinAsParticipant}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Join Quiz
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl text-center">
          <div className="mb-8">
            <div className="animate-pulse">
              <Brain className="w-24 h-24 text-purple-600 mx-auto mb-6" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to the Quiz!</h1>
            <p className="text-xl text-gray-600 mb-6">Get ready to test your knowledge</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-6 mb-8">
            <h3 className="text-2xl font-semibold text-purple-900 mb-4">📋 Instructions</h3>
            <ul className="text-left text-purple-800 space-y-3">
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

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-blue-800">
              Welcome, <strong>{participant?.player_name}</strong>!
            </p>
            <p className="text-sm text-blue-600 mt-2">
              The quiz is about to begin. Get ready!
            </p>
          </div>

          <div className="flex justify-center space-x-8 text-lg mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{session.participants?.length || 0}</div>
              <div className="text-gray-600">Participants</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{session.questions?.length || 0}</div>
              <div className="text-gray-600">Questions</div>
            </div>
          </div>

          <div className="animate-pulse">
            <div className="h-2 bg-purple-200 rounded mb-2"></div>
            <div className="h-2 bg-purple-200 rounded mb-2"></div>
            <div className="h-2 bg-purple-200 rounded"></div>
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            Waiting for the host to start the first question...
          </p>
        </div>
      </div>
    )
  }

  if (gameState === 'playing' && currentQuestion) {
    console.log('Rendering playing state:', {
      gameState,
      currentQuestion: currentQuestion?.id,
      participant: participant?.id,
      timeLeft,
      hasAnswered,
      answers: currentQuestion?.answers?.length
    })
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
                <p className="text-gray-600">Question {session.current_question_index}</p>
              </div>
              <div className="flex items-center gap-4">
                {participant && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Your Score</p>
                    <p className="text-lg font-bold text-blue-600">{participant.total_score}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-full">
                  <Clock className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-600">{timeLeft}s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{currentQuestion.question_text}</h2>
              {currentQuestion.media_url && (
                <div className="mb-4">
                  <img 
                    src={currentQuestion.media_url} 
                    alt="Question media" 
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Answers */}
            <div className="space-y-3">
              {currentQuestion.answers.map((answer) => (
                <button
                  key={answer.id}
                  onClick={() => {
                    console.log('Answer button clicked:', answer.id)
                    console.log('Has answered:', hasAnswered)
                    console.log('Submitting answer:', submittingAnswer)
                    console.log('Answer submitted:', answerSubmitted)
                    console.log('Participant:', participant?.id)
                    if (!hasAnswered && !submittingAnswer && !answerSubmitted && participant) {
                      // Set selected answer immediately for visual feedback
                      setSelectedAnswer(answer.id)
                      submitAnswer(answer.id)
                    } else {
                      console.log('Answer submission blocked')
                    }
                  }}
                  disabled={hasAnswered || submittingAnswer || answerSubmitted}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    hasAnswered
                      ? answer.is_correct
                        ? 'border-green-500 bg-green-50'
                        : selectedAnswer === answer.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                      : selectedAnswer === answer.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{answer.answer_text}</span>
                    <div className="flex items-center gap-2">
                      {selectedAnswer === answer.id && !hasAnswered && (
                        <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                      {hasAnswered && answer.is_correct && (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                      {hasAnswered && selectedAnswer === answer.id && !answer.is_correct && (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {showResults && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Results</h3>
                <p className="text-gray-600">
                  {selectedAnswer && currentQuestion.answers.find(a => a.id === selectedAnswer)?.is_correct
                    ? `Correct! You earned ${currentQuestion.points} points.`
                    : 'Incorrect. Better luck next time!'}
                </p>
              </div>
            )}

            {/* Debug Info */}
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-xs">
              <p><strong>Debug Info:</strong></p>
              <p>Game State: {gameState}</p>
              <p>Time Left: {timeLeft}</p>
              <p>Has Answered: {hasAnswered ? 'Yes' : 'No'}</p>
              <p>Submitting Answer: {submittingAnswer ? 'Yes' : 'No'}</p>
              <p>Answer Submitted: {answerSubmitted ? 'Yes' : 'No'}</p>
              <p>Selected Answer: {selectedAnswer || 'None'}</p>
              <p>Participant: {participant?.id || 'None'}</p>
              <p>Question: {currentQuestion?.id || 'None'}</p>
              <p>Answers: {currentQuestion?.answers?.length || 0}</p>
              
              {!participant && (
                <button
                  onClick={recoverParticipant}
                  className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >
                  Recover Participant Data
                </button>
              )}
              
              <button
                onClick={() => {
                  setHasAnswered(false)
                  setSelectedAnswer(null)
                  setShowResults(false)
                  toast.success('Answer state reset!')
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Reset Answer State
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Leaderboard
            </h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((entry) => (
                <div key={entry.player_name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500">#{entry.rank}</span>
                    <span className="font-medium">{entry.player_name}</span>
                    {participant?.player_name === entry.player_name && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  <span className="font-bold text-blue-600">{entry.total_score} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl text-center">
          <div className="mb-6">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiz Finished!</h1>
            <p className="text-gray-600">Final Results</p>
          </div>

          {participant && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-blue-800">
                Your Final Score: <strong>{participant.total_score} points</strong>
              </p>
            </div>
          )}

          {/* Winners List */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🏆 Winners</h2>
            <div className="space-y-3">
              {leaderboard.slice(0, 5).map((entry, index) => (
                <div key={entry.player_name} className={`flex justify-between items-center p-3 rounded-lg ${
                  index === 0 ? 'bg-yellow-50 border-2 border-yellow-200' :
                  index === 1 ? 'bg-gray-50 border-2 border-gray-200' :
                  index === 2 ? 'bg-amber-50 border-2 border-amber-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' :
                      'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-900">{entry.player_name}</span>
                    {participant?.player_name === entry.player_name && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  <span className="font-bold text-blue-600">{entry.total_score} pts</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default QuizPlayer 