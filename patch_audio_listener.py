from pathlib import Path

p = Path("src/components/SoonCanvas.jsx")
s = p.read_text()

s = s.replace(
'import {\n  playBubbleSound,\n  stopBubbleSound,\n  updateAmbientMix,\n} from "../core/audioEngine.js";',
'import {\n  playBubbleSound,\n  stopBubbleSound,\n  updateAmbientMix,\n  updateAudioListener,\n  updateBubbleAudioPosition,\n} from "../core/audioEngine.js";'
)

if "updateAudioListener(current.fish);" not in s:
    s = s.replace(
        "updateAmbientMix({ near: activeNow.size > 0 });",
        "updateAmbientMix({ near: activeNow.size > 0 });\n    updateAudioListener(current.fish);\n    current.bubbles?.forEach(updateBubbleAudioPosition);"
    )

p.write_text(s)
print("OK: écoute binaurale branchée")
