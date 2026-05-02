import { SAMPLE_LIBRARY } from './constants/sampleLibrary';
import { BUBBLE_COLORS, HALO_STYLE_LIBRARY } from './constants/uiConstants';
import { collectLegacyDomRefs } from './domRefs';
import { buildRoomUrl, extractRoomSlugFromUrl, generateRoomSlug, normalizeRoomSlug } from '../../arena/utils/roomLink.js';
import { createHostArena, joinRoomAsGuest } from '../../arena/services/arenaService.js';
import { getOrCreateGuestIdentity, getStoredGuestPseudo, saveGuestPseudo, normalizeGuestPseudo, validateGuestPseudo } from '../../arena/utils/guestIdentity.js';

export function initLegacyApp() {
  const experienceRoot = document.getElementById('experienceView');
  if (!experienceRoot) return;
  if (experienceRoot.dataset.legacyBooted === 'true') return;
  experienceRoot.dataset.legacyBooted = 'true';

          const {
            homeView, experienceModeView, experienceView, echoHypnoseView, profileView, bottomNav, bottomNavToggle,
            navHome, navSoon, navProfile, enterExperienceBtn, selectSoloModeBtn, selectMultiModeBtn, multiRoomComposer, createMultiRoomBtn, multiRoomLinkOutput, copyMultiRoomLinkBtn, toggleRoomAccessBtn, enterMultiRoomBtn, multiRoomAdminHint, heroVideo, heroVideoShell, heroPlayBtn,
            canvas, ctx, ui, helperTips, soonTutoLink, soonTutoModal, soonTutoCloseBtn,
            silenceDesYeuxOverlay, silenceDesYeuxTitle, silenceDesYeuxCountdown, silenceDesYeuxPoem,
            echoRecorderPanel, echoRecordToggleBtn, echoRecordTimer, echoRecordStatus, echoRecordDownloadLink,
            traceListeningBtn, traceCamControls, silenceDesYeuxPrompt, silenceSaveNoBtn, silenceSaveYesBtn,
            bubblePanel, cancelBtn, dropBtn, bubbleLayer, bubbleHaloStyle, sampleSelect, sampleHint,
            arenaTrianglePad, arenaTriangleStatus, bubblePropsPanel, propsBubbleName, propsSampleSelect,
            propsSizeRange, propsSizeVal, colorSwatches, propsLayerSelect, propsHaloStyleSelect,
            propsDeleteBtn, propsCloseBtn, supabaseUrlInput, supabaseKeyInput, supabaseSaveConfigBtn,
            supabaseTestBtn, supabaseFileInput, supabaseUploadBtn, supabaseProbeUrlInput, supabaseProbeBtn,
            supabaseStatus, supabaseUploadedLink, supabaseProbeStatus, authEmailInput, authPasswordInput,
            authCredentialsBlock, authSignInBtn, authSignUpBtn, authSignOutBtn, authStatus, authSessionInfo,
            createArenaBtn, inviteArenaBtn, joinArenaBtn, arenaInviteCodeInput, arenaSessionStatus,
            arenaInvitePreview, arenaInvitePreviewCode, arenaCopyInviteBtn, arenaShareInviteBtn, arenaGuestPanel, arenaGuestList,
            arenaSessionBadge, guestEntryModal, guestPseudoInput, guestPseudoError, guestEnterRoomBtn, arenaDebugLog, profileDisplayName, profileBioText, profileEditBtn,
            profileEditPanel, profileNameInput, profileBioInput, profileSaveBtn, profileCancelBtn,
            dbConnectionStatus, storeCatalog, sessionHistoryList, silenceSessionList,
          } = collectLegacyDomRefs();

          let selectedBubble = null;
          let bottomNavCollapsed = false;
          const BOTTOM_NAV_AUTO_COLLAPSE_DELAY_MS = 5000;
          let bottomNavAutoCollapseTimer = null;
          let isDraggingBubble = false;
          let lastBubbleTapTime = 0;
          let lastBubbleTapTarget = null;

          BUBBLE_COLORS.forEach((c, idx) => {
              const sw = document.createElement('button');
              sw.type = 'button';
              sw.className = 'color-swatch';
              sw.style.background = `hsl(${c.hue}, 78%, 60%)`;
              sw.dataset.idx = idx;
              sw.addEventListener('click', () => {
                  if (!selectedBubble) return;
                  selectedBubble.hue = c.hue;
                  pushBubblePatchToDb(selectedBubble, { hue: c.hue });
                  refreshSwatchSelection();
              });
              colorSwatches.appendChild(sw);
          });

          HALO_STYLE_LIBRARY.forEach((haloStyle) => {
              const creationOption = document.createElement('option');
              creationOption.value = haloStyle.id;
              creationOption.textContent = haloStyle.name;
              bubbleHaloStyle.appendChild(creationOption);

              const propsOption = document.createElement('option');
              propsOption.value = haloStyle.id;
              propsOption.textContent = haloStyle.name;
              propsHaloStyleSelect.appendChild(propsOption);
          });

          SAMPLE_LIBRARY.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s.id; opt.textContent = s.name;
              propsSampleSelect.appendChild(opt);
          });

          function refreshSwatchSelection() {
              colorSwatches.querySelectorAll('.color-swatch').forEach((sw, i) => {
                  sw.classList.toggle('selected', !!selectedBubble && BUBBLE_COLORS[i].hue === selectedBubble.hue);
              });
          }

          function openBubblePropsPanel(bubble) {
              selectedBubble = bubble;
              isTethered = false;
              if (bubble.hue === undefined) bubble.hue = 195;
              propsBubbleName.textContent = bubble.label || 'Bulle sonore';
              propsSampleSelect.value = bubble._sampleId || SAMPLE_LIBRARY[0].id;
              propsSizeRange.value = bubble.r;
              propsSizeVal.textContent = Math.round(bubble.r) + 'px';
              propsLayerSelect.value = bubble.layer;
              propsHaloStyleSelect.value = bubble.haloStyle || HALO_STYLE_LIBRARY[0].id;
              refreshSwatchSelection();
              bubblePropsPanel.classList.add('visible');
              ui.textContent = '⟡ Touche l’océan pour déplacer · Couleur + suppression disponibles dans le panneau';
          }

          function closeBubblePropsPanel() {
              bubblePropsPanel.classList.remove('visible');
              selectedBubble = null;
              isDraggingBubble = false;
              ui.textContent = '';
              rotateHelperTip();
          }

          function rebuildBubbleSound(bubble, sample) {
              if (bubble.sound) {
                  try { bubble.sound.source.stop(); } catch (_) {}
              }
              bubble.sound = createBinauralSound(sample);
              bubble.label = sample.name;
              bubble._sampleId = sample.id;
              bubble.lastImpactAt = 0;
              bubble.fishTouching = false;
              propsBubbleName.textContent = sample.name;
              bubble.currentVolume = 0;
              bubble.zoneMix = 0;
              bubble.resonance = 0;
          }

          propsSampleSelect.addEventListener('change', () => {
              if (!selectedBubble) return;
              const sample = SAMPLE_LIBRARY.find(s => s.id === propsSampleSelect.value);
              if (sample) {
                  rebuildBubbleSound(selectedBubble, sample);
                  pushBubblePatchToDb(selectedBubble, { sample_id: sample.id, label: sample.name });
              }
          });
          propsSizeRange.addEventListener('input', () => {
              if (!selectedBubble) return;
              selectedBubble.r = parseInt(propsSizeRange.value);
              propsSizeVal.textContent = propsSizeRange.value + 'px';
              pushBubblePatchToDb(selectedBubble, { radius: selectedBubble.r });
          });
          propsHaloStyleSelect.addEventListener('change', () => {
              if (!selectedBubble) return;
              selectedBubble.haloStyle = propsHaloStyleSelect.value;
              pushBubblePatchToDb(selectedBubble, { halo_style: selectedBubble.haloStyle });
          });
          propsLayerSelect.addEventListener('change', () => {
              if (!selectedBubble) return;
              const spatial = layerToSpatial(propsLayerSelect.value);
              selectedBubble.layer = propsLayerSelect.value;
              selectedBubble.depthOffset = spatial.depthOffset;
              pushBubblePatchToDb(selectedBubble, { layer: selectedBubble.layer });
          });
          propsDeleteBtn.addEventListener('click', async () => {
              if (!selectedBubble) return;
              const bubbleToDelete = selectedBubble;
              const wasDeleted = await deleteBubbleInDb(bubbleToDelete);
              if (wasDeleted) {
                  removeBubbleFromArenaById(bubbleToDelete.id);
              }
          });
          propsCloseBtn.addEventListener('click', closeBubblePropsPanel);

          let currentView = 'home';
          let w, h;
          let isTethered = false;
          let mouseWorld = { x: 0, y: 0 };
          let isTraceListeningMode = false;
          let isDrawingTraceRail = false;
          let isTraceRailAutopilot = false;
          let traceRailPath = [];
          let traceRailTargetIndex = 0;
          let traceRailDirection = 1;
          let traceExitConfirmUntil = 0;
          let isTraceCamControlGestureActive = false;
          const traceOverviewZoomMin = 0.06;
          const traceOverviewZoomMax = 1.3;
          const traceCameraControl = {
              panX: 0,
              panY: 0,
              zoomScale: 1,
              minZoomScale: 0.45,
              maxZoomScale: 4
          };
          const traceCamMenuDrag = {
              active: false,
              pointerId: null,
              startClientX: 0,
              startClientY: 0,
              startOffsetX: 0,
              startOffsetY: 0,
              offsetX: 0,
              offsetY: 0
          };
          let isInteractionPaused = false;
          let lastFishTap = { time: 0, x: 0, y: 0 };
          const FISH_LONG_PRESS_MS = 520;
          const FISH_LONG_PRESS_MOVE_TOLERANCE = 24;
          const FISH_INTERACTION_CAPSULE = {
              mouthY: -30,
              tailY: 30,
              radius: 52,
          };
          let fishLongPressTimer = null;
          let fishLongPressOrigin = null;
          let activeTouchId = null;
          let fishDepthLayer = 'front';
          let fishDepthToastText = '';
          let fishDepthToastUntil = 0;
          let selectedSampleId = SAMPLE_LIBRARY[0].id;
          let selectedHaloStyleId = HALO_STYLE_LIBRARY[0].id;
          let audioCtx = null;
          let masterGainNode = null;
          let masterDryGainNode = null;
          let masterWetGainNode = null;
          let masterDelayNode = null;
          let masterDelayFeedbackGainNode = null;
          let heroVideoAudioCtx = null;
          let heroVideoSourceNode = null;
          let heroVideoAnalyserNode = null;
          let heroHaloData = null;
          let heroHaloRAF = null;
          let heroHaloEnergy = 0;
          let helperTipIndex = 0;
          let sooncutBucketVocals = [];
          let activeArenaAudio = null;
          let routedMediaElementSources = new WeakMap();
          let routedMediaElementGainNodes = new WeakMap();
          let isStartingSoonTutoMusic = false;
          let soonTutoMusic = null;
          let soonTutoMusicFadeInterval = null;
          let echoDelayEffectUntil = 0;
          let echoDelayEffectStartedAt = 0;
          const SOON_TUTO_MUSIC_URL = 'https://qyffktrggapfzlmmlerq.supabase.co/storage/v1/object/public/Soonbucket/music/musicsoon.mp3';
          const RECORDER_MAX_SECONDS = 60;
          const RECORDER_MAX_MILLIS = RECORDER_MAX_SECONDS * 1000;
          const SILENCE_COUNTDOWN_VALUES = ['5', '4', '3', '2', '1', '0•°'];
          const SILENCE_COUNTDOWN_DURATIONS_MS = [2000, 4000, 6000, 8000, 10000];
          const SILENCE_POETIC_LINES = [
              'Respire… l’océan te regarde en silence.',
              'Laisse tes yeux se reposer au bord de la vague intérieure.',
              'Chaque battement de ton corps devient une écoute sensible.',
              'Le poisson s’illumine, l’arène s’efface, ton souffle s’ouvre.',
              'Tu entres dans le Silence des Yeux, en profondeur O•°.',
              '0•° … traverse maintenant.'
          ];
          const helperTipsPlaylist = [
              'Garde le doigt (ou clic) appuyé dans l’océan : le poisson suit ton mouvement.',
              'Une nouvelle luciole émerge toutes les 15 secondes dans le courant.',
              'Chaque luciole collectée lit son vocal : attends la fin pour en accrocher une autre.',
              'Le poisson peut porter jusqu’à 6 lucioles à la fois.',
              'Le poisson ne traverse jamais une bulle de son niveau courant : il la pousse.',
              'Traverse une bulle sonore d’un autre niveau pour y déposer automatiquement la luciole la plus ancienne.',
              'Chaque bulle sonore peut accueillir 3 lucioles qui se relient en triangle.'
          ];
          const helperTipsDualModeMessage = 'Silence des Yeux + Tracer l’écoute : les aides restent tamisées pour te guider sans casser l’immersion.';

          const ARENA_RADIUS = 2000;
          const ARENA_BORDER_WIDTH_BASE = 6;
          const ARENA_BORDER_WIDTH_BREATH = 1.2;
          const ARENA_BORDER_SCREEN_MIN = 3.5;
          const ARENA_BORDER_SCREEN_MAX = 8;
          const ARENA_HALO_INNER = 28;
          const ARENA_HALO_OUTER = 68;
          const ARENA_HALO_ALPHA = 0.2;
          const ARENA_INNER_RIM_WIDTH = 1.4;
          const ARENA_MEMBRANE_SEGMENTS_BASE = 96;
          const ARENA_MEMBRANE_SEGMENTS_MIN = 64;
          const ARENA_MEMBRANE_SEGMENTS_MAX = 128;
          const ARENA_MEMBRANE_STIFFNESS = 0.009;
          const ARENA_MEMBRANE_DAMPING = 0.045;
          const ARENA_MEMBRANE_NEIGHBOR_COUPLING = 0.14;
          const ARENA_MEMBRANE_MAX_DEFORMATION = 250;
          const ARENA_MEMBRANE_IMPACT_COOLDOWN_MS = 80;
          const ARENA_MEMBRANE_IMPACT_SPREAD = 6;
          const ARENA_MEMBRANE_IMPACT_FORCE = 44;
          const SOUND_HEAR_RADIUS = 460;
          const ARENA_TRIANGLE_COUNT = 12;
          const FIREFLY_TRAIL_ATTACH_RADIUS = 38;
          const FIREFLY_ATTACHED_SPACING_TARGETS = [0.46, 0.56, 0.66, 0.76, 0.86, 0.94];
          const FIREFLY_AUDIO_MIN_MS = 1500;
          const FIREFLY_AUDIO_MAX_MS = 3200;
          const FIREFLY_TAIL_MAX_ATTACHED = 6;
          const FIREFLY_REPULSE_COOLDOWN_MS = 900;
          const FIREFLY_RELEASE_INTERVAL_MS = 15000;
          const DEFAULT_SUPABASE_URL = 'https://qyffktrggapfzlmmlerq.supabase.co';
          const ENV_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
          const ENV_SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
          const SOONCUT_BUCKET_FOLDER = 'sooncut';
          const SOONCUT_TRIANGLE_SAMPLE_IDS = SAMPLE_LIBRARY.slice(0, ARENA_TRIANGLE_COUNT).map(sample => sample.id);
          const DEPTH_Z = 140;
          const BUBBLES = [];
          const WAKE_PARTICLES = [];
          const MAX_WAKE_PARTICLES = 26;
          const RIPPLE_RINGS = [];
          const MAX_RIPPLES = 18;
          const SURFACE_SPARKLES = [];
          const MAX_SURFACE_SPARKLES = 30;
          const RESONANCE_WAVES = [];
          const MAX_RESONANCE_WAVES = 14;
          const STARFISH_RESONANCE_WAVES = [];
          const MAX_STARFISH_RESONANCE_WAVES = 3;
          const BREATH_WAVES = [];
          const MAX_BREATH_WAVES = 9;
          const DRIFT_MOTES = [];
          const MAX_DRIFT_MOTES = 22;
          const MARINE_PARTICLES = [];
          const MAX_MARINE_PARTICLES = 42;
          const MARINE_PARTICLE_PARALLAX = 0.08;
          const DOLPHIN_FISH_COLLIDER_RADIUS = 24;
          const BUBBLE_PUSH_DAMPING = 0.92;
          const BUBBLE_PUSH_COUPLING = 0.34;
          const BUBBLE_TRAIL_MAX_POINTS = 10;
          const DOLPHIN_REBOUND_MULTIPLIER = 3;
          const DOLPHIN_DRAG_DAMPING_BOOST = 0.05;
          const DOLPHIN_TRAIL_BOOST = 1.45;
          const BUBBLE_DEFORM_RECOVERY = 0.86;
          const BUBBLE_RESTITUTION = 0.78;
          const FIREFLY_RESTITUTION = 0.72;
          const AUDIO_REACTIVITY = {
              bandSmoothing: 0.14,
              fishVelocityBoost: 0.22,
              fishGlowBoost: 0.35,
              fishFinBoost: 0.55,
              backgroundGlowBoost: 0.22,
              particleSpawnBase: 0.4,
              particleSpawnBoost: 1.5
          };
          const ARENA_FIREFLIES = [];
          const PLACED_FIREFLY_TRIANGLES = [];
          let hasReleasedInitialFireflies = false;
          let fireflyReleaseSequenceActive = false;
          let nextFireflyReleaseAt = 0;
          let fireflyVocalGateUntil = 0;
          let isFireflyVocalPlaying = false;
          let fireflyVocalQueue = Promise.resolve();
          const STARTING_BUBBLES = [
              { sampleId: 'drill-bubble', layer: 'front', hue: 188, haloStyle: 'aurora', x: -240, y: -120, r: 72 },
              { sampleId: 'scani-bubble', layer: 'below', hue: 235, haloStyle: 'pulse', x: 220, y: 170, r: 78 },
              { sampleId: 'tech-bubble', layer: 'above', hue: 318, haloStyle: 'stardust', x: 70, y: -255, r: 68 },
              { sampleId: 'sax-bubble', layer: 'front', hue: 42, haloStyle: 'pulse', x: 255, y: -95, r: 70 },
              { sampleId: 'baladhaikua-bubble', layer: 'above', hue: 148, haloStyle: 'aurora', x: -75, y: 245, r: 74 },
          ];
          let shipBreathEmitter = 0;
          let marineParticleEmitter = 0;
          let bubbleIdSeed = 1;
          let currentArenaId = 'default';
          let currentArenaInviteCode = '';
          let currentArenaParticipants = 1;
          let currentArenaRole = null;
          let isInviteGuestMode = false;
          let pendingMultiRoomInviteLink = '';
          let pendingMultiRoomArenaId = null;
          let isPendingMultiRoomClosed = false;
          let syncedArenaId = null;
          let arenaRealtimeChannel = null;
          let isApplyingRemoteArenaSyncEvent = false;
          let isHydratingArenaBubbles = false;
          const BUBBLE_UPDATE_THROTTLE_MS = 70;
          const bubbleUpdateThrottleTimers = new Map();
          const bubblePendingPatchById = new Map();
          const bubblePendingPatchArenaById = new Map();
          const bubbleLastKnownVersionById = new Map();
          const bubbleBufferedRemotePatchById = new Map();
          let supabaseClient = null;
          let supabaseClientSignature = '';
          let currentSession = null;
          let isAuthActionPending = false;
          let syncInFlightPromise = null;
          let soonbaseSchemaHealth = { checkedAt: 0, ok: false, missing: [], details: [] };
          let recordingState = 'idle';
          let recordingTimerInterval = null;
          let recordingAutoStopTimeout = null;
          let recordingStartedAt = 0;
          let recordingMediaDest = null;
          let recordingMediaRecorder = null;
          let recordingChunks = [];
          let recordingMimeType = '';
          let recordingFileExt = 'webm';
          let recordingDownloadUrl = null;
          let recordingFallbackNotice = '';
          let latestRecordingBlob = null;
          let latestRecordingMimeType = '';
          let silenceTransitionInProgress = false;
          let silenceImmersionLevel = 0;
          let silenceSessionSaved = false;
          const savedSilenceSessions = [];
          const SUPABASE_BUCKET = 'Soonbucket';
          const SUPABASE_LOCAL_KEYS = {
              url: 'soono.supabase.url',
              key: 'soono.supabase.key',
          };
          const PROFILE_LOCAL_KEY = 'soono.profile.identity';
          const ECHO_EXPERIENCES = [
              { id: 'echo-nuit-calmante', title: 'Écho Nuit Calmante', description: 'Session douce pour ralentir le mental.', priceLabel: '12,00 €', durationLabel: '25 min' },
              { id: 'echo-focus-profond', title: 'Écho Focus Profond', description: 'Immersion sonore pour concentration profonde.', priceLabel: '16,00 €', durationLabel: '35 min' },
              { id: 'echo-voyage-ocean', title: 'Écho Voyage Océan', description: 'Parcours méditatif inspiré des abysses.', priceLabel: '19,00 €', durationLabel: '45 min' },
          ];

          const arenaResonance = { level: 0, hue: 198 };
          const audioReactiveState = {
              bass: 0,
              mids: 0,
              highs: 0,
              energy: 0,
              wingPresence: 0
          };

          const ship = {
              x: 0, y: 0, vx: 0, vy: 0, angle: 0, trail: [], maxTrail: 128,
              stiffness: 0.0026, damping: 0.93, turnEase: 0.06, maxSpeed: 3.1,
              wakeEmitter: 0, rippleEmitter: 0
          };
          const companionStarfish = {
              x: -260,
              y: 180,
              vx: 0,
              vy: 0,
              targetVx: 0,
              targetVy: 0,
              driftChangeAt: 0,
              rotation: 0,
              rotationSpeed: 0,
              spinVelocity: 0,
              spinInitialVelocity: 0,
              isSpinning: false,
              waveTriggeredThisSpin: false,
              collisionCooldownUntil: 0
          };
          const ARENA_MEMBRANE_SEGMENTS = Array.from({ length: ARENA_MEMBRANE_SEGMENTS_BASE }, () => ({ offset: 0, velocity: 0 }));
          let arenaMembraneActiveSegments = ARENA_MEMBRANE_SEGMENTS_BASE;
          let lastArenaImpactAt = 0;
          let frameLastAt = performance.now();
          let fpsSmoothed = 60;
          let fpsSampleAt = frameLastAt;
          const camera = { x: 0, y: 0, targetX: 0, targetY: 0, ease: 0.05, zoom: 1, targetZoom: 1, zoomEase: 0.08 };

          function getVisibleGuestFish() {
              return BUBBLES
                  .filter((bubble) => bubble?.created_by && bubble.created_by !== currentSession?.user?.id)
                  .map((bubble) => {
                      const idLabel = bubble.playerNumber
                          ? `Joueur ${bubble.playerNumber}`
                          : (bubble.created_by || '').slice(0, 8);
                      const phaseSeed = Number((bubble.playerNumber || 1) * 0.6);
                      return {
                          id: idLabel,
                          x: Number.isFinite(bubble.x) ? bubble.x : 0,
                          y: Number.isFinite(bubble.y) ? bubble.y : 0,
                          angle: Math.sin(performance.now() * 0.0012 + phaseSeed) * 0.1,
                          scale: 0.5,
                          color: 'rgba(205, 239, 255, 0.86)',
                          opacity: 0.9,
                      };
                  });
          }

          function normalizeAngle(theta) {
              const tau = Math.PI * 2;
              let wrapped = theta % tau;
              if (wrapped < 0) wrapped += tau;
              return wrapped;
          }

          function sampleArenaOffset(theta) {
              const activeCount = Math.max(ARENA_MEMBRANE_SEGMENTS_MIN, Math.min(ARENA_MEMBRANE_SEGMENTS_MAX, arenaMembraneActiveSegments));
              const wrapped = normalizeAngle(theta);
              const scaled = (wrapped / (Math.PI * 2)) * activeCount;
              const i0 = Math.floor(scaled) % activeCount;
              const i1 = (i0 + 1) % activeCount;
              const t = scaled - Math.floor(scaled);
              const o0 = ARENA_MEMBRANE_SEGMENTS[i0]?.offset ?? 0;
              const o1 = ARENA_MEMBRANE_SEGMENTS[i1]?.offset ?? 0;
              return o0 + (o1 - o0) * t;
          }

          function sampleArenaRadius(theta) {
              return ARENA_RADIUS + sampleArenaOffset(theta);
          }

          function sampleArenaNormal(theta) {
              const epsilon = (Math.PI * 2) / Math.max(ARENA_MEMBRANE_SEGMENTS_MIN, arenaMembraneActiveSegments);
              const p0r = sampleArenaRadius(theta - epsilon);
              const p1r = sampleArenaRadius(theta + epsilon);
              const p0x = Math.cos(theta - epsilon) * p0r;
              const p0y = Math.sin(theta - epsilon) * p0r;
              const p1x = Math.cos(theta + epsilon) * p1r;
              const p1y = Math.sin(theta + epsilon) * p1r;
              const tx = p1x - p0x;
              const ty = p1y - p0y;
              let nx = ty;
              let ny = -tx;
              const nLen = Math.hypot(nx, ny) || 1;
              nx /= nLen;
              ny /= nLen;
              if ((nx * Math.cos(theta)) + (ny * Math.sin(theta)) < 0) {
                  nx *= -1;
                  ny *= -1;
              }
              return { x: nx, y: ny };
          }

          function isPointOnFishBody(point) {
              const dx = point.x - ship.x;
              const dy = point.y - ship.y;

              // Convert pointer world coordinates to fish-local coordinates so the hit area
              // follows fish orientation and stays aligned with the fish body axis.
              const cos = Math.cos(-(ship.angle + Math.PI / 2));
              const sin = Math.sin(-(ship.angle + Math.PI / 2));
              const localX = dx * cos - dy * sin;
              const localY = dx * sin + dy * cos;

              // Use an enlarged capsule from mouth to tail so long-press/double-tap are easy
              // anywhere across the fish body on touch devices.
              const segmentStartY = FISH_INTERACTION_CAPSULE.mouthY;
              const segmentEndY = FISH_INTERACTION_CAPSULE.tailY;
              const segmentLength = segmentEndY - segmentStartY;
              const projected = segmentLength === 0
                  ? 0
                  : Math.max(0, Math.min(1, (localY - segmentStartY) / segmentLength));
              const closestY = segmentStartY + projected * segmentLength;
              const distToAxis = Math.hypot(localX, localY - closestY);
              return distToAxis <= FISH_INTERACTION_CAPSULE.radius;
          }

          function isBubbleOnFishCurrentLevel(bubble) {
              return (bubble?.layer || 'front') === fishDepthLayer;
          }

          function getFishDepthOffset() {
              return layerToSpatial(fishDepthLayer).depthOffset;
          }

          function getFishDepthIndex(layer = fishDepthLayer) {
              if (layer === 'above') return 2;
              if (layer === 'below') return 3;
              return 1;
          }

          function showFishDepthSelectionMessage() {
              fishDepthToastText = `Profondeur ${getFishDepthIndex()}`;
              fishDepthToastUntil = performance.now() + 1500;
          }

          function cycleFishDepthLevel() {
              const depthCycle = ['front', 'above', 'below'];
              const currentIndex = depthCycle.indexOf(fishDepthLayer);
              const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % depthCycle.length;
              fishDepthLayer = depthCycle[nextIndex];
              showFishDepthSelectionMessage();
          }

          function resolveFishBubbleCollisions(isDolphinNavigationActive) {
              const shipSpeed = Math.hypot(ship.vx, ship.vy);
              const now = performance.now();
              BUBBLES.forEach((bubble) => {
                  if (!bubble) return;
                  if (!isDolphinNavigationActive && !isBubbleOnFishCurrentLevel(bubble)) return;
                  const dx = bubble.x - ship.x;
                  const dy = bubble.y - ship.y;
                  const dist = Math.hypot(dx, dy);
                  const minDist = DOLPHIN_FISH_COLLIDER_RADIUS + bubble.r;
                  if (dist >= minDist) return;
                  const nx = dist > 0.001 ? (dx / dist) : Math.cos(ship.angle - Math.PI / 2);
                  const ny = dist > 0.001 ? (dy / dist) : Math.sin(ship.angle - Math.PI / 2);
                  const overlap = minDist - dist;
                  bubble.x += nx * overlap * 0.9;
                  bubble.y += ny * overlap * 0.9;
                  ship.x -= nx * overlap * 0.1;
                  ship.y -= ny * overlap * 0.1;
                  const pushImpulse = (shipSpeed * BUBBLE_PUSH_COUPLING + overlap * 0.05) * DOLPHIN_REBOUND_MULTIPLIER;
                  bubble.vx = (bubble.vx || 0) + nx * pushImpulse + ship.vx * 0.08;
                  bubble.vy = (bubble.vy || 0) + ny * pushImpulse + ship.vy * 0.08;
                  const elasticKick = Math.min(1.9, overlap * 0.035 + shipSpeed * 0.11);
                  ship.vx -= nx * elasticKick * 0.28;
                  ship.vy -= ny * elasticKick * 0.28;
                  bubble.deformAmount = Math.max(bubble.deformAmount || 0, Math.min(0.38, 0.12 + pushImpulse * 0.035));
                  bubble.deformAngle = Math.atan2(ny, nx);
                  bubble.lastImpactAt = now;
              });
          }

          function updateBubbleKinetics(isDolphinNavigationActive) {
              BUBBLES.forEach((bubble) => {
                  if (!bubble) return;
                  if (isDraggingBubble && selectedBubble === bubble) {
                      bubble.vx = 0;
                      bubble.vy = 0;
                      return;
                  }
                  const damping = isDolphinNavigationActive
                      ? Math.min(0.985, BUBBLE_PUSH_DAMPING + DOLPHIN_DRAG_DAMPING_BOOST)
                      : BUBBLE_PUSH_DAMPING;
                  bubble.vx = (bubble.vx || 0) * damping;
                  bubble.vy = (bubble.vy || 0) * damping;
                  bubble.x += bubble.vx;
                  bubble.y += bubble.vy;
                  bubble.deformAmount = (bubble.deformAmount || 0) * BUBBLE_DEFORM_RECOVERY;
                  if ((bubble.deformAmount || 0) < 0.01) bubble.deformAmount = 0;
                  const bubbleSpeed = Math.hypot(bubble.vx, bubble.vy);
                  if (!Array.isArray(bubble.motionTrail)) bubble.motionTrail = [];
                  const trailBoost = isDolphinNavigationActive ? DOLPHIN_TRAIL_BOOST : 1;
                  if (bubbleSpeed > 0.06) {
                      bubble.motionTrail.push({
                          x: bubble.x,
                          y: bubble.y,
                          alpha: Math.min(1, (bubbleSpeed / 1.5) * trailBoost),
                          radius: bubble.r * (0.84 + Math.min(0.32, bubbleSpeed * 0.08 * trailBoost))
                      });
                  }
                  bubble.motionTrail.forEach((point) => {
                      point.alpha *= isDolphinNavigationActive ? 0.9 : 0.88;
                      point.radius *= isDolphinNavigationActive ? 0.99 : 0.985;
                  });
                  bubble.motionTrail = bubble.motionTrail
                      .filter((point) => point.alpha > 0.05)
                      .slice(-(isDolphinNavigationActive ? Math.round(BUBBLE_TRAIL_MAX_POINTS * 1.8) : BUBBLE_TRAIL_MAX_POINTS));
                  const theta = Math.atan2(bubble.y, bubble.x);
                  const bubbleDistance = Math.hypot(bubble.x, bubble.y);
                  const bubbleArenaRadius = sampleArenaRadius(theta) - bubble.r - 10;
                  if (bubbleDistance > bubbleArenaRadius) {
                      const boundaryNormal = sampleArenaNormal(theta);
                      const penetration = bubbleDistance - bubbleArenaRadius;
                      bubble.x -= boundaryNormal.x * penetration;
                      bubble.y -= boundaryNormal.y * penetration;
                      const outwardSpeed = bubble.vx * boundaryNormal.x + bubble.vy * boundaryNormal.y;
                      if (outwardSpeed > 0) {
                          bubble.vx -= boundaryNormal.x * outwardSpeed * 1.4;
                          bubble.vy -= boundaryNormal.y * outwardSpeed * 1.4;
                          bubble.deformAmount = Math.max(bubble.deformAmount || 0, Math.min(0.28, outwardSpeed * 0.08));
                          bubble.deformAngle = Math.atan2(boundaryNormal.y, boundaryNormal.x);
                      }
                  }
              });

              for (let i = 0; i < BUBBLES.length; i++) {
                  const a = BUBBLES[i];
                  if (!a) continue;
                  for (let j = i + 1; j < BUBBLES.length; j++) {
                      const b = BUBBLES[j];
                      if (!b) continue;
                      const dx = b.x - a.x;
                      const dy = b.y - a.y;
                      const dist = Math.hypot(dx, dy);
                      const minDist = a.r + b.r;
                      if (dist >= minDist || minDist <= 0) continue;
                      const nx = dist > 0.001 ? dx / dist : 1;
                      const ny = dist > 0.001 ? dy / dist : 0;
                      const overlap = minDist - dist;
                      const totalRadius = Math.max(1, a.r + b.r);
                      const aShare = b.r / totalRadius;
                      const bShare = a.r / totalRadius;
                      a.x -= nx * overlap * aShare;
                      a.y -= ny * overlap * aShare;
                      b.x += nx * overlap * bShare;
                      b.y += ny * overlap * bShare;

                      const avx = a.vx || 0;
                      const avy = a.vy || 0;
                      const bvx = b.vx || 0;
                      const bvy = b.vy || 0;
                      const relSpeed = (bvx - avx) * nx + (bvy - avy) * ny;
                      if (relSpeed > 0) continue;
                      const impulse = (-(1 + BUBBLE_RESTITUTION) * relSpeed) / 2;
                      a.vx = avx - impulse * nx;
                      a.vy = avy - impulse * ny;
                      b.vx = bvx + impulse * nx;
                      b.vy = bvy + impulse * ny;
                  }
              }
          }

          function resolveArenaFireflyCollisions() {
              const freeFireflies = ARENA_FIREFLIES.filter((firefly) => {
                  if (!firefly?.isReleased) return false;
                  if (firefly.attachedToTail) return false;
                  if (firefly.containedInBubbleId) return false;
                  if (firefly.placedTriangleId) return false;
                  return true;
              });
              for (let i = 0; i < freeFireflies.length; i++) {
                  const firefly = freeFireflies[i];
                  const fireflyRadius = Math.max(4, firefly.size * 0.95);
                  for (const bubble of BUBBLES) {
                      const dx = firefly.x - bubble.x;
                      const dy = firefly.y - bubble.y;
                      const dist = Math.hypot(dx, dy);
                      const minDist = bubble.r + fireflyRadius;
                      if (dist >= minDist) continue;
                      const nx = dist > 0.001 ? dx / dist : 1;
                      const ny = dist > 0.001 ? dy / dist : 0;
                      const overlap = minDist - dist;
                      firefly.x += nx * overlap;
                      firefly.y += ny * overlap;
                      const rel = firefly.vx * nx + firefly.vy * ny;
                      if (rel < 0) {
                          firefly.vx -= (1 + FIREFLY_RESTITUTION) * rel * nx;
                          firefly.vy -= (1 + FIREFLY_RESTITUTION) * rel * ny;
                      }
                      bubble.vx = (bubble.vx || 0) - nx * overlap * 0.012;
                      bubble.vy = (bubble.vy || 0) - ny * overlap * 0.012;
                  }
                  for (let j = i + 1; j < freeFireflies.length; j++) {
                      const other = freeFireflies[j];
                      const dx = other.x - firefly.x;
                      const dy = other.y - firefly.y;
                      const dist = Math.hypot(dx, dy);
                      const minDist = Math.max(4, firefly.size * 0.9) + Math.max(4, other.size * 0.9);
                      if (dist >= minDist) continue;
                      const nx = dist > 0.001 ? dx / dist : 1;
                      const ny = dist > 0.001 ? dy / dist : 0;
                      const overlap = minDist - dist;
                      firefly.x -= nx * overlap * 0.5;
                      firefly.y -= ny * overlap * 0.5;
                      other.x += nx * overlap * 0.5;
                      other.y += ny * overlap * 0.5;
                      const relSpeed = (other.vx - firefly.vx) * nx + (other.vy - firefly.vy) * ny;
                      if (relSpeed > 0) continue;
                      const impulse = (-(1 + FIREFLY_RESTITUTION) * relSpeed) / 2;
                      firefly.vx -= impulse * nx;
                      firefly.vy -= impulse * ny;
                      other.vx += impulse * nx;
                      other.vy += impulse * ny;
                  }
              }
          }

          function injectArenaMembraneImpact(theta, force = ARENA_MEMBRANE_IMPACT_FORCE) {
              const activeCount = Math.max(ARENA_MEMBRANE_SEGMENTS_MIN, Math.min(ARENA_MEMBRANE_SEGMENTS_MAX, arenaMembraneActiveSegments));
              const wrapped = normalizeAngle(theta);
              const centerIndex = Math.floor((wrapped / (Math.PI * 2)) * activeCount) % activeCount;
              for (let k = -ARENA_MEMBRANE_IMPACT_SPREAD; k <= ARENA_MEMBRANE_IMPACT_SPREAD; k++) {
                  const idx = (centerIndex + k + activeCount) % activeCount;
                  const weight = Math.max(0, 1 - Math.abs(k) / (ARENA_MEMBRANE_IMPACT_SPREAD + 0.001));
                  const segment = ARENA_MEMBRANE_SEGMENTS[idx];
                  if (!segment) continue;
                  const smoothImpulse = force * weight;
                  segment.velocity -= smoothImpulse * 0.065;
                  segment.offset -= smoothImpulse * 0.32;
                  if (segment.offset < -ARENA_MEMBRANE_MAX_DEFORMATION) segment.offset = -ARENA_MEMBRANE_MAX_DEFORMATION;
              }
          }

          function updateArenaMembraneDynamics() {
              const activeCount = Math.max(ARENA_MEMBRANE_SEGMENTS_MIN, Math.min(ARENA_MEMBRANE_SEGMENTS_MAX, arenaMembraneActiveSegments));
              const offsetSnapshot = new Array(activeCount);
              for (let i = 0; i < activeCount; i++) offsetSnapshot[i] = ARENA_MEMBRANE_SEGMENTS[i]?.offset ?? 0;
              for (let i = 0; i < activeCount; i++) {
                  const segment = ARENA_MEMBRANE_SEGMENTS[i];
                  if (!segment) continue;
                  const prev = offsetSnapshot[(i - 1 + activeCount) % activeCount];
                  const next = offsetSnapshot[(i + 1) % activeCount];
                  const neighborPull = (prev + next - offsetSnapshot[i] * 2) * ARENA_MEMBRANE_NEIGHBOR_COUPLING;
                  segment.velocity += (-segment.offset * ARENA_MEMBRANE_STIFFNESS - segment.velocity * ARENA_MEMBRANE_DAMPING) + neighborPull;
                  segment.offset += segment.velocity;
                  if (segment.offset > ARENA_MEMBRANE_MAX_DEFORMATION) {
                      segment.offset = ARENA_MEMBRANE_MAX_DEFORMATION;
                      segment.velocity *= 0.6;
                  } else if (segment.offset < -ARENA_MEMBRANE_MAX_DEFORMATION) {
                      segment.offset = -ARENA_MEMBRANE_MAX_DEFORMATION;
                      segment.velocity *= 0.6;
                  }
              }
          }

          function updateArenaMembranePerfBudget(now) {
              const dt = now - frameLastAt;
              frameLastAt = now;
              if (dt > 0 && dt < 1000) {
                  const instantFps = 1000 / dt;
                  fpsSmoothed += (instantFps - fpsSmoothed) * 0.08;
              }
              if (now - fpsSampleAt < 450) return;
              fpsSampleAt = now;
              if (fpsSmoothed < 45) {
                  arenaMembraneActiveSegments = ARENA_MEMBRANE_SEGMENTS_MIN;
              } else if (fpsSmoothed > 56) {
                  arenaMembraneActiveSegments = ARENA_MEMBRANE_SEGMENTS_BASE;
              }
          }

          function setActiveNav(target) {
              [navHome, navSoon, navProfile].forEach(btn => btn?.classList.remove('active'));
              if (target === 'home') navHome.classList.add('active');
              if (target === 'soon') navSoon.classList.add('active');
              if (target === 'profile') navProfile.classList.add('active');
          }

          function setBottomNavCollapsed(collapsed) {
              bottomNavCollapsed = Boolean(collapsed);
              bottomNav?.classList.toggle('is-collapsed', bottomNavCollapsed);
              document.body.classList.toggle('nav-collapsed', bottomNavCollapsed);
              if (bottomNavToggle) {
                  bottomNavToggle.setAttribute('aria-expanded', bottomNavCollapsed ? 'false' : 'true');
                  bottomNavToggle.setAttribute('aria-label', bottomNavCollapsed ? 'Déplier le menu' : 'Réduire le menu');
              }
              if (bottomNavCollapsed) clearBottomNavAutoCollapseTimer();
              else scheduleBottomNavAutoCollapse();
          }

          function clearBottomNavAutoCollapseTimer() {
              if (!bottomNavAutoCollapseTimer) return;
              clearTimeout(bottomNavAutoCollapseTimer);
              bottomNavAutoCollapseTimer = null;
          }

          function scheduleBottomNavAutoCollapse() {
              clearBottomNavAutoCollapseTimer();
              if (!bottomNav || bottomNavCollapsed || bottomNav.classList.contains('hidden-view')) return;
              bottomNavAutoCollapseTimer = window.setTimeout(() => {
                  setBottomNavCollapsed(true);
              }, BOTTOM_NAV_AUTO_COLLAPSE_DELAY_MS);
          }

          function registerBottomNavActivity() {
              if (bottomNavCollapsed) return;
              scheduleBottomNavAutoCollapse();
          }

          function isValidDbArenaId(arenaId) {
              if (!arenaId || arenaId === 'default') return false;
              const normalized = String(arenaId).trim();
              if (!normalized) return false;
              const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
              const numericLike = /^\d+$/.test(normalized);
              return uuidLike || numericLike;
          }

          function canSyncArenaWithDb(arenaId = currentArenaId) {
              return Boolean(currentSession?.user?.id) && isValidDbArenaId(arenaId);
          }

          function resolveArenaId() {
              const explicitArenaId = experienceView?.dataset?.arenaId;
              if (explicitArenaId && canSyncArenaWithDb(explicitArenaId)) return explicitArenaId;
              if (currentArenaId && canSyncArenaWithDb(currentArenaId)) return currentArenaId;
              return 'default';
          }

          async function refreshArenaParticipantCount(arenaId = currentArenaId) {
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(arenaId)) {
                  currentArenaParticipants = 1;
                  renderArenaSessionBadge();
                  return;
              }
              const { count, error } = await client
                  .from('arena_participants')
                  .select('user_id', { count: 'exact', head: true })
                  .eq('arena_id', arenaId);
              if (error) {
                  logArenaProfileDiagnostic('createInvite.insert_error', { arenaId: currentArenaId, code: error.code || null, message: error.message || null }, true);
                  if (isArenaPermissionDeniedError(error)) {
                      setArenaSessionStatus('Droit refusé (RLS) pour lire les participants.', true);
                  }
                  currentArenaParticipants = 1;
                  renderArenaSessionBadge();
                  return;
              }
              currentArenaParticipants = Math.max(1, count || 1);
              renderArenaSessionBadge();
          }

          async function refreshArenaGuestPanel(arenaId = currentArenaId) {
              if (!arenaGuestPanel || !arenaGuestList) return;
              const client = buildSupabaseClient();
              const isHost = currentArenaRole === 'host' || currentArenaRole === 'cohost';
              arenaGuestPanel.hidden = !isHost;
              if (!client || !isHost || !arenaId || !isValidDbArenaId(arenaId)) return;
              const { data, error } = await client
                  .from('arena_guests')
                  .select('guest_id, display_name, role, last_seen_at, is_active')
                  .eq('arena_id', arenaId)
                  .order('last_seen_at', { ascending: false });
              if (error) return;
              arenaGuestList.innerHTML = '';
              (data || []).forEach((guest) => {
                  const li = document.createElement('li');
                  const roleSelect = document.createElement('select');
                  ['viewer', 'player', 'cohost'].forEach((role) => {
                      const opt = document.createElement('option');
                      opt.value = role;
                      opt.textContent = role;
                      if (guest.role === role) opt.selected = true;
                      roleSelect.appendChild(opt);
                  });
                  roleSelect.addEventListener('change', async () => {
                      await client
                          .from('arena_guests')
                          .update({ role: roleSelect.value })
                          .eq('arena_id', arenaId)
                          .eq('guest_id', guest.guest_id);
                  });
                  li.textContent = `${guest.display_name || 'Invité'} — `;
                  li.appendChild(roleSelect);
                  arenaGuestList.appendChild(li);
              });
          }

          function refreshArenaInviteButton() {
              if (!inviteArenaBtn) return;
              const canInvite = canSyncArenaWithDb(currentArenaId) && currentArenaRole === 'host';
              inviteArenaBtn.hidden = !canInvite;
              inviteArenaBtn.disabled = !canInvite;
          }

          async function refreshCurrentArenaRole(arenaId = currentArenaId) {
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(arenaId)) {
                  currentArenaRole = null;
                  refreshArenaInviteButton();
                  return;
              }
              const { data, error } = await client
                  .from('arena_participants')
                  .select('role')
                  .eq('arena_id', arenaId)
                  .eq('user_id', currentSession.user.id)
                  .maybeSingle();
              if (error) {
                  currentArenaRole = null;
                  refreshArenaInviteButton();
                  return;
              }
              currentArenaRole = data?.role || null;
              refreshArenaInviteButton();
          }

          async function setCurrentArena(arenaId, inviteCode = '') {
              const nextArenaId = arenaId || 'default';
              clearPendingBubbleWritesForOtherArena(nextArenaId);
              currentArenaId = nextArenaId;
              currentArenaInviteCode = inviteCode || '';
              if (experienceView) {
                  experienceView.dataset.arenaId = currentArenaId;
              }
              await activateArenaSync(currentArenaId);
              await refreshCurrentArenaRole(currentArenaId);
              await refreshArenaGuestPanel(currentArenaId);
              if (arenaInviteCodeInput && currentArenaRole === 'host' && currentArenaInviteCode) {
                  arenaInviteCodeInput.value = currentArenaInviteCode;
              }
          }

          function showView(target) {
              console.log('[legacyApp] showView called', { target, currentViewBefore: currentView });
              if (isInviteGuestMode && target !== 'experience') {
                  target = 'experience';
              }
              currentView = target;
              homeView.classList.toggle('hidden-view', target !== 'home');
              experienceModeView?.classList.toggle('hidden-view', target !== 'mode-select');
              experienceView.classList.toggle('hidden-view', target !== 'experience');
              echoHypnoseView.classList.toggle('hidden-view', target !== 'echohypnose');
              profileView.classList.toggle('hidden-view', target !== 'profile');
              if (bottomNav) {
                  if (isInviteGuestMode) bottomNav.classList.add('hidden-view');
                  else bottomNav.classList.remove('hidden-view');
              }
              if (target === 'experience') setActiveNav('soon');
              else if (target === 'echohypnose') setActiveNav('echohypnose');
              else setActiveNav(target);
              if (target !== 'experience') {
                  unsubscribeArenaRealtimeChannel();
                  syncedArenaId = null;
                  isTethered = false;
                  if (soonTutoModal) soonTutoModal.hidden = true;
                  fadeOutSoonTutoMusic(5000);
                  closeBubblePanel();
                  hideSilenceOverlay();
                  if (silenceDesYeuxPrompt) silenceDesYeuxPrompt.hidden = true;
                  setSilenceImmersion(0);
              }
              if (heroVideo) {
                  if (target === 'home') {
                      heroVideo.play().catch(() => {});
                  } else {
                      heroVideo.pause();
                      heroVideo.muted = true;
                      syncHeroPlayButton();
                  }
              }
              if (target === 'experience') {
                  const nextArenaId = resolveArenaId();
                  if (nextArenaId !== syncedArenaId) {
                      activateArenaSync(nextArenaId).catch((error) => {
                          console.warn('[legacyApp] arena sync activation failed', error);
                      });
                      syncedArenaId = nextArenaId;
                  }
                  rotateHelperTip(true);
                  releaseInitialFirefliesFromBubble(null, performance.now());
              }
              syncExperienceModeChips();
              resize();
              scheduleBottomNavAutoCollapse();
          }

          function rotateHelperTip(reset = false) {
              if (reset) helperTipIndex = 0;
              if (!helperTips) return;
              if (experienceUiModeState.isDualMode) {
                  helperTips.textContent = helperTipsDualModeMessage;
                  return;
              }
              helperTips.textContent = helperTipsPlaylist[helperTipIndex];
              helperTipIndex = (helperTipIndex + 1) % helperTipsPlaylist.length;
          }

          const experienceUiModeState = {
              isSilenceActive: false,
              isTraceActive: false,
              isDualMode: false,
              uiMode: 'default'
          };

          function applyExperienceUiModeState() {
              experienceUiModeState.isSilenceActive = silenceImmersionLevel > 0.02;
              experienceUiModeState.isTraceActive = isTraceListeningMode || isDrawingTraceRail;
              experienceUiModeState.isDualMode = experienceUiModeState.isSilenceActive && experienceUiModeState.isTraceActive;
              experienceUiModeState.uiMode = experienceUiModeState.isDualMode
                  ? 'silence-trace'
                  : (experienceUiModeState.isSilenceActive ? 'silence' : (experienceUiModeState.isTraceActive ? 'trace' : 'default'));

              if (experienceView) {
                  experienceView.classList.toggle('silence-mode', experienceUiModeState.isSilenceActive);
                  experienceView.classList.toggle('trace-mode', experienceUiModeState.isTraceActive);
                  experienceView.classList.toggle('dual-mode', experienceUiModeState.isDualMode);
                  experienceView.dataset.uiMode = experienceUiModeState.uiMode;
                  experienceView.style.setProperty('--silence-immersion', silenceImmersionLevel.toFixed(3));
              }

              if (currentView === 'experience') {
                  rotateHelperTip();
              }

              syncExperienceModeChips();
          }

          function syncExperienceModeChips() {
              const isSilenceModeActive =
                  recordingState === 'recording' ||
                  silenceTransitionInProgress ||
                  silenceImmersionLevel > 0.02;
              const isTraceModeActive = isTraceListeningMode || isDrawingTraceRail;
              echoRecordToggleBtn?.classList.toggle('active', isSilenceModeActive);
              traceListeningBtn?.classList.toggle('active', isTraceModeActive);
          }

          function setTraceListeningMode(nextState) {
              isTraceListeningMode = Boolean(nextState);
              applyExperienceUiModeState();
              updateTraceFlowButtons();
          }

          function setDrawingTraceRail(nextState) {
              isDrawingTraceRail = Boolean(nextState);
              applyExperienceUiModeState();
              updateTraceFlowButtons();
          }

          function bindTap(button, handler, options = {}) {
              if (!button || typeof handler !== 'function') return;
              const preventTouchDefault = options.preventTouchDefault !== false;
              let lastTouchAt = 0;
              button.addEventListener('touchend', (event) => {
                  if (preventTouchDefault) event.preventDefault();
                  lastTouchAt = Date.now();
                  handler();
              }, { passive: !preventTouchDefault });
              button.addEventListener('click', () => {
                  if (Date.now() - lastTouchAt < 450) return;
                  handler();
              });
          }

          function bindPress(button, handler) {
              if (!button || typeof handler !== 'function') return;
              let lastPressAt = 0;
              const trigger = () => {
                  const now = Date.now();
                  if (now - lastPressAt < 320) return;
                  lastPressAt = now;
                  handler();
              };
              button.addEventListener('click', trigger);
              if ('PointerEvent' in window) {
                  button.addEventListener('pointerup', (event) => {
                      if (event.pointerType === 'touch') trigger();
                  });
              } else {
                  button.addEventListener('touchend', trigger, { passive: true });
              }
          }

          setInterval(() => {
              if (currentView !== 'experience' || isInteractionPaused) return;
              rotateHelperTip();
          }, 5000);


          function openExperienceModeSelection(entrySource = 'Soon experience') {
              if (!requireRegisteredUserForExperience(entrySource)) return false;
              if (multiRoomComposer) multiRoomComposer.classList.add('hidden-view');
              if (multiRoomLinkOutput) multiRoomLinkOutput.textContent = '';
              pendingMultiRoomInviteLink = '';
              pendingMultiRoomArenaId = null;
              isPendingMultiRoomClosed = false;
              if (copyMultiRoomLinkBtn) copyMultiRoomLinkBtn.disabled = true;
              if (toggleRoomAccessBtn) { toggleRoomAccessBtn.disabled = true; toggleRoomAccessBtn.textContent = "Fermer l'accès visiteurs"; }
              if (enterMultiRoomBtn) enterMultiRoomBtn.disabled = true;
              showView('mode-select');
              return true;
          }

          bindTap(enterExperienceBtn, () => {
              if (!openExperienceModeSelection('Soon experience')) return;
              console.log('[legacyApp] enterExperienceBtn -> showView("mode-select") called', {
                  currentView,
                  experienceViewHidden: experienceView?.classList.contains('hidden-view')
              });
              ensureAllAudioRunning();
          });

          bindTap(echoRecordToggleBtn, () => {
              fadeOutSoonTutoMusic();
              if (recordingState === 'recording') {
                  stopEchoRecording(false);
                  return;
              }
              if (recordingState === 'finalizing' || silenceTransitionInProgress) return;
              startSilenceDesYeuxSequence();
          });

          bindTap(silenceSaveNoBtn, () => {
              if (silenceDesYeuxPrompt) silenceDesYeuxPrompt.hidden = true;
              echoRecordStatus.textContent = 'Traversée non conservée.';
          });

          bindTap(silenceSaveYesBtn, () => {
              if (latestRecordingBlob) {
                  const ext = normalizeExtFromMime(latestRecordingMimeType, recordingFileExt);
                  const filename = buildBalladeFilename(ext);
                  const url = URL.createObjectURL(latestRecordingBlob);
                  savedSilenceSessions.unshift({
                      id: `silence-${Date.now()}`,
                      label: `Traversée du ${new Date().toLocaleString('fr-FR')}`,
                      url,
                      filename,
                      ext
                  });
                  renderSilenceSessions();
              }
              silenceSessionSaved = true;
              if (silenceDesYeuxPrompt) silenceDesYeuxPrompt.hidden = true;
              echoRecordStatus.textContent = 'Traversée synchronisée dans le profil.';
          });

          function syncHeroPlayButton() {
              if (!heroVideo || !heroPlayBtn) return;
              const shouldHidePlayButton = !heroVideo.paused && !heroVideo.muted && heroVideo.volume > 0;
              heroPlayBtn.classList.toggle('hidden', shouldHidePlayButton);
          }

          function ensureHeroHaloAudio() {
              if (!heroVideo || !heroVideoShell) return;
              if (!heroVideoAudioCtx) {
                  const HeroAudioContextClass = window.AudioContext || window.webkitAudioContext;
                  if (!HeroAudioContextClass) return;
                  heroVideoAudioCtx = new HeroAudioContextClass();
              }
              if (!heroVideoSourceNode) {
                  heroVideoSourceNode = heroVideoAudioCtx.createMediaElementSource(heroVideo);
                  heroVideoAnalyserNode = heroVideoAudioCtx.createAnalyser();
                  heroVideoAnalyserNode.fftSize = 512;
                  heroVideoAnalyserNode.smoothingTimeConstant = 0.84;
                  heroHaloData = new Uint8Array(heroVideoAnalyserNode.frequencyBinCount);
                  heroVideoSourceNode.connect(heroVideoAnalyserNode);
                  heroVideoSourceNode.connect(heroVideoAudioCtx.destination);
              }
              if (heroVideoAudioCtx.state === 'suspended') {
                  heroVideoAudioCtx.resume().catch(() => {});
              }
              heroVideoShell.classList.add('audio-reactive');
              startHeroHaloLoop();
          }

          function startHeroHaloLoop() {
              if (heroHaloRAF || !heroVideoShell) return;
              const animateHalo = () => {
                  let targetEnergy = 0.12;
                  if (heroVideoAnalyserNode && heroHaloData) {
                      heroVideoAnalyserNode.getByteFrequencyData(heroHaloData);
                      let weighted = 0;
                      let sumWeights = 0;
                      const length = heroHaloData.length;
                      for (let i = 0; i < length; i += 1) {
                          const ratio = i / length;
                          const weight = ratio < 0.07 ? 0.15 : ratio < 0.34 ? 0.75 : 1.25;
                          weighted += (heroHaloData[i] / 255) * weight;
                          sumWeights += weight;
                      }
                      const spectralEnergy = sumWeights ? weighted / sumWeights : 0;
                      targetEnergy = spectralEnergy * 1.12;
                  }
                  if (heroVideo.muted || heroVideo.paused) {
                      targetEnergy *= 0.45;
                  }
                  heroHaloEnergy += (targetEnergy - heroHaloEnergy) * 0.22;
                  const clampedEnergy = Math.max(0.08, Math.min(1, heroHaloEnergy));
                  const haloScale = 1 + clampedEnergy * 0.12;
                  heroVideoShell.style.setProperty('--halo-intensity', clampedEnergy.toFixed(3));
                  heroVideoShell.style.setProperty('--halo-scale', haloScale.toFixed(3));
                  heroHaloRAF = window.requestAnimationFrame(animateHalo);
              };
              heroHaloRAF = window.requestAnimationFrame(animateHalo);
          }

          function playHeroWithSound() {
              if (!heroVideo) return;
              heroVideo.currentTime = 0;
              heroVideo.muted = false;
              if (heroVideo.volume === 0) heroVideo.volume = 1;
              heroVideo.play().catch(() => {});
              ensureHeroHaloAudio();
              syncHeroPlayButton();
          }

          if (heroPlayBtn) {
              heroPlayBtn.addEventListener('click', playHeroWithSound);
          }
          if (heroVideo) {
              heroVideo.addEventListener('volumechange', syncHeroPlayButton);
              heroVideo.addEventListener('pause', syncHeroPlayButton);
              heroVideo.addEventListener('play', ensureHeroHaloAudio);
              heroVideo.addEventListener('loadeddata', startHeroHaloLoop);
              heroVideo.addEventListener('canplay', startHeroHaloLoop);
              syncHeroPlayButton();
          }

          bindTap(selectSoloModeBtn, () => {
              if (multiRoomComposer) multiRoomComposer.classList.add('hidden-view');
              setCurrentArena('default').catch(() => {});
              showView('experience');
              ensureAllAudioRunning();
          });

          bindTap(selectMultiModeBtn, () => {
              if (multiRoomComposer) multiRoomComposer.classList.remove('hidden-view');
          });

          bindTap(createMultiRoomBtn, async () => {
              const ensured = await ensureArenaBoundToCurrentSession({ createIfMissing: true, silent: false, reuseExisting: false });
              const arenaId = ensured?.arena?.id || null;
              const inviteCode = normalizeRoomSlug(ensured?.arena?.invite_code || '');
              if (!arenaId || !inviteCode) {
                  setArenaSessionStatus('Impossible de créer la room partagée : arène Supabase introuvable.', true);
                  return;
              }
              await setCurrentArena(arenaId, inviteCode);
              pendingMultiRoomArenaId = arenaId;
              pendingMultiRoomInviteLink = buildRoomUrl({ origin: window.location.origin, roomSlug: inviteCode });
              if (multiRoomLinkOutput) {
                  multiRoomLinkOutput.textContent = `Lien hôte à partager: ${pendingMultiRoomInviteLink}`;
              }
              if (copyMultiRoomLinkBtn) copyMultiRoomLinkBtn.disabled = false;
              if (toggleRoomAccessBtn) toggleRoomAccessBtn.disabled = false;
              if (enterMultiRoomBtn) enterMultiRoomBtn.disabled = false;
              setArenaSessionStatus('Room hôte prête ✅ Partage le lien avec tes visiteurs, puis ouvre la session.');
          });

          bindTap(copyMultiRoomLinkBtn, async () => {
              if (!pendingMultiRoomInviteLink) return;
              try {
                  await navigator.clipboard.writeText(pendingMultiRoomInviteLink);
                  setArenaSessionStatus('Lien multi copié ✅');
              } catch (_error) {
                  setArenaSessionStatus(`Copie manuelle: ${pendingMultiRoomInviteLink}`);
              }
          });

          bindTap(toggleRoomAccessBtn, async () => {
              if (!pendingMultiRoomArenaId) return;
              const client = buildSupabaseClient();
              isPendingMultiRoomClosed = !isPendingMultiRoomClosed;
              if (client && canSyncArenaWithDb(pendingMultiRoomArenaId)) {
                  await client.from('arenas').update({ is_closed: isPendingMultiRoomClosed }).eq('id', pendingMultiRoomArenaId);
              }
              if (toggleRoomAccessBtn) {
                  toggleRoomAccessBtn.textContent = isPendingMultiRoomClosed ? "Ouvrir l'accès visiteurs" : "Fermer l'accès visiteurs";
              }
              setArenaSessionStatus(isPendingMultiRoomClosed ? 'Accès visiteurs fermé par l’hôte.' : 'Accès visiteurs ouvert par l’hôte.');
          });

          bindTap(enterMultiRoomBtn, () => {
              if (!pendingMultiRoomArenaId) return;
              currentArenaRole = 'host';
              showView('experience');
              ensureAllAudioRunning();
          });

          if (heroVideoShell) {
              heroVideoShell.style.setProperty('--halo-intensity', '0.18');
              heroVideoShell.style.setProperty('--halo-scale', '1');
              startHeroHaloLoop();
          }

          bindTap(navHome, () => showView('home'));
          bindTap(bottomNavToggle, () => {
              registerBottomNavActivity();
              setBottomNavCollapsed(!bottomNavCollapsed);
          }, { preventTouchDefault: true });
          bindTap(navSoon, () => {
              registerBottomNavActivity();
              if (!openExperienceModeSelection('navigation')) return;
              console.log('[legacyApp] navSoon -> showView("mode-select") called', {
                  currentView,
                  experienceViewHidden: experienceView?.classList.contains('hidden-view')
              });
          });
          bindTap(navProfile, () => {
              registerBottomNavActivity();
              showView('profile');
          });
          bottomNav?.addEventListener('pointerdown', registerBottomNavActivity, { passive: true });
          bottomNav?.addEventListener('focusin', registerBottomNavActivity);
          bindTap(soonTutoLink, () => {
              if (currentView !== 'experience' || !soonTutoModal) return;
              soonTutoModal.hidden = false;
              playSoonTutoMusic();
          });
          bindTap(soonTutoCloseBtn, () => {
              if (!soonTutoModal) return;
              soonTutoModal.hidden = true;
              fadeOutSoonTutoMusic(5000);
          });
          if (soonTutoModal) {
              soonTutoModal.addEventListener('click', (event) => {
                  if (event.target === soonTutoModal) {
                      soonTutoModal.hidden = true;
                      fadeOutSoonTutoMusic(5000);
                  }
              });
          }

          function maskApiKey(key) {
              if (!key || key.length < 12) return key;
              return `${key.slice(0, 10)}…${key.slice(-4)}`;
          }



          function logArenaProfileDiagnostic(step, payload = {}, isError = false) {
              const stamp = new Date().toISOString();
              const entry = { stamp, step, ...payload };
              const line = `[${stamp}] ${step} ${JSON.stringify(payload)}`;
              if (isError) {
                  console.warn('[arena-profile]', entry);
              } else {
                  console.info('[arena-profile]', entry);
              }
              if (arenaDebugLog) {
                  const previous = arenaDebugLog.textContent && arenaDebugLog.textContent !== 'Aucun diagnostic pour le moment.'
                      ? `${arenaDebugLog.textContent}
`
                      : '';
                  arenaDebugLog.textContent = `${previous}${line}`.slice(-4000);
              }
          }

          function setSupabaseStatus(message, isError = false) {
              if (!supabaseStatus) return;
              supabaseStatus.textContent = message;
              supabaseStatus.style.color = isError ? 'rgba(255, 148, 148, 0.95)' : 'rgba(146, 247, 210, 0.95)';
          }

          function setSupabaseProbeStatus(message, isError = false) {
              if (!supabaseProbeStatus) return;
              supabaseProbeStatus.textContent = message;
              supabaseProbeStatus.style.color = isError ? 'rgba(255, 172, 172, 0.95)' : 'rgba(197, 223, 255, 0.95)';
          }

          function setAuthStatus(message, isError = false) {
              if (!authStatus) return;
              authStatus.textContent = message;
              authStatus.style.color = isError ? 'rgba(255, 148, 148, 0.95)' : 'rgba(146, 247, 210, 0.95)';
          }

          function setArenaSessionStatus(message, isError = false) {
              if (!arenaSessionStatus) return;
              const finalMessage = !currentSession?.user?.id
                  ? 'Mode local (non synchronisé)'
                  : message;
              arenaSessionStatus.textContent = finalMessage;
              arenaSessionStatus.style.color = isError ? 'rgba(255, 148, 148, 0.95)' : 'rgba(146, 247, 210, 0.95)';
          }

          function renderArenaSessionBadge() {
              if (!arenaSessionBadge) return;
              const isLocalOnlyMode = !currentSession?.user?.id;
              const arenaLabel = isLocalOnlyMode
                  ? 'local'
                  : (currentArenaInviteCode || 'code non généré');
              const participantCount = Math.max(1, Number.isFinite(currentArenaParticipants) ? Math.round(currentArenaParticipants) : 1);
              const participantLabel = participantCount > 1 ? 'participants' : 'participant';
              const syncLabel = isLocalOnlyMode ? ' · Mode local (non synchronisé)' : '';
              const roleLabel = currentArenaRole === 'host' ? 'hôte' : 'visiteur';
              arenaSessionBadge.textContent = `Arène Soon (${roleLabel}) : ${arenaLabel} · ${participantCount} ${participantLabel}${syncLabel}`;
          }

          function canHostEditBubbles() {
              return currentArenaRole === 'host';
          }

          function notifyGuestReadOnlyMode() {
              if (!canHostEditBubbles()) setArenaSessionStatus('Mode visiteur : lecture seule.', true);
          }

          function isArenaPermissionDeniedError(error) {
              if (!error) return false;
              if (error.code === '42501') return true;
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              return message.includes('row-level security') || message.includes('permission denied') || message.includes('policy');
          }

          function isSupabaseMissingFunctionError(error) {
              if (!error) return false;
              if (error.code === 'PGRST202' || error.code === '42883') return true;
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              return message.includes('function') && message.includes('not found');
          }

          function mapArenaInviteRpcErrorToStatus(error) {
              if (!error) return null;
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              if (message.includes('invalid invite token')) return 'Code invalide: aucune invitation trouvée.';
              if (message.includes('invite expired')) return 'Invitation expirée: demande un nouveau code.';
              if (message.includes('invite quota reached')) return 'Invitation saturée: demande un nouveau code.';
              return null;
          }

          function mapArenaInviteInsertErrorToStatus(error) {
              if (!error) return null;
              const errorCode = error.code ? ` (code: ${error.code})` : '';
              if (isArenaPermissionDeniedError(error)) {
                  return `Droit refusé (RLS) pour créer l’invitation.${errorCode}`;
              }
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              if (message.includes('duplicate key') || error.code === '23505') {
                  return `Invitation déjà existante: régénère un token.${errorCode}`;
              }
              if (message.includes('violates foreign key') || error.code === '23503') {
                  return `Invitation invalide: arène introuvable ou incohérente.${errorCode}`;
              }
              if (message.includes('null value') || error.code === '23502') {
                  return `Invitation invalide: colonnes obligatoires manquantes.${errorCode}`;
              }
              if (message.includes('column') && message.includes('does not exist')) {
                  return `Schéma d'invitation invalide: colonne manquante.${errorCode}`;
              }
              return `Invitation impossible: ${error.message || 'erreur SQL inconnue'}${errorCode}`;
          }

          function generateReadableInviteCode() {
              const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
              let code = '';
              for (let i = 0; i < 6; i += 1) {
                  const index = Math.floor(Math.random() * alphabet.length);
                  code += alphabet[index];
              }
              return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
          }

          function buildArenaInviteShareText(code) {
              const safeCode = normalizeRoomSlug(code || currentArenaInviteCode || '');
              const inviteLink = buildRoomUrl({ origin: window.location.origin, roomSlug: safeCode });
              return `Rejoins ma room Soon ✨\n${inviteLink}\nColle simplement ce lien dans ton navigateur.`;
          }

          function renderArenaInvitePreview(rawCode) {
              const code = normalizeRoomSlug(rawCode || currentArenaInviteCode || '');
              if (!arenaInvitePreview) return;
              const hasCode = Boolean(code);
              arenaInvitePreview.hidden = !hasCode;
              if (!hasCode) return;
              if (arenaInvitePreviewCode) arenaInvitePreviewCode.textContent = buildRoomUrl({ origin: window.location.origin, roomSlug: code });
          }

          async function copyArenaInviteToClipboard() {
              const code = normalizeRoomSlug(arenaInviteCodeInput?.value || currentArenaInviteCode || '');
              if (!code) {
                  setArenaSessionStatus('Aucun code à copier pour le moment.', true);
                  return;
              }
              const text = buildArenaInviteShareText(code);
              try {
                  await navigator.clipboard.writeText(text);
                  setArenaSessionStatus('Lien d’invitation copié ✅');
              } catch (err) {
                  setArenaSessionStatus('Copie impossible automatiquement: copie le lien affiché manuellement.', true);
              }
          }

          async function shareArenaInvite() {
              const code = normalizeRoomSlug(arenaInviteCodeInput?.value || currentArenaInviteCode || '');
              if (!code) {
                  setArenaSessionStatus('Aucun code à partager pour le moment.', true);
                  return;
              }
              const text = buildArenaInviteShareText(code);
              if (navigator.share) {
                  try {
                      await navigator.share({ title: 'Invitation arène Soon', text });
                      setArenaSessionStatus('Invitation partagée ✅');
                      return;
                  } catch (err) {}
              }
              await copyArenaInviteToClipboard();
          }

          function setDbConnectionStatus(message, isError = false) {
              if (!dbConnectionStatus) return;
              dbConnectionStatus.textContent = message;
              dbConnectionStatus.style.color = isError ? 'rgba(255, 172, 172, 0.95)' : 'rgba(197, 223, 255, 0.95)';
          }

          function setAuthButtonsPending(isPending) {
              isAuthActionPending = isPending;
              if (authSignInBtn) authSignInBtn.disabled = isPending;
              if (authSignUpBtn) authSignUpBtn.disabled = isPending;
              if (authSignOutBtn) authSignOutBtn.disabled = isPending || !currentSession?.user;
          }

          function updateExperienceAccessUi() {
              const hasAccess = !!currentSession?.user;
              if (enterExperienceBtn) {
                  enterExperienceBtn.textContent = hasAccess ? 'Soon experience' : 'Soon experience 🔒';
              }
              if (navSoon) {
                  navSoon.textContent = hasAccess ? '🐟' : '🐟 🔒';
              }
          }

          function requireRegisteredUserForExperience(triggerLabel = 'Soon experience') {
              if (currentSession?.user) return true;
              setAuthStatus(`Inscris-toi ou connecte-toi pour accéder à l'expérience (${triggerLabel}).`, true);
              console.warn('[legacyApp] Access denied for experience, redirecting to profile', { triggerLabel });
              showView('profile');
              authEmailInput?.focus();
              return false;
          }

          function redirectToSoonExperienceAfterAuth() {
              openExperienceModeSelection('auth');
              ensureAllAudioRunning();
          }

          function getSupabaseConfig() {
              const bootConfig = window.__SOONO_CONFIG__ || {};
              const urlFromStorage = localStorage.getItem(SUPABASE_LOCAL_KEYS.url);
              const keyFromStorage = localStorage.getItem(SUPABASE_LOCAL_KEYS.key);
              return {
                  url: urlFromStorage || bootConfig.supabaseUrl || ENV_SUPABASE_URL || '',
                  key: keyFromStorage || bootConfig.supabasePublishableKey || ENV_SUPABASE_KEY || '',
              };
          }

          function buildSupabaseClient() {
              const cfg = getSupabaseConfig();
              const url = supabaseUrlInput?.value?.trim() || cfg.url || DEFAULT_SUPABASE_URL;
              const key = supabaseKeyInput?.value?.trim() || cfg.key;
              const nextSignature = `${url}::${key ? 'with-key' : 'no-key'}`;
              if (!url || !key) {
                  setSupabaseStatus('Ajoute URL + clé publishable Supabase.', true);
                  setDbConnectionStatus('Base Supabase non connectée (variables Vercel manquantes).', true);
                  setAuthStatus('Inscription indisponible: variable VITE_SUPABASE_PUBLISHABLE_KEY manquante.', true);
                  return null;
              }
              if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                  setSupabaseStatus('SDK Supabase introuvable dans la page.', true);
                  setDbConnectionStatus('Base Supabase non connectée (SDK introuvable).', true);
                  return null;
              }
              if (supabaseClient && supabaseClientSignature === nextSignature) {
                  setDbConnectionStatus('Base Supabase connectée ✅');
                  return supabaseClient;
              }
              if (supabaseClient && supabaseClientSignature !== nextSignature) {
                  console.info('[legacyApp] Supabase client reinitialized due to config change', { url });
              }
              supabaseClient = window.supabase.createClient(url, key);
              supabaseClientSignature = nextSignature;
              setDbConnectionStatus('Base Supabase connectée ✅');
              supabaseClient.auth.onAuthStateChange((event, session) => {
                  currentSession = session;
                  const statusByEvent = {
                      SIGNED_IN: 'Connexion réussie ✅',
                      SIGNED_OUT: 'Session fermée.',
                      TOKEN_REFRESHED: 'Session actualisée.',
                      USER_UPDATED: 'Profil auth mis à jour.',
                      PASSWORD_RECOVERY: 'Récupération mot de passe en cours.',
                  };
                  refreshAuthUi(statusByEvent[event] || 'Session active.');
                  syncSessionAndProfile({ silent: true });
                  if (currentView === 'experience') {
                      const nextArenaId = resolveArenaId();
                      if (nextArenaId !== syncedArenaId) {
                          activateArenaSync(nextArenaId).catch((error) => {
                              console.warn('[legacyApp] arena sync reactivation failed', error);
                          });
                          syncedArenaId = nextArenaId;
                      }
                  }
              });
              return supabaseClient;
          }



          async function verifySoonbaseSchema({ force = false, silent = false } = {}) {
              const client = buildSupabaseClient();
              if (!client) return { ok: false, missing: ['client'], details: [] };
              const now = Date.now();
              if (!force && soonbaseSchemaHealth.checkedAt && (now - soonbaseSchemaHealth.checkedAt) < 120000) {
                  return soonbaseSchemaHealth;
              }
              const checks = [
                  { table: 'arenas', columns: 'id, owner_id, invite_code, is_active' },
                  { table: 'arena_participants', columns: 'arena_id, user_id, role' },
                  { table: 'arena_bubbles', columns: 'id, arena_id, created_by, sample_id' },
                  { table: 'arena_guests', columns: 'arena_id, guest_id, display_name, role, is_active' },
              ];
              const missing = [];
              const details = [];
              for (const check of checks) {
                  const { error } = await client.from(check.table).select(check.columns).limit(1);
                  if (error) {
                      console.error('[legacyApp] soonbase schema table check failed', {
                          table: check.table,
                          columns: check.columns,
                          code: error.code || null,
                          message: error.message || null,
                          details: error.details || null,
                          hint: error.hint || null,
                      });
                      details.push(`${check.table}: ${error.message || 'erreur inconnue'}`);
                      if (isSupabaseMissingRelationError(error) || isSupabaseMissingColumnError(error)) {
                          missing.push(check.table);
                      }
                  }
              }
              // Référence conservée pour compatibilité outillage/tests de correspondance schéma.
              // Ne pilote plus le flux principal room invité.
              
              const result = { ok: missing.length === 0, missing: Array.from(new Set(missing)), details, checkedAt: now };
              soonbaseSchemaHealth = result;
              if (!silent) {
                  if (result.ok) {
                      setArenaSessionStatus('Soonbase validée ✅ Schéma arène synchronisé avec l’app.');
                  } else {
                      setArenaSessionStatus(`Soonbase incomplète: ${result.missing.join(', ')}. Lance "supabase db push".`, true);
                  }
              }
              return result;
          }

          async function testSupabaseConnection() {
              const client = buildSupabaseClient();
              if (!client) return;
              setSupabaseStatus('Connexion en cours…');
              const { error } = await client.storage.from(SUPABASE_BUCKET).list('', { limit: 1 });
              if (error) {
                  setSupabaseStatus(`Connexion OK mais accès bucket refusé: ${error.message}`, true);
                  return;
              }
              setSupabaseStatus(`Connecté à ${SUPABASE_BUCKET} avec ${maskApiKey(supabaseKeyInput.value.trim())}.`);
              await verifySoonbaseSchema({ force: true, silent: false });
              await fetchSooncutVocalsFromBucket();
          }

          function sanitizeFileName(name) {
              return name.toLowerCase()
                  .replace(/[^a-z0-9._-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
          }

          async function uploadToSoonbucket() {
              const file = supabaseFileInput.files?.[0];
              if (!file) {
                  setSupabaseStatus('Choisis un fichier avant upload.', true);
                  return;
              }
              const client = buildSupabaseClient();
              if (!client) return;
              setSupabaseStatus('Upload en cours…');

              const objectPath = `uploads/${Date.now()}-${sanitizeFileName(file.name)}`;
              const { error: uploadError } = await client.storage.from(SUPABASE_BUCKET).upload(objectPath, file, {
                  cacheControl: '3600',
                  upsert: false,
              });
              if (uploadError) {
                  setSupabaseStatus(`Échec upload: ${uploadError.message}`, true);
                  return;
              }
              const { data } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(objectPath);
              const url = data?.publicUrl;
              setSupabaseStatus('Upload terminé ✅');
              if (url) {
                  supabaseUploadedLink.innerHTML = `Fichier disponible: <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
              } else {
                  supabaseUploadedLink.textContent = `Uploadé: ${objectPath}`;
              }
          }

          async function probeAudioFile(url) {
              if (!url) return { ok: false, reason: 'URL vide.' };
              try {
                  const response = await fetch(url, {
                      method: 'GET',
                      headers: { Range: 'bytes=0-64' },
                  });
                  if (!response.ok) {
                      return { ok: false, reason: `HTTP ${response.status}` };
                  }
                  const contentType = response.headers.get('content-type') || '';
                  const looksAudio = /^audio\//i.test(contentType) || /\.mp3(\?|$)/i.test(url);
                  if (!looksAudio) {
                      return { ok: false, reason: `Type inattendu: ${contentType || 'inconnu'}` };
                  }
                  return { ok: true, reason: `OK (${response.status}${contentType ? ` · ${contentType}` : ''})` };
              } catch (error) {
                  return { ok: false, reason: error?.message || 'Erreur réseau/CORS' };
              }
          }

          async function testSooncutFilesReadability() {
              const directUrl = supabaseProbeUrlInput?.value?.trim() || '';
              setSupabaseProbeStatus('Test lecture bucket en cours…');

              const directProbe = await probeAudioFile(directUrl);
              const directLine = directProbe.ok
                  ? `URL directe: lisible ✅ (${directProbe.reason})`
                  : `URL directe: échec ❌ (${directProbe.reason})`;

              const url = supabaseUrlInput?.value?.trim() || '';
              const key = supabaseKeyInput?.value?.trim() || '';
              if (!url || !key) {
                  setSupabaseProbeStatus(
                      `${directLine} · Test multi-fichiers ignoré (URL + clé Supabase non renseignées).`,
                      !directProbe.ok
                  );
                  return;
              }
              const client = buildSupabaseClient();
              if (!client) {
                  setSupabaseProbeStatus(`${directLine} · Client Supabase indisponible pour le test multi-fichiers.`, true);
                  return;
              }

              const { data, error } = await client.storage.from(SUPABASE_BUCKET).list(SOONCUT_BUCKET_FOLDER, {
                  limit: 5,
                  offset: 0,
                  sortBy: { column: 'name', order: 'asc' },
              });
              if (error) {
                  setSupabaseProbeStatus(`${directLine} · Listing Sooncut refusé: ${error.message}`, true);
                  return;
              }

              const audioFiles = (data || []).filter((item) => item?.name && isAudioObject(item.name));
              if (!audioFiles.length) {
                  setSupabaseProbeStatus(`${directLine} · Aucun .mp3 trouvé dans ${SUPABASE_BUCKET}/${SOONCUT_BUCKET_FOLDER}.`, true);
                  return;
              }

              let readableCount = 0;
              for (const file of audioFiles) {
                  const objectPath = `${SOONCUT_BUCKET_FOLDER}/${file.name}`;
                  const { data: signedData } = await client.storage.from(SUPABASE_BUCKET).createSignedUrl(objectPath, 60 * 5);
                  const candidateUrl = signedData?.signedUrl || buildPublicSoonbucketUrl(objectPath);
                  const probe = await probeAudioFile(candidateUrl);
                  if (probe.ok) readableCount += 1;
              }

              const allReadable = readableCount === audioFiles.length;
              setSupabaseProbeStatus(`${directLine} · Fichiers testés: ${audioFiles.length}, lisibles: ${readableCount}.`, !allReadable);
          }

          function getCollectionStorageKey() {
              const userId = currentSession?.user?.id || 'guest';
              return `soono.echo.purchases.${userId}`;
          }

          function getSessionHistoryStorageKey() {
              const userId = currentSession?.user?.id || 'guest';
              return `soono.echo.sessions.${userId}`;
          }

          function getOwnedItems() {
              const raw = localStorage.getItem(getCollectionStorageKey());
              if (!raw) return [];
              try {
                  const parsed = JSON.parse(raw);
                  return Array.isArray(parsed) ? parsed : [];
              } catch (_) {
                  return [];
              }
          }

          function setOwnedItems(items) {
              localStorage.setItem(getCollectionStorageKey(), JSON.stringify(items));
          }

          function getSessionHistory() {
              const raw = localStorage.getItem(getSessionHistoryStorageKey());
              if (!raw) return [];
              try {
                  const parsed = JSON.parse(raw);
                  return Array.isArray(parsed) ? parsed : [];
              } catch (_) {
                  return [];
              }
          }

          function setSessionHistory(items) {
              localStorage.setItem(getSessionHistoryStorageKey(), JSON.stringify(items));
          }

          function sanitizeOwnedItems(items) {
              if (!Array.isArray(items)) return [];
              const allowedIds = new Set(ECHO_EXPERIENCES.map((item) => item.id));
              const unique = [];
              const seen = new Set();
              items.forEach((itemId) => {
                  if (!allowedIds.has(itemId) || seen.has(itemId)) return;
                  seen.add(itemId);
                  unique.push(itemId);
              });
              return unique;
          }

          async function fetchUserPurchasesRows(client, userId) {
              const { data, error } = await client
                  .from('user_purchases')
                  .select('pack_id, purchased_at, status, echo_packs(slug, title)')
                  .eq('user_id', userId)
                  .order('purchased_at', { ascending: false })
                  .limit(200);
              if (error) return { rows: [], error };
              return { rows: Array.isArray(data) ? data : [], error: null };
          }

          function toOwnedItemsFromPurchases(rows) {
              const slugs = rows
                  .map((row) => row?.echo_packs?.slug)
                  .filter(Boolean);
              return sanitizeOwnedItems(slugs);
          }

          function toSessionHistoryFromPurchases(rows) {
              return rows
                  .map((row) => {
                      const slug = row?.echo_packs?.slug;
                      const title = row?.echo_packs?.title;
                      const purchasedAt = row?.purchased_at;
                      if (!slug || !purchasedAt) return null;
                      return {
                          experience_id: slug,
                          experience_title: title || 'Expérience Échohypnose',
                          purchased_at: purchasedAt,
                      };
                  })
                  .filter(Boolean);
          }

          async function ensurePurchasesForExperienceIds(client, userId, experienceIds) {
              const safeIds = sanitizeOwnedItems(experienceIds);
              if (!safeIds.length) return { ok: true, inserted: 0 };

              const { data: packs, error: packsError } = await client
                  .from('echo_packs')
                  .select('id, slug')
                  .in('slug', safeIds);
              if (packsError) return { ok: false, error: packsError };

              const packRows = Array.isArray(packs) ? packs : [];
              if (!packRows.length) return { ok: true, inserted: 0 };
              const packIds = packRows.map((row) => row.id).filter(Boolean);

              const { data: existingRows, error: existingError } = await client
                  .from('user_purchases')
                  .select('pack_id')
                  .eq('user_id', userId)
                  .in('pack_id', packIds)
                  .limit(200);
              if (existingError) return { ok: false, error: existingError };

              const existingPackIds = new Set((existingRows || []).map((row) => row.pack_id));
              const missingPurchases = packRows
                  .filter((row) => !existingPackIds.has(row.id))
                  .map((row) => ({
                      user_id: userId,
                      pack_id: row.id,
                      status: 'paid',
                      payment_provider: 'local-sync',
                  }));

              if (!missingPurchases.length) return { ok: true, inserted: 0 };

              const { error: insertError } = await client
                  .from('user_purchases')
                  .insert(missingPurchases);
              if (insertError) return { ok: false, error: insertError };

              return { ok: true, inserted: missingPurchases.length };
          }

          async function syncCollectionFromSupabase() {
              if (!currentSession?.user?.id) return;
              const client = buildSupabaseClient();
              if (!client) return;

              const { data, error } = await client
                  .from('user_profile_collections')
                  .select('owned_item_ids')
                  .eq('user_id', currentSession.user.id)
                  .maybeSingle();

              if (error) {
                  if (!isSupabaseMissingRelationError(error)) {
                      setAuthStatus(`Sync profil échouée (lecture): ${error.message}`, true);
                      return;
                  }
                  const purchasesResult = await fetchUserPurchasesRows(client, currentSession.user.id);
                  if (purchasesResult.error) {
                      setAuthStatus(`Sync profil échouée (fallback user_purchases): ${purchasesResult.error.message}`, true);
                      return;
                  }
                  const remoteOwned = toOwnedItemsFromPurchases(purchasesResult.rows);
                  const localOwned = sanitizeOwnedItems(getOwnedItems());
                  const mergedOwned = sanitizeOwnedItems([...remoteOwned, ...localOwned]);
                  setOwnedItems(mergedOwned);
                  setAuthStatus(`Achats synchronisés via user_purchases (${mergedOwned.length} expérience${mergedOwned.length > 1 ? 's' : ''}).`);
                  return;
              }

              if (!data) {
                  const localOwned = sanitizeOwnedItems(getOwnedItems());
                  await syncCollectionToSupabase(localOwned, { silentSuccess: true });
                  return;
              }

              const remoteOwned = sanitizeOwnedItems(data.owned_item_ids || []);
              const localOwned = sanitizeOwnedItems(getOwnedItems());
              const mergedOwned = sanitizeOwnedItems([...remoteOwned, ...localOwned]);
              const changedFromRemote = mergedOwned.length !== remoteOwned.length;
              setOwnedItems(mergedOwned);
              if (changedFromRemote) {
                  await syncCollectionToSupabase(mergedOwned, { silentSuccess: true });
              }
              setAuthStatus(`Achats synchronisés (${mergedOwned.length} expérience${mergedOwned.length > 1 ? 's' : ''}).`);
          }

          async function syncCollectionToSupabase(items, options = {}) {
              if (!currentSession?.user?.id) return false;
              const client = buildSupabaseClient();
              if (!client) return false;
              const safeItems = sanitizeOwnedItems(items);

              const { error } = await client
                  .from('user_profile_collections')
                  .upsert({
                      user_id: currentSession.user.id,
                      owned_item_ids: safeItems,
                      updated_at: new Date().toISOString(),
                  }, {
                      onConflict: 'user_id',
                  });

              if (error) {
                  if (!isSupabaseMissingRelationError(error)) {
                      setAuthStatus(`Sync profil échouée (écriture): ${error.message}`, true);
                      return false;
                  }
                  const fallback = await ensurePurchasesForExperienceIds(client, currentSession.user.id, safeItems);
                  if (!fallback.ok) {
                      setAuthStatus(`Sync profil échouée (fallback user_purchases): ${fallback.error.message}`, true);
                      return false;
                  }
                  if (!options.silentSuccess) {
                      setAuthStatus(`Achats synchronisés via user_purchases (${safeItems.length} expérience${safeItems.length > 1 ? 's' : ''}).`);
                  }
                  return true;
              }

              if (!options.silentSuccess) {
                  setAuthStatus(`Profil Supabase synchronisé (${safeItems.length} expérience${safeItems.length > 1 ? 's' : ''}).`);
              }
              return true;
          }

          function formatSessionTimestamp(value) {
              const date = new Date(value);
              if (Number.isNaN(date.getTime())) return 'Date inconnue';
              return new Intl.DateTimeFormat('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(date);
          }

          function isSupabaseMissingRelationError(error) {
              if (!error) return false;
              if (error.code === '42P01') return true;
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              if (message.includes('could not find the table')) return true;
              if (message.includes('relation') && message.includes('does not exist')) return true;
              return false;
          }

          function isSupabaseMissingColumnError(error) {
              if (!error) return false;
              if (error.code === '42703') return true;
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              return message.includes('column') && message.includes('does not exist');
          }

          function isSupabaseSessionInvalidError(error) {
              if (!error) return false;
              if (error.code === 'PGRST301') return true;
              const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
              return message.includes('jwt') || message.includes('session') || message.includes('token');
          }

          function mapArenaBubbleWriteErrorLabel(error) {
              if (isArenaPermissionDeniedError(error)) return 'Écriture refusée (RLS)';
              if (isSupabaseMissingRelationError(error)) return 'Table arène manquante (migration)';
              if (isSupabaseSessionInvalidError(error)) return 'Connexion/session invalide';
              return `Écriture arène impossible: ${error?.message || 'erreur inconnue'}`;
          }

          async function joinArenaAndSetupFish(inviteCode) {
              const client = buildSupabaseClient();
              if (!client || !currentSession?.user?.id) {
                  return { data: null, error: new Error('missing session') };
              }
              const { data, error } = await client.rpc('join_arena_and_claim_fish', { invite_code: inviteCode });
              if (error) return { data: null, error };
              const row = Array.isArray(data) ? data[0] : data;
              return { data: row || null, error: null };
          }

          async function ensureGuestBubbleForArena(client, arenaId) {
              if (!client || !arenaId || !currentSession?.user?.id) return { ok: false, error: new Error('missing context') };
              const userId = currentSession.user.id;
              const { data: existingBubble, error: existingBubbleError } = await client
                  .from('arena_bubbles')
                  .select('id')
                  .eq('arena_id', arenaId)
                  .eq('created_by', userId)
                  .limit(1)
                  .maybeSingle();
              if (existingBubbleError) return { ok: false, error: existingBubbleError };
              if (existingBubble?.id) return { ok: true, created: false };

              const guestBubblePayload = {
                  arena_id: arenaId,
                  created_by: userId,
                  sample_id: SAMPLE_LIBRARY[0]?.id || 'unknown-sample',
                  label: `Invité ${String(userId).slice(0, 6)}`,
                  x: 0.5,
                  y: 0.5,
                  radius: 56,
                  hue: 205,
                  layer: 'front',
                  halo_style: HALO_STYLE_LIBRARY[0]?.id || 'aura-soft',
              };
              const { error: createBubbleError } = await insertArenaBubbleRow(client, guestBubblePayload, {
                  action: 'join-fallback-create-bubble',
                  arena_id: arenaId,
              });
              if (createBubbleError && createBubbleError.code !== '23505') {
                  return { ok: false, error: createBubbleError };
              }
              return { ok: true, created: true };
          }

          function canCurrentUserControlBubble(bubble) {
              if (!bubble || !currentSession?.user?.id) return false;
              return bubble.created_by === currentSession.user.id || bubble.created_by === currentSession.user.id;
          }

          async function insertArenaBubbleRow(client, payload, context = {}) {
              const result = await client.from('arena_bubbles').insert(payload);
              if (result.error) {
                  console.warn('[legacyApp] arena_bubbles write failed', {
                      action: context.action || 'insert',
                      arena_id: context.arena_id || currentArenaId,
                      bubble_id: context.bubble_id || payload?.id || null,
                      error: result.error,
                  });
              }
              return result;
          }

          async function updateArenaBubbleRow(client, bubbleId, patch, context = {}) {
              const result = await client
                  .from('arena_bubbles')
                  .update(patch)
                  .eq('id', bubbleId)
                  .eq('arena_id', context?.arena_id || currentArenaId);
              if (result.error) {
                  console.warn('[legacyApp] arena_bubbles write failed', {
                      action: context.action || 'update',
                      arena_id: context.arena_id || currentArenaId,
                      bubble_id: context.bubble_id || bubbleId || null,
                      error: result.error,
                  });
              }
              return result;
          }

          async function deleteArenaBubbleRow(client, bubbleId, context = {}) {
              const result = await client
                  .from('arena_bubbles')
                  .delete()
                  .eq('id', bubbleId)
                  .eq('arena_id', context?.arena_id || currentArenaId);
              if (result.error) {
                  console.warn('[legacyApp] arena_bubbles write failed', {
                      action: context.action || 'delete',
                      arena_id: context.arena_id || currentArenaId,
                      bubble_id: context.bubble_id || bubbleId || null,
                      error: result.error,
                  });
              }
              return result;
          }

          async function syncSessionHistoryFromSupabase() {
              if (!currentSession?.user?.id) return;
              const client = buildSupabaseClient();
              if (!client) return;

              const { data, error } = await client
                  .from('echohypnose_session_history')
                  .select('experience_id, experience_title, purchased_at')
                  .eq('user_id', currentSession.user.id)
                  .order('purchased_at', { ascending: false })
                  .limit(100);

              if (error) {
                  if (isSupabaseMissingRelationError(error)) {
                      const purchasesResult = await fetchUserPurchasesRows(client, currentSession.user.id);
                      if (purchasesResult.error) {
                          setAuthStatus(`Historique non synchronisé (fallback user_purchases): ${purchasesResult.error.message}`, true);
                          return;
                      }
                      const purchaseHistory = toSessionHistoryFromPurchases(purchasesResult.rows);
                      const localRows = Array.isArray(getSessionHistory()) ? getSessionHistory() : [];
                      const mergedMap = new Map();
                      [...purchaseHistory, ...localRows].forEach((entry) => {
                          if (!entry?.experience_id || !entry?.purchased_at) return;
                          const key = `${entry.experience_id}::${entry.purchased_at}`;
                          if (!mergedMap.has(key)) {
                              mergedMap.set(key, entry);
                          }
                      });
                      const mergedRows = Array.from(mergedMap.values())
                          .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
                          .slice(0, 100);
                      setSessionHistory(mergedRows);
                      setAuthStatus(`Historique synchronisé via user_purchases (${purchaseHistory.length} entrée${purchaseHistory.length > 1 ? 's' : ''}).`);
                      return;
                  }
                  setAuthStatus(`Historique non synchronisé: ${error.message}`, true);
                  return;
              }
              const remoteRows = Array.isArray(data) ? data : [];
              const localRows = Array.isArray(getSessionHistory()) ? getSessionHistory() : [];
              const mergedMap = new Map();
              [...remoteRows, ...localRows].forEach((entry) => {
                  if (!entry?.experience_id || !entry?.purchased_at) return;
                  const key = `${entry.experience_id}::${entry.purchased_at}`;
                  if (!mergedMap.has(key)) {
                      mergedMap.set(key, {
                          experience_id: entry.experience_id,
                          experience_title: entry.experience_title || 'Expérience Échohypnose',
                          purchased_at: entry.purchased_at,
                      });
                  }
              });
              const mergedRows = Array.from(mergedMap.values())
                  .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
                  .slice(0, 100);
              setSessionHistory(mergedRows);
          }

          async function pushSessionHistoryToSupabase(entry) {
              if (!currentSession?.user?.id) return false;
              const client = buildSupabaseClient();
              if (!client) return false;
              const { error } = await client.from('echohypnose_session_history').insert({
                  user_id: currentSession.user.id,
                  experience_id: entry.experience_id,
                  experience_title: entry.experience_title,
                  purchased_at: entry.purchased_at,
              });
              if (error) {
                  if (isSupabaseMissingRelationError(error)) {
                      const fallback = await ensurePurchasesForExperienceIds(client, currentSession.user.id, [entry.experience_id]);
                      if (fallback.ok) return true;
                      setAuthStatus(`Écriture historique échouée (fallback user_purchases): ${fallback.error.message}`, true);
                      return false;
                  }
                  if (error.code === '23505') return true;
                  setAuthStatus(`Écriture historique échouée: ${error.message}`, true);
                  return false;
              }
              return true;
          }

          async function syncSessionAndProfile(options = {}) {
              if (syncInFlightPromise) return syncInFlightPromise;
              syncInFlightPromise = (async () => {
                  if (!currentSession?.user?.id) {
                      renderStoreCatalog();
                      renderSessionHistory();
                      return;
                  }
                  await syncCollectionFromSupabase();
                  await syncSessionHistoryFromSupabase();
                  renderStoreCatalog();
                  renderSessionHistory();
                  const ensuredArena = await ensureArenaBoundToCurrentSession({ createIfMissing: true, silent: true });
                  if (ensuredArena?.arena?.invite_code && currentArenaRole === 'host') {
                      setArenaSessionStatus(`Arène active ✅ Code: ${ensuredArena.arena.invite_code}`);
                  }
                  if (!options.silent) {
                      setAuthStatus('Profil + session synchronisés ✅');
                  }
              })();
              try {
                  await syncInFlightPromise;
              } finally {
                  syncInFlightPromise = null;
              }
          }

          async function ensureArenaBoundToCurrentSession(options = {}) {
              const { createIfMissing = true, silent = true, reuseExisting = true } = options;
              if (!currentSession?.user?.id) return null;
              const client = buildSupabaseClient();
              if (!client) return null;

              const { data: authData, error: authError } = await client.auth.getUser();
              if (authError || !authData?.user?.id) {
                  if (!silent) {
                      setArenaSessionStatus('Connexion Supabase requise pour le multi (utilisateur introuvable).', true);
                  }
                  return null;
              }

              const userId = authData.user.id;
              let existingArena = null;
              if (reuseExisting) {
                  const { data, error: existingArenaError } = await client
                      .from('arenas')
                      .select('id, invite_code, created_at')
                      .eq('owner_id', userId)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                  if (existingArenaError) {
                  if (!silent) {
                      if (isSupabaseMissingRelationError(existingArenaError)) {
                          setArenaSessionStatus('Arène indisponible: tables Supabase manquantes. Lance les migrations puis réessaie.', true);
                      } else if (isArenaPermissionDeniedError(existingArenaError)) {
                          setArenaSessionStatus('Droit refusé (RLS) pendant la récupération de l’arène.', true);
                      } else {
                          setArenaSessionStatus(`Récupération arène impossible: ${existingArenaError.message}`, true);
                      }
                  }
                      return null;
                  }
                  existingArena = data || null;
              }

              if (existingArena?.id) {
                  await setCurrentArena(existingArena.id, existingArena.invite_code || '');
                  return { arena: existingArena, created: false };
              }
              if (!createIfMissing) return null;

              let attempt = 0;
              let createdArena = null;
              while (attempt < 4 && !createdArena) {
                  attempt += 1;
                  const inviteCode = generateReadableInviteCode();
                  if (!inviteCode) {
                      if (!silent) setArenaSessionStatus('Code d’arène invalide: génération vide.', true);
                      continue;
                  }
                  const { data, error } = await client
                      .from('arenas')
                      .insert({
                          owner_id: userId,
                          invite_code: inviteCode,
                          title: `Arène de ${getSavedProfileIdentity().displayName}`
                      })
                      .select('id, invite_code')
                      .single();
                  if (error) {
                      if (error.code === '23505') continue;
                      if (!silent) {
                          if (isSupabaseMissingRelationError(error)) {
                              setArenaSessionStatus('Arène indisponible: tables Supabase manquantes. Lance les migrations puis réessaie.', true);
                          } else if (isArenaPermissionDeniedError(error)) {
                              setArenaSessionStatus('Droit refusé (RLS) pendant la création de l’arène.', true);
                          } else {
                              setArenaSessionStatus(`Création impossible: ${error.message}`, true);
                          }
                      }
                      return null;
                  }
                  createdArena = data;
              }

              if (!createdArena?.id) {
                  if (!silent) setArenaSessionStatus('Impossible de générer un code unique, réessaie.', true);
                  return null;
              }

              const ownerMembership = await client.from('arena_participants').insert({
                  arena_id: createdArena.id,
                  user_id: userId,
                  role: 'host'
              });
              if (ownerMembership.error && ownerMembership.error.code !== '23505') {
                  if (!silent) {
                      if (isSupabaseMissingRelationError(ownerMembership.error)) {
                          setArenaSessionStatus('Arène indisponible: tables Supabase manquantes. Lance les migrations puis réessaie.', true);
                      } else if (isArenaPermissionDeniedError(ownerMembership.error)) {
                          setArenaSessionStatus('Droit refusé (RLS) pour ajouter le propriétaire.', true);
                      } else {
                          setArenaSessionStatus(`Création incomplète: ${ownerMembership.error.message}`, true);
                      }
                  }
                  return null;
              }

              await setCurrentArena(createdArena.id, createdArena.invite_code || '');
              return { arena: createdArena, created: true };
          }

          async function simulatePaymentAndActivate(item) {
              setAuthStatus(`Achat simulé pour ${item.title}…`);
              await new Promise(resolve => setTimeout(resolve, 650));
              const owned = new Set(getOwnedItems());
              owned.add(item.id);
              const nextOwned = sanitizeOwnedItems([...owned]);
              setOwnedItems(nextOwned);
              const purchasedAt = new Date().toISOString();
              const localHistory = [
                  {
                      experience_id: item.id,
                      experience_title: item.title,
                      purchased_at: purchasedAt,
                  },
                  ...getSessionHistory(),
              ].slice(0, 100);
              setSessionHistory(localHistory);

              if (currentSession?.user?.id) {
                  await syncCollectionToSupabase(nextOwned, { silentSuccess: true });
                  await pushSessionHistoryToSupabase({
                      experience_id: item.id,
                      experience_title: item.title,
                      purchased_at: purchasedAt,
                  });
              }
              setAuthStatus(`${item.title} acheté ✅${currentSession?.user?.id ? ' · historique sync OK' : ''}`);
              renderStoreCatalog();
              renderSessionHistory();
          }

          function refreshAuthUi(message = '') {
              if (message) setAuthStatus(message, false);
              if (currentSession?.user) {
                  authSessionInfo.textContent = `Connecté: ${currentSession.user.email || currentSession.user.id}`;
                  if (authCredentialsBlock) authCredentialsBlock.hidden = true;
                  if (authEmailInput) authEmailInput.value = currentSession.user.email || '';
                  if (authPasswordInput) authPasswordInput.value = '';
                  if (authSignOutBtn) authSignOutBtn.hidden = false;
                  if (authSignOutBtn) authSignOutBtn.disabled = false;
              } else {
                  authSessionInfo.textContent = 'Aucune session active.';
                  if (authCredentialsBlock) authCredentialsBlock.hidden = false;
                  if (authSignOutBtn) authSignOutBtn.hidden = true;
                  if (authSignOutBtn) authSignOutBtn.disabled = true;
              }
              updateExperienceAccessUi();
              refreshArenaInviteButton();
          }

          function getSavedProfileIdentity() {
              const fallback = {
                  displayName: 'Poisson-Plume',
                  bio: '',
              };
              try {
                  const raw = localStorage.getItem(PROFILE_LOCAL_KEY);
                  if (!raw) return fallback;
                  const parsed = JSON.parse(raw);
                  return {
                      displayName: (parsed?.displayName || fallback.displayName).toString().trim() || fallback.displayName,
                      bio: (parsed?.bio || '').toString().trim(),
                  };
              } catch (_) {
                  return fallback;
              }
          }

          function renderProfileIdentity() {
              const profile = getSavedProfileIdentity();
              if (profileDisplayName) profileDisplayName.textContent = profile.displayName;
              if (profileBioText) {
                  profileBioText.textContent = profile.bio || 'Aucune présentation pour le moment.';
              }
              if (profileNameInput) profileNameInput.value = profile.displayName;
              if (profileBioInput) profileBioInput.value = profile.bio;
          }

          function openProfileEditPanel() {
              if (profileEditPanel) profileEditPanel.hidden = false;
              renderProfileIdentity();
              profileNameInput?.focus();
          }

          function closeProfileEditPanel() {
              if (profileEditPanel) profileEditPanel.hidden = true;
          }

          function saveProfileIdentity() {
              const displayName = (profileNameInput?.value || '').trim();
              const bio = (profileBioInput?.value || '').trim();
              const payload = {
                  displayName: displayName || 'Poisson-Plume',
                  bio,
              };
              localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(payload));
              renderProfileIdentity();
              closeProfileEditPanel();
              setAuthStatus('Profil mis à jour ✅');
          }

          function renderStoreCatalog() {
              if (!storeCatalog) return;
              const owned = new Set(getOwnedItems());
              storeCatalog.innerHTML = '';
              ECHO_EXPERIENCES.forEach(item => {
                  const card = document.createElement('article');
                  card.className = 'store-item';
                  const isOwned = owned.has(item.id);
                  card.innerHTML = `
                      <h4>${item.title}</h4>
                      <p>${item.description}</p>
                      <span class="pill">${item.durationLabel} · ${isOwned ? 'Acheté' : item.priceLabel}</span>
                  `;
                  const actionBtn = document.createElement('button');
                  actionBtn.type = 'button';
                  actionBtn.textContent = isOwned ? 'Déjà acheté' : 'Acheter (simulé)';
                  actionBtn.disabled = isOwned;
                  bindTap(actionBtn, () => {
                      simulatePaymentAndActivate(item);
                  });
                  card.appendChild(actionBtn);
                  storeCatalog.appendChild(card);
              });
          }

          function renderSessionHistory() {
              if (!sessionHistoryList) return;
              const history = getSessionHistory();
              sessionHistoryList.innerHTML = '';
              if (!history.length) {
                  sessionHistoryList.innerHTML = '<p class="collection-empty">Aucune session enregistrée pour le moment.</p>';
                  return;
              }
              history.forEach((entry, index) => {
                  const row = document.createElement('article');
                  row.className = 'store-item';
                  row.innerHTML = `
                      <h4>${entry.experience_title || 'Expérience Échohypnose'}</h4>
                      <p>Session #${history.length - index} · ${formatSessionTimestamp(entry.purchased_at)}</p>
                  `;
                  sessionHistoryList.appendChild(row);
              });
          }

          async function signInWithEmail() {
              if (isAuthActionPending) return;
              const client = buildSupabaseClient();
              if (!client) return;
              const email = authEmailInput.value.trim();
              const password = authPasswordInput.value.trim();
              if (!email || !password) {
                  setAuthStatus('Email et mot de passe requis.', true);
                  return;
              }
              setAuthButtonsPending(true);
              try {
                  const { data, error } = await client.auth.signInWithPassword({ email, password });
                  if (error) {
                      setAuthStatus(`Connexion refusée: ${error.message}`, true);
                      return;
                  }
                  currentSession = data.session;
                  refreshAuthUi('Connexion réussie ✅');
                  await syncSessionAndProfile({ silent: true });
                  redirectToSoonExperienceAfterAuth();
              } finally {
                  setAuthButtonsPending(false);
              }
          }

          async function signUpWithEmail() {
              if (isAuthActionPending) return;
              const client = buildSupabaseClient();
              if (!client) return;
              const email = authEmailInput.value.trim();
              const password = authPasswordInput.value.trim();
              if (!email || !password) {
                  setAuthStatus('Email et mot de passe requis.', true);
                  return;
              }
              setAuthButtonsPending(true);
              try {
                  const { data, error } = await client.auth.signUp({ email, password });
                  if (error) {
                      setAuthStatus(`Inscription refusée: ${error.message}`, true);
                      return;
                  }
                  if (data?.session) {
                      currentSession = data.session;
                      refreshAuthUi('Compte créé + connecté ✅');
                      await syncSessionAndProfile({ silent: true });
                      redirectToSoonExperienceAfterAuth();
                      return;
                  }
                  setAuthStatus('Compte créé. Vérifie ton email puis connecte-toi.');
              } finally {
                  setAuthButtonsPending(false);
              }
          }

          async function signOutSession() {
              if (isAuthActionPending) return;
              const client = buildSupabaseClient();
              if (!client) return;
              setAuthButtonsPending(true);
              try {
                  const { error } = await client.auth.signOut();
                  if (error) {
                      setAuthStatus(`Déconnexion impossible: ${error.message}`, true);
                      return;
                  }
                  currentSession = null;
                  currentArenaInviteCode = '';
                  currentArenaParticipants = 1;
                  currentArenaId = 'default';
                  currentArenaRole = null;
                  if (experienceView) delete experienceView.dataset.arenaId;
                  renderArenaSessionBadge();
                  refreshAuthUi('Déconnecté.');
                  renderStoreCatalog();
                  renderSessionHistory();
              } finally {
                  setAuthButtonsPending(false);
              }
          }

          async function createArenaFromProfile() {
              if (!currentSession?.user?.id) {
                  setArenaSessionStatus('Connecte-toi pour créer une arène.', true);
                  setAuthStatus('Connexion requise pour créer une arène.', true);
                  return;
              }
              setArenaSessionStatus('Préparation de ton arène…');
              const schema = await verifySoonbaseSchema({ silent: true });
              logArenaProfileDiagnostic('createArena.schema_check', { ok: schema.ok, missing: schema.missing });
              if (!schema.ok) {
                  console.warn('[legacyApp] createArena continues despite schema warning', {
                      missing: schema.missing,
                      details: schema.details,
                  });
                  setArenaSessionStatus('Diagnostic Soonbase incertain: tentative de création quand même…', true);
              }
              const ensured = await ensureArenaBoundToCurrentSession({ createIfMissing: true, silent: false });
              logArenaProfileDiagnostic('createArena.ensure', { created: Boolean(ensured?.created), arenaId: ensured?.arena?.id || null, inviteCode: ensured?.arena?.invite_code || null });
              if (!ensured?.arena?.id) return;
              if (arenaInviteCodeInput) arenaInviteCodeInput.value = ensured.arena.invite_code || '';
              renderArenaInvitePreview(ensured.arena.invite_code || '');
              if (ensured.created) {
                  setArenaSessionStatus(`Arène créée ✅ Code: ${ensured.arena.invite_code}`);
              } else {
                  setArenaSessionStatus(`Arène déjà active ✅ Code: ${ensured.arena.invite_code}`);
              }
              if (currentView !== 'experience') showView('experience');
          }

          async function joinArenaFromProfile() {
              if (!currentSession?.user?.id) {
                  setArenaSessionStatus('Connecte-toi pour rejoindre une arène.', true);
                  setAuthStatus('Connexion requise pour rejoindre une arène.', true);
                  return;
              }
              const client = buildSupabaseClient();
              if (!client) return;
              const inviteCode = normalizeRoomSlug(arenaInviteCodeInput?.value || '');
              if (!inviteCode || inviteCode.length < 7) {
                  setArenaSessionStatus('Code invalide: entre un code au format ABC-123.', true);
                  return;
              }
              if (arenaInviteCodeInput) arenaInviteCodeInput.value = inviteCode;

              setArenaSessionStatus('Recherche de l’arène…');
              const schema = await verifySoonbaseSchema({ silent: true });
              logArenaProfileDiagnostic('joinArena.schema_check', { ok: schema.ok, missing: schema.missing, inviteCode });
              if (!schema.ok) {
                  console.warn('[legacyApp] joinArena continues despite schema warning', {
                      inviteCode,
                      missing: schema.missing,
                      details: schema.details,
                  });
                  setArenaSessionStatus('Diagnostic Soonbase incertain: tentative de jointure quand même…', true);
              }
              const { data: joinResult, error: rpcJoinError } = await joinArenaAndSetupFish(inviteCode);
              const rpcArenaId = joinResult?.arena_id || null;
              logArenaProfileDiagnostic('joinArena.rpc_result', { inviteCode, rpcArenaId, rpcError: rpcJoinError?.message || null }, Boolean(rpcJoinError));
              if (!rpcJoinError && rpcArenaId) {
                  await setCurrentArena(rpcArenaId, inviteCode);
                  setArenaSessionStatus(`Arène rejointe ✅ ${inviteCode} · ${joinResult?.label || ''}`.trim());
                  if (currentView !== 'experience') showView('experience');
                  return;
              }
              if (rpcJoinError && !isSupabaseMissingFunctionError(rpcJoinError)) {
                  const rpcUserMessage = mapArenaInviteRpcErrorToStatus(rpcJoinError);
                  if (rpcUserMessage) {
                      setArenaSessionStatus(rpcUserMessage, true);
                      return;
                  }
                  if (isArenaPermissionDeniedError(rpcJoinError)) {
                      setArenaSessionStatus('Droit refusé (RLS) pendant l’acceptation du code.', true);
                      return;
                  }
              }

              const { data: arenaRow, error: arenaLookupError } = await client
                  .from('arenas')
                  .select('*')
                  .eq('invite_code', inviteCode)
                  .maybeSingle();

              if (arenaLookupError) {
                  if (isSupabaseMissingRelationError(arenaLookupError)) {
                      setArenaSessionStatus('Arène indisponible: tables Supabase manquantes. Lance les migrations puis réessaie.', true);
                      return;
                  }
                  if (isArenaPermissionDeniedError(arenaLookupError)) {
                      setArenaSessionStatus('Droit refusé (RLS) pendant la recherche d’arène.', true);
                  } else {
                      setArenaSessionStatus(`Recherche impossible: ${arenaLookupError.message}`, true);
                  }
                  return;
              }
              if (!arenaRow?.id) {
                  setArenaSessionStatus('Code invalide: aucune arène trouvée.', true);
                  return;
              }
              if (arenaRow.is_closed || arenaRow.closed_at || arenaRow.status === 'closed') {
                  setArenaSessionStatus('Cette arène est fermée.', true);
                  return;
              }

              const { error: joinError } = await client.from('arena_participants').insert({
                  arena_id: arenaRow.id,
                  user_id: currentSession.user.id,
                  role: 'participant'
              });
              if (joinError && joinError.code !== '23505') {
                  logArenaProfileDiagnostic('joinArena.members_insert_error', { inviteCode, code: joinError.code || null, message: joinError.message || null }, true);
                  if (isSupabaseMissingRelationError(joinError)) {
                      setArenaSessionStatus('Arène indisponible: tables Supabase manquantes. Lance les migrations puis réessaie.', true);
                      return;
                  }
                  if (isArenaPermissionDeniedError(joinError)) {
                      setArenaSessionStatus('Droit refusé (RLS) pour rejoindre cette arène.', true);
                  } else {
                      setArenaSessionStatus(`Rejoint impossible: ${joinError.message}`, true);
                  }
                  return;
              }

              await setCurrentArena(arenaRow.id, arenaRow.invite_code || inviteCode);
              const guestBubbleResult = await ensureGuestBubbleForArena(client, arenaRow.id);
              if (!guestBubbleResult.ok) {
                  logArenaProfileDiagnostic('joinArena.ensure_guest_bubble_error', {
                      arenaId: arenaRow.id,
                      code: guestBubbleResult.error?.code || null,
                      message: guestBubbleResult.error?.message || null,
                  }, true);
              }
              logArenaProfileDiagnostic('joinArena.success', { arenaId: arenaRow.id, inviteCode: arenaRow.invite_code || inviteCode });
              setArenaSessionStatus(`Arène rejointe ✅ ${arenaRow.invite_code || inviteCode}`);
              if (currentView !== 'experience') showView('experience');
          }

          async function createArenaInviteFromProfile() {
              if (!currentSession?.user?.id) {
                  setArenaSessionStatus('Connecte-toi pour inviter des membres.', true);
                  return;
              }
              const ensured = await ensureArenaBoundToCurrentSession({ createIfMissing: true, silent: true });
              if (!ensured?.arena?.id) {
                  setArenaSessionStatus('Impossible de préparer ton arène pour l’invitation.', true);
                  return;
              }
              const inviteCode = normalizeRoomSlug(ensured.arena.invite_code || currentArenaInviteCode || '');
              if (!inviteCode) {
                  setArenaSessionStatus('Code d’invitation introuvable pour cette arène.', true);
                  return;
              }
              await setCurrentArena(ensured.arena.id, inviteCode);
              if (arenaInviteCodeInput) arenaInviteCodeInput.value = inviteCode;
              renderArenaInvitePreview(inviteCode);
              logArenaProfileDiagnostic('inviteCode.ready', { arenaId: ensured.arena.id, inviteCode });
              setArenaSessionStatus('Lien d’invitation prêt ✅');
          }

          async function restoreSession() {
              if (isInviteGuestMode) {
                  currentSession = null;
                  refreshAuthUi('Mode visiteur actif.');
                  return;
              }
              const client = buildSupabaseClient();
              if (!client) return;
              const { data } = await client.auth.getSession();
              currentSession = data?.session || null;
              if (!currentSession?.user) {
                  currentArenaInviteCode = '';
                  currentArenaParticipants = 1;
                  currentArenaId = 'default';
                  currentArenaRole = null;
                  if (experienceView) delete experienceView.dataset.arenaId;
                  renderArenaSessionBadge();
              }
              refreshAuthUi(currentSession ? 'Session restaurée.' : 'Pas de session active.');
              await syncSessionAndProfile({ silent: true });
              await fetchSooncutVocalsFromBucket();
          }

          function initSupabaseProfileCard() {
              const cfg = getSupabaseConfig();
              supabaseUrlInput.value = cfg.url || DEFAULT_SUPABASE_URL;
              supabaseKeyInput.value = cfg.key;
              if (supabaseUrlInput.value && cfg.key) {
                  setSupabaseStatus(`Configuration chargée (${maskApiKey(cfg.key)}).`);
                  setDbConnectionStatus('Base Supabase prête ✅');
              } else {
                  setSupabaseStatus('Renseigne URL + clé publishable pour activer Soonbucket.');
                  setDbConnectionStatus('Base Supabase non connectée (variables Vercel manquantes).', true);
              }

              supabaseSaveConfigBtn.addEventListener('click', () => {
                  const url = supabaseUrlInput.value.trim();
                  const key = supabaseKeyInput.value.trim();
                  localStorage.setItem(SUPABASE_LOCAL_KEYS.url, url);
                  localStorage.setItem(SUPABASE_LOCAL_KEYS.key, key);
                  setSupabaseStatus(`Configuration sauvegardée localement (${maskApiKey(key)}).`);
                  supabaseClient = null;
                  supabaseClientSignature = '';
                  soonbaseSchemaHealth = { checkedAt: 0, ok: false, missing: [], details: [] };
                  restoreSession();
              });

              supabaseTestBtn.addEventListener('click', () => {
                  testSupabaseConnection();
              });
              supabaseUploadBtn.addEventListener('click', () => {
                  uploadToSoonbucket();
              });
              supabaseProbeBtn.addEventListener('click', () => {
                  testSooncutFilesReadability();
              });
          }
          initSupabaseProfileCard();
          renderProfileIdentity();
          if (createArenaBtn) {
              createArenaBtn.hidden = true;
              createArenaBtn.disabled = true;
          }
          bindPress(authSignInBtn, signInWithEmail);
          bindPress(authSignUpBtn, signUpWithEmail);
          bindPress(authSignOutBtn, signOutSession);
          bindPress(inviteArenaBtn, createArenaInviteFromProfile);
          bindPress(arenaCopyInviteBtn, copyArenaInviteToClipboard);
          bindPress(arenaShareInviteBtn, shareArenaInvite);
          bindPress(joinArenaBtn, joinArenaFromProfile);
          if (joinArenaBtn) {
              joinArenaBtn.hidden = true;
              joinArenaBtn.disabled = true;
          }
          if (arenaInviteCodeInput) {
              arenaInviteCodeInput.readOnly = true;
              arenaInviteCodeInput.setAttribute('aria-label', 'Lien d’invitation');
          }
          arenaInviteCodeInput?.addEventListener('input', () => {
              const normalized = normalizeRoomSlug(arenaInviteCodeInput.value);
              if (arenaInviteCodeInput.value !== normalized) {
                  arenaInviteCodeInput.value = normalized;
              }
              renderArenaInvitePreview(normalized);
          });
          renderArenaInvitePreview(arenaInviteCodeInput?.value || currentArenaInviteCode || '');
          bindTap(profileEditBtn, openProfileEditPanel);
          bindTap(profileCancelBtn, closeProfileEditPanel);
          bindTap(profileSaveBtn, saveProfileIdentity);
          renderStoreCatalog();
          renderSessionHistory();
          renderArenaSessionBadge();
          refreshArenaInviteButton();
          async function promptGuestEntryForRoom(roomSlug) {
              if (!guestEntryModal || !guestPseudoInput || !guestEnterRoomBtn) return false;
              guestEntryModal.hidden = false;
              const storedPseudo = getStoredGuestPseudo({ roomSlug });
              guestPseudoInput.value = storedPseudo || '';
              guestPseudoInput.focus();
              return await new Promise((resolve) => {
                  const submit = async () => {
                      const checked = validateGuestPseudo(guestPseudoInput.value);
                      if (!checked.ok) {
                          if (guestPseudoError) guestPseudoError.textContent = checked.reason;
                          return;
                      }
                      const pseudo = normalizeGuestPseudo(checked.value);
                      const guestIdentity = getOrCreateGuestIdentity();
                      saveGuestPseudo({ roomSlug, pseudo });
                      const client = buildSupabaseClient();
                      const joinResult = await joinRoomAsGuest({ supabase: client, roomSlug, guestIdentity, pseudo });
                      if (joinResult.error) {
                          if (guestPseudoError) guestPseudoError.textContent = joinResult.error.message || 'Impossible de rejoindre la room.';
                          return;
                      }
                      guestEntryModal.hidden = true;
                      resolve(joinResult.data?.id || true);
                  };
                  guestEnterRoomBtn.onclick = submit;
              });
          }
          const inviteParams = new URLSearchParams(window.location.search);
          const inviteCodeFromUrl = extractRoomSlugFromUrl(inviteParams);
          if (inviteCodeFromUrl) {
              const invitedArenaId = `room-${inviteCodeFromUrl.toLowerCase()}`;
              isInviteGuestMode = true;
              currentArenaRole = 'guest';
              showView('experience');
              setCurrentArena(invitedArenaId, inviteCodeFromUrl).catch(() => {});
              if (arenaInviteCodeInput) arenaInviteCodeInput.value = inviteCodeFromUrl;
              renderArenaInvitePreview(inviteCodeFromUrl);
              promptGuestEntryForRoom(inviteCodeFromUrl).then((joinedArenaId) => {
                  if (!joinedArenaId) return;
                  if (typeof joinedArenaId === 'string') {
                      setCurrentArena(joinedArenaId, inviteCodeFromUrl).catch(() => {});
                  }
                  setArenaSessionStatus(`Invitation détectée ✅ Entrée visiteur dans la room ${inviteCodeFromUrl}.`);
                  showView('experience');
                  ensureAllAudioRunning();
              });
          }
          restoreSession();

          SAMPLE_LIBRARY.forEach(sample => {
              const option = document.createElement('option');
              option.value = sample.id;
              option.textContent = sample.name;
              sampleSelect.appendChild(option);
          });
          renderArenaTriangles();

          function updateSampleHint() {
              const sample = SAMPLE_LIBRARY.find(s => s.id === selectedSampleId) || SAMPLE_LIBRARY[0];
              const haloStyle = HALO_STYLE_LIBRARY.find((style) => style.id === selectedHaloStyleId) || HALO_STYLE_LIBRARY[0];
              sampleHint.textContent = `${sample.texture} · Halo « ${haloStyle.name} » : ${haloStyle.hint}`;
          }
          updateSampleHint();

          sampleSelect.addEventListener('change', () => {
              selectedSampleId = sampleSelect.value;
              updateSampleHint();
          });

          bubbleHaloStyle.addEventListener('change', () => {
              selectedHaloStyleId = bubbleHaloStyle.value;
              updateSampleHint();
          });

          function resize() {
              w = window.innerWidth;
              h = window.innerHeight;
              canvas.width = w;
              canvas.height = h;
          }
          window.addEventListener('resize', resize);
          resize();

          function getTouchFromEventById(e, touchId) {
              if (touchId == null) return null;
              const touchLists = [e.touches, e.changedTouches];
              for (const list of touchLists) {
                  if (!list || !list.length) continue;
                  for (let i = 0; i < list.length; i++) {
                      const touch = list[i];
                      if (touch?.identifier === touchId) return touch;
                  }
              }
              return null;
          }

          function getEventClientXY(e) {
              if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
                  return { x: e.clientX, y: e.clientY };
              }
              const trackedTouch = getTouchFromEventById(e, activeTouchId);
              if (trackedTouch) {
                  return { x: trackedTouch.clientX, y: trackedTouch.clientY };
              }
              const fallbackTouch = e.touches?.[0] || e.changedTouches?.[0];
              if (fallbackTouch) {
                  return { x: fallbackTouch.clientX, y: fallbackTouch.clientY };
              }
              return { x: w / 2, y: h / 2 };
          }

          function getMousePos(e) {
              const pointer = getEventClientXY(e);
              const rect = canvas.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              return {
                  x: (pointer.x - cx) / camera.zoom + camera.x,
                  y: (pointer.y - cy) / camera.zoom + camera.y
              };
          }

          function buildTraceBezierSegments(points, tension = 0.24) {
              if (!Array.isArray(points) || points.length < 2) return [];
              const len = points.length;
              const segments = [];
              for (let i = 0; i < len - 1; i++) {
                  const p0 = points[Math.max(0, i - 1)];
                  const p1 = points[i];
                  const p2 = points[i + 1];
                  const p3 = points[Math.min(len - 1, i + 2)];
                  const c1 = {
                      x: p1.x + (p2.x - p0.x) * tension,
                      y: p1.y + (p2.y - p0.y) * tension
                  };
                  const c2 = {
                      x: p2.x - (p3.x - p1.x) * tension,
                      y: p2.y - (p3.y - p1.y) * tension
                  };
                  segments.push({ p1, p2, c1, c2 });
              }
              return segments;
          }

          function sampleTraceBezierSegments(segments, samplesPerSegment = 16) {
              if (!Array.isArray(segments) || !segments.length) return [];
              const path = [];
              for (let i = 0; i < segments.length; i++) {
                  const seg = segments[i];
                  if (i === 0) path.push({ x: seg.p1.x, y: seg.p1.y });
                  for (let s = 0; s < samplesPerSegment; s++) {
                      const t = (s + 1) / samplesPerSegment;
                      const inv = 1 - t;
                      const x = inv * inv * inv * seg.p1.x + 3 * inv * inv * t * seg.c1.x + 3 * inv * t * t * seg.c2.x + t * t * t * seg.p2.x;
                      const y = inv * inv * inv * seg.p1.y + 3 * inv * inv * t * seg.c1.y + 3 * inv * t * t * seg.c2.y + t * t * t * seg.p2.y;
                      path.push({ x, y });
                  }
              }
              return path;
          }

          function buildSmoothedTraceRail(points) {
              return sampleTraceBezierSegments(buildTraceBezierSegments(points, 0.24), 16);
          }

          function shouldLockSceneInteractions() {
              return isTraceCamControlGestureActive;
          }

          function isInteractiveTarget(target) {
              const element = target instanceof Element ? target : target?.parentElement;
              if (!element) return false;
              return Boolean(element.closest(
                  '#bubblePanel, #bubblePropsPanel, #echoRecorderPanel, #traceListeningBtn, #traceCamControls, ' +
                  '#silenceDesYeuxPrompt, #silenceDesYeuxOverlay, #arenaTrianglePad, #bottomNav, ' +
                  '#soonTutoModal, #guestEntryModal, #homeView, #profileView, #echoHypnoseView'
              ));
          }

          function getTraceOverviewBaseZoom() {
              return Math.max(traceOverviewZoomMin, Math.min(0.55, Math.min(w, h) / (ARENA_RADIUS * 2.05)));
          }

          function clampTraceZoomScale(nextScale) {
              return Math.max(traceCameraControl.minZoomScale, Math.min(traceCameraControl.maxZoomScale, nextScale));
          }

          function updateTraceCamControlsVisibility() {
              if (!traceCamControls) return;
              const shouldShow = currentView === 'experience' && (isTraceListeningMode || isDrawingTraceRail || isTraceRailAutopilot);
              traceCamControls.classList.toggle('visible', shouldShow);
              updateTraceFlowButtons();
          }

          function updateTraceFlowButtons() {
              if (!traceCamControls) return;
              const armBtn = traceCamControls.querySelector('[data-trace-cam-action="trace-arm"]');
              const launchBtn = traceCamControls.querySelector('[data-trace-cam-action="trace-launch"]');
              const stopBtn = traceCamControls.querySelector('[data-trace-cam-action="trace-stop"]');
              const hasDraftTrace = traceRailPath.length > 1;
              const showArm = isTraceListeningMode && !isDrawingTraceRail && !isTraceRailAutopilot;
              const showLaunch = isTraceListeningMode && !isDrawingTraceRail && hasDraftTrace;
              const showStop = showLaunch || isTraceRailAutopilot;
              armBtn?.classList.toggle('trace-cam-btn--trace-flow-hidden', !showArm);
              launchBtn?.classList.toggle('trace-cam-btn--trace-flow-hidden', !showLaunch);
              stopBtn?.classList.toggle('trace-cam-btn--trace-flow-hidden', !showStop);
          }

          function resetTraceCameraControl(keepZoomScale = false) {
              traceCameraControl.panX = 0;
              traceCameraControl.panY = 0;
              if (!keepZoomScale) traceCameraControl.zoomScale = 1;
          }

          function finalizeTraceRailFromDraft() {
              if (traceRailPath.length < 2) return;
              if (isDrawingTraceRail) setDrawingTraceRail(false);
              setTraceListeningMode(false);
              traceRailPath = buildSmoothedTraceRail(traceRailPath);
              isTraceRailAutopilot = true;
              traceRailTargetIndex = 0;
              traceRailDirection = 1;
              ui.textContent = 'Voyage sonore auto lancé : tracé plume Bézier validé.';
              helperTips.textContent = 'Traversée active. Étape 4/4 : appuie sur ⏹ pour stopper et quitter.';
              updateTraceCamControlsVisibility();
          }

          function armTraceFlow() {
              isTraceRailAutopilot = false;
              setTraceListeningMode(true);
              setDrawingTraceRail(false);
              traceExitConfirmUntil = 0;
              traceRailPath = [];
              traceRailTargetIndex = 0;
              traceRailDirection = 1;
              ui.textContent = 'Mode tracé activé : touche l’océan pour dessiner.';
              helperTips.textContent = 'Étape 2/4 : trace ton chemin. Étape 3 : valide avec ✅.';
              updateTraceCamControlsVisibility();
          }

          function stopTraceFlow() {
              isTraceRailAutopilot = false;
              setDrawingTraceRail(false);
              setTraceListeningMode(false);
              traceRailPath = [];
              traceRailTargetIndex = 0;
              traceRailDirection = 1;
              traceExitConfirmUntil = 0;
              resetTraceCameraControl();
              ui.textContent = '';
              rotateHelperTip();
              updateTraceCamControlsVisibility();
          }

          function applyTraceCameraAction(action) {
              if (action === 'trace-arm') {
                  armTraceFlow();
                  return;
              }
              if (action === 'trace-launch') {
                  if (traceRailPath.length > 1) finalizeTraceRailFromDraft();
                  return;
              }
              if (action === 'trace-stop') {
                  stopTraceFlow();
                  return;
              }
              if (!(isTraceListeningMode || isDrawingTraceRail || isTraceRailAutopilot)) return;
              const baseZoom = getTraceOverviewBaseZoom();
              const worldZoom = Math.max(traceOverviewZoomMin, Math.min(traceOverviewZoomMax, baseZoom * traceCameraControl.zoomScale));
              const panStep = Math.max(26, 44 / Math.max(0.3, worldZoom));
              if (action === 'zoom-in') {
                  traceCameraControl.zoomScale = clampTraceZoomScale(traceCameraControl.zoomScale * 1.14);
                  return;
              }
              if (action === 'zoom-out') {
                  traceCameraControl.zoomScale = clampTraceZoomScale(traceCameraControl.zoomScale / 1.14);
                  return;
              }
              if (action === 'up') {
                  traceCameraControl.panY -= panStep;
              } else if (action === 'down') {
                  traceCameraControl.panY += panStep;
              } else if (action === 'left') {
                  traceCameraControl.panX -= panStep;
              } else if (action === 'right') {
                  traceCameraControl.panX += panStep;
              }
          }

          function updateTraceCamMenuDragPosition() {
              if (!traceCamControls) return;
              traceCamControls.style.setProperty('--trace-cam-drag-x', `${traceCamMenuDrag.offsetX}px`);
              traceCamControls.style.setProperty('--trace-cam-drag-y', `${traceCamMenuDrag.offsetY}px`);
          }

          function clampTraceCamMenuDrag(nextX, nextY) {
              const maxX = Math.max(0, Math.floor((window.innerWidth - 190) * 0.5));
              const minY = -Math.max(80, Math.floor(window.innerHeight * 0.62));
              const maxY = 0;
              return {
                  x: Math.max(-maxX, Math.min(maxX, nextX)),
                  y: Math.max(minY, Math.min(maxY, nextY))
              };
          }

          function setArenaTriangleStatus(message, isError = false) {
              if (!arenaTriangleStatus) return;
              arenaTriangleStatus.textContent = message;
              arenaTriangleStatus.style.color = isError ? 'rgba(255, 172, 172, 0.95)' : 'rgba(255, 220, 220, 0.88)';
          }

          function isAudioObject(fileName = '') {
              return /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName);
          }

          function buildPublicSoonbucketUrl(objectPath) {
              const projectUrl = supabaseUrlInput.value.trim() || getSupabaseConfig().url || DEFAULT_SUPABASE_URL;
              if (!projectUrl || !objectPath) return null;
              const cleanBase = projectUrl.replace(/\/+$/g, '');
              const cleanPath = objectPath.replace(/^\/+/g, '');
              return `${cleanBase}/storage/v1/object/public/${SUPABASE_BUCKET}/${cleanPath}`;
          }

          function buildFallbackSooncutVocals() {
              const tracks = Array.from({ length: ARENA_TRIANGLE_COUNT }, (_, index) => {
                  const fileNumber = String(index + 1).padStart(3, '0');
                  const name = `extrait_${fileNumber}.mp3`;
                  const objectPath = `${SOONCUT_BUCKET_FOLDER}/${name}`;
                  const url = buildPublicSoonbucketUrl(objectPath);
                  return url ? { name, objectPath, url } : null;
              }).filter(Boolean);
              return tracks;
          }

          async function fetchSooncutVocalsFromBucket() {
              const client = buildSupabaseClient();
              if (!client) {
                  sooncutBucketVocals = buildFallbackSooncutVocals();
                  if (sooncutBucketVocals.length) {
                      setArenaTriangleStatus(`Mode URL publique Soonbucket activé (${sooncutBucketVocals.length} extraits).`);
                      renderArenaTriangles();
                      return sooncutBucketVocals;
                  }
                  setArenaTriangleStatus('Lucioles Sooncut: configure Supabase pour charger les vocaux.', true);
                  return [];
              }

              const { data, error } = await client.storage.from(SUPABASE_BUCKET).list(SOONCUT_BUCKET_FOLDER, {
                  limit: 100,
                  offset: 0,
                  sortBy: { column: 'name', order: 'asc' },
              });

              if (error) {
                  sooncutBucketVocals = buildFallbackSooncutVocals();
                  if (sooncutBucketVocals.length) {
                      setArenaTriangleStatus(`Listing refusé, fallback URL publique activé (${sooncutBucketVocals.length} extraits).`);
                      renderArenaTriangles();
                      return sooncutBucketVocals;
                  }
                  setArenaTriangleStatus(`Sooncut bucket: ${error.message}`, true);
                  return [];
              }

              const audioFiles = (data || []).filter((item) => item?.name && isAudioObject(item.name));
              if (!audioFiles.length) {
                  sooncutBucketVocals = buildFallbackSooncutVocals();
                  if (sooncutBucketVocals.length) {
                      setArenaTriangleStatus(`Aucun fichier listé, fallback URL publique activé (${sooncutBucketVocals.length} extraits).`);
                      renderArenaTriangles();
                      return sooncutBucketVocals;
                  }
                  setArenaTriangleStatus(`Aucun vocal trouvé dans ${SUPABASE_BUCKET}/${SOONCUT_BUCKET_FOLDER}.`, true);
                  return [];
              }

              const resolved = audioFiles.map((item) => {
                  const objectPath = `${SOONCUT_BUCKET_FOLDER}/${item.name}`;
                  const url = buildPublicSoonbucketUrl(objectPath);
                  return url ? { name: item.name, objectPath, url } : null;
              });

              sooncutBucketVocals = resolved.filter(Boolean);
              setArenaTriangleStatus(`Vocaux chargés: ${sooncutBucketVocals.length} depuis ${SUPABASE_BUCKET}/${SOONCUT_BUCKET_FOLDER}.`);
              renderArenaTriangles();
              return sooncutBucketVocals;
          }

          function pickRandomSooncutTrack() {
              if (!sooncutBucketVocals.length) return null;
              const randomIndex = Math.floor(Math.random() * sooncutBucketVocals.length);
              return sooncutBucketVocals[randomIndex] || null;
          }

          async function resolveSooncutTrackUrls(track) {
              if (!track?.objectPath) return [];
              const urls = [];
              const client = buildSupabaseClient();

              if (track.url) urls.push(track.url);

              if (client) {
                  const { data: publicData } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(track.objectPath);
                  if (publicData?.publicUrl) urls.push(publicData.publicUrl);

                  const { data: signedData, error: signedError } = await client
                      .storage
                      .from(SUPABASE_BUCKET)
                      .createSignedUrl(track.objectPath, 60 * 10);
                  if (!signedError && signedData?.signedUrl) urls.push(signedData.signedUrl);
              }

              const fallbackUrl = buildPublicSoonbucketUrl(track.objectPath);
              if (fallbackUrl) urls.push(fallbackUrl);

              return Array.from(new Set(urls.filter(Boolean)));
          }

          function tryPlayArenaUrl(url, trackName) {
              return new Promise((resolve) => {
                  try {
                      const audio = activeArenaAudio || new Audio();
                      const context = ensureAudioContext();
                      ensureAllAudioRunning();
                      if (activeArenaAudio) {
                          activeArenaAudio.pause();
                          activeArenaAudio.currentTime = 0;
                      }
                      audio.preload = 'auto';
                      audio.volume = 0.98;
                      audio.crossOrigin = 'anonymous';
                      if (context && masterGainNode) {
                          ensureMediaElementRoutedToMaster(audio, context, 1);
                      }
                      audio.src = url;
                      activeArenaAudio = audio;
                      const startedAt = performance.now();
                      let settled = false;
                      const settle = (durationMs) => {
                          if (settled) return;
                          settled = true;
                          audio.removeEventListener('ended', onEnded);
                          audio.removeEventListener('error', onError);
                          resolve(Math.max(0, durationMs || 0));
                      };
                      const onEnded = () => settle(performance.now() - startedAt);
                      const onError = () => settle(0);
                      audio.addEventListener('ended', onEnded, { once: true });
                      audio.addEventListener('error', onError, { once: true });
                      audio.play().then(() => {
                          setArenaTriangleStatus(`Lecture bucket aléatoire: ${trackName}`);
                          const fallbackDuration = Number.isFinite(audio.duration) && audio.duration > 0
                              ? audio.duration * 1000
                              : FIREFLY_AUDIO_MAX_MS;
                          setTimeout(() => settle(fallbackDuration), Math.max(1200, fallbackDuration + 350));
                      }).catch(() => settle(0));
                  } catch (_) {
                      resolve(0);
                  }
              });
          }

          function ensureMediaElementRoutedToMaster(audioEl, context, gainValue = 1) {
              if (!audioEl || !context || !masterGainNode) return;
              const normalizedGain = Math.max(0, Number.isFinite(gainValue) ? gainValue : 1);
              let mediaGainNode = routedMediaElementGainNodes.get(audioEl) || null;
              if (!mediaGainNode) {
                  mediaGainNode = context.createGain();
                  mediaGainNode.connect(masterGainNode);
                  routedMediaElementGainNodes.set(audioEl, mediaGainNode);
              }
              mediaGainNode.gain.value = normalizedGain;
              if (routedMediaElementSources.has(audioEl)) return;
              const mediaSourceNode = context.createMediaElementSource(audioEl);
              mediaSourceNode.connect(mediaGainNode);
              routedMediaElementSources.set(audioEl, mediaSourceNode);
          }

          async function playSooncutBucketTrack(track) {
              if (!track?.name) return 0;
              const candidateUrls = await resolveSooncutTrackUrls(track);
              if (!candidateUrls.length) return 0;

              for (const url of candidateUrls) {
                  const playedDuration = await tryPlayArenaUrl(url, track.name);
                  if (playedDuration > 0) return playedDuration;
              }

              setArenaTriangleStatus(`Lecture impossible pour ${track.name}`, true);
              return 0;
          }

          function triggerArenaSample(sampleId) {
              const sample = SAMPLE_LIBRARY.find(s => s.id === sampleId);
              const context = ensureAudioContext();
              if (!sample || !context || !masterGainNode) return;

              const gain = context.createGain();
              const filter = context.createBiquadFilter();
              const now = context.currentTime;
              const attack = 0.02;
              const hold = 0.32;
              const release = 0.65;
              const peak = Math.max(0.05, Math.min(0.48, (sample.gain ?? 0.2) * 1.4));

              filter.type = 'lowpass';
              filter.frequency.value = sample.baseCutoff ?? 4200;
              filter.Q.value = 0.6;

              gain.gain.setValueAtTime(0.0001, now);
              gain.gain.exponentialRampToValueAtTime(peak, now + attack);
              gain.gain.setValueAtTime(peak, now + attack + hold);
              gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);
              gain.connect(filter);
              filter.connect(masterGainNode);

              if (sample.type === 'noise') {
                  const source = context.createBufferSource();
                  source.buffer = buildSyntheticBuffer(context, 1.1);
                  source.connect(gain);
                  source.start(now);
                  source.stop(now + attack + hold + release + 0.08);
                  return;
              }

              const source = context.createOscillator();
              source.type = sample.type || 'sine';
              source.frequency.setValueAtTime(sample.freq || 220, now);
              source.connect(gain);
              source.start(now);
              source.stop(now + attack + hold + release + 0.08);
          }

          function ensureArenaFireflies() {
              if (ARENA_FIREFLIES.length) return;
              const baseDistance = ARENA_RADIUS * 0.52;
              for (let index = 0; index < ARENA_TRIANGLE_COUNT; index++) {
                  const angle = (index / ARENA_TRIANGLE_COUNT) * Math.PI * 2 + Math.random() * 0.55;
                  const radialJitter = (Math.random() - 0.5) * 260;
                  const baseRadius = Math.max(220, baseDistance + radialJitter);
                  ARENA_FIREFLIES.push({
                      id: `firefly-${index + 1}`,
                      index,
                      sampleId: SOONCUT_TRIANGLE_SAMPLE_IDS[index % SOONCUT_TRIANGLE_SAMPLE_IDS.length],
                      bucketTrack: null,
                      x: Math.cos(angle) * baseRadius,
                      y: Math.sin(angle) * baseRadius,
                      baseX: Math.cos(angle) * baseRadius,
                      baseY: Math.sin(angle) * baseRadius,
                      vx: 0,
                      vy: 0,
                      driftPhase: Math.random() * Math.PI * 2,
                      driftSpeed: 0.00016 + Math.random() * 0.00028,
                      driftRadius: 30 + Math.random() * 34,
                      size: 6 + Math.random() * 3,
                      glow: 0.45 + Math.random() * 0.5,
                      pulseFreq: 0.42 + Math.random() * 0.72,
                      pulsePhase: Math.random() * Math.PI * 2,
                      lastTriggerAt: 0,
                      linkedCooldownUntil: 0,
                      attachedToTail: false,
                      attachedOrder: -1,
                      attachedAt: 0,
                      playbackEndsAt: 0,
                      isReleased: false,
                      containedInBubbleId: null,
                      placedTriangleId: null,
                      triangleVertexIndex: -1,
                      bubbleOrbitIndex: index % 3,
                      nextBubbleSwitchAt: performance.now() + 4200 + Math.random() * 3600,
                      destinyX: Math.cos(angle) * baseRadius,
                      destinyY: Math.sin(angle) * baseRadius,
                      nextDestinyAt: performance.now() + 3600 + Math.random() * 4200
                  });
              }
          }

          function renderArenaTriangles() {
              ensureArenaFireflies();
              if (arenaTrianglePad) {
                  arenaTrianglePad.innerHTML = '';
                  arenaTrianglePad.setAttribute('aria-hidden', 'true');
              }

              ARENA_FIREFLIES.forEach((firefly, index) => {
                  firefly.sampleId = SOONCUT_TRIANGLE_SAMPLE_IDS[index % SOONCUT_TRIANGLE_SAMPLE_IDS.length];
                  firefly.bucketTrack = sooncutBucketVocals.length
                      ? sooncutBucketVocals[index % sooncutBucketVocals.length]
                      : null;
              });
          }

          function getShipTailPosition() {
              const speed = Math.hypot(ship.vx, ship.vy);
              let backX = Math.sin(ship.angle);
              let backY = -Math.cos(ship.angle);
              if (speed > 0.04) {
                  const invSpeed = 1 / Math.max(0.0001, speed);
                  backX = -ship.vx * invSpeed;
                  backY = -ship.vy * invSpeed;
              }
              return {
                  x: ship.x + backX * 16,
                  y: ship.y + backY * 16
              };
          }

          function getShipMouthPosition() {
              const forwardX = Math.cos(ship.angle - Math.PI / 2);
              const forwardY = Math.sin(ship.angle - Math.PI / 2);
              return {
                  x: ship.x + forwardX * 20,
                  y: ship.y + forwardY * 20
              };
          }

          function updateGuestFishSchool() {
              return;
          }

          function drawGuestFish(renderCtx, fish) {
              if (!renderCtx || !fish) return;
              renderCtx.save();
              renderCtx.translate(fish.x, fish.y);
              renderCtx.rotate(fish.angle || 0);
              renderCtx.scale(fish.scale || 0.4, fish.scale || 0.4);
              renderCtx.globalAlpha = fish.opacity ?? 0.72;
              renderCtx.globalCompositeOperation = 'screen';

              const halo = renderCtx.createRadialGradient(0, 1, 0, 0, 1, 26);
              halo.addColorStop(0, 'rgba(255, 206, 231, 0.26)');
              halo.addColorStop(1, 'rgba(255, 170, 218, 0)');
              renderCtx.fillStyle = halo;
              renderCtx.beginPath();
              renderCtx.ellipse(0, 2, 24, 20, 0, 0, Math.PI * 2);
              renderCtx.fill();

              const bodyGrad = renderCtx.createLinearGradient(-8, -14, 8, 18);
              bodyGrad.addColorStop(0, 'rgba(255, 235, 246, 0.94)');
              bodyGrad.addColorStop(0.55, fish.color || 'rgba(255, 181, 218, 0.84)');
              bodyGrad.addColorStop(1, 'rgba(255, 134, 198, 0.12)');
              renderCtx.fillStyle = bodyGrad;
              renderCtx.beginPath();
              renderCtx.moveTo(0, -13);
              renderCtx.bezierCurveTo(-7, -10, -9, -1, -6, 8);
              renderCtx.bezierCurveTo(-3, 14, 3, 14, 6, 8);
              renderCtx.bezierCurveTo(9, -1, 7, -10, 0, -13);
              renderCtx.fill();

              renderCtx.fillStyle = 'rgba(255, 175, 220, 0.7)';
              renderCtx.beginPath();
              renderCtx.moveTo(0, 10);
              renderCtx.bezierCurveTo(-4, 14, -5, 19, -1, 23);
              renderCtx.quadraticCurveTo(0, 20, 1, 23);
              renderCtx.bezierCurveTo(5, 19, 4, 14, 0, 10);
              renderCtx.fill();

              const fishLabel = String(fish.id || 'guest').slice(0, 24);
              renderCtx.globalCompositeOperation = 'source-over';
              renderCtx.globalAlpha = 0.95;
              renderCtx.font = '700 11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
              renderCtx.textAlign = 'center';
              renderCtx.textBaseline = 'middle';
              renderCtx.fillStyle = 'rgba(16, 8, 25, 0.65)';
              renderCtx.fillRect(-26, -34, 52, 15);
              renderCtx.fillStyle = 'rgba(245, 233, 255, 0.96)';
              renderCtx.fillText(fishLabel, 0, -26, 50);

              renderCtx.restore();
          }

          function queueFireflyVocalPlayback(firefly) {
              fireflyVocalQueue = fireflyVocalQueue
                  .catch(() => 0)
                  .then(() => triggerFireflyVocalPlayback(firefly));
              return fireflyVocalQueue;
          }

          async function triggerAttachedFireflyPlayback(firefly, now) {
              if (!firefly) return;
              isFireflyVocalPlaying = true;
              const provisionalDuration = FIREFLY_AUDIO_MIN_MS + Math.random() * (FIREFLY_AUDIO_MAX_MS - FIREFLY_AUDIO_MIN_MS);
              firefly.playbackEndsAt = now + provisionalDuration;
              fireflyVocalGateUntil = firefly.playbackEndsAt;
              const duration = await queueFireflyVocalPlayback(firefly);
              const effectiveDuration = Math.max(FIREFLY_AUDIO_MIN_MS, duration || provisionalDuration);
              firefly.playbackEndsAt = performance.now();
              fireflyVocalGateUntil = performance.now() + Math.min(220, effectiveDuration * 0.08);
              isFireflyVocalPlaying = false;
          }

          function getBubbleTriangleVertices(bubble) {
              if (!bubble) return [];
              const radius = Math.max(24, (bubble.r || 42) * 0.52);
              const now = performance.now();
              const slowSpin = (now * 0.00011) + (bubble.id ? bubble.id.length * 0.06 : 0);
              const elasticWave = Math.sin(now * 0.0021 + (bubble.id ? bubble.id.length : 0));
              return [0, 1, 2].map((idx) => {
                  const angle = slowSpin + (idx / 3) * Math.PI * 2 - Math.PI / 2;
                  const localStretch = 1 + Math.sin(now * 0.0028 + idx * 2.15 + elasticWave) * 0.085;
                  const localRadius = radius * localStretch;
                  return {
                      x: bubble.x + Math.cos(angle) * localRadius,
                      y: bubble.y + Math.sin(angle) * localRadius
                  };
              });
          }

          function delay(ms) {
              return new Promise((resolve) => setTimeout(resolve, ms));
          }

          function releaseSingleFireflyFromBubble(sourceBubble, now) {
              const firefly = ARENA_FIREFLIES.find((candidate) => !candidate.isReleased);
              if (!firefly) return false;
              const angle = Math.random() * Math.PI * 2;
              const startRadius = Math.max(30, (sourceBubble?.r || 64) * (0.35 + Math.random() * 0.2));
              const startX = (sourceBubble?.x || 0) + Math.cos(angle) * startRadius;
              const startY = (sourceBubble?.y || 0) + Math.sin(angle) * startRadius;
              firefly.isReleased = true;
              firefly.containedInBubbleId = null;
              firefly.placedTriangleId = null;
              firefly.triangleVertexIndex = -1;
              firefly.attachedToTail = false;
              firefly.attachedOrder = -1;
              firefly.x = startX;
              firefly.y = startY;
              firefly.destinyX = startX + Math.cos(angle) * (160 + Math.random() * 120);
              firefly.destinyY = startY + Math.sin(angle) * (120 + Math.random() * 140);
              firefly.vx = Math.cos(angle) * (0.8 + Math.random() * 0.9);
              firefly.vy = Math.sin(angle) * (0.5 + Math.random() * 0.8);
              firefly.linkedCooldownUntil = now + 1200;
              firefly.nextDestinyAt = now + 1400 + Math.random() * 1200;
              return true;
          }

          function releaseInitialFirefliesFromBubble(sourceBubble, now) {
              if (hasReleasedInitialFireflies) return;
              hasReleasedInitialFireflies = true;
              fireflyReleaseSequenceActive = true;
              nextFireflyReleaseAt = now + FIREFLY_RELEASE_INTERVAL_MS;
              releaseSingleFireflyFromBubble(sourceBubble, now);
          }

          async function triggerFireflyVocalPlayback(firefly) {
              if (!firefly) return 0;
              if (!firefly.bucketTrack && !sooncutBucketVocals.length) {
                  await fetchSooncutVocalsFromBucket();
              }
              if (!firefly.bucketTrack && sooncutBucketVocals.length) {
                  firefly.bucketTrack = pickRandomSooncutTrack();
              }
              if (firefly.bucketTrack) {
                  const playedDuration = await playSooncutBucketTrack(firefly.bucketTrack);
                  if (playedDuration > 0) return playedDuration;
              }
              triggerArenaSample(firefly.sampleId);
              return 1200;
          }

          function getAttachedFirefliesSorted() {
              return ARENA_FIREFLIES
                  .filter((firefly) => firefly.attachedToTail)
                  .sort((a, b) => a.attachedOrder - b.attachedOrder);
          }

          function buildBubbleTrailPath() {
              const mouth = getShipMouthPosition();
              const tail = getShipTailPosition();
              const points = [mouth, tail];
              const segmentCount = 28;
              for (let i = 0; i < segmentCount; i++) {
                  const trailIndex = Math.max(0, ship.trail.length - 1 - i * 2);
                  const trailRef = ship.trail[trailIndex];
                  if (trailRef) points.push({ x: trailRef.x, y: trailRef.y });
              }
              return points;
          }

          function getPathPointAt(path, normalizedT) {
              if (!path?.length) return null;
              const t = Math.max(0, Math.min(1, normalizedT));
              const idx = t * (path.length - 1);
              const low = Math.floor(idx);
              const high = Math.min(path.length - 1, low + 1);
              const ratio = idx - low;
              return {
                  x: path[low].x * (1 - ratio) + path[high].x * ratio,
                  y: path[low].y * (1 - ratio) + path[high].y * ratio
              };
          }

          function getDistanceToPath(path, point) {
              if (!path || path.length < 2) return Number.POSITIVE_INFINITY;
              let best = Number.POSITIVE_INFINITY;
              for (let i = 0; i < path.length - 1; i++) {
                  const a = path[i];
                  const b = path[i + 1];
                  const abx = b.x - a.x;
                  const aby = b.y - a.y;
                  const ab2 = abx * abx + aby * aby || 1;
                  const apx = point.x - a.x;
                  const apy = point.y - a.y;
                  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
                  const cx = a.x + abx * t;
                  const cy = a.y + aby * t;
                  best = Math.min(best, Math.hypot(point.x - cx, point.y - cy));
              }
              return best;
          }

          function getStoredBubbleFireflies(bubble) {
              if (!bubble) return [];
              if (!Array.isArray(bubble.storedFireflyIds)) bubble.storedFireflyIds = [];
              return bubble.storedFireflyIds
                  .map((id) => ARENA_FIREFLIES.find((firefly) => firefly.id === id))
                  .filter(Boolean);
          }

          function normalizeAttachedOrders() {
              getAttachedFirefliesSorted().forEach((firefly, idx) => {
                  firefly.attachedOrder = idx;
              });
          }

          function attachSingleFireflyToTail(firefly, now) {
              if (!firefly || firefly.attachedToTail) return;
              const attached = getAttachedFirefliesSorted();
              if (attached.length >= FIREFLY_TAIL_MAX_ATTACHED) return;
              firefly.attachedToTail = true;
              firefly.attachedOrder = attached.length;
              firefly.attachedAt = now;
              firefly.linkedCooldownUntil = now + 900;
              firefly.vx *= 0.25;
              firefly.vy *= 0.25;
              normalizeAttachedOrders();
              setArenaTriangleStatus(`Luciole accrochée à la traînée (${attached.length + 1}/${FIREFLY_TAIL_MAX_ATTACHED}).`);
              void triggerAttachedFireflyPlayback(firefly, now);
          }

          function depositOldestAttachedFireflyIntoBubble(bubble, now) {
              const attached = getAttachedFirefliesSorted();
              if (!attached.length) return false;
              if (!Array.isArray(bubble.storedFireflyIds)) bubble.storedFireflyIds = [];
              if (bubble.storedFireflyIds.length >= 3) {
                  setArenaTriangleStatus(`${bubble.label || 'Cette bulle sonore'} contient déjà 3 lucioles.`);
                  return false;
              }
              const firefly = attached[0];
              firefly.attachedToTail = false;
              firefly.attachedOrder = -1;
              firefly.playbackEndsAt = 0;
              firefly.containedInBubbleId = bubble.id;
              firefly.triangleVertexIndex = bubble.storedFireflyIds.length;
              firefly.linkedCooldownUntil = now + 600;
              firefly.vx = 0;
              firefly.vy = 0;
              firefly.x = bubble.x;
              firefly.y = bubble.y;
              bubble.storedFireflyIds.push(firefly.id);
              bubble.trianglePlaybackLockUntil = 0;
              bubble.isTrianglePlaybackActive = false;
              normalizeAttachedOrders();
              const storedCount = bubble.storedFireflyIds.length;
              if (storedCount >= 3) {
                  setArenaTriangleStatus(`Triangle de 3 lucioles formé dans ${bubble.label || 'la bulle sonore'}.`);
              } else {
                  setArenaTriangleStatus(`Luciole déposée dans ${bubble.label || 'la bulle sonore'} (${storedCount}/3).`);
              }
              return true;
          }

          function maybePlayBubbleStoredVocal(bubble) {
              const stored = getStoredBubbleFireflies(bubble);
              if (stored.length < 3) return;
              const now = performance.now();
              if (bubble.trianglePlaybackLockUntil && now < bubble.trianglePlaybackLockUntil) return;
              if (bubble.isTrianglePlaybackActive) return;
              bubble.isTrianglePlaybackActive = true;
              bubble.trianglePlaybackLockUntil = now + 60000;
              const trio = stored.slice(0, 3);
              setArenaTriangleStatus(`Bulle traversée : lecture séquentielle des 3 vocaux dans ${bubble.label || 'la bulle sonore'}.`);
              (async () => {
                  try {
                      for (let i = 0; i < trio.length; i++) {
                          await queueFireflyVocalPlayback(trio[i]);
                      }
                  } finally {
                      bubble.isTrianglePlaybackActive = false;
                  }
              })();
          }

          function updateArenaFireflies() {
              if (!ARENA_FIREFLIES.length) return;
              const now = performance.now();
              const timeSeconds = now * 0.001;
              const tail = getShipTailPosition();
              const bubbleTrailPath = buildBubbleTrailPath();

              if (fireflyReleaseSequenceActive && now >= nextFireflyReleaseAt) {
                  const spawnAngle = Math.random() * Math.PI * 2;
                  const spawnRadius = 180 + Math.random() * (ARENA_RADIUS * 0.55);
                  const pseudoBubble = {
                      x: Math.cos(spawnAngle) * spawnRadius,
                      y: Math.sin(spawnAngle) * spawnRadius,
                      r: 64
                  };
                  const released = releaseSingleFireflyFromBubble(pseudoBubble, now);
                  if (released) {
                      nextFireflyReleaseAt = now + FIREFLY_RELEASE_INTERVAL_MS;
                  } else {
                      fireflyReleaseSequenceActive = false;
                  }
              }

              ARENA_FIREFLIES.forEach((firefly, idx) => {
                  if (!firefly.isReleased) return;
                  const pulse = (Math.sin(timeSeconds * firefly.pulseFreq * 2 * Math.PI + firefly.pulsePhase) + 1) * 0.5;
                  firefly.glow = firefly.attachedToTail ? (0.48 + pulse * 0.52) : (0.34 + pulse * 0.66);
                  if (firefly.containedInBubbleId) {
                      const hostBubble = BUBBLES.find((bubble) => bubble.id === firefly.containedInBubbleId);
                      if (hostBubble) {
                          const vertices = getBubbleTriangleVertices(hostBubble);
                          const vertex = vertices[firefly.triangleVertexIndex] || { x: hostBubble.x, y: hostBubble.y };
                          firefly.x = vertex.x;
                          firefly.y = vertex.y;
                      }
                      firefly.vx = 0;
                      firefly.vy = 0;
                      return;
                  }
                  if (firefly.placedTriangleId) {
                      const placedTriangle = PLACED_FIREFLY_TRIANGLES.find((triangle) => triangle.id === firefly.placedTriangleId);
                      if (placedTriangle) {
                          const angleBase = -Math.PI / 2 + (firefly.triangleVertexIndex / 3) * Math.PI * 2;
                          placedTriangle.spin = (placedTriangle.spin || 0) + (placedTriangle.spinSpeed || 0.00014);
                          const elasticPhase = (placedTriangle.elasticPhase || 0) + timeSeconds * 1.5;
                          const elasticPulse = 1 + Math.sin(elasticPhase + firefly.triangleVertexIndex * 2.094) * (placedTriangle.elasticAmp || 0.07);
                          const radius = (placedTriangle.baseRadius || placedTriangle.radius || 46) * elasticPulse;
                          const angle = angleBase + (placedTriangle.spin || 0);
                          firefly.x = placedTriangle.x + Math.cos(angle) * radius;
                          firefly.y = placedTriangle.y + Math.sin(angle) * radius;
                      }
                      firefly.vx = 0;
                      firefly.vy = 0;
                      return;
                  }
                  if (firefly.attachedToTail) {
                      const targetPos = getPathPointAt(
                          bubbleTrailPath,
                          FIREFLY_ATTACHED_SPACING_TARGETS[Math.max(0, Math.min(FIREFLY_ATTACHED_SPACING_TARGETS.length - 1, firefly.attachedOrder))] ?? 0.7
                      ) || tail;
                      const targetX = targetPos.x;
                      const targetY = targetPos.y;

                      const spring = 0.046;
                      firefly.vx += (targetX - firefly.x) * spring + ship.vx * 0.005;
                      firefly.vy += (targetY - firefly.y) * spring + ship.vy * 0.005;
                      firefly.vx *= 0.9;
                      firefly.vy *= 0.9;
                      firefly.x += firefly.vx;
                      firefly.y += firefly.vy;
                      return;
                  }
                  firefly.driftPhase += firefly.driftSpeed * 10.2;
                  if (now >= firefly.nextBubbleSwitchAt) {
                      firefly.bubbleOrbitIndex = Math.floor(Math.random() * Math.max(1, BUBBLES.length || 1));
                      firefly.nextBubbleSwitchAt = now + 5400 + Math.random() * 4200;
                  }
                  const anchorBubble = BUBBLES.length ? BUBBLES[firefly.bubbleOrbitIndex % BUBBLES.length] : null;
                  const anchorX = anchorBubble ? anchorBubble.x : firefly.baseX;
                  const anchorY = anchorBubble ? anchorBubble.y : firefly.baseY;
                  if (now >= firefly.nextDestinyAt) {
                      const orbitAngle = firefly.driftPhase + idx * 0.37;
                      const radius = firefly.driftRadius * (0.75 + Math.sin(timeSeconds * 0.22 + idx) * 0.15);
                      firefly.destinyX = anchorX + Math.cos(orbitAngle) * radius;
                      firefly.destinyY = anchorY + Math.sin(orbitAngle * 0.7) * radius;
                      firefly.nextDestinyAt = now + 3200 + Math.random() * 3800;
                  }

                  const microCurrentX = Math.sin(timeSeconds * (0.28 + idx * 0.004) + firefly.pulsePhase) * 0.009;
                  const microCurrentY = Math.cos(timeSeconds * (0.24 + idx * 0.005) + firefly.pulsePhase * 1.3) * 0.009;
                  firefly.vx += (firefly.destinyX - firefly.x) * 0.00036 + microCurrentX;
                  firefly.vy += (firefly.destinyY - firefly.y) * 0.00036 + microCurrentY;
                  firefly.vx *= 0.9935;
                  firefly.vy *= 0.9935;
                  const driftSpeed = Math.hypot(firefly.vx, firefly.vy);
                  if (driftSpeed > 0.22) {
                      const limiter = 0.22 / driftSpeed;
                      firefly.vx *= limiter;
                      firefly.vy *= limiter;
                  }
                  firefly.x += firefly.vx;
                  firefly.y += firefly.vy;
                  const theta = Math.atan2(firefly.y, firefly.x);
                  const arenaLimit = sampleArenaRadius(theta) - Math.max(8, firefly.size + 2);
                  const centerDist = Math.hypot(firefly.x, firefly.y);
                  if (centerDist > arenaLimit) {
                      const normal = sampleArenaNormal(theta);
                      const penetration = centerDist - arenaLimit;
                      firefly.x -= normal.x * penetration;
                      firefly.y -= normal.y * penetration;
                      const outward = firefly.vx * normal.x + firefly.vy * normal.y;
                      if (outward > 0) {
                          firefly.vx -= normal.x * outward * (1 + FIREFLY_RESTITUTION);
                          firefly.vy -= normal.y * outward * (1 + FIREFLY_RESTITUTION);
                      }
                  }
              });
              resolveArenaFireflyCollisions();

              const attachCandidate = ARENA_FIREFLIES.find((firefly) => {
                  if (!firefly.isReleased) return false;
                  if (firefly.attachedToTail) return false;
                  if (firefly.containedInBubbleId) return false;
                  if (firefly.placedTriangleId) return false;
                  if (now < firefly.linkedCooldownUntil) return false;
                  if (isFireflyVocalPlaying || now < fireflyVocalGateUntil) return false;
                  return getDistanceToPath(bubbleTrailPath, { x: firefly.x, y: firefly.y }) <= FIREFLY_TRAIL_ATTACH_RADIUS;
              });
              if (attachCandidate) {
                  const attachedCount = ARENA_FIREFLIES.filter((firefly) => firefly.attachedToTail).length;
                  if (attachedCount >= FIREFLY_TAIL_MAX_ATTACHED) {
                      attachCandidate.linkedCooldownUntil = now + FIREFLY_REPULSE_COOLDOWN_MS;
                  } else {
                      attachSingleFireflyToTail(attachCandidate, now);
                  }
              }

          }

          function onStart(e) {
              if (currentView !== 'experience') return;
              if (shouldLockSceneInteractions()) return;
              if (isInteractiveTarget(e.target)) return;
              if (e.touches?.length) {
                  activeTouchId = e.touches[0].identifier;
              } else if (e.changedTouches?.length) {
                  activeTouchId = e.changedTouches[0].identifier;
              }
              const pos = getMousePos(e);
              mouseWorld = pos;
              cancelFishLongPress();
              ensureAllAudioRunning();
              if (isTraceRailAutopilot) {
                  const now = performance.now();
                  if (now <= traceExitConfirmUntil) {
                      isTraceRailAutopilot = false;
                      setTraceListeningMode(false);
                      setDrawingTraceRail(false);
                      traceRailPath = [];
                      traceRailTargetIndex = 0;
                      traceRailDirection = 1;
                      traceExitConfirmUntil = 0;
                      resetTraceCameraControl();
                      ui.textContent = 'Mode normal réactivé.';
                      rotateHelperTip();
                      updateTraceCamControlsVisibility();
                  } else {
                      traceExitConfirmUntil = now + 1400;
                      ui.textContent = 'Auto-voyage actif. Retape pour quitter "Tracer l’écoute".';
                      helperTips.textContent = 'Confirmation sortie : touche encore une fois l’océan.';
                  }
                  return;
              }
              if (isTraceListeningMode) {
                  setDrawingTraceRail(true);
                  if (!traceRailPath.length) {
                      traceRailPath = [pos];
                  } else {
                      const last = traceRailPath[traceRailPath.length - 1];
                      if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) > 10) {
                          traceRailPath.push(pos);
                      }
                  }
                  traceExitConfirmUntil = 0;
                  isTethered = false;
                  ui.textContent = 'Trace en cours… Étape 3/4 : valide avec ✅ pour lancer la traversée.';
                  helperTips.textContent = 'Ajoute des points en glissant, puis appuie sur ✅.';
                  updateTraceCamControlsVisibility();
                  return;
              }
              const now = performance.now();

              // Props panel open → canvas touch = drag selected bubble
              if (selectedBubble) {
                  if (!canCurrentUserControlBubble(selectedBubble)) {
                      setArenaSessionStatus('Tu peux uniquement déplacer ton propre poisson.', true);
                      return;
                  }
                  isDraggingBubble = true;
                  isTethered = false;
                  return;
              }

              if (isInteractionPaused) return;

              // Fish double tap → open creation panel · long press → cycle depth layer
              const now2 = now;
              if (isPointOnFishBody(pos)) {
                  const isDoubleTap = now2 - lastFishTap.time < 330 && Math.hypot(pos.x - lastFishTap.x, pos.y - lastFishTap.y) < 40;
                  lastFishTap = { time: now2, x: pos.x, y: pos.y };
                  if (isDoubleTap) { openBubblePanel(); return; }
                  fishLongPressOrigin = { x: pos.x, y: pos.y };
                  fishLongPressTimer = window.setTimeout(() => {
                      fishLongPressTimer = null;
                      if (currentView !== 'experience' || isInteractionPaused || selectedBubble) return;
                      cycleFishDepthLevel();
                  }, FISH_LONG_PRESS_MS);
              }

              // Detect double tap on a placed bubble
              for (const b of BUBBLES) {
                  if (Math.hypot(pos.x - b.x, pos.y - b.y) <= b.r + 12) {
                      const isDoubleTap = now - lastBubbleTapTime < 380 && lastBubbleTapTarget === b;
                      lastBubbleTapTime = now;
                      lastBubbleTapTarget = b;
                      if (isDoubleTap) { openBubblePropsPanel(b); return; }
                      return; // single tap on bubble: absorb, no tether
                  }
              }
              isTethered = true;
              syncExperienceModeChips();
          }
          function onMove(e) {
              if (currentView !== 'experience') return;
              if (shouldLockSceneInteractions()) return;
              const pos = getMousePos(e);
              mouseWorld = pos;
              if (isDrawingTraceRail) {
                  const lastPoint = traceRailPath[traceRailPath.length - 1];
                  if (!lastPoint || Math.hypot(pos.x - lastPoint.x, pos.y - lastPoint.y) > 8) {
                      traceRailPath.push(pos);
                  }
              }
              if (isDraggingBubble && selectedBubble) {
                  selectedBubble.x = pos.x;
                  selectedBubble.y = pos.y;
                  pushBubblePatchToDb(selectedBubble, { x: selectedBubble.x, y: selectedBubble.y });
              }
              if (fishLongPressTimer && fishLongPressOrigin) {
                  if (Math.hypot(pos.x - fishLongPressOrigin.x, pos.y - fishLongPressOrigin.y) > FISH_LONG_PRESS_MOVE_TOLERANCE) {
                      cancelFishLongPress();
                  }
              }
          }
          function onEnd(e) {
              if (currentView !== 'experience') {
                  activeTouchId = null;
                  cancelFishLongPress();
                  return;
              }
              if (shouldLockSceneInteractions()) return;
              if (e?.changedTouches?.length && activeTouchId != null) {
                  const touchStillActive = Array.from(e.touches || []).some((touch) => touch.identifier === activeTouchId);
                  if (!touchStillActive) activeTouchId = null;
              } else if (!e?.touches?.length) {
                  activeTouchId = null;
              }
              cancelFishLongPress();
              if (isDrawingTraceRail) {
                  setDrawingTraceRail(false);
                  ui.textContent = 'Tracé prêt. Étape 3/4 : appuie sur ✅ pour lancer.';
                  helperTips.textContent = 'Étape 4/4 : utilise ⏹ pour stopper et quitter le mode tracé.';
                  updateTraceFlowButtons();
              }
              const draggedBubbleId = isDraggingBubble && selectedBubble?.id ? selectedBubble.id : null;
              isTethered = false;
              isDraggingBubble = false;
              if (draggedBubbleId) {
                  const bufferedRow = bubbleBufferedRemotePatchById.get(draggedBubbleId);
                  bubbleBufferedRemotePatchById.delete(draggedBubbleId);
                  if (bufferedRow && !isBubbleRowObsolete(bufferedRow)) {
                      const bubble = BUBBLES.find((item) => item.id === draggedBubbleId);
                      if (bubble) applyDbRowToBubble(bubble, bufferedRow);
                  }
              }
              syncExperienceModeChips();
          }

          function cancelFishLongPress() {
              if (fishLongPressTimer) {
                  clearTimeout(fishLongPressTimer);
                  fishLongPressTimer = null;
              }
              fishLongPressOrigin = null;
          }

          window.addEventListener('mousedown', onStart);
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onEnd);
          window.addEventListener('blur', onEnd);

          experienceView?.addEventListener('touchstart', (e) => {
              if (shouldLockSceneInteractions()) {
                  e.preventDefault();
                  return;
              }
              if (isInteractiveTarget(e.target)) return;
              e.preventDefault();
              onStart(e);
          }, { passive: false });
          experienceView?.addEventListener('touchmove', (e) => {
              if (shouldLockSceneInteractions()) {
                  e.preventDefault();
                  return;
              }
              if (isInteractiveTarget(e.target)) return;
              e.preventDefault();
              onMove(e);
          }, { passive: false });
          window.addEventListener('touchend', onEnd);
          window.addEventListener('touchcancel', onEnd);

          const traceCamButtons = traceCamControls?.querySelectorAll('[data-trace-cam-action]');
          traceCamButtons?.forEach((button) => {
              let repeatTimer = null;
              let repeatInterval = null;
              let skipNextClick = false;
              const action = button.getAttribute('data-trace-cam-action');
              const releaseControlLock = () => {
                  isTraceCamControlGestureActive = false;
              };
              const stopRepeat = (releaseLock = true) => {
                  if (repeatTimer) {
                      clearTimeout(repeatTimer);
                      repeatTimer = null;
                  }
                  if (repeatInterval) {
                      clearInterval(repeatInterval);
                      repeatInterval = null;
                  }
                  if (releaseLock) releaseControlLock();
              };
              const runAction = () => {
                  if (!action) return;
                  applyTraceCameraAction(action);
              };
              button.addEventListener('click', () => {
                  if (skipNextClick) {
                      skipNextClick = false;
                      return;
                  }
                  runAction();
              });
              button.addEventListener('pointerdown', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  isTraceCamControlGestureActive = true;
                  button.setPointerCapture?.(event.pointerId);
                  skipNextClick = true;
                  runAction();
                  stopRepeat(false);
                  repeatTimer = window.setTimeout(() => {
                      repeatInterval = window.setInterval(runAction, 72);
                  }, 240);
              });
              button.addEventListener('touchstart', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  isTraceCamControlGestureActive = true;
              }, { passive: false });
              button.addEventListener('touchend', () => {
                  stopRepeat(true);
              });
              button.addEventListener('pointerup', stopRepeat);
              button.addEventListener('pointerleave', stopRepeat);
              button.addEventListener('pointercancel', stopRepeat);
              button.addEventListener('lostpointercapture', stopRepeat);
          });
          window.addEventListener('pointerup', () => { isTraceCamControlGestureActive = false; }, { passive: true });
          window.addEventListener('pointercancel', () => { isTraceCamControlGestureActive = false; }, { passive: true });
          window.addEventListener('touchend', () => { isTraceCamControlGestureActive = false; }, { passive: true });
          window.addEventListener('touchcancel', () => { isTraceCamControlGestureActive = false; }, { passive: true });
          const traceCamDragZone = traceCamControls?.querySelector('[data-trace-cam-drag-zone]');
          const stopTraceCamMenuDrag = () => {
              traceCamMenuDrag.active = false;
              traceCamMenuDrag.pointerId = null;
          };
          traceCamDragZone?.addEventListener('pointerdown', (event) => {
              if (!(isTraceListeningMode || isDrawingTraceRail)) return;
              event.preventDefault();
              event.stopPropagation();
              traceCamMenuDrag.active = true;
              traceCamMenuDrag.pointerId = event.pointerId;
              traceCamMenuDrag.startClientX = event.clientX;
              traceCamMenuDrag.startClientY = event.clientY;
              traceCamMenuDrag.startOffsetX = traceCamMenuDrag.offsetX;
              traceCamMenuDrag.startOffsetY = traceCamMenuDrag.offsetY;
              traceCamDragZone.setPointerCapture?.(event.pointerId);
          });
          traceCamDragZone?.addEventListener('pointermove', (event) => {
              if (!traceCamMenuDrag.active) return;
              if (traceCamMenuDrag.pointerId !== null && event.pointerId !== traceCamMenuDrag.pointerId) return;
              event.preventDefault();
              event.stopPropagation();
              const proposedX = traceCamMenuDrag.startOffsetX + (event.clientX - traceCamMenuDrag.startClientX);
              const proposedY = traceCamMenuDrag.startOffsetY + (event.clientY - traceCamMenuDrag.startClientY);
              const clamped = clampTraceCamMenuDrag(proposedX, proposedY);
              traceCamMenuDrag.offsetX = clamped.x;
              traceCamMenuDrag.offsetY = clamped.y;
              updateTraceCamMenuDragPosition();
          });
          traceCamDragZone?.addEventListener('pointerup', (event) => {
              if (traceCamMenuDrag.pointerId === event.pointerId) stopTraceCamMenuDrag();
          });
          traceCamDragZone?.addEventListener('pointercancel', (event) => {
              if (traceCamMenuDrag.pointerId === event.pointerId) stopTraceCamMenuDrag();
          });
          traceCamDragZone?.addEventListener('lostpointercapture', stopTraceCamMenuDrag);
          window.addEventListener('resize', () => {
              const clamped = clampTraceCamMenuDrag(traceCamMenuDrag.offsetX, traceCamMenuDrag.offsetY);
              traceCamMenuDrag.offsetX = clamped.x;
              traceCamMenuDrag.offsetY = clamped.y;
              updateTraceCamMenuDragPosition();
          });
          updateTraceCamMenuDragPosition();
          updateTraceCamControlsVisibility();

          cancelBtn.addEventListener('click', closeBubblePanel);
          dropBtn.addEventListener('click', async () => {
              if (!canHostEditBubbles()) { notifyGuestReadOnlyMode(); return; }
              const sample = SAMPLE_LIBRARY.find(s => s.id === selectedSampleId);
              if (!sample) return;
              const bubble = buildSoundBubble(sample, bubbleLayer.value, selectedHaloStyleId);
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(currentArenaId)) {
                  BUBBLES.push(bubble);
              } else {
                  const payload = bubbleToDbPayload(bubble);
                  const { error } = await insertArenaBubbleRow(client, payload, {
                      action: 'drop-create',
                      arena_id: currentArenaId,
                      bubble_id: bubble.id,
                  });
                  if (error) {
                      const userMessage = mapArenaBubbleWriteErrorLabel(error);
                      setArenaSessionStatus(userMessage, true);
                      setAuthStatus(userMessage, true);
                      return;
                  }
              }
              closeBubblePanel();
          });
          traceListeningBtn?.addEventListener('click', () => {
              if (isTraceListeningMode || isDrawingTraceRail || isTraceRailAutopilot) {
                  stopTraceFlow();
              } else {
                  armTraceFlow();
              }
          });
          function openBubblePanel() {
              isInteractionPaused = true;
              isTethered = false;
              ship.vx = 0;
              ship.vy = 0;
              bubblePanel.classList.remove('hidden');
              bubbleHaloStyle.value = selectedHaloStyleId;
              ui.textContent = 'Collection ouverte • Choisissez sample + profondeur';
              helperTips.textContent = 'Astuce : sélectionne un sample + une position, puis clique sur « Ajouter à la collection ».';
          }

          function closeBubblePanel() {
              bubblePanel.classList.add('hidden');
              isInteractionPaused = false;
              ui.textContent = '';
              rotateHelperTip();
          }

          function ensureAudioContext() {
              if (audioCtx) return audioCtx;
              const AudioContextClass = window.AudioContext || window.webkitAudioContext;
              if (!AudioContextClass) return null;
              audioCtx = new AudioContextClass();
              masterGainNode = audioCtx.createGain();
              masterGainNode.gain.value = 1;
              masterDryGainNode = audioCtx.createGain();
              masterWetGainNode = audioCtx.createGain();
              masterDelayNode = audioCtx.createDelay(2.5);
              masterDelayFeedbackGainNode = audioCtx.createGain();

              masterDryGainNode.gain.value = 1;
              masterWetGainNode.gain.value = 0;
              masterDelayNode.delayTime.value = 0.34;
              masterDelayFeedbackGainNode.gain.value = 0.35;

              masterGainNode.connect(masterDryGainNode);
              masterGainNode.connect(masterDelayNode);
              masterDelayNode.connect(masterDelayFeedbackGainNode);
              masterDelayFeedbackGainNode.connect(masterDelayNode);
              masterDelayNode.connect(masterWetGainNode);
              masterDryGainNode.connect(audioCtx.destination);
              masterWetGainNode.connect(audioCtx.destination);
              return audioCtx;
          }

          function playSoonTutoMusic() {
              if (isStartingSoonTutoMusic) return;
              isStartingSoonTutoMusic = true;

              const music = soonTutoMusic || new Audio();
              soonTutoMusic = music;
              music.preload = 'auto';
              music.crossOrigin = 'anonymous';
              if (music.src !== SOON_TUTO_MUSIC_URL) {
                  music.src = SOON_TUTO_MUSIC_URL;
              }
              music.loop = true;
              music.currentTime = 0;
              music.volume = 1;
              const context = ensureAudioContext();
              ensureAllAudioRunning();
              if (context && masterGainNode) {
                  try {
                      ensureMediaElementRoutedToMaster(music, context, 1);
                  } catch (_) {}
              }

              if (soonTutoMusicFadeInterval) {
                  clearInterval(soonTutoMusicFadeInterval);
                  soonTutoMusicFadeInterval = null;
              }

              music.play().then(() => {
                  isStartingSoonTutoMusic = false;
              }).catch(() => {
                  isStartingSoonTutoMusic = false;
              });
          }

          function fadeOutSoonTutoMusic(durationMs = 850) {
              if (!soonTutoMusic) return;
              const music = soonTutoMusic;
              if (soonTutoMusicFadeInterval) {
                  clearInterval(soonTutoMusicFadeInterval);
                  soonTutoMusicFadeInterval = null;
              }
              const startVolume = Math.max(0, Math.min(1, music.volume));
              if (startVolume <= 0.001) {
                  music.volume = 0;
                  music.pause();
                  return;
              }
              const startedAt = performance.now();
              soonTutoMusicFadeInterval = setInterval(() => {
                  const elapsed = performance.now() - startedAt;
                  const t = Math.max(0, Math.min(1, elapsed / Math.max(120, durationMs)));
                  const eased = 1 - Math.pow(1 - t, 2);
                  music.volume = Math.max(0, startVolume * (1 - eased));
                  if (t >= 1) {
                      clearInterval(soonTutoMusicFadeInterval);
                      soonTutoMusicFadeInterval = null;
                      music.volume = 0;
                      music.pause();
                  }
              }, 32);
          }


          function formatRecordingTime(msElapsed) {
              const clamped = Math.min(RECORDER_MAX_MILLIS, Math.max(0, msElapsed));
              const totalSeconds = Math.floor(clamped / 1000);
              const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
              const seconds = (totalSeconds % 60).toString().padStart(2, '0');
              return `${minutes}:${seconds}`;
          }

          function wait(ms) {
              return new Promise((resolve) => {
                  setTimeout(resolve, ms);
              });
          }

          function buildBalladeFilename(ext) {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hours = String(now.getHours()).padStart(2, '0');
              const mins = String(now.getMinutes()).padStart(2, '0');
              const secs = String(now.getSeconds()).padStart(2, '0');
              return `soon-ballade-${year}${month}${day}-${hours}${mins}${secs}.${ext}`;
          }

          function normalizeExtFromMime(mimeType, fallbackExt = 'webm') {
              const mime = (mimeType || '').toLowerCase();
              if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
              if (mime.includes('ogg')) return 'ogg';
              if (mime.includes('wav')) return 'wav';
              if (mime.includes('webm')) return 'webm';
              return fallbackExt;
          }

          function renderSilenceSessions() {
              if (!silenceSessionList) return;
              if (!savedSilenceSessions.length) {
                  silenceSessionList.innerHTML = '<p class="collection-empty">Aucune traversée conservée pour le moment.</p>';
                  return;
              }
              silenceSessionList.innerHTML = savedSilenceSessions.map((session) => `
                  <div class="silence-session-item">
                      <p>${session.label}</p>
                      <a href="${session.url}" download="${session.filename}">Télécharger ${session.ext.toUpperCase()}</a>
                  </div>
              `).join('');
          }

          function detectRecorderFormat() {
              const defaultFormat = { mimeType: '', ext: 'webm', fallbackNotice: 'Format conteneur par défaut du navigateur.' };
              if (typeof window.MediaRecorder === 'undefined') return null;
              const supportsMime = typeof MediaRecorder.isTypeSupported === 'function'
                  ? (mime) => MediaRecorder.isTypeSupported(mime)
                  : () => true;

              const formats = [
                  { mimeType: 'audio/webm;codecs=opus', ext: 'webm', fallbackNotice: 'MP3 indisponible sur ce navigateur : export en WebM/Opus.' },
                  { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg', fallbackNotice: 'MP3 indisponible sur ce navigateur : export en OGG/Opus.' },
                  { mimeType: 'audio/wav', ext: 'wav', fallbackNotice: 'MP3 indisponible sur ce navigateur : export en WAV.' },
                  { mimeType: 'audio/mpeg', ext: 'mp3', fallbackNotice: '' },
                  { mimeType: 'audio/mp3', ext: 'mp3', fallbackNotice: '' },
              ];

              for (const format of formats) {
                  if (supportsMime(format.mimeType)) return format;
              }
              return defaultFormat;
          }

          async function convertBlobToMp3(sourceBlob) {
              if (!sourceBlob || !sourceBlob.size) return null;
              const isAlreadyMp3 = /mpeg|mp3/i.test(sourceBlob.type || '');
              if (isAlreadyMp3) return sourceBlob;
              return null;
          }

          function updateEchoRecorderUi() {
              if (!echoRecorderPanel || !echoRecordToggleBtn || !echoRecordStatus || !echoRecordTimer) return;
              echoRecordToggleBtn.classList.toggle('recording', recordingState === 'recording');
              echoRecordToggleBtn.classList.toggle('finalizing', recordingState === 'finalizing');
              echoRecordToggleBtn.classList.toggle('hypnosis', recordingState === 'recording' || silenceTransitionInProgress);
              echoRecordToggleBtn.disabled = recordingState === 'finalizing' || recordingState === 'unsupported' || silenceTransitionInProgress;
              echoRecordToggleBtn.textContent = recordingState === 'recording' ? 'STOP' : '👂';

              if (recordingState === 'idle') {
                  if (!silenceTransitionInProgress) {
                      echoRecordStatus.textContent = 'Prêt pour une traversée.';
                  }
              } else if (recordingState === 'recording') {
                  const formatLabel = recordingFileExt.toUpperCase();
                  echoRecordStatus.textContent = `Silence des Yeux en cours… (${formatLabel})`;
              } else if (recordingState === 'finalizing') {
                  echoRecordStatus.textContent = 'Finalisation…';
              } else if (recordingState === 'ready') {
                  const fallbackMsg = recordingFallbackNotice ? ` ${recordingFallbackNotice}` : '';
                  echoRecordStatus.textContent = `Traversée prête à télécharger (${recordingFileExt.toUpperCase()}).${fallbackMsg}`;
              } else if (recordingState === 'unsupported') {
                  echoRecordStatus.textContent = 'Enregistrement indisponible sur ce navigateur.';
              }

              syncExperienceModeChips();
          }

          function clearRecordingTimers() {
              if (recordingTimerInterval) {
                  clearInterval(recordingTimerInterval);
                  recordingTimerInterval = null;
              }
              if (recordingAutoStopTimeout) {
                  clearTimeout(recordingAutoStopTimeout);
                  recordingAutoStopTimeout = null;
              }
          }

          function refreshRecordingTimer() {
              if (!echoRecordTimer) return;
              const elapsed = recordingState === 'recording' ? (Date.now() - recordingStartedAt) : 0;
              echoRecordTimer.textContent = `${formatRecordingTime(elapsed)} / 01:00`;
          }

          function setSilenceImmersion(level) {
              silenceImmersionLevel = Math.max(0, Math.min(1, level));
              if (experienceView) {
                  applyExperienceUiModeState();
              }
          }

          function revealSilenceOverlay(title, countdown, poem) {
              if (!silenceDesYeuxOverlay) return;
              if (silenceDesYeuxTitle && title) silenceDesYeuxTitle.textContent = title;
              if (silenceDesYeuxCountdown && countdown) silenceDesYeuxCountdown.textContent = countdown;
              if (silenceDesYeuxPoem && poem) silenceDesYeuxPoem.textContent = poem;
              silenceDesYeuxOverlay.hidden = false;
          }

          function hideSilenceOverlay() {
              if (silenceDesYeuxOverlay) silenceDesYeuxOverlay.hidden = true;
          }

          async function startSilenceDesYeuxSequence() {
              if (recordingState === 'recording' || recordingState === 'finalizing' || silenceTransitionInProgress) return;
              silenceTransitionInProgress = true;
              silenceSessionSaved = false;
              if (silenceDesYeuxPrompt) silenceDesYeuxPrompt.hidden = true;
              setSilenceImmersion(1);
              revealSilenceOverlay('Le Silence des Yeux est là…', '0•°', 'Traverse 60 secondes d’écoute sensible.');
              echoRecordStatus.textContent = 'Préparation hypnotique…';
              updateEchoRecorderUi();
              startEchoRecording();
              if (recordingState !== 'recording') {
                  hideSilenceOverlay();
                  setSilenceImmersion(0);
                  silenceTransitionInProgress = false;
                  return;
              }
              await wait(1200);
              hideSilenceOverlay();
              silenceTransitionInProgress = false;
              updateEchoRecorderUi();
          }

          function setRecordingDownload(blob) {
              if (!echoRecordDownloadLink) return;
              if (recordingDownloadUrl) {
                  URL.revokeObjectURL(recordingDownloadUrl);
                  recordingDownloadUrl = null;
              }
              if (!blob) {
                  echoRecordDownloadLink.hidden = true;
                  echoRecordDownloadLink.removeAttribute('href');
                  return;
              }
              recordingDownloadUrl = URL.createObjectURL(blob);
              echoRecordDownloadLink.href = recordingDownloadUrl;
              echoRecordDownloadLink.download = buildBalladeFilename(recordingFileExt);
              echoRecordDownloadLink.hidden = false;
          }

          function ensureRecordingDestination(context) {
              if (!context || !masterGainNode) return null;
              if (recordingMediaDest) return recordingMediaDest;
              recordingMediaDest = context.createMediaStreamDestination();
              masterGainNode.connect(recordingMediaDest);
              return recordingMediaDest;
          }

          function stopEchoRecording(triggeredByAutoStop) {
              if (recordingState !== 'recording' || !recordingMediaRecorder) return;
              clearRecordingTimers();
              recordingState = 'finalizing';
              if (echoRecordTimer && triggeredByAutoStop) {
                  echoRecordTimer.textContent = '01:00 / 01:00';
              }
              updateEchoRecorderUi();
              try {
                  recordingMediaRecorder.stop();
              } catch (_) {
                  recordingState = 'idle';
                  updateEchoRecorderUi();
              }
          }

          function startEchoRecording() {
              if (recordingState === 'recording' || recordingState === 'finalizing') return;
              const context = ensureAudioContext();
              ensureAllAudioRunning();
              if (!context || !masterGainNode || typeof window.MediaRecorder === 'undefined') {
                  recordingState = 'unsupported';
                  updateEchoRecorderUi();
                  return;
              }

              const mediaDest = ensureRecordingDestination(context);
              if (!mediaDest || !mediaDest.stream) {
                  recordingState = 'unsupported';
                  updateEchoRecorderUi();
                  return;
              }

              const format = detectRecorderFormat();
              if (!format) {
                  recordingState = 'unsupported';
                  updateEchoRecorderUi();
                  return;
              }

              recordingMimeType = format.mimeType || '';
              recordingFileExt = format.ext;
              recordingFallbackNotice = format.fallbackNotice;
              recordingChunks = [];
              latestRecordingBlob = null;
              latestRecordingMimeType = '';
              setRecordingDownload(null);

              try {
                  recordingMediaRecorder = recordingMimeType
                      ? new MediaRecorder(mediaDest.stream, { mimeType: recordingMimeType })
                      : new MediaRecorder(mediaDest.stream);
              } catch (_) {
                  recordingState = 'unsupported';
                  updateEchoRecorderUi();
                  return;
              }

              recordingMediaRecorder.ondataavailable = (event) => {
                  if (event.data && event.data.size > 0) {
                      recordingChunks.push(event.data);
                  }
              };

              recordingMediaRecorder.onerror = () => {
                  clearRecordingTimers();
                  recordingState = 'unsupported';
                  updateEchoRecorderUi();
              };

              recordingMediaRecorder.onstop = () => {
                  const finalType = recordingMediaRecorder?.mimeType || recordingMimeType || undefined;
                  const sourceBlob = recordingChunks.length ? new Blob(recordingChunks, finalType ? { type: finalType } : undefined) : null;
                  recordingMediaRecorder = null;
                  recordingChunks = [];
                  if (!sourceBlob || sourceBlob.size === 0) {
                      recordingState = 'idle';
                      setSilenceImmersion(0);
                      updateEchoRecorderUi();
                      return;
                  }
                  recordingState = 'finalizing';
                  updateEchoRecorderUi();
                  (async () => {
                      let deliveredBlob = sourceBlob;
                      let deliveredMime = finalType || '';
                      let deliveredExt = normalizeExtFromMime(finalType, recordingFileExt);
                      try {
                          const mp3Blob = await convertBlobToMp3(sourceBlob);
                          if (mp3Blob && mp3Blob.size > 0) {
                              deliveredBlob = mp3Blob;
                              deliveredMime = 'audio/mpeg';
                              deliveredExt = 'mp3';
                              recordingFallbackNotice = '';
                          } else {
                              recordingFallbackNotice = 'Conversion MP3 indisponible : téléchargement au format source.';
                          }
                      } catch (_) {
                          recordingFallbackNotice = 'Conversion MP3 échouée : téléchargement au format source.';
                      }

                      latestRecordingBlob = deliveredBlob;
                      latestRecordingMimeType = deliveredMime;
                      recordingFileExt = deliveredExt;
                      setRecordingDownload(deliveredBlob);
                      recordingState = 'ready';
                      setSilenceImmersion(0);
                      if (silenceDesYeuxPrompt && !silenceSessionSaved) {
                          silenceDesYeuxPrompt.hidden = false;
                      }
                      updateEchoRecorderUi();
                  })();
              };

              recordingStartedAt = Date.now();
              recordingState = 'recording';
              refreshRecordingTimer();
              updateEchoRecorderUi();
              recordingMediaRecorder.start(250);

              recordingTimerInterval = setInterval(() => {
                  const elapsed = Date.now() - recordingStartedAt;
                  if (elapsed >= RECORDER_MAX_MILLIS) {
                      echoRecordTimer.textContent = '01:00 / 01:00';
                      stopEchoRecording(true);
                      return;
                  }
                  refreshRecordingTimer();
              }, 200);

              recordingAutoStopTimeout = setTimeout(() => {
                  stopEchoRecording(true);
              }, RECORDER_MAX_MILLIS);
          }

          updateEchoRecorderUi();
          refreshRecordingTimer();
          hideSilenceOverlay();
          renderSilenceSessions();

          window.addEventListener('beforeunload', () => {
              unsubscribeArenaRealtimeChannel();
              BUBBLES.forEach((bubble) => clearBubbleUpdateThrottleForId(bubble.id));
              if (recordingDownloadUrl) {
                  URL.revokeObjectURL(recordingDownloadUrl);
              }
              savedSilenceSessions.forEach((session) => {
                  if (session?.url) URL.revokeObjectURL(session.url);
              });
          });

          function buildSyntheticBuffer(ctx, seconds = 3.4) {
              const sampleRate = ctx.sampleRate;
              const frameCount = Math.floor(sampleRate * seconds);
              const buffer = ctx.createBuffer(1, frameCount, sampleRate);
              const data = buffer.getChannelData(0);
              let smooth = 0;
              for (let i = 0; i < frameCount; i++) {
                  const t = i / sampleRate;
                  const env = 0.54 + Math.sin(t * Math.PI * 2 * 0.09) * 0.16;
                  smooth = smooth * 0.96 + (Math.random() * 2 - 1) * 0.04;
                  data[i] = smooth * env * 0.38;
              }
              return buffer;
          }

          function layerToSpatial(layer) {
              if (layer === 'above') return { offsetY: -95, depthOffset: DEPTH_Z };
              if (layer === 'below') return { offsetY: 95, depthOffset: -DEPTH_Z };
              return { offsetY: 0, depthOffset: 0 };
          }

          function createResotagList(sample) {
              return [];
          }

          function unlinkResotag(tagId) {
              return;
          }

          function releaseResotagFromBubble(bubble) {
              return;
          }

          function buildSoundBubble(sample, layer = 'front', haloStyle = HALO_STYLE_LIBRARY[0].id) {
              const mouthDistance = 20;
              const dirX = Math.cos(ship.angle - Math.PI / 2);
              const dirY = Math.sin(ship.angle - Math.PI / 2);
              const spatial = layerToSpatial(layer);

              let x = ship.x + dirX * mouthDistance;
              let y = ship.y + dirY * mouthDistance + spatial.offsetY;

              const maxRadius = ARENA_RADIUS - 80;
              const distance = Math.hypot(x, y);
              if (distance > maxRadius) {
                  x = (x / distance) * maxRadius;
                  y = (y / distance) * maxRadius;
              }

              const sound = createBinauralSound(sample);
              return {
                  id: `bubble-${bubbleIdSeed++}`,
                  x, y, r: 64, layer, depthOffset: spatial.depthOffset, isActive: false,
                  sound, label: sample.name, _sampleId: sample.id,
                  currentVolume: 0, zoneMix: 0, resonance: 0, wasInZone: false, hue: 195, haloStyle,
                  lastImpactAt: 0,
                  fishTouching: false,
                  vx: 0,
                  vy: 0,
                  wasShipInsideBody: false,
                  storedFireflyIds: [],
                  nextStoredFireflyPlaybackIndex: 0,
                  trianglePlaybackLockUntil: 0,
                  isTrianglePlaybackActive: false
              };
          }

          function clearBubbleUpdateThrottleForId(bubbleId) {
              const timer = bubbleUpdateThrottleTimers.get(bubbleId);
              if (timer) {
                  clearTimeout(timer);
                  bubbleUpdateThrottleTimers.delete(bubbleId);
              }
              bubblePendingPatchById.delete(bubbleId);
              bubblePendingPatchArenaById.delete(bubbleId);
          }

          function clearPendingBubbleWritesForOtherArena(activeArenaId) {
              for (const bubbleId of bubblePendingPatchById.keys()) {
                  const arenaIdAtSchedule = bubblePendingPatchArenaById.get(bubbleId);
                  if (arenaIdAtSchedule && arenaIdAtSchedule !== activeArenaId) {
                      clearBubbleUpdateThrottleForId(bubbleId);
                  }
              }
          }

          function getRowVersion(row) {
              return Number.isFinite(Number(row?.version)) ? Number(row.version) : 0;
          }

          function getKnownBubbleVersion(bubbleId) {
              if (!bubbleId) return 0;
              return Number.isFinite(Number(bubbleLastKnownVersionById.get(bubbleId)))
                  ? Number(bubbleLastKnownVersionById.get(bubbleId))
                  : 0;
          }

          function setKnownBubbleVersion(bubbleId, version) {
              if (!bubbleId) return;
              const normalizedVersion = Number.isFinite(Number(version)) ? Number(version) : 0;
              bubbleLastKnownVersionById.set(bubbleId, normalizedVersion);
          }

          function isBubbleRowObsolete(row) {
              if (!row?.id) return false;
              const incomingVersion = getRowVersion(row);
              return incomingVersion < getKnownBubbleVersion(row.id);
          }

          function cleanupBubbleAudioAndLinks(bubble) {
              if (!bubble) return;
              try { bubble.sound?.source?.stop(); } catch (_) {}
              ARENA_FIREFLIES.forEach((firefly) => {
                  if (firefly.containedInBubbleId !== bubble.id) return;
                  firefly.containedInBubbleId = null;
                  firefly.triangleVertexIndex = -1;
                  firefly.linkedCooldownUntil = performance.now() + 1200;
                  firefly.nextDestinyAt = performance.now() + 900 + Math.random() * 900;
              });
              clearBubbleUpdateThrottleForId(bubble.id);
          }

          function removeBubbleFromArenaById(bubbleId) {
              const index = BUBBLES.findIndex((bubble) => bubble.id === bubbleId);
              if (index === -1) return;
              const bubble = BUBBLES[index];
              cleanupBubbleAudioAndLinks(bubble);
              BUBBLES.splice(index, 1);
              bubbleLastKnownVersionById.delete(bubbleId);
              bubbleBufferedRemotePatchById.delete(bubbleId);
              if (selectedBubble?.id === bubbleId) {
                  closeBubblePropsPanel();
              }
          }

          function getSampleById(sampleId) {
              return SAMPLE_LIBRARY.find((sample) => sample.id === sampleId) || SAMPLE_LIBRARY[0];
          }

          function bubbleToDbPayload(bubble, extra = {}) {
              return {
                  id: bubble.id,
                  arena_id: currentArenaId,
                  x: bubble.x,
                  y: bubble.y,
                  radius: bubble.r,
                  hue: bubble.hue ?? 195,
                  layer: bubble.layer || 'front',
                  halo_style: bubble.haloStyle || HALO_STYLE_LIBRARY[0].id,
                  sample_id: bubble._sampleId || SAMPLE_LIBRARY[0].id,
                  label: bubble.label || 'Bulle sonore',
                  ...extra,
              };
          }

          function applyDbRowToBubble(bubble, row = {}) {
              bubble.x = Number.isFinite(row.x) ? row.x : bubble.x;
              bubble.y = Number.isFinite(row.y) ? row.y : bubble.y;
              bubble.r = Number.isFinite(row.radius) ? row.radius : (Number.isFinite(row.r) ? row.r : bubble.r);
              bubble.hue = Number.isFinite(row.hue) ? row.hue : (bubble.hue ?? 195);
              bubble.layer = row.layer || bubble.layer || 'front';
              const spatial = layerToSpatial(bubble.layer);
              bubble.depthOffset = spatial.depthOffset;
              bubble.haloStyle = row.halo_style || row.haloStyle || bubble.haloStyle || HALO_STYLE_LIBRARY[0].id;
              const sampleIdFromRow = row.sample_id || row.sampleId;
              if (sampleIdFromRow && sampleIdFromRow !== bubble._sampleId) {
                  const sample = getSampleById(sampleIdFromRow);
                  rebuildBubbleSound(bubble, sample);
              } else if (row.label) {
                  bubble.label = row.label;
              }
              bubble._version = getRowVersion(row);
              bubble.playerNumber = Number.isFinite(Number(row.player_number)) ? Number(row.player_number) : null;
              bubble.created_by = row.created_by || row.created_by || bubble.created_by || null;
              setKnownBubbleVersion(bubble.id, bubble._version);
          }

          function hydrateBubbleFromDbRow(row) {
              const sample = getSampleById(row.sample_id || row.sampleId);
              const bubble = buildSoundBubble(sample, row.layer || 'front', row.halo_style || row.haloStyle || HALO_STYLE_LIBRARY[0].id);
              bubble.id = row.id || `bubble-${bubbleIdSeed++}`;
              applyDbRowToBubble(bubble, row);
              return bubble;
          }

          async function pushBubblePatchToDb(bubble, partialPatch = {}, immediate = false) {
              if (!canHostEditBubbles()) return;
              if (isApplyingRemoteArenaSyncEvent || isHydratingArenaBubbles) return;
              if (!bubble?.id) return;
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(currentArenaId)) return;
              const bubbleId = bubble.id;
              const updaterUserId = currentSession?.user?.id || null;
              const arenaIdAtSchedule = currentArenaId;
              const nextPatch = {
                  ...(bubblePendingPatchById.get(bubbleId) || {}),
                  ...partialPatch,
                  updated_by_user_id: updaterUserId,
                  updated_at: new Date().toISOString(),
              };
              bubblePendingPatchById.set(bubbleId, nextPatch);
              bubblePendingPatchArenaById.set(bubbleId, arenaIdAtSchedule);
              if (immediate) {
                  const patch = bubblePendingPatchById.get(bubbleId) || nextPatch;
                  const scheduledArenaId = bubblePendingPatchArenaById.get(bubbleId) || arenaIdAtSchedule;
                  const timer = bubbleUpdateThrottleTimers.get(bubbleId);
                  if (timer) {
                      clearTimeout(timer);
                      bubbleUpdateThrottleTimers.delete(bubbleId);
                  }
                  bubblePendingPatchById.delete(bubbleId);
                  bubblePendingPatchArenaById.delete(bubbleId);
                  if (currentArenaId !== scheduledArenaId) {
                      console.warn('[legacyApp] Bubble patch immediate arena drift detected', { bubbleId, currentArenaId, arenaIdAtSchedule: scheduledArenaId });
                  }
                  const { error } = await updateArenaBubbleRow(client, bubbleId, patch, {
                      action: 'patch-immediate',
                      arena_id: scheduledArenaId,
                      bubble_id: bubbleId,
                  });
                  if (error) {
                      const userMessage = mapArenaBubbleWriteErrorLabel(error);
                      setArenaSessionStatus(userMessage, true);
                      setAuthStatus(userMessage, true);
                  }
                  return;
              }
              if (bubbleUpdateThrottleTimers.has(bubbleId)) return;
              const timer = window.setTimeout(async () => {
                  bubbleUpdateThrottleTimers.delete(bubbleId);
                  const patch = bubblePendingPatchById.get(bubbleId);
                  const scheduledArenaId = bubblePendingPatchArenaById.get(bubbleId) || arenaIdAtSchedule;
                  bubblePendingPatchById.delete(bubbleId);
                  bubblePendingPatchArenaById.delete(bubbleId);
                  if (!patch || !Object.keys(patch).length) return;
                  if (currentArenaId !== scheduledArenaId) {
                      console.warn('[legacyApp] Bubble patch throttled arena drift detected', { bubbleId, currentArenaId, arenaIdAtSchedule: scheduledArenaId });
                  }
                  const { error } = await updateArenaBubbleRow(client, bubbleId, patch, {
                      action: 'patch-throttled',
                      arena_id: scheduledArenaId,
                      bubble_id: bubbleId,
                  });
                  if (error) {
                      const userMessage = mapArenaBubbleWriteErrorLabel(error);
                      setArenaSessionStatus(userMessage, true);
                      setAuthStatus(userMessage, true);
                  }
              }, BUBBLE_UPDATE_THROTTLE_MS);
              bubbleUpdateThrottleTimers.set(bubbleId, timer);
          }

          async function deleteBubbleInDb(bubble) {
              if (!canHostEditBubbles()) { notifyGuestReadOnlyMode(); return false; }
              if (isApplyingRemoteArenaSyncEvent || isHydratingArenaBubbles) return;
              if (!bubble?.id) return false;
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(currentArenaId)) return true;
              clearBubbleUpdateThrottleForId(bubble.id);
              const { error } = await deleteArenaBubbleRow(client, bubble.id, {
                  action: 'delete',
                  arena_id: currentArenaId,
                  bubble_id: bubble.id,
              });
              if (error) {
                  const userMessage = mapArenaBubbleWriteErrorLabel(error);
                  setArenaSessionStatus(userMessage, true);
                  setAuthStatus(userMessage, true);
                  return false;
              }
              return true;
          }

          async function hydrateArenaBubblesFromDb() {
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(currentArenaId)) {
                  if (!BUBBLES.length) placeInitialArenaBubbles();
                  return;
              }
              isHydratingArenaBubbles = true;
              try {
                  const { data, error } = await client
                      .from('arena_bubbles')
                      .select('*')
                      .eq('arena_id', currentArenaId);
                  if (error) {
                      console.warn('[legacyApp] arena_bubbles initial fetch failed', error);
                      if (!BUBBLES.length) placeInitialArenaBubbles();
                      return;
                  }
                  BUBBLES.slice().forEach((bubble) => cleanupBubbleAudioAndLinks(bubble));
                  BUBBLES.length = 0;
                  bubbleLastKnownVersionById.clear();
                  bubbleBufferedRemotePatchById.clear();
                  (data || []).forEach((row) => BUBBLES.push(hydrateBubbleFromDbRow(row)));
                  if (!BUBBLES.length) placeInitialArenaBubbles();
              } finally {
                  isHydratingArenaBubbles = false;
              }
          }

          function bindArenaRealtimeChannel() {
              const client = buildSupabaseClient();
              if (!client || !canSyncArenaWithDb(currentArenaId)) return;
              if (arenaRealtimeChannel) {
                  arenaRealtimeChannel.unsubscribe();
                  arenaRealtimeChannel = null;
              }
              arenaRealtimeChannel = client
                  .channel(`arena:${currentArenaId}`)
                  .on('postgres_changes', {
                      event: '*',
                      schema: 'public',
                      table: 'arena_bubbles',
                      filter: `arena_id=eq.${currentArenaId}`,
                  }, ({ eventType, new: newRow, old: oldRow }) => {
                      isApplyingRemoteArenaSyncEvent = true;
                      try {
                          if (eventType === 'INSERT' && newRow) {
                              if (isBubbleRowObsolete(newRow)) return;
                              const existing = BUBBLES.find((bubble) => bubble.id === newRow.id);
                              if (existing) {
                                  applyDbRowToBubble(existing, newRow);
                              } else {
                                  BUBBLES.push(hydrateBubbleFromDbRow(newRow));
                              }
                              return;
                          }
                          if (eventType === 'UPDATE' && newRow) {
                              if (isBubbleRowObsolete(newRow)) return;
                              if (isDraggingBubble && selectedBubble?.id === newRow.id) {
                                  const bufferedRow = bubbleBufferedRemotePatchById.get(newRow.id);
                                  if (!bufferedRow || getRowVersion(newRow) >= getRowVersion(bufferedRow)) {
                                      bubbleBufferedRemotePatchById.set(newRow.id, newRow);
                                  }
                                  return;
                              }
                              const bubble = BUBBLES.find((item) => item.id === newRow.id);
                              if (bubble) applyDbRowToBubble(bubble, newRow);
                              return;
                          }
                          if (eventType === 'DELETE') {
                              const deletedId = oldRow?.id;
                              if (deletedId) removeBubbleFromArenaById(deletedId);
                          }
                      } finally {
                          isApplyingRemoteArenaSyncEvent = false;
                      }
                  })
                  .subscribe();
          }

          function unsubscribeArenaRealtimeChannel() {
              if (!arenaRealtimeChannel) return;
              arenaRealtimeChannel.unsubscribe();
              arenaRealtimeChannel = null;
          }

          async function activateArenaSync(arenaId = currentArenaId) {
              const nextArenaId = arenaId || 'default';
              clearPendingBubbleWritesForOtherArena(nextArenaId);
              currentArenaId = nextArenaId;
              await hydrateArenaBubblesFromDb();
              if (canSyncArenaWithDb(currentArenaId)) bindArenaRealtimeChannel();
              else unsubscribeArenaRealtimeChannel();
              await refreshArenaParticipantCount(currentArenaId);
          }

          function placeInitialArenaBubbles() {
              if (BUBBLES.length) return;
              STARTING_BUBBLES.forEach((cfg) => {
                  const sample = SAMPLE_LIBRARY.find(s => s.id === cfg.sampleId) || SAMPLE_LIBRARY[0];
                  const bubble = buildSoundBubble(sample, cfg.layer);
                  bubble.x = cfg.x;
                  bubble.y = cfg.y;
                  bubble.r = cfg.r;
                  bubble.hue = cfg.hue;
                  bubble.haloStyle = cfg.haloStyle || HALO_STYLE_LIBRARY[0].id;
                  BUBBLES.push(bubble);
              });
          }

          function createBinauralSound(sample) {
              const ctx = ensureAudioContext();
              if (!ctx) return null;

              const distanceGain = ctx.createGain();
              distanceGain.gain.value = 0;

              const toneFilter = ctx.createBiquadFilter();
              toneFilter.type = 'lowpass';
              toneFilter.frequency.value = sample.baseCutoff ?? 4200;
              toneFilter.Q.value = 0.6;

              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.86;
              const analyserData = new Uint8Array(analyser.frequencyBinCount);

              const resonantFilter = ctx.createBiquadFilter();
              resonantFilter.type = 'bandpass';
              resonantFilter.frequency.value = sample.resonanceFreq ?? 520;
              resonantFilter.Q.value = sample.resonanceQ ?? 1.2;

              const resonantGain = ctx.createGain();
              resonantGain.gain.value = 0;

              const panner = new PannerNode(ctx, {
                  panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 90,
                  maxDistance: SOUND_HEAR_RADIUS * 2.2, rolloffFactor: 1.2, coneInnerAngle: 360,
                  coneOuterAngle: 0, coneOuterGain: 1
              });

              const textureGain = ctx.createGain();
              textureGain.gain.value = sample.gain ?? 0.24;

              let sourceNode;
              let sourceHandle = null;
              if (sample.type === 'noise') {
                  const source = ctx.createBufferSource();
                  source.buffer = buildSyntheticBuffer(ctx);
                  source.loop = true;
                  sourceNode = source;
                  sourceHandle = source;
              } else if (sample.type === 'file' && sample.url) {
                  const mediaElement = new Audio(sample.url);
                  mediaElement.crossOrigin = 'anonymous';
                  mediaElement.loop = true;
                  mediaElement.preload = 'auto';
                  mediaElement.playsInline = true;
                  mediaElement.volume = 1;
                  sourceNode = ctx.createMediaElementSource(mediaElement);
                  sourceHandle = {
                      play: () => mediaElement.play(),
                      stop: () => {
                          mediaElement.pause();
                          mediaElement.currentTime = 0;
                      },
                      mediaElement
                  };
              } else {
                  const source = ctx.createOscillator();
                  source.type = sample.type;
                  source.frequency.value = sample.freq;
                  const lfo = ctx.createOscillator();
                  const lfoGain = ctx.createGain();
                  lfo.frequency.value = Math.max(0.05, sample.lfo);
                  lfoGain.gain.value = sample.freq * (sample.lfoDepth ?? 0.02);
                  lfo.connect(lfoGain);
                  lfoGain.connect(source.frequency);
                  lfo.start();
                  sourceNode = source;
                  sourceHandle = source;
              }

              sourceNode.connect(textureGain);
              textureGain.connect(distanceGain);
              textureGain.connect(analyser);
              distanceGain.connect(toneFilter);
              toneFilter.connect(panner);
              distanceGain.connect(resonantFilter);
              resonantFilter.connect(resonantGain);
              resonantGain.connect(panner);
              panner.connect(masterGainNode);

              if (sample.type === 'file' && sample.url) {
                  ensureAudioContext()?.resume().catch(() => {});
                  sourceHandle?.play?.().catch(() => {});
              } else {
                  sourceNode.start();
              }

              return { source: sourceHandle, distanceGain, toneFilter, resonantFilter, resonantGain, panner, analyser, analyserData, isStarted: true };
          }

          function ensureBubbleAudioRunning(bubble) {
              if (!bubble.sound) return;
              if (!bubble.sound.isStarted) return;
              const source = bubble.sound.source;
              const mediaElement = source?.mediaElement;
              if (!mediaElement) return;
              if (!mediaElement.paused) return;
              source.play?.().catch(() => {});
          }

          function ensureAllAudioRunning() {
              const ctx = ensureAudioContext();
              if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
              BUBBLES.forEach(ensureBubbleAudioRunning);
          }

          function updateAudioListener() {
              if (!audioCtx) return;
              const listener = audioCtx.listener;
              const forwardX = Math.cos(ship.angle - Math.PI / 2);
              const forwardY = Math.sin(ship.angle - Math.PI / 2);

              if (listener.positionX) {
                  listener.positionX.value = ship.x;
                  listener.positionY.value = ship.y;
                  listener.positionZ.value = getFishDepthOffset();
                  listener.forwardX.value = forwardX;
                  listener.forwardY.value = forwardY;
                  listener.forwardZ.value = 0;
                  listener.upX.value = 0;
                  listener.upY.value = 0;
                  listener.upZ.value = 1;
              } else if (listener.setPosition && listener.setOrientation) {
                  listener.setPosition(ship.x, ship.y, getFishDepthOffset());
                  listener.setOrientation(forwardX, forwardY, 0, 0, 0, 1);
              }
          }

          function update() {
              if (currentView !== 'experience') return;
              const now = performance.now();
              updateArenaMembranePerfBudget(now);
              updateArenaMembraneDynamics();
              if (traceExitConfirmUntil && performance.now() > traceExitConfirmUntil) {
                  traceExitConfirmUntil = 0;
                  if (isTraceRailAutopilot) {
                      ui.textContent = 'Voyage sonore auto lancé : aller-retour lissé.';
                  }
              }
              if (isTraceRailAutopilot && traceRailPath.length > 1 && !isInteractionPaused) {
                  const target = traceRailPath[Math.min(traceRailTargetIndex, traceRailPath.length - 1)];
                  const dx = target.x - ship.x;
                  const dy = target.y - ship.y;
                  const dist = Math.hypot(dx, dy);
                  if (dist < 20) {
                      if (traceRailTargetIndex >= traceRailPath.length - 1) {
                          traceRailDirection = -1;
                      } else if (traceRailTargetIndex <= 0) {
                          traceRailDirection = 1;
                      }
                      traceRailTargetIndex += traceRailDirection;
                      traceRailTargetIndex = Math.max(0, Math.min(traceRailPath.length - 1, traceRailTargetIndex));
                  } else if (dist > 0.001) {
                      ship.vx += (dx / dist) * 0.36;
                      ship.vy += (dy / dist) * 0.36;
                  }
              }
              if (isTethered && !isInteractionPaused) {
                  const dx = mouseWorld.x - ship.x;
                  const dy = mouseWorld.y - ship.y;
                  ship.vx += dx * ship.stiffness;
                  ship.vy += dy * ship.stiffness;
              }

              let strongestResonance = 0;
              let resonanceHueMix = 0;
              let resonanceWeight = 0;
              let enteredBubble = null;
              let enteredBubbleDist = Number.POSITIVE_INFINITY;
              const isDolphinNavigationActive = false;

              BUBBLES.forEach(b => {
                  const dx = ship.x - b.x;
                  const dy = ship.y - b.y;
                  const dz = (b.depthOffset ?? 0) - getFishDepthOffset();
                  const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  const dist2d = Math.hypot(dx, dy);
                  const zoneRadius = SOUND_HEAR_RADIUS * 0.7;
                  const insideZone = dist3d < zoneRadius;
                  const insideBubbleBody = dist2d <= b.r;

                  if (b.sound) {
                      const normalized = Math.max(0, 1 - (dist3d / SOUND_HEAR_RADIUS));
                      const targetVolume = Math.pow(normalized, 2);
                      b.currentVolume += (targetVolume - b.currentVolume) * 0.1;
                      const clampedVolume = Math.min(1, Math.max(0, b.currentVolume));
                      b.sound.distanceGain.gain.value = clampedVolume;

                      const angleToBubble = Math.atan2(b.y - ship.y, b.x - ship.x);
                      const relativeAngle = angleToBubble - (ship.angle - Math.PI / 2);
                      const front = Math.cos(relativeAngle);
                      const rearFactor = Math.min(1, Math.max(0, (1 - front) * 0.5));
                      const distFactor = Math.min(1, dist3d / SOUND_HEAR_RADIUS);
                      const audioEnergy = sampleBubbleEnergy(b);
                      const cutoff = 12000 - (rearFactor * 7000) - (distFactor * 2600) + audioEnergy * 1100;
                      b.sound.toneFilter.frequency.value = Math.max(1800, cutoff);

                      b.zoneMix += ((insideZone ? 1 : 0) - b.zoneMix) * 0.05;
                      const resonanceTarget = b.zoneMix * (0.45 + audioEnergy * 0.55);
                      b.resonance += (resonanceTarget - b.resonance) * 0.08;

                      if (b.sound.resonantFilter) {
                          b.sound.resonantFilter.frequency.value = 680 + audioEnergy * 650 + b.resonance * 320;
                          b.sound.resonantFilter.Q.value = 1.2 + b.resonance * 2.8;
                      }
                      if (b.sound.resonantGain) {
                          const resonantVolume = b.currentVolume * (0.12 + b.resonance * 0.25);
                          b.sound.resonantGain.gain.value = resonantVolume;
                      }

                      if (b.sound.panner.positionX) {
                          b.sound.panner.positionX.value = b.x;
                          b.sound.panner.positionY.value = b.y;
                          b.sound.panner.positionZ.value = b.depthOffset ?? 0;
                      } else if (b.sound.panner.setPosition) {
                          b.sound.panner.setPosition(b.x, b.y, b.depthOffset ?? 0);
                      }
                      b.isActive = dist3d < SOUND_HEAR_RADIUS;

                      if (insideZone && !b.wasInZone) {
                          spawnResonanceWave(b);
                          releaseInitialFirefliesFromBubble(b, performance.now());
                      }
                      const canCrossForDeposit = !isBubbleOnFishCurrentLevel(b);
                      if (!isDolphinNavigationActive && canCrossForDeposit && insideBubbleBody && !b.wasShipInsideBody && dist2d < enteredBubbleDist) {
                          enteredBubble = b;
                          enteredBubbleDist = dist2d;
                      }
                      if (b.resonance > strongestResonance) strongestResonance = b.resonance;
                      resonanceHueMix += b.resonance * (b.layer === 'below' ? 228 : 192);
                      resonanceWeight += b.resonance;
                      b.wasInZone = insideZone;
                      b.wasShipInsideBody = insideBubbleBody;
                  } else {
                      b.isActive = false;
                      b.wasShipInsideBody = insideBubbleBody;
                  }
              });

              if (enteredBubble) {
                  depositOldestAttachedFireflyIntoBubble(enteredBubble, now);
                  if (getStoredBubbleFireflies(enteredBubble).length >= 3) {
                      maybePlayBubbleStoredVocal(enteredBubble);
                  }
              }

              arenaResonance.level += (strongestResonance - arenaResonance.level) * 0.04;
              const targetHue = resonanceWeight > 0 ? (resonanceHueMix / resonanceWeight) : 198;
              arenaResonance.hue += (targetHue - arenaResonance.hue) * 0.05;
              updateAudioReactiveState();

              ship.vx *= ship.damping;
              ship.vy *= ship.damping;
              const speed = Math.hypot(ship.vx, ship.vy);
              if (speed > ship.maxSpeed) {
                  const ratio = ship.maxSpeed / speed;
                  ship.vx *= ratio;
                  ship.vy *= ratio;
              }
              const preMoveTheta = Math.atan2(ship.y, ship.x);
              const preMoveRadius = sampleArenaRadius(preMoveTheta);
              const preMoveDistCenter = Math.hypot(ship.x, ship.y);
              const preMoveMargin = preMoveRadius - preMoveDistCenter;
              if (preMoveMargin < 220) {
                  const preMoveNormal = sampleArenaNormal(preMoveTheta);
                  const approaching = ship.vx * preMoveNormal.x + ship.vy * preMoveNormal.y;
                  if (approaching > 0) {
                      const slowFactor = Math.min(1, (220 - preMoveMargin) / 220);
                      const brake = approaching * (0.22 + slowFactor * 0.56);
                      ship.vx -= preMoveNormal.x * brake;
                      ship.vy -= preMoveNormal.y * brake;
                      ship.vx *= 0.992 - slowFactor * 0.05;
                      ship.vy *= 0.992 - slowFactor * 0.05;
                  }
              }
              ship.x += ship.vx;
              ship.y += ship.vy;
              resolveFishBubbleCollisions(isDolphinNavigationActive);
              updateBubbleKinetics(isDolphinNavigationActive);

              ship.trail.push({ x: ship.x, y: ship.y });
              if (ship.trail.length > ship.maxTrail) ship.trail.shift();

              const thetaShip = Math.atan2(ship.y, ship.x);
              const dCenter = Math.hypot(ship.x, ship.y);
              const localArenaRadius = sampleArenaRadius(thetaShip);
              if (dCenter > localArenaRadius) {
                  const normal = sampleArenaNormal(thetaShip);
                  const penetration = dCenter - localArenaRadius;
                  const softCorrection = Math.min(2.1, penetration * 0.14 + 0.08);
                  ship.x -= normal.x * softCorrection;
                  ship.y -= normal.y * softCorrection;

                  const vn = ship.vx * normal.x + ship.vy * normal.y;
                  const vtX = ship.vx - normal.x * vn;
                  const vtY = ship.vy - normal.y * vn;
                  const restitution = 0.06;
                  const tangentDamping = 0.985;
                  const reflectedVn = vn > 0 ? -vn * restitution : vn * 0.04;
                  ship.vx = vtX * tangentDamping + normal.x * reflectedVn;
                  ship.vy = vtY * tangentDamping + normal.y * reflectedVn;

                  const centerBias = Math.min(0.032, 0.008 + penetration * 0.0035);
                  ship.vx -= normal.x * centerBias;
                  ship.vy -= normal.y * centerBias;

                  if (now - lastArenaImpactAt >= ARENA_MEMBRANE_IMPACT_COOLDOWN_MS) {
                      injectArenaMembraneImpact(thetaShip);
                      lastArenaImpactAt = now;
                  }
              }

              if (speed > 0.08) {
                  const angleVitesse = Math.atan2(ship.vy, ship.vx);
                  let diff = angleVitesse - ship.angle;
                  while (diff < -Math.PI) diff += Math.PI * 2;
                  while (diff > Math.PI) diff -= Math.PI * 2;
                  ship.angle += diff * ship.turnEase;
              }

              const shouldShowArenaOverview = isTraceListeningMode || isDrawingTraceRail;
              if (shouldShowArenaOverview) {
                  const baseZoom = getTraceOverviewBaseZoom();
                  const desiredZoom = Math.max(traceOverviewZoomMin, Math.min(traceOverviewZoomMax, baseZoom * traceCameraControl.zoomScale));
                  camera.targetX = traceCameraControl.panX;
                  camera.targetY = traceCameraControl.panY;
                  camera.targetZoom = desiredZoom;
              } else {
                  camera.targetX = ship.x + ship.vx * 10;
                  camera.targetY = ship.y + ship.vy * 10;
                  camera.targetZoom = 1;
              }
              camera.x += (camera.targetX - camera.x) * camera.ease;
              camera.y += (camera.targetY - camera.y) * camera.ease;
              camera.zoom += (camera.targetZoom - camera.zoom) * camera.zoomEase;

              updateAudioListener();
              updateWakeParticles(speed);
              updateSurfaceEffects(speed);
              updateResonanceWaves();
              updatePoetryEffects(speed);
              updateArenaFireflies();
              updateGuestFishSchool(now);
              updateCompanionStarfish(now);
              handleStarfishFishCollision(now);
              updateStarfishResonanceWaves();
          }

          function updateWakeParticles(speed) {
              const now = performance.now();
              const speedNorm = Math.min(1, speed / ship.maxSpeed);
              const dolphinBoost = 1;
              ship.wakeEmitter += (0.24 + speedNorm * 0.95) * dolphinBoost;

              const mouth = getShipMouthPosition();
              const tail = getShipTailPosition();
              const flowX = tail.x - mouth.x;
              const flowY = tail.y - mouth.y;
              const flowLen = Math.hypot(flowX, flowY) || 1;
              const dirX = flowX / flowLen;
              const dirY = flowY / flowLen;
              const tangentX = -dirY;
              const tangentY = dirX;
              const targetCount = Math.min(MAX_WAKE_PARTICLES, 10 + Math.round(speedNorm * 16 * dolphinBoost));

              while (WAKE_PARTICLES.length < targetCount) spawnWakeParticle(mouth, tail, dirX, dirY, tangentX, tangentY, now, speedNorm);
              while (ship.wakeEmitter >= 1) {
                  ship.wakeEmitter -= 1;
                  if (WAKE_PARTICLES.length >= MAX_WAKE_PARTICLES) break;
                  spawnWakeParticle(mouth, tail, dirX, dirY, tangentX, tangentY, now, speedNorm);
              }

              for (let i = WAKE_PARTICLES.length - 1; i >= 0; i--) {
                  const p = WAKE_PARTICLES[i];
                  p.age = now - p.bornAt;
                  const t = p.age / p.life;
                  if (t >= 1) {
                      WAKE_PARTICLES.splice(i, 1);
                      continue;
                  }
                  p.vx *= 0.989;
                  p.vy *= 0.989;
                  p.x += p.vx;
                  p.y += p.vy;
              }
              if (WAKE_PARTICLES.length > MAX_WAKE_PARTICLES) WAKE_PARTICLES.splice(0, WAKE_PARTICLES.length - MAX_WAKE_PARTICLES);
          }

          function spawnWakeParticle(mouth, tail, dirX, dirY, tangentX, tangentY, now, speedNorm) {
              const dolphinBoost = 1;
              const along = Math.random() * 0.2;
              const jitter = 1.2 + Math.random() * 2.1;
              WAKE_PARTICLES.push({
                  x: mouth.x + (tail.x - mouth.x) * along + tangentX * (Math.random() - 0.5) * jitter,
                  y: mouth.y + (tail.y - mouth.y) * along + tangentY * (Math.random() - 0.5) * jitter,
                  vx: dirX * (0.22 + Math.random() * 0.48 + speedNorm * 0.3 * dolphinBoost) + tangentX * (Math.random() - 0.5) * 0.05,
                  vy: dirY * (0.22 + Math.random() * 0.48 + speedNorm * 0.3 * dolphinBoost) + tangentY * (Math.random() - 0.5) * 0.05,
                  age: 0, life: 640 + Math.random() * 360, size: 0.9 + Math.random() * 1.8 * dolphinBoost,
                  alpha: 0.22 + Math.random() * 0.28, bornAt: now
              });
          }

          function updateSurfaceEffects(speed) {
              const now = performance.now();
              const speedNorm = Math.min(1, speed / ship.maxSpeed);
              ship.rippleEmitter += 0.025 + speedNorm * 0.2;

              while (ship.rippleEmitter >= 1) {
                  ship.rippleEmitter -= 1;
                  spawnRipple(ship.x, ship.y, now, speedNorm);
              }

              for (let i = RIPPLE_RINGS.length - 1; i >= 0; i--) {
                  const ripple = RIPPLE_RINGS[i];
                  ripple.age = now - ripple.bornAt;
                  const t = ripple.age / ripple.life;
                  if (t >= 1) {
                      RIPPLE_RINGS.splice(i, 1);
                      continue;
                  }
                  ripple.radius = ripple.baseRadius + ripple.expand * t;
                  ripple.alpha = ripple.baseAlpha * (1 - t);
              }

              while (SURFACE_SPARKLES.length < MAX_SURFACE_SPARKLES) SURFACE_SPARKLES.push(spawnSparkle(now));
              for (let i = SURFACE_SPARKLES.length - 1; i >= 0; i--) {
                  const sparkle = SURFACE_SPARKLES[i];
                  sparkle.age = now - sparkle.bornAt;
                  if (sparkle.age > sparkle.life) SURFACE_SPARKLES[i] = spawnSparkle(now);
              }
          }

          function spawnRipple(x, y, now, speedNorm) {
              if (RIPPLE_RINGS.length >= MAX_RIPPLES) RIPPLE_RINGS.shift();
              RIPPLE_RINGS.push({
                  x: x + (Math.random() - 0.5) * 8,
                  y: y + (Math.random() - 0.5) * 8,
                  baseRadius: 8 + speedNorm * 4 + Math.random() * 2,
                  expand: 32 + speedNorm * 36 + Math.random() * 18,
                  baseAlpha: 0.22 + speedNorm * 0.2,
                  alpha: 0.2,
                  life: 760 + Math.random() * 360,
                  age: 0,
                  bornAt: now
              });
          }

          function spawnSparkle(now) {
              return {
                  x: (Math.random() - 0.5) * ARENA_RADIUS * 1.8,
                  y: (Math.random() - 0.5) * ARENA_RADIUS * 1.8,
                  size: 0.8 + Math.random() * 1.8,
                  life: 900 + Math.random() * 1400,
                  age: 0,
                  bornAt: now,
                  phase: Math.random() * Math.PI * 2,
                  hueShift: 190 + Math.random() * 40
              };
          }

          function sampleBubbleEnergy(bubble) {
              if (!bubble.sound?.analyser || !bubble.sound?.analyserData) return 0;
              bubble.sound.analyser.getByteFrequencyData(bubble.sound.analyserData);
              let sum = 0;
              const binsToSample = 18;
              for (let i = 0; i < binsToSample; i++) sum += bubble.sound.analyserData[i];
              const avg = sum / (binsToSample * 255);
              return Math.min(1, Math.max(0, avg * 1.9));
          }

          function sampleBubbleBands(bubble) {
              if (!bubble?.sound?.analyser || !bubble?.sound?.analyserData) return null;
              bubble.sound.analyser.getByteFrequencyData(bubble.sound.analyserData);
              const data = bubble.sound.analyserData;
              const len = data.length;
              if (!len) return null;

              const bassEnd = Math.max(4, Math.floor(len * 0.14));
              const midsEnd = Math.max(bassEnd + 4, Math.floor(len * 0.52));
              let bassSum = 0;
              let midsSum = 0;
              let highsSum = 0;

              for (let i = 0; i < len; i++) {
                  const value = data[i] / 255;
                  if (i < bassEnd) bassSum += value;
                  else if (i < midsEnd) midsSum += value;
                  else highsSum += value;
              }

              const bass = bassSum / bassEnd;
              const mids = midsSum / Math.max(1, midsEnd - bassEnd);
              const highs = highsSum / Math.max(1, len - midsEnd);
              const energy = (bass * 0.5) + (mids * 0.32) + (highs * 0.18);
              return { bass, mids, highs, energy };
          }

          function updateAudioReactiveState() {
              let strongestBubble = null;
              let strongestScore = 0;
              for (const bubble of BUBBLES) {
                  if (!bubble?.sound || !bubble.isActive) continue;
                  const score = (bubble.currentVolume || 0) * 0.7 + (bubble.zoneMix || 0) * 0.3;
                  if (score > strongestScore) {
                      strongestScore = score;
                      strongestBubble = bubble;
                  }
              }

              const bands = strongestBubble ? sampleBubbleBands(strongestBubble) : null;
              const smoothing = AUDIO_REACTIVITY.bandSmoothing;
              const bassTarget = bands ? Math.min(1, bands.bass * 1.3) : 0;
              const midsTarget = bands ? Math.min(1, bands.mids * 1.25) : 0;
              const highsTarget = bands ? Math.min(1, bands.highs * 1.2) : 0;
              const energyTarget = bands ? Math.min(1, bands.energy * 1.3) : 0;

              audioReactiveState.bass += (bassTarget - audioReactiveState.bass) * smoothing;
              audioReactiveState.mids += (midsTarget - audioReactiveState.mids) * smoothing;
              audioReactiveState.highs += (highsTarget - audioReactiveState.highs) * smoothing;
              audioReactiveState.energy += (energyTarget - audioReactiveState.energy) * smoothing;
          }

          function spawnResonanceWave(bubble) {
              if (RESONANCE_WAVES.length >= MAX_RESONANCE_WAVES) RESONANCE_WAVES.shift();
              RESONANCE_WAVES.push({
                  x: bubble.x,
                  y: bubble.y,
                  bornAt: performance.now(),
                  life: 2800 + Math.random() * 1600,
                  radius: bubble.r * 0.9,
                  maxRadius: 520 + Math.random() * 340,
                  alpha: 0.22,
                  hue: bubble.layer === 'below' ? 230 : 192
              });
          }

          function updateResonanceWaves() {
              const now = performance.now();
              for (let i = RESONANCE_WAVES.length - 1; i >= 0; i--) {
                  const wave = RESONANCE_WAVES[i];
                  const t = (now - wave.bornAt) / wave.life;
                  if (t >= 1) {
                      RESONANCE_WAVES.splice(i, 1);
                      continue;
                  }
                  wave.radius = wave.maxRadius * t;
                  wave.alpha = (1 - t) * 0.22;
              }
          }

          function updatePoetryEffects(speed) {
              const now = performance.now();
              const speedNorm = Math.min(1, speed / ship.maxSpeed);

              // --- BREATH WAVES ---
              const breathInterval = 1.6 + (1 - speedNorm) * 1.2;
              shipBreathEmitter += (0.016 + speedNorm * 0.022);
              if (shipBreathEmitter >= breathInterval) {
                  shipBreathEmitter = 0;
                  if (BREATH_WAVES.length < MAX_BREATH_WAVES) {
                      const elongation = 1 + speedNorm * 1.4;
                      BREATH_WAVES.push({
                          x: ship.x, y: ship.y,
                          angle: ship.angle,
                          bornAt: now,
                          life: 3200 + Math.random() * 1400,
                          maxRx: 180 + Math.random() * 120 + speedNorm * 80,
                          maxRy: (180 + Math.random() * 120 + speedNorm * 80) * elongation,
                          hue: 192 + Math.random() * 18,
                          peakAlpha: 0.055 + speedNorm * 0.035,
                      });
                  }
              }
              for (let i = BREATH_WAVES.length - 1; i >= 0; i--) {
                  const bw = BREATH_WAVES[i];
                  const t = (now - bw.bornAt) / bw.life;
                  if (t >= 1) { BREATH_WAVES.splice(i, 1); continue; }
                  bw.t = t;
                  bw.alpha = bw.peakAlpha * Math.sin(t * Math.PI);
              }

              // --- DRIFT MOTES ---
              while (DRIFT_MOTES.length < MAX_DRIFT_MOTES) {
                  const angle = Math.random() * Math.PI * 2;
                  const dist = 180 + Math.random() * 520;
                  DRIFT_MOTES.push({
                      x: ship.x + Math.cos(angle) * dist,
                      y: ship.y + Math.sin(angle) * dist,
                      baseAlpha: 0.06 + Math.random() * 0.10,
                      size: 1.2 + Math.random() * 2.2,
                      phase: Math.random() * Math.PI * 2,
                      driftAngle: Math.random() * Math.PI * 2,
                      driftSpeed: 0.06 + Math.random() * 0.10,
                      hue: 188 + Math.random() * 30,
                  });
              }
              DRIFT_MOTES.forEach(m => {
                  const dx = ship.x - m.x;
                  const dy = ship.y - m.y;
                  const dist = Math.hypot(dx, dy);
                  const pull = speedNorm < 0.15
                      ? Math.max(0, 1 - dist / 400) * 0.018
                      : -Math.max(0, 1 - dist / 280) * 0.012;
                  if (dist > 1) {
                      m.x += (dx / dist) * pull;
                      m.y += (dy / dist) * pull;
                  }
                  m.x += Math.cos(m.driftAngle) * m.driftSpeed;
                  m.y += Math.sin(m.driftAngle) * m.driftSpeed;
                  m.driftAngle += (Math.random() - 0.5) * 0.04;
                  if (dist > 700) {
                      const a = Math.atan2(ship.y - m.y, ship.x - m.x);
                      m.x = ship.x + Math.cos(a + Math.PI) * 680;
                      m.y = ship.y + Math.sin(a + Math.PI) * 680;
                  }
              });

              const particleSpawnRate = AUDIO_REACTIVITY.particleSpawnBase + (audioReactiveState.highs * AUDIO_REACTIVITY.particleSpawnBoost);
              marineParticleEmitter += particleSpawnRate;
              while (marineParticleEmitter >= 1) {
                  marineParticleEmitter -= 1;
                  if (MARINE_PARTICLES.length < MAX_MARINE_PARTICLES) {
                      MARINE_PARTICLES.push(spawnMarineParticle(now));
                  }
              }

              while (MARINE_PARTICLES.length < MAX_MARINE_PARTICLES * 0.55) {
                  MARINE_PARTICLES.push(spawnMarineParticle(now));
              }

              for (let i = MARINE_PARTICLES.length - 1; i >= 0; i--) {
                  const p = MARINE_PARTICLES[i];
                  p.age = now - p.bornAt;
                  const lifeT = p.age / p.life;
                  if (lifeT >= 1) {
                      MARINE_PARTICLES[i] = spawnMarineParticle(now);
                      continue;
                  }
                  const audioLift = audioReactiveState.mids * 0.06;
                  p.y += p.vy - audioLift;
                  p.x += p.vx + Math.sin(now * 0.0012 + p.phase) * 0.05;
              }
          }

          function spawnMarineParticle(now) {
              const angle = Math.random() * Math.PI * 2;
              const dist = 220 + Math.random() * 760;
              return {
                  x: ship.x + Math.cos(angle) * dist,
                  y: ship.y + Math.sin(angle) * dist,
                  vx: (Math.random() - 0.5) * 0.15,
                  vy: -0.04 - Math.random() * 0.18,
                  size: 0.8 + Math.random() * 2.1,
                  hue: 176 + Math.random() * 48,
                  phase: Math.random() * Math.PI * 2,
                  alpha: 0.08 + Math.random() * 0.2,
                  life: 2600 + Math.random() * 4200,
                  bornAt: now,
                  age: 0
              };
          }

          function updateResotags(speed) {
              return;
          }

          function updateHaikuAttachment(speed) {
              return;
          }

          function spawnHaikuTriangle(words) {
              return;
          }

          function composeHaiku(words) {
              return [];
          }

          function wordsToNotes(words) {
              return [];
          }

          function playHaikuMelody(notes) {
              return;
          }

          function updateHaikuTriangles() {
              return;
          }

          function drawHaikuTriangles() {
              return;
          }

          function drawBreathWaves() {
              BREATH_WAVES.forEach(bw => {
                  const rx = bw.maxRx * bw.t;
                  const ry = bw.maxRy * bw.t;
                  ctx.save();
                  ctx.translate(bw.x, bw.y);
                  ctx.rotate(bw.angle + Math.PI / 2);
                  ctx.strokeStyle = `hsla(${bw.hue}, 85%, 78%, ${bw.alpha})`;
                  ctx.lineWidth = 0.8 + (1 - bw.t) * 0.7;
                  ctx.beginPath();
                  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
                  ctx.stroke();
                  if (bw.t < 0.6) {
                      const innerAlpha = bw.alpha * 0.4 * (1 - bw.t / 0.6);
                      ctx.strokeStyle = `hsla(${bw.hue + 8}, 90%, 88%, ${innerAlpha})`;
                      ctx.lineWidth = 0.5;
                      ctx.beginPath();
                      ctx.ellipse(0, 0, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
                      ctx.stroke();
                  }
                  ctx.restore();
              });
          }

          function drawDriftMotes() {
              const t = performance.now() * 0.0018;
              DRIFT_MOTES.forEach(m => {
                  const twinkle = (Math.sin(t * 2.2 + m.phase) + 1) * 0.5;
                  const alpha = m.baseAlpha * (0.5 + twinkle * 0.5);
                  ctx.fillStyle = `hsla(${m.hue}, 80%, 80%, ${alpha})`;
                  ctx.beginPath();
                  ctx.arc(m.x, m.y, m.size * (0.8 + twinkle * 0.3), 0, Math.PI * 2);
                  ctx.fill();
              });
          }

          function drawMarineParticles() {
              const time = performance.now() * 0.001;
              for (const particle of MARINE_PARTICLES) {
                  const lifeT = particle.age / particle.life;
                  const fade = Math.max(0, 1 - Math.abs(lifeT - 0.5) * 2);
                  const twinkle = (Math.sin(time * 3.4 + particle.phase) + 1) * 0.5;
                  const sizeBoost = 1 + audioReactiveState.highs * 0.3;
                  const parallaxX = (camera.x - ship.x) * MARINE_PARTICLE_PARALLAX;
                  const parallaxY = (camera.y - ship.y) * MARINE_PARTICLE_PARALLAX;
                  const x = particle.x + parallaxX;
                  const y = particle.y + parallaxY;
                  const alpha = particle.alpha * fade * (0.7 + twinkle * 0.6);
                  ctx.fillStyle = `hsla(${particle.hue}, 88%, 76%, ${alpha})`;
                  ctx.beginPath();
                  ctx.arc(x, y, particle.size * sizeBoost, 0, Math.PI * 2);
                  ctx.fill();
              }
          }

          function drawArenaFireflies() {
              if (!ARENA_FIREFLIES.length) return;
              const now = performance.now() * 0.001;

              BUBBLES.forEach((bubble) => {
                  const stored = getStoredBubbleFireflies(bubble);
                  if (stored.length < 3) return;
                  const pulse = (Math.sin(now * 3.2 + (bubble.id?.length || 0)) + 1) * 0.5;
                  ctx.strokeStyle = `rgba(255, 216, 132, ${0.38 + pulse * 0.28})`;
                  ctx.lineWidth = 1.5 + pulse * 0.8;
                  ctx.beginPath();
                  ctx.moveTo(stored[0].x, stored[0].y);
                  ctx.lineTo(stored[1].x, stored[1].y);
                  ctx.lineTo(stored[2].x, stored[2].y);
                  ctx.closePath();
                  ctx.stroke();
              });

              PLACED_FIREFLY_TRIANGLES.forEach((triangle) => {
                  const stored = triangle.fireflyIds
                      .map((id) => ARENA_FIREFLIES.find((firefly) => firefly.id === id))
                      .filter(Boolean);
                  if (stored.length < 3) return;
                  ctx.strokeStyle = 'rgba(255, 214, 120, 0.5)';
                  ctx.lineWidth = 1.2;
                  ctx.beginPath();
                  ctx.moveTo(stored[0].x, stored[0].y);
                  ctx.lineTo(stored[1].x, stored[1].y);
                  ctx.lineTo(stored[2].x, stored[2].y);
                  ctx.closePath();
                  ctx.stroke();
              });

              ARENA_FIREFLIES.forEach((firefly) => {
                  if (!firefly.isReleased) return;
                  const pulse = (Math.sin(now * firefly.pulseFreq * 2 * Math.PI + firefly.pulsePhase) + 1) * 0.5;
                  const coreRadius = firefly.size * (0.72 + pulse * 0.22);
                  const glowRadius = firefly.size * (2.8 + pulse * 1.8);
                  const coreTint = `rgba(245, 62, 48, ${0.82 + firefly.glow * 0.18})`;
                  const haloCenter = `rgba(255, 220, 122, ${0.24 + firefly.glow * 0.34})`;
                  const haloMid = `rgba(255, 160, 64, ${0.14 + firefly.glow * 0.26})`;

                  const halo = ctx.createRadialGradient(firefly.x, firefly.y, 0, firefly.x, firefly.y, glowRadius);
                  halo.addColorStop(0, haloCenter);
                  halo.addColorStop(0.5, haloMid);
                  halo.addColorStop(1, 'rgba(255, 120, 52, 0)');
                  ctx.fillStyle = halo;
                  ctx.beginPath();
                  ctx.arc(firefly.x, firefly.y, glowRadius, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.fillStyle = coreTint;
                  ctx.beginPath();
                  ctx.arc(firefly.x, firefly.y, coreRadius, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.fillStyle = `rgba(255, 248, 248, ${0.5 + pulse * 0.4})`;
                  ctx.beginPath();
                  ctx.arc(firefly.x - firefly.size * 0.22, firefly.y - firefly.size * 0.28, Math.max(0.7, coreRadius * 0.34), 0, Math.PI * 2);
                  ctx.fill();
              });
          }

          function drawLuminousTrail() {
              const trail = ship.trail;
              if (trail.length < 3) return;
              const len = trail.length;
              for (let i = 1; i < len - 1; i++) {
                  const t = i / len;
                  const width = (1 - t) * 4.5 + 0.4;
                  const alpha = t * t * 0.38;
                  const hue = 192 + Math.sin(t * Math.PI * 3) * 10;
                  ctx.strokeStyle = `hsla(${hue}, 85%, 78%, ${alpha})`;
                  ctx.lineWidth = width;
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  const mx = (trail[i].x + trail[i + 1].x) / 2;
                  const my = (trail[i].y + trail[i + 1].y) / 2;
                  ctx.moveTo((trail[i - 1].x + trail[i].x) / 2, (trail[i - 1].y + trail[i].y) / 2);
                  ctx.quadraticCurveTo(trail[i].x, trail[i].y, mx, my);
                  ctx.stroke();
              }
              // soft glow core
              const last = trail[len - 1];
              const prev = trail[Math.max(0, len - 6)];
              const glowGrad = ctx.createLinearGradient(prev.x, prev.y, last.x, last.y);
              glowGrad.addColorStop(0, 'rgba(140, 210, 255, 0)');
              glowGrad.addColorStop(1, 'rgba(180, 235, 255, 0.18)');
              ctx.strokeStyle = glowGrad;
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(last.x, last.y);
              ctx.stroke();
          }

          function drawTraceRailPath() {
              if (!traceRailPath.length) return;
              ctx.save();
              const isRailBeingDrawn = isDrawingTraceRail && !isTraceRailAutopilot;
              const draftSegments = isRailBeingDrawn ? buildTraceBezierSegments(traceRailPath, 0.24) : [];
              ctx.strokeStyle = isRailBeingDrawn
                  ? 'rgba(160, 230, 255, 0.72)'
                  : (isTraceRailAutopilot ? 'rgba(146, 224, 255, 0.2)' : 'rgba(146, 224, 255, 0.16)');
              ctx.lineWidth = isRailBeingDrawn ? 4.8 : (isTraceRailAutopilot ? 2 : 1.5);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.setLineDash(isRailBeingDrawn ? [] : [6, 10]);
              ctx.beginPath();
              ctx.moveTo(traceRailPath[0].x, traceRailPath[0].y);
              if (draftSegments.length) {
                  for (const seg of draftSegments) {
                      ctx.bezierCurveTo(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.p2.x, seg.p2.y);
                  }
              } else {
                  for (let i = 1; i < traceRailPath.length; i++) {
                      ctx.lineTo(traceRailPath[i].x, traceRailPath[i].y);
                  }
              }
              ctx.stroke();
              ctx.setLineDash([]);

              if (draftSegments.length) {
                  ctx.save();
                  ctx.strokeStyle = 'rgba(174, 236, 255, 0.28)';
                  ctx.lineWidth = 1.2;
                  for (const seg of draftSegments) {
                      ctx.beginPath();
                      ctx.moveTo(seg.p1.x, seg.p1.y);
                      ctx.lineTo(seg.c1.x, seg.c1.y);
                      ctx.moveTo(seg.p2.x, seg.p2.y);
                      ctx.lineTo(seg.c2.x, seg.c2.y);
                      ctx.stroke();
                  }
                  ctx.fillStyle = 'rgba(202, 244, 255, 0.72)';
                  for (const seg of draftSegments) {
                      ctx.beginPath();
                      ctx.arc(seg.p1.x, seg.p1.y, 2.4, 0, Math.PI * 2);
                      ctx.fill();
                  }
                  const tail = draftSegments[draftSegments.length - 1];
                  if (tail?.p2) {
                      ctx.beginPath();
                      ctx.arc(tail.p2.x, tail.p2.y, 2.4, 0, Math.PI * 2);
                      ctx.fill();
                  }
                  ctx.restore();
              }

              if (isTraceRailAutopilot) {
                  const marker = traceRailPath[Math.min(traceRailTargetIndex, traceRailPath.length - 1)];
                  const halo = ctx.createRadialGradient(marker.x, marker.y, 0, marker.x, marker.y, 8);
                  halo.addColorStop(0, 'rgba(210, 246, 255, 0.75)');
                  halo.addColorStop(1, 'rgba(176, 232, 255, 0)');
                  ctx.fillStyle = halo;
                  ctx.beginPath();
                  ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.fillStyle = 'rgba(222, 248, 255, 0.88)';
                  ctx.beginPath();
                  ctx.arc(marker.x, marker.y, 2.8, 0, Math.PI * 2);
                  ctx.fill();
              }
              ctx.restore();
          }

          function traceFishBodyPath(pathCtx, bodyUndulate, bodyBreath) {
              pathCtx.beginPath();
              pathCtx.moveTo(0, -18);
              pathCtx.bezierCurveTo(-8.5 + bodyUndulate * 55, -13, -11 + bodyUndulate * 36, -3 + bodyBreath, -9 + bodyUndulate * 18, 8);
              pathCtx.bezierCurveTo(-7, 15, -3, 20 + bodyBreath, 0, 22);
              pathCtx.bezierCurveTo(3, 20 + bodyBreath, 7, 15, 9 - bodyUndulate * 18, 8);
              pathCtx.bezierCurveTo(11 - bodyUndulate * 36, -3 + bodyBreath, 8.5 - bodyUndulate * 55, -13, 0, -18);
              pathCtx.closePath();
          }

          function getNearestBubbleForShip() {
              if (!BUBBLES.length) return null;
              let nearest = null;
              let nearestDist = Infinity;
              for (const bubble of BUBBLES) {
                  const dx = bubble.x - ship.x;
                  const dy = bubble.y - ship.y;
                  const dist = Math.hypot(dx, dy);
                  if (dist < nearestDist) {
                      nearestDist = dist;
                      nearest = bubble;
                  }
              }
              if (!nearest) return null;
              const dx = nearest.x - ship.x;
              const dy = nearest.y - ship.y;
              const distanceRatio = Math.max(0, Math.min(1, 1 - nearestDist / (SOUND_HEAR_RADIUS * 1.25)));
              const audioReactive = Math.max(
                  nearest.zoneMix || 0,
                  nearest.currentVolume || 0,
                  sampleBubbleEnergy(nearest) * 0.95
              );
              return { bubble: nearest, dx, dy, distanceRatio, audioReactive };
          }

          function drawClassicFishFins(finFlap, bodyHueMid) {
              ctx.shadowBlur = 6;
              ctx.save();
              ctx.translate(-7, 2);
              ctx.rotate(-0.38 + finFlap);
              const finGradL = ctx.createLinearGradient(0, -1, -12, 14);
              finGradL.addColorStop(0, `hsla(${bodyHueMid}, 80%, 82%, 0.70)`);
              finGradL.addColorStop(1, `hsla(${bodyHueMid + 12}, 78%, 88%, 0)`);
              ctx.fillStyle = finGradL;
              ctx.shadowColor = `hsla(${bodyHueMid}, 80%, 80%, 0.3)`;
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
              ctx.shadowColor = `hsla(${bodyHueMid}, 80%, 80%, 0.3)`;
              ctx.beginPath();
              ctx.moveTo(0, -1);
              ctx.bezierCurveTo(10, 0, 14, 7, 8, 15);
              ctx.bezierCurveTo(4, 10, 1, 4, 0, -1);
              ctx.fill();
              ctx.restore();
          }

          function updateCompanionStarfish(now) {
              if (now >= companionStarfish.driftChangeAt) {
                  const heading = Math.random() * Math.PI * 2;
                  const speed = 0.18 + Math.random() * 0.38;
                  companionStarfish.targetVx = Math.cos(heading) * speed;
                  companionStarfish.targetVy = Math.sin(heading) * speed;
                  companionStarfish.rotationSpeed = (Math.random() - 0.5) * 0.01;
                  companionStarfish.driftChangeAt = now + 1500 + Math.random() * 2500;
              }

              companionStarfish.vx += (companionStarfish.targetVx - companionStarfish.vx) * 0.02;
              companionStarfish.vy += (companionStarfish.targetVy - companionStarfish.vy) * 0.02;
              companionStarfish.x += companionStarfish.vx;
              companionStarfish.y += companionStarfish.vy;
              companionStarfish.rotation += companionStarfish.rotationSpeed;
              if (companionStarfish.isSpinning) {
                  companionStarfish.rotation += companionStarfish.spinVelocity;
                  if (
                      !companionStarfish.waveTriggeredThisSpin
                      && Math.abs(companionStarfish.spinVelocity) <= Math.abs(companionStarfish.spinInitialVelocity) * 0.5
                  ) {
                      companionStarfish.waveTriggeredThisSpin = true;
                      emitStarfishResonanceWave(now);
                  }
                  companionStarfish.spinVelocity *= 0.994;
                  if (Math.abs(companionStarfish.spinVelocity) < 0.006) {
                      companionStarfish.isSpinning = false;
                      companionStarfish.spinVelocity = 0;
                  }
              }

              const theta = Math.atan2(companionStarfish.y, companionStarfish.x);
              const dist = Math.hypot(companionStarfish.x, companionStarfish.y);
              const localArenaRadius = sampleArenaRadius(theta) - 90;
              if (dist > localArenaRadius) {
                  const normal = sampleArenaNormal(theta);
                  const penetration = dist - localArenaRadius;
                  companionStarfish.x -= normal.x * (penetration + 0.8);
                  companionStarfish.y -= normal.y * (penetration + 0.8);
                  const vn = companionStarfish.vx * normal.x + companionStarfish.vy * normal.y;
                  if (vn > 0) {
                      companionStarfish.vx -= normal.x * vn * 1.5;
                      companionStarfish.vy -= normal.y * vn * 1.5;
                  }
                  companionStarfish.targetVx -= normal.x * 0.25;
                  companionStarfish.targetVy -= normal.y * 0.25;
              }
          }

          function applyGlobalEchoDelayPulse(intensity = 1) {
              if (!audioCtx || !masterWetGainNode || !masterDelayNode || !masterDelayFeedbackGainNode) return;
              const now = audioCtx.currentTime;
              const clamped = Math.max(0.2, Math.min(1.3, intensity));
              const wetPeak = Math.min(0.8, 0.32 + clamped * 0.38);
              echoDelayEffectStartedAt = performance.now();
              echoDelayEffectUntil = echoDelayEffectStartedAt + 10000;

              masterDelayNode.delayTime.cancelScheduledValues(now);
              masterDelayFeedbackGainNode.gain.cancelScheduledValues(now);
              masterWetGainNode.gain.cancelScheduledValues(now);

              masterDelayNode.delayTime.setValueAtTime(masterDelayNode.delayTime.value, now);
              masterDelayNode.delayTime.linearRampToValueAtTime(0.46, now + 0.18);
              masterDelayNode.delayTime.linearRampToValueAtTime(0.36, now + 6.5);
              masterDelayNode.delayTime.linearRampToValueAtTime(0.29, now + 10);

              masterDelayFeedbackGainNode.gain.setValueAtTime(masterDelayFeedbackGainNode.gain.value, now);
              masterDelayFeedbackGainNode.gain.linearRampToValueAtTime(0.67, now + 0.25);
              masterDelayFeedbackGainNode.gain.linearRampToValueAtTime(0.42, now + 6.8);
              masterDelayFeedbackGainNode.gain.linearRampToValueAtTime(0.24, now + 10);

              masterWetGainNode.gain.setValueAtTime(masterWetGainNode.gain.value, now);
              masterWetGainNode.gain.linearRampToValueAtTime(wetPeak, now + 0.25);
              masterWetGainNode.gain.linearRampToValueAtTime(0.28, now + 7.5);
              masterWetGainNode.gain.linearRampToValueAtTime(0, now + 10);
          }

          function emitStarfishResonanceWave(now) {
              if (STARFISH_RESONANCE_WAVES.length >= MAX_STARFISH_RESONANCE_WAVES) STARFISH_RESONANCE_WAVES.shift();
              STARFISH_RESONANCE_WAVES.push({
                  x: companionStarfish.x,
                  y: companionStarfish.y,
                  radius: 46,
                  speed: 5.2,
                  alpha: 1,
                  bornAt: now,
                  audioApplied: false
              });
          }

          function updateStarfishResonanceWaves() {
              for (let i = STARFISH_RESONANCE_WAVES.length - 1; i >= 0; i -= 1) {
                  const wave = STARFISH_RESONANCE_WAVES[i];
                  wave.radius += wave.speed;
                  wave.alpha *= 0.993;
                  wave.speed *= 0.998;
                  if (!wave.audioApplied) {
                      const distFish = Math.hypot(ship.x - wave.x, ship.y - wave.y);
                      if (distFish <= wave.radius) {
                          wave.audioApplied = true;
                          applyGlobalEchoDelayPulse(1);
                      }
                  }
                  if (wave.alpha < 0.02 || wave.radius > ARENA_RADIUS * 2.2) {
                      STARFISH_RESONANCE_WAVES.splice(i, 1);
                  }
              }
          }

          function handleStarfishFishCollision(now) {
              const hitRadius = 58;
              const dist = Math.hypot(ship.x - companionStarfish.x, ship.y - companionStarfish.y);
              if (dist > hitRadius) return;
              if (now < companionStarfish.collisionCooldownUntil) return;
              companionStarfish.isSpinning = true;
              companionStarfish.spinVelocity = (Math.random() > 0.5 ? 1 : -1) * (0.20 + Math.random() * 0.08);
              companionStarfish.spinInitialVelocity = companionStarfish.spinVelocity;
              companionStarfish.waveTriggeredThisSpin = false;
              companionStarfish.collisionCooldownUntil = now + 2600;
              companionStarfish.targetVx *= 0.25;
              companionStarfish.targetVy *= 0.25;
          }

          function drawCompanionStarfish(swimT, reactiveEnergy) {
              const pulse = 1 + Math.sin(swimT * 2.3) * 0.05;
              const armWave = Math.sin(swimT * 1.05) * 0.18;
              const starScale = 3;

              ctx.save();
              ctx.translate(companionStarfish.x, companionStarfish.y);
              ctx.rotate(companionStarfish.rotation + Math.sin(swimT * 1.6) * 0.1);
              ctx.scale(pulse * starScale, pulse * starScale);

              const glow = ctx.createRadialGradient(0, 1, 0, 0, 1, 17 + reactiveEnergy * 6);
              glow.addColorStop(0, `rgba(255, 188, 172, ${0.28 + reactiveEnergy * 0.25})`);
              glow.addColorStop(0.6, `rgba(255, 148, 168, ${0.10 + reactiveEnergy * 0.12})`);
              glow.addColorStop(1, 'rgba(255, 148, 168, 0)');
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.ellipse(0, 1, 17, 14, 0, 0, Math.PI * 2);
              ctx.fill();

              const bodyGrad = ctx.createRadialGradient(-2, -4, 2, 0, 1, 16);
              bodyGrad.addColorStop(0, 'hsla(18, 98%, 88%, 0.96)');
              bodyGrad.addColorStop(0.56, 'hsla(8, 88%, 72%, 0.94)');
              bodyGrad.addColorStop(1, 'hsla(338, 84%, 64%, 0.92)');
              ctx.fillStyle = bodyGrad;
              ctx.shadowBlur = 8;
              ctx.shadowColor = 'rgba(255, 182, 176, 0.45)';

              const armLengths = [12.4, 11.1, 12.8, 10.9, 12.2];
              ctx.beginPath();
              for (let i = 0; i < 5; i += 1) {
                  const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
                  const nextA = ((Math.PI * 2) / 5) * (i + 1) - Math.PI / 2;
                  const armPhase = swimT * 0.95 + i * 1.1;
                  const armBend = Math.sin(armPhase) * (0.85 + Math.abs(armWave) * 0.55);
                  const armLen = armLengths[i] + armBend;
                  const rightTangent = a + Math.PI / (7.5 + Math.sin(armPhase + 0.5) * 0.8);
                  const leftTangent = nextA - Math.PI / (7.5 + Math.sin(armPhase + 1.1) * 0.8);
                  const tipSwingX = Math.cos(a + Math.PI / 2) * Math.sin(armPhase) * 0.95;
                  const tipSwingY = Math.sin(a + Math.PI / 2) * Math.sin(armPhase) * 0.95;
                  const tipX = Math.cos(a) * armLen + tipSwingX;
                  const tipY = Math.sin(a) * armLen + tipSwingY;
                  const valleyX = Math.cos((a + nextA) * 0.5) * 5.3;
                  const valleyY = Math.sin((a + nextA) * 0.5) * 5.3;
                  const ctrlOutX = Math.cos(rightTangent) * (armLen * 0.78);
                  const ctrlOutY = Math.sin(rightTangent) * (armLen * 0.78);
                  const ctrlInX = Math.cos(leftTangent) * (armLen * 0.68);
                  const ctrlInY = Math.sin(leftTangent) * (armLen * 0.68);
                  if (i === 0) ctx.moveTo(tipX, tipY);
                  ctx.quadraticCurveTo(ctrlOutX, ctrlOutY, valleyX, valleyY);
                  const nextPhase = swimT * 0.95 + (i + 1) * 1.1;
                  const nextLen = armLengths[(i + 1) % 5] + Math.sin(nextPhase) * (0.85 + Math.abs(armWave) * 0.55);
                  const nextSwingX = Math.cos(nextA + Math.PI / 2) * Math.sin(nextPhase) * 0.95;
                  const nextSwingY = Math.sin(nextA + Math.PI / 2) * Math.sin(nextPhase) * 0.95;
                  ctx.quadraticCurveTo(ctrlInX, ctrlInY, Math.cos(nextA) * nextLen + nextSwingX, Math.sin(nextA) * nextLen + nextSwingY);
              }
              ctx.closePath();
              ctx.fill();

              ctx.strokeStyle = 'hsla(0, 92%, 94%, 0.42)';
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.fillStyle = 'rgba(255, 240, 232, 0.82)';
              for (let i = 0; i < 5; i += 1) {
                  const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
                  ctx.beginPath();
                  ctx.arc(Math.cos(a) * 5.5, Math.sin(a) * 5.5, 0.7, 0, Math.PI * 2);
                  ctx.fill();
              }
              ctx.restore();
          }

          function drawStarfishResonanceWaves() {
              STARFISH_RESONANCE_WAVES.forEach((wave) => {
                  const pulse = (Math.sin((performance.now() - wave.bornAt) * 0.01) + 1) * 0.5;
                  const ringWidth = 8 + pulse * 8;
                  const inner = ctx.createRadialGradient(wave.x, wave.y, Math.max(0, wave.radius - ringWidth * 1.8), wave.x, wave.y, wave.radius + ringWidth * 0.7);
                  inner.addColorStop(0, `hsla(332, 98%, 72%, 0)`);
                  inner.addColorStop(0.42, `hsla(326, 100%, 72%, ${0.28 * wave.alpha})`);
                  inner.addColorStop(0.68, `hsla(320, 100%, 76%, ${0.54 * wave.alpha})`);
                  inner.addColorStop(1, `hsla(316, 100%, 72%, 0)`);
                  ctx.fillStyle = inner;
                  ctx.beginPath();
                  ctx.arc(wave.x, wave.y, wave.radius + ringWidth, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.strokeStyle = `hsla(318, 100%, 82%, ${0.85 * wave.alpha})`;
                  ctx.lineWidth = 2.6 + pulse * 1.8;
                  ctx.beginPath();
                  ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
                  ctx.stroke();
              });
          }

          function drawSilenceCompassRing() {
              const nearestBubbleData = getNearestBubbleForShip();
              const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
              const compassRadius = 34 + pulse * 2.4;

              ctx.save();
              ctx.translate(ship.x, ship.y);

              ctx.strokeStyle = `rgba(255, 255, 255, ${0.56 + pulse * 0.18})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(0, 0, compassRadius, 0, Math.PI * 2);
              ctx.stroke();

              if (nearestBubbleData) {
                  const direction = Math.atan2(nearestBubbleData.dy, nearestBubbleData.dx);
                  const markerSize = 7 + nearestBubbleData.distanceRatio * 8 + nearestBubbleData.audioReactive * 6;
                  const markerBaseRadius = compassRadius + 1.6;
                  const markerX = Math.cos(direction) * markerBaseRadius;
                  const markerY = Math.sin(direction) * markerBaseRadius;

                  const markerGlow = ctx.createRadialGradient(markerX, markerY, 0, markerX, markerY, markerSize * 2.8);
                  markerGlow.addColorStop(0, 'rgba(255, 208, 168, 0.88)');
                  markerGlow.addColorStop(0.48, `rgba(255, 142, 112, ${0.52 + pulse * 0.2})`);
                  markerGlow.addColorStop(1, 'rgba(255, 102, 130, 0)');
                  ctx.fillStyle = markerGlow;
                  ctx.beginPath();
                  ctx.arc(markerX, markerY, markerSize * 2.8, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.strokeStyle = 'rgba(255, 120, 152, 0.85)';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(markerX, markerY, markerSize * (0.7 + pulse * 0.25), 0, Math.PI * 2);
                  ctx.stroke();

                  ctx.strokeStyle = 'rgba(255, 174, 128, 0.72)';
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.arc(markerX, markerY, markerSize * (1.12 + pulse * 0.35), 0, Math.PI * 2);
                  ctx.stroke();
              }

              ctx.restore();
          }

          function drawArenaBoundary(silenceVisualMode, silenceGlow) {
              const now = performance.now();
              const breath = (Math.sin(now * 0.00145) + 1) * 0.5;
              const zoomSafe = Math.max(0.08, camera.zoom);
              const silenceMultiplier = silenceVisualMode ? (0.48 + silenceGlow * 0.92) : 1;
              const haloAlpha = ARENA_HALO_ALPHA * (0.78 + breath * 0.42) * silenceMultiplier;
              const haloInner = ARENA_HALO_INNER * (0.92 + breath * 0.18);
              const haloOuter = ARENA_HALO_OUTER * (0.9 + breath * 0.22);
              const mainStrokePx = Math.max(
                  ARENA_BORDER_SCREEN_MIN,
                  Math.min(ARENA_BORDER_SCREEN_MAX, ARENA_BORDER_WIDTH_BASE + ARENA_BORDER_WIDTH_BREATH * breath)
              );
              const mainStrokeWorld = mainStrokePx / zoomSafe;
              const innerRimWorld = (ARENA_INNER_RIM_WIDTH + breath * 0.55) / zoomSafe;
              const pathSampleCount = Math.max(40, Math.floor(arenaMembraneActiveSegments * (fpsSmoothed < 45 ? 0.72 : 1)));

              const traceArenaPath = (radiusBias = 0, reverse = false) => {
                  const points = [];
                  for (let i = 0; i < pathSampleCount; i++) {
                      const t = i / pathSampleCount;
                      const theta = t * Math.PI * 2;
                      const radius = Math.max(120, sampleArenaRadius(theta) + radiusBias);
                      points.push({
                          x: Math.cos(theta) * radius,
                          y: Math.sin(theta) * radius
                      });
                  }
                  if (reverse) points.reverse();
                  if (!points.length) return;
                  const first = points[0];
                  const second = points[1] || first;
                  ctx.moveTo((first.x + second.x) * 0.5, (first.y + second.y) * 0.5);
                  for (let i = 0; i < points.length; i++) {
                      const current = points[i];
                      const next = points[(i + 1) % points.length];
                      const midX = (current.x + next.x) * 0.5;
                      const midY = (current.y + next.y) * 0.5;
                      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
                  }
              };

              // Passe 1 : halo radial externe.
              const haloGradient = ctx.createRadialGradient(
                  0, 0, ARENA_RADIUS - haloInner,
                  0, 0, ARENA_RADIUS + haloOuter
              );
              haloGradient.addColorStop(0, 'rgba(126, 244, 255, 0)');
              haloGradient.addColorStop(0.66, `rgba(126, 244, 255, ${haloAlpha * 0.55})`);
              haloGradient.addColorStop(0.86, `rgba(138, 229, 255, ${haloAlpha})`);
              haloGradient.addColorStop(1, 'rgba(138, 229, 255, 0)');
              ctx.fillStyle = haloGradient;
              ctx.beginPath();
              traceArenaPath(haloOuter);
              traceArenaPath(-haloInner, true);
              ctx.fill();

              // Passe 2 : trait principal lumineux et épais.
              const mainAlpha = (0.2 + breath * 0.14) * silenceMultiplier;
              ctx.strokeStyle = `rgba(205, 248, 255, ${mainAlpha})`;
              ctx.lineWidth = mainStrokeWorld;
              ctx.shadowBlur = (12 + breath * 10) * silenceMultiplier;
              ctx.shadowColor = `rgba(118, 231, 255, ${0.34 * silenceMultiplier})`;
              ctx.beginPath();
              traceArenaPath(0);
              ctx.stroke();

              // Passe 3 : liseré interne pour l'effet bulle.
              ctx.shadowBlur = 0;
              const innerAlpha = (0.3 + breath * 0.16) * (0.82 + silenceMultiplier * 0.35);
              ctx.strokeStyle = `rgba(241, 254, 255, ${innerAlpha})`;
              ctx.lineWidth = Math.max(0.8 / zoomSafe, innerRimWorld);
              ctx.beginPath();
              traceArenaPath(-mainStrokeWorld * 0.55);
              ctx.stroke();
          }

          function draw() {
              ctx.fillStyle = '#030308';
              ctx.fillRect(0, 0, w, h);
              if (currentView !== 'experience') return;
              const now = performance.now();
              const echoRemaining = Math.max(0, echoDelayEffectUntil - now);
              if (echoRemaining > 0) {
                  const total = Math.max(1, echoDelayEffectUntil - echoDelayEffectStartedAt);
                  const progress = 1 - (echoRemaining / total);
                  const wavePulse = (Math.sin(now * 0.014) + 1) * 0.5;
                  const blurPx = 2.8 + (1 - progress) * 5.6 + wavePulse * 1.3;
                  canvas.style.filter = `blur(${blurPx.toFixed(2)}px) saturate(1.16)`;
              } else if (canvas.style.filter) {
                  canvas.style.filter = '';
              }
              const silenceVisualMode = silenceTransitionInProgress || recordingState === 'recording' || silenceImmersionLevel > 0.02;
              const silenceGlow = silenceVisualMode ? Math.max(0.22, silenceImmersionLevel) : 0;
              const heavySilenceMode = silenceVisualMode && silenceImmersionLevel >= 0.66;

              ctx.save();
              ctx.translate(w / 2, h / 2);
              ctx.scale(camera.zoom, camera.zoom);
              ctx.translate(-camera.x, -camera.y);

              drawArenaBoundary(silenceVisualMode, silenceGlow);

              const drawBubble = (b) => {
                  const isSurface = b.layer !== 'below';
                  const opacityBoost = b.isActive ? 1.2 : 1;
                  const bHue = b.hue ?? 195;
                  const deformAmount = Math.min(0.38, b.deformAmount || 0);
                  const deformAngle = b.deformAngle || 0;
                  const ellipseRx = b.r * (1 - deformAmount * 0.2);
                  const ellipseRy = b.r * (1 + deformAmount * 0.17);
                  const drawBubbleShape = (radiusOffset = 0) => {
                      const radius = b.r + radiusOffset;
                      if (deformAmount > 0.01) {
                          const scale = Math.max(0.2, radius / b.r);
                          ctx.ellipse(
                              b.x,
                              b.y,
                              Math.max(3, ellipseRx * scale),
                              Math.max(3, ellipseRy * scale),
                              deformAngle,
                              0,
                              Math.PI * 2
                          );
                          return;
                      }
                      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
                  };
                  ctx.save();
                  const trail = Array.isArray(b.motionTrail) ? b.motionTrail : [];
                  for (let i = 0; i < trail.length; i++) {
                      const point = trail[i];
                      const fade = point.alpha * (i + 1) / Math.max(1, trail.length);
                      const trailGradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.radius);
                      trailGradient.addColorStop(0, `hsla(${bHue}, 88%, 82%, ${fade * 0.18})`);
                      trailGradient.addColorStop(1, `hsla(${bHue + 14}, 88%, 55%, 0)`);
                      ctx.fillStyle = trailGradient;
                      ctx.beginPath();
                      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
                      ctx.fill();
                  }

                  const nowTime = performance.now() * 0.001;
                  const haloPulse = (Math.sin(nowTime * 2.8 + b.x * 0.01 + b.y * 0.012) + 1) * 0.5;
                  const haloStyleId = b.haloStyle || HALO_STYLE_LIBRARY[0].id;
                  if (haloStyleId === 'aurora') {
                      const haloRadius = b.r * (1.28 + haloPulse * 0.16);
                      const haloGrad = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, haloRadius);
                      haloGrad.addColorStop(0, `hsla(${bHue + 8}, 88%, 76%, ${0.08 + haloPulse * 0.07})`);
                      haloGrad.addColorStop(0.58, `hsla(${bHue + 24}, 85%, 62%, ${0.15 + haloPulse * 0.1})`);
                      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                      ctx.fillStyle = haloGrad;
                      ctx.beginPath();
                      ctx.arc(b.x, b.y, haloRadius, 0, Math.PI * 2);
                      ctx.fill();
                  } else if (haloStyleId === 'stardust') {
                      const orbitRadius = b.r + 10 + haloPulse * 6;
                      for (let i = 0; i < 5; i++) {
                          const angle = nowTime * (0.7 + i * 0.11) + (Math.PI * 2 * i) / 5;
                          const sx = b.x + Math.cos(angle) * orbitRadius;
                          const sy = b.y + Math.sin(angle) * orbitRadius * 0.88;
                          const sparkleSize = 1.4 + ((i % 2) * 0.5) + haloPulse * 0.5;
                          ctx.fillStyle = `hsla(${bHue + 32}, 96%, 84%, ${0.25 + haloPulse * 0.2})`;
                          ctx.beginPath();
                          ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
                          ctx.fill();
                      }
                  } else if (haloStyleId === 'pulse') {
                      for (let ring = 0; ring < 3; ring++) {
                          const ringPhase = (nowTime * (0.42 + ring * 0.08) + ring * 0.34) % 1;
                          const ringRadius = b.r + 8 + ring * 7 + ringPhase * 12;
                          const ringAlpha = (1 - ringPhase) * (0.2 - ring * 0.04);
                          ctx.strokeStyle = `hsla(${bHue - 10}, 92%, 78%, ${Math.max(0, ringAlpha)})`;
                          ctx.lineWidth = 1.1;
                          ctx.beginPath();
                          ctx.arc(b.x, b.y, ringRadius, 0, Math.PI * 2);
                          ctx.stroke();
                      }
                  }

                  if (!isSurface) {
                      const grad = ctx.createRadialGradient(b.x, b.y, b.r * 0.05, b.x, b.y, b.r);
                      grad.addColorStop(0, `hsla(${bHue}, 70%, 70%, ${0.02 * opacityBoost})`);
                      grad.addColorStop(0.72, `hsla(${bHue}, 72%, 58%, ${0.11 * opacityBoost})`);
                      grad.addColorStop(1, `hsla(${bHue + 15}, 68%, 40%, ${0.22 * opacityBoost})`);
                      ctx.filter = 'blur(7px)';
                      ctx.fillStyle = grad;
                      ctx.beginPath();
                      drawBubbleShape();
                      ctx.fill();
                      ctx.filter = 'none';
                      ctx.strokeStyle = `hsla(${bHue}, 75%, 72%, ${0.20 * opacityBoost})`;
                      ctx.lineWidth = 1.4;
                  } else {
                      const grad = ctx.createRadialGradient(b.x - b.r * 0.25, b.y - b.r * 0.28, b.r * 0.15, b.x, b.y, b.r);
                      grad.addColorStop(0, `hsla(${bHue}, 80%, 90%, ${0.52 * opacityBoost})`);
                      grad.addColorStop(0.65, `hsla(${bHue}, 78%, 68%, ${0.36 * opacityBoost})`);
                      grad.addColorStop(1, `hsla(${bHue + 15}, 72%, 46%, ${0.60 * opacityBoost})`);
                      ctx.fillStyle = grad;
                      ctx.beginPath();
                      drawBubbleShape();
                      ctx.fill();
                      ctx.strokeStyle = `hsla(${bHue}, 88%, 84%, ${0.66 * opacityBoost})`;
                      ctx.lineWidth = b.isActive ? 2.8 : 2.1;
                  }

                  ctx.beginPath();
                  drawBubbleShape();
                  ctx.stroke();

                  // Selection ring
                  if (b === selectedBubble) {
                      const pulse = (Math.sin(performance.now() * 0.004) + 1) * 0.5;
                      ctx.strokeStyle = `hsla(${bHue}, 90%, 88%, ${0.45 + pulse * 0.35})`;
                      ctx.lineWidth = 1.8;
                      ctx.setLineDash([7, 5]);
                      ctx.lineDashOffset = performance.now() * 0.04;
                      ctx.beginPath();
                      drawBubbleShape(10 + pulse * 3);
                      ctx.stroke();
                      ctx.setLineDash([]);
                      ctx.lineDashOffset = 0;
                  }

                  if (b.label) {
                      const maxWidth = b.r * 1.42;
                      const fontSize = Math.max(11, Math.min(15, b.r * 0.25));
                      ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillStyle = isSurface ? 'rgba(235, 248, 255, 0.95)' : 'rgba(220, 237, 255, 0.82)';
                      let text = b.label;
                      while (ctx.measureText(text).width > maxWidth && text.length > 6) text = `${text.slice(0, -2)}…`;
                      ctx.fillText(text, b.x, b.y, maxWidth);
                  }

                  ctx.restore();
              };

              if (!heavySilenceMode) {
                  BUBBLES.filter((b) => b.layer === 'below').forEach(drawBubble);
                  drawBreathWaves();
                  drawDriftMotes();
                  drawMarineParticles();
                  drawArenaFireflies();
                  drawSurfaceSparkles();
                  drawResonanceWaves();
                  drawStarfishResonanceWaves();
                  drawWakeParticles();
                  drawRipples();
                  drawTraceRailPath();
                  drawLuminousTrail();
              }
              drawCompanionStarfish(performance.now() * 0.001, audioReactiveState.energy);
              getVisibleGuestFish().forEach((fish) => drawGuestFish(ctx, fish));

              const nearestBubbleData = getNearestBubbleForShip();
              const bubbleProximity = nearestBubbleData ? nearestBubbleData.distanceRatio : 0;
              const bubbleAudioInfluence = nearestBubbleData ? nearestBubbleData.audioReactive : 0;
              const distanceFalloff = Math.pow(Math.max(0, bubbleProximity), 1.35);
              const localAudioGate = Math.max(0, (bubbleAudioInfluence - 0.05) / 0.95);
              const wingTarget = distanceFalloff * localAudioGate;
              audioReactiveState.wingPresence += (wingTarget - audioReactiveState.wingPresence) * 0.16;
              const wingPresence = Math.max(0, Math.min(1, audioReactiveState.wingPresence));

              ctx.save();
              ctx.translate(ship.x, ship.y);
              ctx.rotate(ship.angle + Math.PI / 2);
              const swimT = performance.now() * 0.001;
              const reactiveBass = audioReactiveState.bass;
              const reactiveMids = audioReactiveState.mids;
              const reactiveHighs = audioReactiveState.highs;
              const reactiveEnergy = audioReactiveState.energy;
              const fishDepthVisuals = {
                  1: { brightness: 1, saturation: 1, blur: 0 },
                  2: { brightness: 0.8, saturation: 0.75, blur: 0.9 },
                  3: { brightness: 0.62, saturation: 0.5, blur: 1.8 },
              };
              const fishDepthVisual = fishDepthVisuals[getFishDepthIndex()] || fishDepthVisuals[1];
              ctx.filter = `saturate(${fishDepthVisual.saturation}) brightness(${fishDepthVisual.brightness}) blur(${fishDepthVisual.blur}px)`;
              const glide = Math.min(1, (Math.hypot(ship.vx, ship.vy) / ship.maxSpeed) + reactiveBass * AUDIO_REACTIVITY.fishVelocityBoost);
              const wag = Math.sin(swimT * 9.5) * (0.16 + glide * 0.22);
              const finMorph = Math.min(1, wingPresence * (0.72 + reactiveMids * 0.28));
              const finFlap = Math.sin(swimT * (7.2 + reactiveMids * 1.8 + bubbleAudioInfluence * 2.1 * wingPresence) + 0.5) * (0.14 + glide * 0.10 + reactiveMids * AUDIO_REACTIVITY.fishFinBoost * 0.1 + finMorph * 0.24);
              const bodyBreath = Math.sin(swimT * 2.5) * 0.65;
              const shimmerPulse = Math.min(1.2, (Math.sin(swimT * (2.2 + reactiveHighs * 0.8 + bubbleAudioInfluence * 0.9 * wingPresence)) + 1) * 0.5 + reactiveHighs * 0.42);
              const bodyUndulate = Math.sin(swimT * 5.8) * (0.03 + glide * 0.055);
              const bodyHueTop = 186 + Math.sin(swimT * 1.7) * 8;
              const bodyHueMid = 198 + Math.sin(swimT * 1.3 + 1.4) * 12;
              const bodyHueLow = 210 + Math.sin(swimT * 1.9 + 2.1) * 10;

              // --- AURA GLOW (reduced + closer to fish contour) ---
              const sonarPulse = 0.08;
              const auraR = 22 + shimmerPulse * 4.2 + reactiveBass * 4.5;
              const auraGrad = ctx.createRadialGradient(0, 2, 0, 0, 2, auraR);
              auraGrad.addColorStop(0, `hsla(${bodyHueMid}, 88%, 80%, ${0.12 + shimmerPulse * 0.08 + reactiveEnergy * AUDIO_REACTIVITY.fishGlowBoost * 0.22})`);
              auraGrad.addColorStop(0.6, `hsla(${bodyHueLow}, 84%, 72%, ${0.05 + shimmerPulse * 0.05})`);
              auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = auraGrad;
              ctx.beginPath();
              ctx.ellipse(0, 2, auraR * 0.95, auraR * 1.1, 0, 0, Math.PI * 2);
              ctx.fill();

              // --- BODY ---
              ctx.shadowBlur = 22;
              ctx.shadowColor = `hsla(${bodyHueMid}, 95%, 85%, 0.58)`;
              const bu = bodyUndulate;
              const bodyGrad = ctx.createLinearGradient(-10, -18, 10, 24);
              bodyGrad.addColorStop(0,    `hsla(${bodyHueTop}, 90%, 95%, ${0.88 + shimmerPulse * 0.12})`);
              bodyGrad.addColorStop(0.38, `hsla(${bodyHueMid}, 85%, 80%, ${0.78 + shimmerPulse * 0.12})`);
              bodyGrad.addColorStop(0.72, `hsla(${bodyHueLow}, 80%, 68%, ${0.76 + shimmerPulse * 0.14})`);
              bodyGrad.addColorStop(1,    `hsla(${bodyHueLow + 14}, 75%, 58%, 0.80)`);
              ctx.fillStyle = bodyGrad;
              traceFishBodyPath(ctx, bu, bodyBreath);
              ctx.fill();

              // --- IRIDESCENT SHEEN ---
              const sheenGrad = ctx.createLinearGradient(-10, -18, 8, 4);
              sheenGrad.addColorStop(0, `rgba(255, 255, 255, ${0.26 + shimmerPulse * 0.22})`);
              sheenGrad.addColorStop(0.45, `rgba(200, 245, 255, ${0.10 + shimmerPulse * 0.10})`);
              sheenGrad.addColorStop(1, 'rgba(180, 220, 255, 0)');
              ctx.fillStyle = sheenGrad;
              traceFishBodyPath(ctx, bu, bodyBreath);
              ctx.fill();

              // --- CONTOUR HALO + SONAR PEAK ---
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              ctx.shadowBlur = 10 + sonarPulse * 12;
              ctx.shadowColor = `hsla(${bodyHueMid + 4}, 94%, 78%, ${0.28 + sonarPulse * 0.42})`;
              ctx.strokeStyle = `hsla(${bodyHueMid + 6}, 92%, 84%, ${0.28 + sonarPulse * 0.42})`;
              ctx.lineWidth = 1.1 + sonarPulse * 1.2;
              traceFishBodyPath(ctx, bu, bodyBreath);
              ctx.stroke();

              ctx.restore();

              // --- PECTORAL FINS / AUDIO WINGS ---
              if (wingPresence < 0.08) {
                  drawClassicFishFins(finFlap, bodyHueMid);
              } else {
                  const wingSpan = 12 + finMorph * 22;
                  const wingLength = 15 + finMorph * 30;
                  const wingDrift = Math.sin(swimT * (4.4 + bubbleAudioInfluence * 2.2)) * (0.8 + finMorph * 1.4);
                  const wingAlpha = 0.35 + wingPresence * 0.65;
                  ctx.shadowBlur = 8 + finMorph * 10;
                  ctx.save();
                  ctx.globalCompositeOperation = 'screen';
                  ctx.translate(-7, 2);
                  ctx.rotate(-0.38 + finFlap - wingDrift * 0.03);
                  const finGradL = ctx.createLinearGradient(0, -2, -wingSpan, wingLength);
                  finGradL.addColorStop(0, `hsla(${196 + bubbleAudioInfluence * 10}, 92%, 80%, ${(0.66 + finMorph * 0.16) * wingAlpha})`);
                  finGradL.addColorStop(0.52, `hsla(${216 + bubbleAudioInfluence * 8}, 94%, 68%, ${(0.55 + finMorph * 0.2) * wingAlpha})`);
                  finGradL.addColorStop(1, `hsla(${328 + finMorph * 12}, 96%, 72%, 0)`);
                  ctx.fillStyle = finGradL;
                  ctx.shadowColor = `hsla(${206 + finMorph * 16}, 96%, 76%, ${(0.35 + finMorph * 0.45) * wingAlpha})`;
                  ctx.beginPath();
                  ctx.moveTo(0, -1);
                  ctx.bezierCurveTo(-wingSpan * 0.56, -1.5 - finMorph * 1.2, -wingSpan * 1.18, wingLength * 0.52, -wingSpan * 0.58, wingLength);
                  ctx.bezierCurveTo(-wingSpan * 0.25, wingLength * 0.66, -2, 5 + finMorph * 2.8, 0, -1);
                  ctx.fill();
                  ctx.restore();

                  ctx.save();
                  ctx.globalCompositeOperation = 'screen';
                  ctx.translate(7, 2);
                  ctx.rotate(0.38 - finFlap + wingDrift * 0.03);
                  const finGradR = ctx.createLinearGradient(0, -2, wingSpan, wingLength);
                  finGradR.addColorStop(0, `hsla(${196 + bubbleAudioInfluence * 10}, 92%, 80%, ${(0.66 + finMorph * 0.16) * wingAlpha})`);
                  finGradR.addColorStop(0.52, `hsla(${216 + bubbleAudioInfluence * 8}, 94%, 68%, ${(0.55 + finMorph * 0.2) * wingAlpha})`);
                  finGradR.addColorStop(1, `hsla(${328 + finMorph * 12}, 96%, 72%, 0)`);
                  ctx.fillStyle = finGradR;
                  ctx.shadowColor = `hsla(${206 + finMorph * 16}, 96%, 76%, ${(0.35 + finMorph * 0.45) * wingAlpha})`;
                  ctx.beginPath();
                  ctx.moveTo(0, -1);
                  ctx.bezierCurveTo(wingSpan * 0.56, -1.5 - finMorph * 1.2, wingSpan * 1.18, wingLength * 0.52, wingSpan * 0.58, wingLength);
                  ctx.bezierCurveTo(wingSpan * 0.25, wingLength * 0.66, 2, 5 + finMorph * 2.8, 0, -1);
                  ctx.fill();
                  ctx.restore();

              }

              // --- TAIL with feathered tips ---
              ctx.save();
              ctx.translate(0, 20);
              ctx.rotate(wag);
              ctx.shadowBlur = 10;
              ctx.shadowColor = `hsla(${bodyHueLow}, 85%, 80%, 0.45)`;
              const tailGrad = ctx.createLinearGradient(0, 0, 0, 26);
              tailGrad.addColorStop(0, `hsla(${bodyHueMid}, 84%, 80%, 0.92)`);
              tailGrad.addColorStop(1, `hsla(${bodyHueLow + 10}, 80%, 74%, 0)`);
              ctx.fillStyle = tailGrad;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.bezierCurveTo(-7, 5, -9, 14, -3.5, 22);
              ctx.quadraticCurveTo(0, 18, 3.5, 22);
              ctx.bezierCurveTo(9, 14, 7, 5, 0, 0);
              ctx.fill();
              // Left feather tip
              const tipGrad = ctx.createLinearGradient(0, 18, -6, 36);
              tipGrad.addColorStop(0, `hsla(${bodyHueTop}, 90%, 90%, 0.65)`);
              tipGrad.addColorStop(1, `hsla(${bodyHueTop + 8}, 88%, 94%, 0)`);
              ctx.fillStyle = tipGrad;
              ctx.beginPath();
              ctx.moveTo(-1.5, 18);
              ctx.bezierCurveTo(-5, 23, -8, 31, -4.5, 36);
              ctx.quadraticCurveTo(-2, 30, -1.5, 18);
              ctx.fill();
              // Right feather tip
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

              ctx.shadowBlur = 0;

              // --- BIOLUMINESCENT SPOTS ---
              const spotT = swimT * 3.2;
              [
                  { x: -4.5, y: -1, r: 1.1, ph: 0.0 },
                  { x:  4.2, y:  1, r: 0.9, ph: 1.4 },
                  { x: -2.0, y:  7, r: 0.85, ph: 2.6 },
                  { x:  3.0, y: -6, r: 0.75, ph: 3.8 },
                  { x:  0.5, y:  3, r: 0.6,  ph: 0.7 },
              ].forEach((s) => {
                  const sp = (Math.sin(spotT + s.ph) + 1) * 0.5;
                  ctx.fillStyle = `rgba(175, 255, 235, ${0.10 + sp * 0.20})`;
                  ctx.shadowBlur = 7;
                  ctx.shadowColor = 'rgba(160, 255, 230, 0.55)';
                  ctx.beginPath();
                  ctx.arc(s.x, s.y, s.r * (1 + sp * 0.35), 0, Math.PI * 2);
                  ctx.fill();
              });

              // --- EYES ---
              // Eye halo
              ctx.fillStyle = `rgba(160, 232, 255, ${0.30 + shimmerPulse * 0.20})`;
              ctx.beginPath();
              ctx.arc(-6.2, -12, 3.0, 0, Math.PI * 2);
              ctx.arc(6.2, -12, 3.0, 0, Math.PI * 2);
              ctx.fill();
              // Iris
              ctx.fillStyle = '#062436';
              ctx.beginPath();
              ctx.arc(-6.2, -12, 1.45, 0, Math.PI * 2);
              ctx.arc(6.2, -12, 1.45, 0, Math.PI * 2);
              ctx.fill();
              // Specular
              ctx.fillStyle = `rgba(255, 255, 255, ${0.75 + shimmerPulse * 0.25})`;
              ctx.beginPath();
              ctx.arc(-5.6, -12.6, 0.52, 0, Math.PI * 2);
              ctx.arc(6.8, -12.6, 0.52, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();

              if (fishDepthToastUntil > performance.now()) {
                  const toastFade = Math.min(1, Math.max(0, (fishDepthToastUntil - performance.now()) / 260));
                  const bubbleY = ship.y - 54;
                  const bubbleWidth = 122;
                  const bubbleHeight = 30;
                  ctx.save();
                  ctx.fillStyle = `rgba(8, 20, 38, ${0.62 * toastFade})`;
                  ctx.strokeStyle = `rgba(184, 232, 255, ${0.78 * toastFade})`;
                  ctx.lineWidth = 1.2;
                  ctx.fillRect(ship.x - bubbleWidth / 2, bubbleY - bubbleHeight / 2, bubbleWidth, bubbleHeight);
                  ctx.strokeRect(ship.x - bubbleWidth / 2, bubbleY - bubbleHeight / 2, bubbleWidth, bubbleHeight);
                  ctx.fillStyle = `rgba(231, 247, 255, ${0.95 * toastFade})`;
                  ctx.font = '600 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(fishDepthToastText, ship.x, bubbleY + 0.5);
                  ctx.restore();
              }

              if (silenceVisualMode) drawSilenceCompassRing();

              if (!heavySilenceMode) {
                  BUBBLES.filter((b) => b.layer !== 'below').forEach(drawBubble);
              }
              ctx.restore();
              if (!heavySilenceMode) {
                  drawWaterSurface();
                  drawArenaResonanceVeil();
              } else {
                  const halo = ctx.createRadialGradient(w * 0.5, h * 0.52, 16, w * 0.5, h * 0.52, Math.max(w, h) * 0.42);
                  halo.addColorStop(0, `rgba(146, 244, 255, ${0.22 + silenceGlow * 0.25})`);
                  halo.addColorStop(0.58, `rgba(112, 204, 255, ${0.04 + silenceGlow * 0.12})`);
                  halo.addColorStop(1, 'rgba(0, 0, 0, 0.86)');
                  ctx.fillStyle = halo;
                  ctx.fillRect(0, 0, w, h);
              }
          }

          function drawWakeParticles() {
              WAKE_PARTICLES.forEach((p) => {
                  const t = p.age / p.life;
                  const alpha = Math.max(0, 1 - t) * p.alpha;
                  const hue = 188 + (1 - t) * 24;
                  ctx.fillStyle = `hsla(${hue}, 95%, 86%, ${alpha})`;
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = `hsla(${hue + 10}, 95%, 98%, ${alpha * 0.55})`;
                  ctx.lineWidth = 0.7;
                  ctx.beginPath();
                  ctx.arc(p.x - p.size * 0.2, p.y - p.size * 0.2, Math.max(0.35, p.size * 0.48), 0, Math.PI * 2);
                  ctx.stroke();
              });
          }
          function drawRipples() {
              RIPPLE_RINGS.forEach((ripple) => {
                  const thickness = 1 + (1 - ripple.alpha) * 2.6;
                  const hue = 192 + Math.sin((ripple.age / ripple.life) * Math.PI * 2) * 12;
                  ctx.strokeStyle = `hsla(${hue}, 90%, 72%, ${ripple.alpha})`;
                  ctx.lineWidth = thickness;
                  ctx.beginPath();
                  ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
                  ctx.stroke();
              });
          }
          function drawSurfaceSparkles() {
              const t = performance.now() * 0.002;
              SURFACE_SPARKLES.forEach((sparkle) => {
                  const lifeT = sparkle.age / sparkle.life;
                  const twinkle = (Math.sin(t * 6 + sparkle.phase) + 1) * 0.5;
                  const alpha = (0.08 + twinkle * 0.42) * (1 - Math.abs(lifeT - 0.5) * 1.5);
                  if (alpha <= 0) return;

                  const offsetX = Math.sin(t + sparkle.phase) * 5;
                  const offsetY = Math.cos(t * 0.6 + sparkle.phase) * 3;
                  const x = sparkle.x + offsetX;
                  const y = sparkle.y + offsetY;

                  ctx.fillStyle = `hsla(${sparkle.hueShift}, 95%, 82%, ${alpha})`;
                  ctx.beginPath();
                  ctx.arc(x, y, sparkle.size, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.strokeStyle = `hsla(${sparkle.hueShift + 8}, 100%, 88%, ${alpha * 0.7})`;
                  ctx.lineWidth = 0.7;
                  ctx.beginPath();
                  ctx.moveTo(x - sparkle.size * 1.8, y);
                  ctx.lineTo(x + sparkle.size * 1.8, y);
                  ctx.moveTo(x, y - sparkle.size * 1.8);
                  ctx.lineTo(x, y + sparkle.size * 1.8);
                  ctx.stroke();
              });
          }

          function drawResonanceWaves() {
              RESONANCE_WAVES.forEach((wave) => {
                  const width = 1.2 + (1 - wave.alpha) * 2.1;
                  const pulse = 0.5 + Math.sin((performance.now() - wave.bornAt) * 0.003) * 0.5;
                  ctx.strokeStyle = `hsla(${wave.hue}, 88%, 76%, ${wave.alpha * (0.7 + pulse * 0.3)})`;
                  ctx.lineWidth = width;
                  ctx.beginPath();
                  ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
                  ctx.stroke();
              });
          }

          function drawResotagLinks() {
              return;
          }

          function drawResotags() {
              return;
          }

          function drawWaterSurface() {
              const horizonY = Math.max(30, h * 0.17);
              const audioGlow = Math.min(0.22, audioReactiveState.energy * AUDIO_REACTIVITY.backgroundGlowBoost);
              const gradient = ctx.createLinearGradient(0, 0, 0, horizonY + 120);
              gradient.addColorStop(0, `rgba(32, 100, 155, ${0.28 + audioGlow})`);
              gradient.addColorStop(0.7, `rgba(20, 70, 130, ${0.14 + audioGlow * 0.7})`);
              gradient.addColorStop(1, 'rgba(6, 22, 40, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, w, horizonY + 120);

              if (audioGlow > 0.01) {
                  const bloom = ctx.createRadialGradient(w * 0.52, h * 0.36, h * 0.08, w * 0.5, h * 0.45, h * 0.8);
                  bloom.addColorStop(0, `rgba(120, 230, 255, ${audioGlow * 0.9})`);
                  bloom.addColorStop(0.55, `rgba(86, 152, 246, ${audioGlow * 0.38})`);
                  bloom.addColorStop(1, 'rgba(10, 24, 42, 0)');
                  ctx.fillStyle = bloom;
                  ctx.fillRect(0, 0, w, h);
              }
          }

          function drawArenaResonanceVeil() {
              if (arenaResonance.level <= 0.01) return;
              const intensity = Math.min(0.22, arenaResonance.level * 0.24);
              const g = ctx.createRadialGradient(w * 0.5, h * 0.46, h * 0.14, w * 0.5, h * 0.46, h * 0.74);
              g.addColorStop(0, `hsla(${arenaResonance.hue}, 95%, 74%, ${intensity})`);
              g.addColorStop(1, `hsla(${arenaResonance.hue + 18}, 80%, 30%, 0)`);
              ctx.fillStyle = g;
              ctx.fillRect(0, 0, w, h);
          }

          function loop() {
              update();
              draw();
              requestAnimationFrame(loop);
          }

          showView(isInviteGuestMode ? 'experience' : 'home');
          setBottomNavCollapsed(false);
          loop();

}
