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
  if (depth >= 3) return [168, 85, 247];
  if (depth >= 2) return [45, 212, 191];
  return [56, 189, 248];
}

export function drawResonantFPV(ctx, rect, current, time) {
  const width = rect?.width || ctx?.canvas?.width || 1;
  const height = rect?.height || ctx?.canvas?.height || 1;
  const centerX = width * 0.5;
  const centerY = height * 0.52;

  const fish = current?.fish || {};
  const bubbles = Array.isArray(current?.bubbles) ? current.bubbles : [];
  const traceCircuit = Array.isArray(current?.traceCircuit) ? current.traceCircuit : [];

  const t = time * 0.001;
  const speed = Math.hypot(fish.vx || 0, fish.vy || 0);
  const speedNorm = clamp(speed / 18, 0, 1.2);
  const fishDepth = clamp(fish.depth || 1, 1, 3);
  const mouthPull = clamp(fish.mouthPull || 0, 0, 1);

  // Audio-réactivité douce : respiration visuelle, sans chaos.
  const bass = Math.sin(t * (1.7 + speedNorm * 0.8)) * 0.5 + 0.5;
  const mids = Math.sin(t * (3.4 + mouthPull * 1.6) + 1.8) * 0.5 + 0.5;
  const highs = Math.sin(t * (7.2 + speedNorm * 1.6) + 0.7) * 0.5 + 0.5;
  const energy = clamp(0.28 + speedNorm * 0.36 + mouthPull * 0.24 + bass * 0.12, 0, 1);
  const pulse = 1 + energy * 0.24 + mids * 0.05;

  const [r, g, b] = depthColor(fishDepth);

  const bg = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(width, height) * 0.9);
  bg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.12 + energy * 0.04})`);
  bg.addColorStop(0.45, "rgba(6, 12, 26, 0.93)");
  bg.addColorStop(1, "rgba(1, 4, 12, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Tunnel lisse : peu d'anneaux, profondeur lisible, mouvement stable.
  const baseRadius = Math.min(width, height) * (0.3 + speedNorm * 0.06);
  const ringCount = 16;

  for (let i = 0; i < ringCount; i += 1) {
    const z = i / (ringCount - 1);
    const depth = Math.pow(1 - z, 1.45);
    const travel = (t * (0.42 + speedNorm * 0.95 + energy * 0.45) + z * 1.35) % 1;
    const radius = baseRadius * (0.25 + depth * (1.2 + bass * 0.22));
    const sway = Math.sin(t * 0.48 + z * 4.2) * 10 * depth * (0.35 + mids * 0.45);
    const lift = Math.cos(t * 0.36 + z * 3.1) * 6 * depth;

    const cx = centerX + sway;
    const cy = centerY - travel * height * 0.85 + lift;

    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * (0.7 + mids * 0.08), 0, 0, TAU);
    const alpha = clamp(0.04 + depth * 0.22 + energy * 0.04, 0.03, 0.28);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = 0.9 + depth * 1.6;
    ctx.stroke();
  }

  // Particules de paroi : rarifiées et douces (mobile-friendly).
  const wallParticles = Math.floor(72 + speedNorm * 34);
  for (let i = 0; i < wallParticles; i += 1) {
    const lane = i / wallParticles;
    const theta = lane * TAU * 8 + t * (0.32 + highs * 0.5);
    const axial = ((i * 19.7 + t * (120 + speedNorm * 140)) % (height + 100)) - 50;
    const radial = baseRadius * (0.7 + ((i * 13) % 100) / 100 * 0.65);

    const x = centerX + Math.cos(theta) * radial;
    const y = centerY - axial + Math.sin(theta * 0.8) * 10;

    const p = clamp((height - y + 80) / (height + 160), 0, 1);
    const size = 0.4 + p * 1.4;
    const alpha = clamp(0.03 + p * 0.2 + highs * 0.04, 0.03, 0.28);

    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = `rgba(206, 236, 255, ${alpha})`;
    ctx.fill();
  }

  // Ligne-guide : chemin perçu dans la traversée odysséo.
  if (traceCircuit.length > 1) {
    let nearestIndex = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < traceCircuit.length; i += 1) {
      const p = traceCircuit[i];
      const d = Math.hypot((p.x || 0) - (fish.x || 0), (p.y || 0) - (fish.y || 0));
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    }

    const lookAhead = Math.min(26, traceCircuit.length);
    const perspective = Math.min(width, height) * 0.62;

    ctx.beginPath();
    for (let step = 0; step < lookAhead; step += 1) {
      const index = (nearestIndex + step) % traceCircuit.length;
      const p = traceCircuit[index];
      const dx = (p.x || 0) - (fish.x || 0);
      const dy = (p.y || 0) - (fish.y || 0);
      const dist = Math.hypot(dx, dy);
      const relAngle = normalizeAngle(Math.atan2(dy, dx) - (fish.angle || 0));
      const front = Math.cos(relAngle);
      if (front < -0.18) continue;

      const depthFactor = 1 / (1 + dist * 0.0058);
      const screenX = centerX + Math.sin(relAngle) * perspective * depthFactor;
      const screenY = centerY - front * (96 + bass * 16) * depthFactor + (p.depth - fishDepth) * 14;

      if (step === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);

      if (step % 3 === 0) {
        ctx.beginPath();
        ctx.arc(screenX, screenY, 0.8 + depthFactor * 4.5, 0, TAU);
        ctx.fillStyle = `rgba(236, 253, 255, ${0.2 + depthFactor * 0.3})`;
        ctx.fill();
      }
    }

    ctx.strokeStyle = `rgba(125, 211, 252, ${0.26 + speedNorm * 0.16 + energy * 0.12})`;
    ctx.lineWidth = 2 + speedNorm * 1.5;
    ctx.shadowBlur = 14 + energy * 10;
    ctx.shadowColor = "rgba(56, 189, 248, 0.52)";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const nearBubbles = bubbles
    .map((bubble) => {
      const dx = (bubble.x || 0) - (fish.x || 0);
      const dy = (bubble.y || 0) - (fish.y || 0);
      const distance = Math.hypot(dx, dy);
      const angleToBubble = Math.atan2(dy, dx);
      const relativeAngle = normalizeAngle(angleToBubble - (fish.angle || 0));
      return { bubble, distance, relativeAngle };
    })
    .filter((item) => item.distance < 700)
    .slice(0, 30);

  nearBubbles.forEach(({ bubble, distance, relativeAngle }) => {
    const front = Math.cos(relativeAngle);
    if (front < -0.22) return;

    const perspective = Math.min(width, height) * 0.68;
    const screenX = centerX + Math.sin(relativeAngle) * perspective * clamp(1 / (1 + distance * 0.008), 0.12, 1);
    const screenY = centerY + (bubble.depth - fishDepth) * 34 + (1 - front) * 34;
    const scale = clamp(220 / (distance + 120), 0.1, 1.4);
    const alpha = clamp(0.22 * scale + energy * 0.06, 0.05, 0.42);
    const [br, bgc, bb] = depthColor(bubble.depth || 1);

    const halo = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, 46 * scale * pulse);
    halo.addColorStop(0, `rgba(${br}, ${bgc}, ${bb}, ${alpha})`);
    halo.addColorStop(1, `rgba(${br}, ${bgc}, ${bb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 46 * scale * pulse, 0, TAU);
    ctx.fill();
  });

  // Flou périphérique perçu : vignette lumineuse + assombrissement doux.
  ctx.save();
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.22,
    centerX,
    centerY,
    Math.max(width, height) * 0.78
  );
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(0.62, "rgba(6, 12, 26, 0)");
  vignette.addColorStop(1, `rgba(3, 8, 20, ${0.34 + energy * 0.08})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // Halo doux central pour équilibrer la lisibilité du point de fuite.
  const bloom = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, Math.min(width, height) * 0.34);
  bloom.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.06 + energy * 0.04})`);
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
