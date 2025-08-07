import { useState, useEffect } from 'react' 
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useOfflineAuthStore } from '../../lib/offlineAuthStore'
import { useSyncStatusStore } from '../../lib/hybridDB'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [showOfflineMode, setShowOfflineMode] = useState(false)
  const navigate = useNavigate()
  
  const { isOnline } = useSyncStatusStore()
  const { 
    isOfflineMode, 
    setIsOfflineMode, 
    loginOffline, 
    logoutOffline, 
    currentUser: offlineUser 
  } = useOfflineAuthStore()

  // Check if we should show offline mode
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineMode(true)
      setIsOfflineMode(true) // Automatically switch to offline mode when no internet
    } else {
      setShowOfflineMode(false)
      setIsOfflineMode(false) // Switch back to online mode when internet is available
    }
  }, [isOnline, setIsOfflineMode])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isOfflineMode) {
        // Handle offline authentication - no password required
        const user = loginOffline(email, '')
        if (user) {
          setIsOfflineMode(true)
          toast.success(`Welcome ${user.name}!`)
          navigate('/admin')
        } else {
          toast.error('Invalid offline credentials')
        }
      } else {
        // Handle online authentication
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
          })
          if (error) throw error
          toast.success('Account created successfully!')
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error
          navigate('/admin')
        }
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isOfflineMode ? 'Offline Mode' : (isSignUp ? 'Create your account' : 'Sign in to your account')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isOfflineMode ? 'No internet connection detected' : 'Event Management System'}
          </p>
          {showOfflineMode && !isOfflineMode && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                No internet connection. You can use offline mode with these accounts:
              </p>
              <div className="mt-2 text-xs text-yellow-700">
                <p><strong>Super Admin:</strong> admin@offline (no password)</p>
                <p><strong>Admin:</strong> admin@offline.com (no password)</p>
                <p><strong>Guest:</strong> guest@offline.com (no password)</p>
              </div>
              <button
                onClick={() => setIsOfflineMode(true)}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
              >
                Switch to Offline Mode
              </button>
              <button
                onClick={() => setIsOfflineMode(false)}
                className="mt-2 ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Switch to Online Mode
              </button>
            </div>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isOfflineMode && (
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : (isSignUp ? 'Sign up' : 'Sign in')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}