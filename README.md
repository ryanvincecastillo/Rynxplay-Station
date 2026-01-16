## ✅ RYNXPLAY STATION

**Cloud-based Timer for Computer Shops**
Tagline:

> *“Automate Sales. No Server Setup. Pure Cloud. Your Shop, Your Rules.”*

---

## 🔧 CORE FEATURES RECAP (Based on our convos)

| Category              | Feature                                               |
| --------------------- | ----------------------------------------------------- |
| ⚙️ Device Control     | Lock/unlock, force shutdown, send message             |
| ⏲️ Timer & Rate       | Per-device hourly rate (₱10 regular, ₱20 VIP)         |
| 🧑‍💼 Multi-Tenant       | One owner → many shops → many devices                 |
| 🔄 Session            | Only one active session per user at a time            |
| 🔁 Heartbeat          | Live device-user heartbeat to backend every X seconds |
| 💳 Credits            | User-based credits, cross-shop usage, send-to-user    |
| 🔒 Auth               | Device lockscreen with register/login                 |
| 🌐 Admin              | Cloud dashboard: control all shops/devices            |
| 📡 Offline Resilience | Store credits/timer locally, sync back when online    |
| 📈 Logs               | Session logs, credit top-up logs, transfers           |
| 🧑 Staff              | Shop owners can assign staff to specific shops        |

---

## 📐 SYSTEM ARCHITECTURE

### 1. 🧠 Backend: Supabase (PostgreSQL + Auth + Edge Functions)

| Component          | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| **Auth**           | Supabase auth (email/password or magic link)                              |
| **Database**       | PostgreSQL - users, tenants, shops, devices, sessions, credits, logs      |
| **Edge Functions** | For secure custom logic: start session, check status, credit transfer     |
| **Realtime**       | Supabase Realtime for status sync (e.g., heartbeat updates, force logout) |
| **Storage**        | Store device configs, offline logs if needed                              |

---

### 2. 📲 Mobile Client – Kotlin (JVM)

| Stack             | Notes                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| **Language**      | Kotlin (JVM)                                                                    |
| **UI Framework**  | Jetpack Compose                                                                 |
| **Networking**    | Retrofit / Ktor                                                                 |
| **Local Storage** | Room DB / SharedPrefs (for offline mode + credits)                              |
| **Key Features**  | Timer, lockscreen, rate per device, credit usage, real-time sync, forced logout |

---

### 3. 🖥️ PC Client – Electron.js

| Stack         | Notes                                                          |
| ------------- | -------------------------------------------------------------- |
| **Frontend**  | React + TailwindCSS                                            |
| **Backend**   | Node.js                                                        |
| **Packaging** | Electron                                                       |
| **Features**  | Timer UI, Lockscreen, Credits, Admin messages, Forced shutdown |

---

### 4. 🧑‍💻 Admin Panel (Web Dashboard)

| Stack          | Notes                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Frontend**   | React or Vue (optional with Tailwind UI or Radix UI)                                                               |
| **API Access** | Supabase client SDK                                                                                                |
| **Features**   | Multi-shop management, staff assignments, credit logs, device overview, send message, force shutdown, create rates |

---

### 5. 🌐 Landing Page / Marketing

| Stack         | Notes                                       |
| ------------- | ------------------------------------------- |
| **Framework** | Static pafe (for now)                       |
| **Domain**    | `rynxplaystation.com`                       |
| **Content**   | Feature showcase, pricing, contact, signup  |

---

## 📁 PROJECT STRUCTURE (SEPARATE REPOS)

| Repo Name                        | Description                       |
| -------------------------------- | --------------------------------- |
| `rynxplay-station-core`          | Supabase project + Edge Functions |
| `rynxplay-station-client-mobile` | Kotlin mobile client              |
| `rynxplay-station-client-pc`     | Electron + React PC client        |
| `rynxplay-station-admin-web`     | Admin Dashboard                   |
| `rynxplay-station-landing`       | Marketing website                 |

---

## 🧩 DATABASE SCHEMA (Simplified)

