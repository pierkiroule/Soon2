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
  if (depth >= 3) return [126, 82, 212];
  if (depth >= 2) return [58, 180, 198];
  return [82, 164, 228];
}

function projectPoint(point, fish, centerX, centerY, projectionScale) {
  const dx = (point.x || 0) - (fish.x || 0);
  const dy = (point.y || 0) - (fish.y || 0);
  const dist = Math.hypot(dx, dy);
  const angle = normalizeAngle(Math.atan2(dy, dx) - (fish.angle || 0));
  const forward = Math.cos(angle);
  if (forward < -0.25) return null;

  const depthFactor = clamp(1 / (1 + dist * 0.0052), 0.08, 1);
  const fishDepth = clamp(fish.depth || 1, 1, 3);
  const zDelta = ((point.depth || fishDepth) - fishDepth) * 0.52;

  return {
    dist,
    depthFactor,
    x: centerX + Math.sin(angle) * projectionScale * depthFactor,
    y: centerY - forward * 120 * depthFactor + zDelta * 42,
    forward,
    angle,
  };
}

export function drawResonantFPV(ctx, rect, current, time) {
  const width = rect?.width || ctx?.canvas?.width || 1;
  const height = rect?.height || ctx?.canvas?.height || 1;
  const centerX = width * 0.5;
  const centerY = height * 0.54;

  const fish = current?.fish || {};
  const bubbles = Array.isArray(current?.bubbles) ? current.bubbles : [];
  const traceCircuit = Array.isArray(current?.traceCircuit) ? current.traceCircuit : [];

  const t = time * 0.001;
  const speed = Math.hypot(fish.vx || 0, fish.vy || 0);
  const speedNorm = clamp(speed / 18, 0, 1);
  const fishDepth = clamp(fish.depth || 1, 1, 3);
  const [r, g, b] = depthColor(fishDepth);

  // Eau volumétrique réaliste, sans tunnel.
  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, `rgba(${r - 20}, ${g - 24}, ${b - 28}, 0.94)`);
  ocean.addColorStop(0.45, "rgba(12, 34, 56, 0.98)");
  ocean.addColorStop(1, "rgba(2, 10, 22, 1)");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  // God rays / caustiques douces.
  for (let i = 0; i < 7; i += 1) {
    const x = (i / 6) * width + Math.sin(t * 0.22 + i) * 24;
    const ray = ctx.createLinearGradient(x, 0, x + width * 0.2, height);
    ray.addColorStop(0, "rgba(220, 245, 255, 0.08)");
    ray.addColorStop(0.4, "rgba(180, 230, 255, 0.03)");
    ray.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = ray;
    ctx.fillRect(x - width * 0.08, 0, width * 0.22, height);
  }

  const projectionScale = Math.min(width, height) * 0.72;

  // Rails visuels du parcours 2D -> projection 3D perspective.
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

    const lookAhead = Math.min(42, traceCircuit.length);
    const sampled = [];

    for (let step = 0; step < lookAhead; step += 1) {
      const index = (nearestIndex + step) % traceCircuit.length;
      const p = traceCircuit[index];
      const projected = projectPoint(p, fish, centerX, centerY, projectionScale);
      if (!projected) continue;
      sampled.push({ p, ...projected });
    }

    if (sampled.length > 1) {
      ctx.beginPath();
      sampled.forEach((node, idx) => {
        if (idx === 0) ctx.moveTo(node.x, node.y);
        else ctx.lineTo(node.x, node.y);
      });
      ctx.strokeStyle = "rgba(148, 223, 255, 0.32)";
      ctx.lineWidth = 1.8 + speedNorm * 1.2;
      ctx.stroke();

      for (let i = sampled.length - 1; i >= 0; i -= 1) {
        const node = sampled[i];
        const size = 0.9 + node.depthFactor * 8;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2.8);
        glow.addColorStop(0, `rgba(232, 250, 255, ${0.12 + node.depthFactor * 0.34})`);
        glow.addColorStop(1, "rgba(232, 250, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 2.8, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Bulles 3D réalistes : sphère + reflets spéculaires + ombrage.
  const projectedBubbles = [];
  for (let i = 0; i < bubbles.length; i += 1) {
    const bubble = bubbles[i];
    const p = projectPoint(bubble, fish, centerX, centerY, projectionScale);
    if (!p || p.dist > 760) continue;
    projectedBubbles.push({ bubble, ...p });
  }

  projectedBubbles.sort((a, b2) => b2.depthFactor - a.depthFactor);
  const maxBubbles = Math.min(38, projectedBubbles.length);

  for (let i = 0; i < maxBubbles; i += 1) {
    const node = projectedBubbles[i];
    const bubble = node.bubble;
    const radius = clamp(5 + node.depthFactor * 28, 3, 34);
    const [br, bg, bb] = depthColor(bubble.depth || fishDepth);

    const sphere = ctx.createRadialGradient(
      node.x - radius * 0.28,
      node.y - radius * 0.32,
      radius * 0.18,
      node.x,
      node.y,
      radius
    );
    sphere.addColorStop(0, `rgba(245, 252, 255, ${0.28 + node.depthFactor * 0.28})`);
    sphere.addColorStop(0.38, `rgba(${br}, ${bg}, ${bb}, ${0.11 + node.depthFactor * 0.16})`);
    sphere.addColorStop(1, `rgba(${br - 18}, ${bg - 20}, ${bb - 22}, 0.02)`);

    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, TAU);
    ctx.fill();

    // Rim highlight
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 0.94, -Math.PI * 0.3, Math.PI * 0.85);
    ctx.strokeStyle = `rgba(236, 252, 255, ${0.2 + node.depthFactor * 0.32})`;
    ctx.lineWidth = 1.1 + node.depthFactor * 1.2;
    ctx.stroke();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(node.x - radius * 0.34, node.y - radius * 0.36, radius * 0.19, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255, ${0.34 + node.depthFactor * 0.3})`;
    ctx.fill();

    // Subtle shadow (volume cue)
    ctx.beginPath();
    ctx.ellipse(node.x + radius * 0.12, node.y + radius * 0.14, radius * 0.52, radius * 0.34, 0, 0, TAU);
    ctx.fillStyle = "rgba(6, 14, 26, 0.14)";
    ctx.fill();
  }

  // Suspended micro particles pour matière aquatique réaliste.
  const moteCount = 64;
  for (let i = 0; i < moteCount; i += 1) {
    const px = ((i * 137.2 + t * (18 + speedNorm * 20)) % (width + 60)) - 30;
    const py = ((i * 97.1 + t * (8 + speedNorm * 12)) % (height + 60)) - 30;
    const pr = 0.4 + ((i * 3) % 4) * 0.22;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fillStyle = "rgba(220, 240, 255, 0.13)";
    ctx.fill();
  }

  // Flou périphérique perçu (vignette optique aquatique).
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.24,
    centerX,
    centerY,
    Math.max(width, height) * 0.82
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.62, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(2, 8, 16, 0.46)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
