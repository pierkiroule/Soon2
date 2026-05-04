import { create } from "zustand";
import { defaultPack } from "../data/defaultPack.js";
import { clearState, loadState, saveState } from "../core/storage.js";
import { clampToCircle, makeId } from "../core/geometry.js";
import {
  createDefaultTraceCircuit,
  createSlalomCircuitFromBubbles,
  getCircuitSpeedValue,
  smoothLoopPoint,
} from "../core/traceCircuit.js";

const saved = loadState();

const DEFAULT_ARENA_RADIUS = 1200;

const defaultFish = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  targetX: 0,
  targetY: -120,
  angle: -Math.PI / 2,
  swimPhase: 0,
  maxTrail: 90,
  maxSpeed: 3.1,
  depth: 1,
  mouthPull: 0,
  turnAmount: 0,
};

const initialState = {
  mode: ["intro", "compo", "reso"].includes(saved?.mode) ? saved.mode : "compo",
  bubbles: defaultPack.bubbles.map((bubble) => ({ ...bubble })),
  fish: {
    ...defaultFish,
    ...(saved?.fish || {}),
  },
  selectedBubbleId: null,
  selectedFish: false,
  traceCircuit: saved?.traceCircuit || createSlalomCircuitFromBubbles(saved?.bubbles || defaultPack.bubbles),
  selectedBeaconId: null,
  circuitAutopilot: false,
  circuitSegmentIndex: 0,
  circuitSegmentT: 0,
  path: saved?.path || [],
  eyesClosed: false,
};

function lerpAngle(current, target, amount) {
  let diff = target - current;

  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  return current + diff * amount;
}

