# TIMPs v1.1 — Premium Web UI (Web User Interface)

A professional developer-tool grade web interface for **TIMPs** — the Trustworthy Interactive Memory Partner System.

## 🎨 What You Get

A beautiful, responsive web interface featuring:

- **Chat Panel** — Natural conversation with persistent memory
- **Memory Panel** — Real-time view of your stored memories (up to 30 recent)
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Commands** — !blame, !forget, !audit for advanced memory management
- **Settings Modal** — Configure user ID, model provider, API base URL
- **Connection Status** — Real-time health check indicator
- **Ephemeral Mode** — Optional private mode with no persistence

### Interface Layout
```
┌─────────────────────────────────────────────┬─────────────────────┐
│     TIMPs v1.0  💾 12 memories              │ Settings            │
├─────────────────────────────────────────────┼─────────────────────┤
│ Conversation Panel (70%)                    │ Memory Panel (30%)   │
│                                             │                     │
│ timps › Welcome. I'm TIMPs...               │ 📋 Memory Log       │
│ 12:45 PM                                    │                     │
│                                             │ [2] REFLECTION      │
│ You › Hi! How are you?                      │ ⭐⭐⭐⭐⭐          │
│ 12:46 PM                                    │ favorite language.. │
│                                             │ 2/17/2026           │
│ timps › Great! How can I help?              │                     │
│ 12:46 PM                                    │ [1] EXPLICIT        │
│                                             │ ⭐⭐                 │
│                                             │ React is my...      │
├─────────────────────────────────────────────┴─────────────────────┤
│ [Input] Type a message...                        [send]            │
│ !blame  !forget  !audit          Enter to send · Shift+Enter newline
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd /Users/sandeepreddy/Desktop/testbot/sandeep-ai
npm install
```

### 2. Start Services

**Terminal 1: PostgreSQL** (ensure running on localhost:5432)
```bash
# Check your .env for credentials
```

**Terminal 2: Ollama** (if using local models)
```bash
ollama serve
```

**Terminal 3: TIMPs Server + Web Interface**
```bash
npm run server
```

### 3. Open Web Interface
```
🌐 http://localhost:3000
```

That's it! Your browser will open to the landing page with a "Start Session" button.

## 🎮 Using the Web Interface

### Chat
- Type naturally and press **Enter** to send
- Shift+Enter for newlines
- Messages persist automatically in memory

### Commands
| Command | Purpose |
|---------|---------|
| `!blame <keyword>` | Search memories containing keyword |
| `!forget <keyword>` | Delete memories matching keyword |
| `!audit` | View last 10 stored memories |

