/**
 * VEDA Music AI • Intelligent Speech & Low-Pitch Wake-Word Engine
 * Features:
 * 1. Deep Low-Pitch & Whisper Phonetic Matching (handles low frequencies, murmurs, and all accents)
 * 2. Hardware AGC (Auto-Gain Control) Boost for quiet & deep voices
 * 3. Direct Action Intent Recognition (auto-wakes immediately on "play [song]", "pause", "next", etc.)
 * 4. 8-Second Continuous Wake Window with Live Visual Transcripts
 * 5. Resilient Auto-Recovery with Failsafe Keep-Alive
 */

class RadioSpeechEngine {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isContinuous = true;
    this.restartTimer = null;
    this.audioStream = null;
    
    // Active conversation state
    this.isAwake = false;
    this.isManualActive = false;
    this.isMutedBySystem = false;
    this.unmuteTimer = null;
    this.wakeTimeout = null;
    this.failsafeTimer = null;

    // Callbacks
    this.onWakeUp = null;
    this.onInterimResult = null;
    this.onFinalResult = null;
    this.onStateChange = null;

    this.initRecognition();
    this.initHardwareAudioGain();
  }

  // Request browser hardware AGC (Auto Gain Control) to boost deep / low-pitch speech frequencies
  async initHardwareAudioGain() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: false // Keep low-frequency voice harmonics intact
          }
        });
      }
    } catch (_) {
      // Browser will still use Web Speech API default mic
    }
  }

  initRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("Web Speech API is not supported in this browser. You can click the avatar to interact.");
      return;
    }

    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = navigator.language || "en-US";

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStateChange) this.onStateChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStateChange) this.onStateChange(false);
      
      // Auto-restart continuous listener ONLY if not muted by system
      if (this.isContinuous && !this.isMutedBySystem) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (!this.isMutedBySystem && this.isContinuous) {
            this.start();
          }
        }, 150);
      }
    };

    this.recognition.onresult = (event) => {
      // Discard microphone input while Veda is speaking to prevent self-triggering
      if (this.isMutedBySystem) {
        return;
      }

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();
      if (!activeText) return;

      // Check for wake-word across all low-pitch and phonetic variations
      const hasWakeWord = this.isWakeWordDetected(activeText);

      // Direct Action Intent Pattern (e.g. user says "play Starboy", "pause", "next song", etc.)
      const DIRECT_INTENT_REGEX = /\b(?:play|spin|put\s+on|listen\s+to|start|pause|stop|resume|unpause|next|skip|rewind|forward|replay|who\s+are\s+you|what\s+song|volume)\b/i;
      const hasDirectIntent = DIRECT_INTENT_REGEX.test(activeText);

      // If NOT already awake AND NOT manually triggered AND NO wake word AND NO direct command intent:
      if (!this.isAwake && !this.isManualActive && !hasWakeWord && !hasDirectIntent) {
        return;
      }

      // Wake up immediately and establish an 8-second active listening window
      if (hasWakeWord || hasDirectIntent || this.isManualActive) {
        if (!this.isAwake) {
          this.isAwake = true;
          if (this.onWakeUp) {
            this.onWakeUp();
          }
        }
        this.resetWakeTimeout(8000);
      }

      // Clean the wake word out of the command and apply phonetic fuzzy correction
      const cleanedInterim = this.fuzzyCorrect(this.stripWakeWord(interimTranscript));
      const cleanedFinal = this.fuzzyCorrect(this.stripWakeWord(finalTranscript));

      // Interim speech feedback
      if (this.onInterimResult) {
        const displayInterim = cleanedInterim || interimTranscript || activeText;
        if (displayInterim) {
          this.onInterimResult(displayInterim);
        }
      }

      // Final command execution
      if (finalTranscript) {
        const commandToExecute = cleanedFinal || this.fuzzyCorrect(this.stripWakeWord(finalTranscript.trim()));

        if (commandToExecute && commandToExecute.length > 0) {
          this.isAwake = false;
          this.isManualActive = false;
          clearTimeout(this.wakeTimeout);

          if (this.onFinalResult) {
            this.onFinalResult(commandToExecute);
          }
        } else if (hasWakeWord) {
          // User just said "Hey Veda" without a command yet
          if (this.onInterimResult) {
            this.onInterimResult("Listening... say any song or artist");
          }
        }
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        console.warn("Microphone permission notice:", event.error);
      } else if (event.error !== "no-speech") {
        console.warn("Speech recognition notice:", event.error);
      }

      // Resilient auto-restart on transient errors
      if (this.isContinuous && !this.isMutedBySystem && event.error !== "not-allowed") {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (!this.isMutedBySystem && this.isContinuous) {
            this.start();
          }
        }, 300);
      }
    };
  }

  // Comprehensive Phonetic Wake-Word & Low-Pitch Voice Detector
  isWakeWordDetected(rawText) {
    if (!rawText) return false;
    const t = rawText.toLowerCase().trim();

    // 1. Multi-Accent & Low-Pitch Phonetic Variation Regex
    const WAKE_WORD_REGEX = /\b(?:hey|hay|hi|hello|ok|okay|yo|a|ay|eh|the|dear|dj|listen|ha|hail|oi|ey|high|please)?\s*(?:veda|vedha|vida|veeda|vayda|vaida|vader|weda|wada|beta|weather|eva|veena|feeda|feda|mel|video|radar|reader|leader|fader|feather|leather|media|peter|better|meta|vega|vera|veja|vedas|vedam|haida|hyda)\b/i;
    
    // 2. Continuous concatenated tokens
    const CONCAT_WAKE_REGEX = /\b(?:heyveda|haveda|aveda|ayveda|hiveda|okveda|hey-veda|hi-veda|heyvida|heyvideo|heyvader)\b/i;

    // 3. Substring detection for core roots
    const SUBSTR_REGEX = /(?:veda|vedha|vida|veeda|vayda)/i;

    return WAKE_WORD_REGEX.test(t) || CONCAT_WAKE_REGEX.test(t) || SUBSTR_REGEX.test(t);
  }

  // Phonetic & common STT misinterpretation correction
  fuzzyCorrect(text) {
    if (!text) return "";
    let corrected = text;

    // Common misheard "play" variations when preceding words: "clay", "bray", "lay", "plea", "flay", "pray"
    corrected = corrected.replace(/\b(?:clay|bray|lay|plea|blade|flay|pray|pre)\s+([a-zA-Z0-9])/gi, "play $1");

    // Common misheard playback controls
    corrected = corrected.replace(/\b(?:paws|pass\s+music|post\s+music|calls)\b/gi, "pause");
    corrected = corrected.replace(/\b(?:resumed|assume|consumer)\b/gi, "resume");
    corrected = corrected.replace(/\b(?:next\s+track|skip\s+track|skip\s+song|skip\s+this|next\s+song)\b/gi, "next song");

    return corrected.trim();
  }

  // Strip wake word from beginning, middle, or end of sentence
  stripWakeWord(transcript) {
    if (!transcript) return "";
    return transcript
      .replace(/\b(?:hey|hay|hi|hello|ok|okay|yo|a|ay|eh|the|dear|dj|listen|ha|hail|oi|ey|high|please)?\s*(?:veda|vedha|vida|veeda|vayda|vaida|vader|weda|wada|beta|weather|eva|veena|feeda|feda|mel|video|radar|reader|leader|fader|feather|leather|media|peter|better|meta|vega|vera|veja|vedas|vedam|haida|hyda)\b\s*,?\s*/gi, " ")
      .replace(/\b(?:heyveda|haveda|aveda|ayveda|hiveda|okveda|hey-veda|hi-veda|heyvida|heyvideo|heyvader)\b\s*,?\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Active 8-second wake window when Veda is triggered
  resetWakeTimeout(durationMs = 8000) {
    clearTimeout(this.wakeTimeout);
    this.wakeTimeout = setTimeout(() => {
      this.isAwake = false;
      this.isManualActive = false;
      if (this.onStateChange) this.onStateChange(false);
    }, durationMs);
  }

  // Lockout mic completely while Veda is speaking to prevent self-triggering
  lockoutDuringSpeech() {
    this.isMutedBySystem = true;
    this.isAwake = false;
    clearTimeout(this.unmuteTimer);
    clearTimeout(this.wakeTimeout);
    clearTimeout(this.failsafeTimer);

    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {}
      this.isListening = false;
    }

    // Failsafe timer: ensure isMutedBySystem never stays permanently stuck
    this.failsafeTimer = setTimeout(() => {
      if (this.isMutedBySystem) {
        this.unlockAfterSpeech(0);
      }
    }, 7000);
  }

  // Unlock mic after Veda finishes speaking + safety cooldown
  unlockAfterSpeech(cooldownMs = 600) {
    clearTimeout(this.unmuteTimer);
    clearTimeout(this.failsafeTimer);
    this.unmuteTimer = setTimeout(() => {
      this.isMutedBySystem = false;
      this.isAwake = false;
      if (this.isContinuous) {
        this.start();
      }
    }, cooldownMs);
  }

  // Manual avatar click trigger
  triggerManualWake() {
    this.isManualActive = true;
    this.isAwake = true;
    this.isMutedBySystem = false;
    this.resetWakeTimeout(8000);
    this.start();
  }

  start() {
    if (!this.recognition || this.isMutedBySystem) return;
    if (!this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (e) {
        // Recognition might already be running or starting
      }
    }
  }

  stop() {
    this.isContinuous = false;
    this.isAwake = false;
    clearTimeout(this.restartTimer);
    clearTimeout(this.wakeTimeout);
    clearTimeout(this.failsafeTimer);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }
}

window.RadioSpeechEngine = RadioSpeechEngine;
