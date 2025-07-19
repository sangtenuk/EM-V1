import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Building2, Calendar, Users, QrCode, Monitor, Gift, Image, MapPin, BarChart3, Vote } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  children: React.ReactNode
  userCompany?: {
    company: {
      name: string
    }
  }
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: BarChart3 },
  { name: 'Events', href: '/admin/events', icon: Calendar },
  { name: 'Companies', href: '/admin/companies', icon: Building2 },
  { name: 'Attendees', href: '/admin/attendees', icon: Users },
  { name: 'Check-in', href: '/admin/checkin', icon: QrCode },
  { name: 'Seating', href: '/admin/seating', icon: MapPin },
  { name: 'Voting', href: '/admin/voting', icon: Vote },
  { name: 'Lucky Draw', href: '/admin/lucky-draw', icon: Gift },
  { name: 'Gallery', href: '/admin/gallery', icon: Image },
  { name: 'Welcome Monitor', href: '/admin/welcome-monitor', icon: Monitor },
  { name: 'Voting Monitor', href: '/admin/voting-monitor', icon: Monitor },
]

export default function Layout({ children, userCompany }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-64 lg:bg-white lg:shadow-lg lg:block">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Event Manager</h1>
            {userCompany && (
              <p className="text-sm text-blue-600 truncate px-2">{userCompany.company.name}</p>
            )}
          </div>
        </div>
        <nav className="mt-8 space-y-1 px-4">
          {navigation.filter(item => {
            if (userCompany && item.href === '/admin') return false
            return true
          }).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href || 
              (item.href !== '/admin' && location.pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Event Manager</h1>
            {userCompany && (
              <p className="text-xs text-blue-600 truncate">{userCompany.company.name}</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
        
        {/* Mobile navigation */}
        <div className="px-4 pb-3 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 gap-2 mt-3">
            {navigation.filter(item => {
              if (userCompany && item.href === '/admin') return false
              return true
            }).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="truncate text-center">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        <main className="flex-1 p-4 md:p-8 pt-32 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}