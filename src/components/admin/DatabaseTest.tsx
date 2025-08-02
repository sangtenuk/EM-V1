import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function DatabaseTest() {
  const [testResults, setTestResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    const results: any = {}

    try {
      // Test 1: Check if we can connect to Supabase
      console.log('Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('events')
        .select('count')
        .limit(1)
      
      results.connection = testError ? { error: testError.message } : { success: true, data: testData }
      console.log('Connection test result:', results.connection)

      // Test 2: Check events table
      console.log('Testing events table...')
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, name, company_id')
        .limit(5)
      
      results.events = eventsError ? { error: eventsError.message } : { success: true, count: events?.length || 0, data: events }
      console.log('Events test result:', results.events)

      // Test 3: Check companies table
      console.log('Testing companies table...')
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .limit(5)
      
      results.companies = companiesError ? { error: companiesError.message } : { success: true, count: companies?.length || 0, data: companies }
      console.log('Companies test result:', results.companies)

      // Test 4: Check attendees table
      console.log('Testing attendees table...')
      const { data: attendees, error: attendeesError } = await supabase
        .from('attendees')
        .select('id, event_id, checked_in')
        .limit(5)
      
      results.attendees = attendeesError ? { error: attendeesError.message } : { success: true, count: attendees?.length || 0, data: attendees }
      console.log('Attendees test result:', results.attendees)

      setTestResults(results)
      toast.success('Database tests completed')
    } catch (error: any) {
      console.error('Test error:', error)
      toast.error('Database test failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Database Connection Test</h2>
      
      <button
        onClick={runTests}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
      >
        {loading ? 'Running Tests...' : 'Run Database Tests'}
      </button>

      {Object.keys(testResults).length > 0 && (
        <div className="space-y-4">
          {Object.entries(testResults).map(([testName, result]: [string, any]) => (
            <div key={testName} className="border rounded p-3">
              <h3 className="font-semibold capitalize">{testName}</h3>
              {result.error ? (
                <div className="text-red-600 text-sm">{result.error}</div>
              ) : (
                <div className="text-green-600 text-sm">
                  Success! {result.count !== undefined && `Count: ${result.count}`}
                  {result.data && (
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 