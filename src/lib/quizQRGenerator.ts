import QRCode from 'qrcode'

export const generateQuizQRCode = async (sessionId: string, title: string): Promise<{ qrCode: string; qrCodeUrl: string }> => {
  try {
    const baseUrl = window.location.origin
    const qrData = `${baseUrl}/public/quiz-play/${sessionId}`
    
    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    
    return {
      qrCode: qrData,
      qrCodeUrl
    }
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw error
  }
} 