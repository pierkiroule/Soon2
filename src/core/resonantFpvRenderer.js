import { drawPoissonPlume } from "./poissonPlumeRenderer.js";

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function depthColor(depth = 1) {
  if (depth >= 3) return [172, 112, 245];
  if (depth >= 2) return [82, 224, 206];
  return [96, 186, 248];
}

export function drawResonantFPV(ctx, rect, current, time) {
  const width = rect?.width || ctx?.canvas?.width || 1;
  const height = rect?.height || ctx?.canvas?.height || 1;
  const centerX = width * 0.5;
  const centerY = height * 0.53;

  const fish = current?.fish || {};

  const t = time * 0.001;
  const speed = Math.hypot(fish.vx || 0, fish.vy || 0);
  const speedNorm = clamp(speed / 18, 0, 1.2);
  const mouthPull = clamp(fish.mouthPull || 0, 0, 1);
  const fishDepth = clamp(fish.depth || 1, 1, 3);

  const flow = clamp(0.2 + speedNorm * 0.4 + mouthPull * 0.25, 0, 1.2);
  const [r, g, b] = depthColor(fishDepth);

  // Fond doux sans motifs haute-fréquence (anti-moirage).
  const bg = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(width, height) * 0.94);
  bg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.14 + flow * 0.04})`);
  bg.addColorStop(0.45, "rgba(12, 14, 36, 0.96)");
  bg.addColorStop(1, "rgba(4, 6, 18, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Brumes boréales larges, sans tramage particulaire.
  for (let i = 0; i < 5; i += 1) {
    const p = i / 4;
    const y = centerY + (p - 0.5) * height * 0.44 + Math.sin(t * 0.28 + i * 0.9) * (12 + flow * 5);
    const band = 72 + i * 10;
    const haze = ctx.createLinearGradient(0, y - band, width, y + band);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.3, `hsla(${190 + i * 8}, 86%, 74%, ${0.03 + flow * 0.03})`);
    haze.addColorStop(0.7, `hsla(${258 + i * 7}, 86%, 75%, ${0.03 + flow * 0.03})`);
    haze.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, y - band, width, band * 2);
  }

  // Échos de contour du poisson (vaporeux), sans particules.
  const bodyEchoCount = 5;
  for (let i = 0; i < bodyEchoCount; i += 1) {
    const k = i / Math.max(1, bodyEchoCount - 1);
    ctx.save();
    ctx.translate(centerX, centerY + Math.sin(t * 1.0) * 2.5);
    ctx.rotate(fish.angle || 0);
    ctx.scale(1 + k * 0.2, 1 + k * 0.2);
    ctx.globalAlpha = 0.09 * (1 - k) + 0.025;
    ctx.shadowBlur = 14 + i * 7;
    ctx.shadowColor = `hsla(${194 + i * 14}, 90%, 76%, 0.42)`;
    drawPoissonPlume(ctx, { ...fish, x: 0, y: 0, angle: 0 }, {
      time: time - i * 20,
      audio: { bass: 0, mids: 0, highs: 0, energy: 0 },
      proximity: 0.8,
      audioInfluence: 0,
    });
    ctx.restore();
  }

  // Corps principal vaporeux (double passe) sans audio-réactivité.
  ctx.save();
  ctx.translate(centerX, centerY + Math.sin(t * 1.0) * 2.5);
  ctx.rotate(fish.angle || 0);

  ctx.globalAlpha = 0.36;
  ctx.shadowBlur = 24 + flow * 8;
  ctx.shadowColor = "rgba(170, 230, 255, 0.62)";
  drawPoissonPlume(ctx, { ...fish, x: 0, y: 0, angle: 0 }, {
    time,
    audio: { bass: 0, mids: 0, highs: 0, energy: 0 },
    proximity: 0.9,
    audioInfluence: 0,
  });

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  drawPoissonPlume(ctx, { ...fish, x: 0, y: 0, angle: 0 }, {
    time,
    audio: { bass: 0, mids: 0, highs: 0, energy: 0 },
    proximity: 0.9,
    audioInfluence: 0,
  });
  ctx.restore();

  // Halo doux global.
  const aura = ctx.createRadialGradient(
    centerX,
    centerY,
    12,
    centerX,
    centerY,
    Math.min(width, height) * 0.42
  );
  aura.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.05 + flow * 0.03})`);
  aura.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  // Vignette finale anti-bruit visuel.
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.24,
    centerX,
    centerY,
    Math.max(width, height) * 0.84
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.66, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(6, 8, 22, 0.64)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
