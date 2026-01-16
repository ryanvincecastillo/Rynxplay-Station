# RYNXPLAY STATION - System Architecture

## 📋 Overview

RYNXPLAY STATION is a cloud-based SaaS computer shop management system that enables shop owners to manage PC rentals, member credits, and device control without setting up local servers.

## 🏗️ System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RYNXPLAY STATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Client PC   │  │    Admin     │  │    Kiosk     │  │Client Mobile │    │
│  │  (Electron)  │  │   (React)    │  │  (Electron)  │  │  (Flutter)   │    │
│  │              │  │              │  │              │  │   (Later)    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         └─────────────────┼─────────────────┼─────────────────┘             │
│                           │                 │                               │
│                           ▼                 ▼                               │
│         ┌─────────────────────────────────────────────────────┐            │
│         │              SUPABASE CLOUD                          │            │
│         │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │            │
│         │  │  PostgreSQL │ │  Realtime   │ │    Edge     │    │            │
│         │  │  Database   │ │  WebSocket  │ │  Functions  │    │            │
│         │  └─────────────┘ └─────────────┘ └─────────────┘    │            │
│         │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │            │
│         │  │   Storage   │ │    Auth     │ │     RLS     │    │            │
│         │  │   (Files)   │ │   (Users)   │ │  (Security) │    │            │
│         │  └─────────────┘ └─────────────┘ └─────────────┘    │            │
│         └─────────────────────────────────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🗂️ Project Structure

```
rynxplay-station/
├── apps/
│   ├── client-pc/              # Electron app for PC locking
│   │   ├── src/
│   │   │   ├── main/           # Electron main process
│   │   │   ├── renderer/       # React UI
│   │   │   └── preload/        # Preload scripts
│   │   └── package.json
│   │
│   ├── admin/                  # React web admin panel
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── kiosk/                  # Electron kiosk app
│   │   ├── src/
│   │   │   ├── main/
│   │   │   ├── renderer/
│   │   │   └── hardware/       # Hardware integration (simulated)
│   │   └── package.json
│   │
│   └── client-mobile/          # Flutter app (future)
│       └── ...
│
├── packages/
│   ├── shared/                 # Shared types and utilities
│   │   ├── types/
│   │   ├── constants/
│   │   └── utils/
│   │
│   └── supabase-client/        # Shared Supabase client config
│       └── ...
│
├── supabase/
│   ├── migrations/             # Database migrations
│   ├── functions/              # Edge functions
│   └── seed.sql                # Seed data
│
└── docs/
    └── ...
```

## 📊 Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   organizations │       │     branches    │       │     devices     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │──┐    │ id (PK)         │
│ name            │  │    │ org_id (FK)     │  │    │ branch_id (FK)  │
│ slug            │  └───▶│ name            │  └───▶│ name            │
│ created_at      │       │ address         │       │ device_code     │
│ settings (JSON) │       │ created_at      │       │ device_type     │
└─────────────────┘       └─────────────────┘       │ rate_id (FK)    │
                                                     │ status          │
                                                     │ is_locked       │
                                                     │ last_heartbeat  │
                                                     └────────┬────────┘
                                                              │
┌─────────────────┐       ┌─────────────────┐                │
│      rates      │       │    sessions     │◀───────────────┘
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──────│ id (PK)         │
│ branch_id (FK)  │       │ device_id (FK)  │
│ name            │       │ member_id (FK)  │ (nullable for guest)
│ price_per_unit  │       │ session_type    │ (guest/member)
│ unit_minutes    │       │ rate_id (FK)    │
│ is_default      │       │ started_at      │
└─────────────────┘       │ ended_at        │
                          │ total_amount    │
                          │ status          │
                          └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     members     │       │  transactions   │       │ device_commands │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │       │ id (PK)         │
│ org_id (FK)     │  │    │ member_id (FK)  │       │ device_id (FK)  │
│ username        │  └───▶│ branch_id (FK)  │       │ command_type    │
│ pin_code        │       │ type            │       │ payload (JSON)  │
│ email           │       │ amount          │       │ status          │
│ credits         │       │ session_id (FK) │       │ created_at      │
│ created_at      │       │ created_at      │       │ executed_at     │
└─────────────────┘       │ reference       │       └─────────────────┘
                          └─────────────────┘

