# Hacker News post draft — TIMPS launch

**Title (pick one):**

A. "Show HN: TIMPS — AI coding agent with 17 intelligence tools that runs 100% on a free local model"
B. "Show HN: A sheaf-cohomology contradiction detector for an AI coding agent"
C. "Show HN: I built an AI coding agent that warns you before you contradict yourself"

**Recommended: A** (leads with the local-first story, which is what HN cares about most in 2026 — saves money, no API lock-in).

---

**Body:**

Hi HN — I'm Sandeep, a CS student in Hyderabad.

I built TIMPS, an open-source AI coding agent that does two things none of the
others do:

1. **It remembers everything across sessions, locally.** Every decision,
   regret, bug pattern, and codebase quirk you've ever mentioned gets stored
   to a JSON file in `~/.timps/memory/<project>/`. No server, no Postgres,
   no Docker. Just files.

2. **It has 17 intelligence tools that run with zero LLM calls** for the
   core logic — contradiction detection, burnout prediction, regret
   warnings, API quirk lookup, etc. The algorithms are all deterministic
   (Jaccard similarity, regex, frequency analysis, bi-temporal causal
   graphs). The LLM is only used for the actual code generation.

The interesting ones:

- **Contradiction Detector** — Catches you repeating a past decision you
  said you'd never do again. Jaccard word overlap + sentiment flip. ~100 LOC.
- **HarmonicSheafWeaver (Layer 9)** — Algebraic contradiction detection
  using sheaf cohomology (H¹ ≠ 0 means no consistent global section). This
  is the genuinely novel piece. Took me a week to port Hansen & Ghrist's
  2019 topology paper to a working memory engine. (I have a long-form post
  about how it works if there's interest.)
- **Burnout Seismograph** — Records behavioral signals (focus hours,
  response time), computes your personal baseline, alerts when you're
  20%+ off. Like a fitness tracker for your dev work.
- **Meeting Ghost** — Drop meeting notes in, get out a list of
  commitments with owners and deadlines. Pure regex, no LLM.
- **Dead Reckoning** — "Should I use microservices?" — looks at your past
  decisions with similar Jaccard vocabulary, weighs by regret score,
  predicts outcome with confidence.
- **Institutional Memory** — When a contributor goes dormant (>90 days),
  preserve their decisions and quirks so they don't get lost.

**The honest part:** The first version of the benchmark faked its numbers
with `Math.random()`. A developer who cloned the repo would have noticed
in 10 seconds. I rewrote the benchmark to use the real `MemoryEngine`
against a 50-fact corpus — the real numbers are R@1 75%, R@5 95%, MRR
0.82, contradiction detection 10/10, all 17 tools 100% pass. You can run
`npx tsx benchmark/index.ts` and see for yourself. No black boxes.

**Why local-first:** I'm targeting Indian developers (and anyone else on
$0/month budgets). Default provider is Ollama with `qwen2.5-coder:7b` —
runs on 8 GB RAM, no GPU. The whole thing works on a ₹30,000 laptop
without an internet connection after the initial `ollama pull`.

**What's still rough:**
- The swarm mode is now real (10 agents in a DAG, each calls its own
  LLM) but I haven't stress-tested it on real workflows yet
- 7 providers, not 75. The README used to say "75+ providers" — fixed
  to "7" after I got tired of lying to myself
- Documentation is sparse. I'm one person.

GitHub: https://github.com/Sandeeprdy1729/timps
Demo: `bash demo/quick_demo.sh` (2 min, runs the benchmark + Ollama CLI)

Happy to answer questions about the sheaf cohomology layer — that part
is genuinely publishable math if you squint at it, and I think there's
a research paper in there.

---

**Tweaks for HN culture:**
- Drop the "$0/month" framing in the body — HN is wary of cost-saving pitches
- Add a one-line "Why I built this" at the top
- Mention you're a solo founder / student in the first sentence
- Link the GitHub in the first paragraph, not the last
- If you can, have a 60-90 second GIF ready (the demo/quick_demo.gif is ready)

**Why A is the best title:**
- "Show HN" is required for self-posts
- 17 intelligence tools is the concrete differentiator
- "free local model" is the unique value prop vs Claude Code ($20/mo)
- Sheaf cohomology is interesting but scares people — keep it in the body

**Optimal posting time:** Tuesday–Thursday, 8–10am US Eastern (2–4pm UTC,
6:30–8:30pm IST). HN is slow on weekends.

**What to reply to in comments:**
- Architecture questions → link to AGENTS.md (canonical doc, not README)
- "Why not just use MemGPT?" → mention file-based vs Postgres, local-first
- "Why Ollama not Llama.cpp?" → mention vRAM, model management, ecosystem
- "How does the sheaf cohomology work?" → this is your chance to shine,
  have a 5-paragraph answer ready that explains H¹ ≠ 0 in plain terms
