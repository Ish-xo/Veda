# ☁️ VEDA • Voice-Controlled Music AI

[![Node.js](https://img.shields.io/badge/Node.js-18+-68a063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/ES6+-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **Veda** is a next-generation voice-controlled music player and AI companion featuring real-time audio waveform visualizers, instant voice barge-in, music-synced fullscreen DJ lights, and synchronized Spotify-style lyrics.

---

## 🌟 Key Features

### 🎙️ 1. Intelligent Voice AI & Low-Pitch Speech Engine
- **Broad Phonetic Wake-Word Matching**: Recognizes *"Hey Veda"*, *"Veda"*, *"Vida"*, *"Vedha"*, and various regional accents or phonetic speech interpretations.
- **Hardware AGC Audio Gain Boost**: Leverages browser hardware Auto Gain Control (`getUserMedia`) to capture low-pitch, deep, or whispered voices clearly.
- **Direct Intent Recognition**: Auto-wakes immediately on commands like *"Play Starboy"*, *"Pause"*, *"Next song"*, *"Rewind 10 seconds"*, etc.

### ⚡ 2. Instant Voice Barge-In & Music Pause
- Saying *"Hey Veda"* in the middle of a song **immediately pauses playback in `< 15ms`**, triggers an acoustic wake chime, and activates the live listening state (`🎙️ Listening...`).
- **Silence Auto-Resume**: If no command is spoken within 8 seconds, Veda automatically resumes the music seamlessly.

### ✨ 3. Fullscreen Ambient DJ & Party Lights
- **Edge-to-Edge Coverage**: 4 fullscreen corner washes (`washTL`, `washTR`, `washBL`, `washBR`), pulsing central radial orbs, and sweeping laser strobe beams.
- **Crystal-Clear Aesthetic**: Clean radial luminescence without foggy or milky haze, keeping the central avatar, waveforms, and text razor-sharp.
- **Live Album Art Color Extraction**: Automatically samples dominant and vibrant secondary colors from each song's album artwork (`track.thumbnail`) to dynamically recolor the ambient stage lights and lyrics background in real time.

### 🌓 4. Single-Screen Minimal UI & Dark Mode Toggle
- **Light & Obsidian Dark Mode**: Seamless toggle button (`🌙` / `☀️`) in the top navigation bar with persistent state across page reloads (`localStorage`).
- **Bounded Scrolling Marquee Ticker**: Smooth continuous ticker displaying voice command suggestions bounded by tactile delimiter lines.
- **Dynamic State Swap**: Crossfades between the blue cloud avatar (Paused/Idle) and 7 animated rounded blue waveform bars (Playing).

### 📜 5. Spotify-Style Synchronized Lyrics Panel
- Slide-out lyrics panel with real-time synchronized karaoke scrolling powered by LRCLIB.
- Interactive lyric line jumping: Click any line to seek directly to that timestamp.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- A modern web browser (Google Chrome, Microsoft Edge, or Firefox)

### 1. Clone the Repository
```bash
git clone https://github.com/Ish-xo/Veda.git
cd Veda
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Launch Application
```bash
npm start
```
*(or `npm run dev` for automatic server restarts)*

### 4. Open in Browser
Visit **`http://localhost:3000`** and click **Enter** to start listening.

---

## 🗣️ Voice Commands & Shortcuts

| Voice Command | Action |
|---|---|
| *"Hey Veda, play [Song / Artist]"* | Searches and streams the requested track with a spoken announcement |
| *"Pause"* / *"Stop"* | Pauses music playback |
| *"Resume"* / *"Play"* | Resumes playback |
| *"Next song"* / *"Skip"* | Skips to a new trending track |
| *"Forward 10 seconds"* | Seeks ahead by 10s |
| *"Rewind 10 seconds"* | Seeks backward by 10s |
| *"Skip intro"* | Seeks forward 15s |

### Keyboard Shortcuts
- <kbd>Space</kbd>: Play / Pause toggle
- <kbd>→</kbd> / <kbd>←</kbd>: Seek forward / backward by 10s
- <kbd>L</kbd>: Toggle Spotify-style synced lyrics panel
- <kbd>V</kbd>: Trigger Veda voice listener manually
- <kbd>Esc</kbd>: Close lyrics drawer

---

## 🛠️ Architecture & Tech Stack

- **Backend**: Node.js, Express, `youtube-sr`, `msedge-tts` (Neural TTS streaming).
- **Frontend**: Vanilla HTML5, Modern ES6+ JavaScript, CSS3 Design Tokens & Variables (Light & Obsidian Dark Modes).
- **Audio & Speech**: Web Audio API (`AudioContext`, `GainNode`, `AnalyserNode`), Web Speech Recognition API, YouTube IFrame API.
- **Color Extraction**: HTML5 Canvas pixel analysis (`ctx.getImageData()`) for live album cover artwork palettes.
- **Testing**: End-to-end test suite (`test-e2e.js`) covering speech intents, audio actions, theme toggles, and ambient lighting.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
