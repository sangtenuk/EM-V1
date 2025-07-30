import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import DemoNotice from './components/DemoNotice'
import Layout from './components/Layout'
import AuthPage from './components/auth/AuthPage'
import Dashboard from './components/admin/Dashboard'
import CompanyManagement from './components/admin/CompanyManagement'
import EventManagement from './components/admin/EventManagement'
import AttendeeManagement from './components/admin/AttendeeManagement'
import CheckInSystem from './components/admin/CheckInSystem'
import WelcomeMonitor from './components/admin/WelcomeMonitor'
import LuckyDraw from './components/admin/LuckyDraw'
import EventGallery from './components/admin/EventGallery'
import SeatingArrangement from './components/admin/SeatingArrangement'
import MonthlyProgress from './components/admin/MonthlyProgress'
import VotingAdmin from './components/admin/VotingAdmin'
import VotingMonitor from './components/admin/VotingMonitor'

import Registration from './components/public/Registration'
import Ticket from './components/public/Ticket'
import GalleryUpload from './components/public/GalleryUpload'
import VotingPage from './components/public/VotingPage'
import AttendeeVenueView from './components/public/AttendeeVenueView'
import CheckIn from './components/public/CheckIn'
import QRCodeGenerator from './components/admin/QRCodeGenerator'

function App() {
  const [user, setUser] = useState<any>(null)
  const [userCompany, setUserCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hasValidConfig, setHasValidConfig] = useState(true)

  useEffect(() => {
    // Check if Supabase is properly configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (
      !supabaseUrl ||
      !supabaseKey ||
      supabaseUrl.includes('your-project') ||
      supabaseKey.includes('your-anon-key')
    ) {
      setHasValidConfig(false)
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch((error) => {
        setHasValidConfig(false)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserCompany(session.user.id)
      } else {
        setUserCompany(null)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line
  }, [])

  const fetchUserCompany = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_users')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        return
      }

      setUserCompany(data)
    } catch (error) {}
  }

  // Show demo notice if Supabase isn't configured
  if (!hasValidConfig) {
    return <DemoNotice />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Router>
      <div className="App">
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/public/register/:eventId" element={<Registration />} />
          <Route path="/public/ticket/:attendeeId" element={<Ticket />} />
          <Route path="/public/checkin/:eventId" element={<CheckIn />} />
          <Route path="/public/gallery/:eventId" element={<GalleryUpload />} />
          <Route path="/public/voting/:sessionId" element={<VotingPage />} />
          <Route path="/public/venue/:eventId/:attendeeId" element={<AttendeeVenueView />} />

          {/* Auth Routes */}
          <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/admin" />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/*"
            element={
              user ? (
                <Layout userCompany={userCompany}>
                  <Routes>
                    <Route path="/" element={<Dashboard userCompany={userCompany} />} />
                    <Route path="/companies" element={<CompanyManagement />} />
                    <Route path="/events" element={<EventManagement userCompany={userCompany} />} />
                    <Route path="/progress" element={<MonthlyProgress />} />
                    <Route path="/attendees" element={<AttendeeManagement userCompany={userCompany} />} />
                    <Route path="/checkin" element={<CheckInSystem userCompany={userCompany} />} />
                    <Route path="/welcome-monitor" element={<WelcomeMonitor userCompany={userCompany} />} />
                    <Route path="/lucky-draw" element={<LuckyDraw userCompany={userCompany} />} />
                    <Route path="/gallery" element={<EventGallery userCompany={userCompany} />} />
                    <Route path="/seating" element={<SeatingArrangement userCompany={userCompany} />} />
                    <Route path="/qr-generator" element={<QRCodeGenerator userCompany={userCompany} />} />
                    <Route path="/attendees" element={<AttendeeManagement userCompany={userCompany} />} />
                    <Route path="/voting" element={<VotingAdmin userCompany={userCompany} />} />
                    <Route path="/voting-monitor" element={<VotingMonitor userCompany={userCompany} />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/auth" />
              )
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to={user ? '/admin' : '/auth'} />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App