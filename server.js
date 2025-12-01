const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseFile } = require('music-metadata');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuration
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PLAYLIST_FILE = path.join(__dirname, 'playlists', 'main.json');
const CHUNK_SIZE = 65536; // 64KB chunks for streaming

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static('admin'));
app.use('/uploads', express.static('uploads'));

// Storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    },
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Radio State
let radioState = {
    isPlaying: false,
    currentTrack: null,
    currentIndex: 0,
    playlist: [],
    startTime: null,
    listeners: 0,
    volume: 1,
    history: []
};

// Load playlist from file
function loadPlaylist() {
    try {
        if (fs.existsSync(PLAYLIST_FILE)) {
            const data = fs.readFileSync(PLAYLIST_FILE, 'utf8');
            radioState.playlist = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading playlist:', error);
        radioState.playlist = [];
    }
}

// Save playlist to file
function savePlaylist() {
    try {
        const dir = path.dirname(PLAYLIST_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(radioState.playlist, null, 2));
    } catch (error) {
        console.error('Error saving playlist:', error);
    }
}

// Extract metadata from audio file
async function extractMetadata(filePath, originalName) {
    try {
        const metadata = await parseFile(filePath);
        return {
            title: metadata.common.title || path.basename(originalName, path.extname(originalName)),
            artist: metadata.common.artist || 'Unknown Artist',
            album: metadata.common.album || 'Unknown Album',
            year: metadata.common.year || null,
            genre: metadata.common.genre ? metadata.common.genre[0] : 'Unknown',
            duration: metadata.format.duration || 0,
            bitrate: metadata.format.bitrate || 0,
            sampleRate: metadata.format.sampleRate || 0,
            cover: metadata.common.picture && metadata.common.picture[0] 
                ? `data:${metadata.common.picture[0].format};base64,${metadata.common.picture[0].data.toString('base64')}`
                : null
        };
    } catch (error) {
        console.error('Error extracting metadata:', error);
        return {
            title: path.basename(originalName, path.extname(originalName)),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            year: null,
            genre: 'Unknown',
            duration: 0,
            bitrate: 0,
            sampleRate: 0,
            cover: null
        };
    }
}

// Broadcast current state to all listeners
function broadcastState() {
    const state = {
        isPlaying: radioState.isPlaying,
        currentTrack: radioState.currentTrack,
        listeners: radioState.listeners,
        playlist: radioState.playlist.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration,
            cover: t.cover
        })),
        currentIndex: radioState.currentIndex,
        elapsedTime: radioState.startTime ? (Date.now() - radioState.startTime) / 1000 : 0,
        history: radioState.history.slice(-10)
    };
    io.emit('radioState', state);
}

// Play next track
function playNextTrack() {
    if (radioState.playlist.length === 0) {
        radioState.isPlaying = false;
        radioState.currentTrack = null;
        broadcastState();
        return;
    }

    // Add current track to history
    if (radioState.currentTrack) {
        radioState.history.push({
            ...radioState.currentTrack,
            playedAt: new Date().toISOString()
        });
        if (radioState.history.length > 50) {
            radioState.history.shift();
        }
    }

    radioState.currentIndex = (radioState.currentIndex + 1) % radioState.playlist.length;
    radioState.currentTrack = radioState.playlist[radioState.currentIndex];
    radioState.startTime = Date.now();
    radioState.isPlaying = true;

    console.log(`Now playing: ${radioState.currentTrack.title} by ${radioState.currentTrack.artist}`);
    broadcastState();

    // Schedule next track
    if (radioState.currentTrack.duration > 0) {
        setTimeout(() => {
            if (radioState.isPlaying) {
                playNextTrack();
            }
        }, radioState.currentTrack.duration * 1000);
    }
}

// Start playing
function startRadio() {
    if (radioState.playlist.length === 0) {
        return false;
    }
    
    if (!radioState.isPlaying) {
        radioState.currentIndex = -1; // Will be incremented to 0
        playNextTrack();
    }
    return true;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    radioState.listeners++;
    console.log(`Listener connected. Total: ${radioState.listeners}`);
    
    // Send current state to new listener
    socket.emit('radioState', {
        isPlaying: radioState.isPlaying,
        currentTrack: radioState.currentTrack,
        listeners: radioState.listeners,
        playlist: radioState.playlist.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration,
            cover: t.cover
        })),
        currentIndex: radioState.currentIndex,
        elapsedTime: radioState.startTime ? (Date.now() - radioState.startTime) / 1000 : 0,
        history: radioState.history.slice(-10)
    });

    // Broadcast updated listener count
    io.emit('listenerCount', radioState.listeners);

    socket.on('disconnect', () => {
        radioState.listeners--;
        console.log(`Listener disconnected. Total: ${radioState.listeners}`);
        io.emit('listenerCount', radioState.listeners);
    });
});

