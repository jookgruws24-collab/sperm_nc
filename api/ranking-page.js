const validRegionCodes = new Set(["0", "2010", "3010", "4010"]);
const validWeaponTypes = new Set(["11", "12", "13", "14", "15", "21", "22", "23", "31", "32", "33"]);
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
    const regionCode = String(req.query.regionCode || "0");
    const weaponType = String(req.query.weaponType || "");
    const page = Number(req.query.page || "1");

    if (!validRegionCodes.has(regionCode)) {
      res.status(400).json({ error: "Invalid regionCode" });
      return;
    }

    if (!Number.isInteger(page) || page < 1 || page > 10) {
      res.status(400).json({ error: "Invalid page" });
      return;
    }

    if (weaponType && !validWeaponTypes.has(weaponType)) {
      res.status(400).json({ error: "Invalid weaponType" });
      return;
    }

    const pageData = await fetchRankingPage(regionCode, page, weaponType);
    const rankingData = pageData.props.pageProps.rankingListData;

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    res.status(200).json({
      source: `https://www.nightcrows.com/en/ranking/growth?regionCode=${regionCode}&weaponType=${weaponType}&page=${page}`,
      fetchedAt: new Date().toISOString(),
      regionCode,
      page,
      baseDt: rankingData.additional?.baseDt || "",
      total: rankingData.items?.length || 0,
      totalCount: rankingData.totalCount || 0,
      items: (rankingData.items || []).map((item) => transformRankingItem(item, page)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function fetchRankingPage(regionCode, page, weaponType = "") {
  const url = new URL("https://www.nightcrows.com/en/ranking/growth");
  url.searchParams.set("rankingType", "growth");
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

function transformRankingItem(item, sourcePage) {
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
    maxRankDate: item.MaxRankDate || "",
  };
}
