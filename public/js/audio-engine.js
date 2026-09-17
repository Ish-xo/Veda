/**
 * WVEL 98.7 FM • Web Audio & YouTube Streaming Engine
 * Enhanced with frequency/pitch analysis for soundwave animations.
 */

class RadioAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.isInitialized = false;

    // Web Audio Gain & Analysers
    this.masterGain = null;
    this.voiceGain = null;
    this.masterAnalyser = null;

    // Music State
    this.isPlayingMusic = false;
    this.currentTrack = null;
    this.normalMusicVolume = 0.80;
    this.duckedMusicVolume = 0.18;
    this.voiceVolume = 0.95;

    // FX State
    this.isFxActive = false;
    this.fxFilter = null;
    this.fxShaper = null;

    // Recording State
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.audioDestNode = null;

    // YouTube Player Instance
    this.ytPlayer = null;
    this.isYouTubeMode = false;
    this.activeYouTubeId = null;

    // Active Voice Source (for instant interruption)
    this.activeVoiceSource = null;
    this.isMelSpeaking = false;
    this.isVedaSpeaking = false;

    // Failover callback for unplayable/region-locked tracks
    this.onPlaybackError = null;

    this.initYouTubePlayer();
  }

  initYouTubePlayer() {
    const initYT = () => {
      if (window.YT && window.YT.Player) {
        this.ytPlayer = new window.YT.Player("ytPlayerContainer", {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0
          },
          events: {
            onReady: () => {
              console.log("YouTube Player ready.");
            },
            onStateChange: (event) => {
              // YT.PlayerState.PLAYING is 1
              if (event.data === 1) {
                this.isPlayingMusic = true;
              } else if (event.data === 2 || event.data === 0) {
                this.isPlayingMusic = false;
              }
            },
            onError: (event) => {
              console.warn("YouTube Player encountered error:", event.data);
              this.isPlayingMusic = false;
              if (this.onPlaybackError) {
                this.onPlaybackError(this.activeYouTubeId, event.data);
              }
            }
          }
        });
      }
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      window.onYouTubeIframeAPIReady = initYT;
    }
  }

  async init() {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

    this.masterAnalyser = this.audioCtx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    this.voiceGain = this.audioCtx.createGain();
    this.voiceGain.gain.setValueAtTime(this.voiceVolume, this.audioCtx.currentTime);

    // Create FX Nodes
    this.fxFilter = this.audioCtx.createBiquadFilter();
    this.fxFilter.type = "lowpass";
    this.fxFilter.frequency.value = 22050; // default off (pass all)

    this.fxShaper = this.audioCtx.createWaveShaper();
    this.fxShaper.curve = this.makeDistortionCurve(0); // default off

    // Recording Node
    this.audioDestNode = this.audioCtx.createMediaStreamDestination();

    // Wiring: voice -> fxFilter -> fxShaper -> masterGain
    this.voiceGain.connect(this.fxFilter);
    this.fxFilter.connect(this.fxShaper);
    this.fxShaper.connect(this.masterGain);

    this.masterGain.connect(this.masterAnalyser);
    this.masterGain.connect(this.audioCtx.destination);
    this.masterGain.connect(this.audioDestNode); // Also send to recorder

    this.isInitialized = true;
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  async resumeContext() {
    if (!this.isInitialized) {
      await this.init();
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  // -----------------------------------------------------------
  // FX AND RECORDING
  // -----------------------------------------------------------
  
  makeDistortionCurve(amount) {
    if (amount === 0) return null;
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  toggleFx(isActive) {
    this.isFxActive = isActive;
    if (this.isFxActive) {
      // Tape Warmth / Static settings
      if (this.fxFilter) {
        this.fxFilter.frequency.setValueAtTime(3000, this.audioCtx.currentTime); // Lowpass to muffle
        this.fxFilter.Q.setValueAtTime(2, this.audioCtx.currentTime); // Slight resonance
      }
      if (this.fxShaper) {
        this.fxShaper.curve = this.makeDistortionCurve(50); // Add warmth/crunch
      }
    } else {
      // Clean
      if (this.fxFilter) {
        this.fxFilter.frequency.setValueAtTime(22050, this.audioCtx.currentTime);
        this.fxFilter.Q.setValueAtTime(0, this.audioCtx.currentTime);
      }
      if (this.fxShaper) {
        this.fxShaper.curve = this.makeDistortionCurve(0);
      }
    }
  }

  startRecording() {
    if (!this.audioDestNode) return false;
    this.audioChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.audioDestNode.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (e) {
      console.warn("MediaRecorder error:", e);
      return false;
    }
  }

  stopRecordingAndDownload() {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `Veda_Snippet_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      this.isRecording = false;
    };
    this.mediaRecorder.stop();
  }

  // Play YouTube Track
  async playYouTubeTrack(youtubeId, trackMetadata) {
    await this.resumeContext();
    this.isYouTubeMode = true;
    this.activeYouTubeId = youtubeId;
    this.currentTrack = trackMetadata;

    if (this.ytPlayer && this.ytPlayer.loadVideoById) {
      try {
        this.ytPlayer.loadVideoById(youtubeId);
        this.ytPlayer.setVolume(Math.round(this.normalMusicVolume * 100));
        this.ytPlayer.playVideo();
        this.isPlayingMusic = true;
      } catch (err) {
        console.warn("YouTube player load error:", err);
      }
    }
    return true;
  }

  toggleMusic() {
    if (this.ytPlayer) {
      if (this.isPlayingMusic) {
        this.ytPlayer.pauseVideo();
        this.isPlayingMusic = false;
      } else {
        this.ytPlayer.playVideo();
        this.isPlayingMusic = true;
      }
      return this.isPlayingMusic;
    }
    return false;
  }

  pauseMusic() {
    if (this.ytPlayer && this.ytPlayer.pauseVideo) {
      try { this.ytPlayer.pauseVideo(); } catch (_) {}
    }
    this.isPlayingMusic = false;
  }

  resumeMusic() {
    this.resumeContext();
    if (this.ytPlayer && this.ytPlayer.playVideo) {
      try { this.ytPlayer.playVideo(); } catch (_) {}
    }
    this.isPlayingMusic = true;
  }

  // Seek forward or backward by relative seconds (e.g. +10s or -10s)
  seekRelative(seconds) {
    if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === "function" && typeof this.ytPlayer.seekTo === "function") {
      try {
        const currentTime = this.ytPlayer.getCurrentTime() || 0;
        const duration = (typeof this.ytPlayer.getDuration === "function" ? this.ytPlayer.getDuration() : 99999) || 99999;
        const targetTime = Math.max(0, Math.min(duration, currentTime + seconds));
        this.ytPlayer.seekTo(targetTime, true);
        return targetTime;
      } catch (e) {
        console.warn("YouTube seek error:", e);
      }
    }
    return null;
  }

  // Seek to absolute seconds
  seekTo(seconds) {
    if (this.ytPlayer && typeof this.ytPlayer.seekTo === "function") {
      try {
        const duration = this.getDuration() || 99999;
        const targetTime = Math.max(0, Math.min(duration, seconds));
        this.ytPlayer.seekTo(targetTime, true);
        return targetTime;
      } catch (e) {
        console.warn("YouTube seekTo error:", e);
      }
    }
    return null;
  }

  // Get current playback time in seconds
  getCurrentTime() {
    if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === "function") {
      try {
        return this.ytPlayer.getCurrentTime() || 0;
      } catch (_) {}
    }
    return 0;
  }

  // Get total track duration in seconds
  getDuration() {
    if (this.ytPlayer && typeof this.ytPlayer.getDuration === "function") {
      try {
        return this.ytPlayer.getDuration() || 0;
      } catch (_) {}
    }
    return 0;
  }

  // -----------------------------------------------------------
  // SIDECHAIN AUDIO DUCKING
  // -----------------------------------------------------------
  duckMusic(targetDuckVolume = this.duckedMusicVolume) {
    if (this.ytPlayer && this.ytPlayer.setVolume) {
      try {
        this.ytPlayer.setVolume(Math.round(targetDuckVolume * 100));
      } catch (_) {}
    }
  }

  unduckMusic() {
    if (this.ytPlayer && this.ytPlayer.setVolume) {
      try {
        this.ytPlayer.setVolume(Math.round(this.normalMusicVolume * 100));
      } catch (_) {}
    }
  }

  // -----------------------------------------------------------
  // VEDA VOICE PLAYBACK & INSTANT BARGE-IN INTERRUPTION (< 15ms)
  // -----------------------------------------------------------
  playVedaVoiceBuffer(arrayBuffer, onEndedCallback) {
    return new Promise(async (resolve) => {
      await this.resumeContext();
      this.stopVedaSpeech();

      try {
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        const source = this.audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.voiceGain);

        this.activeVoiceSource = source;
        this.isMelSpeaking = true;
        this.isVedaSpeaking = true;

        // Automatically duck YouTube music
        this.duckMusic(this.duckedMusicVolume);

        source.onended = () => {
          if (this.activeVoiceSource === source) {
            this.activeVoiceSource = null;
            this.isMelSpeaking = false;
            this.isVedaSpeaking = false;
            this.unduckMusic();
            if (onEndedCallback) onEndedCallback();
            resolve();
          }
        };

        source.start(0);
      } catch (err) {
        console.error("Error playing voice buffer:", err);
        this.isMelSpeaking = false;
        this.isVedaSpeaking = false;
        this.unduckMusic();
        if (onEndedCallback) onEndedCallback();
        resolve();
      }
    });
  }

  // Alias for backward compatibility
  playMelVoiceBuffer(arrayBuffer, onEndedCallback) {
    return this.playVedaVoiceBuffer(arrayBuffer, onEndedCallback);
  }

  // Instant Interruption: Cuts off Veda in < 15ms
  stopVedaSpeech() {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.onended = null;
        this.activeVoiceSource.stop(0);
        this.activeVoiceSource.disconnect();
      } catch (e) {}
      this.activeVoiceSource = null;
    }

    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    if (this.isMelSpeaking || this.isVedaSpeaking) {
      this.isMelSpeaking = false;
      this.isVedaSpeaking = false;
      this.unduckMusic();
    }
  }

  // Alias for backward compatibility
  stopMelSpeech() {
    this.stopVedaSpeech();
  }

  // -----------------------------------------------------------
  // ACOUSTIC WAKE CHIME (Synthesized Dual-Tone Beep)
  // -----------------------------------------------------------
  playWakeChime() {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.08); // A5

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1174.66, now); // D6 Harmonic shimmer
      osc2.frequency.exponentialRampToValueAtTime(1760.00, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain || this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.24);
      osc2.stop(now + 0.24);
    } catch (e) {
      console.warn("Wake chime notice:", e);
    }
  }

  // -----------------------------------------------------------
  // AUDIO FREQUENCY & PITCH EXTRACTION (DUAL REAL & SIMULATED)
  // -----------------------------------------------------------
  getAudioLevels() {
    const defaultData = { rms: 0, pitch: 0, maxVal: 0, freqData: new Uint8Array(64), timeData: new Float32Array(64) };
    if (!this.audioCtx) return defaultData;

    let rms = 0;
    let maxVal = 0;
    let maxIndex = 0;
    const bufferLength = this.masterAnalyser ? this.masterAnalyser.frequencyBinCount : 64;
    const timeData = new Float32Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    if (this.masterAnalyser) {
      this.masterAnalyser.getFloatTimeDomainData(timeData);
      this.masterAnalyser.getByteFrequencyData(freqData);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += timeData[i] * timeData[i];
        if (freqData[i] > maxVal) {
          maxVal = freqData[i];
          maxIndex = i;
        }
      }
      rms = Math.sqrt(sum / bufferLength);
    }

    // When YouTube music is playing (iframe sandbox), procedural rhythm synthesis simulates organic 60fps waveforms
    if (this.isPlayingMusic && (!this.isVedaSpeaking && maxVal < 10)) {
      const nowMs = performance.now();
      const t = (nowMs / 1000);
      const songSec = this.getCurrentTime() || t;

      // Percussive Kick & Bass pulse (~124 BPM)
      const beatCycle = (songSec * 2.06) % 1.0;
      const kickEnvelope = Math.pow(Math.max(0, 1.0 - beatCycle * 2.8), 2.2);

      // Mid rhythmic groove
      const midWave1 = Math.sin(t * 7.8) * 0.5 + 0.5;
      const midWave2 = Math.cos(t * 11.3 + 1.2) * 0.5 + 0.5;
      const midEnergy = (midWave1 * 0.6 + midWave2 * 0.4);

      // Treble shimmer
      const trebleShimmer = Math.sin(t * 19.5) * Math.sin(t * 27.2) * 0.5 + 0.5;

      // Populate frequency bins for the 7 bars
      freqData[1] = Math.min(255, Math.floor(kickEnvelope * 220 + 35));     // Sub-bass (Bar 1)
      freqData[4] = Math.min(255, Math.floor(kickEnvelope * 240 + midEnergy * 110 + 40)); // Bass punch (Bar 2)
      freqData[8] = Math.min(255, Math.floor(midEnergy * 210 + kickEnvelope * 90 + 50));  // Low-mid (Bar 3)
      freqData[12] = Math.min(255, Math.floor(midEnergy * 230 + trebleShimmer * 90 + 60)); // Center core (Bar 4)
      freqData[16] = Math.min(255, Math.floor(midEnergy * 200 + kickEnvelope * 80 + 50));  // Mid-high (Bar 5)
      freqData[20] = Math.min(255, Math.floor(trebleShimmer * 210 + midEnergy * 80 + 40)); // Highs (Bar 6)
      freqData[24] = Math.min(255, Math.floor(trebleShimmer * 190 + 35));    // Air/Cymbals (Bar 7)

      rms = Math.min(1.0, 0.25 + kickEnvelope * 0.45 + midEnergy * 0.3);
      maxVal = 240;
    }

    const pitch = (maxIndex / (bufferLength || 1));

    return {
      rms,
      pitch,
      maxVal,
      freqData,
      timeData
    };
  }
}

window.RadioAudioEngine = RadioAudioEngine;
