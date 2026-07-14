import { useEffect, useState } from "react";
import { loadRanking } from "../lib/api.js";

export function useRankingData(rankingType, regionCode) {
  const [state, setState] = useState({ rows: [], status: "loading", partial: false });

  useEffect(() => {
    let alive = true;
    setState({ rows: [], status: "loading", partial: false });

    loadRanking(rankingType, regionCode, {
      onPartial: (rows) => {
        if (alive) setState({ rows, status: "ready", partial: true });
      },
    })
      .then((rows) => {
        if (alive) setState({ rows, status: "ready", partial: false });
      })
      .catch((error) => {
        console.error(error);
        if (alive) setState({ rows: [], status: "error", partial: false });
      });

    return () => {
      alive = false;
    };
  }, [rankingType, regionCode]);

  return state;
}
