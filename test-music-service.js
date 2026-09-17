import { YouTube } from "youtube-sr";

async function searchMusic(query) {
  console.log(`[Search] Searching YouTube for: "${query}"...`);
  const video = await YouTube.searchOne(query);
  if (video) {
    return {
      id: video.id,
      title: video.title,
      channel: video.channel?.name || "Unknown Artist",
      duration: video.durationFormatted,
      thumbnail: video.thumbnail?.url,
      url: `https://www.youtube.com/watch?v=${video.id}`
    };
  }
  return null;
}

// Last.fm discovery helper
async function fetchLastFmTrivia(query) {
  try {
    const encoded = encodeURIComponent(query);
    // Fetch track/artist suggestions from Last.fm autocomplete/search
    const res = await fetch(`https://www.last.fm/search/tracks?q=${encoded}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (res.ok) {
      const html = await res.text();
      // Extract top artist/track tags if available
      const tagMatches = [...html.matchAll(/class="tag"[^>]*>([^<]+)<\/a>/g)].map(m => m[1]);
      return {
        tags: tagMatches.slice(0, 4)
      };
    }
  } catch (e) {
    console.warn("Last.fm lookup error:", e.message);
  }
  return { tags: [] };
}

async function run() {
  const ytResult = await searchMusic("Beach House Space Song");
  console.log("YouTube Result:", ytResult);

  const lfmResult = await fetchLastFmTrivia("Beach House");
  console.log("Last.fm Result:", lfmResult);
}

run().catch(console.error);
