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
  const pulse = 1 + speedNorm * 0.45 + Math.sin(t * 3.2) * 0.03;
  const fishDepth = clamp(fish.depth || 1, 1, 3);

  const [r, g, b] = depthColor(fishDepth);

  const bg = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(width, height) * 0.88);
  bg.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.16)`);
  bg.addColorStop(0.5, "rgba(6, 12, 28, 0.92)");
  bg.addColorStop(1, "rgba(1, 4, 12, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const tunnelRadius = Math.min(width, height) * (0.34 + speedNorm * 0.08);
  for (let i = 0; i < 16; i += 1) {
    const k = i / 15;
    const z = 1 - k;
    const ringR = tunnelRadius * (0.2 + z * (1 + speedNorm * 0.6));
    const wobble = Math.sin(t * 0.8 + i * 0.55) * 8 * speedNorm;
    ctx.beginPath();
    ctx.ellipse(centerX + wobble, centerY, ringR, ringR * 0.72, Math.sin(t * 0.15 + i) * 0.06, 0, TAU);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.22 * (1 - k)})`;
    ctx.lineWidth = 1 + (1 - k) * 1.4;
    ctx.stroke();
  }

  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * TAU + Math.sin(t * 0.4) * 0.2;
    const len = tunnelRadius * (1 + speedNorm * 0.6);
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(a) * 16, centerY + Math.sin(a) * 12);
    ctx.lineTo(centerX + Math.cos(a) * len, centerY + Math.sin(a) * len * 0.72);
    ctx.strokeStyle = `rgba(148, 210, 255, ${0.07 + speedNorm * 0.06})`;
    ctx.lineWidth = 1;
    ctx.stroke();
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

    const lookAhead = Math.min(26, traceCircuit.length);
    const perspective = Math.min(width, height) * 0.58;
    ctx.beginPath();
    for (let step = 0; step < lookAhead; step += 1) {
      const index = (nearestIndex + step) % traceCircuit.length;
      const p = traceCircuit[index];
      const dx = (p.x || 0) - (fish.x || 0);
      const dy = (p.y || 0) - (fish.y || 0);
      const dist = Math.hypot(dx, dy);
      const relAngle = normalizeAngle(Math.atan2(dy, dx) - (fish.angle || 0));
      const front = Math.cos(relAngle);
      if (front < -0.15) continue;

      const depthFactor = 1 / (1 + dist * 0.006);
      const screenX = centerX + Math.sin(relAngle) * perspective * depthFactor;
      const screenY = centerY - front * 90 * depthFactor + (p.depth - fishDepth) * 12;

      if (step === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);

      const glow = 2 + depthFactor * 13;
      ctx.beginPath();
      ctx.arc(screenX, screenY, glow * 0.22, 0, TAU);
      ctx.fillStyle = `rgba(236, 253, 255, ${0.28 + depthFactor * 0.45})`;
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(125, 211, 252, ${0.34 + speedNorm * 0.2})`;
    ctx.lineWidth = 2.6 + speedNorm * 2.4;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "rgba(56, 189, 248, 0.7)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let step = 2; step < Math.min(12, lookAhead); step += 2) {
      const index = (nearestIndex + step) % traceCircuit.length;
      const p = traceCircuit[index];
      const dx = (p.x || 0) - (fish.x || 0);
      const dy = (p.y || 0) - (fish.y || 0);
      const dist = Math.hypot(dx, dy);
      const relAngle = normalizeAngle(Math.atan2(dy, dx) - (fish.angle || 0));
      const front = Math.cos(relAngle);
      if (front < -0.2) continue;
      const depthFactor = 1 / (1 + dist * 0.006);
      const sx = centerX + Math.sin(relAngle) * perspective * depthFactor;
      const sy = centerY - front * 90 * depthFactor + (p.depth - fishDepth) * 12;
      const size = 1.4 + depthFactor * 10;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, TAU);
      ctx.fillStyle = `rgba(250, 245, 255, ${0.2 + depthFactor * 0.6})`;
      ctx.fill();
    }
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
    .filter((item) => item.distance < 720)
    .slice(0, 40);

  const densityBoost = nearBubbles.length > 0 ? 1.25 : 0.9;
  nearBubbles.forEach(({ bubble, distance, relativeAngle }) => {
    const front = Math.cos(relativeAngle);
    if (front < -0.2) return;

    const perspective = Math.min(width, height) * 0.68;
    const screenX = centerX + Math.sin(relativeAngle) * perspective * clamp(1 / (1 + distance * 0.008), 0.12, 1);
    const screenY = centerY + (bubble.depth - fishDepth) * 36 + (1 - front) * 42;
    const scale = clamp(220 / (distance + 120), 0.12, 1.5);
    const alpha = clamp(0.48 * scale, 0.05, 0.55);
    const [br, bgc, bb] = depthColor(bubble.depth || 1);

    const halo = ctx.createRadialGradient(screenX, screenY, 2, screenX, screenY, 55 * scale * pulse);
    halo.addColorStop(0, `rgba(${br}, ${bgc}, ${bb}, ${alpha})`);
    halo.addColorStop(1, `rgba(${br}, ${bgc}, ${bb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 55 * scale * pulse, 0, TAU);
    ctx.fill();
  });

  const particleCount = Math.floor(24 * densityBoost + speedNorm * 26);
  for (let i = 0; i < particleCount; i += 1) {
    const px = (Math.sin(i * 91.7 + t * (1.3 + speedNorm * 1.8)) * 0.5 + 0.5) * width;
    const py = (i * 53 + t * 90 * (1 + speedNorm * 2.4)) % (height + 40) - 20;
    const pr = 0.8 + ((i * 7) % 3) * 0.8;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = `rgba(186, 230, 253, ${0.08 + speedNorm * 0.18})`;
    ctx.fill();
  }

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 8; i += 1) {
    const y = (i / 8) * height;
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 18) {
      const wave = Math.sin(x * 0.03 + t * 0.9 + i * 0.7) * 5;
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = `rgba(226, 232, 240, ${0.05 + i * 0.006})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}
