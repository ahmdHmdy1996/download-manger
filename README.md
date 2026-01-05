# Download Manager

A powerful, modern download manager for Windows PC built with Electron, similar to Internet Download Manager (IDM).

## Features

### Core Functionality

- **Multi-threaded Downloads**: Splits files into multiple chunks for faster downloads
- **Pause & Resume**: Pause and resume downloads at any time
- **Download Queue**: Manage multiple downloads simultaneously
- **Smart Segmentation**: Automatically detects if server supports range requests

### User Interface

- **Modern Dark Theme**: Beautiful gradient-based UI with smooth animations
- **Real-time Progress**: Live download speed and progress tracking
- **System Tray Integration**: Minimize to tray and quick access
- **Settings Panel**: Customize download location, max connections, and more

### Advanced Features

- **Speed Statistics**: Monitor download speeds in real-time
- **Download History**: Track completed and active downloads
- **Configurable Connections**: Set max connections per download (1-16)
- **Speed Limiter**: Optional speed limiting (coming soon)

## Installation

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Run the Application**

   ```bash
   npm start
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

## Usage

### Adding a Download

1. Paste the download URL in the input field at the top
2. Click "Add Download" or press Enter
3. The download will start automatically (if auto-start is enabled)

### Managing Downloads

- **Pause**: Click the pause button on any active download
- **Resume**: Click the play button on paused downloads
- **Cancel**: Click the X button to cancel a download
- **Remove**: Click the trash icon to remove from list

### Settings

Click the settings icon in the top-right corner to configure:

- **Download Location**: Choose where files are saved
- **Max Connections**: Set number of simultaneous connections per download (1-16)
- **Speed Limit**: Limit download speed (0 = unlimited)
- **Auto-start**: Automatically start downloads when added

## Technical Details

### Architecture

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js with Electron
- **Download Engine**: Custom multi-threaded downloader using Axios
- **Storage**: electron-store for persistent settings

### How Multi-threading Works

1. The app sends a HEAD request to check file size and range support
2. If supported, the file is split into 8 chunks (configurable)
3. Each chunk is downloaded in parallel
4. Chunks are merged into the final file
5. Temporary chunk files are cleaned up

### File Structure

```
download-app/
├── main.js                 # Electron main process
├── package.json           # Dependencies and scripts
├── src/
│   ├── downloadManager.js # Core download engine
│   └── ui/
│       ├── index.html     # Main UI
│       ├── styles.css     # Styling
│       └── app.js         # Frontend logic
└── assets/
    └── icon.png           # App icon
```

## System Requirements

- Windows 10 or later
- Node.js 16 or later
- 100MB free disk space

## Keyboard Shortcuts

- `Enter` in URL field: Add download
- `Esc` in settings modal: Close settings

## Chrome Extension Setup

To enable browser integration (automatic download capture & video sniffing):

1.  **Register the Native Host**:

    - Navigate to the `native-host` folder inside the project.
    - Right-click `register.ps1` and select "Run with PowerShell" (or run `register.reg` manually).
    - _This registers the app with Windows so Chrome can talk to it._

2.  **Install the Extension**:

    - Open Chrome and go to `chrome://extensions`.
    - Enable **Developer Mode** (top right).
    - Click **Load Unpacked**.
    - Select the `extension` folder inside the project directory.

3.  **Link Extension to App**:
    - Copy the **ID** of the installed extension (e.g., `abcdef...`).
    - Open `native-host/com.downloadmanager.native.json`.
    - Update the `allowed_origins` field with your ID: `chrome-extension://YOUR_ID/`.
    - _Restart the Electron app for changes to take effect._

## Troubleshooting

### Downloads not starting

- Check your internet connection
- Verify the URL is accessible
- Some servers may block range requests

### Slow download speeds

- Increase max connections in settings
- Check if your ISP is throttling
- Server may have speed limits

### Application won't start

- Ensure Node.js is installed
- Run `npm install` to install dependencies
- Check console for error messages

## Future Enhancements

- Browser integration (Chrome/Firefox extensions)
- Download scheduling
- Category management
- Speed limiter implementation
- Batch download support
- Video grabber from websites

## License

MIT License - Feel free to use and modify

## Credits

Built with AhmedDiboo using Electron and Node.js
