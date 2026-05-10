import { useEffect, useRef } from "react";
import {
  clampToCircle,
  distance,
  screenToWorld,
} from "../core/geometry.js";
import {
  playBubbleSound,
  stopBubbleSound,
  updateAmbientMix,
  updateAudioListener,
  updateBubbleAudioPosition,
} from "../core/audioEngine.js";
import { drawPoissonPlume } from "../core/poissonPlumeRenderer.js";
import {
  drawFireflies,
  drawPlacedTriangles,
  drawPlumeTrail,
  drawResonanceBubbles,
  updateFireflyGame,
} from "../core/fireflyGame.js";
import {
  drawEcosystemBackground,
  drawEcosystemWorld,
  updateEcosystemFx,
} from "../core/ecosystemFx.js";
import { sampleSmoothCircuit } from "../core/traceCircuit.js";
import { drawFishFx, updateFishFx } from "../core/fishFxEngine.js";
import { drawResonantFPV } from "../core/resonantFpvRenderer.js";

export default function SoonCanvas({
  mode,
  bubbles,
  fish,
  selectedBubbleId,
  traceCircuit,
  selectedBeaconId,
  circuitAutopilot,
  path,
  eyesClosed,
  viewZoom,
  visualLight,
  depth,
  fpvMode,
  onFishTarget,
  onTickFish,
  onSelectBubble,
  onSelectFish,
  onUpdateFishDepth,
  onSelectBeacon,
  onMoveBeacon,
  onMoveBubble,
  onAddBubble,
  onAddPathPoint,
}) {
  const canvasRef = useRef(null);

  const cameraRef = useRef({
    x: 0,
    y: 0,
    zoom: 1,
  });

  const arenaRef = useRef({
    radius: 1200,
  });

  const pointerRef = useRef({
    down: false,
    pointerId: null,
    dragBubbleId: null,
    lastTapAt: 0,
    lastTapPos: null,
    fishLongPressTimer: null,
    fishLongPressTriggered: false,
  });

  const stateRef = useRef({
    mode,
    bubbles,
    fish,
    selectedBubbleId,
    traceCircuit,
    selectedBeaconId,
    circuitAutopilot,
    path,
    eyesClosed,
  viewZoom,
  visualLight,
  depth,
  });

  useEffect(() => {
    stateRef.current = {
      mode,
      bubbles,
      fish,
      selectedBubbleId,
      traceCircuit,
      selectedBeaconId,
      circuitAutopilot,
      path,
      eyesClosed,
      viewZoom,
      visualLight,
      depth,
      fpvMode,
    };
  }, [mode, bubbles, fish, selectedBubbleId, path, eyesClosed, viewZoom, visualLight, depth, fpvMode]);

  useEffect(() => {
    let frame = 0;

    function loop() {
      const canvas = canvasRef.current;

      if (!canvas) {
        frame = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext("2d");
      const rect = resizeCanvas(canvas, ctx);

      updateArena(rect);
      followFishCamera(rect);

      onTickFish();

      const current = stateRef.current;

      updateAmbientMix(current.bubbles, current.fish);
      // updateFishFx(current.fish); // debug: FX désactivés
      updateFireflyGame({
        fish: current.fish,
        mode: current.mode,
        bubbles: current.bubbles,
      });

      updateBubbleAudioTriggers(current);

      draw(ctx, rect, performance.now());

      frame = requestAnimationFrame(loop);
    }

    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, [onTickFish]);

  function updateArena(rect) {
    const maxScreen = Math.max(rect.width, rect.height);
    arenaRef.current.radius = maxScreen * 1.5;
  }

  function followFishCamera(rect) {
    const camera = cameraRef.current;
    const currentFish = stateRef.current.fish;
    const arenaRadius = arenaRef.current.radius;

    const speed = Math.hypot(currentFish.vx || 0, currentFish.vy || 0);
    const speedNorm = Math.min(1, speed / 18);
    const depth = Math.max(1, Math.min(3, Math.round(currentFish.depth || 1)));

    // La caméra regarde légèrement devant le poisson.
    // Plus il avance, plus la vue anticipe.
    const lookAhead = 90 + speedNorm * 180;
    const angle = Number.isFinite(currentFish.angle)
      ? currentFish.angle
      : Math.atan2(currentFish.vy || 0, currentFish.vx || 1);

    const targetRawX =
      currentFish.x + Math.cos(angle) * lookAhead * speedNorm;

    const targetRawY =
      currentFish.y + Math.sin(angle) * lookAhead * speedNorm;

    // Respiration organique très lente.
    const t = performance.now() * 0.001;
    const breath = Math.sin(t * 0.42) * 0.018;

    // Zoom dynamique :
    // - plus ouvert quand le poisson va vite
    // - un peu plus lointain en profondeur
    const depthZoom = depth === 1 ? 1 : depth === 2 ? 0.94 : 0.88;
    const speedZoom = 1 - speedNorm * 0.08;
    const targetZoom = depthZoom * speedZoom + breath;

    const marginX = rect.width * 0.42 / targetZoom;
    const marginY = rect.height * 0.42 / targetZoom;

    const maxCameraX = Math.max(0, arenaRadius - marginX);
    const maxCameraY = Math.max(0, arenaRadius - marginY);

    const targetX = Math.max(
      -maxCameraX,
      Math.min(maxCameraX, targetRawX)
    );

    const targetY = Math.max(
      -maxCameraY,
      Math.min(maxCameraY, targetRawY)
    );

    // Easing organique :
    // - stable à l'arrêt
    // - plus réactif en mouvement
    const positionEase = 0.035 + speedNorm * 0.045;
    const zoomEase = 0.025 + speedNorm * 0.025;

    camera.x += (targetX - camera.x) * positionEase;
    camera.y += (targetY - camera.y) * positionEase;
    camera.zoom += (targetZoom - camera.zoom) * zoomEase;
  }

  function getWorldFromEvent(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return screenToWorld({
      clientX: event.clientX,
      clientY: event.clientY,
      rect,
      camera: cameraRef.current,
    });
  }

  function getSafeWorldFromEvent(event) {
    const point = getWorldFromEvent(event);
    return clampToCircle(point, arenaRef.current.radius - 70);
  }

  function isFishHit(point, fish) {
  if (!fish) return false;
  return Math.hypot(point.x - fish.x, point.y - fish.y) < 54;
}

function findBubbleAt(point) {
    return [...stateRef.current.bubbles]
      .reverse()
      .find((bubble) => distance(bubble, point) <= bubble.r);
  }

  function findBeaconAt(point) {
    return [...(stateRef.current.traceCircuit || [])]
      .reverse()
      .find((beacon) => distance(beacon, point) <= 26);
  }

  function handlePointerDown(event) {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);

    const point = getSafeWorldFromEvent(event);
    const current = stateRef.current;
    const hit = findBubbleAt(point);
    const fishHit = isFishHit(point, current.fish);
    const beaconHit = current.mode === "reso" ? findBeaconAt(point) : null;

    pointerRef.current.down = true;
    pointerRef.current.pointerId = event.pointerId;
    pointerRef.current.dragBubbleId = null;
    pointerRef.current.dragBeaconId = null;
    pointerRef.current.fishLongPressTriggered = false;

    if (fishHit) {
      pointerRef.current.fishLongPressTimer = window.setTimeout(() => {
        pointerRef.current.fishLongPressTriggered = true;
        onSelectFish?.();
        const raw = window.prompt(
          "Profondeur du poisson (1: surface, 2: milieu, 3: profond)",
          String(current.fish?.depth || 1)
        );
        const nextDepth = Number(raw);
        if ([1, 2, 3].includes(nextDepth)) {
          onUpdateFishDepth?.(nextDepth);
        }
      }, 520);
    }

    if (beaconHit) {
      onSelectBeacon(beaconHit.id);
      pointerRef.current.dragBubbleId = null;
    pointerRef.current.dragBeaconId = null;
      pointerRef.current.dragBeaconId = beaconHit.id;
      return;
    }

    if (hit) {
      onSelectBubble(hit.id);
      playBubbleSound(hit, current.fish);

      if (current.mode === "compo") {
        pointerRef.current.dragBubbleId = hit.id;
      }

      return;
    }

    onSelectBubble(null);

    if (!current.circuitAutopilot) {
      onFishTarget(point.x, point.y);
    }

    if (current.mode === "reso") {
      onAddPathPoint(point);
    }

    const now = Date.now();
    const last = pointerRef.current.lastTapPos;

    const isDoubleTap =
      now - pointerRef.current.lastTapAt < 360 &&
      last &&
      Math.hypot(last.x - point.x, last.y - point.y) < 48;

    if (isDoubleTap && isFishHit(point, current.fish)) {
      onSelectFish?.();
      pointerRef.current.lastTapAt = now;
      pointerRef.current.lastTapPos = point;
      return;
    }

    if (isDoubleTap && current.mode === "compo") {
      onAddBubble(point.x, point.y);
    }

    pointerRef.current.lastTapAt = now;
    pointerRef.current.lastTapPos = point;
  }

  function handlePointerMove(event) {
    if (!pointerRef.current.down) return;
    if (pointerRef.current.fishLongPressTriggered) return;

    const point = getSafeWorldFromEvent(event);
    const current = stateRef.current;

    if (pointerRef.current.dragBeaconId) {
      onMoveBeacon(pointerRef.current.dragBeaconId, point.x, point.y);
      return;
    }

    if (pointerRef.current.dragBubbleId) {
      onMoveBubble(pointerRef.current.dragBubbleId, {
        x: point.x,
        y: point.y,
      });
      return;
    }

    onFishTarget(point.x, point.y);

    if (current.mode === "reso") {
      onAddPathPoint(point);
    }
  }

  function handlePointerUp(event) {
    if (pointerRef.current.fishLongPressTimer) {
      clearTimeout(pointerRef.current.fishLongPressTimer);
      pointerRef.current.fishLongPressTimer = null;
    }
    pointerRef.current.down = false;
    pointerRef.current.pointerId = null;
    pointerRef.current.dragBubbleId = null;
    pointerRef.current.dragBeaconId = null;

    try {
      canvasRef.current.releasePointerCapture(event.pointerId);
    } catch {}
  }

  function resizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    const width = Math.floor(rect.width * ratio);
    const height = Math.floor(rect.height * ratio);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    return rect;
  }

  function enterWorld(ctx, rect) {
    const camera = cameraRef.current;
    const currentFish = stateRef.current.fish;

    const speed = Math.hypot(currentFish.vx || 0, currentFish.vy || 0);
    const speedNorm = Math.min(1, speed / 18);
    const t = performance.now() * 0.001;

    // Micro-dérive organique, très légère.
    // Elle donne une sensation d'eau vivante.
    const driftX = Math.sin(t * 0.33) * 4 * (0.25 + speedNorm);
    const driftY = Math.cos(t * 0.27) * 4 * (0.25 + speedNorm);

    ctx.save();
    ctx.translate(rect.width / 2, rect.height / 2);
    ctx.scale(camera.zoom * (stateRef.current.viewZoom || 1), camera.zoom * (stateRef.current.viewZoom || 1));
    ctx.translate(-camera.x + driftX, -camera.y + driftY);
  }

  function exitWorld(ctx) {
    ctx.restore();
  }

  const activeBubbleAudioRef = {
    current: new Set(),
  };

  function updateBubbleAudioTriggers(current) {
    const fish = current.fish;
    const bubbles = current.bubbles || [];

    if (!fish || !bubbles.length) return;

    const activeNow = new Set();

    bubbles.forEach((bubble) => {
      const dx = (bubble.x || 0) - (fish.x || 0);
      const dy = (bubble.y || 0) - (fish.y || 0);
      const d = Math.hypot(dx, dy);

      const triggerRadius = (bubble.r || 70) + 85;
      const fishDepth = Math.max(1, Math.min(3, Math.round(fish.depth || 1)));
      const bubbleDepth = Math.max(1, Math.min(3, Math.round(bubble.depth || 1)));
      const isNear = d <= triggerRadius && fishDepth === bubbleDepth;
      const mouthX = (fish.x || 0) + Math.cos(fish.angle || 0) * 32;
      const mouthY = (fish.y || 0) + Math.sin(fish.angle || 0) * 32;
      const headToBubble = Math.hypot((bubble.x || 0) - mouthX, (bubble.y || 0) - mouthY);
      const collisionRadius = Math.max(18, (bubble.r || 70) * 0.42);
      const isHeadCollision = fishDepth === bubbleDepth && headToBubble <= collisionRadius;

      if (isHeadCollision) {
        const nx = ((bubble.x || 0) - mouthX) / Math.max(0.001, headToBubble || 1);
        const ny = ((bubble.y || 0) - mouthY) / Math.max(0.001, headToBubble || 1);
        const overlap = Math.max(0, collisionRadius - headToBubble);
        const fishSpeed = Math.hypot(fish.vx || 0, fish.vy || 0);
        const glidePush = 2.8 + Math.min(9, fishSpeed * 1.5);
        const separatePush = overlap + 1.2;
        const pushForce = Math.max(glidePush, separatePush);

        onMoveBubble?.(bubble.id, {
          // Anti-traversée : on remet la bulle devant la tête, puis on ajoute
          // un petit élan (comme un dauphin qui pousse un ballon).
          x: mouthX + nx * (collisionRadius + pushForce),
          y: mouthY + ny * (collisionRadius + pushForce),
        });
      }

      if (isNear) {
        activeNow.add(bubble.id);

        if (!activeBubbleAudioRef.current.has(bubble.id)) {
          playBubbleSound(bubble);
        }
      }
    });

    activeBubbleAudioRef.current.forEach((bubbleId) => {
      if (!activeNow.has(bubbleId)) {
        stopBubbleSound(bubbleId);
      }
    });

    activeBubbleAudioRef.current = activeNow;

    updateAmbientMix({
      near: activeNow.size > 0,
    });
  }

  function drawEyesClosedVeil(ctx, rect, time) {
    const t = time * 0.001;
    const breath = Math.sin(t * 0.7) * 0.5 + 0.5;

    ctx.save();

    // Baisse globale de luminosité.
    ctx.fillStyle = "rgba(2, 6, 23, 0.46)";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Brume centrale très douce, façon regard mi-clos.
    const mist = ctx.createRadialGradient(
      rect.width * 0.5,
      rect.height * 0.48,
      Math.min(rect.width, rect.height) * 0.08,
      rect.width * 0.5,
      rect.height * 0.5,
      Math.max(rect.width, rect.height) * 0.72
    );

    mist.addColorStop(0, `rgba(220, 235, 255, ${0.035 + breath * 0.025})`);
    mist.addColorStop(0.45, "rgba(80, 110, 160, 0.035)");
    mist.addColorStop(1, "rgba(2, 6, 23, 0.22)");

    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Faux flou : plusieurs voiles horizontaux très transparents.
    for (let i = 0; i < 5; i += 1) {
      const y = rect.height * (0.18 + i * 0.16) + Math.sin(t * 0.25 + i) * 14;

      const grad = ctx.createLinearGradient(0, y - 38, rect.width, y + 38);
      grad.addColorStop(0, "rgba(245, 250, 255, 0)");
      grad.addColorStop(0.5, `rgba(245, 250, 255, ${0.018 + breath * 0.01})`);
      grad.addColorStop(1, "rgba(245, 250, 255, 0)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 42, rect.width, 84);
    }

    // Vignette sombre.
    const vignette = ctx.createRadialGradient(
      rect.width * 0.5,
      rect.height * 0.5,
      Math.min(rect.width, rect.height) * 0.28,
      rect.width * 0.5,
      rect.height * 0.5,
      Math.max(rect.width, rect.height) * 0.78
    );

    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.65, "rgba(0,0,0,0.12)");
    vignette.addColorStop(1, "rgba(0,0,0,0.52)");

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.restore();
  }

  function draw(ctx, rect, time) {
    const current = stateRef.current;

    if (current.mode === "reso" && current.fpvMode) {
      drawResonantFPV(ctx, rect, current, time);
      drawHud(ctx, rect, current);
      return;
    }

    drawOcean(ctx, rect, time); // diagnostic fond simple
    drawDepthVeil(ctx, rect, current.fish);

    enterWorld(ctx, rect);

    drawArenaBoundary(ctx, time);
    drawEcosystemWorld(ctx, current, time);
    drawWorldParticles(ctx, time);

    if (!current.eyesClosed) {
      if (current.mode === "reso") {
        drawTraceCircuit(ctx, current.traceCircuit, current.selectedBeaconId, time, current.mode);
      }

      drawBubbles(ctx, current.bubbles, current.selectedBubbleId, time);
    } else {
      drawEyesClosedEchoes(ctx, current.bubbles, current.fish, time);
    }

    try {
      // drawFishFx(ctx); // debug: FX désactivés
    } catch (error) {
      console.warn("[Soon] fish FX skipped", error);
    }

    drawPlacedTriangles(ctx, time);
    drawFireflies(ctx, time);
    drawPlumeTrail(ctx);
    drawResonanceBubbles(ctx, time);
    drawFish(ctx, current.fish, time);

    exitWorld(ctx);

    if (current.eyesClosed) {
      drawEyesClosedVeil(ctx, rect, time);
    }

    drawCameraVignette(ctx, rect, current.fish, time);
    drawHud(ctx, rect, current);
  }

  function drawOcean(ctx, rect, time) {
    const gradient = ctx.createRadialGradient(
      rect.width * 0.5,
      rect.height * 0.42,
      40,
      rect.width * 0.5,
      rect.height * 0.5,
      Math.max(rect.width, rect.height)
    );

    gradient.addColorStop(0, "rgba(34, 211, 238, 0.2)");
    gradient.addColorStop(0.46, "rgba(15, 23, 42, 0.98)");
    gradient.addColorStop(1, "rgba(2, 6, 23, 1)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (stateRef.current.eyesClosed) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    ctx.save();
    ctx.globalAlpha = stateRef.current.eyesClosed ? 0.18 : 0.42;

    for (let i = 0; i < 36; i += 1) {
      const x = ((i * 113 + time * 0.012) % (rect.width + 120)) - 60;
      const y = ((i * 79 + time * 0.006) % (rect.height + 120)) - 60;

      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 4), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(186, 230, 253, 0.22)";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawDepthVeil(ctx, rect, fish) {
    return;
  }

  function drawArenaBoundary(ctx, time) {
    const radius = arenaRef.current.radius;

    ctx.save();

    const pulse = Math.sin(time * 0.0012) * 8;

    ctx.beginPath();
    ctx.arc(0, 0, radius + pulse, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(125, 211, 252, 0.32)";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius - 32 + pulse * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const halo = ctx.createRadialGradient(0, 0, radius * 0.72, 0, 0, radius);
    halo.addColorStop(0, "rgba(0,0,0,0)");
    halo.addColorStop(1, "rgba(14,165,233,0.12)");

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    ctx.restore();
  }

  function drawWorldParticles(ctx, time) {
    const radius = arenaRef.current.radius;

    ctx.save();

    for (let i = 0; i < 26; i += 1) {
      const seed = i * 928.2;
      const a = seed + time * 0.00008 * (1 + (i % 5));
      const r = ((i * 137) % Math.floor(radius * 0.92)) + 40;

      const x = Math.cos(a) * r;
      const y = Math.sin(a * 1.11) * r;

      ctx.beginPath();
      ctx.arc(x, y, 1.1 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(165, 243, 252, ${0.08 + (i % 4) * 0.018})`;
      ctx.fill();
    }

    ctx.restore();
  }

  function drawTraceCircuit(ctx, circuit, selectedBeaconId, time) {
    if (!circuit || circuit.length < 2) return;

    const sampled = sampleSmoothCircuit(circuit, 20);

    ctx.save();

    ctx.beginPath();

    sampled.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });

    ctx.closePath();
    ctx.strokeStyle = "rgba(186, 230, 253, 0.38)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    circuit.forEach((beacon, index) => {
      const selected = beacon.id === selectedBeaconId;
      const pulse = Math.sin(time * 0.004 + index) * 3;
      const hue = beacon.depth === 1 ? 190 : beacon.depth === 2 ? 250 : 145;
      const radius = selected ? 19 + pulse : 15 + pulse * 0.4;
      const depthLabel = beacon.depth === 1 ? "surface" : beacon.depth === 2 ? "milieu" : "fond";

      ctx.beginPath();
      ctx.arc(beacon.x, beacon.y, radius + 9, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 95%, 68%, ${selected ? 0.24 : 0.14})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(beacon.x, beacon.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 95%, 68%, ${selected ? 0.82 : 0.62})`;
      ctx.fill();

      ctx.strokeStyle = selected
        ? "rgba(255,255,255,0.95)"
        : "rgba(255,255,255,0.32)";
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();

      ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
      ctx.font = "800 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(beacon.depth), beacon.x, beacon.y);

      ctx.fillStyle = "rgba(226, 232, 240, 0.78)";
      ctx.font = "700 10px system-ui";
      ctx.fillText(`v${beacon.speed}`, beacon.x, beacon.y + 28);

      if (selected) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.72)";
        ctx.font = "700 10px system-ui";
        ctx.fillText(depthLabel, beacon.x, beacon.y - 30);
      }
    });

    ctx.restore();
  }

  function drawPath(ctx, path) {
    if (path.length < 2) return;

    ctx.save();

    ctx.beginPath();

    path.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });

    ctx.strokeStyle = "rgba(186, 230, 253, 0.62)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    path.forEach((point, index) => {
      if (index % 8 !== 0) return;

      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(224, 242, 254, 0.72)";
      ctx.fill();
    });

    ctx.restore();
  }

  function drawBubbles(ctx, bubbles, selectedBubbleId, time) {
    ctx.save();

    bubbles.forEach((bubble) => {
      const selected = bubble.id === selectedBubbleId;
      const pulse = Math.sin(time * 0.003 + bubble.x * 0.01) * 5;
      const depth = Math.max(1, Math.min(3, Math.round(bubble.depth || 1)));
      const depthScale = depth === 1 ? 1 : depth === 2 ? 0.86 : 0.72;
      const radius = bubble.r * depthScale;
      const alpha = depth === 1 ? 0.56 : depth === 2 ? 0.42 : 0.3;
      const blur = depth === 1 ? 0 : depth === 2 ? 3 : 7;
      const lightness = depth === 1 ? 66 : depth === 2 ? 54 : 42;

      const glow = ctx.createRadialGradient(
        bubble.x,
        bubble.y,
        radius * 0.2,
        bubble.x,
        bubble.y,
        radius * 1.7
      );

      glow.addColorStop(0, `hsla(${bubble.hue}, 100%, ${lightness + 8}%, ${alpha})`);
      glow.addColorStop(1, `hsla(${bubble.hue}, 100%, ${lightness - 8}%, 0)`);

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, radius * 1.7 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, radius + pulse, 0, Math.PI * 2);
      ctx.filter = `blur(${blur}px)`;
      ctx.fillStyle = `hsla(${bubble.hue}, 90%, ${lightness}%, ${alpha})`;
      ctx.fill();
      ctx.filter = "none";

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, radius + 12 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = selected
        ? "rgba(255,255,255,0.95)"
        : `hsla(${bubble.hue}, 100%, 78%, 0.35)`;
      ctx.lineWidth = selected ? 5 : 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(3, 7, 18, 0.76)";
      ctx.font = "700 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bubble.label, bubble.x, bubble.y);

      drawNestedDepositFigure(ctx, bubble, radius, time);
    });

    ctx.restore();
  }

  function drawEyesClosedEchoes(ctx, bubbles, fish, time) {
    ctx.save();

    bubbles.forEach((bubble) => {
      const d = distance(bubble, fish);
      const strength = Math.max(0, 1 - d / 680);

      if (strength <= 0.015) return;

      const pulse = Math.sin(time * 0.004 + bubble.x * 0.01) * 10;
      const radius = bubble.r * (0.8 + strength * 1.4) + pulse;

      const glow = ctx.createRadialGradient(
        bubble.x,
        bubble.y,
        radius * 0.1,
        bubble.x,
        bubble.y,
        radius * 2.3
      );

      glow.addColorStop(
        0,
        `hsla(${bubble.hue}, 100%, 76%, ${0.05 + strength * 0.24})`
      );
      glow.addColorStop(
        0.45,
        `hsla(${bubble.hue}, 100%, 62%, ${0.03 + strength * 0.14})`
      );
      glow.addColorStop(1, `hsla(${bubble.hue}, 100%, 50%, 0)`);

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, radius * 2.3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${bubble.hue}, 100%, 82%, ${0.06 + strength * 0.34})`;
      ctx.lineWidth = 1.5 + strength * 4;
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawNestedDepositFigure(ctx, bubble, radius, deposits, time) {
    if (!deposits.length) return;

    const hasMorphose = deposits.some((item) => item.typeId === "morphose");
    const hasOntose = deposits.some((item) => item.typeId === "ontose");
    const hasSemiose = deposits.some((item) => item.typeId === "semiose");

    const pulse = Math.sin(time * 0.004 + bubble.x * 0.01) * 0.5 + 0.5;
    const cx = bubble.x;
    const cy = bubble.y;

    const base = Math.max(16, radius * 0.34);
    const alpha = 0.46 + pulse * 0.12;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Morphose : cercle extérieur
    if (hasMorphose) {
      ctx.beginPath();
      ctx.arc(cx, cy, base, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(326, 54%, 78%, ${alpha})`;
      ctx.lineWidth = 1.35;
      ctx.stroke();
    }

    // Ontose : carré intérieur
    if (hasOntose) {
      const s = base * 1.1;
      ctx.beginPath();
      ctx.rect(cx - s * 0.5, cy - s * 0.5, s, s);
      ctx.strokeStyle = `hsla(205, 48%, 78%, ${alpha})`;
      ctx.lineWidth = 1.35;
      ctx.stroke();
    }

    // Sémiose : triangle au centre
    if (hasSemiose) {
      const t = base * 0.72;
      ctx.beginPath();
      ctx.moveTo(cx, cy - t * 0.58);
      ctx.lineTo(cx + t * 0.56, cy + t * 0.42);
      ctx.lineTo(cx - t * 0.56, cy + t * 0.42);
      ctx.closePath();
      ctx.strokeStyle = `hsla(48, 58%, 78%, ${alpha})`;
      ctx.lineWidth = 1.35;
      ctx.stroke();
    }

    // Quand les 3 sont présents : activation subtile
    if (hasMorphose && hasOntose && hasSemiose) {
      ctx.beginPath();
      ctx.arc(cx, cy, base + 5 + pulse * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 250, 255, ${0.12 + pulse * 0.08})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFish(ctx, fish, time) {
    ctx.save();

    try {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;

      drawPoissonPlume(ctx, fish, {
        time,
        audio: {
          bass: 0,
          mids: 0,
          highs: 0,
          energy: 0,
        },
        proximity: 0.9,
        audioInfluence: 0.8,
      });
    } catch (error) {
      console.warn("[Soon] poisson renderer failed", error);

      ctx.beginPath();
      ctx.arc(fish.x || 0, fish.y || 0, 30, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    } finally {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function drawCameraVignette(ctx, rect, fish, time) {
    const depth = Math.max(1, Math.min(3, Math.round(fish?.depth || 1)));
    const speed = Math.hypot(fish?.vx || 0, fish?.vy || 0);
    const speedNorm = Math.min(1, speed / 18);

    const alpha =
      depth === 1
        ? 0.16 + speedNorm * 0.03
        : depth === 2
          ? 0.24 + speedNorm * 0.04
          : 0.34 + speedNorm * 0.05;

    const gradient = ctx.createRadialGradient(
      rect.width * 0.5,
      rect.height * 0.48,
      Math.min(rect.width, rect.height) * 0.16,
      rect.width * 0.5,
      rect.height * 0.5,
      Math.max(rect.width, rect.height) * 0.72
    );

    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.68, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();
  }

  function drawHud(ctx, rect, current) {
    if (!current.eyesClosed) return;

    ctx.save();

    ctx.fillStyle = "rgba(226, 232, 240, 0.78)";
    ctx.font = "500 18px Georgia";
    ctx.textAlign = "center";

    ctx.fillText(
      "Réso•° · suis le circuit",
      rect.width / 2,
      rect.height / 2 + 98
    );

    ctx.restore();
  }

  return (
    <canvas
      ref={canvasRef}
      className="soon-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
