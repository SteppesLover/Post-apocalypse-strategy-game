export const BASE = {
  popConsumptionFood: 0.02,
  soldiersPer1000Pop: 200,
  popGrowthRate: 0.01,
  popGainMult: 0.9,
  workforceRatio: 0.5,
};

export const ENGINE = {
  BUILDING_ENDPOINT: "tech_trees/building.json",
  PROD_MULT: 1,
  MAX_LOG: 140,
};

export const WAR = {
  DEFAULT_NEUTRAL_ARMY: 500,
  DEFAULT_WARLORD_ARMY: 800,
  CAPTURED_POP_DIRECT_SHARE: 0.1,
  CAPTURED_POP_LOCKED_SHARE: 0.9,
  ZERO_DEFEATS_TO_COLLAPSE: 4,
};

export const TECH = {
  TURNS_PER_TECH: 3,
  MIN_START_FRACTION: 0.55,
  MAX_SPEND_FRACTION: 0.25,
  POP_COST_SCALE_BASE: 50000,
};

export const COLORS = {
  PALETTE: [
    "#ff69b4",
    "#ffffff",
    "#000000",
    "#800080",
    "#ffd700",
    "#00bfff",
    "#50c878",
    "#f5f5dc",
    "#98ff98",
    "#e6e6fa",
  ],
};

export const BUILDING_PRIORITY = [
  "farm",
  "resource_station",
  "tool_workshop",
  "weapon_factory",
  "university",
  "ruin",
];
