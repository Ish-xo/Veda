import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

async function test() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata("en-US-AvaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const readable = tts.toStream("Welcome to Veda Music AI. I am your host, Veda.");
  console.log("TTS initialized successfully:", readable !== undefined);
}

test().catch(console.error);
