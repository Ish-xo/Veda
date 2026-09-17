import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { YouTube } from "youtube-sr";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/SVG", express.static(path.join(__dirname, "SVG")));
app.use("/svg", express.static(path.join(__dirname, "SVG")));

let currentPlayingTrack = null;

// =========================================================
// YOUTUBE SEARCH & TRENDING ENGINE
// =========================================================

// Vibrant color palettes for dynamic ambient stage lights
const VIBRANT_PALETTES = [
  { primary: [59, 130, 246], secondary: [147, 51, 234] }, // Royal Blue & Purple
  { primary: [236, 72, 153], secondary: [139, 92, 246] }, // Hot Pink & Violet
  { primary: [249, 115, 22], secondary: [239, 68, 68] },  // Sunset Orange & Crimson
  { primary: [16, 185, 129], secondary: [6, 182, 212] },  // Emerald & Cyan
  { primary: [99, 102, 241], secondary: [236, 72, 153] }, // Indigo & Rose
  { primary: [245, 158, 11], secondary: [239, 68, 68] },  // Amber & Ruby
  { primary: [14, 165, 233], secondary: [59, 130, 246] }, // Electric Blue & Sky
  { primary: [168, 85, 247], secondary: [236, 72, 153] }  // Violet & Fuchsia
];

function getTrackColors(title, artist) {
  let hash = 0;
  const str = (title || "") + (artist || "");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % VIBRANT_PALETTES.length;
  return VIBRANT_PALETTES[index];
}

