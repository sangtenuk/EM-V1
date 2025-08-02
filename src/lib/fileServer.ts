// File server utility for handling uploads to public folder
import { hybridDB } from './hybridDB';

export interface FileUploadResponse {
  success: boolean;
  filePath: string;
  url: string;
  error?: string;
}

// Upload file to public folder using a simple file server
export const uploadToPublicServer = async (
  file: File,
  type: 'image' | 'logo' | 'background',
  eventId?: string,
  companyId?: string
): Promise<FileUploadResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (eventId) formData.append('eventId', eventId);
    if (companyId) formData.append('companyId', companyId);

    // Try to upload to a local file server endpoint
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        filePath: result.filePath,
        url: result.url
      };
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('File server upload failed, falling back to local storage:', error);
    
    // Fallback to local storage only
    const fileName = `${type}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${file.name.split('.').pop()}`;
    const filePath = `/uploads/${type}/${fileName}`;
    
    // Store in IndexedDB
    const base64 = await fileToBase64(file);
    await hybridDB.table('uploaded_files').put({
      id: fileName,
      fileName,
      base64,
      type,
      created_at: new Date().toISOString(),
      size: file.size,
      mimeType: file.type
    });

    return {
      success: true,
      filePath,
      url: base64
    };
  }
};

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Get file URL with fallback
export const getFileUrlWithFallback = async (filePath: string): Promise<string> => {
  try {
    // First try to get from local storage
    const localFile = await hybridDB.table('uploaded_files').get(filePath.split('/').pop() || '');
    if (localFile) {
      return localFile.base64;
    }
    
    // Try to fetch from public folder
    const response = await fetch(filePath);
    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    
    // Fallback to filePath as is
    return filePath;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return filePath;
  }
}; 