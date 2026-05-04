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
  const speedNorm = clamp(speed / 18, 0, 1.35);
  const fishDepth = clamp(fish.depth || 1, 1, 3);
  const mouthPull = clamp(fish.mouthPull || 0, 0, 1);

  // Audio-reactive proxy: quand l'audio explicite n'est pas présent,
  // on injecte une rythmique basée sur speed/mouthPull + oscillateurs.
  const lowBeat = Math.sin(t * (2.2 + speedNorm * 1.8)) * 0.5 + 0.5;
  const midBeat = Math.sin(t * (5.8 + mouthPull * 3.6) + 1.4) * 0.5 + 0.5;
  const highBeat = Math.sin(t * (11.2 + speedNorm * 3.4) + mouthPull * 6.2) * 0.5 + 0.5;
  const audioEnergy = clamp(0.35 + speedNorm * 0.42 + mouthPull * 0.28 + lowBeat * 0.15, 0, 1.4);
  const pulse = 1 + audioEnergy * 0.42 + midBeat * 0.08;

  const [r, g, b] = depthColor(fishDepth);

  const bg = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(width, height) * 0.9);
  bg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.17 + audioEnergy * 0.05})`);
  bg.addColorStop(0.4, "rgba(8, 12, 32, 0.88)");
  bg.addColorStop(1, "rgba(1, 4, 12, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const baseRadius = Math.min(width, height) * (0.28 + speedNorm * 0.08 + audioEnergy * 0.04);
  const ringCount = 30;

  // Anneaux 3D du tunnel (roller coaster): compression perspective + torsion.
  for (let i = 0; i < ringCount; i += 1) {
    const z = i / (ringCount - 1); // 0 proche, 1 lointain
    const depth = Math.pow(1 - z, 1.55);
    const travel = (t * (0.62 + speedNorm * 1.8 + audioEnergy * 1.2) + z * 1.9) % 1;
    const radius = baseRadius * (0.16 + depth * (1.75 + lowBeat * 0.42));
    const twist = t * (0.22 + audioEnergy * 0.45) + z * (1.6 + highBeat * 0.8);
    const cork = Math.sin(twist * 1.5) * 36 * depth * (0.3 + audioEnergy * 0.8);
    const lift = Math.cos(twist * 1.2) * 20 * depth * (0.35 + midBeat * 0.65);

    const cx = centerX + cork;
    const cy = centerY + lift - travel * height * 0.95;

    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      radius,
      radius * (0.64 + midBeat * 0.14),
      Math.sin(t * 0.34 + z * 4) * 0.28,
      0,
      TAU
    );
    const alpha = clamp(0.03 + depth * 0.3 + audioEnergy * 0.06, 0.03, 0.46);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = 0.8 + depth * (2.2 + lowBeat * 1.2);
    ctx.stroke();
  }

  // Parois particulaires audio-reactives.
  const wallParticles = Math.floor(170 + speedNorm * 100 + audioEnergy * 70);
  for (let i = 0; i < wallParticles; i += 1) {
    const lane = i / wallParticles;
    const theta = lane * TAU * 12 + t * (0.4 + highBeat * 1.7);
    const axial = ((i * 13.37 + t * (220 + speedNorm * 330 + audioEnergy * 260)) % (height + 160)) - 80;
    const radial = baseRadius * (0.56 + ((i * 17) % 100) / 100 * (1.1 + lowBeat * 0.9));
    const wobble = Math.sin(t * 1.3 + i * 0.07) * 18 * midBeat;

    const x = centerX + Math.cos(theta) * radial + wobble;
    const y = centerY - axial + Math.sin(theta * 1.2) * 22;

    const p = clamp((height - y + 120) / (height + 220), 0, 1);
    const size = 0.5 + p * (1.8 + audioEnergy * 2.4);
    const alpha = clamp(0.04 + p * 0.34 + highBeat * 0.08, 0.03, 0.52);

    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = `rgba(${200 + Math.floor(30 * midBeat)}, ${230 + Math.floor(20 * highBeat)}, 255, ${alpha})`;
    ctx.fill();
  }

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

    const lookAhead = Math.min(36, traceCircuit.length);
    const perspective = Math.min(width, height) * 0.64;

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

      const depthFactor = 1 / (1 + dist * 0.0056);
      const screenX = centerX + Math.sin(relAngle) * perspective * depthFactor;
      const screenY = centerY - front * (120 + lowBeat * 20) * depthFactor + (p.depth - fishDepth) * 16;

      if (step === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);

      const glow = 2 + depthFactor * (14 + audioEnergy * 8);
      ctx.beginPath();
      ctx.arc(screenX, screenY, glow * 0.2, 0, TAU);
      ctx.fillStyle = `rgba(236, 253, 255, ${0.28 + depthFactor * 0.5 + highBeat * 0.08})`;
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(125, 211, 252, ${0.35 + speedNorm * 0.25 + audioEnergy * 0.18})`;
    ctx.lineWidth = 2.4 + speedNorm * 2.8 + audioEnergy * 1.6;
    ctx.shadowBlur = 20 + audioEnergy * 20;
    ctx.shadowColor = "rgba(56, 189, 248, 0.72)";
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
    .filter((item) => item.distance < 760)
    .slice(0, 52);

  nearBubbles.forEach(({ bubble, distance, relativeAngle }) => {
    const front = Math.cos(relativeAngle);
    if (front < -0.2) return;

    const perspective = Math.min(width, height) * 0.72;
    const screenX = centerX + Math.sin(relativeAngle) * perspective * clamp(1 / (1 + distance * 0.0075), 0.12, 1);
    const screenY = centerY + (bubble.depth - fishDepth) * 40 + (1 - front) * 46;
    const scale = clamp(240 / (distance + 120), 0.1, 1.6);
    const alpha = clamp(0.42 * scale + audioEnergy * 0.08, 0.06, 0.64);
    const [br, bgc, bb] = depthColor(bubble.depth || 1);

    const halo = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, 58 * scale * pulse);
    halo.addColorStop(0, `rgba(${br}, ${bgc}, ${bb}, ${alpha})`);
    halo.addColorStop(1, `rgba(${br}, ${bgc}, ${bb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 58 * scale * pulse, 0, TAU);
    ctx.fill();
  });
}
