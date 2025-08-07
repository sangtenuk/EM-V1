import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import { Plus, Play, Eye, Pencil, Trash, Users, QrCode, RotateCcw, Pause, Square, Brain, RefreshCw } from 'lucide-react'
import { generateQuizQRCode } from '../../lib/quizQRGenerator'

interface QuizSession {
  id: string
  event_id: string
  title: string
  description: string | null
  qr_code_url: string | null
  status: 'waiting' | 'active' | 'paused' | 'finished'
  current_question_index: number
  host_id: string | null
  created_at: string
  updated_at: string
  event?: {
    name: string
  }
  _count?: {
    questions: number
    participants: number
  }
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

interface QuizManagementProps {
  userCompany: any
}

const QuizManagement: React.FC<QuizManagementProps> = ({ userCompany }) => {
  const [sessions, setSessions] = useState<QuizSession[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showQuestionsModal, setShowQuestionsModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

  // Form states
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    event_id: ''
  })

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'multiple_choice' as const,
    time_limit: 30,
    points: 10,
    media_url: '',
    answers: [
      { answer_text: '', is_correct: false, order_index: 0 },
      { answer_text: '', is_correct: false, order_index: 1 },
      { answer_text: '', is_correct: false, order_index: 2 },
      { answer_text: '', is_correct: false, order_index: 3 }
    ]
  })

  useEffect(() => {
    fetchSessions()
    fetchEvents()
  }, [userCompany])

  // Real-time subscription for quiz session changes
  useEffect(() => {
    const subscription = supabase
      .channel('quiz-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_sessions'
        },
        (payload) => {
          console.log('Quiz session change detected:', payload)
          
          if (payload.eventType === 'DELETE') {
            // Remove the deleted session from state immediately
            setSessions(prev => prev.filter(s => s.id !== payload.old.id))
            console.log('Session removed from state:', payload.old.id)
          } else {
            // Refresh sessions for other changes
            fetchSessions()
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchSessions = async () => {
    try {
      console.log('Fetching sessions...')
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          event:events(name),
          _count:quiz_questions(count),
          participants:quiz_participants(count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('Fetched sessions:', data)
      setSessions(data || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Failed to fetch quiz sessions')
    } finally {
      setLoading(false)
    }
  }

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const fetchQuestions = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          answers:quiz_answers(*)
        `)
        .eq('session_id', sessionId)
        .order('order_index')

      if (error) throw error
      setQuestions(data || [])
    } catch (error) {
      console.error('Error fetching questions:', error)
      toast.error('Failed to fetch questions')
    }
  }

  const createSession = async () => {
    if (!sessionForm.title || !sessionForm.event_id) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert({
          title: sessionForm.title,
          description: sessionForm.description,
          event_id: sessionForm.event_id,
          host_id: user?.id || null
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Generate QR code
      try {
        const { qrCodeUrl } = await generateQuizQRCode(sessionData.id, sessionData.title)
        
        await supabase
          .from('quiz_sessions')
          .update({ qr_code_url: qrCodeUrl })
          .eq('id', sessionData.id)
      } catch (qrError) {
        console.error('Error generating QR code:', qrError)
      }

      toast.success('Quiz session created successfully')
      setShowCreateModal(false)
      setSessionForm({ title: '', description: '', event_id: '' })
      fetchSessions()
    } catch (error) {
      console.error('Error creating session:', error)
      toast.error('Failed to create quiz session')
    }
  }

  const createQuestion = async () => {
    if (!selectedSession || !questionForm.question_text) {
      toast.error('Please fill in all required fields')
      return
    }

    // Validate answers
    const validAnswers = questionForm.answers.filter(a => a.answer_text.trim())
    if (validAnswers.length < 2) {
      toast.error('Please provide at least 2 answers')
      return
    }

    const correctAnswers = validAnswers.filter(a => a.is_correct)
    if (correctAnswers.length !== 1) {
      toast.error('Please select exactly one correct answer')
      return
    }

    try {
      // Create question
      const { data: question, error: questionError } = await supabase
        .from('quiz_questions')
        .insert({
          session_id: selectedSession.id,
          question_text: questionForm.question_text,
          question_type: questionForm.question_type,
          time_limit: questionForm.time_limit,
          points: questionForm.points,
          order_index: questions.length,
          media_url: questionForm.media_url || null
        })
        .select()
        .single()

      if (questionError) throw questionError

      // Create answers
      const answersToInsert = validAnswers.map((answer, index) => ({
        question_id: question.id,
        answer_text: answer.answer_text,
        is_correct: answer.is_correct,
        order_index: index
      }))

      const { error: answersError } = await supabase
        .from('quiz_answers')
        .insert(answersToInsert)

      if (answersError) throw answersError

      toast.success('Question created successfully')
      setQuestionForm({
        question_text: '',
        question_type: 'multiple_choice',
        time_limit: 30,
        points: 10,
        media_url: '',
        answers: [
          { answer_text: '', is_correct: false, order_index: 0 },
          { answer_text: '', is_correct: false, order_index: 1 },
          { answer_text: '', is_correct: false, order_index: 2 },
          { answer_text: '', is_correct: false, order_index: 3 }
        ]
      })
      fetchQuestions(selectedSession.id)
    } catch (error) {
      console.error('Error creating question:', error)
      toast.error('Failed to create question')
    }
  }

  const startSession = async (session: QuizSession) => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ status: 'active' })
        .eq('id', session.id)

      if (error) throw error

      toast.success('Quiz session started')
      fetchSessions()
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
      fetchSessions()
    } catch (error) {
      console.error('Error pausing session:', error)
      toast.error('Failed to pause session')
    }
  }

  const resetSession = async (session: QuizSession) => {
    if (!confirm('Are you sure you want to reset this session? This will remove all participants and responses.')) return

    try {
      // Delete all participants and responses
      await supabase
        .from('quiz_responses')
        .delete()
        .eq('session_id', session.id)

      await supabase
        .from('quiz_participants')
        .delete()
        .eq('session_id', session.id)

      // Reset session
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'waiting',
          current_question_index: 0
        })
        .eq('id', session.id)

      if (error) throw error

      toast.success('Session reset successfully')
      fetchSessions()
    } catch (error) {
      console.error('Error resetting session:', error)
      toast.error('Failed to reset session')
    }
  }

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This will also delete all answers and responses.')) return

    try {
      console.log('Deleting question:', questionId)
      
      // Delete all responses for this question
      const { error: responsesError } = await supabase
        .from('quiz_responses')
        .delete()
        .eq('question_id', questionId)

      if (responsesError) {
        console.error('Error deleting responses:', responsesError)
        throw responsesError
      }

      // Delete all answers for this question
      const { error: answersError } = await supabase
        .from('quiz_answers')
        .delete()
        .eq('question_id', questionId)

      if (answersError) {
        console.error('Error deleting answers:', answersError)
        throw answersError
      }

      // Delete the question
      const { error: questionError } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId)

      if (questionError) {
        console.error('Error deleting question:', questionError)
        throw questionError
      }

      console.log('Question deleted successfully')
      toast.success('Question deleted successfully')
      
      // Refresh questions if we have a selected session
      if (selectedSession) {
        fetchQuestions(selectedSession.id)
      }
    } catch (error) {
      console.error('Error deleting question:', error)
      toast.error('Failed to delete question')
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this quiz session? This will also delete all questions, answers, participants, and responses.')) return

    try {
      console.log('Deleting session:', sessionId)
      
      // Since all foreign keys have ON DELETE CASCADE, we can just delete the session directly
      // This should automatically delete all related data
      console.log('Attempting to delete session with ID:', sessionId)
      
      const { data: deleteResult, error: sessionError } = await supabase
        .from('quiz_sessions')
        .delete()
        .eq('id', sessionId)
        .select()

      console.log('Delete result:', deleteResult)
      console.log('Delete error:', sessionError)

      if (sessionError) {
        console.error('Error deleting session:', sessionError)
        throw sessionError
      }

      if (!deleteResult || deleteResult.length === 0) {
        console.error('No session was deleted')
        throw new Error('No session was deleted - session may not exist or you may not have permission')
      }

      console.log('Session deleted successfully')
      toast.success('Quiz session deleted successfully')
      
      // Force immediate refresh and wait for it to complete
      await fetchSessions()
      
      // Clear any selected session if it was the deleted one
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null)
        setQuestions([])
      }
      
      // Force a re-render by updating the sessions state
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Failed to delete session: ' + (error as any).message)
    }
  }

  const showQRCode = (session: QuizSession) => {
    setSelectedSession(session)
    setShowQRModal(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quiz Administration</h1>
          <p className="text-gray-600 mt-2">Manage quiz sessions and questions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchSessions()}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!userCompany}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Quiz Session
          </button>
        </div>
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
                value={sessionForm.event_id}
                onChange={(e) => setSessionForm({ ...sessionForm, event_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Quiz Session
            </label>
            <select
              value={selectedSession?.id || ''}
              onChange={(e) => {
                const session = sessions.find(s => s.id === e.target.value)
                setSelectedSession(session || null)
                if (session) {
                  fetchQuestions(session.id)
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a quiz session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} {session.status !== 'waiting' && `(${session.status})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quiz Sessions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Brain className="h-6 w-6 mr-2" />
            Quiz Sessions
          </h2>
          
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className={`p-4 border rounded-lg ${
                session.status === 'active' ? 'border-green-500 bg-green-50' : 
                session.status === 'paused' ? 'border-yellow-500 bg-yellow-50' :
                session.status === 'finished' ? 'border-red-500 bg-red-50' :
                'border-gray-200'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{session.title}</h3>
                    {session.description && (
                      <p className="text-sm text-gray-600">{session.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => showQRCode(session)}
                      className="text-purple-600 hover:text-purple-700"
                      title="Show QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    {session.status === 'waiting' && (
                      <button
                        onClick={() => startSession(session)}
                        className="text-green-600 hover:text-green-700"
                        title="Start Session"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {session.status === 'active' && (
                      <button
                        onClick={() => pauseSession(session)}
                        className="text-yellow-600 hover:text-yellow-700"
                        title="Pause Session"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {session.status === 'paused' && (
                      <button
                        onClick={() => startSession(session)}
                        className="text-green-600 hover:text-green-700"
                        title="Resume Session"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => resetSession(session)}
                      className="text-orange-600 hover:text-orange-700"
                      title="Reset Session"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete Session"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Created {new Date(session.created_at).toLocaleDateString()}
                  <span className="ml-2">• Questions: {session._count?.questions || 0}</span>
                  <span className="ml-2">• Participants: {session._count?.participants || 0}</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    session.status === 'active' ? 'bg-green-100 text-green-800' :
                    session.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    session.status === 'finished' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
            
            {sessions.length === 0 && sessionForm.event_id && (
              <div className="text-center py-8 text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No quiz sessions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Questions Management */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center">
                <Pencil className="h-6 w-6 mr-2" />
                Quiz Questions
              </h2>
              <div className="flex space-x-2">
                {questions.length > 0 && (
                  <button
                    onClick={() => resetSession(selectedSession!)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center"
                    title="Reset all participants and responses for this session"
                    disabled={!selectedSession}
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Reset Session
                  </button>
                )}
                <button
                  onClick={() => setShowQuestionsModal(true)}
                  disabled={!selectedSession}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Question
                </button>
              </div>
            </div>

            {selectedSession && selectedSession.qr_code_url && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-900 mb-2">Quiz QR Code</h3>
                    <p className="text-sm text-blue-700">Share this QR code for attendees to join</p>
                    <p className="text-xs text-blue-600 mt-1">URL: {window.location.origin}/public/quiz-play/{selectedSession.id}</p>
                  </div>
                  <div className="text-center">
                    <img src={selectedSession.qr_code_url} alt="Quiz QR Code" className="w-24 h-24 border rounded-lg mx-auto mb-2" />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/public/quiz-play/${selectedSession.id}`)
                        toast.success('Quiz URL copied to clipboard!')
                      }}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      Copy URL
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {questions.length > 0 ? (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">Question {index + 1}</h3>
                        <p className="text-gray-700 mt-1">{question.question_text}</p>
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                          <span>Type: {question.question_type}</span>
                          <span>Time: {question.time_limit}s</span>
                          <span>Points: {question.points}</span>
                        </div>
                        {question.media_url && (
                          <div className="mt-2">
                            <span className="text-sm text-gray-500">Media: </span>
                            <a href={question.media_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View Media
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => deleteQuestion(question.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete question"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <h5 className="font-medium text-sm mb-2">Answers:</h5>
                      <div className="space-y-1">
                        {question.answers.map((answer) => (
                          <div key={answer.id} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${answer.is_correct ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className={answer.is_correct ? 'font-medium text-green-700' : 'text-gray-600'}>
                              {answer.answer_text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedSession ? (
              <div className="text-center py-12 text-gray-500">
                <Pencil className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>No questions added yet</p>
                <p className="text-sm">Add questions for attendees to answer</p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Brain className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a quiz session to manage questions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Quiz Session</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Title *
                </label>
                <input
                  type="text"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter session title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Enter session description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event *
                </label>
                <select
                  value={sessionForm.event_id}
                  onChange={(e) => setSessionForm({ ...sessionForm, event_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createSession}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions Modal */}
      {showQuestionsModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage Questions - {selectedSession.title}</h2>
              <button
                onClick={() => setShowQuestionsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Add New Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Text *
                  </label>
                  <textarea
                    value={questionForm.question_text}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Enter your question"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question Type
                    </label>
                    <select
                      value={questionForm.question_type}
                      onChange={(e) => setQuestionForm({ ...questionForm, question_type: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True/False</option>
                      <option value="timed">Timed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Limit (seconds)
                    </label>
                    <input
                      type="number"
                      value={questionForm.time_limit}
                      onChange={(e) => setQuestionForm({ ...questionForm, time_limit: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      min="5"
                      max="300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points
                    </label>
                    <input
                      type="number"
                      value={questionForm.points}
                      onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Media URL (optional)
                  </label>
                  <input
                    type="url"
                    value={questionForm.media_url}
                    onChange={(e) => setQuestionForm({ ...questionForm, media_url: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Answers *
                  </label>
                  <div className="space-y-2">
                    {questionForm.answers.map((answer, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct_answer"
                          checked={answer.is_correct}
                          onChange={() => {
                            const newAnswers = questionForm.answers.map((a, i) => ({
                              ...a,
                              is_correct: i === index
                            }))
                            setQuestionForm({ ...questionForm, answers: newAnswers })
                          }}
                          className="text-blue-600"
                        />
                        <input
                          type="text"
                          value={answer.answer_text}
                          onChange={(e) => {
                            const newAnswers = [...questionForm.answers]
                            newAnswers[index].answer_text = e.target.value
                            setQuestionForm({ ...questionForm, answers: newAnswers })
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                          placeholder={`Answer ${index + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={createQuestion}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Question
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Existing Questions</h3>
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">Question {index + 1}</h4>
                        <p className="text-gray-700 mt-1">{question.question_text}</p>
                        <div className="flex gap-4 mt-2 text-sm text-gray-500">
                          <span>Type: {question.question_type}</span>
                          <span>Time: {question.time_limit}s</span>
                          <span>Points: {question.points}</span>
                        </div>
                        {question.media_url && (
                          <div className="mt-2">
                            <span className="text-sm text-gray-500">Media: </span>
                            <a href={question.media_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View Media
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <h5 className="font-medium text-sm mb-2">Answers:</h5>
                      <div className="space-y-1">
                        {question.answers.map((answer) => (
                          <div key={answer.id} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${answer.is_correct ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className={answer.is_correct ? 'font-medium text-green-700' : 'text-gray-600'}>
                              {answer.answer_text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-gray-500">No QR code generated yet</p>
                </div>
              )}
              
              <div className="bg-blue-100 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-blue-900">Quiz Information</h3>
                <p className="text-sm text-blue-700 mt-2">
                  Attendees can scan this QR code to join and play this quiz directly.
                </p>
              </div>

              <button
                onClick={() => setShowQRModal(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuizManagement 