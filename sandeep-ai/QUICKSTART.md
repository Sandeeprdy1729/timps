# 🚀 TIMPs v1.0 Quick Start Guide

## 5-Minute Setup

### Step 1: Verify Prerequisites (1 min)
```bash
# Check Node.js
node --version  # Should be v18+

# Check npm
npm --version

# Check PostgreSQL
psql --version  # Should be installed
```

### Step 2: Install Dependencies (2 min)
Already done! Dependencies installed with `npm install`:
```
✅ blessed (TUI framework)
✅ @qdrant/js-client (vector search)
✅ pg (PostgreSQL driver)
✅ openai, express, dotenv, cors
```

### Step 3: Set Up Services (3 min)

#### Option A: Use Ollama (Recommended for testing)
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Pull a model
ollama pull mistral  # or llama2, neural-chat, etc.
```

#### Option B: Use OpenAI
Edit `.env`:
```env
PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

### Step 4: Initialize Database (1 min)
```bash
# Terminal 1 (if not running): Start PostgreSQL
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Run migrations
npm run init-db
```

### Step 5: Launch TUI (< 1 min)
```bash
npm run tui -- --user-id 1
```

**You're done! 🎉**

---

## 🎮 Using the TUI

### Your First Conversation
```
Welcome to TIMPs! Start typing...

> I really like TypeScript and functional programming
```

### Create a Memory
Type a natural sentence about yourself. The AI will:
1. Understand it
2. Extract facts
3. Store in PostgreSQL with vector embeddings
4. Show up in audit log

### Search Your Memory
```
> !blame TypeScript
```
Shows all memories mentioning TypeScript:
```
🔍 Found 2 memory item(s):
  [2] REFLECTION ⭐⭐⭐⭐⭐ - I like TypeScript
  [1] REFLECTION ⭐⭐⭐ - TypeScript is great for large projects
```

### Delete Memories
```
> !forget testing
```
Requires confirmation before deletion.

### View Audit Log
Press `Ctrl+L` to see:
- Last 10 memories
- Importance score (stars)
- Type (EXPLICIT or REFLECTION)
- When created
- How many times retrieved

---

## ⌨️ Quick Key Reference

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+L` | Show audit |
| `Tab` | Switch panel |
| `Ctrl+C` | Exit |
| `↑/↓` | Scroll |

---

## 🐛 Troubleshooting

### "Cannot connect to database"
```bash
# Start PostgreSQL
brew services start postgresql

# Verify it's running
psql -c "SELECT 1;"
```

### "No response from model"
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Or use OpenAI in .env
PROVIDER=openai
```

### "TUI doesn't render"
```bash
# Try forcing color support
export TERM=xterm-256color
npm run tui -- --user-id 1
```

### "Cannot find module 'blessed'"
```bash
# Reinstall
npm install
npm run build
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────┐
│  TUI (blessed)                      │
│  - Beautiful 4-panel interface      │
│  - Real-time commands (!blame, etc) │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
   Core Agent      Memory System
   (LLM calls)     (Store & Search)
      │                 │
      └────────┬────────┘
               │
      ┌────────┴────────────┐
      ▼                     ▼
PostgreSQL              Qdrant
(Structured            (Vectors
 storage)               search)
```

---

## 🎓 Example Workflows

### Workflow 1: Learning Mode
```
1. > I'm studying recursion in algorithms
2. [Memory stored with 3 importance]
3. > !blame recursion
4. > I learned about tail call optimization
5. [Memory updated due to retrieval]
```

### Workflow 2: Project Memory
```
1. > !forget old-project
   [Cleans up outdated memories]
2. > Project X uses React 18 with Next.js
3. > Project X database is PostgreSQL
4. > !blame Project X
   [Retrieves all Project X context]
```

### Workflow 3: Ephemeral Session
```
# Start TIMPs in ephemeral mode
npm run tui -- --user-id 1 --mode ephemeral

> Brainstorm: new AI product ideas
> Think: what if we added multimodal support?
[All conversation discarded after exit]
```

---

## 📈 Next Steps

### After Getting Comfortable:
1. **ReadTUI_README.md** — Full feature guide
2. **Explore memory types** — `EXPLICIT` (facts) vs `REFLECTION` (learned patterns)
3. **Integrate with projects** — Use CLI in scripts, TUI for interactive work
4. **Connect to OpenAI** — Switch from Ollama to production-grade model
5. **Monitor performance** — Check audit logs for retrieval patterns

### Advanced:
- **Multiple projects** — Run separate instances with different `--project-id`
- **Export data** — Query PostgreSQL directly for analytics
- **Custom tools** — Extend `/tools/` folder
- **Advanced prompts** — Edit reflection logic in `/core/reflection.ts`

---

## 🚀 Production Checklist

- [ ] Backup your PostgreSQL database
- [ ] Configure OpenAI API key for reliability
- [ ] Set up monitoring/alerts for Qdrant
- [ ] Document project-specific memory conventions
- [ ] Create README for team members joining
- [ ] Set up CI/CD for rebuilds
- [ ] Enable audit logging to external service

---

## 💡 Pro Tips

1. **Use specific keywords** in memories for better !blame retrieval
   ```
   ✅ Good: "TypeScript interfaces are powerful for type safety"
   ❌ Not: "I know stuff about TypeScript"
   ```

2. **Add context to each memory**
   ```
   ✅ Good: "React hooks revolutionized state management in 2019"
   ❌ Vague: "I like hooks"
   ```

3. **Use !audit regularly** to track how often memories are retrieved
   - High retrieval = important knowledge
   - No retrieval = might need cleanup

4. **Tag important memories** with metadata
   ```
   The system will auto-tag based on ML reflection, but you can:
   !blame #learning  # Search by tag
   ```

5. **Start fresh with ephemeral** for sensitive discussions
   ```bash
   npm run tui -- --user-id 1 --mode ephemeral
   ```

---

## 📞 Need Help?

- **TUI Issues** → Check TUI_README.md
- **Database Issues** → Check `.env` configuration
- **Model Issues** → Verify Ollama or OpenAI connection
- **Command Issues** → Try `!audit` to see what's stored
- **Performance** → Check PostgreSQL indexes with `\d+ memories` in psql

---

**Enjoy your cognitive partnership! 🧠💾**
