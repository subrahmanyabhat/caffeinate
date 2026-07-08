# ☕ Caffeinate — Keep Screen Awake

A Chrome extension that keeps your screen awake, controlled with terminal-style
flags inspired by the macOS `caffeinate` command.

## Install (developer mode)

1. Unzip this folder somewhere permanent (don't delete it later).
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this `caffeinate` folder.
5. Pin the ☕ icon from the puzzle-piece menu for quick access.

## How it works

Click the big **caffeinate** button to keep your screen awake. The flags below
mirror the real macOS command:

| Flag | Meaning |
|------|---------|
| `-d` | **display** — prevent the screen from sleeping |
| `-i` | **idle** — keep the system awake (screen may still dim) |
| `-t` | **timeout** — automatically stop after a set duration |
| `-w` | **charging** — only stay active while plugged into power |

Pick a duration (15m / 30m / 1h / 2h / ∞) when `-t` is enabled. The badge on the
extension icon shows the time remaining, and the footer shows the equivalent
command you could run in a real terminal.

## Technical notes

- Uses the `chrome.power` API, so the screen stays awake even when the popup is
  closed (unlike the browser `wakeLock` API, which dies when the tab loses focus).
- State persists across browser restarts via `chrome.storage`.
- The `-w` charging check runs in an offscreen document using the Battery API.
- Timers use `chrome.alarms` so they survive the service worker going idle.

## Files

```
caffeinate/
├── manifest.json     extension config (Manifest V3)
├── background.js     service worker: power, timer, badge
├── popup.html/css/js the toolbar UI
├── offscreen.html/js battery monitor for -w mode
└── icons/            coffee-cup icons (16/32/48/128)
```

## Publishing

To put this on the Chrome Web Store: zip the folder, pay the one-time $5
developer registration fee at https://chrome.google.com/webstore/devconsole,
upload, add screenshots, and submit for review (usually 1–3 days).

---
Built with Claude.
