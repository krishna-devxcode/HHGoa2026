// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Configure multer for memory storage (we'll save after generating the share ID)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Serve static files (for serving the shared images and pages)
app.use('/share', express.static(path.join(__dirname, 'uploads')));

// Generate a unique ID for each share
function generateShareId() {
  return crypto.randomBytes(8).toString('hex');
}

// POST /api/upload – receives image, saves it, returns shareable URL
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const shareId = generateShareId();
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `${shareId}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Save the file
    fs.writeFileSync(filepath, req.file.buffer);

    // Optionally: store caption and metadata in a JSON file or DB
    const metadata = {
      id: shareId,
      filename,
      caption: req.body.caption || '',
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(uploadDir, `${shareId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    // Return the shareable URL
    const shareUrl = `http://localhost:${PORT}/share/${filename}`;
    res.json({ shareUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve a simple HTML page for the shared image with OG tags
app.get('/share/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadDir, filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('Image not found');
  }

  // Try to load metadata
  const metaPath = path.join(uploadDir, filename.replace(/\.[^.]+$/, '') + '.json');
  let caption = 'Hacker House Goa 2026 🌴 #FrameInGoa';
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.caption) caption = meta.caption;
    } catch (_) {}
  }

  // Serve an HTML page with OG meta tags pointing to the actual image
  const imageUrl = `http://localhost:${PORT}/share/${filename}`;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta property="og:title" content="${caption}">
        <meta property="og:description" content="Hacker House Goa 2026 — #FrameInGoa">
        <meta property="og:image" content="${imageUrl}">
        <meta property="og:url" content="${imageUrl}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:image" content="${imageUrl}">
        <meta http-equiv="refresh" content="0; url=${imageUrl}">
        <title>HH Goa 2026</title>
      </head>
      <body>
        <img src="${imageUrl}" alt="HH Goa 2026" style="max-width:100%;height:auto;">
      </body>
    </html>
  `);
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all route to serve index.html (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
  console.log(`   Upload endpoint: POST /api/upload`);
  console.log(`   Share URLs: http://localhost:${PORT}/share/{filename}`);
});