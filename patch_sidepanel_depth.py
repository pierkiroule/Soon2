from pathlib import Path

p = Path("src/components/SidePanel.jsx")
s = p.read_text()

if "  selectedFish," not in s:
    s = s.replace(
        "  selectedBubble,\n",
        "  selectedBubble,\n  selectedFish,\n"
    )

if "  onUpdateFishDepth," not in s:
    s = s.replace(
        "  onUpdateBubble,\n",
        "  onUpdateBubble,\n  onUpdateFishDepth,\n"
    )

insert = """
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
"""

if "Poisson-plume sélectionné" not in s:
    s = s.replace(
        '          {mode === "compo" && selectedBubble && (',
        insert + '\n          {mode === "compo" && selectedBubble && ('
    )

p.write_text(s)
print("OK: SidePanel profondeur poisson")
