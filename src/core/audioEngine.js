import { sampleLibrary } from "../data/defaultPack.js";

let audioCtx = null;
let masterGain = null;

const activeSounds = new Map();
const fileBuffers = new Map();

const WORLD_SCALE = 1 / 320;

function depthToZ(depth = 1) {
  if (depth === 1) return 0.9;
  if (depth === 2) return 0;
  return -0.9;
}

function getAudioContext() {
  if (audioCtx) return audioCtx;

  audioCtx = new AudioContext();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.1;
  masterGain.connect(audioCtx.destination);

  return audioCtx;
}

async function loadAudioBuffer(url) {
  const ctx = getAudioContext();

  if (fileBuffers.has(url)) {
    return fileBuffers.get(url);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Audio introuvable: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);

  fileBuffers.set(url, buffer);
  return buffer;
}

function setPannerPosition(panner, item) {
  const x = (item.x || 0) * WORLD_SCALE;
  const y = (item.y || 0) * WORLD_SCALE;
  const z = depthToZ(item.depth || 1);

  const now = audioCtx.currentTime;

  panner.positionX?.setTargetAtTime(x, now, 0.08);
  panner.positionY?.setTargetAtTime(y, now, 0.08);
  panner.positionZ?.setTargetAtTime(z, now, 0.08);
}

function createPannerFor(item) {
  const ctx = getAudioContext();
  const panner = ctx.createPanner();

  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1.2;
  panner.maxDistance = 12;
  panner.rolloffFactor = 1.6;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 0.4;

  setPannerPosition(panner, item);

  return panner;
}

function stopActiveSound(bubbleId) {
  const current = activeSounds.get(bubbleId);
  if (!current) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  try {
    current.gain.gain.cancelScheduledValues(now);
    current.gain.gain.setTargetAtTime(0.001, now, 0.18);
    current.stop?.(now + 0.35);
  } catch {
    // ignore
  }

  activeSounds.delete(bubbleId);
}

function playToneBubble(ctx, bubble, sample) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = createPannerFor(bubble);

  const depth = bubble.depth || 1;

  osc.type = sample.type || "sine";
  osc.frequency.value = sample.frequency || 220;

  filter.type = "lowpass";
  filter.frequency.value = 900 + depth * 480;

  gain.gain.value = 0.001;

  osc.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(masterGain);

  osc.start();

  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.18);

  activeSounds.set(bubble.id, {
    gain,
    panner,
    stop: (when) => osc.stop(when),
  });
}

async function playFileBubble(ctx, bubble, sample) {
  const buffer = await loadAudioBuffer(sample.url);

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const panner = createPannerFor(bubble);

  source.buffer = buffer;
  source.loop = true;

  gain.gain.value = 0.001;

  source.connect(panner);
  panner.connect(gain);
  gain.connect(masterGain);

  source.start();

  gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.28);

  activeSounds.set(bubble.id, {
    gain,
    panner,
    stop: (when) => source.stop(when),
  });
}

export function updateAudioListener(fish) {
  const ctx = getAudioContext();
  const listener = ctx.listener;
  const now = ctx.currentTime;

  const x = (fish?.x || 0) * WORLD_SCALE;
  const y = (fish?.y || 0) * WORLD_SCALE;
  const z = depthToZ(fish?.depth || 1);

  listener.positionX?.setTargetAtTime(x, now, 0.08);
  listener.positionY?.setTargetAtTime(y, now, 0.08);
  listener.positionZ?.setTargetAtTime(z, now, 0.08);

  const angle = fish?.angle || -Math.PI / 2;
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);

  listener.forwardX?.setTargetAtTime(fx, now, 0.08);
  listener.forwardY?.setTargetAtTime(fy, now, 0.08);
  listener.forwardZ?.setTargetAtTime(0, now, 0.08);

  listener.upX?.setTargetAtTime(0, now, 0.08);
  listener.upY?.setTargetAtTime(0, now, 0.08);
  listener.upZ?.setTargetAtTime(1, now, 0.08);
}

export function updateBubbleAudioPosition(bubble) {
  const current = activeSounds.get(bubble.id);
  if (!current?.panner) return;

  setPannerPosition(current.panner, bubble);
}

export async function playBubbleSound(bubble) {
  const ctx = getAudioContext();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  if (activeSounds.has(bubble.id)) {
    updateBubbleAudioPosition(bubble);
    return;
  }

  const sample =
    sampleLibrary.find((item) => item.id === bubble.sampleId) || sampleLibrary[0];

  if (sample.kind === "file" && sample.url) {
    try {
      await playFileBubble(ctx, bubble, sample);
      return;
    } catch (error) {
      console.warn("[Soon] lecture fichier audio impossible, fallback tone", error);
    }
  }

  playToneBubble(ctx, bubble, sample);
}

export function stopBubbleSound(bubbleId) {
  stopActiveSound(bubbleId);
}

export function updateAmbientMix({ near = false } = {}) {
  if (!audioCtx || !masterGain) return;

  masterGain.gain.setTargetAtTime(
    near ? 0.14 : 0.08,
    audioCtx.currentTime,
    0.25
  );
}

export function stopAllBubbleSounds() {
  Array.from(activeSounds.keys()).forEach(stopActiveSound);
}
