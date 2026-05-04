import { useState } from "react";
import { SOON_MODES } from "../core/soonModes.js";
import BubbleEditor from "./BubbleEditor.jsx";

export default function SidePanel({
  mode,
  selectedBubble,
  selectedFish,
  selectedBeacon,
  circuitAutopilot,
  onUpdateBeacon,
  onStartCircuitAutopilot,
  onStopCircuitAutopilot,
  onAutoGenerateTraceCircuit,
  onUpdateBubble,
  onUpdateFishDepth,
  onDeleteBubble,
}) {
  const [open, setOpen] = useState(false);
  const currentMode = SOON_MODES.find((item) => item.id === mode);

  if (mode === "intro") return null;

  return (
    <>
      <button
        className={open ? "mode-pill active" : "mode-pill side-toggle"}
        onClick={() => setOpen((value) => !value)}
        aria-label="Ouvrir les réglages"
      >
        <span>{currentMode?.icon}</span>
      </button>

      {selectedBubble && !open && mode === "compo" && (
        <button className="bubble-pill" onClick={() => setOpen(true)}>
          🫧 {selectedBubble.label}
        </button>
      )}

      {selectedBeacon && !open && mode === "reso" && (
        <button className="bubble-pill" onClick={() => setOpen(true)}>
          ⟡ Balise P{selectedBeacon.depth} · V{selectedBeacon.speed}
        </button>
      )}

      {open && (
        <aside className="side-panel compact">
          <header className="panel-mini-header">
            <div>
              <p className="kicker">{currentMode?.label}</p>
              <h2>{currentMode?.text}</h2>
            </div>

            <button className="panel-close-btn" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>


          {selectedFish && (
            <section className="help-card compact-help">
              <p>Poisson-plume sélectionné</p>

              <label>
                Profondeur
                <select
                  value={selectedFish.depth || 1}
                  onChange={(event) =>
                    onUpdateFishDepth(Number(event.target.value))
                  }
                >
                  <option value={1}>1 · surface</option>
                  <option value={2}>2 · milieu</option>
                  <option value={3}>3 · profondeur</option>
                </select>
              </label>
            </section>
          )}

          {mode === "compo" && selectedBubble && (
            <BubbleEditor
              bubble={selectedBubble}
              onUpdate={onUpdateBubble}
              onDelete={onDeleteBubble}
            />
          )}

          {mode === "compo" && !selectedBubble && (
            <section className="help-card compact-help">
              <p>
                Double-tape dans l’arène pour créer une bulle sonore.
                Sélectionne une bulle pour la régler. Le poisson-plume peut
                récolter les lucioles avec sa traîne.
              </p>
            </section>
          )}

          {mode === "reso" && (
            <>
              <section className="help-card compact-help">
                <p>
                  Trace un circuit de résonance. Déplace les balises, règle leur
                  profondeur, leur vitesse, puis lance le voyage.
                </p>

                {selectedBeacon && (
                  <div className="beacon-editor">
                    <label>
                      Profondeur
                      <select
                        value={selectedBeacon.depth}
                        onChange={(event) =>
                          onUpdateBeacon({ depth: Number(event.target.value) })
                        }
                      >
                        <option value={1}>1 · surface</option>
                        <option value={2}>2 · milieu</option>
                        <option value={3}>3 · profondeur</option>
                      </select>
                    </label>

                    <label>
                      Vitesse de passage
                      <select
                        value={selectedBeacon.speed}
                        onChange={(event) =>
                          onUpdateBeacon({ speed: Number(event.target.value) })
                        }
                      >
                        <option value={1}>1 · lente</option>
                        <option value={2}>2 · fluide</option>
                        <option value={3}>3 · vive</option>
                      </select>
                    </label>
                  </div>
                )}

                <div className="panel-row">
                  <button
                    className="secondary-btn play-btn"
                    type="button"
                    onClick={onAutoGenerateTraceCircuit}
                  >
                    ✦ Auto
                  </button>
                  {!circuitAutopilot && (
                    <button
                      className="secondary-btn play-btn"
                      onClick={onStartCircuitAutopilot}
                    >
                      ▶ Lancer
                    </button>
                  )}

                  {circuitAutopilot && (
                    <button
                      className="danger-btn play-btn"
                      onClick={onStopCircuitAutopilot}
                    >
                      ⏸ Pause
                    </button>
                  )}
                </div>
              </section>

              <section className="help-card compact-help">
                <p>
                  
                  
                </p>
              </section>
            </>
          )}
        </aside>
      )}
    </>
  );
}
