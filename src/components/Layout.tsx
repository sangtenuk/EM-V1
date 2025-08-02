import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Building2, Calendar, Users, QrCode, Monitor, Gift, Image, MapPin, BarChart3, Vote, Sparkles, Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useGlobalModeStore, HybridMode } from '../lib/globalModeStore';
import { useOfflineAuthStore } from '../lib/offlineAuthStore'
import GlobalSearch from './admin/GlobalSearch'


interface LayoutProps {
  children: React.ReactNode
  userCompany?: {
    company: {
      name: string
    }
  }
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: BarChart3, color: 'from-purple-500 to-pink-500' },
  { name: 'Companies', href: '/admin/companies', icon: Building2, color: 'from-blue-500 to-cyan-500' },
  { name: 'Events', href: '/admin/events', icon: Calendar, color: 'from-green-500 to-emerald-500' },
  { name: 'QR Generator', href: '/admin/qr-generator', icon: QrCode, color: 'from-emerald-500 to-green-500' },
  { name: 'Seating', href: '/admin/seating', icon: MapPin, color: 'from-pink-500 to-rose-500' },
  { name: 'Attendees', href: '/admin/attendees', icon: Users, color: 'from-orange-500 to-red-500' },
  { name: 'Check-in', href: '/admin/checkin', icon: QrCode, color: 'from-indigo-500 to-purple-500' },
  { name: 'Welcome Monitor', href: '/admin/welcome-monitor', icon: Monitor, color: 'from-blue-500 to-indigo-500' },
  { name: 'Welcome Scanner', href: '/admin/welcome-monitor-scanner', icon: Monitor, color: 'from-green-500 to-blue-500' },
  { name: 'Voting', href: '/admin/voting', icon: Vote, color: 'from-violet-500 to-purple-500' },
  { name: 'Voting Monitor', href: '/admin/voting-monitor', icon: Monitor, color: 'from-purple-500 to-indigo-500' },
  { name: 'Lucky Draw', href: '/admin/lucky-draw', icon: Gift, color: 'from-yellow-500 to-orange-500' },
  { name: 'Gallery', href: '/admin/gallery', icon: Image, color: 'from-teal-500 to-cyan-500' },
  
 
]

export default function Layout({ children, userCompany }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { mode, setMode } = useGlobalModeStore();
  const { currentUser: offlineUser, logoutOffline } = useOfflineAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    if (offlineUser) {
      logoutOffline()
      navigate('/')
    } else {
      await supabase.auth.signOut()
      navigate('/')
    }
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col bg-white border-r border-gray-200 shadow-lg">
          {/* Header */}
          <div className="flex h-20 items-center justify-between border-b border-gray-200 bg-blue-600 px-4">
            <div className="flex items-center">
              <Sparkles className="h-8 w-8 text-white mr-2" />
              <div>
                <a href="/">
                  <h1 className="text-xl font-bold text-white">EventPro</h1>
                </a>
                {userCompany && (
                  <p className="text-xs text-blue-100 truncate font-medium">{userCompany.company.name}</p>
                )}
                {offlineUser && (
                  <p className="text-xs text-blue-100 truncate font-medium">
                    {offlineUser.name} ({offlineUser.type})
                  </p>
                )}
                <h6 className="text-xs text-blue-100 truncate font-small">powered by <i>sangtenuk</i></h6>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={closeSidebar}
              className="lg:hidden p-2 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Data Mode Toggle (admin only) */}
          {!userCompany && (
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <label htmlFor="hybrid-mode-select" className="block text-xs font-bold text-gray-700 mb-1">Data Mode</label>
              <select
                id="hybrid-mode-select"
                value={mode}
                onChange={e => setMode(e.target.value as HybridMode)}
                className="w-full px-2 py-1 border border-gray-300 rounded-md text-gray-900 text-xs"
              >
                <option value="online">Online (Supabase)</option>
                <option value="offline">Offline (Local Only)</option>
                <option value="hybrid">Hybrid (Sync)</option>
              </select>
            </div>
          )}

          {/* Search */}
          <div className="px-4 py-2 border-b border-gray-200">
            <GlobalSearch userCompany={userCompany} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 p-4 overflow-y-auto">
            {navigation.filter(item => {
              // Hide Companies link for company users
              if (userCompany && item.href === '/admin/companies') return false
              
              // Filter based on offline user type
              if (offlineUser) {
                if (offlineUser.type === 'guest') {
                  // Guest users only see basic features
                  return ['/admin', '/admin/attendees', '/admin/checkin'].includes(item.href)
                } else if (offlineUser.type === 'admin') {
                  // Admin users see most features but not all
                  return !['/admin/companies'].includes(item.href)
                }
                // Superadmin sees everything
              }
              
              return true
            }).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={closeSidebar}
                  className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className={`p-2 rounded-lg mr-3 transition-colors ${
                    isActive 
                      ? 'bg-white bg-opacity-20' 
                      : 'bg-gray-100 group-hover:bg-white'
                  }`}>
                    <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'}`} />
                  </div>
                  <span className="truncate">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-gray-200/50">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-3 text-sm font-semibold text-gray-700 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-600 transition-all duration-300 group"
            >
              <div className="p-2 rounded-lg mr-3 bg-gray-100 group-hover:bg-red-100 transition-all duration-300">
                <LogOut className="h-5 w-5 text-gray-600 group-hover:text-red-600" />
              </div>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white shadow-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 mr-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Sparkles className="h-6 w-6 text-blue-600 mr-2" />
            <div>
              <a href="/">
                <h1 className="text-lg font-bold text-blue-600">
                  EventPro
                </h1>
              </a>
              {userCompany && (
                <p className="text-xs text-blue-600 font-medium truncate">{userCompany.company.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-300"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-30">
        <main className="flex-1 p-4 md:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
      

    </div>
  )
}