export const useSoonStore = create((set, get) => ({
  ...initialState,

  setMode: (mode) => {
    set({
      mode,
      eyesClosed: false,
      selectedBubbleId: null,
  selectedFish: false,
      selectedBeaconId: null,
      circuitAutopilot: get().circuitAutopilot,
    });

    saveState(get());
  },

  setFishTarget: (x, y) => {
    const state = get();

    if (state.circuitAutopilot) return;

    const safe = clampToCircle({ x, y }, DEFAULT_ARENA_RADIUS * 1.7);

    set((state) => ({
      fish: {
        ...state.fish,
        targetX: safe.x,
        targetY: safe.y,
      },
    }));
  },

  tickFish: () => {
    set((state) => {
      let targetX = state.fish.targetX;
      let targetY = state.fish.targetY;
      let fishDepth = state.fish.depth || 1;
      let circuitSegmentIndex = state.circuitSegmentIndex || 0;
      let circuitSegmentT = state.circuitSegmentT || 0;
      const circuitAutopilot = Boolean(state.circuitAutopilot);

      if (circuitAutopilot && state.traceCircuit?.length > 1) {
        const currentBeacon =
          state.traceCircuit[circuitSegmentIndex % state.traceCircuit.length];

        const speedStep = getCircuitSpeedValue(currentBeacon?.speed || 2);

        circuitSegmentT += speedStep;

        while (circuitSegmentT >= 1) {
          circuitSegmentT -= 1;
          circuitSegmentIndex =
            (circuitSegmentIndex + 1) % state.traceCircuit.length;
        }

        const circuitPoint = smoothLoopPoint(
          state.traceCircuit,
          circuitSegmentIndex,
          circuitSegmentT
        );

        targetX = circuitPoint.x;
        targetY = circuitPoint.y;
        fishDepth = circuitPoint.depth || fishDepth;
      }

      const currentAngle = Number.isFinite(state.fish.angle)
        ? state.fish.angle
        : -Math.PI / 2;

      // Point de bouche : le doigt tire le poisson par l'avant.
      const mouthDistance = 46;
      const mouthX = state.fish.x + Math.cos(currentAngle) * mouthDistance;
      const mouthY = state.fish.y + Math.sin(currentAngle) * mouthDistance;

      const pullX = targetX - mouthX;
      const pullY = targetY - mouthY;
      const pullDistance = Math.hypot(pullX, pullY);

      // Traction progressive : douce près du doigt, plus nette si le doigt s'éloigne.
      const pullNorm = Math.min(1, pullDistance / 320);
      const pullForce = circuitAutopilot
        ? 0.035 + pullNorm * 0.018
        : 0.028 + pullNorm * 0.022;

      const desiredVx = pullX * pullForce;
      const desiredVy = pullY * pullForce;

      // Le corps suit la bouche : interpolation fluide de la vitesse.
      const fluidity = circuitAutopilot ? 0.11 : 0.14;

      const vx = state.fish.vx + (desiredVx - state.fish.vx) * fluidity;
      const vy = state.fish.vy + (desiredVy - state.fish.vy) * fluidity;

      const safe = clampToCircle(
        {
          x: state.fish.x + vx,
          y: state.fish.y + vy,
        },
        DEFAULT_ARENA_RADIUS * 1.7
      );

      const speed = Math.hypot(vx, vy);

      // Orientation : le poisson suit la courbe du mouvement.
      const moveAngle = speed > 0.035 ? Math.atan2(vy, vx) : currentAngle;

      let angleDiff = moveAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const turnStrength = Math.min(1, Math.abs(angleDiff) / 1.2);

      const angle =
        speed > 0.035
          ? lerpAngle(
              currentAngle,
              moveAngle,
              0.055 + Math.min(0.055, speed * 0.006)
            )
          : currentAngle;

      const mouthPull = state.fish.mouthPull || 0;
      const nextMouthPull = mouthPull + (pullNorm - mouthPull) * 0.12;

      const turnAmount = state.fish.turnAmount || 0;
      const nextTurnAmount = turnAmount + (turnStrength - turnAmount) * 0.1;

      const swimPhase =
        (state.fish.swimPhase || 0) +
        0.045 +
        Math.min(0.16, speed * 0.011) +
        nextTurnAmount * 0.025;

      return {
        circuitAutopilot,
        circuitSegmentIndex,
        circuitSegmentT,
        fish: {
          ...state.fish,
          x: safe.x,
          y: safe.y,
          vx,
          vy,
          targetX,
          targetY,
          angle,
          swimPhase,
          depth: fishDepth,
          mouthPull: nextMouthPull,
          turnAmount: nextTurnAmount,
          maxSpeed: state.fish.maxSpeed || 3.1,
        },
      };
    });
  },

  selectBubble: (id) => {
    set({
      selectedBubbleId: id,
      selectedBeaconId: null,
    });
  },

  selectBeacon: (id) => {
    set({
      selectedBeaconId: id,
      selectedBubbleId: null,
  selectedFish: false,
    });
  },

  moveBeacon: (id, x, y) => {
    const safe = clampToCircle({ x, y }, DEFAULT_ARENA_RADIUS * 1.55);

    set((state) => ({
      traceCircuit: state.traceCircuit.map((beacon) =>
        beacon.id === id
          ? {
              ...beacon,
              x: safe.x,
              y: safe.y,
            }
          : beacon
      ),
    }));

    saveState(get());
  },

  updateBeacon: (id, patch) => {
    set((state) => ({
      traceCircuit: state.traceCircuit.map((beacon) =>
        beacon.id === id ? { ...beacon, ...patch } : beacon
      ),
    }));

    saveState(get());
  },

  autoGenerateTraceCircuit: () => {
    set((state) => ({
      traceCircuit: createSlalomCircuitFromBubbles(state.bubbles),
      selectedBeaconId: null,
      circuitAutopilot: false,
      circuitSegmentIndex: 0,
      circuitSegmentT: 0,
    }));

    saveState(get());
  },

  resetTraceCircuit: () => {
    set((state) => ({
      traceCircuit: createSlalomCircuitFromBubbles(state.bubbles),
      selectedBeaconId: null,
      circuitAutopilot: false,
      circuitSegmentIndex: 0,
      circuitSegmentT: 0,
    }));

    saveState(get());
  },

  startCircuitAutopilot: () => {
    const state = get();

    let circuit = Array.isArray(state.traceCircuit) ? state.traceCircuit : [];

    if (circuit.length < 2) {
      circuit = createSlalomCircuitFromBubbles(state.bubbles || []);
    }

    if (!circuit || circuit.length < 2) {
      circuit = createDefaultTraceCircuit();
    }

    if (!circuit || circuit.length < 2) return;

    const first = circuit[0];

    set((state) => ({
      mode: "reso",
      traceCircuit: circuit,
      circuitAutopilot: true,
      circuitSegmentIndex: 0,
      circuitSegmentT: 0,
      selectedBubbleId: null,
  selectedFish: false,
      fish: {
        ...state.fish,
        targetX: first.x,
        targetY: first.y,
        depth: first.depth || 1,
      },
    }));

    saveState(get());
  },

  stopCircuitAutopilot: () => {
    set({
      circuitAutopilot: false,
    });
  },

  addBubble: (x, y) => {
    const safe = clampToCircle({ x, y }, DEFAULT_ARENA_RADIUS * 1.6);

    const bubble = {
      id: makeId("bubble"),
      label: "Nouvelle bulle",
      x: safe.x,
      y: safe.y,
      r: 72,
      hue: Math.floor(160 + Math.random() * 160),
      depth: 1,
      sampleId: "tone-water",
    };

    set((state) => ({
      bubbles: defaultPack.bubbles.map((bubble) => ({ ...bubble })),
      selectedBubbleId: bubble.id,
      selectedBeaconId: null,
    }));

    saveState(get());
  },

  updateBubble: (id, patch) => {
    set((state) => ({
      bubbles: state.bubbles.map((bubble) => {
        if (bubble.id !== id) return bubble;

        const next = { ...bubble, ...patch };

        if ("x" in patch || "y" in patch) {
          const safe = clampToCircle(
            {
              x: next.x,
              y: next.y,
            },
            DEFAULT_ARENA_RADIUS * 1.6
          );

          next.x = safe.x;
          next.y = safe.y;
        }

        return next;
      }),
    }));

    saveState(get());
  },

  deleteBubble: (id) => {
    set((state) => ({
      bubbles: state.bubbles.filter((bubble) => bubble.id !== id),
      selectedBubbleId:
        state.selectedBubbleId === id ? null : state.selectedBubbleId,
    }));

    saveState(get());
  },

  addPathPoint: () => {},

  clearPath: () => {
    set({ path: [] });
    saveState(get());
  },

  importSoonData: (data) => {
    if (!data || !Array.isArray(data.bubbles)) return;

    set((state) => ({
      mode: data.mode || "compo",
      bubbles: data.bubbles,
      fish: {
        ...state.fish,
        ...(data.fish || {}),
        vx: 0,
        vy: 0,
        maxSpeed: state.fish.maxSpeed || 3.1,
      },
      traceCircuit: Array.isArray(data.traceCircuit)
        ? data.traceCircuit
        : state.traceCircuit,
      selectedBubbleId: null,
  selectedFish: false,
      selectedBeaconId: null,
      path: Array.isArray(data.path) ? data.path : [],
      eyesClosed: Boolean(data.eyesClosed),
    }));

    saveState(get());
  },

  reset: () => {
    clearState();

    set({
      mode: "compo",
      bubbles: defaultPack.bubbles,
      fish: { ...defaultFish },
      selectedBubbleId: null,
  selectedFish: false,
      traceCircuit: createDefaultTraceCircuit(),
      selectedBeaconId: null,
      circuitAutopilot: false,
      circuitSegmentIndex: 0,
      circuitSegmentT: 0,
      path: [],
      eyesClosed: false,
    });
  },
}));