// ==================== API ROUTES ====================

// Get radio status
app.get('/api/status', (req, res) => {
    res.json({
        isPlaying: radioState.isPlaying,
        currentTrack: radioState.currentTrack,
        listeners: radioState.listeners,
        playlistLength: radioState.playlist.length,
        elapsedTime: radioState.startTime ? (Date.now() - radioState.startTime) / 1000 : 0
    });
});

// Get playlist
app.get('/api/playlist', (req, res) => {
    res.json(radioState.playlist);
});

// Upload track
app.post('/api/upload', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const metadata = await extractMetadata(req.file.path, req.file.originalname);
        
        const track = {
            id: uuidv4(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: `/uploads/${req.file.filename}`,
            ...metadata,
            addedAt: new Date().toISOString()
        };

        radioState.playlist.push(track);
        savePlaylist();
        broadcastState();

        res.json({ success: true, track });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload multiple tracks
app.post('/api/upload-multiple', upload.array('audio', 50), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const tracks = [];
        for (const file of req.files) {
            const metadata = await extractMetadata(file.path, file.originalname);
            const track = {
                id: uuidv4(),
                filename: file.filename,
                originalName: file.originalname,
                path: `/uploads/${file.filename}`,
                ...metadata,
                addedAt: new Date().toISOString()
            };
            tracks.push(track);
            radioState.playlist.push(track);
        }

        savePlaylist();
        broadcastState();

        res.json({ success: true, tracks, count: tracks.length });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update track metadata
app.put('/api/track/:id', (req, res) => {
    const { id } = req.params;
    const { title, artist, album, genre } = req.body;

    const trackIndex = radioState.playlist.findIndex(t => t.id === id);
    if (trackIndex === -1) {
        return res.status(404).json({ error: 'Track not found' });
    }

    if (title) radioState.playlist[trackIndex].title = title;
    if (artist) radioState.playlist[trackIndex].artist = artist;
    if (album) radioState.playlist[trackIndex].album = album;
    if (genre) radioState.playlist[trackIndex].genre = genre;

    savePlaylist();
    broadcastState();

    res.json({ success: true, track: radioState.playlist[trackIndex] });
});

// Delete track
app.delete('/api/track/:id', (req, res) => {
    const { id } = req.params;
    const trackIndex = radioState.playlist.findIndex(t => t.id === id);
    
    if (trackIndex === -1) {
        return res.status(404).json({ error: 'Track not found' });
    }

    const track = radioState.playlist[trackIndex];
    
    // Delete file
    try {
        fs.unlinkSync(path.join(UPLOADS_DIR, track.filename));
    } catch (error) {
        console.error('Error deleting file:', error);
    }

    radioState.playlist.splice(trackIndex, 1);
    
    // Adjust current index if needed
    if (trackIndex < radioState.currentIndex) {
        radioState.currentIndex--;
    } else if (trackIndex === radioState.currentIndex) {
        if (radioState.isPlaying) {
            playNextTrack();
        }
    }

    savePlaylist();
    broadcastState();

    res.json({ success: true });
});

// Reorder playlist
app.post('/api/playlist/reorder', (req, res) => {
    const { fromIndex, toIndex } = req.body;
    
    if (fromIndex < 0 || fromIndex >= radioState.playlist.length ||
        toIndex < 0 || toIndex >= radioState.playlist.length) {
        return res.status(400).json({ error: 'Invalid indices' });
    }

    const [track] = radioState.playlist.splice(fromIndex, 1);
    radioState.playlist.splice(toIndex, 0, track);

    // Adjust current index
    if (radioState.currentIndex === fromIndex) {
        radioState.currentIndex = toIndex;
    } else if (fromIndex < radioState.currentIndex && toIndex >= radioState.currentIndex) {
        radioState.currentIndex--;
    } else if (fromIndex > radioState.currentIndex && toIndex <= radioState.currentIndex) {
        radioState.currentIndex++;
    }

    savePlaylist();
    broadcastState();

    res.json({ success: true });
});

// Shuffle playlist
app.post('/api/playlist/shuffle', (req, res) => {
    for (let i = radioState.playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [radioState.playlist[i], radioState.playlist[j]] = [radioState.playlist[j], radioState.playlist[i]];
    }
    
    radioState.currentIndex = 0;
    savePlaylist();
    broadcastState();

    res.json({ success: true });
});

// Control: Play
app.post('/api/control/play', (req, res) => {
    if (startRadio()) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Playlist is empty' });
    }
});

// Control: Pause
app.post('/api/control/pause', (req, res) => {
    radioState.isPlaying = false;
    broadcastState();
    res.json({ success: true });
});

// Control: Skip to next
app.post('/api/control/next', (req, res) => {
    playNextTrack();
    res.json({ success: true });
});

// Control: Skip to previous
app.post('/api/control/previous', (req, res) => {
    radioState.currentIndex = radioState.currentIndex - 2;
    if (radioState.currentIndex < -1) {
        radioState.currentIndex = radioState.playlist.length - 2;
    }
    playNextTrack();
    res.json({ success: true });
});

// Control: Play specific track
app.post('/api/control/play/:id', (req, res) => {
    const { id } = req.params;
    const trackIndex = radioState.playlist.findIndex(t => t.id === id);
    
    if (trackIndex === -1) {
        return res.status(404).json({ error: 'Track not found' });
    }

    radioState.currentIndex = trackIndex - 1;
    playNextTrack();
    res.json({ success: true });
});

// Audio stream endpoint
app.get('/stream', (req, res) => {
    if (!radioState.currentTrack) {
        return res.status(404).send('No track playing');
    }

    const filePath = path.join(UPLOADS_DIR, radioState.currentTrack.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Audio file not found');
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'audio/mpeg'
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': 'audio/mpeg'
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

// Get history
app.get('/api/history', (req, res) => {
    res.json(radioState.history.slice(-20).reverse());
});

// Add track from URL
app.post('/api/add-url', async (req, res) => {
    try {
        const { url, title, artist, album, duration, cover } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const track = {
            id: uuidv4(),
            filename: null,
            originalName: url,
            path: url,
            isOnline: true,
            title: title || 'Online Track',
            artist: artist || 'Unknown Artist',
            album: album || 'Online',
            year: null,
            genre: 'Online',
            duration: duration || 0,
            bitrate: 0,
            sampleRate: 0,
            cover: cover || null,
            addedAt: new Date().toISOString()
        };

        radioState.playlist.push(track);
        savePlaylist();
        broadcastState();

        res.json({ success: true, track });
    } catch (error) {
        console.error('Add URL error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add multiple URLs (playlist import)
app.post('/api/add-playlist', async (req, res) => {
    try {
        const { tracks } = req.body;
        
        if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
            return res.status(400).json({ error: 'Tracks array is required' });
        }

        const addedTracks = [];
        
        for (const item of tracks) {
            if (!item.url) continue;
            
            try {
                new URL(item.url);
            } catch (e) {
                continue; // Skip invalid URLs
            }

            const track = {
                id: uuidv4(),
                filename: null,
                originalName: item.url,
                path: item.url,
                isOnline: true,
                title: item.title || 'Online Track',
                artist: item.artist || 'Unknown Artist',
                album: item.album || 'Online',
                year: null,
                genre: item.genre || 'Online',
                duration: item.duration || 0,
                bitrate: 0,
                sampleRate: 0,
                cover: item.cover || null,
                addedAt: new Date().toISOString()
            };

            radioState.playlist.push(track);
            addedTracks.push(track);
        }

        savePlaylist();
        broadcastState();

        res.json({ success: true, tracks: addedTracks, count: addedTracks.length });
    } catch (error) {
        console.error('Add playlist error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Import M3U/PLS playlist
app.post('/api/import-playlist', upload.single('playlist'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No playlist file uploaded' });
        }

        const content = fs.readFileSync(req.file.path, 'utf8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        const tracks = [];

        // Parse M3U format
        if (req.file.originalname.endsWith('.m3u') || req.file.originalname.endsWith('.m3u8')) {
            let currentTitle = null;
            let currentDuration = 0;

            for (const line of lines) {
                if (line.startsWith('#EXTM3U')) continue;
                
                if (line.startsWith('#EXTINF:')) {
                    // Format: #EXTINF:duration,Artist - Title
                    const match = line.match(/#EXTINF:(-?\d+),(.+)/);
                    if (match) {
                        currentDuration = parseInt(match[1]) > 0 ? parseInt(match[1]) : 0;
                        currentTitle = match[2].trim();
                    }
                } else if (line.startsWith('http://') || line.startsWith('https://')) {
                    let title = currentTitle || 'Online Track';
                    let artist = 'Unknown Artist';
                    
                    // Try to parse "Artist - Title" format
                    if (currentTitle && currentTitle.includes(' - ')) {
                        const parts = currentTitle.split(' - ');
                        artist = parts[0].trim();
                        title = parts.slice(1).join(' - ').trim();
                    }

                    tracks.push({
                        id: uuidv4(),
                        filename: null,
                        originalName: line,
                        path: line,
                        isOnline: true,
                        title: title,
                        artist: artist,
                        album: 'Imported Playlist',
                        year: null,
                        genre: 'Online',
                        duration: currentDuration,
                        bitrate: 0,
                        sampleRate: 0,
                        cover: null,
                        addedAt: new Date().toISOString()
                    });

                    currentTitle = null;
                    currentDuration = 0;
                }
            }
        }
        
        // Parse PLS format
        else if (req.file.originalname.endsWith('.pls')) {
            const entries = {};
            
            for (const line of lines) {
                const fileMatch = line.match(/^File(\d+)=(.+)$/i);
                const titleMatch = line.match(/^Title(\d+)=(.+)$/i);
                const lengthMatch = line.match(/^Length(\d+)=(.+)$/i);

                if (fileMatch) {
                    const num = fileMatch[1];
                    if (!entries[num]) entries[num] = {};
                    entries[num].url = fileMatch[2].trim();
                }
                if (titleMatch) {
                    const num = titleMatch[1];
                    if (!entries[num]) entries[num] = {};
                    entries[num].title = titleMatch[2].trim();
                }
                if (lengthMatch) {
                    const num = lengthMatch[1];
                    if (!entries[num]) entries[num] = {};
                    entries[num].duration = parseInt(lengthMatch[2]) > 0 ? parseInt(lengthMatch[2]) : 0;
                }
            }

            for (const num of Object.keys(entries).sort((a, b) => parseInt(a) - parseInt(b))) {
                const entry = entries[num];
                if (!entry.url) continue;

                let title = entry.title || 'Online Track';
                let artist = 'Unknown Artist';
                
                if (entry.title && entry.title.includes(' - ')) {
                    const parts = entry.title.split(' - ');
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                }

                tracks.push({
                    id: uuidv4(),
                    filename: null,
                    originalName: entry.url,
                    path: entry.url,
                    isOnline: true,
                    title: title,
                    artist: artist,
                    album: 'Imported Playlist',
                    year: null,
                    genre: 'Online',
                    duration: entry.duration || 0,
                    bitrate: 0,
                    sampleRate: 0,
                    cover: null,
                    addedAt: new Date().toISOString()
                });
            }
        }

        // Clean up uploaded playlist file
        fs.unlinkSync(req.file.path);

        if (tracks.length === 0) {
            return res.status(400).json({ error: 'No valid tracks found in playlist file' });
        }

        radioState.playlist.push(...tracks);
        savePlaylist();
        broadcastState();

        res.json({ success: true, tracks, count: tracks.length });
    } catch (error) {
        console.error('Import playlist error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get station info (customizable)
let stationInfo = {
    name: 'My Radio Station',
    description: 'Your favorite music, 24/7',
    logo: null,
    website: '',
    email: '',
    social: {}
};

const STATION_INFO_FILE = path.join(__dirname, 'playlists', 'station.json');

// Load station info
try {
    if (fs.existsSync(STATION_INFO_FILE)) {
        stationInfo = JSON.parse(fs.readFileSync(STATION_INFO_FILE, 'utf8'));
    }
} catch (error) {
    console.error('Error loading station info:', error);
}

app.get('/api/station', (req, res) => {
    res.json(stationInfo);
});

app.put('/api/station', (req, res) => {
    const { name, description, logo, website, email, social } = req.body;
    
    if (name) stationInfo.name = name;
    if (description) stationInfo.description = description;
    if (logo !== undefined) stationInfo.logo = logo;
    if (website !== undefined) stationInfo.website = website;
    if (email !== undefined) stationInfo.email = email;
    if (social) stationInfo.social = { ...stationInfo.social, ...social };

    try {
        fs.writeFileSync(STATION_INFO_FILE, JSON.stringify(stationInfo, null, 2));
    } catch (error) {
        console.error('Error saving station info:', error);
    }

    broadcastState();
    res.json({ success: true, stationInfo });
});

// Initialize
loadPlaylist();

// Start server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    🎵 RADIO STATION 🎵                      ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║                                                            ║
║  📻 Listener URL:  http://localhost:${PORT}                  ║
║  🔧 Admin Panel:   http://localhost:${PORT}/admin            ║
║  🎧 Audio Stream:  http://localhost:${PORT}/stream           ║
║                                                            ║
║  Tracks in playlist: ${radioState.playlist.length.toString().padEnd(35)}║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server, io };
