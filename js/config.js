export const totalPages = 10;
export const maxConcurrentLoads = 4;
export const rowsPerPage = 1000;
export const compareRowsPerTable = 1000;

export const rankingTypes = {
  growth: "Growth Ranking",
  level: "Level Ranking",
};

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

export const weaponTypeOrder = new Map(weaponTypes.map((weaponType, index) => [Number(weaponType.code), index]));