┌─────────────────┐
│   staff_users   │
├─────────────────┤
│ id (PK)         │
│ auth_user_id    │ (Supabase Auth)
│ org_id (FK)     │
│ branch_id (FK)  │ (nullable = all branches)
│ role            │ (owner/admin/staff)
│ name            │
│ created_at      │
└─────────────────┘
```

### SQL Schema

```sql
-- Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches (Shop Locations)
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rates Configuration
CREATE TABLE rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_per_unit DECIMAL(10,2) NOT NULL, -- e.g., 5.00
    unit_minutes INTEGER NOT NULL,          -- e.g., 30 or 20
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices (PCs)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_id UUID REFERENCES rates(id),
    name VARCHAR(100) NOT NULL,             -- e.g., "PC-001
    specs JSONB;
    device_code VARCHAR(50) UNIQUE NOT NULL, -- Unique identifier
    device_type VARCHAR(50) DEFAULT 'pc',   -- pc, mobile
    status VARCHAR(50) DEFAULT 'offline',   -- online, offline, in_use
    is_locked BOOLEAN DEFAULT TRUE,
    current_session_id UUID,
    last_heartbeat TIMESTAMPTZ,
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members (Customers with accounts)
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    pin_code VARCHAR(10) NOT NULL,          -- Simple PIN for login
    email VARCHAR(255),
    phone VARCHAR(20),
    full_name VARCHAR(255),
    credits DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, username)
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id),  -- NULL for guest sessions
    rate_id UUID REFERENCES rates(id),
    session_type VARCHAR(20) NOT NULL,      -- 'guest' or 'member'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    time_remaining_seconds INTEGER,         -- For guest sessions
    total_seconds_used INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'active',    -- active, paused, completed, terminated
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES members(id),
    branch_id UUID REFERENCES branches(id),
    session_id UUID REFERENCES sessions(id),
    type VARCHAR(50) NOT NULL,              -- topup, usage, refund, adjustment
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    payment_method VARCHAR(50),             -- cash, coin, gcash, etc.
    reference VARCHAR(100),
    notes TEXT,
    created_by UUID,                        -- Staff who processed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Commands (for remote control)
