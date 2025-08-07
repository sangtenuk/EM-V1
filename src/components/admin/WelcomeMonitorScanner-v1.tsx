import { useState, useEffect, useRef } from 'react'
import { Monitor, Users, Settings, Maximize, Clock, Building, MapPin, User, Calendar, RefreshCw, Hash, Camera, X, RotateCw, CheckCircle } from 'lucide-react'
import { supabase, getStorageUrl } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import jsQR from 'jsqr'
import Scanner from './Scanner';

interface Event {
  id: string
  name: string
  company: {
    name: string
  }
  custom_background?: string | null
}

interface LatestCheckIn {
  id: string
  name: string
  company: string | null
  check_in_time: string
  face_photo_url?: string | null
  table_number?: string | null
  table_position?: string | null
  staff_id?: string | null
  identification_number?: string | null
  email?: string | null
  phone?: string | null
  registration_date?: string | null
}

interface WelcomeMonitorScannerProps {
  userCompany?: any
}

export default function WelcomeMonitorScanner({ userCompany }: WelcomeMonitorScannerProps) {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [latestCheckIn, setLatestCheckIn] = useState<LatestCheckIn | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [checkInHistory, setCheckInHistory] = useState<LatestCheckIn[]>([])
  
  // Scanner states
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeTimeout, setWelcomeTimeout] = useState<NodeJS.Timeout | null>(null)

  const [settings, setSettings] = useState({
    showCompany: true,
    showTime: true,
    showPhoto: true,
    showTableInfo: true,
    showContactInfo: false,
    showStaffId: true,
    showIdentificationNumber: false,
    autoHide: true,
    hideDelay: 5000,
    backgroundColor: '#1e40af',
    textColor: '#ffffff',
    showHistory: false,
    maxHistoryItems: 5,
    useCustomBackground: true,
    welcomeDisplayTime: 5000
  })

  useEffect(() => {
    fetchEvents()
  }, [userCompany])

  // Handle eventId from URL parameters
  useEffect(() => {
    const eventIdFromUrl = searchParams.get('eventId')
    if (eventIdFromUrl && events.length > 0) {
      setSelectedEventId(eventIdFromUrl)
    }
  }, [searchParams, events])

  useEffect(() => {
    if (selectedEventId) {
      // startCamera() // This is now handled by Scanner
    } else {
      // stopCamera() // This is now handled by Scanner
    }
  }, [selectedEventId])

  // Cleanup effect to prevent video play errors on unmount
  useEffect(() => {
    return () => {
      // Cleanup function to stop camera when component unmounts
      // if (stream) { // stream is no longer managed here
      //   stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      // }
      if (welcomeTimeout) {
        clearTimeout(welcomeTimeout)
      }
    }
  }, [welcomeTimeout])

  // Camera functions
  // startCamera = async () => { // This is now handled by Scanner
  //   if (isActive) return;
  //   setIsLoading(true);
  //   setError(null);

  //   try {
  //     const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
  //     setStream(mediaStream);

  //     if (videoRef.current) {
  //       videoRef.current.srcObject = mediaStream;
  //       videoRef.current.onloadedmetadata = () => {
  //         videoRef.current?.play().then(() => {
  //           setIsActive(true);
  //           setIsLoading(false);
  //           setTimeout(() => {
  //             if (videoRef.current && !videoRef.current.paused && document.contains(videoRef.current)) {
  //               startQRScanning();
  //             }
  //           }, 1000);
  //         }).catch((err) => {
  //           setIsLoading(false);
  //           setError('Failed to start video playback');
  //         });
  //       };
  //     } else {
  //       setIsLoading(false);
  //       setError('Video element not found');
  //     }
  //   } catch (err: any) {
  //     setIsLoading(false);
  //     let errorMessage = "Camera access failed";
  //     if (err.name === 'NotAllowedError') {
  //       errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
  //     } else if (err.name === 'NotFoundError') {
  //       errorMessage = "No camera found on this device.";
  //     } else if (err.name === 'NotSupportedError') {
  //       errorMessage = "Camera not supported on this device.";
  //     } else if (err.name === 'NotReadableError') {
  //       errorMessage = "Camera is in use by another application.";
  //     } else if (err.message?.includes('HTTPS')) {
  //       errorMessage = "Camera access requires HTTPS. Please use a secure connection.";
  //     } else if (err.message) {
  //       errorMessage = err.message;
  //     }
  //     setError(errorMessage);
  //     toast.error(errorMessage);
  //   }
  // };

  // const stopCamera = () => { // This is now handled by Scanner
  //   if (stream) {
  //     stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
  //     setStream(null)
  //   }
  //   setIsActive(false)
  //   setError(null)
  //   setIsScanning(false)
  //   setAutoScanning(false)
  //   if (animationFrameRef.current) {
  //     cancelAnimationFrame(animationFrameRef.current)
  //   }
  // }

  // const refreshCamera = () => { // This is now handled by Scanner
  //   stopCamera()
  //   setTimeout(() => startCamera(), 100)
  // }

  // const startQRScanning = () => { // This is now handled by Scanner
  //   if (!videoRef.current || !canvasRef.current) return

  //   let frameCount = 0
  //   let scanningActive = true

  //   const scanFrame = () => {
  //     const currentIsActive = videoRef.current && !videoRef.current.paused && videoRef.current.readyState >= 2
      
  //     if (!videoRef.current || !canvasRef.current || !currentIsActive || !scanningActive) {
  //       return
  //     }

  //     if (videoRef.current.paused || videoRef.current.readyState < 2) {
  //       animationFrameRef.current = requestAnimationFrame(scanFrame)
  //       return
  //     }

  //     frameCount++
  //     setFrameCount(frameCount)
  //     if (frameCount % 15 !== 0) {
  //       animationFrameRef.current = requestAnimationFrame(scanFrame)
  //       return
  //     }

  //     try {
  //       const video = videoRef.current
  //       const canvas = canvasRef.current
  //       const context = canvas.getContext('2d')

  //       if (context && video.videoWidth > 0 && video.videoHeight > 0) {
  //         canvas.width = video.videoWidth
  //         canvas.height = video.videoHeight
  //         context.drawImage(video, 0, 0, canvas.width, canvas.height)
          
  //         const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          
  //         const code = jsQR(imageData.data, imageData.width, imageData.height, {
  //           inversionAttempts: "attemptBoth",
  //         })

  //         if (code) {
  //           scanningActive = false
  //           handleQRDetected(code.data)
  //           return
  //         }
  //       }
  //     } catch (error) {
  //       console.error('Error during auto-scanning:', error)
  //     }

  //     animationFrameRef.current = requestAnimationFrame(scanFrame)
  //   }

  //   setAutoScanning(true)
  //   animationFrameRef.current = requestAnimationFrame(scanFrame)
  // }

  // const handleQRDetected = async (qrData: string) => { // This is now handled by Scanner
  //   setIsScanning(true)
  //   toast.success("QR Code detected!")
    
  //   // Process the QR code and check in attendee
  //   const result = await processCheckIn(qrData)
    
  //   if (result.success && result.attendee) {
  //     setLatestCheckIn(result.attendee)
  //     setShowWelcome(true)
      
  //     // Add to history
  //     setCheckInHistory(prev => {
  //       const newHistory = [result.attendee!, ...prev.slice(0, settings.maxHistoryItems - 1)]
  //       return newHistory
  //     })
      
  //     // Stop scanning and show welcome message
  //     if (animationFrameRef.current) {
  //       cancelAnimationFrame(animationFrameRef.current)
  //     }
      
  //     // Auto-hide welcome message and return to scanner
  //     const timeout = setTimeout(() => {
  //       setShowWelcome(false)
  //       setLatestCheckIn(null)
  //       setTimeout(() => {
  //         refreshCamera()
  //       }, 500)
  //     }, settings.welcomeDisplayTime)
      
  //     setWelcomeTimeout(timeout)
  //   } else {
  //     toast.error(result.message)
  //     setTimeout(() => {
  //       setIsScanning(false)
  //       refreshCamera()
  //     }, 2000)
  //   }
  // }

  const processCheckIn = async (qrData: string): Promise<{ success: boolean; attendee?: LatestCheckIn; message: string }> => {
    try {
      // Check if it's a QR code (contains |) or manual ID entry
      if (qrData.includes('|')) {
        // Parse QR code data (format: attendeeId|eventId|name)
        const parts = qrData.split('|')
        if (parts.length !== 3) {
          return { success: false, message: 'Invalid QR code format' }
        }

        const attendeeId = parts[0]

        // Verify attendee exists and belongs to selected event
        const { data: attendee, error } = await supabase
          .from('attendees')
          .select(`
            id,
            name,
            identification_number,
            staff_id,
            checked_in,
            event_id,
            table_assignment,
            table_number,
            seat_number,
            company,
            email,
            phone,
            check_in_time,
            created_at,
            face_photo_url,
            event:events(name)
          `)
          .eq('id', attendeeId)
          .single()

        if (error || !attendee) {
          return { success: false, message: 'Attendee not found' }
        }

        if (attendee.event_id !== selectedEventId) {
          return { success: false, message: 'This ticket is not valid for the selected event' }
        }

        if (attendee.checked_in) {
          return { success: false, message: `${attendee.name} is already checked in` }
        }

        // Check in the attendee
        const { error: updateError } = await supabase
          .from('attendees')
          .update({
            checked_in: true,
            check_in_time: new Date().toISOString()
          })
          .eq('id', attendee.id)

        if (updateError) throw updateError

        // Get table position if table_number exists
        let tablePosition = ''
        if (attendee.table_number) {
          tablePosition = `Table ${attendee.table_number}`
          if (attendee.seat_number) {
            tablePosition += ` - Seat ${attendee.seat_number}`
          }
        } else if (attendee.table_assignment) {
          tablePosition = attendee.table_assignment
        }

        const checkInData: LatestCheckIn = {
          id: attendee.id,
          name: attendee.name,
          company: attendee.company,
          check_in_time: new Date().toISOString(),
          face_photo_url: (attendee as any).face_photo_url || null,
          table_number: attendee.table_number,
          table_position: tablePosition,
          staff_id: attendee.staff_id,
          identification_number: attendee.identification_number,
          email: attendee.email,
          phone: attendee.phone,
          registration_date: attendee.created_at
        }

        return {
          success: true,
          attendee: checkInData,
          message: `${attendee.name} checked in successfully!`
        }
      } else {
        // Manual ID entry - search by identification_number or staff_id
        const { data: attendees, error } = await supabase
          .from('attendees')
          .select(`
            id,
            name,
            identification_number,
            staff_id,
            checked_in,
            event_id,
            table_assignment,
            table_number,
            seat_number,
            company,
            email,
            phone,
            check_in_time,
            created_at,
            face_photo_url,
            event:events(name)
          `)
          .eq('event_id', selectedEventId)
          .or(`identification_number.eq.${qrData},staff_id.eq.${qrData}`)

        if (error) throw error

        if (!attendees || attendees.length === 0) {
          return { success: false, message: 'No attendee found with this ID' }
        }

        const attendee = attendees[0]

        if (attendee.checked_in) {
          return { success: false, message: `${attendee.name} is already checked in` }
        }

        // Check in the attendee
        const { error: updateError } = await supabase
          .from('attendees')
          .update({
            checked_in: true,
            check_in_time: new Date().toISOString()
          })
          .eq('id', attendee.id)

        if (updateError) throw updateError

        // Get table position if table_number exists
        let tablePosition = ''
        if (attendee.table_number) {
          tablePosition = `Table ${attendee.table_number}`
          if (attendee.seat_number) {
            tablePosition += ` - Seat ${attendee.seat_number}`
          }
        } else if (attendee.table_assignment) {
          tablePosition = attendee.table_assignment
        }

        const checkInData: LatestCheckIn = {
          id: attendee.id,
          name: attendee.name,
          company: attendee.company,
          check_in_time: new Date().toISOString(),
          face_photo_url: (attendee as any).face_photo_url || null,
          table_number: attendee.table_number,
          table_position: tablePosition,
          staff_id: attendee.staff_id,
          identification_number: attendee.identification_number,
          email: attendee.email,
          phone: attendee.phone,
          registration_date: attendee.created_at
        }

        return {
          success: true,
          attendee: checkInData,
          message: `${attendee.name} checked in successfully!`
        }
      }
    } catch (error: any) {
      return { success: false, message: 'Error processing check-in: ' + error.message }
    }
  }

  const fetchEvents = async () => {
    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          name,
          company_id,
          custom_background,
          company:companies(name)
        `)
        .order('created_at', { ascending: false })

      if (userCompany) {
        query = query.eq('company_id', userCompany.company_id)
      }

      const { data, error } = await query

      if (error) throw error

      if (data) {
        const normalizedData = data.map((event: any) => ({
          ...event,
          company: Array.isArray(event.company) ? event.company[0] : event.company
        }))
        setEvents(normalizedData)

        if (userCompany && normalizedData && normalizedData.length > 0) {
          setSelectedEventId(normalizedData[0].id)
          setSelectedEvent(normalizedData[0])
        }
      }
    } catch (error: any) {
      console.error('Error fetching events:', error)
    }
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const WelcomeDisplay = () => {
    const backgroundStyle = settings.useCustomBackground && selectedEvent?.custom_background
      ? {
          backgroundImage: `url(${getStorageUrl(selectedEvent.custom_background)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }
      : { backgroundColor: settings.backgroundColor }

    return (
      <div className="h-full flex items-center justify-center relative" style={{ ...backgroundStyle, color: settings.textColor }}>
        <AnimatePresence>
          {latestCheckIn ? (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", duration: 0.8 }}
              className="text-center max-w-4xl mx-auto p-8"
            >
              <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="mb-8">
                <h1 className="text-6xl md:text-8xl font-bold mb-6">Welcome!</h1>
                
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8">
                  {settings.showPhoto && latestCheckIn.face_photo_url && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="flex-shrink-0"
                    >
                      <img 
                        src={latestCheckIn.face_photo_url} 
                        alt={latestCheckIn.name}
                        className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white shadow-2xl object-cover"
                      />
                    </motion.div>
                  )}
                  
                  <div className="flex-1">
                    <div className="text-4xl md:text-6xl font-semibold mb-4">{latestCheckIn.name}</div>
                    
                    {settings.showCompany && latestCheckIn.company && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-2xl md:text-4xl opacity-80 mb-4 flex items-center justify-center"
                      >
                        <Building className="h-6 w-6 md:h-8 md:w-8 mr-2" />
                        {latestCheckIn.company}
                      </motion.div>
                    )}

                    {settings.showStaffId && latestCheckIn.staff_id && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 }}
                        className="text-xl md:text-3xl opacity-80 mb-4 flex items-center justify-center"
                      >
                        <Hash className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                        Staff ID: {latestCheckIn.staff_id}
                      </motion.div>
                    )}

                    {settings.showIdentificationNumber && latestCheckIn.identification_number && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.47 }}
                        className="text-lg md:text-2xl opacity-70 mb-4 flex items-center justify-center"
                      >
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                        ID: {latestCheckIn.identification_number}
                      </motion.div>
                    )}
                    
                    {settings.showTableInfo && latestCheckIn.table_position && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-xl md:text-3xl opacity-80 mb-4 flex items-center justify-center"
                      >
                        <MapPin className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                        {latestCheckIn.table_position}
                      </motion.div>
                    )}
                    
                    {settings.showTime && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="text-xl md:text-2xl opacity-60 flex items-center justify-center"
                      >
                        <Clock className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                        {formatTime(latestCheckIn.check_in_time)}
                      </motion.div>
                    )}
                  </div>
                </div>
                
                {settings.showContactInfo && (latestCheckIn.email || latestCheckIn.phone) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-lg md:text-xl opacity-70"
                  >
                    {latestCheckIn.email && (
                      <div className="mb-2">{latestCheckIn.email}</div>
                    )}
                    {latestCheckIn.phone && (
                      <div>{latestCheckIn.phone}</div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <Users className="h-32 w-32 mx-auto mb-8 opacity-50" />
              <h1 className="text-4xl md:text-6xl font-bold mb-4">Welcome to the Event</h1>
              <p className="text-xl md:text-2xl opacity-80">Waiting for check-ins...</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Check-in History */}
        {settings.showHistory && checkInHistory.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 right-4"
          >
            <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Recent Check-ins</h3>
              <div className="flex gap-2 overflow-x-auto">
                {checkInHistory.map((checkIn, index) => (
                  <motion.div
                    key={checkIn.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex-shrink-0 bg-white bg-opacity-20 rounded-lg p-3 min-w-0"
                  >
                    {checkIn.face_photo_url && (
                      <img 
                        src={checkIn.face_photo_url} 
                        alt={checkIn.name}
                        className="w-8 h-8 rounded-full mr-2 object-cover"
                      />
                    )}
                    <div className="text-sm">
                      <div className="font-semibold truncate">{checkIn.name}</div>
                      <div className="opacity-80 text-xs">{formatTime(checkIn.check_in_time)}</div>
                      {checkIn.staff_id && (
                        <div className="opacity-60 text-xs">ID: {checkIn.staff_id}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  const ScannerDisplay = () => {
    if (showWelcome) {
      return <WelcomeDisplay />;
    }
      return (
      <Scanner
        onScan={async (qrData) => {
          const result = await processCheckIn(qrData);
          if (result.success && result.attendee) {
            setLatestCheckIn(result.attendee);
            setShowWelcome(true);
            setCheckInHistory(prev => [result.attendee!, ...prev.slice(0, settings.maxHistoryItems - 1)]);
            setTimeout(() => {
              setShowWelcome(false);
              setLatestCheckIn(null);
            }, settings.welcomeDisplayTime);
          } else {
            toast.error(result.message);
          }
        }}
        onError={setError}
        eventSelected={!!selectedEventId}
      />
    );
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {/* Event Details Header */}
        {selectedEvent && (
          <div
            className="w-full flex flex-col items-center justify-center"
            style={selectedEvent.custom_background && settings.useCustomBackground ? {
              backgroundImage: `url(${getStorageUrl(selectedEvent.custom_background)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              color: settings.textColor,
            } : { backgroundColor: settings.backgroundColor, color: settings.textColor }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-2 drop-shadow-lg">{selectedEvent.name}</h1>
            {selectedEvent.company?.name && (
              <div className="text-2xl md:text-3xl font-medium opacity-90 mb-2 drop-shadow-lg flex items-center justify-center">
                <Building className="h-7 w-7 mr-2" />
                {selectedEvent.company.name}
              </div>
            )}
          </div>
        )}
        {/* Scanner fills the rest of the screen */}
        <div className="flex-1 flex flex-col justify-center items-center w-full h-full ">
          {showWelcome ? <WelcomeDisplay /> :
            <div className="w-screen h-screen flex flex-col justify-center items-center pb-20">
                
              <Scanner
                onScan={async (qrData) => {
                  const result = await processCheckIn(qrData);
                  if (result.success && result.attendee) {
                    setLatestCheckIn(result.attendee);
                    setShowWelcome(true);
                    setCheckInHistory(prev => [result.attendee!, ...prev.slice(0, settings.maxHistoryItems - 1)]);
                    setTimeout(() => {
                      setShowWelcome(false);
                      setLatestCheckIn(null);
                    }, settings.welcomeDisplayTime);
                  } else {
                    toast.error(result.message);
                  }
                }}
                onError={setError}
                eventSelected={!!selectedEventId}
              />
              </div>
          }
        </div>
        <button onClick={toggleFullscreen} className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-colors">
          Exit Fullscreen
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Monitor Scanner</h1>
          <p className="text-gray-600 mt-2">Camera scanner with welcome display - scan QR codes to welcome attendees</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleFullscreen}
            disabled={!selectedEventId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Maximize className="h-5 w-5 mr-2" />
            Fullscreen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Settings className="h-6 w-6 mr-2" />
            Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {userCompany && events.length <= 1 ? 'Event' : 'Select Event'}
              </label>
              {userCompany && events.length === 1 ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900">
                  {events[0].name}
                </div>
              ) : (
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    setSelectedEventId(e.target.value)
                    const event = events.find(ev => ev.id === e.target.value)
                    setSelectedEvent(event || null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {!userCompany && <option value="">Select an event</option>}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {userCompany ? event.name : `${event.name} (${event.company.name})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-3">
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showPhoto} onChange={(e) => setSettings({ ...settings, showPhoto: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Attendee Photo</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showCompany} onChange={(e) => setSettings({ ...settings, showCompany: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Company</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showStaffId} onChange={(e) => setSettings({ ...settings, showStaffId: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Staff ID</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showIdentificationNumber} onChange={(e) => setSettings({ ...settings, showIdentificationNumber: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Identification Number</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showTableInfo} onChange={(e) => setSettings({ ...settings, showTableInfo: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Table Information</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showTime} onChange={(e) => setSettings({ ...settings, showTime: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Check-in Time</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showContactInfo} onChange={(e) => setSettings({ ...settings, showContactInfo: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Contact Information</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.showHistory} onChange={(e) => setSettings({ ...settings, showHistory: e.target.checked })} className="mr-2" />
                <span className="text-sm">Show Recent Check-ins</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={settings.useCustomBackground} onChange={(e) => setSettings({ ...settings, useCustomBackground: e.target.checked })} className="mr-2" />
                <span className="text-sm">Use Custom Background</span>
              </label>
            </div>
            {settings.showHistory && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max History Items</label>
                <input
                  type="number"
                  value={settings.maxHistoryItems}
                  onChange={(e) => setSettings({ ...settings, maxHistoryItems: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="10"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Welcome Display Time (seconds)</label>
              <input
                type="number"
                value={settings.welcomeDisplayTime / 1000}
                onChange={(e) => setSettings({ ...settings, welcomeDisplayTime: parseInt(e.target.value) * 1000 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="30"
              />
            </div>
            {!settings.useCustomBackground && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
                  <input type="color" value={settings.backgroundColor} onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })} className="w-full h-10 border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
                  <input type="color" value={settings.textColor} onChange={(e) => setSettings({ ...settings, textColor: e.target.value })} className="w-full h-10 border border-gray-300 rounded-md" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Monitor className="h-6 w-6 mr-2" />
              Preview
            </h2>
            {/* In preview mode, keep the aspect-video constraint for the preview only */}
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              {selectedEventId ? (
                showWelcome ? <WelcomeDisplay /> : <ScannerDisplay />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select an event to see preview</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>• This preview shows the scanner and welcome display</p>
              <p>• Click "Fullscreen" to display on external monitor</p>
              <p>• Camera scanner will automatically detect QR codes</p>
              <p>• Welcome message shows after successful check-in</p>
              <p>• Scanner returns automatically after welcome display</p>
              {selectedEvent?.custom_background && (
                <p>• Custom background available for this event</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}