function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function traceFishBodyPath(ctx, bodyUndulate = 0, bodyBreath = 0, bend = 0) {
  const bu = safeNumber(bodyUndulate, 0);
  const br = safeNumber(bodyBreath, 0);
  const curve = Math.max(-1, Math.min(1, safeNumber(bend, 0)));

  const headWidth = 12.8 + br * 0.6;
  const cheekLift = 1.8 + Math.abs(curve) * 1.2;
  const bodyShift = curve * 5.8;

  ctx.beginPath();
  ctx.moveTo(bodyShift * 0.12, -25.5);
  ctx.bezierCurveTo(
    headWidth + bodyShift * 0.4,
    -23 + cheekLift,
    16 + br * 0.6 + bodyShift,
    -7,
    11.8 + bodyShift * 0.82,
    6.2
  );
  ctx.bezierCurveTo(
    8.5 + bodyShift * 0.9,
    18.5,
    3 + bodyShift * 0.72,
    28.5,
    bodyShift * 0.35,
    31.8
  );
  ctx.bezierCurveTo(
    -3 + bodyShift * 0.28,
    28.5,
    -8.5 + bodyShift * 0.1,
    18.5,
    -11.8 + bodyShift * 0.18,
    6.2
  );
  ctx.bezierCurveTo(
    -16 + br * 0.6 + bodyShift * 0.05,
    -7,
    -headWidth + bodyShift * 0.04,
    -23 + cheekLift,
    bodyShift * 0.12,
    -25.5
  );
  ctx.closePath();
}

