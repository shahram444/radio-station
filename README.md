# 📻 Professional Radio Station

A complete, professional radio station that streams live audio content to anyone with the link. Features a beautiful listener interface and a powerful admin dashboard for managing your station.

![Radio Station](https://img.shields.io/badge/Status-Ready-green) ![Node.js](https://img.shields.io/badge/Node.js-18+-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### For Listeners
- 🎧 **Live streaming** - Real-time audio playback synced across all listeners
- 🎨 **Beautiful interface** - Modern, responsive design with visualizer
- 📱 **Mobile friendly** - Works on any device
- 🕐 **Now playing info** - See current track, artist, album, and cover art
- 📜 **Recently played** - View listening history
- 👥 **Listener count** - See how many people are tuned in

### For Admins
- 📁 **Drag & drop uploads** - Upload single or multiple audio files
- 🏷️ **Auto metadata extraction** - Automatically reads title, artist, album, cover art
- 🌐 **Online audio sources** - Add URLs to online audio files and live streams
- 📄 **Import playlists** - Import M3U/PLS playlist files
- 🎵 **Playlist management** - Add, remove, reorder tracks
- 🔀 **Shuffle** - Randomize your playlist
- ⏯️ **Playback controls** - Play, pause, skip, previous
- ⚙️ **Station settings** - Customize name and description
- 📊 **Live stats** - Monitor listeners in real-time

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm

### Installation

1. **Navigate to the radio-station directory:**
   ```bash
   cd radio-station
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access your station:**
   - **Listener Page:** http://localhost:3000
   - **Admin Panel:** http://localhost:3000/admin

## 📖 How to Use

### Step 1: Upload Your Music

1. Go to the **Admin Panel**: http://localhost:3000/admin
2. Click on **"Upload"** in the sidebar
3. **Drag and drop** your audio files or click to browse
4. Supported formats: MP3, WAV, OGG, M4A, FLAC, AAC
5. The system automatically extracts:
   - Song title
   - Artist name
   - Album name
   - Album cover art
   - Duration

### Step 2: Start Broadcasting

1. Go to **Dashboard** in the admin panel
2. Click the **Play button** to start streaming
3. The radio will automatically play through your playlist
4. When a track ends, the next one starts automatically

### Step 2b: Add Online Audio Sources (Optional)

1. Go to **Online Sources** in the admin panel
2. You can add audio in several ways:

**Single URL:**
- Enter a direct audio URL (MP3, OGG, etc.)
- Fill in title, artist, and other details
- Click "Add to Playlist"

**Bulk URLs:**
- Paste multiple URLs (one per line)
- Click "Add All URLs"

**Import Playlist File:**
- Drag & drop an M3U or PLS file
- All tracks are automatically imported

**Sample Streams:**
- Click any sample stream (BBC Radio, SomaFM, etc.)
- Instantly adds to your playlist

### Step 3: Share with Listeners

1. Go to **Settings** in the admin panel
2. Copy the **Listener URL** (e.g., http://localhost:3000)
3. Share this link with anyone who wants to listen
4. They'll see:
   - Current track info and cover art
   - Audio visualizer
   - Progress bar
   - Volume control
   - Listener count

## 🎨 What Listeners See

When someone visits your radio station, they see:

```
┌─────────────────────────────────────────┐
│         🎵 [Station Name]     🔴 LIVE   │
├─────────────────────────────────────────┤
│                                         │
│          ┌─────────────────┐            │
│          │                 │            │
│          │   Album Art     │            │
│          │                 │            │
│          └─────────────────┘            │
│            🎵🎵🎵🎵🎵🎵🎵               │
│                                         │
│           Song Title                    │
│           Artist Name                   │
│           Album Name                    │
│                                         │
│      ━━━━━━━━━━━━━━━━━━━━━━━━━         │
│      0:45          ▶️          3:24     │
│                                         │
│      🔊 ━━━━━━━━━━━━━                   │
│                                         │
│      👥 12 Listeners    📻 45 Tracks    │
│                                         │
└─────────────────────────────────────────┘
```

## 🛠️ Admin Controls

### Dashboard
- View currently playing track
- Control playback (play/pause/skip)
- See live listener count
- Quick view of upcoming tracks

### Playlist Manager
- View all uploaded tracks
- Click any track to play it immediately
- Delete tracks you don't want
- Shuffle the entire playlist

### Upload
- Drag & drop multiple files
- See upload progress
- Files are processed and added to playlist automatically

### Settings
- Change station name
- Update station description
- Copy shareable listener link

## 🌐 Deploying for Public Access

### Option 1: Using ngrok (Quick & Easy)

1. Install ngrok: https://ngrok.com/download
2. Start your radio: `npm start`
3. In another terminal: `ngrok http 3000`
4. Share the ngrok URL with listeners

### Option 2: Deploy to a VPS

1. Get a VPS (DigitalOcean, Linode, AWS, etc.)
2. Install Node.js on the server
3. Upload the radio-station folder
4. Run `npm install` and `npm start`
5. Configure your domain to point to the server
6. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "radio"
   pm2 startup
   pm2 save
   ```

### Option 3: Deploy to Railway/Render

1. Push code to GitHub
2. Connect to Railway or Render
3. Deploy automatically
4. Get your public URL

## 📁 File Structure

```
radio-station/
├── server.js           # Main server file
├── package.json        # Dependencies
├── public/
│   └── index.html      # Listener interface
├── admin/
│   └── index.html      # Admin dashboard
├── uploads/            # Uploaded audio files
├── playlists/
│   ├── main.json       # Playlist data
│   └── station.json    # Station settings
└── logs/               # Server logs
```

## ⚙️ Configuration

### Change Port
```bash
PORT=8080 npm start
```

### Environment Variables
- `PORT` - Server port (default: 3000)

## 🎵 Supported Audio Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| MP3 | .mp3 | Best metadata support |
| WAV | .wav | Lossless, larger files |
| OGG | .ogg | Open format |
| M4A | .m4a | Good quality/size ratio |
| FLAC | .flac | Lossless |
| AAC | .aac | Efficient compression |

## 🔧 Troubleshooting

### No sound playing?
- Make sure you clicked the play button on the listener page
- Check browser autoplay settings
- Ensure audio files were uploaded correctly

### Metadata not showing?
- The audio file might not have embedded metadata
- Try using MP3 files with proper ID3 tags
- You can edit metadata in the admin panel

### Upload failing?
- Check file size (max 100MB)
- Ensure file format is supported
- Check server logs for errors

## 📝 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get current radio status |
| `/api/playlist` | GET | Get full playlist |
| `/api/upload` | POST | Upload single file |
| `/api/upload-multiple` | POST | Upload multiple files |
| `/api/add-url` | POST | Add online audio URL |
| `/api/add-playlist` | POST | Add multiple URLs at once |
| `/api/import-playlist` | POST | Import M3U/PLS file |
| `/api/track/:id` | PUT | Update track metadata |
| `/api/track/:id` | DELETE | Delete a track |
| `/api/control/play` | POST | Start playback |
| `/api/control/pause` | POST | Pause playback |
| `/api/control/next` | POST | Skip to next |
| `/api/control/previous` | POST | Go to previous |
| `/api/station` | GET/PUT | Station settings |

## 📄 License

MIT License - Feel free to use for personal or commercial projects!

---

Made with ❤️ for music lovers everywhere
