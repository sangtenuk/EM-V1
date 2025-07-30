import { useState, useEffect, useRef } from 'react'
import { Search, X, Calendar, Users, Building2, QrCode, Image, Vote, Gift, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle: string
  route: string
  icon: any
  color: string
}

interface GlobalSearchProps {
  userCompany?: any
}

const SEARCH_SECTIONS = [
  { key: 'events', label: 'Events', icon: Calendar, color: 'text-green-600', route: '/admin/events' },
  { key: 'attendees', label: 'Attendees', icon: Users, color: 'text-blue-600', route: '/admin/attendees' },
  { key: 'companies', label: 'Companies', icon: Building2, color: 'text-purple-600', route: '/admin/companies' },
  { key: 'checkin', label: 'Check-in', icon: QrCode, color: 'text-indigo-600', route: '/admin/checkin' },
  { key: 'gallery', label: 'Gallery', icon: Image, color: 'text-teal-600', route: '/admin/gallery' },
  { key: 'voting', label: 'Voting', icon: Vote, color: 'text-violet-600', route: '/admin/voting' },
  { key: 'luckydraw', label: 'Lucky Draw', icon: Gift, color: 'text-orange-600', route: '/admin/lucky-draw' },
  { key: 'seating', label: 'Seating', icon: MapPin, color: 'text-pink-600', route: '/admin/seating' },
]

export default function GlobalSearch({ userCompany }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (query.trim()) {
      performSearch()
    } else {
      setResults([])
    }
  }, [query])

  const performSearch = async () => {
    setLoading(true)
    const searchTerm = query.toLowerCase().trim()
    const searchResults: SearchResult[] = []

    try {
      // Search Events
      if (searchTerm.length >= 2) {
        let eventsQuery = supabase
          .from('events')
          .select('id, name, company:companies(name)')
          .ilike('name', `%${searchTerm}%`)

        if (userCompany) {
          eventsQuery = eventsQuery.eq('company_id', userCompany.company_id)
        }

        const { data: events } = await eventsQuery
        if (events) {
          events.forEach((event: any) => {
            const companyName = Array.isArray(event.company) 
              ? event.company[0]?.name 
              : event.company?.name
            searchResults.push({
              id: event.id,
              type: 'event',
              title: event.name,
              subtitle: `Event • ${companyName || 'Unknown Company'}`,
              route: `/admin/events`,
              icon: Calendar,
              color: 'text-green-600'
            })
          })
        }
      }

      // Search Attendees
      if (searchTerm.length >= 2) {
        let attendeesQuery = supabase
          .from('attendees')
          .select('id, name, event:events(name, company:companies(name))')
          .ilike('name', `%${searchTerm}%`)

        if (userCompany) {
          attendeesQuery = attendeesQuery.eq('event.company_id', userCompany.company_id)
        }

        const { data: attendees } = await attendeesQuery
        if (attendees) {
          attendees.forEach((attendee: any) => {
            const eventName = Array.isArray(attendee.event) 
              ? attendee.event[0]?.name 
              : attendee.event?.name
            searchResults.push({
              id: attendee.id,
              type: 'attendee',
              title: attendee.name,
              subtitle: `Attendee • ${eventName || 'Unknown Event'}`,
              route: `/admin/attendees`,
              icon: Users,
              color: 'text-blue-600'
            })
          })
        }
      }

      // Search Companies (admin only)
      if (!userCompany && searchTerm.length >= 2) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .ilike('name', `%${searchTerm}%`)

        if (companies) {
          companies.forEach(company => {
            searchResults.push({
              id: company.id,
              type: 'company',
              title: company.name,
              subtitle: 'Company',
              route: `/admin/companies`,
              icon: Building2,
              color: 'text-purple-600'
            })
          })
        }
      }

      // Add section shortcuts
      SEARCH_SECTIONS.forEach(section => {
        if (section.label.toLowerCase().includes(searchTerm)) {
          searchResults.push({
            id: section.key,
            type: 'section',
            title: section.label,
            subtitle: 'Navigation Section',
            route: section.route,
            icon: section.icon,
            color: section.color
          })
        }
      })

      setResults(searchResults.slice(0, 10)) // Limit to 10 results
    } catch (error: any) {
      toast.error('Search error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route)
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Search className="h-5 w-5 mr-2" />
        <span className="hidden md:inline">Search...</span>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            {/* Search Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Search className="h-5 w-5 text-gray-400 mr-3" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search events, attendees, companies, or sections..."
                  className="flex-1 outline-none text-lg"
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="ml-3 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Searching...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="p-2">
                  {results.map((result, index) => {
                    const Icon = result.icon
                    return (
                      <button
                        key={`${result.type}-${result.id}-${index}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg mr-3 ${result.color} bg-gray-100 group-hover:bg-gray-200`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{result.title}</div>
                            <div className="text-sm text-gray-500">{result.subtitle}</div>
                          </div>
                          <div className="text-xs text-gray-400 group-hover:text-gray-600">
                            {result.type}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : query ? (
                <div className="p-8 text-center">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No results found for "{query}"</p>
                  <p className="text-sm text-gray-400 mt-1">Try different keywords</p>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Start typing to search...</p>
                  <p className="text-sm text-gray-400 mt-1">Search events, attendees, companies, or sections</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {!query && (
              <div className="p-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SEARCH_SECTIONS.map((section) => {
                    const Icon = section.icon
                    return (
                      <button
                        key={section.key}
                        onClick={() => handleResultClick({
                          id: section.key,
                          type: 'section',
                          title: section.label,
                          subtitle: 'Navigation Section',
                          route: section.route,
                          icon: section.icon,
                          color: section.color
                        })}
                        className="flex items-center p-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
                      >
                        <Icon className={`h-4 w-4 mr-2 ${section.color}`} />
                        <span className="text-sm font-medium">{section.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 