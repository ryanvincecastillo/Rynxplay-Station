# RYNXPLAY STATION Admin Panel

A modern, real-time admin dashboard for managing RYNXPLAY STATION computer shop operations.

## Features

- 📊 **Dashboard** - Real-time overview of devices, sessions, members, and revenue
- 🖥️ **Device Management** - View, approve, and control devices remotely
- 👥 **Member Management** - Manage customer accounts and credits
- ⏱️ **Session Monitoring** - Track active and historical sessions
- 💰 **Transaction History** - View all financial transactions
- ⚙️ **Settings** - Configure organization, branches, rates, and staff

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Zustand** - State management
- **Supabase** - Backend (PostgreSQL + Realtime + Auth)
- **Lucide React** - Icons
- **React Router** - Navigation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase project with RYNXPLAY schema

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd rynxplay-station-admin

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── Modal.tsx
│   ├── StatCard.tsx
│   ├── DeviceCard.tsx
│   ├── EmptyState.tsx
│   ├── LoadingSpinner.tsx
│   └── Toasts.tsx
├── pages/           # Page components
│   ├── DashboardPage.tsx
│   ├── DevicesPage.tsx
│   ├── MembersPage.tsx
│   ├── SessionsPage.tsx
│   ├── TransactionsPage.tsx
│   ├── SettingsPage.tsx
│   └── LoginPage.tsx
├── stores/          # Zustand stores
│   └── appStore.ts
├── lib/             # Utilities and services
│   ├── supabase.ts
│   └── utils.ts
├── types/           # TypeScript types
│   └── index.ts
├── App.tsx          # Main app with routing
├── main.tsx         # Entry point
└── index.css        # Global styles
```

## Pages

### Dashboard
- Stats cards (devices, sessions, members, revenue)
- Active sessions list
- Pending devices requiring approval
- Device status overview

### Devices
- Grid/list view of all devices
- Pending device approval workflow
- Device details with system specs
- Remote commands (shutdown, restart, lock, message)

### Members
- Member list with search and filters
- Add/edit member accounts
- Credit management (add credits)
- View member details and history

### Sessions
- Active sessions with real-time updates
- Session history with filters
- Session details (device, user, duration, charges)
- End session capability

### Transactions
- Transaction history with filters
- Transaction types (top-up, usage, refund, adjustment)
- Export functionality

### Settings
- Organization settings
- Branch management
- Rate configuration
- Staff management (coming soon)

## Design System

The admin panel uses a custom dark theme with:
- **Primary color**: Cyan (#00d4f5)
- **Background**: Dark slate tones
- **Glass morphism** effects
- **Smooth animations** and transitions
- **Status indicators** with glow effects

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` folder, ready for deployment.

## License

MIT License - see LICENSE file for details.

## Support

For support, contact your RYNXPLAY STATION administrator.
