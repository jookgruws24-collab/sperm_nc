import {
  fetchRankingPage,
  transformRankingItem,
  validRankingTypes,
  validRegionCodes,
  validWeaponTypes,
} from "./_shared.js";

const maxConcurrentPageFetches = 8;

export default async function handler(req, res) {
  try {
    const rankingType = String(req.query.rankingType || "growth");
    const regionCode = String(req.query.regionCode || "0");
    const weaponType = String(req.query.weaponType || "");
    const weaponTypes = parseWeaponTypes(req.query.weaponTypes);
    const includeGlobal = req.query.includeGlobal === "1" || req.query.includeGlobal === "true";

    if (!validRankingTypes.has(rankingType)) return res.status(400).json({ error: "Invalid rankingType" });
    if (!validRegionCodes.has(regionCode)) return res.status(400).json({ error: "Invalid regionCode" });
    if (weaponType && !validWeaponTypes.has(weaponType)) return res.status(400).json({ error: "Invalid weaponType" });
    if (weaponTypes.some((value) => !validWeaponTypes.has(value))) return res.status(400).json({ error: "Invalid weaponTypes" });

    const requestedWeaponTypes = buildRequestedWeaponTypes(includeGlobal, weaponType, weaponTypes);
    const { items, baseDt, totalCount } = await fetchRankingTasks(rankingType, regionCode, requestedWeaponTypes);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    res.status(200).json({
      source: `https://www.nightcrows.com/en/ranking/${rankingType}?regionCode=${regionCode}`,
      fetchedAt: new Date().toISOString(),
      rankingType,
      regionCode,
      weaponType,
      weaponTypes: requestedWeaponTypes.filter(Boolean),
      includeGlobal,
      baseDt,
      total: items.length,
      totalCount,
      items,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function parseWeaponTypes(value) {
  if (!value) return [];
  const rawValue = Array.isArray(value) ? value.join(",") : String(value);
  return [...new Set(rawValue.split(",").map((item) => item.trim()).filter(Boolean))];
}

function buildRequestedWeaponTypes(includeGlobal, weaponType, weaponTypes) {
  const requestedWeaponTypes = weaponTypes.length ? weaponTypes : weaponType ? [weaponType] : [];
  if (includeGlobal) return ["", ...requestedWeaponTypes];
  return requestedWeaponTypes.length ? requestedWeaponTypes : [""];
}

async function fetchRankingTasks(rankingType, regionCode, requestedWeaponTypes) {
  const tasks = requestedWeaponTypes.flatMap((requestedWeaponType) =>
    Array.from({ length: 10 }, (_, index) => ({
      page: index + 1,
      weaponType: requestedWeaponType,
      sourceScope: requestedWeaponType ? "class" : "global",
    }))
  );
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      const task = tasks[taskIndex];
      nextIndex += 1;

      const pageData = await fetchRankingPage(rankingType, regionCode, task.page, task.weaponType);
      const rankingData = pageData.props.pageProps.rankingListData;
      results[taskIndex] = {
        baseDt: rankingData.additional?.baseDt || "",
        totalCount: rankingData.totalCount || 0,
        items: (rankingData.items || []).map((item) =>
          transformRankingItem(item, task.page, rankingData.totalCount, task.sourceScope)
        ),
      };
    }
  }

  const workerCount = Math.min(maxConcurrentPageFetches, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results.reduce(
    (summary, result) => ({
      baseDt: result.baseDt || summary.baseDt,
      totalCount: result.totalCount || summary.totalCount,
      items: [...summary.items, ...result.items],
    }),
    { baseDt: "", totalCount: 0, items: [] }
  );
}
