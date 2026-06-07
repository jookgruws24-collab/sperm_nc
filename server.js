const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const host = "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
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
const cache = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);

  if (url.pathname === "/api/ranking") {
    handleRankingApi(url, res);
    return;
  }

  if (url.pathname === "/api/ranking-page") {
    handleRankingPageApi(url, res);
    return;
  }

  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(root, requested);

  if (!file.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

async function handleRankingApi(url, res) {
  try {
    const rankingType = url.searchParams.get("rankingType") || "growth";
    const regionCode = url.searchParams.get("regionCode") || "0";
    const weaponType = url.searchParams.get("weaponType") || "";
    const weaponTypes = parseWeaponTypes(url.searchParams.get("weaponTypes"));
    const includeGlobal = url.searchParams.get("includeGlobal") === "1" || url.searchParams.get("includeGlobal") === "true";
    if (!validRankingTypes.has(rankingType)) {
      sendJson(res, 400, { error: "Invalid rankingType" });
      return;
    }

    if (!validRegionCodes.has(regionCode)) {
      sendJson(res, 400, { error: "Invalid regionCode" });
      return;
    }

    if (weaponTypes.some((value) => !validWeaponTypes.has(value))) {
      sendJson(res, 400, { error: "Invalid weaponTypes" });
      return;
    }

    const requestedWeaponTypes = buildRequestedWeaponTypes(includeGlobal, weaponType, weaponTypes);
    const cacheKey = `${rankingType}:${regionCode}:${includeGlobal ? "global+" : ""}${requestedWeaponTypes.filter(Boolean).join(",") || "all"}`;
    if (weaponType && !validWeaponTypes.has(weaponType)) {
      sendJson(res, 400, { error: "Invalid weaponType" });
      return;
    }

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) {
      sendJson(res, 200, cached.data);
      return;
    }

    const { items, baseDt, totalCount } = await fetchRankingTasks(rankingType, regionCode, requestedWeaponTypes);

    const data = {
      source: `https://www.nightcrows.com/en/ranking/${rankingType}?regionCode=${regionCode}`,
      rankingType,
      fetchedAt: new Date().toISOString(),
      regionCode,
      weaponType,
      weaponTypes: requestedWeaponTypes.filter(Boolean),
      includeGlobal,
      baseDt,
      total: items.length,
      totalCount,
      items,
    };

    cache.set(cacheKey, { createdAt: Date.now(), data });
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleRankingPageApi(url, res) {
  try {
    const rankingType = url.searchParams.get("rankingType") || "growth";
    const regionCode = url.searchParams.get("regionCode") || "0";
    const weaponType = url.searchParams.get("weaponType") || "";
    const page = Number(url.searchParams.get("page") || "1");

    if (!validRankingTypes.has(rankingType)) {
      sendJson(res, 400, { error: "Invalid rankingType" });
      return;
    }

    if (!validRegionCodes.has(regionCode)) {
      sendJson(res, 400, { error: "Invalid regionCode" });
      return;
    }

    if (!Number.isInteger(page) || page < 1 || page > 10) {
      sendJson(res, 400, { error: "Invalid page" });
      return;
    }

    if (weaponType && !validWeaponTypes.has(weaponType)) {
      sendJson(res, 400, { error: "Invalid weaponType" });
      return;
    }

    const cacheKey = `${rankingType}:${regionCode}:${weaponType || "all"}:${page}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) {
      sendJson(res, 200, cached.data);
      return;
    }

    const pageData = await fetchRankingPage(rankingType, regionCode, page, weaponType);
    const rankingData = pageData.props.pageProps.rankingListData;
    const data = {
      source: `https://www.nightcrows.com/en/ranking/${rankingType}?regionCode=${regionCode}&weaponType=${weaponType}&page=${page}`,
      fetchedAt: new Date().toISOString(),
      rankingType,
      regionCode,
      page,
      baseDt: rankingData.additional?.baseDt || "",
      total: rankingData.items?.length || 0,
      totalCount: rankingData.totalCount || 0,
      items: (rankingData.items || []).map((item) => transformRankingItem(item, page, rankingData.totalCount)),
    };

    cache.set(cacheKey, { createdAt: Date.now(), data });
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function parseWeaponTypes(value) {
  if (!value) return [];
  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
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

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

server.listen(port, host, () => {
  console.log(`Night Crows ranking viewer: http://${host}:${port}/`);
});
