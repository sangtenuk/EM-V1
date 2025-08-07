# File Upload System - Public Folder Storage

This system has been updated to store uploaded images in the `public/uploads/` folder instead of Supabase storage. This provides better offline support and local file management.

## Architecture

### File Storage Structure
```
public/
├── uploads/
│   ├── image/      # Gallery photos uploaded by attendees
│   ├── logo/       # Company logos
│   └── background/ # Event custom backgrounds
```

### Components

1. **File Upload Utility** (`src/lib/fileUpload.ts`)
   - Handles file uploads to public folder
   - Stores files locally in IndexedDB for offline access
   - Manages file metadata

2. **File Server** (`server.js`)
   - Express server for handling file uploads
   - Serves files from public folder
   - Provides REST API endpoints

3. **Hybrid Database** (`src/lib/hybridDB.ts`)
   - Stores file metadata and base64 data
   - Enables offline file access
   - Syncs with online database

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Environment
```bash
# Start both Vite dev server and file server
npm run dev:full

# Or start them separately
npm run dev        # Vite dev server (port 5174)
npm run server     # File server (port 3001)
```

### 3. File Server Endpoints

- **Upload**: `POST http://localhost:3001/api/upload`
- **Get Files**: `GET http://localhost:3001/api/files/:type`
- **Delete File**: `DELETE http://localhost:3001/api/files/:type/:filename`
- **Health Check**: `GET http://localhost:3001/api/health`

## Usage

### Uploading Files

```typescript
import { uploadToPublicFolder } from '../lib/fileUpload';

const handleUpload = async (file: File) => {
  try {
    const uploadedFile = await uploadToPublicFolder(
      file, 
      'image', // or 'logo', 'background'
      eventId, // optional
      companyId // optional
    );
    
    console.log('File uploaded:', uploadedFile.url);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### Getting File URLs

```typescript
import { getFileUrl } from '../lib/fileUpload';

const getImageUrl = async (filePath: string) => {
  const url = await getFileUrl(filePath);
  return url; // Returns base64 if local, or server URL if available
};
```

## Features

### ✅ Implemented
- [x] File uploads to public folder
- [x] Local storage in IndexedDB for offline access
- [x] File metadata management
- [x] Image type validation
- [x] File size limits (10MB)
- [x] Unique filename generation
- [x] Fallback to local storage when server unavailable

### 🔄 In Progress
- [ ] File deletion from public folder
- [ ] File compression/optimization
- [ ] Batch upload support
- [ ] File versioning

### 📋 Planned
- [ ] CDN integration
- [ ] Image resizing
- [ ] Thumbnail generation
- [ ] File backup system

## Migration from Supabase Storage

The system now prioritizes local storage over Supabase:

1. **Company Logos**: Stored in `public/uploads/logo/`
2. **Event Backgrounds**: Stored in `public/uploads/background/`
3. **Gallery Photos**: Stored in `public/uploads/image/`

### Benefits
- ✅ Better offline support
- ✅ Faster file access
- ✅ Reduced cloud storage costs
- ✅ Local file management
- ✅ No internet dependency for file access

### Considerations
- ⚠️ Files are stored locally (IndexedDB)
- ⚠️ Server required for public folder uploads
- ⚠️ File cleanup needed for old uploads

## Troubleshooting

### File Server Not Starting
```bash
# Check if port 3001 is available
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

### Upload Failures
1. Ensure file server is running (`npm run server`)
2. Check file size (max 10MB)
3. Verify file type (images only)
4. Check browser console for errors

### Offline Mode
Files are automatically cached in IndexedDB for offline access. No additional setup required.

## Security Notes

- Files are served from public folder (accessible via URL)
- File type validation prevents malicious uploads
- File size limits prevent abuse
- Consider implementing authentication for file server in production 