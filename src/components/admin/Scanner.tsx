import React, { useState, useEffect, useRef } from "react"; 
import { Camera, X, RotateCw, CheckCircle, RefreshCw } from "lucide-react"; 
import toast from "react-hot-toast"; 
 import jsQR from "jsqr";

interface ScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  eventSelected?: boolean;
}

export default function Scanner({ onScan, onError, autoStart = true, eventSelected = false }: ScannerProps) { 
  const [isActive, setIsActive] = useState(false); 
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null); 
  const [stream, setStream] = useState<MediaStream | null>(null); 
  const [isScanning, setIsScanning] = useState(false);
  const [autoScanning, setAutoScanning] = useState(false);
  const [frameCount, setFrameCount] = useState(0); 
  const videoRef = useRef<HTMLVideoElement>(null); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

    const startCamera = async () => { 
    if (isActive) return; 
    setIsLoading(true); 
    setError(null); 
    
    const tryCameraAccess = async (constraints: MediaStreamConstraints) => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        return mediaStream;
      } catch (err: any) {
        console.error('Camera access attempt failed:', err);
        throw err;
      }
    };

    try { 
      // Try with optimal constraints first
      let mediaStream = await tryCameraAccess({ 
        video: { 
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
          frameRate: { ideal: 30, min: 10 },
          aspectRatio: { ideal: 4/3 }
        } 
      });

      // If that fails, try with minimal constraints
      if (!mediaStream) {
        mediaStream = await tryCameraAccess({ 
          video: { 
            facingMode: "environment",
            width: { min: 320 },
            height: { min: 240 }
          } 
        });
      }

      // If still fails, try without facingMode
      if (!mediaStream) {
        mediaStream = await tryCameraAccess({ 
          video: { 
            width: { min: 320 },
            height: { min: 240 }
          } 
        });
      }

      setStream(mediaStream); 
      if (videoRef.current) { 
        videoRef.current.srcObject = mediaStream; 
        videoRef.current.onloadedmetadata = () => { 
          if (videoRef.current) { 
            videoRef.current.play(); 
            setIsActive(true); 
            setIsLoading(false); 
            // Start QR scanning after camera is ready with a delay
            setTimeout(() => {
              // Double check that video is actually playing
              if (videoRef.current && !videoRef.current.paused) {
                startQRScanning();
              } else {
                // Try again after another delay
                setTimeout(() => {
                  if (videoRef.current && !videoRef.current.paused) {
                    startQRScanning();
                  }
                }, 1000);
              }
            }, 2000); // Wait 2 seconds for camera to fully stabilize
          } 
        }; 
      } 
    } catch (err: any) { 
      setIsLoading(false); 
      console.error('Camera access error:', err);
      
      let errorMessage = "Camera access failed";
      
      // Handle specific mobile camera errors
      if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera found on this device.";
      } else if (err.name === 'NotSupportedError') {
        errorMessage = "Camera not supported on this device.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera is in use by another application.";
      } else if (err.message?.includes('HTTPS')) {
        errorMessage = "Camera access requires HTTPS. Please use a secure connection.";
      }
      
      setError(errorMessage); 
      onError?.(errorMessage); 
      toast.error(errorMessage); 
    }
  }; 

  const stopCamera = () => { 
    if (stream) { 
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop()); 
      setStream(null); 
    } 
    setIsActive(false); 
    setError(null); 
    setIsScanning(false);
    setAutoScanning(false); 
    // Stop QR scanning
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }; 

  const refreshCamera = () => {
    stopCamera();
    setTimeout(() => startCamera(), 100);
  };

  const startQRScanning = () => {
    if (!videoRef.current || !canvasRef.current) return;

    let frameCount = 0;
    let scanningActive = true;

    const scanFrame = () => {
      // Get current state values instead of using stale closure
      const currentIsActive = videoRef.current && !videoRef.current.paused && videoRef.current.readyState >= 2;
      
      if (!videoRef.current || !canvasRef.current || !currentIsActive || !scanningActive) {
        return;
      }

      // Additional check to ensure video is actually playing
      if (videoRef.current.paused || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      frameCount++;
      setFrameCount(frameCount);
      // Only scan every 15 frames to reduce CPU usage and give more time
      if (frameCount % 15 !== 0) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context && video.videoWidth > 0 && video.videoHeight > 0) {
          // Set canvas size to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw video frame to canvas
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get image data for QR detection
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          
          // Scan for QR code with more options
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });

          if (code) {
            // QR code found!
            scanningActive = false; // Stop scanning
            handleQRDetected(code.data);
            return; // Stop scanning after detection
          }
        }
      } catch (error) {
        console.error('Error during auto-scanning:', error);
      }

      // Continue scanning
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    // Start scanning
    setAutoScanning(true);
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleQRDetected = (qrData: string) => {
    setIsScanning(true);
    toast.success("QR Code detected!");
    
    // Process the QR data
    onScan(qrData);
    
    // Stop scanning and refresh camera after detection
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    setTimeout(() => {
      setIsScanning(false);
      refreshCamera();
    }, 2000);
  };

  const manualScan = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context && video.videoWidth > 0 && video.videoHeight > 0) {
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for QR detection
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      console.log('Manual scan:', {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        imageDataWidth: imageData.width,
        imageDataHeight: imageData.height,
        dataLength: imageData.data.length
      });
      
      // Scan for QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code) {
        console.log("Manual QR Code detected:", code.data);
        handleQRDetected(code.data);
      } else {
        console.log("No QR code found in manual scan");
        toast.error("No QR code detected in current frame");
      }
    }
  };

  // Start camera when event is selected
  useEffect(() => { 
    if (eventSelected && !isActive) {
      startCamera();
    } else if (!eventSelected && isActive) {
      stopCamera();
    }
    return () => stopCamera(); 
  }, [eventSelected]);

 

  if (error) { 
    return (
      <div className="bg-white rounded-xl shadow-lg border border-red-200 p-4 md:p-6">
        <div className="text-center">
          <div className="bg-red-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Camera className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera Error</h3>
          <p className="text-gray-600 mb-4 text-sm">{error}</p>
          
          {/* Mobile-specific instructions */}
          <div className="bg-yellow-50 rounded-lg p-3 mb-4 border border-yellow-200">
            <p className="text-xs text-yellow-800 mb-2">📱 Mobile Troubleshooting:</p>
            <ul className="text-xs text-yellow-700 space-y-1 text-left">
              <li>• Ensure you're using HTTPS (secure connection)</li>
              <li>• Allow camera permissions when prompted</li>
              <li>• Try refreshing the page and try again</li>
              <li>• Check if camera is being used by another app</li>
            </ul>
          </div>
          
          <button 
            onClick={startCamera} 
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Retry Camera
          </button>
        </div>
      </div>
    ); 
  } 

  if (!eventSelected) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="text-center">
          <div className="bg-gray-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Camera className="h-8 w-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code Scanner</h3>
          <p className="text-gray-600 mb-4">Select an event to start scanning</p>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-700">📱 Camera will activate when an event is selected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="bg-white bg-opacity-20 rounded-full p-1.5 md:p-2">
              <Camera className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm md:text-base">QR Code Scanner</h3>
              <p className="text-blue-100 text-xs md:text-sm">Real-time QR code detection</p>
            </div>
          </div>
          {isActive && (
            <div className="bg-green-500 text-white px-2 md:px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 md:space-x-2">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs">Live • {autoScanning ? `Auto-Scanning (${frameCount})` : 'Ready'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Container */}
      <div className="relative bg-black">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-80 md:h-80 object-cover"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            imageRendering: 'crisp-edges'
          }}
        />
        
        {/* Hidden canvas for QR processing */}
        <canvas ref={canvasRef} className="hidden" />
        
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-sm font-medium">Starting camera...</p>
            </div>
          </div>
        )}

        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="flex items-center justify-center h-full">
              <div className="relative">
                {/* Scanner Frame */}
                <div className="w-64 h-64 md:w-80 md:h-80 border-3 border-white rounded-2xl shadow-2xl relative bg-black bg-opacity-5">
                  {/* Corner indicators */}
                  <div className="absolute -top-3 -left-3 w-10 h-10 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                  <div className="absolute -top-3 -right-3 w-10 h-10 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                  <div className="absolute -bottom-3 -left-3 w-10 h-10 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                  <div className="absolute -bottom-3 -right-3 w-10 h-10 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
                  
                  {/* Scanning line animation */}
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"></div>
                  
                  {/* Center dot */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
                
                {/* Scanning indicator */}
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-green-600 text-white px-8 py-4 rounded-2xl shadow-2xl border border-green-400">
                      <div className="flex items-center">
                        <CheckCircle className="h-6 w-6 mr-3" />
                        <span className="font-semibold text-lg">QR Code Detected!</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Controls */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 md:space-x-4">
          {isActive ? (
            <>
              <button 
                onClick={refreshCamera} 
                className="bg-white bg-opacity-90 text-gray-800 p-3 md:p-4 rounded-full hover:bg-opacity-100 transition-all shadow-lg backdrop-blur-sm" 
                title="Refresh Camera"
              >
                <RefreshCw className="h-5 w-5 md:h-6 md:w-6" />
              </button>
              <button 
                onClick={manualScan} 
                className="bg-green-500 text-white p-3 md:p-4 rounded-full hover:bg-green-600 transition-all shadow-lg" 
                title="Manual Scan"
              >
                📷 Scan
              </button>

              <button 
                onClick={stopCamera} 
                className="bg-red-600 text-white p-3 md:p-4 rounded-full hover:bg-red-700 transition-all shadow-lg" 
                title="Stop Camera"
              >
                <X className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </>
          ) : (
            <button 
              onClick={startCamera} 
              className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center shadow-lg font-medium"
            >
              <Camera className="h-6 w-6 mr-3" />
              Start Camera
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      {!isActive && !isLoading && eventSelected && (
        <div className="p-4 md:p-6 bg-gray-50">
          <div className="text-center">
            <div className="bg-white rounded-full p-3 md:p-4 w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 md:mb-4 flex items-center justify-center shadow-sm">
              <Camera className="h-8 w-8 md:h-10 md:w-10 text-gray-400" />
            </div>
            <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2">Ready to Scan</h4>
            <div className="bg-blue-50 rounded-lg p-3 md:p-4 border border-blue-200 max-w-md mx-auto">
              <div className="space-y-1 md:space-y-2 text-xs md:text-sm text-blue-800">
                <p className="flex items-center">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full mr-2 md:mr-3"></span>
                  Position QR code within the scanning frame
                </p>
                <p className="flex items-center">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full mr-2 md:mr-3"></span>
                  Hold steady for best detection results
                </p>
                <p className="flex items-center">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full mr-2 md:mr-3"></span>
                  Real-time QR code detection active
                </p>
                <p className="flex items-center text-xs text-blue-600 mt-2">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-400 rounded-full mr-2 md:mr-3"></span>
                  📱 Mobile optimized - Back camera enabled
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {isActive && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>📱 Fixed frame size: 640x480</span>
            <span>🔍 Real-time QR detection</span>
          </div>
        </div>
      )}
    </div>
  ); 
}
