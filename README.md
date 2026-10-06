# 🌱 Habit Coach

A smart, personalized habit-tracking mobile application built with **React Native (Expo)** and a **Hono serverless backend**. It learns from your completion history to send notifications at your optimal time — not a generic alarm, but a personalized nudge.

---

## ✨ Features

- **Habit CRUD** — Create, view, edit, and delete daily/weekly habits with an icon picker
- **Adaptive Notifications** — Uses statistical analysis (mean − σ) of your completion history to schedule reminders at your personal golden window
- **On-Device Privacy** — All habit data stored locally via MMKV; no personal data leaves your device
- **Cold-Start Fallback** — Falls back to your manually set target time until 5+ completions are recorded
- **Calendar Heatmap** — Custom `FlatList`-based heatmap showing your monthly completion streaks
- **Social Proof** — Anonymized aggregate stats from the Hono backend motivate you with community data
- **Docker-ready backend** — Hono API runs in a container with a healthcheck

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              React Native App               │
│                                             │
│  HabitListScreen → AddEditHabitScreen       │
│                  → HabitDetailScreen        │
│                     └─ StreakCalendar       │
│                                             │
│  HabitContext (useReducer + MMKV)           │
│  Algorithm  → expo-notifications            │
│  API Client → Hono Backend                  │
└──────────────┬──────────────────────────────┘
               │ HTTP (anonymized)
               ▼
┌─────────────────────────────────────────────┐
│          Hono Backend (Docker / CF)         │
│                                             │
│  POST /track      — Zod validated           │
│  GET  /stats/:name — Aggregate stats        │
│  GET  /health     — Healthcheck             │
└─────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
.
├── docker-compose.yml          # Backend container orchestration
├── .env.example                # Environment variable documentation
├── ALGORITHM.md                # Algorithm design & pseudocode
├── README.md
│
├── habit-coach/                # React Native Expo app
│   ├── App.tsx                 # Root component, navigation, test hooks
│   ├── app.json                # Expo config with notification plugin
│   ├── vitest.config.ts
│   ├── __tests__/
│   │   └── algorithm.test.ts   # 20+ unit tests for the algorithm
│   └── src/
│       ├── types/habit.ts
│       ├── context/HabitContext.tsx    # State + test hooks
│       ├── services/
│       │   ├── storage.ts      # MMKV persistence
│       │   ├── notifications.ts # expo-notifications service
│       │   └── api.ts          # Hono API client
│       ├── utils/algorithm.ts  # calculateOptimalWindow (pure TS)
│       ├── screens/
│       │   ├── HabitListScreen.tsx
│       │   ├── AddEditHabitScreen.tsx
│       │   └── HabitDetailScreen.tsx
│       └── components/
│           ├── HabitItem.tsx
│           └── StreakCalendar.tsx  # Custom FlatList heatmap
│
└── backend/                    # Hono serverless backend
    ├── Dockerfile
    ├── vitest.config.ts
    └── src/
        ├── index.ts            # Hono app (routes, Zod, in-memory store)
        ├── server.ts           # Node.js server start
        └── index.test.ts       # API endpoint tests
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Docker & Docker Compose (for backend)
- Expo CLI: `npm install -g expo-cli`
- A physical device or emulator (Android/iOS) with Expo Go, or a web browser

### 1. Clone and configure environment

```bash
git clone <your-repo-url>
cd habit-coach-project

# Copy the env example
cp .env.example .env
# Edit .env to set EXPO_PUBLIC_API_BASE_URL to your backend URL
```

### 2. Start the Backend (Docker)

```bash
# From the project root:
docker-compose up --build -d

# Verify it's healthy:
docker-compose ps
curl http://localhost:3000/health
# → {"status":"ok","timestamp":"..."}
```

Or run locally without Docker:

```bash
cd backend
npm install
npm run dev
```

### 3. Start the React Native App

```bash
cd habit-coach
npm install
npm start        # Opens Expo Dev Tools
# Press 'a' for Android, 'i' for iOS, 'w' for web
```

---

## 🧪 Running Tests

### Algorithm Unit Tests (React Native app)

```bash
cd habit-coach
npm test
# Runs 20+ tests covering:
# - Cold-start scenario (< 5 timestamps)
# - Known mean/stddev datasets
# - Edge cases (midnight, boundary values)
```

### Backend API Tests

```bash
cd backend
npm install
npm test
# Covers: POST /track (valid, invalid payloads), GET /stats/:name, GET /health
```

---

## 📡 API Reference

### `POST /track`

Track an anonymized habit completion.

**Request:**
```json
{
  "habitName": "Morning Run",
  "completionHour": 7,
  "timezone": "Asia/Kolkata"
}
```

**Success (200):**
```json
{ "success": true, "message": "Habit tracked successfully." }
```

**Validation Error (400):**
```json
{ "success": false, "issues": [{ "code": "too_small", "message": "..." }] }
```

### `GET /stats/:habitName`

Get aggregate stats for a habit.

**Response (200):**
```json
{
  "habitName": "Morning Run",
  "totalCompletions": 142,
  "completionsByHour": {
    "6": 12, "7": 89, "8": 41, ...
  }
}
```

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-10-06T06:00:00.000Z" }
```

---

## 🧠 Algorithm

See [ALGORITHM.md](./ALGORITHM.md) for a detailed explanation of:
- The optimal window calculation (mean − σ)
- Cold-start handling (< 5 completions)
- Timezone considerations
- Edge cases and clamping

---

## 🌍 Production Deployment

### Cloudflare Workers

```bash
cd backend
npm run deploy   # Deploys via wrangler
```

Update `EXPO_PUBLIC_API_BASE_URL` in your `.env` to the deployed Workers URL.

---

## 🔑 Test Hooks (E2E)

The following global functions are available on `window` when running in web mode:

| Function | Purpose |
|----------|---------|
| `window.calculateOptimalWindow(timestamps, targetTime)` | Runs the algorithm directly |
| `window.getHabitCompletions(habitId)` | Returns array of Unix timestamps for a habit |
| `window.getScheduledNotification(habitId)` | Returns the pending notification object |

---

## 📄 License

MIT
