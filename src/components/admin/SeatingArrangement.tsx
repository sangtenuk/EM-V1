import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface VotingSession {
  id: string
  title: string
  description: string
  event: {
    name: string
    company: {
      name: string
    }
  }
}

export default function VotingMonitor() {
  const [votingSessions, setVotingSessions] = useState<VotingSession[]>([])

  useEffect(() => {
    fetchVotingSessions()
  }, [])

  const fetchVotingSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          title,
          description,
          event:events(
            name,
            company:companies(name)
          )
        `)

      if (error) throw error

      // Normalize company object
      const normalized = data.map((session: any) => ({
        ...session,
        event: {
          ...session.event,
          company: Array.isArray(session.event.company)
            ? session.event.company[0] ?? { name: '' }
            : session.event.company
        }
      }))

      setVotingSessions(normalized)
    } catch (error) {
      console.error('Error fetching voting sessions:', error)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Voting Monitor</h1>
      <ul className="space-y-4">
        {votingSessions.map((session) => (
          <li key={session.id} className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold">{session.title}</h2>
            <p className="text-gray-600">{session.description}</p>
            <p className="text-sm text-gray-500 mt-2">
              Event: {session.event.name} — {session.event.company?.name}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
