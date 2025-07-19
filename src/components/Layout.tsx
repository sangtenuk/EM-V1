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
  { name: 'Monitor', href: '/admin/monitor', icon: Monitor },
]

export default function Layout({ children, userCompany }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:w-64 md:bg-white md:shadow-lg md:block">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Event Manager</h1>
            {userCompany && (
              <p className="text-sm text-blue-600">{userCompany.company.name}</p>
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
                {item.name}
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

      {/* Main content */}
      <div className="flex-1 md:ml-64">
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}