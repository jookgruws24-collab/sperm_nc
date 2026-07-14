export const validRegionCodes = new Set(["0", "2010", "3010", "4010"]);
export const validWeaponTypes = new Set(["11", "12", "13", "14", "15", "21", "22", "23", "31", "32", "33"]);
export const validRankingTypes = new Set(["growth", "level"]);

export const classMap = {
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

export async function fetchRankingPage(rankingType, regionCode, page, weaponType = "") {
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

export function transformRankingItem(item, sourcePage, sourceTotalCount, sourceScope) {
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
