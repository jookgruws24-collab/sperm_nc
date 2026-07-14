import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(root, "dist");
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const validRegionCodes = new Set(["0", "2010", "3010", "4010"]);
const validWeaponTypes = new Set(["11", "12", "13", "14", "15", "21", "22", "23", "31", "32", "33"]);
const validRankingTypes = new Set(["growth", "level"]);
const maxConcurrentPageFetches = 8;

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

// --- API optimizations ---
// 1. Fresh cache (5 min) + stale-while-revalidate (30 min): stale entries are
//    served instantly while a background refresh updates the cache.
// 2. In-flight request deduplication: concurrent identical requests share one
//    upstream fetch instead of hammering nightcrows.com.
// 3. Gzip compression for JSON responses (the full dataset shrinks ~10x).
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 30 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);

  if (url.pathname === "/api/ranking") {
    await handleRankingApi(req, url, res);
    return;
  }

  if (url.pathname === "/api/ranking-page") {
    await handleRankingPageApi(req, url, res);
    return;
  }

  serveStatic(url, res);
});

function serveStatic(url, res) {
  if (!fs.existsSync(distDir)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Frontend not built yet. Run `npm run build` first, or use `npm run dev` for development.");
    return;
  }

  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  let file = path.resolve(distDir, requested);

  if (!file.startsWith(distDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  // SPA fallback for paths without a file extension
  if (!fs.existsSync(file) && !path.extname(file)) {
    file = path.join(distDir, "index.html");
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const isAsset = /\.(js|css|woff2|png|svg)$/.test(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(data);
  });
}

async function getCachedOrFetch(cacheKey, fetcher, res, req) {
  const cached = cache.get(cacheKey);
  const age = cached ? Date.now() - cached.createdAt : Infinity;

  if (cached && age < FRESH_MS) {
    sendJson(req, res, 200, cached.data, "HIT");
    return;
  }

  if (cached && age < STALE_MS) {
    // Serve stale immediately, refresh in the background.
    sendJson(req, res, 200, cached.data, "STALE");
    if (!inflight.has(cacheKey)) {
      const refresh = fetcher()
        .then((data) => cache.set(cacheKey, { createdAt: Date.now(), data }))
        .catch(() => {})
        .finally(() => inflight.delete(cacheKey));
      inflight.set(cacheKey, refresh);
    }
    return;
  }

  let promise = inflight.get(cacheKey);
  if (!promise) {
    promise = fetcher().finally(() => inflight.delete(cacheKey));
    inflight.set(cacheKey, promise);
  }

  const data = await promise;
  cache.set(cacheKey, { createdAt: Date.now(), data });
  sendJson(req, res, 200, data, "MISS");
}

async function handleRankingApi(req, url, res) {
  try {
    const rankingType = url.searchParams.get("rankingType") || "growth";
    const regionCode = url.searchParams.get("regionCode") || "0";
    const weaponType = url.searchParams.get("weaponType") || "";
    const weaponTypes = parseWeaponTypes(url.searchParams.get("weaponTypes"));
    const includeGlobal = url.searchParams.get("includeGlobal") === "1" || url.searchParams.get("includeGlobal") === "true";

    if (!validRankingTypes.has(rankingType)) return sendJson(req, res, 400, { error: "Invalid rankingType" });
    if (!validRegionCodes.has(regionCode)) return sendJson(req, res, 400, { error: "Invalid regionCode" });
    if (weaponType && !validWeaponTypes.has(weaponType)) return sendJson(req, res, 400, { error: "Invalid weaponType" });
    if (weaponTypes.some((value) => !validWeaponTypes.has(value))) return sendJson(req, res, 400, { error: "Invalid weaponTypes" });

    const requestedWeaponTypes = buildRequestedWeaponTypes(includeGlobal, weaponType, weaponTypes);
    const cacheKey = `${rankingType}:${regionCode}:${includeGlobal ? "global+" : ""}${requestedWeaponTypes.filter(Boolean).join(",") || "all"}`;

    await getCachedOrFetch(cacheKey, async () => {
      const { items, baseDt, totalCount } = await fetchRankingTasks(rankingType, regionCode, requestedWeaponTypes);
      return {
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
    }, res, req);
  } catch (error) {
    sendJson(req, res, 500, { error: error.message });
  }
}

async function handleRankingPageApi(req, url, res) {
  try {
    const rankingType = url.searchParams.get("rankingType") || "growth";
    const regionCode = url.searchParams.get("regionCode") || "0";
    const weaponType = url.searchParams.get("weaponType") || "";
    const page = Number(url.searchParams.get("page") || "1");

    if (!validRankingTypes.has(rankingType)) return sendJson(req, res, 400, { error: "Invalid rankingType" });
    if (!validRegionCodes.has(regionCode)) return sendJson(req, res, 400, { error: "Invalid regionCode" });
    if (!Number.isInteger(page) || page < 1 || page > 10) return sendJson(req, res, 400, { error: "Invalid page" });
    if (weaponType && !validWeaponTypes.has(weaponType)) return sendJson(req, res, 400, { error: "Invalid weaponType" });

    const cacheKey = `page:${rankingType}:${regionCode}:${weaponType || "all"}:${page}`;

    await getCachedOrFetch(cacheKey, async () => {
      const pageData = await fetchRankingPage(rankingType, regionCode, page, weaponType);
      const rankingData = pageData.props.pageProps.rankingListData;
      return {
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
    }, res, req);
  } catch (error) {
    sendJson(req, res, 500, { error: error.message });
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

function sendJson(req, res, status, data, cacheStatus) {
  const body = JSON.stringify(data);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status === 200 ? "public, max-age=60" : "no-store",
  };
  if (cacheStatus) headers["X-Cache"] = cacheStatus;

  const acceptsGzip = /\bgzip\b/.test(req?.headers?.["accept-encoding"] || "");
  if (status === 200 && acceptsGzip && body.length > 1024) {
    zlib.gzip(Buffer.from(body), (error, compressed) => {
      if (error) {
        res.writeHead(status, headers);
        res.end(body);
        return;
      }
      headers["Content-Encoding"] = "gzip";
      res.writeHead(status, headers);
      res.end(compressed);
    });
    return;
  }

  res.writeHead(status, headers);
  res.end(body);
}

server.listen(port, host, () => {
  console.log(`Night Crows ranking API + app: http://${host}:${port}/`);
});
