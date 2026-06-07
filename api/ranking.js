const validRegionCodes = new Set(["0", "2010", "3010", "4010"]);
const validWeaponTypes = new Set(["11", "12", "13", "14", "15", "21", "22", "23", "31", "32", "33"]);
const validRankingTypes = new Set(["growth", "level"]);
const maxConcurrentPageFetches = 6;
const classMap = {
  13: "One-handed Sword",
  12: "Twin Sword",
  31: "Staff",
  32: "Wand",
  33: "Orb",
  11: "Two-handed Sword",
  14: "Spear",
  21: "Bow",
  22: "Dagger",
  23: "Rapier",
  15: "Cannon",
};

module.exports = async function handler(req, res) {
  try {
    const rankingType = String(req.query.rankingType || "growth");
    const regionCode = String(req.query.regionCode || "0");
    const weaponType = String(req.query.weaponType || "");
    const weaponTypes = parseWeaponTypes(req.query.weaponTypes);
    const includeGlobal = req.query.includeGlobal === "1" || req.query.includeGlobal === "true";

    if (!validRankingTypes.has(rankingType)) {
      res.status(400).json({ error: "Invalid rankingType" });
      return;
    }

    if (!validRegionCodes.has(regionCode)) {
      res.status(400).json({ error: "Invalid regionCode" });
      return;
    }

    if (weaponType && !validWeaponTypes.has(weaponType)) {
      res.status(400).json({ error: "Invalid weaponType" });
      return;
    }

    if (weaponTypes.some((value) => !validWeaponTypes.has(value))) {
      res.status(400).json({ error: "Invalid weaponTypes" });
      return;
    }

    const requestedWeaponTypes = buildRequestedWeaponTypes(includeGlobal, weaponType, weaponTypes);
    const { items, baseDt, totalCount } = await fetchRankingTasks(rankingType, regionCode, requestedWeaponTypes);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
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
};

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

async function fetchRankingPage(rankingType, regionCode, page, weaponType = "") {
  const url = new URL(`https://www.nightcrows.com/en/ranking/${rankingType}`);
  url.searchParams.set("rankingType", rankingType);
  url.searchParams.set("wmsso_sign", "check");
  url.searchParams.set("regionCode", regionCode);
  if (weaponType) url.searchParams.set("weaponType", weaponType);
  url.searchParams.set("page", String(page));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Night Crows returned HTTP ${response.status} for page ${page}`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Could not find __NEXT_DATA__ for page ${page}`);
  }

  return JSON.parse(match[1]);
}

function transformRankingItem(item, sourcePage, sourceTotalCount, sourceScope) {
  const delta = item.deltaRank;
  const fluctuationType = delta === null ? "new" : delta > 0 ? "up" : delta < 0 ? "down" : "same";
  const fluctuation = delta === null ? "NEW" : delta === 0 ? "-" : String(Math.abs(delta));
  const classCode = Number(item.pcWeaponType);

  return {
    ranking: Number(item.rank),
    fluctuationType,
    fluctuation,
    character: item.CharacterName || "",
    class: classMap[classCode] || `Type ${item.pcWeaponType}`,
    classCode,
    server: `${item.RealmGroupName || ""}/${item.RealmName || ""}`,
    guild: item.GuildName || "",
    union: item.GuildUnionName || "",
    region: item.RegionName || "",
    regionCode: item.RegionID || "",
    sourcePage,
    sourceScope,
    sourceTotalCount: Number(sourceTotalCount) || 0,
    maxRankDate: item.MaxRankDate || "",
  };
}
