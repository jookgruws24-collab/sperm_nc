export const rankingTypes = {
  growth: "Growth Ranking",
  level: "Level Ranking",
};

export const regions = [
  { code: "0", name: "All Regions" },
  { code: "2010", name: "ASIA" },
  { code: "3010", name: "NAEU" },
  { code: "4010", name: "SA" },
];

export const weaponTypes = [
  { code: "13", name: "One-handed Sword" },
  { code: "12", name: "Twin Sword" },
  { code: "31", name: "Staff" },
  { code: "32", name: "Wand" },
  { code: "33", name: "Orb" },
  { code: "11", name: "Two-handed Sword" },
  { code: "14", name: "Spear" },
  { code: "21", name: "Bow" },
  { code: "22", name: "Dagger" },
  { code: "23", name: "Rapier" },
  { code: "15", name: "Cannon" },
];

export const weaponTypeOrder = new Map(
  weaponTypes.map((weaponType, index) => [Number(weaponType.code), index])
);

export const pageSizeOptions = [25, 50, 100, 250];
export const defaultPageSize = 50;
export const compareRowsPerTable = 200;

export const servers = [
  "EAST101/Bishop",
  "EAST101/Knight",
  "EAST101/Rook",
  "EAST102/Bishop",
  "EAST102/Knight",
  "EAST102/Rook",
  "EAST105/Bishop",
  "EAST105/Knight",
  "EAST105/Rook",
  "EAST106/Bishop",
  "EAST106/Knight",
  "EAST106/Rook",
  "EAST107/Bishop",
  "EAST107/Knight",
  "EAST107/Rook",
  "SEA101/Bishop",
  "SEA101/Knight",
  "SEA101/Rook",
  "SEA102/Bishop",
  "SEA102/Knight",
  "SEA102/Rook",
  "SEA103/Bishop",
  "SEA103/Knight",
  "SEA103/Rook",
  "SEA104/Bishop",
  "SEA104/Knight",
  "SEA104/Rook",
  "SEA105/Bishop",
  "SEA105/Knight",
  "SEA105/Rook",
  "SEA106/Bishop",
  "SEA106/Knight",
  "SEA106/Rook",
  "SEA110/Bishop",
  "SEA110/Knight",
  "SEA110/Rook",
  "SEA111/Bishop",
  "SEA111/Knight",
  "SEA111/Rook",
  "SEA112/Bishop",
  "SEA112/Knight",
  "SEA112/Rook",
  "SEA113/Bishop",
  "SEA113/Knight",
  "SEA113/Rook",
  "SEA114/Bishop",
  "SEA114/Knight",
  "SEA114/Rook",
  "SEA115/Bishop",
  "SEA115/Knight",
  "SEA115/Rook",
];
