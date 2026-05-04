const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function depthColor(depth = 1) {
  if (depth >= 3) return [200, 132, 255];
  if (depth >= 2) return [115, 240, 210];
  return [120, 200, 255];
}

function drawFishSilhouette(ctx, x, y, scale, hueShift, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const body = ctx.createLinearGradient(-50, -10, 60, 24);
  body.addColorStop(0, `hsla(${195 + hueShift}, 85%, 72%, ${0.62 + glow * 0.16})`);
  body.addColorStop(0.55, `hsla(${215 + hueShift}, 85%, 76%, ${0.84 + glow * 0.12})`);
  body.addColorStop(1, `hsla(${265 + hueShift}, 88%, 74%, ${0.56 + glow * 0.16})`);

  ctx.beginPath();
  ctx.moveTo(-52, 0);
  ctx.bezierCurveTo(-44, -26, 18, -34, 55, -4);
  ctx.bezierCurveTo(78, 16, 46, 36, 2, 30);
  ctx.bezierCurveTo(-20, 27, -40, 16, -52, 0);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.shadowBlur = 20 + glow * 14;
  ctx.shadowColor = `hsla(${206 + hueShift}, 95%, 74%, 0.45)`;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-52, 0);
  ctx.lineTo(-85, -16);
  ctx.lineTo(-82, 16);
  ctx.closePath();
  ctx.fillStyle = `hsla(${220 + hueShift}, 92%, 74%, ${0.45 + glow * 0.2})`;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(32, -6, 15, 6, 0.1, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${0.3 + glow * 0.22})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(40, -1, 3.2, 0, TAU);
  ctx.fillStyle = "rgba(10,20,40,0.65)";
  ctx.fill();
  ctx.restore();
}

