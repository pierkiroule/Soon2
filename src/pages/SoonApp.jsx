import { useState } from "react";
import SidePanel from "../components/SidePanel.jsx";
import SoonCanvas from "../components/SoonCanvas.jsx";
import Profile from "./Profile.jsx";
import { useSoonStore } from "../store/useSoonStore.js";

export default function SoonApp({ onBack }) {
  const [page, setPage] = useState("arena");
  const [viewZoom, setViewZoom] = useState(1);
  const [swimSpeed, setSwimSpeed] = useState(1);

  // "zoom" | "speed" | null
  const [activeSlider, setActiveSlider] = useState(null);

  const {
    mode,
    bubbles,
    fish,
    selectedBubbleId,
    selectedFish,
    traceCircuit,
    selectedBeaconId,
    circuitAutopilot,
    path,
    eyesClosed,
    setMode,
    setFishTarget,
    tickFish,
    selectBubble,
    selectFish,
    updateFishDepth,
    updateBubble,
  } = useSoonStore();

  const selectedBubble =
    bubbles.find((bubble) => bubble.id === selectedBubbleId) || null;

  const toggle = (key) =>
    setActiveSlider((cur) => (cur === key ? null : key));

  if (page === "profile") {
    return <Profile onBack={() => setPage("arena")} />;
  }

  return (
    <main className="soon-app">

      {/* TOP NAV */}
      

<header className="top-nav">
  <div className="top-nav-inner">

    <button onClick={onBack}>
      Intro
    </button>

    <button onClick={() => setMode("compo")} className={mode==="compo"?"active":""}>
      Compo
    </button>

    <button onClick={() => setMode("reso")} className={mode==="reso"?"active":""}>
      Odysséo
    </button>

    <button onClick={() => setPage("profile")}>
      Perso
    </button>

  </div>
</header>



      {/* CANVAS */}
      <SoonCanvas
        mode={mode}
        bubbles={bubbles}
        fish={fish}
        selectedBubbleId={selectedBubbleId}
        onSelectBubble={selectBubble}
        onSelectFish={selectFish}
        traceCircuit={traceCircuit}
        selectedBeaconId={selectedBeaconId}
        circuitAutopilot={circuitAutopilot}
        path={path}
        eyesClosed={eyesClosed}
        viewZoom={viewZoom}
        onFishTarget={setFishTarget}
        onTickFish={() => tickFish({ swimSpeed })}
      />

      {/* COCKPIT */}
      <div className="cockpit">

        {/* BOUTONS */}
        <div className="cockpit-buttons">
          <button
            className={`bubble-btn zoom ${activeSlider==="zoom"?"active":""}`}
            onClick={() => toggle("zoom")}
            title="Zoom"
          >🔍</button>

          <button
            className={`bubble-btn speed ${activeSlider==="speed"?"active":""}`}
            onClick={() => toggle("speed")}
            title="Vitesse"
          >⚡</button>
        </div>

        {/* SLIDERS */}
        <div className={`slider-panel ${activeSlider ? "open" : ""}`}>

          {activeSlider === "zoom" && (
            <div className="slider zoom">
              <input
                type="range"
                min="0.3"
                max="3"
                step="0.1"
                value={viewZoom}
                onChange={(e) => setViewZoom(Number(e.target.value))}
              />
              <span>Zoom {viewZoom.toFixed(1)}×</span>
            </div>
          )}

          {activeSlider === "speed" && (
            <div className="slider speed">
              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.1"
                value={swimSpeed}
                onChange={(e) => setSwimSpeed(Number(e.target.value))}
              />
              <span>Speed {swimSpeed.toFixed(1)}×</span>
            </div>
          )}

        </div>

      </div>

      <SidePanel
        mode={mode}
        selectedBubble={selectedBubble}
        selectedFish={selectedFish ? fish : null}
        onUpdateBubble={(patch) => selectedBubble && updateBubble(selectedBubble.id, patch)}
        onUpdateFishDepth={updateFishDepth}
      />

    </main>
  );
}