import { useState, useEffect } from 'react'
import { QrCode, Download, Copy, Settings, Globe, Wifi, RefreshCw } from 'lucide-react'
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
  publicIP: string
  ipType: 'network' | 'public' | 'localhost'
  port: string
}

interface QRCodeGeneratorProps {
  userCompany?: any
}

export default function QRCodeGenerator({ userCompany }: QRCodeGeneratorProps) {
  const getCurrentPort = () => {
    return window.location.port || '5174' // Default to 5174 if no port detected
  }

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
    publicIP: '',
    ipType: 'localhost',
    port: getCurrentPort()
  })

  useEffect(() => {
    fetchEvents()
    // Auto-detect IP and port on component mount
    autoDetectNetworkSettings()
  }, [])

  const autoDetectNetworkSettings = async () => {
    try {
      console.log('Starting network settings auto-detection...')
      
      // Auto-detect both network and public IPs with better error handling
      const [networkIP, publicIP] = await Promise.allSettled([
        detectLocalNetworkIP(),
        getPublicIP()
      ])
      
      const currentPort = getCurrentPort()
      const resolvedNetworkIP = networkIP.status === 'fulfilled' ? networkIP.value : '192.168.1.100'
      const resolvedPublicIP = publicIP.status === 'fulfilled' ? (publicIP.value || resolvedNetworkIP) : resolvedNetworkIP
      
      setQrConfig(prev => ({
        ...prev,
        localIP: resolvedNetworkIP,
        publicIP: resolvedPublicIP,
        port: currentPort
      }))
      
      console.log('Auto-detected network settings:', { 
        networkIP: resolvedNetworkIP, 
        publicIP: resolvedPublicIP, 
        port: currentPort 
      })
      
      // Provide user feedback based on what was detected
      if (networkIP.status === 'fulfilled' && publicIP.status === 'fulfilled') {
        console.log('✅ Both network and public IPs detected successfully')
      } else if (networkIP.status === 'fulfilled') {
        console.log('⚠️ Network IP detected, public IP failed')
      } else if (publicIP.status === 'fulfilled') {
        console.log('⚠️ Public IP detected, network IP failed')
      } else {
        console.log('❌ Both IP detections failed, using fallback')
      }
      
    } catch (error) {
      console.error('Error auto-detecting network settings:', error)
      // Set fallback values
      setQrConfig(prev => ({
        ...prev,
        localIP: '192.168.1.100',
        publicIP: '192.168.1.100',
        port: getCurrentPort()
      }))
    }
  }

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

  const getNetworkIP = async () => {
    try {
      // Try to get local network IP using WebRTC
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch (error) {
      console.error('Error getting network IP:', error)
      return null
    }
  }

  const getPublicIP = async () => {
    try {
      // Try multiple public IP detection services with timeout
      const services = [
        'https://api.ipify.org?format=json',
        'https://api.myip.com',
        'https://api64.ipify.org?format=json',
        'https://ipapi.co/json',
        'https://httpbin.org/ip'
      ]

      for (const service of services) {
        try {
          // Add timeout to each request
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
          
          const response = await fetch(service, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          })
          
          clearTimeout(timeoutId)
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          
          const data = await response.json()
          const ip = data.ip || data.query || data.origin
          
          if (ip && typeof ip === 'string' && ip.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
            console.log(`Successfully got IP from ${service}: ${ip}`)
            return ip
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.warn(`Failed to get IP from ${service}:`, errorMessage)
          continue
        }
      }
      
      console.warn('All public IP detection services failed')
      return null
    } catch (error) {
      console.error('Error getting public IP:', error)
      return null
    }
  }

  const detectLocalNetworkIP = async () => {
    try {
      // Try to detect local network IP using WebRTC
      const pc = new RTCPeerConnection({ 
        iceServers: [],
        iceCandidatePoolSize: 0
      })
      pc.createDataChannel('')
      
      return new Promise<string>((resolve) => {
        let resolved = false
        
        pc.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            const candidate = event.candidate.candidate
            const parts = candidate.split(' ')
            const ip = parts[4]
            
            if (ip && ip.match(/^(\d{1,3}\.){3}\d{1,3}$/) && 
                !ip.startsWith('127.') && 
                !ip.startsWith('169.254.')) {
              resolved = true
              pc.close()
              console.log(`Detected local network IP: ${ip}`)
              resolve(ip)
            }
          }
        }
        
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(error => {
            console.warn('WebRTC offer creation failed:', error)
            if (!resolved) {
              resolved = true
              pc.close()
              resolve('192.168.1.100')
            }
          })
        
        // Fallback after 3 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            pc.close()
            console.warn('WebRTC timeout, using fallback IP')
            resolve('192.168.1.100')
          }
        }, 3000)
      })
    } catch (error) {
      console.error('Error detecting local network IP:', error)
      return '192.168.1.100'
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
        // Use selected IP type with custom port
        if (qrConfig.ipType === 'localhost') {
          baseUrl = `http://localhost:${qrConfig.port}`
        } else {
          const selectedIP = qrConfig.ipType === 'public' ? qrConfig.publicIP : qrConfig.localIP
          baseUrl = `http://${selectedIP}:${qrConfig.port}`
        }
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
      // Use selected IP type with custom port
      if (qrConfig.ipType === 'localhost') {
        baseUrl = `http://localhost:${qrConfig.port}`
      } else {
        const selectedIP = qrConfig.ipType === 'public' ? qrConfig.publicIP : qrConfig.localIP
        baseUrl = `http://${selectedIP}:${qrConfig.port}`
      }
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
    const networkIP = await detectLocalNetworkIP()
    const publicIP = await getPublicIP()
    const currentPort = getCurrentPort()
    setQrConfig(prev => ({ 
      ...prev, 
      localIP: networkIP,
      publicIP: publicIP || networkIP,
      port: currentPort
    }))
    toast.success(`Network detected: ${networkIP}:${currentPort}`)
  }

  const refreshNetworkSettings = async () => {
    try {
      toast.loading('Refreshing network settings...')
      await autoDetectNetworkSettings()
      toast.success('Network settings refreshed successfully!')
    } catch (error) {
      toast.error('Failed to refresh network settings')
    }
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
                      Use Custom IP Address
                    </label>
                  </div>

                  {qrConfig.useLocalIP && (
                    <div className="pl-6 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          IP Type
                        </label>
                        <select
                          value={qrConfig.ipType}
                          onChange={(e) => setQrConfig(prev => ({ ...prev, ipType: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="network">Network IP (Local Network)</option>
                          <option value="public">Public IP (Internet)</option>
                          <option value="localhost">Localhost</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {qrConfig.useLocalIP && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IP Address
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={qrConfig.ipType === 'public' ? qrConfig.publicIP : qrConfig.localIP}
                          onChange={(e) => {
                            if (qrConfig.ipType === 'public') {
                              setQrConfig(prev => ({ ...prev, publicIP: e.target.value }))
                            } else {
                              setQrConfig(prev => ({ ...prev, localIP: e.target.value }))
                            }
                          }}
                          placeholder={qrConfig.ipType === 'public' ? 'Public IP' : '192.168.1.100'}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={detectLocalIP}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                          title="Detect IP Addresses"
                        >
                          <Wifi className="h-4 w-4" />
                        </button>
                        <button
                          onClick={refreshNetworkSettings}
                          className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                          title="Refresh Network Settings"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {qrConfig.ipType === 'network' && `Network IP: ${qrConfig.localIP}`}
                        {qrConfig.ipType === 'public' && `Public IP: ${qrConfig.publicIP}`}
                        {qrConfig.ipType === 'localhost' && 'Using localhost'}
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
                      ? qrConfig.ipType === 'localhost'
                        ? `http://localhost:${qrConfig.port}/public/${qrConfig.qrType}/${qrConfig.eventId}`
                        : `http://${qrConfig.ipType === 'public' ? qrConfig.publicIP : qrConfig.localIP}:${qrConfig.port}/public/${qrConfig.qrType}/${qrConfig.eventId}`
                      : `${window.location.origin}/public/${qrConfig.qrType}/${qrConfig.eventId}`
                    }
                  </p>
                  <div className="text-xs text-blue-600 mt-2 space-y-1">
                    <div>💡 Network IP: {qrConfig.localIP}</div>
                    <div>🌐 Public IP: {qrConfig.publicIP || 'Not detected'}</div>
                    <div>🔧 Port: {qrConfig.port}</div>
                  </div>
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