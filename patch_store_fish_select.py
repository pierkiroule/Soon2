from pathlib import Path

p = Path("src/store/useSoonStore.js")
s = p.read_text()

if "selectedFish: false," not in s:
    s = s.replace(
        "selectedBubbleId: null,",
        "selectedBubbleId: null,\n  selectedFish: false,"
    )

if "selectFish:" not in s:
    s = s.replace(
        "selectBubble: (id) => set({ selectedBubbleId: id }),",
        """selectBubble: (id) => set({ selectedBubbleId: id, selectedFish: false }),
  selectFish: () => set({ selectedFish: true, selectedBubbleId: null }),
  updateFishDepth: (depth) => {
    set((state) => ({
      fish: {
        ...state.fish,
        depth,
      },
    }));
    saveState(get());
  },"""
    )

p.write_text(s)
print("OK: sélection poisson ajoutée au store")
