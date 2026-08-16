# TIMPS demos

This folder contains runnable demos and screen-recording recipes for TIMPS.

## `real-demo.mp4` — cross-session memory recall (OpenCode)

Real screen recording showing TIMPS in action across opencode sessions: a
story is stored in one session via `timps_store_memory` and recalled in a
brand-new session through the shared MemoryServer. Embedded in the main README.

> **Note:** GitHub's `raw.githubusercontent.com` serves `.mp4` as
> `application/octet-stream`, so browsers refuse to play a relative path. Embed
> from a `user-attachments` asset URL (upload to an issue/comment) which serves
> `video/mp4`:

```markdown
<video src="https://github.com/user-attachments/assets/7a3ddf8d-efd6-470a-a69b-ed5f54396eb2" controls width="100%"></video>
```

The source file stays at `demo/real-demo.mp4` (also used for VS Code / local playback).

## `quick_demo.sh` — 2-minute terminal walkthrough

Shows the real benchmark running (no `Math.random()`), the CLI with Ollama,
and how to plug the MCP server into Claude Code. Safe to run on any machine.

```bash
bash demo/quick_demo.sh
```

## Screen recording with VHS

We use [VHS](https://github.com/charmbracelet/vhs) (`brew install vhs ffmpeg`)
to record the terminal. Plain macOS screen capture works too, but VHS produces
deterministic, reproducible GIFs and MP4s from a `.tape` script.

### Why VHS over screen capture

| | VHS | macOS Screen Capture |
|---|---|---|
| Reproducible | ✅ tape is text | ❌ depends on what's on screen |
| Generates GIF + MP4 | ✅ one command | ❌ need to convert with ffmpeg |
| CI-friendly | ✅ headless | ❌ needs a desktop |
| Speed | normal or `Set TypingSpeed 50ms` | real time |
| Free | ✅ MIT | ✅ built in |

### Install

```bash
brew install vhs ffmpeg
```

### Record a 30-second demo

Create `demo/demo.tape`:

```tape
Output demo/quick_demo.gif
Output demo/quick_demo.mp4

Set Shell bash
Set FontSize 14
Set Width 1200
Set Height 720
Set TypingSpeed 60ms
Set Theme "Dracula"

Type "bash demo/quick_demo.sh"
Sleep 500ms
Enter
Sleep 30s
```

Then:

```bash
vhs demo/demo.tape
```

This produces both `quick_demo.gif` (for Twitter, README, Discord) and
`quick_demo.mp4` (for YouTube, the website).

### Embed in README

```markdown
![TIMPS quick demo](./demo/quick_demo.gif)
```

## Manual recording (fallback)

If VHS isn't available:

```bash
# Record terminal at 2x for smoother playback
ffmpeg -f avfoundation -i "1:0" -r 30 -preset ultrafast demo/raw.mp4

# Convert to GIF (smaller, shareable)
ffmpeg -i demo/raw.mp4 -vf "fps=15,scale=1200:-1" demo/quick_demo.gif
```

The GIF will be ~10x larger than VHS output and not reproducible, but it works.
