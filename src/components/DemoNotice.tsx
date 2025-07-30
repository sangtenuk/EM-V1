import { AlertCircle, Database, Settings } from 'lucide-react'

export default function DemoNotice() {
  console.log('DemoNotice component rendered')
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Database className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Management System</h1>
            <p className="text-gray-600">A comprehensive solution for managing events, attendees, and more</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Database Configuration Required</h3>
                <p className="text-yellow-700 mb-4">
                  This application requires a Supabase database to function. To get started:
                </p>
                <ol className="list-decimal list-inside text-yellow-700 space-y-2 text-sm">
                  <li>Create a free account at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a></li>
                  <li>Create a new project</li>
                  <li>Get your project URL and anon key from the API settings</li>
                  <li>Configure the environment variables in your deployment</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">✨ Features</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• Company & Event Management</li>
                <li>• Attendee Registration & Check-in</li>
                <li>• QR Code Generation</li>
                <li>• Seating Arrangements</li>
                <li>• Photo Gallery & Voting</li>
                <li>• Lucky Draw System</li>
                <li>• Real-time Monitoring</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">🛠️ Tech Stack</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li>• React + TypeScript</li>
                <li>• Tailwind CSS</li>
                <li>• Supabase (Database & Auth)</li>
                <li>• QR Code Generation</li>
                <li>• Real-time Updates</li>
                <li>• Responsive Design</li>
                <li>• PWA Ready</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <div className="bg-blue-50 rounded-lg p-6">
              <Settings className="h-8 w-8 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Deploy?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Set up your Supabase database and configure the environment variables to start using this application.
              </p>
              <div className="text-xs text-gray-500">
                <p>Environment variables needed:</p>
                <p className="font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}