from pathlib import Path

p = Path("src/pages/SoonApp.jsx")
s = p.read_text()

if "    selectedFish," not in s:
    s = s.replace(
        "    selectedBubbleId,\n",
        "    selectedBubbleId,\n    selectedFish,\n"
    )

if "    selectFish," not in s:
    s = s.replace(
        "    tickFish,\n",
        "    tickFish,\n    selectBubble,\n    selectFish,\n    updateFishDepth,\n    updateBubble,\n"
    )

# Évite doublons si selectBubble/updateBubble étaient déjà ailleurs
lines = []
seen = set()
for line in s.splitlines():
    key = line.strip()
    if key in {"selectBubble,", "updateBubble,"}:
        if key in seen:
            continue
        seen.add(key)
    lines.append(line)
s = "\n".join(lines)

# Props Canvas
if "onSelectFish={selectFish}" not in s:
    s = s.replace(
        "        selectedBubbleId={selectedBubbleId}\n",
        "        selectedBubbleId={selectedBubbleId}\n        onSelectBubble={selectBubble}\n        onSelectFish={selectFish}\n"
    )

# Calcul sélection bulle si absent
if "const selectedBubble =" not in s:
    s = s.replace(
        "  } = useSoonStore();\n",
        """  } = useSoonStore();

  const selectedBubble =
    bubbles.find((bubble) => bubble.id === selectedBubbleId) || null;
"""
    )

# Props SidePanel propres
s = s.replace(
    "<SidePanel />",
    """<SidePanel
        mode={mode}
        selectedBubble={selectedBubble}
        selectedFish={selectedFish ? fish : null}
        onUpdateBubble={(patch) => selectedBubble && updateBubble(selectedBubble.id, patch)}
        onUpdateFishDepth={updateFishDepth}
      />"""
)

p.write_text(s)
print("OK: SoonApp poisson sélection branché")
