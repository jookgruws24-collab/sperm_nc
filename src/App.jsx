import { useState } from "react";
import { rankingTypes } from "./lib/config.js";
import SegmentedControl from "./components/SegmentedControl.jsx";
import RankingView from "./components/RankingView.jsx";
import CompareView from "./components/CompareView.jsx";

export default function App() {
  const [rankingType, setRankingType] = useState("growth");
  const [view, setView] = useState("ranking");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-400">Night Crows</p>
          <h1 className="font-display mt-1 text-3xl font-bold text-white sm:text-4xl">
            {rankingTypes[rankingType]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={rankingType}
            onChange={setRankingType}
            options={[
              { value: "growth", label: "Growth" },
              { value: "level", label: "Level" },
            ]}
          />
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "ranking", label: "Ranking" },
              { value: "compare", label: "Compare" },
            ]}
          />
        </div>
      </header>

      {view === "ranking" ? (
        <RankingView rankingType={rankingType} />
      ) : (
        <CompareView rankingType={rankingType} />
      )}

      <footer className="mt-auto pt-4 text-center text-xs text-zinc-600">
        Data from nightcrows.com official rankings
      </footer>
    </div>
  );
}
