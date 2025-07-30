import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Building2, Calendar, Users, QrCode, Monitor, Gift, Image, MapPin, BarChart3, Vote, Sparkles, Palette } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useGlobalModeStore, HybridMode } from '../lib/globalModeStore';
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
  { name: 'Attendees', href: '/admin/attendees', icon: Users, color: 'from-orange-500 to-red-500' },
  { name: 'Check-in', href: '/admin/checkin', icon: QrCode, color: 'from-indigo-500 to-purple-500' },
  { name: 'QR Generator', href: '/admin/qr-generator', icon: QrCode, color: 'from-emerald-500 to-green-500' },
  { name: 'Seating', href: '/admin/seating', icon: MapPin, color: 'from-pink-500 to-rose-500' },
  { name: 'Voting', href: '/admin/voting', icon: Vote, color: 'from-violet-500 to-purple-500' },
  { name: 'Lucky Draw', href: '/admin/lucky-draw', icon: Gift, color: 'from-yellow-500 to-orange-500' },
  { name: 'Gallery', href: '/admin/gallery', icon: Image, color: 'from-teal-500 to-cyan-500' },
  { name: 'Welcome Monitor', href: '/admin/welcome-monitor', icon: Monitor, color: 'from-blue-500 to-indigo-500' },
  { name: 'Voting Monitor', href: '/admin/voting-monitor', icon: Monitor, color: 'from-purple-500 to-indigo-500' },
]

export default function Layout({ children, userCompany }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { mode, setMode } = useGlobalModeStore();

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-72 lg:block">
        <div className="flex h-full flex-col bg-white border-r border-gray-200 shadow-lg">
          {/* Header */}
          <div className="flex h-20 items-center justify-center border-b border-gray-200 bg-blue-600">
            <div className="text-center w-full">
              <div className="flex items-center justify-center mb-1">
                <Sparkles className="h-8 w-8 text-white mr-2" />
                <a href="/"> <h1 className="text-2xl font-bold text-white">EventPro</h1></a>
              </div>
              {userCompany && (
                <p className="text-sm text-blue-100 truncate px-2 font-medium">{userCompany.company.name}</p>
              )}
              <h6 className="text-sm text-blue-100 truncate px-10 font-small">powered by <i>sangtenuk</i></h6>
            </div>
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
              return true
            }).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center">
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
        
        {/* Mobile Navigation */}
        <div className="px-4 pb-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-3 gap-2 mt-3">
            {navigation.filter(item => {
              if (userCompany && item.href === '/admin/companies') return false
              return true
            }).slice(0, 9).map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center px-2 py-3 text-xs font-semibold rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="truncate text-center leading-tight">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 lg:ml-72">
        <main className="flex-1 p-4 md:p-8 pt-32 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}