from pathlib import Path

p = Path("src/core/audioEngine.js")
s = p.read_text()

# Master un peu plus doux
s = s.replace("masterGain.gain.value = 0.14;", "masterGain.gain.value = 0.1;")

# Stop plus progressif
s = s.replace(
'''    current.gain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.08);
    current.stop?.(ctx.currentTime + 0.15);''',
'''    current.gain.gain.cancelScheduledValues(ctx.currentTime);
    current.gain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.18);
    current.stop?.(ctx.currentTime + 0.35);'''
)

# Gains plus doux
s = s.replace(
"gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.12);",
"gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.18);"
)

s = s.replace(
"gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.22);",
"gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.28);"
)

# Ne pas relancer une bulle déjà active
s = s.replace(
'''  stopActiveSound(bubble.id);

  const sample =''',
'''  if (activeSounds.has(bubble.id)) {
    return;
  }

  const sample ='''
)

# Ambient plus doux
s = s.replace("near ? 0.22 : 0.12,", "near ? 0.14 : 0.08,")

p.write_text(s)
print("OK: audio anti-grésillement appliqué")
