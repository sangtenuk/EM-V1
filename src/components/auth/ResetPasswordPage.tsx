import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [isCheckingLink, setIsCheckingLink] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    let recoveryDetected = false

    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryDetected = true
        if (active) {
          setIsValid(true)
          setIsCheckingLink(false)
        }
      }
    }).data.subscription

    const validateRecoveryLink = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
        const hashType = hashParams.get('type')
        const authError = hashParams.get('error_description') || url.searchParams.get('error_description')

        if (authError) {
          throw new Error(decodeURIComponent(authError.replace(/\+/g, ' ')))
        }

        // Support Supabase PKCE links (?code=...) as well as implicit-flow recovery links (#type=recovery).
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          recoveryDetected = true
        } else if (hashType === 'recovery' && hashParams.get('access_token')) {
          // supabase-js reads implicit-flow tokens from the URL; give it a moment to establish the session.
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          recoveryDetected = Boolean(data.session)
        }

        if (!recoveryDetected) {
          throw new Error('This password reset link is invalid or expired. Please request a new one.')
        }

        if (active) {
          setIsValid(true)
          setIsCheckingLink(false)
        }
      } catch (error: unknown) {
        if (active) {
          setIsValid(false)
          setIsCheckingLink(false)
          toast.error(error instanceof Error ? error.message : 'Unable to validate the reset link.')
          window.setTimeout(() => navigate('/auth', { replace: true }), 2500)
        }
      }
    }

    void validateRecoveryLink()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData.session) {
        throw new Error('Your reset session has expired. Please request a new password reset link.')
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('Password updated successfully. Please sign in with your new password.')
      await supabase.auth.signOut()
      navigate('/auth', { replace: true })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not update password.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingLink) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <p className="text-gray-600">Validating password reset link...</p>
      </div>
    )
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center space-y-3">
          <p className="text-gray-700">This reset link is invalid or expired.</p>
          <button type="button" onClick={() => navigate('/auth')} className="text-blue-600 hover:text-blue-500 text-sm">
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create new password</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter and confirm your new password below</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">New password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="New password (minimum 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Updating password...' : 'Update password'}
          </button>
          <div className="text-center">
            <button type="button" onClick={() => navigate('/auth')} className="text-blue-600 hover:text-blue-500 text-sm">
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
