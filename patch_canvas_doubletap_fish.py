from pathlib import Path

p = Path("src/components/SoonCanvas.jsx")
s = p.read_text()

# prop
if "  onSelectFish," not in s:
    s = s.replace(
        "  onSelectBubble,\n",
        "  onSelectBubble,\n  onSelectFish,\n"
    )

# Fonction hit poisson
if "function isFishHit" not in s:
    s = s.replace(
        "function findBubbleAt(point) {",
        """function isFishHit(point, fish) {
  if (!fish) return false;
  return Math.hypot(point.x - fish.x, point.y - fish.y) < 54;
}

function findBubbleAt(point) {"""
    )

# Double tap poisson avant double tap add bubble
if "onSelectFish?.();" not in s:
    s = s.replace(
        '    if (isDoubleTap && current.mode === "compo") {',
        '''    if (isDoubleTap && isFishHit(point, current.fish)) {
      onSelectFish?.();
      pointerRef.current.lastTapAt = now;
      pointerRef.current.lastTapPos = point;
      return;
    }

    if (isDoubleTap && current.mode === "compo") {'''
    )

p.write_text(s)
print("OK: double tap poisson branché")
