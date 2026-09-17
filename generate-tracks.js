import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const audioDir = path.join(__dirname, "public", "audio");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Helper to write standard 44.1kHz 16-bit stereo WAV
function writeWavFile(filename, durationSec, generateSample) {
  const sampleRate = 44100;
  const numChannels = 2;
  const bytesPerSample = 2;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bits per sample

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = generateSample(t, i, sampleRate, durationSec);

    // Clamp to -1.0 .. 1.0
    const clampL = Math.max(-1, Math.min(1, left));
    const clampR = Math.max(-1, Math.min(1, right));

    const intL = clampL < 0 ? clampL * 0x8000 : clampL * 0x7FFF;
    const intR = clampR < 0 ? clampR * 0x8000 : clampR * 0x7FFF;

    buffer.writeInt16LE(Math.floor(intL), offset);
    buffer.writeInt16LE(Math.floor(intR), offset + 2);
    offset += 4;
  }

  const outPath = path.join(audioDir, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${filename} (${durationSec}s, ${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

// 1. Dream Pop: "Midnight Reverie" (30s seamless loop)
writeWavFile("dream-pop.wav", 30, (t, i, sr, dur) => {
  const bpm = 84;
  const beat = (t * bpm) / 60;
  const bar = beat / 4;

  // Chord progression: Cmaj7 (0..1), Am9 (1..2), Fmaj7 (2..3), G6 (3..4)
  const chords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 392.00]  // G6
  ];
  const chordIdx = Math.floor(bar % 4);
  const currentChord = chords[chordIdx];

  // Shimmer Pad
  let padL = 0;
  let padR = 0;
  currentChord.forEach((freq, idx) => {
    const detune1 = 1.002;
    const detune2 = 0.998;
    const osc1 = Math.sin(2 * Math.PI * freq * t + Math.sin(t * 1.5 + idx) * 0.3);
    const osc2 = Math.sin(2 * Math.PI * freq * detune1 * t);
    const osc3 = Math.sin(2 * Math.PI * freq * detune2 * t);
    const amp = 0.07;
    padL += (osc1 * 0.6 + osc2 * 0.4) * amp;
    padR += (osc1 * 0.6 + osc3 * 0.4) * amp;
  });

  // Ethereal Guitar Arpeggio
  const arpNoteIdx = Math.floor((beat * 2) % currentChord.length);
  const arpFreq = currentChord[arpNoteIdx] * 2; // octave up
  const arpEnv = Math.exp(-((beat * 2) % 1) * 3);
  const guitar = Math.sin(2 * Math.PI * arpFreq * t) * arpEnv * 0.08;

  // Soft dream kick on 1 and 3, snare on 2 and 4
  const beatFract = beat % 1;
  const isKick = (Math.floor(beat) % 2 === 0);
  const kickEnv = isKick ? Math.max(0, 1 - beatFract * 6) : 0;
  const kick = Math.sin(2 * Math.PI * (70 - beatFract * 40) * t) * kickEnv * 0.25;

  // Reverb tail / delay effect simulation
  const delayT = (t - 0.35 + dur) % dur;
  const delaySignal = Math.sin(2 * Math.PI * 440 * delayT) * 0.02 * Math.sin(t * 0.5);

  const left = padL + guitar * 0.7 + kick + delaySignal;
  const right = padR + guitar * 0.3 + kick + delaySignal * 0.8;

  return [left * 0.85, right * 0.85];
});

// 2. Lo-Fi Chillhop: "Neon Rain at 2 AM" (30s seamless loop)
writeWavFile("lofi-midnight.wav", 30, (t, i, sr, dur) => {
  const bpm = 74;
  const beat = (t * bpm) / 60;
  const bar = beat / 4;

  // Dusty vinyl crackle
  const vinyl = (Math.random() - 0.5) * (Math.random() > 0.985 ? 0.12 : 0.015);

  // Rhodes Piano Chord progression: Dm9 (0), G13 (1), Cmaj9 (2), A7#9 (3)
  const chords = [
    [146.83, 220.00, 261.63, 329.63, 392.00], // Dm9
    [196.00, 246.94, 293.66, 370.00, 440.00], // G13
    [130.81, 196.00, 246.94, 293.66, 392.00], // Cmaj9
    [220.00, 277.18, 329.63, 392.00, 466.16]  // A7#9
  ];
  const chord = chords[Math.floor(bar % 4)];
  const barFract = bar % 1;
  const chordEnv = Math.max(0, 1 - barFract * 0.6);

  // Subtle tape wow & flutter
  const wow = 1 + Math.sin(2 * Math.PI * 0.3 * t) * 0.004;

  let rhodesL = 0;
  let rhodesR = 0;
  chord.forEach((freq, idx) => {
    const f = freq * wow;
    const osc = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t);
    const amp = 0.05 * chordEnv;
    rhodesL += osc * amp * (idx % 2 === 0 ? 0.7 : 0.4);
    rhodesR += osc * amp * (idx % 2 === 1 ? 0.7 : 0.4);
  });

  // Mellow Boom-Bap Drums
  const beatPos = beat % 2;
  const isKick = beatPos < 0.25 || (beatPos > 1.35 && beatPos < 1.6);
  const isSnare = beatPos > 0.95 && beatPos < 1.25;
  const kickEnv = isKick ? Math.max(0, 1 - (beatPos % 0.5) * 8) : 0;
  const snareEnv = isSnare ? Math.max(0, 1 - ((beatPos - 1) % 1) * 7) : 0;

  const kick = Math.sin(2 * Math.PI * 55 * t) * kickEnv * 0.3;
  const snare = ((Math.random() - 0.5) * 0.15 + Math.sin(2 * Math.PI * 180 * t) * 0.1) * snareEnv;

  // Warm Sub Bass
  const bassFreq = chord[0] * 0.5;
  const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.18;

  const left = rhodesL + kick + snare + bass + vinyl;
  const right = rhodesR + kick + snare * 0.9 + bass + vinyl;

  return [left * 0.8, right * 0.8];
});