```plaintext
Tenants
  - id
  - name
  - owner_id

Shops
  - id
  - tenant_id
  - name
  - location

Devices
  - id
  - shop_id
  - name
  - type (PC/Mobile)
  - rate_per_hour
  - is_vip

Users
  - id
  - email
  - password
  - credits

UserSessions
  - id
  - user_id
  - device_id
  - start_time
  - end_time
  - status (active/ended)
  - credits_used

CreditTransactions
  - id
  - from_user_id
  - to_user_id
  - amount
  - type (topup, transfer, usage)
  - timestamp

DeviceHeartbeats
  - id
  - device_id
  - last_seen
  - current_user_id
  - remaining_time
```

---

## 🧭 TASKMASTER-STYLE ROADMAP

### 🟢 PHASE 1: FOUNDATION

| Task                          | Owner | Notes                                          |
| ----------------------------- | ----- | ---------------------------------------------- |
| \[ ] Set up Supabase project  | You   | Configure schema + auth                        |
| \[ ] Create all DB tables     | You   | Use the schema above                           |
| \[ ] Write Supabase Functions | You   | Session management, credit deduction, transfer |
| \[ ] Set up Realtime events   | You   | For heartbeat and admin controls               |

---

### 🟡 PHASE 2: PC CLIENT (Electron)

| Task                                    | Owner | Notes                       |
| --------------------------------------- | ----- | --------------------------- |
| \[ ] Build login + register screen      | You   |                             |
| \[ ] Implement session start            | You   | With rate-based countdown   |
| \[ ] Lock device outside active session | You   |                             |
| \[ ] Force shutdown logic               | You   | Listen to Supabase Realtime |
| \[ ] Credit sync + usage                | You   |                             |

---

### 🟡 PHASE 3: MOBILE CLIENT (Kotlin)

| Task                                   | Owner | Notes           |
| -------------------------------------- | ----- | --------------- |
| \[ ] Jetpack Compose UI                | You   |                 |
| \[ ] Register/login with Supabase      | You   |                 |
| \[ ] Lockscreen with credit countdown  | You   |                 |
| \[ ] Local credit tracking             | You   | Sync with cloud |
| \[ ] Heartbeat emitter (every 30s)     | You   |                 |
| \[ ] Listen for force logout, shutdown | You   |                 |

---

### 🟠 PHASE 4: ADMIN DASHBOARD

| Task                              | Owner | Notes |
| --------------------------------- | ----- | ----- |
| \[ ] Shop/Device CRUD             | You   |       |
| \[ ] Device status monitor (live) | You   |       |
| \[ ] Send message to device       | You   |       |
| \[ ] Force logout / shutdown      | You   |       |
| \[ ] Assign staff to shops        | You   |       |
| \[ ] Credit view logs + top-up    | You   |       |

---

### 🟣 PHASE 5: USER FEATURES

| Task                                 | Owner | Notes                                     |
| ------------------------------------ | ----- | ----------------------------------------- |
| \[ ] Transfer credits to other users | You   |                                           |
| \[ ] Multi-device login check        | You   | Supabase function block multiple sessions |
| \[ ] Cross-shop usage                | You   | Credit is user-wide, not shop-tied        |

---

### 🔵 PHASE 6: DEPLOY & CLOUD

| Task                                  | Owner    | Notes |
| ------------------------------------- | -------- | ----- |
| \[ ] Supabase hosted                  | Supabase |       |
| \[ ] Admin Web - Vercel/Netlify       | You      |       |
| \[ ] Electron build + auto-updates    | You      |       |
| \[ ] Mobile APK build + Firebase dist | You      |       |
| \[ ] Landing page live on domain      | You      |       |

---

## ❤️ FINAL THOUGHTS

* ✅ User credits are global (not shop-tied)
* ✅ User can send credits to other users
* ✅ Admins can assign staff to specific shops
* ✅ Realtime heartbeat and forced actions ensure control
* ✅ PC and mobile have per-device rates
* ✅ **All built to scale for many shops, many tenants**
