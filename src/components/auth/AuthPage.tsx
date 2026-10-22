import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Keep password-reset links on the production app, not an old hosting domain.
const APP_URL = (import.meta.env.VITE_APP_URL || 'https://eventmanagement.tenukians.workers.dev').replace(/\/$/, '')

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const navigate = useNavigate()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${APP_URL}/auth` },
        })
        if (error) throw error
        toast.success('Account created successfully! Check your email if confirmation is required.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/admin')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${APP_URL}/auth/reset-password`,
      })
      if (error) throw error
      toast.success('If an account exists for this email, a password reset link will be sent.')
      setIsForgotPassword(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not request a password reset.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isForgotPassword ? 'Reset your password' : (isSignUp ? 'Create your account' : 'Sign in to your account')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isForgotPassword ? 'Enter your email to receive a secure reset link' : 'Event Management System'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={isForgotPassword ? handleForgotPassword : handleAuth}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                  className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Password (minimum 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : (isForgotPassword ? 'Send reset link' : (isSignUp ? 'Sign up' : 'Sign in'))}
          </button>

          <div className="text-center space-y-2">
            {!isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                className="block w-full text-blue-600 hover:text-blue-500 text-sm"
              >
                Forgot your password?
              </button>
            )}
            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="block w-full text-blue-600 hover:text-blue-500 text-sm"
              >
                Back to sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="block w-full text-blue-600 hover:text-blue-500 text-sm"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
