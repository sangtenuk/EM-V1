import { useState, useEffect } from 'react'
import { QrCode, Download, Copy, Settings, Globe, Wifi } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import QRCodeLib from 'qrcode'

interface Event {
  id: string
  name: string
  company_id: string
  company: {
    name: string
  }
}

interface QRCodeConfig {
  eventId: string
  customUrl: string
  qrType: 'registration' | 'checkin' | 'gallery' | 'voting' | 'venue'
  useLocalIP: boolean
  localIP: string
  port: string
}

interface QRCodeGeneratorProps {
  userCompany?: any
}

export default function QRCodeGenerator({ userCompany }: QRCodeGeneratorProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [qrConfig, setQrConfig] = useState<QRCodeConfig>({
    eventId: '',
    customUrl: '',
    qrType: 'registration',
    useLocalIP: false,
    localIP: '',
    port: '3000'
  })

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      setQrConfig(prev => ({ ...prev, eventId: selectedEventId }))
    }
  }, [selectedEventId])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      let query = supabase.from('events').select(`
          id,
          name,
          company_id,
          company:companies(name)
        `)

      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      
      const transformedData = data?.map(event => ({
        ...event,
        company: Array.isArray(event.company) ? event.company[0] : event.company
      })) || []
      
      setEvents(transformedData)

      if (userCompany && transformedData && transformedData.length > 0) {
        setSelectedEventId(transformedData[0].id)
      }
    } catch (error: any) {
      toast.error('Error fetching events: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getLocalIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (error) {
      console.error('Error getting local IP:', error)
      return '192.168.1.100' // Fallback IP
    }
  }

  const generateQRCode = async () => {
    if (!qrConfig.eventId) {
      toast.error('Please select an event')
      return
    }

    try {
      let baseUrl = ''
      
      if (qrConfig.useLocalIP) {
        // Use local IP with custom port
        baseUrl = `http://${qrConfig.localIP}:${qrConfig.port}`
      } else {
        // Use current domain
        baseUrl = window.location.origin
      }

      let endpoint = ''
      switch (qrConfig.qrType) {
        case 'registration':
          endpoint = `/public/register/${qrConfig.eventId}`
          break
        case 'checkin':
          endpoint = `/public/checkin/${qrConfig.eventId}`
          break
        case 'gallery':
          endpoint = `/public/gallery/${qrConfig.eventId}`
          break
        case 'voting':
          endpoint = `/public/voting/${qrConfig.eventId}`
          break
        case 'venue':
          endpoint = `/public/venue/${qrConfig.eventId}`
          break
      }

      const fullUrl = baseUrl + endpoint
      
      const qrCodeDataUrl = await QRCodeLib.toDataURL(fullUrl, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setQrCodeDataUrl(qrCodeDataUrl)
      toast.success('QR Code generated successfully!')
    } catch (error: any) {
      toast.error('Error generating QR code: ' + error.message)
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return
    
    const link = document.createElement('a')
    link.download = `qr-${qrConfig.qrType}-${qrConfig.eventId}.png`
    link.href = qrCodeDataUrl
    link.click()
  }

  const copyQRCodeLink = async () => {
    if (!qrCodeDataUrl) return
    
    try {
      await navigator.clipboard.writeText(qrCodeDataUrl)
      toast.success('QR Code image URL copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy QR code')
    }
  }

  const copyGeneratedURL = async () => {
    if (!qrConfig.eventId) return
    
    let baseUrl = ''
    if (qrConfig.useLocalIP) {
      baseUrl = `http://${qrConfig.localIP}:${qrConfig.port}`
    } else {
      baseUrl = window.location.origin
    }

    let endpoint = ''
    switch (qrConfig.qrType) {
      case 'registration':
        endpoint = `/public/register/${qrConfig.eventId}`
        break
      case 'checkin':
        endpoint = `/public/checkin/${qrConfig.eventId}`
        break
      case 'gallery':
        endpoint = `/public/gallery/${qrConfig.eventId}`
        break
      case 'voting':
        endpoint = `/public/voting/${qrConfig.eventId}`
        break
      case 'venue':
        endpoint = `/public/venue/${qrConfig.eventId}`
        break
    }

    const fullUrl = baseUrl + endpoint
    
    try {
      await navigator.clipboard.writeText(fullUrl)
      toast.success('URL copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy URL')
    }
  }

  const detectLocalIP = async () => {
    const ip = await getLocalIP()
    setQrConfig(prev => ({ ...prev, localIP: ip }))
    toast.success('Local IP detected: ' + ip)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">QR Code Generator</h1>
          <p className="text-gray-600 mt-2">Create custom QR codes for your events with local network support</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            QR Code Configuration
          </h2>

          <div className="space-y-6">
            {/* Event Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Event
              </label>
              {events.length === 0 ? (
                <div className="w-full px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800">
                  No events found. Create an event first.
                </div>
              ) : (
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {userCompany ? event.name : `${event.name} (${event.company.name})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* QR Code Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code Type
              </label>
              <select
                value={qrConfig.qrType}
                onChange={(e) => setQrConfig(prev => ({ ...prev, qrType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="registration">Registration</option>
                <option value="checkin">Check-In</option>
                <option value="gallery">Gallery Upload</option>
                <option value="voting">Voting</option>
                <option value="venue">Venue Layout</option>
              </select>
            </div>

            {/* URL Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL Configuration
              </label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useLocalIP"
                    checked={qrConfig.useLocalIP}
                    onChange={(e) => setQrConfig(prev => ({ ...prev, useLocalIP: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="useLocalIP" className="text-sm text-gray-700">
                    Use Local Network IP
                  </label>
                </div>

                {qrConfig.useLocalIP && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Local IP Address
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={qrConfig.localIP}
                          onChange={(e) => setQrConfig(prev => ({ ...prev, localIP: e.target.value }))}
                          placeholder="192.168.1.100"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={detectLocalIP}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                          title="Detect Local IP"
                        >
                          <Wifi className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port Number
                      </label>
                      <input
                        type="text"
                        value={qrConfig.port}
                        onChange={(e) => setQrConfig(prev => ({ ...prev, port: e.target.value }))}
                        placeholder="3000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Generated URL:</strong><br />
                    {qrConfig.useLocalIP 
                      ? `http://${qrConfig.localIP}:${qrConfig.port}/public/${qrConfig.qrType}/${qrConfig.eventId}`
                      : `${window.location.origin}/public/${qrConfig.qrType}/${qrConfig.eventId}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateQRCode}
              disabled={!selectedEventId}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <QrCode className="h-5 w-5 mr-2" />
              Generate QR Code
            </button>
          </div>
        </div>

        {/* QR Code Display */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center">
            <QrCode className="h-5 w-5 mr-2" />
            Generated QR Code
          </h2>

          {qrCodeDataUrl ? (
            <div className="space-y-4">
              <div className="text-center">
                <img 
                  src={qrCodeDataUrl} 
                  alt="Generated QR Code" 
                  className="mx-auto border-2 border-gray-200 rounded-lg shadow-lg"
                />
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={downloadQRCode}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={copyQRCodeLink}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Image URL
                </button>
                <button
                  onClick={copyGeneratedURL}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Copy URL
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Generate a QR code to see it here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 