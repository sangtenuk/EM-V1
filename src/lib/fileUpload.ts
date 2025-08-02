// File upload utility for storing images in the public folder
import { hybridDB } from './hybridDB';

export interface UploadedFile {
  id: string;
  fileName: string;
  filePath: string;
  url: string;
  type: 'image' | 'logo' | 'background';
  eventId?: string;
  companyId?: string;
  created_at: string;
  size: number;
  mimeType: string;
}

// Generate a unique filename
const generateFileName = (originalName: string, prefix: string = ''): string => {
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().slice(0, 8);
  const extension = originalName.split('.').pop() || 'jpg';
  return `${prefix}${timestamp}_${randomId}.${extension}`;
};

// Convert file to base64 for local storage
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Store file in IndexedDB for offline access
const storeFileLocally = async (file: File, fileName: string, type: string): Promise<string> => {
  const base64 = await fileToBase64(file);
  const fileData = {
    id: fileName,
    fileName,
    base64,
    type,
    created_at: new Date().toISOString(),
    size: file.size,
    mimeType: file.type
  };
  
  await hybridDB.table('uploaded_files').put(fileData);
  return base64;
};

// Upload file to public folder using file server
export const uploadToPublicFolder = async (
  file: File, 
  type: 'image' | 'logo' | 'background',
  eventId?: string,
  companyId?: string
): Promise<UploadedFile> => {
  try {
    const fileName = generateFileName(file.name, `${type}_`);
    const filePath = `/uploads/${type}/${fileName}`;
    
    // Store file locally in IndexedDB for immediate access
    const base64 = await storeFileLocally(file, fileName, type);
    
    // Create file record
    const uploadedFile: UploadedFile = {
      id: crypto.randomUUID(),
      fileName,
      filePath,
      url: base64, // Use base64 for immediate access
      type,
      eventId,
      companyId,
      created_at: new Date().toISOString(),
      size: file.size,
      mimeType: file.type
    };
    
    // Store metadata in IndexedDB
    await hybridDB.table('file_metadata').put(uploadedFile);
    
    // Try to also save to public folder via file server
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('type', type);
      if (eventId) formData.append('eventId', eventId);
      if (companyId) formData.append('companyId', companyId);
      
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('File uploaded to server:', result.filePath);
        // Update the URL to use the server path
        uploadedFile.url = result.url;
        uploadedFile.filePath = result.filePath;
      } else {
        console.log('File server upload failed, using local storage only');
      }
    } catch (serverError) {
      console.log('File server not available, using local storage only');
    }
    
    return uploadedFile;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
};

// Get file URL (prioritizes local storage)
export const getFileUrl = async (filePath: string): Promise<string> => {
  try {
    // First try to get from local storage
    const localFile = await hybridDB.table('uploaded_files').get(filePath);
    if (localFile) {
      return localFile.base64;
    }
    
    // Fallback to public folder path
    return filePath;
  } catch (error) {
    console.error('Error getting file URL:', error);
    return filePath;
  }
};

// Delete file from local storage
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    await hybridDB.table('uploaded_files').delete(filePath);
    await hybridDB.table('file_metadata').where('filePath').equals(filePath).delete();
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// Get all files for an event
export const getEventFiles = async (eventId: string): Promise<UploadedFile[]> => {
  try {
    return await hybridDB.table('file_metadata')
      .where('eventId')
      .equals(eventId)
      .toArray();
  } catch (error) {
    console.error('Error getting event files:', error);
    return [];
  }
};

// Get all files for a company
export const getCompanyFiles = async (companyId: string): Promise<UploadedFile[]> => {
  try {
    return await hybridDB.table('file_metadata')
      .where('companyId')
      .equals(companyId)
      .toArray();
  } catch (error) {
    console.error('Error getting company files:', error);
    return [];
  }
}; 