export function drawResonantFPV(ctx, rect, current, time) {
  const width = rect?.width || ctx?.canvas?.width || 1;
  const height = rect?.height || ctx?.canvas?.height || 1;
  const centerX = width * 0.5;
  const centerY = height * 0.52;

  const fish = current?.fish || {};
  const bubbles = Array.isArray(current?.bubbles) ? current.bubbles : [];
  const t = time * 0.001;

  const speed = Math.hypot(fish.vx || 0, fish.vy || 0);
  const speedNorm = clamp(speed / 18, 0, 1.2);
  const mouthPull = clamp(fish.mouthPull || 0, 0, 1);
  const fishDepth = clamp(fish.depth || 1, 1, 3);

  // Synesthesia bands (douces, harmonisées).
  const bass = Math.sin(t * (1.8 + speedNorm * 0.65)) * 0.5 + 0.5;
  const mids = Math.sin(t * (3.1 + mouthPull * 2.4) + 1.2) * 0.5 + 0.5;
  const highs = Math.sin(t * (6.8 + speedNorm * 1.8) + 2.4) * 0.5 + 0.5;
  const resonance = clamp(0.25 + speedNorm * 0.35 + mouthPull * 0.28 + bass * 0.16, 0, 1.3);

  const [r, g, b] = depthColor(fishDepth);
  const auraBg = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, Math.max(width, height) * 0.9);
  auraBg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.14 + resonance * 0.05})`);
  auraBg.addColorStop(0.46, "rgba(16, 18, 40, 0.92)");
  auraBg.addColorStop(1, "rgba(4, 6, 18, 1)");
  ctx.fillStyle = auraBg;
  ctx.fillRect(0, 0, width, height);

  // Brumes boréales résonantes le long du corps énergétique.
  for (let i = 0; i < 5; i += 1) {
    const p = i / 4;
    const y = centerY + (p - 0.5) * height * 0.4 + Math.sin(t * 0.5 + i * 0.8) * 24;
    const amp = 45 + resonance * 20 + i * 8;
    const haze = ctx.createLinearGradient(0, y - amp, width, y + amp);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.25, `hsla(${186 + i * 12}, 95%, 70%, ${0.04 + mids * 0.06})`);
    haze.addColorStop(0.7, `hsla(${255 + i * 10}, 95%, 72%, ${0.03 + bass * 0.06})`);
    haze.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, y - amp, width, amp * 2);
  }

  // Halo concentriques = échos somatiques.
  const ringCount = 10;
  for (let i = 0; i < ringCount; i += 1) {
    const p = i / (ringCount - 1);
    const radius = (40 + p * Math.min(width, height) * 0.44) * (1 + bass * 0.03);
    const wobbleX = Math.sin(t * 0.8 + i * 0.7) * (2 + resonance * 3);
    const wobbleY = Math.cos(t * 0.65 + i * 0.9) * (2 + resonance * 2.5);
    ctx.beginPath();
    ctx.ellipse(centerX + wobbleX, centerY + wobbleY, radius, radius * (0.58 + mids * 0.08), 0, 0, TAU);
    ctx.strokeStyle = `hsla(${192 + i * 6}, 92%, 76%, ${0.03 + (1 - p) * 0.09})`;
    ctx.lineWidth = 0.8 + (1 - p) * 1.2;
    ctx.stroke();
  }

  // Voiles particulaires autour du corps.
  const moteCount = Math.floor(90 + resonance * 40);
  for (let i = 0; i < moteCount; i += 1) {
    const a = ((i * 137.5) % 360) * (Math.PI / 180) + t * (0.14 + highs * 0.16);
    const radial = 34 + ((i * 17) % 100) * (2 + resonance * 0.8);
    const drift = Math.sin(t * 1.4 + i * 0.2) * 14;
    const x = centerX + Math.cos(a) * radial + drift;
    const y = centerY + Math.sin(a * 1.12) * radial * 0.48;
    const s = 0.5 + (((i * 11) % 7) / 7) * (1.8 + highs);

    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fillStyle = `rgba(225, 244, 255, ${0.05 + highs * 0.12})`;
    ctx.fill();
  }

  // Poisson-plume au centre (visible, 2D traversée sensible).
  const fishScale = 1 + speedNorm * 0.08 + resonance * 0.05;
  drawFishSilhouette(ctx, centerX, centerY + Math.sin(t * 1.25) * 4, fishScale, fishDepth * 8, resonance);

  // Echo lumineux sur "parties du corps" : tête, coeur, queue.
  const bodyNodes = [
    { x: 38, y: -2, radius: 20, color: 196, activity: highs },
    { x: -2, y: 4, radius: 26, color: 244, activity: mids },
    { x: -58, y: 0, radius: 18, color: 284, activity: bass },
  ];

  bodyNodes.forEach((node) => {
    const px = centerX + node.x * fishScale;
    const py = centerY + Math.sin(t * 1.25) * 4 + node.y * fishScale;
    const rNode = node.radius * (0.8 + node.activity * 0.45 + resonance * 0.2);

    const glow = ctx.createRadialGradient(px, py, 0, px, py, rNode);
    glow.addColorStop(0, `hsla(${node.color}, 96%, 76%, ${0.18 + node.activity * 0.25})`);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, rNode, 0, TAU);
    ctx.fill();
  });

  // Bubbles -> étincelles synesthésiques (plus environnement réaliste).
  const sparkCount = Math.min(36, bubbles.length);
  for (let i = 0; i < sparkCount; i += 1) {
    const bubble = bubbles[i];
    const seed = ((bubble.x || 0) * 0.03 + (bubble.y || 0) * 0.02 + i) % TAU;
    const dist = 60 + (i / Math.max(1, sparkCount - 1)) * Math.min(width, height) * 0.45;
    const sx = centerX + Math.cos(seed + t * 0.22) * dist;
    const sy = centerY + Math.sin(seed * 1.2 - t * 0.18) * dist * 0.54;
    const sr = 1 + (i % 3) * 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fillStyle = `rgba(245, 250, 255, ${0.09 + mids * 0.12})`;
    ctx.fill();
  }

  // Périphérie floutée / reposante.
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.2,
    centerX,
    centerY,
    Math.max(width, height) * 0.8
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.62, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(5, 8, 22, 0.58)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
