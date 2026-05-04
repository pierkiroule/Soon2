import { drawPoissonPlume } from "./poissonPlumeRenderer.js";

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function depthColor(depth = 1) {
  if (depth >= 3) return [172, 112, 245];
  if (depth >= 2) return [82, 224, 206];
  return [96, 186, 248];
}

function projectFromFish(point, fish, centerX, centerY, scale) {
  const dx = (point.x || 0) - (fish.x || 0);
  const dy = (point.y || 0) - (fish.y || 0);
  const dist = Math.hypot(dx, dy);
  const rel = normalizeAngle(Math.atan2(dy, dx) - (fish.angle || 0));
  const front = Math.cos(rel);
  const side = Math.sin(rel);
  if (front < -0.3) return null;

  const depth = clamp(1 / (1 + dist * 0.0058), 0.06, 1);
  const zLayer = ((point.depth || fish.depth || 1) - (fish.depth || 1)) * 30;
  return {
    dist,
    depth,
    x: centerX + side * scale * depth,
    y: centerY - front * 120 * depth + zLayer,
    front,
  };
}

export function drawResonantFPV(ctx, rect, current, time) {
  const width = rect?.width || ctx?.canvas?.width || 1;
  const height = rect?.height || ctx?.canvas?.height || 1;
  const centerX = width * 0.5;
  const centerY = height * 0.53;

  const fish = current?.fish || {};
  const bubbles = Array.isArray(current?.bubbles) ? current.bubbles : [];
  const traceCircuit = Array.isArray(current?.traceCircuit) ? current.traceCircuit : [];

  const t = time * 0.001;
  const speed = Math.hypot(fish.vx || 0, fish.vy || 0);
  const speedNorm = clamp(speed / 18, 0, 1.2);
  const mouthPull = clamp(fish.mouthPull || 0, 0, 1);
  const fishDepth = clamp(fish.depth || 1, 1, 3);

  const bass = Math.sin(t * (1.8 + speedNorm * 0.7)) * 0.5 + 0.5;
  const mids = Math.sin(t * (3.4 + mouthPull * 2.2) + 1.4) * 0.5 + 0.5;
  const highs = Math.sin(t * (7.8 + speedNorm * 1.8) + 2.2) * 0.5 + 0.5;
  const resonance = clamp(0.2 + speedNorm * 0.36 + mouthPull * 0.28 + bass * 0.14, 0, 1.25);

  const [r, g, b] = depthColor(fishDepth);

  // Environnement masqué : champ synesthésique abstrait.
  const bg = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(width, height) * 0.92);
  bg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.15 + resonance * 0.05})`);
  bg.addColorStop(0.4, "rgba(12, 14, 36, 0.95)");
  bg.addColorStop(1, "rgba(4, 6, 18, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Brumes 3D en nappes autour du poisson suivi caméra.
  for (let i = 0; i < 6; i += 1) {
    const p = i / 5;
    const y = centerY + (p - 0.5) * height * 0.46 + Math.sin(t * 0.38 + i) * (16 + resonance * 8);
    const haze = ctx.createLinearGradient(0, y - 60, width, y + 60);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.3, `hsla(${188 + i * 8}, 90%, 72%, ${0.02 + mids * 0.06})`);
    haze.addColorStop(0.7, `hsla(${262 + i * 7}, 90%, 74%, ${0.02 + bass * 0.06})`);
    haze.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, y - 68, width, 136);
  }

  // Trajectoire conservée : vision de suivi du poisson.
  if (traceCircuit.length > 1) {
    const scale = Math.min(width, height) * 0.72;
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < traceCircuit.length; i += 1) {
      const p = traceCircuit[i];
      const d = Math.hypot((p.x || 0) - (fish.x || 0), (p.y || 0) - (fish.y || 0));
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }

    const points = [];
    for (let i = 0; i < Math.min(34, traceCircuit.length); i += 1) {
      const p = traceCircuit[(nearest + i) % traceCircuit.length];
      const pp = projectFromFish(p, fish, centerX, centerY, scale);
      if (pp) points.push(pp);
    }

    if (points.length > 2) {
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = `rgba(205, 240, 255, ${0.12 + resonance * 0.12})`;
      ctx.lineWidth = 1.2 + speedNorm;
      ctx.stroke();
    }
  }

  // Couronne particulaire 3D autour du poisson.
  const particleCount = Math.floor(120 + resonance * 60);
  for (let i = 0; i < particleCount; i += 1) {
    const lane = i / particleCount;
    const spin = lane * TAU * 10 + t * (0.22 + highs * 0.42);
    const orbit = 30 + ((i * 29) % 100) * (2 + resonance * 0.9);
    const wave = Math.sin(t * 0.9 + i * 0.06) * (12 + mids * 6);
    const x = centerX + Math.cos(spin) * orbit;
    const y = centerY + Math.sin(spin * 0.8) * orbit * 0.45 + wave;
    const pz = (Math.sin(spin + t * 0.7) + 1) * 0.5;
    const size = 0.35 + pz * (1.7 + highs * 0.6);

    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = `rgba(220, 242, 255, ${0.04 + pz * 0.2})`;
    ctx.fill();
  }

  // Bulles: deviennent flashes de résonance spatiale.
  const sparks = Math.min(36, bubbles.length);
  for (let i = 0; i < sparks; i += 1) {
    const bubble = bubbles[i];
    const angle = (((bubble.x || 0) * 0.03 + (bubble.y || 0) * 0.02 + i) % TAU) + t * 0.18;
    const radius = 80 + (i / Math.max(1, sparks - 1)) * Math.min(width, height) * 0.38;
    const sx = centerX + Math.cos(angle) * radius;
    const sy = centerY + Math.sin(angle * 1.2) * radius * 0.5;
    const sr = 1 + (i % 3) * 0.9;

    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
    halo.addColorStop(0, `rgba(255,255,255,${0.24 + mids * 0.2})`);
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 5, 0, TAU);
    ctx.fill();
  }

  // Poisson plume EXACT du mode 2D (renderer existant) mais suivi caméra centré.
  ctx.save();
  ctx.translate(centerX, centerY + Math.sin(t * 1.2) * 3);
  ctx.rotate(fish.angle || 0);
  drawPoissonPlume(ctx, { ...fish, x: 0, y: 0, angle: 0 }, {
    time,
    audio: { bass, mids, highs, energy: resonance },
    proximity: 0.92,
    audioInfluence: 0.42,
  });
  ctx.restore();

  // Flou périphérique relaxant.
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.22,
    centerX,
    centerY,
    Math.max(width, height) * 0.82
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.62, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(6, 8, 22, 0.62)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
