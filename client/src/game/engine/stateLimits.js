const AG_STATES = new Set([
  "IA", "IL", "IN", "KS", "MN", "MO", "NE", "ND", "SD", "WI",
  "ID", "AR", "MS", "OK", "MT", "WY", "KY", "TN", "GA", "NC", "SC", "AL", "LA",
  "TX", "CA", "FL",
]);

const RES_STATES = new Set([
  "AK", "WY", "WV", "PA", "TX", "OK", "LA", "CO", "NM", "UT", "NV", "AZ", "MT", "ND", "SD", "AL", "KY",
]);

const URBAN_STATES = new Set(["DC", "NJ", "MA", "CT", "RI", "NY"]);
const ARID_STATES = new Set(["AZ", "NV", "NM", "UT", "CO"]);

const normalizeCode = (code) => String(code || "").toUpperCase();
const clampMin = (value, min = 0) => (value < min ? min : value);

export const getStateBuildingLimits = (stateCode, stateMeta = {}) => {
  const code = normalizeCode(stateCode || stateMeta?.id || "");
  const popPoints = Math.max(0, Number(stateMeta?.popPoints || 0));

  let farm = Math.round(popPoints / 25000) + 3;
  let resourceStation = Math.round(popPoints / 35000) + 2;

  if (AG_STATES.has(code)) farm += popPoints < 40000 ? 3 : 2;
  if (RES_STATES.has(code)) resourceStation += popPoints < 40000 ? 2 : 1;
  if (URBAN_STATES.has(code)) {
    farm -= 1;
    resourceStation -= 1;
  }
  if (ARID_STATES.has(code) && !AG_STATES.has(code)) farm -= 1;

  let workshop = Math.round(popPoints / 20000) + 3;
  if (URBAN_STATES.has(code)) workshop += 3;
  if (RES_STATES.has(code)) workshop += 1;

  let university = Math.round(popPoints / 60000) + 1;
  if (URBAN_STATES.has(code)) university += 1;

  return {
    farm: clampMin(farm, 0),
    resource_station: clampMin(resourceStation, 0),
    workshop: clampMin(workshop, 0),
    university: clampMin(university, 0),
  };
};

export const getSoldierLimitForPopulation = (population, soldiersPer1000) => {
  const pop = Math.max(0, Number(population || 0));
  const cap = Math.max(1, Number(soldiersPer1000 || 0));
  return Math.max(0, Math.floor((pop * cap) / 1000));
};

