# TIMPS demos

This folder contains runnable demos and screen-recording recipes for TIMPS.

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
