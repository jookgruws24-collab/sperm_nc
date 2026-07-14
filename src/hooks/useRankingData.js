import { useEffect, useState } from "react";
import { loadRanking, onRankingProgress } from "../lib/api.js";

export function useRankingData(rankingType, regionCode) {
  const [state, setState] = useState({ rows: [], status: "loading", partial: false });

  useEffect(() => {
    let alive = true;
    setState({ rows: [], status: "loading", partial: false });

    const onPartial = (rows) => {
      if (alive) setState({ rows, status: "ready", partial: true });
    };

    const unsubscribe = onRankingProgress(rankingType, regionCode, onPartial);

    loadRanking(rankingType, regionCode, { onPartial })
      .then((rows) => {
        if (alive) setState({ rows, status: "ready", partial: false });
      })
      .catch((error) => {
        console.error(error);
        if (alive) setState({ rows: [], status: "error", partial: false });
      });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [rankingType, regionCode]);

  return state;
}