// 3. Late Night Noir Jazz: "Velvet & Smoke" (30s seamless loop)
writeWavFile("noir-jazz.wav", 30, (t, i, sr, dur) => {
  const bpm = 65;
  const beat = (t * bpm) / 60;
  const bar = beat / 4;

  // Smoky Minor Jazz Chords
  const chords = [
    [174.61, 207.65, 261.63, 311.13], // Fm7
    [233.08, 277.18, 349.23, 415.30], // Bbm7
    [155.56, 196.00, 233.08, 277.18], // Eb7
    [207.65, 261.63, 311.13, 392.00]  // Abmaj7
  ];
  const chord = chords[Math.floor(bar % 4)];

  // Walking upright bass
  const bassNotes = [chord[0] * 0.5, chord[1] * 0.5, chord[2] * 0.5, chord[0] * 0.75];
  const bassNote = bassNotes[Math.floor(beat % 4)];
  const bassEnv = Math.max(0, 1 - (beat % 1) * 2.5);
  const bass = (Math.sin(2 * Math.PI * bassNote * t) + 0.25 * Math.sin(2 * Math.PI * bassNote * 2 * t)) * bassEnv * 0.25;

  // Smoky Tenor Saxophone Lead (Mellow vibrato melody)
  const saxMelody = [349.23, 392.00, 415.30, 466.16, 523.25, 466.16, 415.30, 392.00];
  const melIdx = Math.floor((beat * 0.5) % saxMelody.length);
  const vib = Math.sin(2 * Math.PI * 5 * t) * 4;
  const saxFreq = saxMelody[melIdx] + vib;
  const saxEnv = 0.5 + 0.5 * Math.sin(Math.PI * ((beat * 0.5) % 1));
  const sax = (
    Math.sin(2 * Math.PI * saxFreq * t) * 0.6 +
    Math.sin(2 * Math.PI * saxFreq * 2 * t) * 0.25 +
    Math.sin(2 * Math.PI * saxFreq * 3 * t) * 0.15
  ) * saxEnv * 0.09;

  // Brushed drums / jazz ride cymbal
  const rideEnv = Math.exp(-((beat * 2) % 1) * 5);
  const ride = (Math.random() - 0.5) * rideEnv * 0.04;

  const left = bass + sax * 0.7 + ride * 0.8;
  const right = bass + sax * 0.5 + ride * 0.5;

  return [left * 0.85, right * 0.85];
});