### Settings
Click **settings** button in top-right to configure:
- **User ID** — Unique identifier for memory persistence
- **Username** — How you're identified in chat
- **Model Provider** — Ollama (local), OpenAI, or Google Gemini
- **API Base URL** — Backend server address (default: http://localhost:3000)
- **Ephemeral Mode** — Enable to skip persistence


All commands work in the input box:

### !blame \<keyword\>
Search for memories containing keyword

## 📚 Command Details

### !blame \<keyword\>
Search your memory for a specific keyword

**Browser display:**
```
timps › Found 2 memory item(s) matching "TypeScript":

[2] REFLECTION ⭐⭐⭐⭐⭐
favorite language is TypeScript

[1] EXPLICIT ⭐⭐⭐
TypeScript helps catch bugs early
```

**Backend processing:**
1. Full-text search in PostgreSQL
2. Vector similarity search in Qdrant
3. Merges & deduplicates results
4. Increments retrieval counter

### !forget \<keyword\>
Delete all memories matching keyword (with confirmation)

**Browser display:**
```
[Confirmation Dialog]
!forget "React"

Delete all memories matching "React"?
Removes from PostgreSQL and Qdrant. Cannot be undone.

[Cancel]  [Delete]
```

**After confirmation:**
- Deletes from database
- Updates memory panel
- Shows success message

### !audit
View your last 10 stored memories

**Browser display:**
```
timps › AUDIT LOG — Last 10 memories

[2] REFLECTION ⭐⭐⭐⭐⭐
favorite language is TypeScript
2/16/2026, 6:47:52 PM · retrieved 1×

[1] EXPLICIT ⭐⭐
TypeScript helps catch bugs early
2/16/2026, 6:50:15 PM · retrieved 0×
```

## 🎯 Key Features

### ✅ Persistent Memory
- Every conversation is automatically saved
- Memories are searchable and retrievable
- Importance ratings (⭐ 1-5 stars)
- Retrieval tracking

### ✅ Real-Time Status
- **Green dot** = Server connected
- **Gray dot** = Server offline
- Memory count updates live
- Mode badge shows PERSISTENT or EPHEMERAL

### ✅ Beautiful Dark Theme
- Professional IBM Plex typography
- High contrast for readability
- Smooth animations
- Responsive layout

### ✅ Privacy Controls
Toggle **Ephemeral Mode** in settings to disable persistence:
- No memories stored
- Conversations disappear on refresh
- Perfect for sensitive topics


## 🔧 Configuration

Settings are stored in browser **localStorage** and can be configured via the web UI:

**Via Settings Modal:**
- User ID (for memory isolation between users)
- Username (displayed in chat)
- Model Provider (Ollama, OpenAI, or Google Gemini)
- API Base URL (default: http://localhost:3000)
- Ephemeral Mode toggle

**Via `.env` file** (backend configuration):

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=sandeep_ai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword

# Vector Search (optional)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=sandeep_ai_memories

# LLM
OLLAMA_API_URL=http://localhost:11434
# or
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Server
PORT=3000
NODE_ENV=development
```

## 📊 Memory Display

The Memory Panel (right side) shows up to 30 recent memories:

| Field | Meaning |
|-------|---------|
| `[#ID]` | Database record identifier |
| `TYPE` | REFLECTION or EXPLICIT memory |
| `⭐` | Importance level (1-5 stars) |
| Content | Memory text (2-line preview) |
| Date | When created |
| `retrieved N×` | How many times searched |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| White/blank page | Check browser console (F12), verify server running |
| "Cannot reach TIMPs server" | Start server: `npm run server` |
| Memories not loading | Ensure PostgreSQL & Qdrant running, check .env |
| Settings not persisting | Check browser allows localStorage |
| Search finds nothing | Try !audit first to verify memories exist |
| Slow responses | Vector store (Qdrant) may be under load |
| Ephemeral mode not working | Clear localStorage, toggle in settings |

## 🎨 Design System

Dark theme with professional gradients:

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#0c0c0c` | Main surface |
| Border | `#222222` | Panel dividers |
| Text | `#e8e4e0` | Primary text |
| Accent | `#c8c0b8` | Headers, titles |
| Green | `#6ee7b7` | Status, assistant |
| Muted | `#666660` | Secondary text |

Font: **IBM Plex** (Mono for code, Sans for UI)

## 🚀 Performance

- **Page load**: <500ms
- **Message send**: <100ms
- **Memory search**: <200ms (SQL fallback if Qdrant unavailable)
- **UI updates**: 60 FPS (smooth scrolling)
- **Memory limit**: 1000+ memories handled smoothly

## 🎓 Development

### Local development with hot reload
```bash
cd /Users/sandeepreddy/Desktop/testbot/sandeep-ai
npm run server
# Edit public/index.html or public/chat.html
# Changes auto-refresh (static files)
```

### Build for production
```bash
npm run build
npm start
```

### Debug logs
Enable verbose API logging:
```bash
NODE_ENV=development npm run server
```

## 📁 File Structure

```
public/
├── index.html       # Landing page
└── chat.html        # Main chat interface

api/
├── server.ts        # Express server + static serving
└── routes.ts        # API endpoints

config/
└── env.ts           # Environment variables

db/
├── postgres.ts      # Memory storage
└── vector.ts        # Vector search (Qdrant)

core/
├── agent.ts         # Main AI logic
├── executor.ts      # Task execution
├── planner.ts       # Planning
└── reflection.ts    # Memory reflection
```

## 🌐 API Endpoints

All endpoints are called from the web interface:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/chat` | Send message, get AI response |
| `GET` | `/api/memory/:userId` | Fetch user's memories |
| `DELETE` | `/api/memory/:userId` | Delete memories (via !forget) |
| `GET` | `/api/health` | Server health check |

## 📈 Roadmap

- [ ] Message sorting/filtering
- [ ] Memory tags and categories
- [ ] Export chat history
- [ ] Dark/Light theme toggle
- [ ] Custom model parameters (temperature, tokens)
- [ ] Memory timeline visualization
- [ ] Collaborative sessions
- [ ] Mobile app

## 📝 License

MIT

---

**Ready to remember everything that matters? Open http://localhost:3000 🚀**
