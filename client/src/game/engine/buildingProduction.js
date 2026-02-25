import { BUILDING_PRIORITY, ENGINE } from "./constants";

const clamp0 = (value) => (value < 0 ? 0 : value);

const sumObj = (a, b) => {
  const out = { ...a };
  Object.keys(b).forEach((k) => {
    out[k] = (out[k] || 0) + (b[k] || 0);
  });
  return out;
};

const mulObj = (a, m) => {
  const out = {};
  Object.keys(a || {}).forEach((k) => {
    out[k] = (a[k] || 0) * m;
  });
  return out;
};

const getOutputMultiplier = (resourceKey, modifiers) => {
  if (resourceKey === "food") return (modifiers.foodOutputMult || 1) * (modifiers.multFood || 1);
  if (resourceKey === "resources") return (modifiers.resourceOutputMult || 1) * (modifiers.resourceEfficiency || 1);
  if (resourceKey === "tools") return modifiers.toolOutputMult || 1;
  if (resourceKey === "weapons") return modifiers.weaponOutputMult || 1;
  return 1;
};

export const computeBuildingDeltas = ({ buildings, buildingsCfg, resources, workforce, modifiers }) => {
  const cfgs = buildingsCfg || {};
  const producesTotal = {};
  const consumesTotal = {};
  const ran = {};
  const shortages = [];

  let workersLeft = Math.max(0, workforce);
  const tempRes = { ...resources };

  const boostedCfg = (cfg) => ({
    ...cfg,
    produces: mulObj(cfg.produces || {}, ENGINE.PROD_MULT),
  });

  BUILDING_PRIORITY.forEach((id) => {
    const countOwned = Math.max(0, Number(buildings?.[id] || 0));
    if (!countOwned) return;

    const baseCfg = cfgs[id] || null;
    if (!baseCfg) return;

    const cfg = boostedCfg(baseCfg);
    const workersNeed = Math.max(1, Number(cfg.workers || 0));

    const maxByWorkers = Math.floor(workersLeft / workersNeed);
    if (maxByWorkers <= 0) return;

    const consumes = cfg.consumes || {};
    let maxByRes = Infinity;
    Object.entries(consumes).forEach(([resource, amount]) => {
      const need = Math.max(0, Number(amount || 0));
      if (!need) return;
      const have = Math.max(0, Number(tempRes[resource] || 0));
      maxByRes = Math.min(maxByRes, Math.floor(have / need));
    });

    const runCount = Math.max(0, Math.min(countOwned, maxByWorkers, Number.isFinite(maxByRes) ? maxByRes : countOwned));
    if (runCount < countOwned) {
      const outputName = Object.keys(cfg.produces || {})[0] || id;
      Object.entries(consumes).forEach(([resource, amount]) => {
        const needPerBuilding = Math.max(0, Number(amount || 0));
        if (!needPerBuilding) return;
        const have = Math.max(0, Number(tempRes[resource] || 0));
        const needTotal = needPerBuilding * countOwned;
        const missing = Math.max(0, Math.ceil(needTotal - have));
        if (missing > 0) shortages.push({ building: id, output: outputName, resource, missing });
      });
    }
    if (!runCount) return;

    Object.entries(consumes).forEach(([resource, amount]) => {
      const need = Math.max(0, Number(amount || 0)) * runCount;
      if (!need) return;
      tempRes[resource] = clamp0(Number(tempRes[resource] || 0) - need);
      consumesTotal[resource] = (consumesTotal[resource] || 0) + need;
    });

    workersLeft -= runCount * workersNeed;
    ran[id] = runCount;

    Object.entries(cfg.produces || {}).forEach(([resource, amount]) => {
      const gainBase = Math.max(0, Number(amount || 0)) * runCount;
      const gain = gainBase * getOutputMultiplier(resource, modifiers);
      if (!gain) return;
      producesTotal[resource] = (producesTotal[resource] || 0) + gain;
    });
  });

  const deltas = {};
  Object.keys(sumObj(producesTotal, consumesTotal)).forEach((resource) => {
    deltas[resource] = (producesTotal[resource] || 0) - (consumesTotal[resource] || 0);
  });

  return { deltas, producesTotal, consumesTotal, ran, shortages };
};