// 4. Synthwave Night Drive: "Nightcall Horizon" (30s seamless loop)
writeWavFile("synthwave-drive.wav", 30, (t, i, sr, dur) => {
  const bpm = 108;
  const beat = (t * bpm) / 60;
  const bar = beat / 4;

  // Bass roots: A (220/2), F (174/2), C (130/2), G (196/2)
  const roots = [110, 87.31, 65.41, 98.00];
  const root = roots[Math.floor(bar % 4)];

  // 16th note synthwave rolling bass
  const sixteenth = Math.floor(beat * 4) % 16;
  const bassFreq = sixteenth % 2 === 0 ? root : root * 2;
  const bassEnv = Math.max(0, 1 - ((beat * 4) % 1) * 3);
  const bass = (
    Math.sin(2 * Math.PI * bassFreq * t) * 0.5 +
    (Math.sin(2 * Math.PI * bassFreq * t) > 0 ? 0.3 : -0.3)
  ) * bassEnv * 0.22;

  // 80s Neon Arpeggio
  const arpScale = [root * 2, root * 2.5, root * 3, root * 4];
  const arpNote = arpScale[Math.floor(beat * 4) % 4];
  const arpEnv = Math.exp(-((beat * 4) % 1) * 4);
  const arp = Math.sin(2 * Math.PI * arpNote * t) * arpEnv * 0.08;

  // Big 80s Gated Snare on 2 & 4, Kick on 1, 2, 3, 4
  const beatFract = beat % 1;
  const kickEnv = Math.max(0, 1 - beatFract * 7);
  const kick = Math.sin(2 * Math.PI * (80 - beatFract * 50) * t) * kickEnv * 0.32;

  const isSnare = Math.floor(beat) % 2 === 1;
  const snareEnv = isSnare ? Math.max(0, 1 - beatFract * 4) : 0;
  const snare = ((Math.random() - 0.5) * 0.25 + Math.sin(2 * Math.PI * 220 * t) * 0.1) * snareEnv;

  const left = bass + arp * 0.8 + kick + snare;
  const right = bass + arp * 0.4 + kick + snare * 0.9;

  return [left * 0.8, right * 0.8];
});

// 5. Deep Ambient: "Starlit Frequency" (30s seamless loop)
writeWavFile("ambient-space.wav", 30, (t, i, sr, dur) => {
  // Ethereal celestial drone pads
  const freqs = [108, 162, 216, 324, 432, 648];
  let padL = 0;
  let padR = 0;

  freqs.forEach((f, idx) => {
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * (0.05 + idx * 0.02) * t);
    const wave = Math.sin(2 * Math.PI * f * t + Math.sin(t * 0.2) * 0.5);
    const amp = (0.12 / freqs.length) * lfo;
    padL += wave * amp * (idx % 2 === 0 ? 0.8 : 0.4);
    padR += wave * amp * (idx % 2 === 1 ? 0.8 : 0.4);
  });

  // Binaural sub hum
  const subL = Math.sin(2 * Math.PI * 45 * t) * 0.15;
  const subR = Math.sin(2 * Math.PI * 47 * t) * 0.15;

  // Stardust chime
  const chimeT = (t * 0.4) % 1;
  const chimeEnv = Math.exp(-chimeT * 8);
  const chime = Math.sin(2 * Math.PI * 1760 * t) * chimeEnv * 0.02;

  return [padL + subL + chime, padR + subR + chime];
});

// 6. Radio Station Ident Jingle & Tuning Drop (4s)
writeWavFile("station-ident.wav", 4, (t) => {
  // 3-note radio chime (C5 -> E5 -> G5) + warm sweep
  const notes = [523.25, 659.25, 783.99, 1046.50];
  const step = Math.min(3, Math.floor(t * 1.5));
  const noteFreq = notes[step];
  const stepT = (t * 1.5) % 1;
  const env = Math.exp(-stepT * 2.5);

  const chime = (Math.sin(2 * Math.PI * noteFreq * t) + 0.3 * Math.sin(2 * Math.PI * noteFreq * 2 * t)) * env * 0.25;

  // Subtle FM static sweep fade
  const sweep = (Math.random() - 0.5) * Math.max(0, 0.06 * (1 - t * 0.6));

  return [chime + sweep, chime * 0.9 + sweep];
});

console.log("All radio audio tracks and broadcast FX generated successfully!");