CREATE TABLE device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    command_type VARCHAR(50) NOT NULL,      -- shutdown, restart, lock, unlock, message
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',   -- pending, sent, executed, failed
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Staff Users
CREATE TABLE staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,      -- Supabase Auth user ID
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id), -- NULL = access to all branches
    role VARCHAR(50) NOT NULL,              -- owner, admin, staff
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_devices_branch ON devices(branch_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_sessions_device ON sessions(device_id);
CREATE INDEX idx_sessions_member ON sessions(member_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_device_commands_device ON device_commands(device_id);
CREATE INDEX idx_device_commands_status ON device_commands(status);
CREATE INDEX idx_members_org_username ON members(org_id, username);
```

## 🔄 Real-time Data Flow

### 1. Guest Session Flow
```
┌─────────┐      ┌─────────┐      ┌──────────┐      ┌───────────┐
│  Kiosk  │      │Supabase │      │ Realtime │      │ Client PC │
└────┬────┘      └────┬────┘      └────┬─────┘      └─────┬─────┘
     │                │                │                  │
     │ 1. Select PC   │                │                  │
     │───────────────▶│                │                  │
     │                │                │                  │
     │ 2. Insert Coin │                │                  │
     │ (Simulated)    │                │                  │
     │                │                │                  │
     │ 3. Create      │                │                  │
     │    Session     │                │                  │
     │───────────────▶│                │                  │
     │                │                │                  │
     │                │ 4. Broadcast   │                  │
     │                │────────────────▶                  │
     │                │                │                  │
     │                │                │ 5. Session       │
     │                │                │    Created Event │
     │                │                │─────────────────▶│
     │                │                │                  │
     │                │                │        6. Unlock │
     │                │                │           & Start│
     │                │                │           Timer  │
     │                │                │                  │
```

### 2. Member Session Flow
```
┌───────────┐      ┌─────────┐      ┌──────────┐
│ Client PC │      │Supabase │      │  Admin   │
└─────┬─────┘      └────┬────┘      └────┬─────┘
      │                 │                │
      │ 1. Member Login │                │
      │ (username+PIN)  │                │
      │────────────────▶│                │
      │                 │                │
      │ 2. Validate &   │                │
      │    Create Session                │
      │◀────────────────│                │
      │                 │                │
      │ 3. Unlock PC    │                │
      │                 │                │
      │ 4. Every 60s:   │                │
      │    Charge Credit│                │
      │────────────────▶│                │
      │                 │                │
      │                 │ 5. Broadcast   │
      │                 │    to Admin    │
      │                 │───────────────▶│
      │                 │                │
      │ 6. Credits = 0  │                │
      │    Auto Logout  │                │
      │────────────────▶│                │
      │                 │                │
      │ 7. Lock PC      │                │
      │                 │                │
```

### 3. Admin Remote Control Flow
```
┌─────────┐      ┌─────────┐      ┌──────────┐      ┌───────────┐
│  Admin  │      │Supabase │      │ Realtime │      │ Client PC │
└────┬────┘      └────┬────┘      └────┬─────┘      └─────┬─────┘
     │                │                │                  │
     │ 1. Send        │                │                  │
     │    Command     │                │                  │
     │───────────────▶│                │                  │
     │                │                │                  │
     │                │ 2. Insert to   │                  │
     │                │    commands    │                  │
     │                │    table       │                  │
     │                │                │                  │
     │                │ 3. Broadcast   │                  │
     │                │────────────────▶                  │
     │                │                │                  │
     │                │                │ 4. Command Event │
     │                │                │─────────────────▶│
     │                │                │                  │
     │                │                │    5. Execute    │
     │                │                │       Command    │
     │                │                │                  │
     │                │                │ 6. Update Status │
     │                │◀───────────────────────────────────
     │                │                │                  │
     │ 7. Status      │                │                  │
     │    Updated     │                │                  │
     │◀───────────────│                │                  │
```

## 🔐 Security (Row Level Security)

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT org_id FROM staff_users 
        WHERE auth_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example RLS policies for devices
CREATE POLICY "Users can view devices in their org" ON devices
    FOR SELECT USING (
        branch_id IN (
            SELECT id FROM branches WHERE org_id = get_user_org_id()
        )
    );

-- Device client access (using device_code as API key)
CREATE POLICY "Devices can update their own status" ON devices
    FOR UPDATE USING (
        device_code = current_setting('app.device_code', true)
    );
```

## ⚡ Edge Functions

### 1. Process Guest Payment
```typescript
// supabase/functions/process-guest-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const { device_id, amount, payment_method } = await req.json()
    
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Get device and rate info
    const { data: device } = await supabase
        .from('devices')
        .select('*, rates(*)')
        .eq('id', device_id)
        .single()
    
    // Calculate time based on rate
    const rate = device.rates
    const timeMinutes = (amount / rate.price_per_unit) * rate.unit_minutes
    const timeSeconds = timeMinutes * 60
    
    // Create session
    const { data: session } = await supabase
        .from('sessions')
        .insert({
            device_id,
            rate_id: rate.id,
            session_type: 'guest',
            time_remaining_seconds: timeSeconds,
            total_amount: amount
        })
        .select()
        .single()
    
    // Update device
    await supabase
        .from('devices')
        .update({
            is_locked: false,
            status: 'in_use',
            current_session_id: session.id
        })
        .eq('id', device_id)
    
    return new Response(JSON.stringify({ success: true, session }))
})
```

### 2. Member Credit Charge
```typescript
// supabase/functions/charge-member-credit/index.ts
serve(async (req) => {
    const { session_id, seconds_to_charge } = await req.json()
    
    // Get session with member and rate
    const { data: session } = await supabase
        .from('sessions')
        .select('*, members(*), rates(*)')
        .eq('id', session_id)
        .single()
    
    // Calculate charge
    const rate = session.rates
    const chargeAmount = (seconds_to_charge / 60 / rate.unit_minutes) * rate.price_per_unit
    
    // Check if member has enough credits
    if (session.members.credits < chargeAmount) {
        // End session - insufficient credits
        await supabase
            .from('sessions')
            .update({ 
                status: 'completed', 
                ended_at: new Date().toISOString() 
            })
            .eq('id', session_id)
        
        return new Response(JSON.stringify({ 
            success: false, 
            reason: 'insufficient_credits' 
        }))
    }
    
    // Deduct credits
    await supabase.rpc('deduct_member_credits', {
        p_member_id: session.member_id,
        p_amount: chargeAmount,
        p_session_id: session_id
    })
    
    return new Response(JSON.stringify({ success: true }))
})
```

## 🖥️ Tech Stack Summary

| Component | Technology | Reason |
|-----------|------------|--------|
| **Client PC** | Electron + React + TypeScript | Fast dev, cross-platform, web skills |
| **Admin Panel** | React + Vite + TailwindCSS | Fast, modern, same skills as landing |
| **Kiosk** | Electron + React | Same as client, fullscreen mode |
| **Mobile** | React Native / Flutter (later) | Cross-platform mobile |
| **Database** | Supabase PostgreSQL | Managed, realtime, auth included |
| **Realtime** | Supabase Realtime | WebSocket, no setup needed |
| **Auth** | Supabase Auth | Built-in, secure |
| **Functions** | Supabase Edge Functions | Serverless, scales automatically |

## 📱 Feature Priority

### Phase 1 (MVP)
- [ ] Database schema setup
- [ ] Admin: Basic device management
- [ ] Admin: Rate configuration
- [ ] Client PC: Device registration
- [ ] Client PC: Lock/unlock mechanism
- [ ] Client PC: Guest session timer
- [ ] Kiosk: Device selection
- [ ] Kiosk: Simulated payment
- [ ] Real-time device status

### Phase 2
- [ ] Member system (login with PIN)
- [ ] Member credit management
- [ ] Real-time credit charging
- [ ] Kiosk: Member top-up
- [ ] Admin: Member management
- [ ] Admin: Transaction history

### Phase 3
- [ ] Admin: Remote commands
- [ ] Admin: Analytics dashboard
- [ ] Multi-branch support
- [ ] Staff management
- [ ] Reporting

### Phase 4
- [ ] Mobile client
- [ ] Hardware integration
- [ ] Payment gateway integration
- [ ] White-label support

## 🚀 Getting Started

```bash
# Clone and setup
git clone <repo>
cd rynxplay-station

# Install dependencies (monorepo)
npm install

# Setup Supabase
npx supabase init
npx supabase start

# Run migrations
npx supabase db push

# Start development
npm run dev:admin    # Admin panel
npm run dev:client   # Client PC app
npm run dev:kiosk    # Kiosk app
```