// Clean title and artist to maximize LRCLIB match rate
function cleanSongQuery(rawTitle, rawArtist) {
  let track = (rawTitle || "").trim();
  let artist = (rawArtist || "").trim();

  // If title is "Artist - Title" or "Artist : Title", split it
  if (track.includes(" - ")) {
    const parts = track.split(" - ");
    if (parts.length >= 2) {
      if (!artist || artist === "Various Artists" || /vevo|records|music|official|t-series|speed records|zee music/i.test(artist)) {
        artist = parts[0].trim();
      }
      track = parts.slice(1).join(" - ").trim();
    }
  } else if (track.includes(" | ")) {
    const parts = track.split(" | ");
    track = parts[0].trim();
  }

  // Strip YouTube clutter, parentheticals, brackets, and video tags
  track = track
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\{.*?\}/g, "")
    .replace(/\|.*$/g, "")
    .replace(/•.*$/g, "")
    .replace(/\b(?:ft\.|feat\.|featuring)\s+[a-zA-Z0-9\s&,]+/gi, "")
    .replace(/\b(?:official music video|official video|official audio|full video song|full audio song|lyric video|lyrics|4k|hd|remix|audio|video)\b/gi, "")
    .replace(/["'“”]/g, "")
    .trim();

  artist = artist
    .replace(/vevo/gi, "")
    .replace(/topic/gi, "")
    .replace(/official/gi, "")
    .replace(/records/gi, "")
    .replace(/music/gi, "")
    .replace(/channel/gi, "")
    .trim();

  return {
    track: track || rawTitle,
    artist: artist || rawArtist || "Artist"
  };
}

// Search single song on YouTube with optional exclusion
async function searchSong(query, excludeId = null) {
  try {
    const results = await YouTube.search(query, { limit: 5, type: "video" });
    if (results && results.length > 0) {
      const valid = results.find(v => !excludeId || v.id !== excludeId) || results[0];
      const rawTitle = valid.title || query;
      const channel = valid.channel?.name || "Various Artists";
      const colors = getTrackColors(rawTitle, channel);

      return {
        id: `yt-${valid.id}`,
        youtubeId: valid.id,
        title: rawTitle,
        artist: channel,
        colors,
        url: `https://www.youtube.com/watch?v=${valid.id}`,
        thumbnail: valid.thumbnail?.url || `https://img.youtube.com/vi/${valid.id}/hqdefault.jpg`,
        duration: valid.durationFormatted || ""
      };
    }
  } catch (err) {
    console.warn("YouTube search error:", err.message);
  }
  return null;
}

// Curated fallback trending hits
const FALLBACK_TRENDING = [
  { id: "yt-JGwWNGJdvx8", youtubeId: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", colors: { primary: [59, 130, 246], secondary: [147, 51, 234] }, url: "https://www.youtube.com/watch?v=JGwWNGJdvx8", thumbnail: "https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg" },
  { id: "yt-34Na4j8AVgA", youtubeId: "34Na4j8AVgA", title: "Starboy", artist: "The Weeknd ft. Daft Punk", colors: { primary: [239, 68, 68], secondary: [168, 85, 247] }, url: "https://www.youtube.com/watch?v=34Na4j8AVgA", thumbnail: "https://img.youtube.com/vi/34Na4j8AVgA/hqdefault.jpg" },
  { id: "yt-09R8_2nJtjg", youtubeId: "09R8_2nJtjg", title: "Sugar", artist: "Maroon 5", colors: { primary: [236, 72, 153], secondary: [249, 115, 22] }, url: "https://www.youtube.com/watch?v=09R8_2nJtjg", thumbnail: "https://img.youtube.com/vi/09R8_2nJtjg/hqdefault.jpg" },
  { id: "yt-7wtfhZwyrcc", youtubeId: "7wtfhZwyrcc", title: "Believer", artist: "Imagine Dragons", colors: { primary: [16, 185, 129], secondary: [59, 130, 246] }, url: "https://www.youtube.com/watch?v=7wtfhZwyrcc", thumbnail: "https://img.youtube.com/vi/7wtfhZwyrcc/hqdefault.jpg" },
  { id: "yt-kJQP7kiw5Fk", youtubeId: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", colors: { primary: [249, 115, 22], secondary: [239, 68, 68] }, url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk", thumbnail: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg" }
];

// Get trending songs on YouTube
async function getTrendingSongs(limit = 10) {
  try {
    const results = await YouTube.search("Top trending music hits", { limit, type: "video" });
    if (results && results.length > 0) {
      return results.map(video => {
        const title = video.title || "Trending Song";
        const artist = video.channel?.name || "Popular Artist";
        return {
          id: `yt-${video.id}`,
          youtubeId: video.id,
          title,
          artist,
          colors: getTrackColors(title, artist),
          url: `https://www.youtube.com/watch?v=${video.id}`,
          thumbnail: video.thumbnail?.url || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
          duration: video.durationFormatted || ""
        };
      });
    }
  } catch (err) {
    console.warn("Trending fetch fallback active:", err.message);
  }
  return FALLBACK_TRENDING;
}

// API: Get Trending Tracks
app.get("/api/music/trending", async (req, res) => {
  try {
    const trending = await getTrendingSongs(10);
    res.json({ tracks: trending, currentTrack: currentPlayingTrack || trending[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to get trending music" });
  }
});

// API: Search Alternative Version if Embed Restricted
app.get("/api/music/alternative", async (req, res) => {
  try {
    const { query, excludeId } = req.query;
    if (!query) return res.status(400).json({ error: "Query required" });
    const track = await searchSong(query, excludeId);
    if (track) {
      currentPlayingTrack = track;
      return res.json({ track });
    }
    const trending = await getTrendingSongs(1);
    res.json({ track: trending[0] });
  } catch (err) {
    res.status(500).json({ error: "Alternative search failed" });
  }
});

// Helper: Parse LRC text into array of { time: seconds, text: string }
function parseLRC(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const result = [];
  const regex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)/;

  lines.forEach((line) => {
    const match = line.match(regex);
    if (match) {
      const minutes = parseFloat(match[1]);
      const seconds = parseFloat(match[2]);
      const timeInSeconds = minutes * 60 + seconds;
      const text = match[3].trim();
      if (text) {
        result.push({ time: parseFloat(timeInSeconds.toFixed(2)), text });
      }
    }
  });

  return result.sort((a, b) => a.time - b.time);
}

// Fallback synchronized lyrics generator
function generateFallbackLyrics(title, artist) {
  const shortTitle = (title || "Track").split("|")[0].split("(")[0].replace(/official video/gi, "").trim();
  const artistName = artist || "Artist";
  
  const sampleLines = [
    `🎵 Instrumental intro...`,
    `Feel the rhythm taking over the room`,
    `Every beat echoes through the night`,
    `Lost in the melody of ${shortTitle}`,
    `Turn the volume up and let it ride`,
    `The baseline kicks and sets us free`,
    `Veda Music AI on the broadcast`,
    `Vibrations flowing endlessly`,
    `Hear the voice of ${artistName}`,
    `Singing straight into the soul`,
    `Let the frequency take control`,
    `Drop the chorus, feel the sound`,
    `No looking back, we're off the ground`,
    `Pure waves in motion tonight`,
    `Music orchestrator playing live...`
  ];

  return sampleLines.map((text, idx) => ({
    time: parseFloat((idx * 6.0 + 2.0).toFixed(1)),
    text
  }));
}

// API: Get Lyrics for Current Song (LRCLIB Multi-Tier Search)
app.get("/api/lyrics", async (req, res) => {
  try {
    const { title, artist } = req.query;
    if (!title) return res.status(400).json({ error: "Title required" });

    const cleaned = cleanSongQuery(title, artist);
    console.log(`[Lyrics API] Multi-tier lookup for: track="${cleaned.track}", artist="${cleaned.artist}"`);

    let syncedLrc = null;
    let plainLrc = null;

    // 1. Try exact LRCLIB /api/get
    try {
      const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleaned.track)}&artist_name=${encodeURIComponent(cleaned.artist)}`;
      const getRes = await fetch(getUrl, {
        headers: { "User-Agent": "VedaOrchestrator/1.0" },
        signal: AbortSignal.timeout(3500)
      });
      if (getRes.ok) {
        const data = await getRes.json();
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          syncedLrc = data.syncedLyrics;
          plainLrc = data.plainLyrics;
        }
      }
    } catch (e) {}

    // 2. Try LRCLIB /api/search with track + artist
    if (!syncedLrc && !plainLrc) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleaned.track + " " + cleaned.artist)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { "User-Agent": "VedaOrchestrator/1.0" },
          signal: AbortSignal.timeout(3500)
        });
        if (searchRes.ok) {
          const hits = await searchRes.json();
          if (hits && hits.length > 0) {
            const bestHit = hits.find(h => h.syncedLyrics) || hits[0];
            if (bestHit) {
              syncedLrc = bestHit.syncedLyrics;
              plainLrc = bestHit.plainLyrics;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Try LRCLIB /api/search with clean track title only
    if (!syncedLrc && !plainLrc && cleaned.track.length > 2) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleaned.track)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { "User-Agent": "VedaOrchestrator/1.0" },
          signal: AbortSignal.timeout(3500)
        });
        if (searchRes.ok) {
          const hits = await searchRes.json();
          if (hits && hits.length > 0) {
            const bestHit = hits.find(h => h.syncedLyrics) || hits[0];
            if (bestHit) {
              syncedLrc = bestHit.syncedLyrics;
              plainLrc = bestHit.plainLyrics;
            }
          }
        }
      } catch (e) {}
    }

    // 3. If synced LRC found, parse and return
    if (syncedLrc) {
      const parsed = parseLRC(syncedLrc);
      if (parsed.length > 0) {
        return res.json({
          title: cleaned.track,
          artist: cleaned.artist,
          synced: true,
          lyrics: parsed,
          rawLRC: syncedLrc
        });
      }
    }

    // 4. If plain lyrics found, space them out
    if (plainLrc) {
      const lines = plainLrc.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      const spaced = lines.map((text, idx) => ({
        time: parseFloat((idx * 4.5 + 2.0).toFixed(2)),
        text
      }));
      return res.json({
        title: cleaned.track,
        artist: cleaned.artist,
        synced: true,
        lyrics: spaced
      });
    }

    // 5. Fallback generator
    const fallback = generateFallbackLyrics(cleaned.track, cleaned.artist);
    return res.json({
      title: cleaned.track,
      artist: cleaned.artist,
      synced: true,
      lyrics: fallback
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// =========================================================
// CONCISE DJ VEDA VOICE & CHAT ENGINE
// =========================================================

function normalizeSpokenCommand(rawMessage) {
  if (!rawMessage) return "";
  let text = rawMessage.toLowerCase().trim();

  // 1. Remove wake words and phonetic variants
  text = text.replace(/\b(?:hey|hi|hello|ok|okay|yo|a|the|dear|dj)?\s*(?:veda|vedha|vida|veeda|vayda|vaida|vader|weda|wada|beta|weather|eva|veena|feeda|feda|mel)\b/gi, " ");

  // 2. Remove conversational openers
  text = text.replace(/\b(?:can you please|could you please|can you|could you|please|i want to hear|i want to listen to|i wanna hear|i wanna listen to|let's play|let's hear|let's listen to|i would like to hear|i would like to listen to|search and play|stream)\b/gi, " ");

  // 3. Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

async function generateVedaResponse({ message, isInterrupted }) {
  const rawMsg = (message || "").trim();
  const cleanCmd = normalizeSpokenCommand(rawMsg);
  const msgLower = (cleanCmd || rawMsg).toLowerCase();

  // 1. Generic Music Request (e.g. "play music", "play a song", "play something", "a music", "some songs")
  const isGenericMusic = /^(?:play\s+)?(?:a\s+)?(?:music|some\s+music|song|songs|some\s+songs|something|any\s+song|any\s+music|trending|hits|top\s+songs|party\s+music)$/i.test(msgLower) || msgLower === "play" || msgLower === "music";
  
  if (isGenericMusic) {
    const trending = await getTrendingSongs(10);
    const pool = trending.filter(t => !currentPlayingTrack || t.youtubeId !== currentPlayingTrack.youtubeId);
    const selectedTrack = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : trending[0];
    if (selectedTrack) {
      currentPlayingTrack = selectedTrack;
      const shortTitle = selectedTrack.title.split("|")[0].split("(")[0].replace(/official video/gi, "").trim();
      return {
        text: `Playing ${shortTitle} by ${selectedTrack.artist}.`,
        action: {
          type: "play_youtube",
          track: selectedTrack
        }
      };
    }
  }

  // 2. Specific Song / Play Intent (e.g. "play starboy", "listen to dilbar neha kakkar", "put on deftones rosemary")
  const playMatch = msgLower.match(/(?:play|spin|put\s+on|drop|listen\s+to|hear|start)\s+(.+)/i);
  
  if (playMatch) {
    let query = playMatch[1]
      .replace(/\b(?:for me|please|song|songs|track|tracks|music|audio|official video|video|lyrics)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    if (query) {
      const track = await searchSong(query);
      if (track) {
        currentPlayingTrack = track;
        const shortTitle = track.title.split("|")[0].split("(")[0].replace(/official video/gi, "").trim();
        const text = `Playing ${shortTitle} by ${track.artist}.`;
        
        return {
          text,
          action: {
            type: "play_youtube",
            track
          }
        };
      }
    }
  }

  // 3. Seek / Forward / Rewind / Skip Intro Requests
  if (msgLower.includes("skip intro") || msgLower.includes("intro")) {
    return {
      text: "Skipping intro.",
      action: { type: "seek_relative", seconds: 15 }
    };
  }

  if (
    msgLower.includes("forward") ||
    msgLower.includes("fast forward") ||
    msgLower.includes("skip 10") ||
    msgLower.includes("ahead 10") ||
    msgLower.includes("skip ahead")
  ) {
    const secMatch = msgLower.match(/(?:forward|skip|ahead)\s+(\d+)\s*(?:sec|second)/i);
    const secs = secMatch ? parseInt(secMatch[1], 10) : 10;
    return {
      text: `Skipping forward ${secs} seconds.`,
      action: { type: "seek_relative", seconds: secs }
    };
  }

  if (
    msgLower.includes("rewind") ||
    msgLower.includes("backward") ||
    msgLower.includes("back 10") ||
    msgLower.includes("go back") ||
    msgLower.includes("previous 10")
  ) {
    const secMatch = msgLower.match(/(?:rewind|back|backward)\s+(\d+)\s*(?:sec|second)/i);
    const secs = secMatch ? parseInt(secMatch[1], 10) : 10;
    return {
      text: `Rewinding ${secs} seconds.`,
      action: { type: "seek_relative", seconds: -secs }
    };
  }

  // 4. Next Song / Skip Track Request
  if (msgLower.includes("next") || msgLower.includes("skip song") || msgLower.includes("skip track") || msgLower.includes("skip this") || msgLower.includes("next track")) {
    const trending = await getTrendingSongs(8);
    const pool = trending.filter(t => !currentPlayingTrack || t.youtubeId !== currentPlayingTrack.youtubeId);
    const nextTrack = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : trending[0];
    if (nextTrack) {
      currentPlayingTrack = nextTrack;
      const shortTitle = nextTrack.title.split("|")[0].split("(")[0].replace(/official video/gi, "").trim();
      const text = `Playing ${shortTitle} by ${nextTrack.artist}.`;
      return {
        text,
        action: {
          type: "play_youtube",
          track: nextTrack
        }
      };
    }
  }

  // 5. Pause / Stop / Resume Requests
  if (msgLower.includes("pause") || msgLower.includes("stop") || msgLower === "freeze") {
    return {
      text: "Music paused.",
      action: { type: "pause_music" }
    };
  }

  if (msgLower.includes("resume") || msgLower.includes("unpause") || msgLower.includes("continue") || msgLower === "play") {
    return {
      text: "Resuming playback.",
      action: { type: "resume_music" }
    };
  }

  // 6. Replay / Restart Request
  if (msgLower.includes("replay") || msgLower.includes("restart") || msgLower.includes("loop") || msgLower.includes("start over")) {
    return {
      text: "Replaying current song.",
      action: { type: "replay_music" }
    };
  }

  // 7. General Banter / Questions (concise 1-2 sentences)
  if (msgLower === "hello" || msgLower === "hi" || msgLower === "hey" || msgLower.startsWith("hello") || msgLower.startsWith("hi veda")) {
    return {
      text: "Hey! Tell me any song or artist, and I'll play it right away."
    };
  }

  if (msgLower.includes("who are you") || msgLower.includes("what can you do") || msgLower.includes("help")) {
    return {
      text: "I'm Veda. Ask me to play any song in the world, pause, skip, or speak to me anytime."
    };
  }

  if (msgLower.includes("what is playing") || msgLower.includes("what song") || msgLower.includes("current song")) {
    if (currentPlayingTrack) {
      return {
        text: `Now playing ${currentPlayingTrack.title} by ${currentPlayingTrack.artist}.`
      };
    } else {
      return {
        text: "No song is playing right now. What would you like to hear?"
      };
    }
  }

  // 8. Fallback: Search clean command directly as a song name
  const searchQuery = cleanCmd
    .replace(/\b(?:song|songs|track|tracks|music|official video|video|audio|lyrics|please)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (searchQuery && searchQuery.length > 1) {
    const fallbackTrack = await searchSong(searchQuery);
    if (fallbackTrack) {
      currentPlayingTrack = fallbackTrack;
      const shortTitle = fallbackTrack.title.split("|")[0].split("(")[0].replace(/official video/gi, "").trim();
      return {
        text: `Playing ${shortTitle} by ${fallbackTrack.artist}.`,
        action: {
          type: "play_youtube",
          track: fallbackTrack
        }
      };
    }
  }

  return {
    text: "I'm listening. Ask me for any song or artist you want to hear."
  };
}

// Alias for backward compatibility
const generateMelResponse = generateVedaResponse;

// API: Radio Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message, isInterrupted } = req.body;
    
    const result = await generateVedaResponse({
      message,
      isInterrupted
    });

    res.json({
      text: result.text,
      action: result.action,
      currentTrack: currentPlayingTrack
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API: Neural TTS Voice
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "en-US-AvaNeural", rate = "-2%", pitch = "-2Hz" } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const cleanText = text.replace(/\[.*?\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    if (!cleanText) return res.status(400).json({ error: "Empty speech" });

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(cleanText, { rate, pitch });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");

    req.on("close", () => {
      try { audioStream.destroy(); } catch (_) {}
    });

    audioStream.pipe(res);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: "TTS failed", details: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`
=====================================================
  📻 VEDA MUSIC AI • PURE WHITE & YOUTUBE PLAYER
  Broadcast Server Running at http://localhost:${PORT}
=====================================================
`);
});
