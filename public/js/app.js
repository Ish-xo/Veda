/**
 * VEDA • Music AI Orchestrator
 * Single-Screen Minimal Light Mode Experience
 * 
 * Features:
 * 1. Fixed Header with Looping Marquee Ticker & Single Dynamic State Indicator
 * 2. Central Stage with smooth crossfade: Blue Cloud Avatar (Paused) <-> 7 Audio Waveform Bars (Playing)
 * 3. Bottom Player Deck: Cover art, bounded track info, seek bar, controls & lyrics toggle
 * 4. Spotify-Style Slide-Out Synchronized Lyrics Panel (Right Side)
 * 5. Strict Wake-Word & Instant Voice Barge-In Integration
 */

document.addEventListener("DOMContentLoaded", () => {
  const audioEngine = new RadioAudioEngine();
  const speechEngine = new RadioSpeechEngine();

  // App State
  let currentTrack = null;
  let playHistory = [];
  let historyIndex = -1;
  let isInterrupted = false;
  let isProcessingCommand = false;
  let pendingTrackToPlay = null;
  let currentAbortController = null;
  let wasPlayingBeforeWakeWord = false;
  let silenceResumeTimer = null;

  // Lyrics & Visual State
  let currentLyrics = [];
  let activeLyricIndex = -1;
  let isLyricsPanelOpen = false;
  let isDraggingSeek = false;
  let isDjLightsActive = true;
  let currentTrackThemeColor = { r: 59, g: 130, b: 246, sr: 147, sg: 51, sb: 234 };

  // DOM Elements - Power Overlay
  const powerOverlay = document.getElementById("powerOverlay");
  const powerBtn = document.getElementById("powerBtn");

  // DOM Elements - Header
  const brandLogo = document.getElementById("brandLogo");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeIcon = document.getElementById("themeIcon");
  const djLightsToggleBtn = document.getElementById("djLightsToggleBtn");
  const appStateIndicator = document.getElementById("appStateIndicator");
  const stateIcon = document.getElementById("stateIcon");
  const stateText = document.getElementById("stateText");

  // DOM Elements - Ambient DJ & Party Lights
  const ambientDjLights = document.getElementById("ambientDjLights");
  const washTL = document.getElementById("washTL");
  const washTR = document.getElementById("washTR");
  const washBL = document.getElementById("washBL");
  const washBR = document.getElementById("washBR");
  const stageWash = document.getElementById("stageWash");
  const lightOrbPrimary = document.getElementById("lightOrbPrimary");
  const lightOrbSecondary = document.getElementById("lightOrbSecondary");
  const lightOrbAccent = document.getElementById("lightOrbAccent");
  const strobeBeamLeft = document.getElementById("strobeBeamLeft");
  const strobeBeamRight = document.getElementById("strobeBeamRight");

  // DOM Elements - Central Stage
  const avatarStageView = document.getElementById("avatarStageView");
  const waveformStageView = document.getElementById("waveformStageView");
  const avatarFrame = document.getElementById("avatarFrame");
  const avatarGraphic = document.getElementById("avatarGraphic");
  const transcriptLive = document.getElementById("transcriptLive");

  // Visualizer 7 Waveform Bars
  const waveBars = [
    document.getElementById("waveBar1"),
    document.getElementById("waveBar2"),
    document.getElementById("waveBar3"),
    document.getElementById("waveBar4"),
    document.getElementById("waveBar5"),
    document.getElementById("waveBar6"),
    document.getElementById("waveBar7")
  ];

  // DOM Elements - Player Control Deck
  const deckCoverImg = document.getElementById("deckCoverImg");
  const deckCoverFallback = document.getElementById("deckCoverFallback");
  const deckTrackTitle = document.getElementById("deckTrackTitle");
  const deckTrackArtist = document.getElementById("deckTrackArtist");
  const deckProgressBar = document.getElementById("deckProgressBar");
  const progressFill = document.getElementById("progressFill");
  const progressThumb = document.getElementById("progressThumb");
  const currentTimeLabel = document.getElementById("currentTimeLabel");
  const totalTimeLabel = document.getElementById("totalTimeLabel");
  const prevBtn = document.getElementById("prevBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const mainPlayIcon = document.getElementById("mainPlayIcon");
  const mainPauseIcon = document.getElementById("mainPauseIcon");
  const nextBtn = document.getElementById("nextBtn");
  const lyricsToggleBtn = document.getElementById("lyricsToggleBtn");

  // DOM Elements - Spotify-Style Slide-Out Lyrics Panel
  const spotifyLyricsPanel = document.getElementById("spotifyLyricsPanel");
  const lyricsPanelTitle = document.getElementById("lyricsPanelTitle");
  const closeLyricsBtn = document.getElementById("closeLyricsBtn");
  const lyricsScrollArea = document.getElementById("lyricsScrollArea");
  const spotifyLyricsStream = document.getElementById("spotifyLyricsStream");

  // -----------------------------------------------------------
  // INITIALIZATION & PERSISTENCE
  // -----------------------------------------------------------
  async function initApp() {
    updateThemeUI();
    setupEventListeners();
    startAudioReactiveLoop();

    // Check if user previously clicked "Enter" to skip intro landing page
    const hasEnteredStudio = localStorage.getItem("veda_studio_entered") === "true";
    if (hasEnteredStudio) {
      if (powerOverlay) {
        powerOverlay.classList.add("hidden");
      }
      document.documentElement.classList.add("studio-entered");
      
      // Auto-start speech engine
      speechEngine.start();
      setAppState("idle");

      // Seamless one-time audio context unlock on first user gesture
      const unlockAudioContext = async () => {
        await audioEngine.resumeContext();
        speechEngine.start();
        document.removeEventListener("pointerdown", unlockAudioContext);
        document.removeEventListener("keydown", unlockAudioContext);
      };
      document.addEventListener("pointerdown", unlockAudioContext, { once: true });
      document.addEventListener("keydown", unlockAudioContext, { once: true });
    }

    // Fetch an initial trending track for metadata display
    await fetchInitialTrendingTrack();
  }

  // -----------------------------------------------------------
  // DARK / LIGHT THEME TOGGLE
  // -----------------------------------------------------------
  function updateThemeUI() {
    const isDark = document.documentElement.classList.contains("dark-theme");
    if (themeIcon) {
      themeIcon.textContent = isDark ? "☀️" : "🌙";
    }
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
      themeToggleBtn.setAttribute("aria-label", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
    }
  }

  function toggleTheme() {
    const isNowDark = document.documentElement.classList.toggle("dark-theme");
    document.body.classList.toggle("dark-theme", isNowDark);
    try {
      localStorage.setItem("veda_theme", isNowDark ? "dark" : "light");
    } catch (_) {}
    updateThemeUI();
  }

  async function fetchInitialTrendingTrack() {
    try {
      const res = await fetch("/api/music/trending");
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        const randomTrack = data.tracks[Math.floor(Math.random() * data.tracks.length)];
        setTrackMetadataOnly(randomTrack);
      }
    } catch (e) {
      console.warn("Trending track fetch notice:", e);
    }
  }

  // -----------------------------------------------------------
  // STATE INDICATOR (Displays ONLY ONE state at a time)
  // -----------------------------------------------------------
  function setAppState(state) {
    if (!appStateIndicator || !stateIcon || !stateText) return;

    appStateIndicator.classList.remove("state-idle", "state-listening", "state-speaking");

    switch (state) {
      case "listening":
        appStateIndicator.classList.add("state-listening");
        stateIcon.textContent = "🎙️";
        stateText.textContent = "Listening...";
        break;

      case "speaking":
        appStateIndicator.classList.add("state-speaking");
        stateIcon.textContent = "🗣️";
        stateText.textContent = "Veda Talking...";
        break;

      case "idle":
      default:
        appStateIndicator.classList.add("state-idle");
        stateIcon.textContent = "🎙️";
        stateText.textContent = speechEngine.isListening ? "Mic Active" : "Mic Active";
        break;
    }
  }

  // -----------------------------------------------------------
  // STAGE VIEW SWAP (Avatar <-> 7 Waveform Bars)
  // -----------------------------------------------------------
  function updateStageView() {
    const isPlaying = audioEngine.isPlayingMusic;

    if (isPlaying) {
      if (avatarStageView) avatarStageView.classList.remove("active");
      if (waveformStageView) waveformStageView.classList.add("active");
      if (mainPlayIcon) mainPlayIcon.style.display = "none";
      if (mainPauseIcon) mainPauseIcon.style.display = "block";
    } else {
      if (avatarStageView) avatarStageView.classList.add("active");
      if (waveformStageView) waveformStageView.classList.remove("active");
      if (mainPlayIcon) mainPlayIcon.style.display = "block";
      if (mainPauseIcon) mainPauseIcon.style.display = "none";
    }
  }

  // -----------------------------------------------------------
  // 7 WAVEFORM BARS & MUSIC-SYNCED DJ PARTY LIGHTS
  // -----------------------------------------------------------
  const BASE_HEIGHTS = [38, 68, 108, 160, 108, 68, 38];
  const FREQ_INDICES = [1, 4, 8, 12, 16, 20, 24];

  function startAudioReactiveLoop() {
    function frame() {
      updateStageView();

      const levels = audioEngine.getAudioLevels();
      const isPlaying = audioEngine.isPlayingMusic;
      const freq = levels.freqData || new Uint8Array(64);
      const rms = levels.rms || 0;

      // 1. Animate 7 Waveform Bars
      if (isPlaying && waveBars.length === 7) {
        waveBars.forEach((bar, i) => {
          if (!bar) return;
          const base = BASE_HEIGHTS[i];
          const fIdx = FREQ_INDICES[i];
          const fVal = (freq[fIdx] || 0) / 255;

          // Symmetrical bounce with rhythmic energy
          const dynamicBoost = (fVal * 55) + (rms * 70);
          const computedHeight = Math.max(18, Math.min(190, base * 0.45 + dynamicBoost));
          bar.style.height = `${computedHeight.toFixed(1)}px`;
        });
      } else {
        // Return to resting base heights
        waveBars.forEach((bar, i) => {
          if (bar) bar.style.height = `${BASE_HEIGHTS[i]}px`;
        });
      }

      // 2. Real-Time Beat Sync for DJ / Party Lights
      if (isDjLightsActive && ambientDjLights) {
        if (isPlaying) {
          const bass = (freq[1] || 0) / 255;
          const lowMid = (freq[4] || 0) / 255;
          const mid = (freq[12] || 0) / 255;
          const treble = (freq[20] || 0) / 255;
          const now = performance.now() / 1000;

          // Pulsing Radial Orbs (Bass & Kick Modulation)
          if (lightOrbPrimary) {
            const pScale = 0.88 + (bass * 0.45) + (rms * 0.25);
            const pOpacity = Math.min(0.85, 0.25 + bass * 0.55);
            const moveX = Math.sin(now * 1.8) * 20;
            const moveY = Math.cos(now * 1.5) * 15;
            lightOrbPrimary.style.transform = `scale(${pScale.toFixed(3)}) translate(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px)`;
            lightOrbPrimary.style.opacity = pOpacity.toFixed(2);
          }

          if (lightOrbSecondary) {
            const sScale = 0.82 + (lowMid * 0.40) + (rms * 0.20);
            const sOpacity = Math.min(0.75, 0.20 + lowMid * 0.50);
            const moveX = Math.cos(now * 2.1) * -25;
            const moveY = Math.sin(now * 1.7) * 20;
            lightOrbSecondary.style.transform = `scale(${sScale.toFixed(3)}) translate(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px)`;
            lightOrbSecondary.style.opacity = sOpacity.toFixed(2);
          }

          if (lightOrbAccent) {
            const aScale = 0.75 + (mid * 0.35);
            const aOpacity = Math.min(0.65, 0.15 + mid * 0.45);
            const moveX = Math.sin(now * 2.5) * 30;
            const moveY = Math.cos(now * 2.3) * -20;
            lightOrbAccent.style.transform = `scale(${aScale.toFixed(3)}) translate(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px)`;
            lightOrbAccent.style.opacity = aOpacity.toFixed(2);
          }

          // Atmospheric Strobe Laser Beams (Sweeps & Flashes)
          if (strobeBeamLeft) {
            const rotL = -35 + Math.sin(now * 1.6) * 18 + (bass * 8);
            const opL = Math.min(0.40, 0.08 + treble * 0.35 + bass * 0.15);
            strobeBeamLeft.style.transform = `translateY(-50%) rotate(${rotL.toFixed(1)}deg)`;
            strobeBeamLeft.style.opacity = opL.toFixed(2);
          }

          if (strobeBeamRight) {
            const rotR = 35 + Math.cos(now * 1.4) * 18 - (bass * 8);
            const opR = Math.min(0.40, 0.08 + treble * 0.35 + lowMid * 0.15);
            strobeBeamRight.style.transform = `translateY(-50%) rotate(${rotR.toFixed(1)}deg)`;
            strobeBeamRight.style.opacity = opR.toFixed(2);
          }

          // 4 Fullscreen Corner Washes Modulation
          if (washTL) {
            const tlScale = 0.92 + (bass * 0.22) + (rms * 0.15);
            washTL.style.transform = `scale(${tlScale.toFixed(3)})`;
            washTL.style.opacity = Math.min(0.85, 0.45 + bass * 0.35).toFixed(2);
          }
          if (washTR) {
            const trScale = 0.90 + (lowMid * 0.20) + (rms * 0.15);
            washTR.style.transform = `scale(${trScale.toFixed(3)})`;
            washTR.style.opacity = Math.min(0.80, 0.40 + lowMid * 0.35).toFixed(2);
          }
          if (washBL) {
            const blScale = 0.90 + (mid * 0.18) + (rms * 0.12);
            washBL.style.transform = `scale(${blScale.toFixed(3)})`;
            washBL.style.opacity = Math.min(0.75, 0.35 + mid * 0.35).toFixed(2);
          }
          if (washBR) {
            const brScale = 0.92 + (bass * 0.20) + (rms * 0.15);
            washBR.style.transform = `scale(${brScale.toFixed(3)})`;
            washBR.style.opacity = Math.min(0.80, 0.40 + bass * 0.35).toFixed(2);
          }

          if (stageWash) {
            stageWash.style.opacity = (0.30 + rms * 0.35).toFixed(2);
          }
        } else {
          // Calm resting glow when paused
          if (washTL) { washTL.style.transform = "scale(0.9)"; washTL.style.opacity = "0.35"; }
          if (washTR) { washTR.style.transform = "scale(0.9)"; washTR.style.opacity = "0.30"; }
          if (washBL) { washBL.style.transform = "scale(0.9)"; washBL.style.opacity = "0.28"; }
          if (washBR) { washBR.style.transform = "scale(0.9)"; washBR.style.opacity = "0.30"; }
          if (lightOrbPrimary) {
            lightOrbPrimary.style.transform = "scale(0.85)";
            lightOrbPrimary.style.opacity = "0.22";
          }
          if (lightOrbSecondary) {
            lightOrbSecondary.style.transform = "scale(0.80)";
            lightOrbSecondary.style.opacity = "0.18";
          }
          if (lightOrbAccent) {
            lightOrbAccent.style.transform = "scale(0.75)";
            lightOrbAccent.style.opacity = "0.14";
          }
          if (strobeBeamLeft) strobeBeamLeft.style.opacity = "0.04";
          if (strobeBeamRight) strobeBeamRight.style.opacity = "0.04";
          if (stageWash) stageWash.style.opacity = "0.20";
        }
      }

      // 3. Update timeline seeker if user is not actively dragging
      if (!isDraggingSeek && audioEngine.isPlayingMusic) {
        updateTimelineProgress();
      }

      // 4. Sync Lyrics if lyrics panel is open
      if (isLyricsPanelOpen) {
        syncLyricsWithPlayback();
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  // -----------------------------------------------------------
  // TIMELINE & PROGRESS BAR
  // -----------------------------------------------------------
  function updateTimelineProgress() {
    const current = audioEngine.getCurrentTime();
    const duration = audioEngine.getDuration();

    if (duration > 0) {
      const pct = Math.max(0, Math.min(100, (current / duration) * 100));
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressThumb) progressThumb.style.left = `${pct}%`;
    }

    if (currentTimeLabel) currentTimeLabel.textContent = formatTime(current);
    if (totalTimeLabel && duration > 0) totalTimeLabel.textContent = formatTime(duration);
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function handleSeekInteraction(e) {
    if (!deckProgressBar) return;
    const rect = deckProgressBar.getBoundingClientRect();
    const clickX = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0)) - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));

    const duration = audioEngine.getDuration() || 180;
    const targetSeconds = pct * duration;

    if (progressFill) progressFill.style.width = `${(pct * 100).toFixed(2)}%`;
    if (progressThumb) progressThumb.style.left = `${(pct * 100).toFixed(2)}%`;
    if (currentTimeLabel) currentTimeLabel.textContent = formatTime(targetSeconds);

    audioEngine.seekTo(targetSeconds);
  }

  // -----------------------------------------------------------
  // SPOTIFY-STYLE SYNCHRONIZED LYRICS
  // -----------------------------------------------------------
  async function fetchLyricsForTrack(title, artist) {
    try {
      const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics && Array.isArray(data.lyrics)) {
          return data.lyrics;
        }
      }
    } catch (e) {
      console.warn("Lyrics fetch notice:", e);
    }
    return null;
  }

  async function loadAndDisplayLyrics(track) {
    if (!track) return;
    currentLyrics = [];
    activeLyricIndex = -1;

    if (spotifyLyricsStream) {
      spotifyLyricsStream.innerHTML = `<div class="spotify-lyric-line placeholder active">Loading synchronized lyrics...</div>`;
    }

    const lyrics = await fetchLyricsForTrack(track.title, track.artist);
    if (lyrics && lyrics.length > 0) {
      currentLyrics = lyrics;
      renderSpotifyLyrics(lyrics);
    } else {
      if (spotifyLyricsStream) {
        spotifyLyricsStream.innerHTML = `<div class="spotify-lyric-line placeholder active">No synchronized lyrics available for this song.</div>`;
      }
    }
  }

  function renderSpotifyLyrics(lyrics) {
    if (!spotifyLyricsStream) return;
    spotifyLyricsStream.innerHTML = "";

    lyrics.forEach((item, index) => {
      const lineEl = document.createElement("div");
      lineEl.className = "spotify-lyric-line";
      lineEl.textContent = item.text || "♪";
      lineEl.dataset.time = item.time;
      lineEl.dataset.index = index;

      lineEl.addEventListener("click", () => {
        if (typeof item.time === "number") {
          audioEngine.seekTo(item.time);
        }
      });

      spotifyLyricsStream.appendChild(lineEl);
    });
  }

  function syncLyricsWithPlayback() {
    if (!currentLyrics || currentLyrics.length === 0) return;

    const currentTime = audioEngine.getCurrentTime();
    let foundIndex = -1;

    for (let i = 0; i < currentLyrics.length; i++) {
      if (currentTime >= currentLyrics[i].time - 0.25) {
        foundIndex = i;
      } else {
        break;
      }
    }

    if (foundIndex !== activeLyricIndex) {
      activeLyricIndex = foundIndex;

      const lines = spotifyLyricsStream.querySelectorAll(".spotify-lyric-line:not(.placeholder)");
      lines.forEach((line, idx) => {
        if (idx === activeLyricIndex) {
          line.classList.add("active");
          // Smoothly scroll active line to center
          line.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          line.classList.remove("active");
        }
      });
    }
  }

  function toggleLyricsPanel() {
    isLyricsPanelOpen = !isLyricsPanelOpen;

    if (spotifyLyricsPanel) {
      if (isLyricsPanelOpen) {
        spotifyLyricsPanel.classList.add("open");
        if (lyricsToggleBtn) lyricsToggleBtn.classList.add("active");
        if (currentTrack) {
          applySpotifyPanelTheme(currentTrack);
        }
      } else {
        spotifyLyricsPanel.classList.remove("open");
        if (lyricsToggleBtn) lyricsToggleBtn.classList.remove("active");
      }
    }
  }

  function closeLyricsPanel() {
    isLyricsPanelOpen = false;
    if (spotifyLyricsPanel) spotifyLyricsPanel.classList.remove("open");
    if (lyricsToggleBtn) lyricsToggleBtn.classList.remove("active");
  }

  function applySpotifyPanelTheme(track) {
    if (!spotifyLyricsPanel) return;
    const { r = 40, g = 30, b = 25 } = currentTrackThemeColor;
    const darkR = Math.max(16, Math.min(50, Math.floor(r * 0.22)));
    const darkG = Math.max(16, Math.min(50, Math.floor(g * 0.22)));
    const darkB = Math.max(16, Math.min(50, Math.floor(b * 0.22)));

    spotifyLyricsPanel.style.backgroundColor = `rgb(${darkR}, ${darkG}, ${darkB})`;
  }

  // -----------------------------------------------------------
  // TRACK MANAGEMENT
  // -----------------------------------------------------------
  function setTrackMetadataOnly(track) {
    if (!track) return;
    currentTrack = track;

    const shortTitle = track.title
      ? track.title.split("|")[0].split("(")[0].replace(/official video/gi, "").trim()
      : "Song name";

    if (deckTrackTitle) deckTrackTitle.textContent = shortTitle;
    if (deckTrackArtist) deckTrackArtist.textContent = track.artist || "Artist name";
    if (lyricsPanelTitle) lyricsPanelTitle.textContent = `${shortTitle} • ${track.artist || ""}`;

    if (track.thumbnail && deckCoverImg) {
      deckCoverImg.src = track.thumbnail;
      deckCoverImg.style.display = "block";
      if (deckCoverFallback) deckCoverFallback.style.opacity = "0";
    }

    // Extract album cover art colors for dynamic stage lights
    extractCoverArtColors(track.thumbnail, track.colors);
  }

  // -----------------------------------------------------------
  // DYNAMIC COVER ART COLOR EXTRACTION FOR DJ LIGHTS
  // -----------------------------------------------------------
  function applyLiveThemeColors(primary, secondary) {
    const p = primary || [59, 130, 246];
    const s = secondary || [147, 51, 234];
    currentTrackThemeColor = { r: p[0], g: p[1], b: p[2], sr: s[0], sg: s[1], sb: s[2] };

    // Dynamically update DJ Party Light gradients with high depth and vibrancy
    if (washTL) {
      washTL.style.background = `radial-gradient(circle, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.38) 0%, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.08) 55%, transparent 75%)`;
    }
    if (washTR) {
      washTR.style.background = `radial-gradient(circle, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.35) 0%, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.07) 55%, transparent 75%)`;
    }
    if (washBL) {
      washBL.style.background = `radial-gradient(circle, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.32) 0%, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.06) 55%, transparent 75%)`;
    }
    if (washBR) {
      washBR.style.background = `radial-gradient(circle, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.35) 0%, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.07) 55%, transparent 75%)`;
    }

    if (lightOrbPrimary) {
      lightOrbPrimary.style.background = `radial-gradient(circle, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.42) 0%, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.08) 55%, transparent 75%)`;
    }
    if (lightOrbSecondary) {
      lightOrbSecondary.style.background = `radial-gradient(circle, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.36) 0%, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.07) 55%, transparent 75%)`;
    }
    if (lightOrbAccent) {
      const accR = Math.min(255, Math.round((p[0] + s[0]) / 2));
      const accG = Math.min(255, Math.round((p[1] + s[1]) / 2));
      const accB = Math.min(255, Math.round((p[2] + s[2]) / 2));
      lightOrbAccent.style.background = `radial-gradient(circle, rgba(${accR}, ${accG}, ${accB}, 0.30) 0%, rgba(${accR}, ${accG}, ${accB}, 0.05) 55%, transparent 75%)`;
    }
    if (stageWash) {
      stageWash.style.background = `radial-gradient(circle at 50% 50%, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.06) 0%, transparent 65%)`;
    }
    if (strobeBeamLeft) {
      strobeBeamLeft.style.background = `linear-gradient(90deg, rgba(${p[0]}, ${p[1]}, ${p[2]}, 0.45) 0%, transparent 80%)`;
    }
    if (strobeBeamRight) {
      strobeBeamRight.style.background = `linear-gradient(90deg, rgba(${s[0]}, ${s[1]}, ${s[2]}, 0.45) 0%, transparent 80%)`;
    }

    if (isLyricsPanelOpen && currentTrack) {
      applySpotifyPanelTheme(currentTrack);
    }
  }

  function extractCoverArtColors(imgSrc, fallbackColors) {
    if (!imgSrc) {
      if (fallbackColors) {
        applyLiveThemeColors(fallbackColors.primary, fallbackColors.secondary);
      }
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32).data;

        let dominant = null;
        let secondary = null;
        let maxScore = -1;
        let secondMaxScore = -1;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          if (sat > 0.18 && lum > 0.18 && lum < 0.88) {
            const score = sat * 1.6 + (1 - Math.abs(lum - 0.5));
            if (score > maxScore) {
              secondMaxScore = maxScore;
              secondary = dominant;
              maxScore = score;
              dominant = [r, g, b];
            } else if (score > secondMaxScore && (!dominant || (Math.abs(r - dominant[0]) + Math.abs(g - dominant[1]) + Math.abs(b - dominant[2]) > 60))) {
              secondMaxScore = score;
              secondary = [r, g, b];
            }
          }
        }

        if (dominant) {
          if (!secondary) {
            secondary = [
              (dominant[1] + 60) % 255,
              (dominant[2] + 100) % 255,
              (dominant[0] + 80) % 255
            ];
          }
          applyLiveThemeColors(dominant, secondary);
        } else if (fallbackColors) {
          applyLiveThemeColors(fallbackColors.primary, fallbackColors.secondary);
        }
      } catch (_) {
        if (fallbackColors) {
          applyLiveThemeColors(fallbackColors.primary, fallbackColors.secondary);
        }
      }
    };

    img.onerror = () => {
      if (fallbackColors) {
        applyLiveThemeColors(fallbackColors.primary, fallbackColors.secondary);
      }
    };

    img.src = imgSrc;
  }

  async function queueAndPlayTrack(track) {
    if (!track) return;
    setTrackMetadataOnly(track);

    playHistory.push(track);
    historyIndex = playHistory.length - 1;

    // Load Spotify lyrics in background
    loadAndDisplayLyrics(track);

    // Play YouTube Audio
    if (track.youtubeId) {
      await audioEngine.playYouTubeTrack(track.youtubeId);
    }

    updateStageView();
  }

  async function playRandomTrendingSong() {
    await audioEngine.resumeContext();
    if (transcriptLive) transcriptLive.textContent = "Finding a trending song...";
    try {
      const res = await fetch("/api/music/trending");
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        const available = data.tracks.filter(t => !currentTrack || t.youtubeId !== currentTrack.youtubeId);
        const pool = available.length > 0 ? available : data.tracks;
        const randomTrack = pool[Math.floor(Math.random() * pool.length)];

        const shortTitle = randomTrack.title ? randomTrack.title.split("|")[0].split("(")[0].replace(/official video/gi, "").trim() : "Music";
        const speechText = `Playing ${shortTitle} by ${randomTrack.artist}.`;

        if (transcriptLive) transcriptLive.textContent = speechText;
        pendingTrackToPlay = randomTrack;
        setTrackMetadataOnly(randomTrack);
        await playVedaVoice(speechText);
      }
    } catch (err) {
      console.warn("Trending song fetch notice:", err);
    }
  }

  // -----------------------------------------------------------
  // CHAT & CONCISE VEDA ANNOUNCEMENTS
  // -----------------------------------------------------------
  async function sendCallerMessage(text) {
    if (!text || !text.trim()) return;
    if (isProcessingCommand) return;

    isProcessingCommand = true;
    const callerMsg = text.trim();

    await audioEngine.resumeContext();
    if (transcriptLive) transcriptLive.textContent = `"${callerMsg}"`;

    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: currentAbortController.signal,
        body: JSON.stringify({
          message: callerMsg,
          isInterrupted: isInterrupted
        })
      });

      isInterrupted = false;
      if (!chatRes.ok) throw new Error("Chat failed");

      const chatData = await chatRes.json();
      const vedaResponseText = chatData.text;

      // Handle backend action
      if (chatData.action) {
        if (chatData.action.type === "play_youtube") {
          pendingTrackToPlay = chatData.action.track;
          setTrackMetadataOnly(pendingTrackToPlay);
          audioEngine.pauseMusic();
        } else if (chatData.action.type === "pause_music") {
          audioEngine.pauseMusic();
          pendingTrackToPlay = null;
        } else if (chatData.action.type === "resume_music") {
          audioEngine.resumeMusic();
          pendingTrackToPlay = null;
        } else if (chatData.action.type === "replay_music") {
          audioEngine.seekTo(0);
          audioEngine.resumeMusic();
          pendingTrackToPlay = null;
        } else if (chatData.action.type === "seek_relative") {
          const secs = chatData.action.seconds || 10;
          audioEngine.seekRelative(secs);
          pendingTrackToPlay = null;
        }
      }

      if (transcriptLive) transcriptLive.textContent = vedaResponseText;

      // Speak announcement ONCE and start song sequentially when speech finishes
      await playVedaVoice(vedaResponseText, currentAbortController.signal);

    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Interrupted for barge-in.");
      } else {
        console.error("Chat notice:", err);
        if (transcriptLive) transcriptLive.textContent = "Say 'Hey Veda' to play any song.";
        setAppState("idle");
      }
    } finally {
      currentAbortController = null;
      isProcessingCommand = false;
    }
  }

  // Speak Veda Voice with Neural Edge TTS & WebSpeech API Fallback
  async function playVedaVoice(text, abortSignal) {
    speechEngine.lockoutDuringSpeech();
    setAppState("speaking");

    let spokeSuccessfully = false;

    try {
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortSignal,
        body: JSON.stringify({
          text: text,
          voice: "en-US-AvaNeural",
          pitch: "-2Hz",
          rate: "-2%"
        })
      });

      if (ttsRes.ok) {
        const audioBuffer = await ttsRes.arrayBuffer();
        await audioEngine.playVedaVoiceBuffer(audioBuffer);
        spokeSuccessfully = true;
      }
    } catch (err) {
      if (err.name === "AbortError") {
        speechEngine.unlockAfterSpeech(600);
        return;
      }
      console.warn("Edge TTS notice, falling back to speech synthesis:", err);
    }

    // Resilient fallback to browser SpeechSynthesis
    if (!spokeSuccessfully && window.speechSynthesis && !abortSignal?.aborted) {
      try {
        await new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.98;
          utterance.pitch = 1.0;
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Ava")));
          if (preferredVoice) utterance.voice = preferredVoice;

          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        });
        spokeSuccessfully = true;
      } catch (_) {}
    }

    // Speech completed naturally
    setAppState("idle");

    // Play staged track if pending
    if (pendingTrackToPlay) {
      const track = pendingTrackToPlay;
      pendingTrackToPlay = null;
      queueAndPlayTrack(track);
    }

    speechEngine.unlockAfterSpeech(600);
  }

  // -----------------------------------------------------------
  // BARGE-IN INTERRUPTION & SILENCE AUTO-RESUME
  // -----------------------------------------------------------
  function triggerInterruption() {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    if (audioEngine.isVedaSpeaking || audioEngine.isMelSpeaking) {
      audioEngine.stopVedaSpeech();
      isInterrupted = true;
    }

    if (audioEngine.isPlayingMusic) {
      wasPlayingBeforeWakeWord = true;
      audioEngine.pauseMusic();
    }

    pendingTrackToPlay = null;
    setAppState("listening");
    if (transcriptLive) transcriptLive.textContent = "Listening to you... (Say any song or command)";

    startSilenceResumeTimer(8);
  }

  function startSilenceResumeTimer(seconds = 8) {
    clearTimeout(silenceResumeTimer);
    silenceResumeTimer = setTimeout(() => {
      if (wasPlayingBeforeWakeWord && !isProcessingCommand && !audioEngine.isVedaSpeaking) {
        audioEngine.resumeMusic();
        wasPlayingBeforeWakeWord = false;
        setAppState("idle");
      } else if (!isProcessingCommand && !audioEngine.isVedaSpeaking) {
        setAppState("idle");
        if (transcriptLive) {
          transcriptLive.textContent = 'Say "Hey Veda" or click avatar to talk';
        }
      }
    }, seconds * 1000);
  }

  // -----------------------------------------------------------
  // EVENT LISTENERS & KEYBOARD SHORTCUTS
  // -----------------------------------------------------------
  function setupEventListeners() {
    // 1. Power On Studio (Enter)
    if (powerBtn) {
      powerBtn.addEventListener("click", async () => {
        try {
          localStorage.setItem("veda_studio_entered", "true");
          document.documentElement.classList.add("studio-entered");
        } catch (_) {}

        const introVideo = document.getElementById("introVideo");
        if (introVideo) {
          try { introVideo.pause(); } catch (_) {}
        }
        await audioEngine.init();
        audioEngine.playWakeChime();
        speechEngine.start();
        setAppState("idle");
        if (powerOverlay) powerOverlay.classList.add("hidden");
      });
    }

    // 2. Brand Logo Click (Reset / Return to Intro Landing Screen)
    if (brandLogo) {
      brandLogo.setAttribute("title", "Click to view Intro screen");
      brandLogo.addEventListener("click", () => {
        try {
          localStorage.removeItem("veda_studio_entered");
          document.documentElement.classList.remove("studio-entered");
          if (powerOverlay) powerOverlay.classList.remove("hidden");
        } catch (_) {}
      });
    }

    // 2A. Dark Mode Theme Toggle Button
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        toggleTheme();
      });
    }

    // 2B. DJ Party Lights Toggle Button
    if (djLightsToggleBtn) {
      djLightsToggleBtn.addEventListener("click", () => {
        isDjLightsActive = !isDjLightsActive;
        if (isDjLightsActive) {
          djLightsToggleBtn.classList.add("active");
          if (ambientDjLights) ambientDjLights.classList.remove("disabled");
        } else {
          djLightsToggleBtn.classList.remove("active");
          if (ambientDjLights) ambientDjLights.classList.add("disabled");
        }
      });
    }

    // 3. Click Avatar to Talk / Interrupt
    if (avatarStageView) {
      avatarStageView.addEventListener("click", async () => {
        await audioEngine.resumeContext();
        if (audioEngine.isVedaSpeaking) {
          triggerInterruption();
        } else {
          audioEngine.playWakeChime();
          speechEngine.triggerManualWake();
          setAppState("listening");
          if (transcriptLive) transcriptLive.textContent = "Listening to you... (Say any song name)";
        }
      });
    }

    // 4. Play / Pause Button
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", async () => {
        await audioEngine.resumeContext();
        if (audioEngine.isPlayingMusic) {
          audioEngine.pauseMusic();
        } else {
          if (currentTrack) {
            audioEngine.resumeMusic();
          } else {
            await playRandomTrendingSong();
          }
        }
        updateStageView();
      });
    }

    // 5. Next Track Button
    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        await playRandomTrendingSong();
      });
    }

    // 6. Previous Track Button
    if (prevBtn) {
      prevBtn.addEventListener("click", async () => {
        if (historyIndex > 0) {
          historyIndex--;
          const prevTrack = playHistory[historyIndex];
          queueAndPlayTrack(prevTrack);
        } else {
          audioEngine.seekTo(0);
        }
      });
    }

    // 7. Lyrics Toggle Button & Close Drawer Button
    if (lyricsToggleBtn) {
      lyricsToggleBtn.addEventListener("click", () => {
        toggleLyricsPanel();
      });
    }

    if (closeLyricsBtn) {
      closeLyricsBtn.addEventListener("click", () => {
        closeLyricsPanel();
      });
    }

    // 8. Seek Bar Interaction
    if (deckProgressBar) {
      deckProgressBar.addEventListener("mousedown", (e) => {
        isDraggingSeek = true;
        deckProgressBar.classList.add("dragging");
        handleSeekInteraction(e);
      });

      window.addEventListener("mousemove", (e) => {
        if (isDraggingSeek) {
          handleSeekInteraction(e);
        }
      });

      window.addEventListener("mouseup", () => {
        if (isDraggingSeek) {
          isDraggingSeek = false;
          if (deckProgressBar) deckProgressBar.classList.remove("dragging");
        }
      });

      // Touch support for mobile/tablets
      deckProgressBar.addEventListener("touchstart", (e) => {
        isDraggingSeek = true;
        deckProgressBar.classList.add("dragging");
        handleSeekInteraction(e);
      }, { passive: true });

      window.addEventListener("touchmove", (e) => {
        if (isDraggingSeek) {
          handleSeekInteraction(e);
        }
      }, { passive: true });

      window.addEventListener("touchend", () => {
        if (isDraggingSeek) {
          isDraggingSeek = false;
          if (deckProgressBar) deckProgressBar.classList.remove("dragging");
        }
      });
    }

    // 9. Speech Engine Hook Callbacks
    speechEngine.onWakeUp = () => {
      audioEngine.playWakeChime();
      triggerInterruption();
    };

    speechEngine.onInterimResult = (text) => {
      setAppState("listening");
      if (transcriptLive) transcriptLive.textContent = `"${text}"`;
      startSilenceResumeTimer(8);
    };

    speechEngine.onFinalResult = (command) => {
      clearTimeout(silenceResumeTimer);
      sendCallerMessage(command);
    };

    speechEngine.onStateChange = (isListening) => {
      if (!audioEngine.isVedaSpeaking && !isProcessingCommand) {
        setAppState("idle");
      }
    };

    // 10. YouTube Player Unplayable / Region Block Failover
    audioEngine.onPlaybackError = async (failedYtId, errorCode) => {
      console.warn(`Track ${failedYtId} failed with code ${errorCode}. Auto-failover to next hit...`);
      if (transcriptLive) transcriptLive.textContent = "Track restricted, finding alternative version...";
      await playRandomTrendingSong();
    };

    // 11. Global Keyboard Shortcuts
    window.addEventListener("keydown", async (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        await audioEngine.resumeContext();
        if (audioEngine.isPlayingMusic) {
          audioEngine.pauseMusic();
        } else {
          if (currentTrack) audioEngine.resumeMusic();
          else await playRandomTrendingSong();
        }
        updateStageView();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        audioEngine.seekRelative(10);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        audioEngine.seekRelative(-10);
      } else if (e.code === "KeyL") {
        e.preventDefault();
        toggleLyricsPanel();
      } else if (e.code === "KeyV") {
        e.preventDefault();
        await audioEngine.resumeContext();
        audioEngine.playWakeChime();
        speechEngine.triggerManualWake();
        setAppState("listening");
        if (transcriptLive) transcriptLive.textContent = "Listening to you... (Say any song name)";
      } else if (e.code === "Escape") {
        if (isLyricsPanelOpen) closeLyricsPanel();
      }
    });
  }

  // Bootstrap application
  initApp();
});
