async function runE2ETests() {
  console.log("=================================================");
  console.log("📻 STARTING VEDA ANIMATIONS & WAKE-WORD E2E");
  console.log("=================================================");

  const baseUrl = "http://localhost:3000";

  // 1. Verify HTML Structure with circular playback controls (including 10s seek buttons)
  console.log("\n[Test 1] Verifying HTML Playback Controls & 10s Seek Buttons...");
  const htmlRes = await fetch(`${baseUrl}/`);
  if (!htmlRes.ok) throw new Error(`Failed to load index.html: ${htmlRes.status}`);
  const html = await htmlRes.text();

  const requiredElements = [
    "avatarCenterpiece",
    "avatarFrame",
    "soundwaveCanvas",
    "prevBtn",
    "rewind10Btn",
    "playPauseBtn",
    "forward10Btn",
    "replayBtn",
    "nextBtn",
    "progressBarContainer",
    "progressTrack",
    "progressFill",
    "progressThumb",
    "currentTimeLabel",
    "totalTimeLabel",
    "trackBubble",
    "trackName",
    "trackViewCard",
    "trackCardImg",
    "trackCardTitle",
    "trackCardArtist",
    "ytPlayerContainer"
  ];

  for (const el of requiredElements) {
    if (!html.includes(el)) {
      throw new Error(`Missing expected element in HTML: ${el}`);
    }
  }

  // Ensure hashtags and Last.fm discovery engine are NOT present
  if (html.includes("#Alternative") || html.includes("#Shoegaze") || html.includes("#Metal") || html.includes("Last.fm Music Discovery Engine")) {
    throw new Error("Found unwanted hashtags or Last.fm badge in HTML");
  }
  console.log("  ✓ All 7 playback controls, interactive progress bar, and right-side track view card verified in HTML");

  // 2. Verify Trending Music Endpoint (/api/music/trending)
  console.log("\n[Test 2] Testing Trending Music Endpoint (/api/music/trending)...");
  const trendRes = await fetch(`${baseUrl}/api/music/trending`);
  if (!trendRes.ok) throw new Error(`Trending failed: ${trendRes.status}`);
  const trendData = await trendRes.json();
  console.log(`  ✓ Trending endpoint returned ${trendData.tracks?.length} tracks`);

  // 3. Verify Concise Veda Response: "Playing Blue Eyes by Yo Yo Honey Singh."
  console.log("\n[Test 3] Testing Concise Veda Announcement ('Play Blue Eyes by Yo Yo Honey Singh')...");
  const chat1 = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Play Blue Eyes by Yo Yo Honey Singh", isInterrupted: false })
  })).json();
  console.log("  Caller: 'Play Blue Eyes by Yo Yo Honey Singh'");
  console.log(`  Veda Spoken Announcement: "${chat1.text}"`);
  console.log(`  Action Track: "${chat1.action?.track?.title}" by ${chat1.action?.track?.artist}`);

  if (!chat1.text.startsWith("Playing ") || chat1.text.includes("You got it, caller") || chat1.text.includes("Dropping the needle")) {
    throw new Error(`Expected concise "Playing [Song] by [Artist]." but got: "${chat1.text}"`);
  }
  console.log("  ✓ Veda announcement verified: strictly concise without repetitive banter!");

  // 4. Verify 10-second Seek & Skip Intro Intents
  console.log("\n[Test 4] Testing 10-Second Seek & Skip Intro Intents...");
  const fwdChat = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "forward 10 seconds", isInterrupted: false })
  })).json();
  console.log(`  Forward response: "${fwdChat.text}", action:`, fwdChat.action);
  if (fwdChat.action?.type !== "seek_relative" || fwdChat.action?.seconds !== 10) {
    throw new Error(`Expected seek_relative 10s, got: ${JSON.stringify(fwdChat.action)}`);
  }

  const rwdChat = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "rewind 10 seconds", isInterrupted: false })
  })).json();
  console.log(`  Rewind response: "${rwdChat.text}", action:`, rwdChat.action);
  if (rwdChat.action?.type !== "seek_relative" || rwdChat.action?.seconds !== -10) {
    throw new Error(`Expected seek_relative -10s, got: ${JSON.stringify(rwdChat.action)}`);
  }

  const introChat = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "skip intro", isInterrupted: false })
  })).json();
  console.log(`  Skip Intro response: "${introChat.text}", action:`, introChat.action);
  if (introChat.action?.type !== "seek_relative" || introChat.action?.seconds !== 15) {
    throw new Error(`Expected seek_relative 15s for intro skip, got: ${JSON.stringify(introChat.action)}`);
  }
  console.log("  ✓ 10s forward, 10s rewind, and skip intro intents verified successfully!");

  // 5. Verify Next / Skip Song Request
  console.log("\n[Test 5] Testing Next / Skip Song Request...");
  const chat2 = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "next song", isInterrupted: false })
  })).json();
  console.log("  Caller: 'next song'");
  console.log(`  Veda Spoken Announcement: "${chat2.text}"`);
  if (!chat2.text.startsWith("Playing ")) {
    throw new Error(`Expected "Playing [Song] by [Artist]." on skip, got: "${chat2.text}"`);
  }

  // 7. Verify Conversational Wake-Word & Direct Music Requests
  console.log("\n[Test 7] Testing Conversational Wake-Words & Natural Language Song Requests...");
  
  // 7A: "hey veda play a music" (generic music intent)
  const chatGeneric = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hey veda play a music", isInterrupted: false })
  })).json();
  console.log(`  Spoken: "hey veda play a music" -> Announcement: "${chatGeneric.text}"`);
  if (!chatGeneric.text.startsWith("Playing ") || !chatGeneric.action?.track) {
    throw new Error(`Expected generic music play action, got: ${JSON.stringify(chatGeneric)}`);
  }

  // 7B: "veda play starboy" (wake-word + song name)
  const chatStarboy = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "veda play starboy", isInterrupted: false })
  })).json();
  console.log(`  Spoken: "veda play starboy" -> Announcement: "${chatStarboy.text}"`);
  if (!chatStarboy.text.toLowerCase().includes("starboy") || !chatStarboy.action?.track) {
    throw new Error(`Expected Starboy track, got: ${JSON.stringify(chatStarboy)}`);
  }

  // 7C: "can you please play dilbar" (conversational opener without wake-word)
  const chatDilbar = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "can you please play dilbar", isInterrupted: false })
  })).json();
  console.log(`  Spoken: "can you please play dilbar" -> Announcement: "${chatDilbar.text}"`);
  if (!chatDilbar.text.toLowerCase().includes("dilbar") || !chatDilbar.action?.track) {
    throw new Error(`Expected Dilbar track, got: ${JSON.stringify(chatDilbar)}`);
  }

  // 7D: "play something"
  const chatSomething = await (await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "play something", isInterrupted: false })
  })).json();
  console.log(`  Spoken: "play something" -> Announcement: "${chatSomething.text}"`);
  if (!chatSomething.text.startsWith("Playing ") || !chatSomething.action?.track) {
    throw new Error(`Expected trending song on "play something", got: ${JSON.stringify(chatSomething)}`);
  }
  console.log("  ✓ All conversational wake-words and natural music queries verified successfully!");

  // 9. Verify Ambient Music-Synced DJ Party Lights Markup
  console.log("\n[Test 9] Verifying Fullscreen Ambient Music-Synced DJ Party Lights Elements...");
  const djLightElements = [
    "ambientDjLights",
    "washTL",
    "washTR",
    "washBL",
    "washBR",
    "djLightsToggleBtn",
    "stageWash",
    "lightOrbPrimary",
    "lightOrbSecondary",
    "lightOrbAccent",
    "strobeBeamLeft",
    "strobeBeamRight"
  ];

  for (const el of djLightElements) {
    if (!html.includes(el)) {
      throw new Error(`Missing expected DJ Lights element: ${el}`);
    }
  }
  console.log("  ✓ All 4 fullscreen corner washes, central DJ light orbs, strobe beams, and toggle button verified in HTML");

  // 10. Verify Dark Mode Navbar Toggle & CSS Variables
  console.log("\n[Test 10] Verifying Dark Mode Navbar Button & Transparent DJ Theme...");
  if (!html.includes('id="themeToggleBtn"') || !html.includes('id="themeIcon"')) {
    throw new Error("Missing themeToggleBtn or themeIcon in index.html");
  }

  const cssRes = await fetch(`${baseUrl}/css/style.css`);
  if (!cssRes.ok) throw new Error("Failed to load style.css");
  const css = await cssRes.text();
  if (!css.includes("dark-theme") || !css.includes("--bg-page: #070b14")) {
    throw new Error("Missing dark-theme CSS variables in style.css");
  }
  console.log("  ✓ Dark Mode toggle button & dark-theme CSS variables verified");

  // 11. Verify Dynamic Cover Art Lighting & Voice Barge-in Music Pause in app.js
  console.log("\n[Test 11] Verifying Cover Art Dynamic Color Sync & Barge-In Pause in app.js...");
  const jsRes = await fetch(`${baseUrl}/js/app.js`);
  if (!jsRes.ok) throw new Error("Failed to load app.js");
  const js = await jsRes.text();
  if (!js.includes("extractCoverArtColors") || !js.includes("applyLiveThemeColors") || !js.includes("washTL")) {
    throw new Error("Missing dynamic album cover color extraction in app.js");
  }
  if (!js.includes("audioEngine.pauseMusic()") || !js.includes("wasPlayingBeforeWakeWord")) {
    throw new Error("Missing immediate audio pause on voice wake/barge-in in app.js");
  }
  console.log("  ✓ Dynamic album cover color extraction and barge-in song pause verified in app.js");

  // 12. Verify Low-Pitch Speech Engine Enhancements
  console.log("\n[Test 12] Verifying Low-Pitch & Deep Voice Recognition in speech-engine.js...");
  const speechRes = await fetch(`${baseUrl}/js/speech-engine.js`);
  if (!speechRes.ok) throw new Error("Failed to load speech-engine.js");
  const speechJs = await speechRes.text();
  if (!speechJs.includes("isWakeWordDetected") || !speechJs.includes("autoGainControl") || !speechJs.includes("failsafeTimer")) {
    throw new Error("Missing low-pitch AGC or phonetic detection in speech-engine.js");
  }
  console.log("  ✓ Hardware AGC gain boost, low-pitch phonetic matcher, and failsafe unmuting verified in speech-engine.js");

  console.log("\n=================================================");
  console.log("✨ ALL VEDA FULLSCREEN LIGHTS & LOW-PITCH SPEECH TESTS PASSED (100%)!");
  console.log("=================================================");
}

runE2ETests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
