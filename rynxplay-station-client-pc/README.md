# RYNXPLAY STATION - Client PC Application

A cross-platform Electron application for computer shop PC management. This client app handles device locking, session management, and real-time synchronization with the RYNXPLAY STATION cloud backend.

## Features

- 🆔 **Auto Device ID** - Generates unique device code with QR for easy registration
- 💻 **System Specs** - Automatically detects and displays PC specifications
- 🔒 **Device Locking** - Full-screen lock overlay that prevents unauthorized access
- ⏱️ **Guest Sessions** - Countdown timer for pay-per-time usage
- 👤 **Member Login** - PIN-based authentication for registered members
- 💳 **Credit System** - Real-time credit charging for member sessions
- 📡 **Real-time Sync** - Live updates via Supabase Realtime
- 🖥️ **Remote Control** - Support for admin commands (shutdown, restart, messages)

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first styling
- **Zustand** - State management
- **Supabase** - Backend (PostgreSQL + Realtime)
- **systeminformation** - Hardware detection
- **qrcode** - QR code generation

## Prerequisites

- Node.js 18+
- npm 9+
- A running Supabase project with the RYNXPLAY schema

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd rynxplay-station-client-pc

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

## Configuration

Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Registration Flow

1. **Launch the app** - The client automatically generates a unique device code
2. **View QR Code** - The setup screen displays a QR code and device code
3. **Enter device name** - Optionally customize the device name
4. **Click Register** - The device registers as "pending" in the database
5. **Admin approval** - An administrator adds the device via the admin dashboard
6. **Auto-activation** - The client automatically detects approval and transitions to the lock screen

### Admin Dashboard Steps

1. Go to **Devices** → **Add New Device**
2. Scan the QR code OR enter the device code manually
3. Select the **Organization** and **Branch**
4. Assign a **Rate** (pricing)
5. Click **Add Device**

The client PC will automatically detect the approval and become active.

## Development

```bash
# Start in development mode with hot reload
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Building for Distribution

```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

Built packages will be in the `dist` folder.

## Project Structure

```
src/
├── main/                    # Electron main process
│   └── index.ts            # Window management, IPC handlers, system info
├── preload/                 # Preload scripts
│   ├── index.ts            # Secure IPC bridge
│   └── index.d.ts          # Type definitions
└── renderer/               # React application
    ├── index.html          # HTML entry
    └── src/
        ├── main.tsx        # React entry
        ├── App.tsx         # Root component
        ├── index.css       # Global styles
        ├── components/     # UI components
        │   ├── SetupScreen.tsx     # QR code & specs display
        │   ├── PendingScreen.tsx   # Waiting for approval
        │   ├── LockScreen.tsx      # Device lock
        │   ├── SessionScreen.tsx   # Active session
        │   └── MessageOverlay.tsx  # Admin messages
        ├── stores/         # State management
        │   └── appStore.ts
        ├── lib/            # Utilities
        │   └── supabase.ts
        └── types/          # TypeScript types
            └── index.ts
```

## Screens

### Setup Screen
- Displays unique device code with QR code
- Shows comprehensive system specifications
- Device name input field
- Register button to submit to database

### Pending Screen
- Shows when device is registered but not yet approved
- Displays QR code and device code for admin
- Instructions for admin approval process
- Auto-updates when device is approved

### Lock Screen
Full-screen overlay that displays:
- Current time and date
- Device name and code
- Member login option
- Instructions for guest access

### Session Screen
Floating panel during active sessions showing:
- Time remaining (guest) or credit balance (member)
- Session duration
- Current rate
- End session button

## System Specifications Collected

- **CPU**: Model, manufacturer, speed, cores
- **Memory**: Total RAM, used, free
- **Graphics**: GPU model(s), VRAM
- **Storage**: Total disk space, used, free
- **OS**: Platform, distribution, version, architecture
- **Network**: MAC address, IP address

## Session Types

### Guest Sessions
- Started via the kiosk app (coin payment)
- Uses countdown timer
- Auto-locks when time expires

### Member Sessions
- Started by logging in with username + PIN
- Charges credits every 60 seconds
- Auto-ends when credits run out

## Remote Commands

The admin panel can send commands to devices:

| Command | Description |
|---------|-------------|
| `shutdown` | Shuts down the PC after 30 seconds |
| `restart` | Restarts the PC after 30 seconds |
| `lock` | Ends current session and locks the device |
| `message` | Displays a message to the user |

## Security

- Device locking uses full-screen kiosk mode
- All IPC communication uses context isolation
- Supabase Row Level Security protects data
- Local config is stored securely via electron-store
- Environment variables for sensitive credentials

## Troubleshooting

### "Supabase is not configured" error
- Ensure `.env` file exists with valid credentials
- Check that environment variables start with `VITE_`
- Restart the application after changing `.env`

### Device not appearing in admin dashboard
- Verify Supabase connection (check console for errors)
- Ensure the device has internet connectivity
- Check that the `devices` table has correct RLS policies

### Real-time updates not working
- Verify Supabase Realtime is enabled for your project
- Check WebSocket connection in browser dev tools
- Ensure RLS policies allow reading device updates

### System specs not loading
- The `systeminformation` package may need elevated permissions
- On Linux, some info requires `sudo` access
- Check console for specific errors

## License

MIT License - see LICENSE file for details.

## Support

For support, contact your RYNXPLAY STATION administrator or visit the help center.
