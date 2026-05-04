from pathlib import Path

p = Path("src/components/SoonCanvas.jsx")
s = p.read_text()

s = s.replace(
"""const hit = findBubbleAt(point);
    const current = stateRef.current;
    const beaconHit = current.mode === "reso" ? findBeaconAt(point) : null;""",
"""const current = stateRef.current;
    const hit = findBubbleAt(point);
    const beaconHit = current.mode === "reso" ? findBeaconAt(point) : null;"""
)

p.write_text(s)
print("OK: current avant hit")
