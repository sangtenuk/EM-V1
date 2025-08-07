import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req.body.type || 'image';
    const uploadPath = path.join(__dirname, 'public', 'uploads', type);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const fileName = req.body.fileName || `${Date.now()}_${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
    cb(null, fileName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = `/uploads/${req.body.type || 'image'}/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${filePath}`;

    res.json({
      success: true,
      filePath: filePath,
      url: fullUrl,
      fileName: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get uploaded files
app.get('/api/files/:type', (req, res) => {
  try {
    const type = req.params.type;
    const uploadPath = path.join(__dirname, 'public', 'uploads', type);
    
    if (!fs.existsSync(uploadPath)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(uploadPath)
      .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i))
      .map(file => ({
        name: file,
        path: `/uploads/${type}/${file}`,
        url: `${req.protocol}://${req.get('host')}/uploads/${type}/${file}`
      }));
    
    res.json({ files });
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Delete file endpoint
app.delete('/api/files/:type/:filename', (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(__dirname, 'public', 'uploads', type, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`File server running on port ${PORT}`);
  console.log(`Upload endpoint: http://localhost:${PORT}/api/upload`);
  console.log(`Files served from: http://localhost:${PORT}/uploads/`);
}); 