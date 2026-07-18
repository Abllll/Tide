# Shokz Audio

A cross-platform desktop tool to download audio from YouTube videos and Apple Podcasts, convert them to MP3, adjust playback speed, and automatically sync files to MP3 devices (like Shokz OpenSwim) for offline playback.

## Features

### 🎧 Audio Downloads
- **YouTube Support**: Paste any YouTube video URL to extract high-quality audio.
- **Apple Podcasts**: Download episodes directly from Apple Podcast URLs.
- **Format**: Automatically converts to MP3 format.
- **Speed Adjustment**: Speed up content (0.5x to 2.0x) before downloading—perfect for long podcasts.
- **Smart Chunking**: Automatically splits long audio files (>30 mins) into equal segments (e.g., a 44-minute podcast becomes two 22-minute files) so no content is lost.

### 📥 Queue System
- **Batch Processing**: Add multiple URLs to the queue.
- **Concurrent Downloads**: Downloads multiple files simultaneously for speed.
- **Live Progress**: See real-time download statistics and logs.

### 🔄 USB Sync & Management
- **Device Detection**: Automatically detects connected USB audio players.
- **Auto-Sync**: Seamlessly transfer downloaded files to your device.
- **Unified Library**: View and manage files on both your computer and connected device.
- **Easy Cleanup**: Delete files from local storage and USB device in one click.

## Installation

### Prerequisites
- This application bundles `yt-dlp` and `ffmpeg`, so no external dependencies are required for core functionality.

### yt-dlp auto-update
`yt-dlp` breaks whenever sites change their internals, so the app does not rely on
the frozen bundled copy. On every launch it silently refreshes `yt-dlp` from the
[nightly channel](https://github.com/yt-dlp/yt-dlp-nightly-builds) into a writable
per-user cache (best-effort — a failed update never breaks a working install).
Your system `yt-dlp`, if any, is never touched or used.

### Uninstalling
Remove the app the usual way for your platform. The auto-updated `yt-dlp` lives in
a regenerable cache dir; on Windows the uninstaller removes it automatically, on
macOS/Linux it is harmless to leave but can be deleted manually:
- **macOS:** `~/Library/Caches/com.shokz.audio/`
- **Linux:** `~/.cache/com.shokz.audio/`

Downloaded audio is stored separately (your chosen library folder) and is never
removed by uninstalling.

### Running from Source
1. Ensure you have Rust and Node.js installed.
2. Clone the repository.
3. Install frontend dependencies:
   ```bash
   cd shokz-audio-app
   npm install
   ```
4. Run the development server:
   ```bash
   npm run tauri dev
   ```

## Usage

1. **Add Content**: Paste a YouTube or Apple Podcast URL into the input field.
2. **Adjust Speed**: Select your preferred playback speed (default 1.0x).
3. **Download**: Click "Add" to start processing.
4. **Sync**: Connect your USB device. Select it from the dropdown to automatically sync files.

## Planned Features
- **UI Enhancements**: Improved progress visualization.
