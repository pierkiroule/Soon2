from pathlib import Path
import re

p = Path("src/components/SidePanel.jsx")
s = p.read_text()

# useEffect pour ouvrir automatiquement au double tap / sélection
s = s.replace(
  'import { useState } from "react";',
  'import { useEffect, useState } from "react";'
)

if "useEffect(() => {" not in s:
    s = s.replace(
'''  const [open, setOpen] = useState(false);
  const currentMode = SOON_MODES.find((item) => item.id === mode);''',
'''  const [open, setOpen] = useState(false);
  const currentMode = SOON_MODES.find((item) => item.id === mode);

  useEffect(() => {
    if (selectedBubble || selectedFish) {
      setOpen(true);
    }
  }, [selectedBubble?.id, selectedFish]);'''
    )

# Remplace le bloc poisson par slider
s = re.sub(
r'''\{selectedFish && \(
\s*<section className="help-card compact-help">
\s*<p>Poisson-plume sélectionné</p>
\s*
\s*<label>
\s*Profondeur
\s*<select[\s\S]*?</select>
\s*</label>
\s*</section>
\s*\)\}''',
'''{selectedFish && (
            <section className="help-card compact-help depth-editor">
              <p>Poisson-plume sélectionné</p>

              <label>
                Profondeur · P{selectedFish.depth || 1}
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={selectedFish.depth || 1}
                  onChange={(event) =>
                    onUpdateFishDepth(Number(event.target.value))
                  }
                />
              </label>
            </section>
          )}''',
s
)

# Ajoute slider bulle si bulle sélectionnée, avant BubbleEditor
if "Profondeur de la bulle" not in s:
    s = s.replace(
'''          {mode === "compo" && selectedBubble && (
            <BubbleEditor''',
'''          {mode === "compo" && selectedBubble && (
            <section className="help-card compact-help depth-editor">
              <p>Profondeur de la bulle</p>

              <label>
                Profondeur · P{selectedBubble.depth || 1}
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={selectedBubble.depth || 1}
                  onChange={(event) =>
                    onUpdateBubble({ depth: Number(event.target.value) })
                  }
                />
              </label>
            </section>
          )}

          {mode === "compo" && selectedBubble && (
            <BubbleEditor'''
    )

p.write_text(s)
print("OK: sliders profondeur dans SidePanel")