function drawClassicFishFins(ctx, finFlap, bodyHueMid) {
  ctx.save();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.translate(-7, 2);
  ctx.rotate(-0.38 + finFlap);

  const finGradL = ctx.createLinearGradient(0, -1, -12, 14);
  finGradL.addColorStop(0, `hsla(${bodyHueMid}, 80%, 82%, 0.70)`);
  finGradL.addColorStop(1, `hsla(${bodyHueMid + 12}, 78%, 88%, 0)`);

  ctx.fillStyle = finGradL;
  ctx.shadowColor = "transparent";

  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.bezierCurveTo(-10, 0, -14, 7, -8, 15);
  ctx.bezierCurveTo(-4, 10, -1, 4, 0, -1);
  ctx.fill();

  ctx.restore();

  ctx.save();
  ctx.translate(7, 2);
  ctx.rotate(0.38 - finFlap);

  const finGradR = ctx.createLinearGradient(0, -1, 12, 14);
  finGradR.addColorStop(0, `hsla(${bodyHueMid}, 80%, 82%, 0.70)`);
  finGradR.addColorStop(1, `hsla(${bodyHueMid + 12}, 78%, 88%, 0)`);

  ctx.fillStyle = finGradR;
  ctx.shadowColor = "transparent";

  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.bezierCurveTo(10, 0, 14, 7, 8, 15);
  ctx.bezierCurveTo(4, 10, 1, 4, 0, -1);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

function drawAudioWings(ctx, data) {
  const {
    finFlap,
    finMorph,
    wingDrift,
    wingAlpha,
    bubbleAudioInfluence,
  } = data;

  const wingSpan = 12 + finMorph * 22;
  const wingLength = 15 + finMorph * 30;

  ctx.save();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(-7, 2);
  ctx.rotate(-0.38 + finFlap - wingDrift * 0.03);

  const finGradL = ctx.createLinearGradient(0, -2, -wingSpan, wingLength);
  finGradL.addColorStop(
    0,
    `hsla(${196 + bubbleAudioInfluence * 10}, 92%, 80%, ${(0.66 + finMorph * 0.16) * wingAlpha})`
  );
  finGradL.addColorStop(
    0.52,
    `hsla(${216 + bubbleAudioInfluence * 8}, 94%, 68%, ${(0.55 + finMorph * 0.2) * wingAlpha})`
  );
  finGradL.addColorStop(1, `hsla(${328 + finMorph * 12}, 96%, 72%, 0)`);

  ctx.fillStyle = finGradL;
  ctx.shadowColor = "transparent";

  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.bezierCurveTo(
    -wingSpan * 0.56,
    -1.5 - finMorph * 1.2,
    -wingSpan * 1.18,
    wingLength * 0.52,
    -wingSpan * 0.58,
    wingLength
  );
  ctx.bezierCurveTo(
    -wingSpan * 0.25,
    wingLength * 0.66,
    -2,
    5 + finMorph * 2.8,
    0,
    -1
  );
  ctx.fill();

  ctx.strokeStyle = `hsla(${208 + bubbleAudioInfluence * 10}, 88%, 88%, ${0.1 * wingAlpha})`;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i += 1) {
    const t = (i + 1) / 5;
    ctx.beginPath();
    ctx.moveTo(-1, 0.5 + t * 3.2);
    ctx.quadraticCurveTo(
      -wingSpan * (0.34 + t * 0.24),
      wingLength * (0.26 + t * 0.15),
      -wingSpan * (0.4 + t * 0.34),
      wingLength * (0.54 + t * 0.1)
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(7, 2);
  ctx.rotate(0.38 - finFlap + wingDrift * 0.03);

  const finGradR = ctx.createLinearGradient(0, -2, wingSpan, wingLength);
  finGradR.addColorStop(
    0,
    `hsla(${196 + bubbleAudioInfluence * 10}, 92%, 80%, ${(0.66 + finMorph * 0.16) * wingAlpha})`
  );
  finGradR.addColorStop(
    0.52,
    `hsla(${216 + bubbleAudioInfluence * 8}, 94%, 68%, ${(0.55 + finMorph * 0.2) * wingAlpha})`
  );
  finGradR.addColorStop(1, `hsla(${328 + finMorph * 12}, 96%, 72%, 0)`);

  ctx.fillStyle = finGradR;
  ctx.shadowColor = "transparent";

  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.bezierCurveTo(
    wingSpan * 0.56,
    -1.5 - finMorph * 1.2,
    wingSpan * 1.18,
    wingLength * 0.52,
    wingSpan * 0.58,
    wingLength
  );
  ctx.bezierCurveTo(
    wingSpan * 0.25,
    wingLength * 0.66,
    2,
    5 + finMorph * 2.8,
    0,
    -1
  );
  ctx.fill();

  ctx.strokeStyle = `hsla(${208 + bubbleAudioInfluence * 10}, 88%, 88%, ${0.1 * wingAlpha})`;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i += 1) {
    const t = (i + 1) / 5;
    ctx.beginPath();
    ctx.moveTo(1, 0.5 + t * 3.2);
    ctx.quadraticCurveTo(
      wingSpan * (0.34 + t * 0.24),
      wingLength * (0.26 + t * 0.15),
      wingSpan * (0.4 + t * 0.34),
      wingLength * (0.54 + t * 0.1)
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

function drawTail(ctx, data) {
  const { wag, bodyHueTop, bodyHueMid, bodyHueLow, flow = 0, bend = 0 } = data;

  ctx.save();
  ctx.translate(safeNumber(bend, 0) * 1.8, 20);
  ctx.rotate(wag + safeNumber(bend, 0) * 0.22);

  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  const tailGrad = ctx.createLinearGradient(0, 0, 0, 26);
  tailGrad.addColorStop(0, `hsla(${bodyHueMid}, 84%, 80%, 0.92)`);
  tailGrad.addColorStop(1, `hsla(${bodyHueLow + 10}, 80%, 74%, 0)`);

  ctx.fillStyle = tailGrad;

  const plumeSpread = 1 + Math.max(0, flow) * 0.18;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-8.2 * plumeSpread, 4, -10.8 * plumeSpread, 13.5, -4.4 * plumeSpread, 23.5);
  ctx.quadraticCurveTo(0, 19.5, 4.4 * plumeSpread, 23.5);
  ctx.bezierCurveTo(10.8 * plumeSpread, 13.5, 8.2 * plumeSpread, 4, 0, 0);
  ctx.fill();

  const tipGrad = ctx.createLinearGradient(0, 18, -6, 36);
  tipGrad.addColorStop(0, `hsla(${bodyHueTop}, 90%, 90%, 0.65)`);
  tipGrad.addColorStop(1, `hsla(${bodyHueTop + 8}, 88%, 94%, 0)`);

  ctx.fillStyle = tipGrad;
  ctx.beginPath();
  ctx.moveTo(-1.5, 18);
  ctx.bezierCurveTo(-5, 23, -8, 31, -4.5, 36);
  ctx.quadraticCurveTo(-2, 30, -1.5, 18);
  ctx.fill();

  const tipGrad2 = ctx.createLinearGradient(0, 18, 6, 36);
  tipGrad2.addColorStop(0, `hsla(${bodyHueTop}, 90%, 90%, 0.65)`);
  tipGrad2.addColorStop(1, `hsla(${bodyHueTop + 8}, 88%, 94%, 0)`);

  ctx.fillStyle = tipGrad2;
  ctx.beginPath();
  ctx.moveTo(1.5, 18);
  ctx.bezierCurveTo(5, 23, 8, 31, 4.5, 36);
  ctx.quadraticCurveTo(2, 30, 1.5, 18);
  ctx.fill();

  ctx.restore();
}

function drawBioluminescentSpots(ctx, swimT) {
  const spotT = swimT * 3.2;

  [
    { x: -4.5, y: -1, r: 1.1, ph: 0.0 },
    { x: 4.2, y: 1, r: 0.9, ph: 1.4 },
    { x: -2.0, y: 7, r: 0.85, ph: 2.6 },
    { x: 3.0, y: -6, r: 0.75, ph: 3.8 },
    { x: 0.5, y: 3, r: 0.6, ph: 0.7 },
  ].forEach((spot) => {
    const pulse = (Math.sin(spotT + spot.ph) + 1) * 0.5;

    ctx.fillStyle = `rgba(175, 255, 235, 0.035)`;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r * (1 + pulse * 0.35), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.shadowBlur = 0;
}

function drawSideEyes(ctx) {
  ctx.save();

  ctx.beginPath();
  ctx.ellipse(-4.8, -13, 1.25, 2.1, -0.18, 0, Math.PI * 2);
  ctx.ellipse(4.8, -13, 1.25, 2.1, 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(10, 20, 35, 0.48)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-5.1, -13.8, 0.42, 0, Math.PI * 2);
  ctx.arc(4.5, -13.8, 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fill();

  ctx.restore();
}

export function drawPoissonPlume(ctx, fish, options = {}) {
  const time = options.time ?? performance.now();
  const swimT = time * 0.001;

  const x = safeNumber(fish.x);
  const y = safeNumber(fish.y);
  const vx = safeNumber(fish.vx);
  const vy = safeNumber(fish.vy);
  const angle = safeNumber(fish.angle, -Math.PI / 2);

  const maxSpeed = safeNumber(fish.maxSpeed, 3.1);
  const speed = Math.hypot(vx, vy);
  const mouthPull = safeNumber(fish.mouthPull, 0);
  const turnAmount = safeNumber(fish.turnAmount, 0);
  const depth = Math.max(1, Math.min(3, Math.round(safeNumber(fish.depth, 1))));

  const depthVisuals = {
    1: {
      scale: 1.5,
      alpha: 1,
      brightness: 1.06,
      saturation: 1.08,
      auraBoost: 1,
    },
    2: {
      scale: 1.42,
      alpha: 0.9,
      brightness: 0.86,
      saturation: 0.86,
      auraBoost: 1.25,
    },
    3: {
      scale: 1.34,
      alpha: 0.78,
      brightness: 0.68,
      saturation: 0.66,
      auraBoost: 1.65,
    },
  };

  const depthVisual = depthVisuals[depth];

  const audio = options.audio || {};
  const reactiveBass = safeNumber(audio.bass);
  const reactiveMids = safeNumber(audio.mids);
  const reactiveHighs = safeNumber(audio.highs);
  const reactiveEnergy = safeNumber(audio.energy);

  const proximity = safeNumber(options.proximity, 0.42);
  const audioInfluence = safeNumber(options.audioInfluence, 0.28);

  const wingPresence = Math.max(
    0.18,
    Math.min(1, Math.pow(proximity, 1.35) * Math.max(0.28, audioInfluence))
  );

  const glide = Math.min(1, speed / maxSpeed + reactiveBass * 0.22 + mouthPull * 0.22);
  const flowBend = Math.max(-1, Math.min(1, turnAmount * 1.8 + Math.sin(swimT * 1.6) * 0.12));
  const wag =
    Math.sin(swimT * (7.2 + mouthPull * 3.4)) *
    (0.1 + glide * 0.2 + Math.abs(flowBend) * 0.16);
  const finMorph = Math.min(1, wingPresence * (0.72 + reactiveMids * 0.28));

  const finFlap =
    Math.sin(swimT * (7.2 + reactiveMids * 1.8 + audioInfluence * 2.1 * wingPresence) + 0.5) *
    (0.12 + glide * 0.12 + reactiveMids * 0.055 + finMorph * 0.22 + turnAmount * 0.08);

  const bodyBreath = Math.sin(swimT * 2.5) * 0.65;
  const shimmerPulse = Math.min(
    1.2,
    (Math.sin(swimT * (2.2 + reactiveHighs * 0.8 + audioInfluence * 0.9 * wingPresence)) + 1) * 0.5 +
      reactiveHighs * 0.42
  );

  const bodyUndulate = Math.sin(swimT * 5) * (0.04 + glide * 0.06);

  const bodyHueTop = 186 + Math.sin(swimT * 1.7) * 8;
  const bodyHueMid = 198 + Math.sin(swimT * 1.3 + 1.4) * 12;
  const bodyHueLow = 210 + Math.sin(swimT * 1.9 + 2.1) * 10;

  ctx.save();

  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2 + flowBend * 0.08);
  ctx.globalAlpha *= depthVisual.alpha;
  ctx.scale(
    depthVisual.scale * (1 - mouthPull * 0.03),
    depthVisual.scale * (1 + mouthPull * 0.06 + Math.abs(flowBend) * 0.03)
  );


  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  const bodyGrad = ctx.createLinearGradient(-10, -18, 10, 24);
  bodyGrad.addColorStop(0, `hsla(${bodyHueTop}, 90%, 95%, ${0.88 + shimmerPulse * 0.12})`);
  bodyGrad.addColorStop(0.38, `hsla(${bodyHueMid}, 85%, 80%, ${0.78 + shimmerPulse * 0.12})`);
  bodyGrad.addColorStop(0.72, `hsla(${bodyHueLow}, 80%, 68%, ${0.76 + shimmerPulse * 0.14})`);
  bodyGrad.addColorStop(1, `hsla(${bodyHueLow + 14}, 75%, 58%, 0.8)`);

  ctx.fillStyle = bodyGrad;
  traceFishBodyPath(ctx, bodyUndulate, bodyBreath, flowBend);
  ctx.fill();


  if (wingPresence < 0.18) {
    drawClassicFishFins(ctx, finFlap, bodyHueMid);
  } else {
    const wingDrift = Math.sin(swimT * (3.8 + audioInfluence * 2.2)) * (1 + finMorph * 1.9 + Math.abs(flowBend) * 0.8);
    const wingAlpha = 0.38 + wingPresence * 0.62;

    drawAudioWings(ctx, {
      finFlap,
      finMorph,
      wingDrift,
      wingAlpha,
      bubbleAudioInfluence: audioInfluence,
    });
  }

  drawTail(ctx, {
    wag,
    bodyHueTop,
    bodyHueMid,
    bodyHueLow,
    flow: glide + finMorph,
    bend: flowBend,
  });

  ctx.shadowBlur = 0;

  drawBioluminescentSpots(ctx, swimT);
  drawSideEyes(ctx);

  ctx.globalAlpha = 1;
  ctx.restore();
}
