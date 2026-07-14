import {
  fetchRankingPage,
  transformRankingItem,
  validRankingTypes,
  validRegionCodes,
  validWeaponTypes,
} from "./_shared.js";

export default async function handler(req, res) {
  try {
    const rankingType = String(req.query.rankingType || "growth");
    const regionCode = String(req.query.regionCode || "0");
    const weaponType = String(req.query.weaponType || "");
    const page = Number(req.query.page || "1");

    if (!validRankingTypes.has(rankingType)) return res.status(400).json({ error: "Invalid rankingType" });
    if (!validRegionCodes.has(regionCode)) return res.status(400).json({ error: "Invalid regionCode" });
    if (!Number.isInteger(page) || page < 1 || page > 10) return res.status(400).json({ error: "Invalid page" });
    if (weaponType && !validWeaponTypes.has(weaponType)) return res.status(400).json({ error: "Invalid weaponType" });

    const pageData = await fetchRankingPage(rankingType, regionCode, page, weaponType);
    const rankingData = pageData.props.pageProps.rankingListData;

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    res.status(200).json({
      source: `https://www.nightcrows.com/en/ranking/${rankingType}?regionCode=${regionCode}&weaponType=${weaponType}&page=${page}`,
      fetchedAt: new Date().toISOString(),
      rankingType,
      regionCode,
      page,
      baseDt: rankingData.additional?.baseDt || "",
      total: rankingData.items?.length || 0,
      totalCount: rankingData.totalCount || 0,
      items: (rankingData.items || []).map((item) => transformRankingItem(item, page, rankingData.totalCount, weaponType ? "class" : "global")),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
