from pathlib import Path
import re

p = Path("src/pages/SoonApp.jsx")
s = p.read_text()

# Supprime state depth
s = s.replace('  const [depth, setDepth] = useState(1);\n', '')

# Commentaire actif
s = s.replace('// "zoom" | "speed" | "depth" | null', '// "zoom" | "speed" | null')

# Supprime prop depth canvas
s = s.replace('        depth={depth}\n', '')

# Tick sans depth
s = s.replace(
  'onTickFish={() => tickFish({ swimSpeed, depth })}',
  'onTickFish={() => tickFish({ swimSpeed })}'
)

# Supprime bouton depth
s = re.sub(
r'''\s*<button
\s*className={`bubble-btn depth \$\{activeSlider==="depth"\?"active":""\}`}
\s*onClick=\{\(\) => toggle\("depth"\)\}
\s*title="Profondeur"
\s*>🌊</button>''',
'',
s
)

# Supprime slider depth
s = re.sub(
r'''\s*\{activeSlider === "depth" && \(
\s*<div className="slider depth">
\s*<input
\s*type="range"
\s*min="0\.5"
\s*max="2"
\s*step="0\.1"
\s*value=\{depth\}
\s*onChange=\{\(e\) => setDepth\(Number\(e\.target\.value\)\)\}
\s*/>
\s*<span>Depth \{depth\.toFixed\(1\)\}</span>
\s*</div>
\s*\)\}''',
'',
s
)

p.write_text(s)
print("OK: profondeur retirée du cockpit bas")
