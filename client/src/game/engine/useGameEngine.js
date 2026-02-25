import { useEffect, useMemo, useRef, useState } from "react";
import { US_NEIGHBORS } from "../../usNeighbors";
import { assetUrl } from "../../utils/assetPaths";
import { computeDerived } from "../../game/selectors/derivedStats";
import { computeModifiers } from "../../game/selectors/modifiers";
import { BASE, COLORS, ENGINE, TECH, WAR } from "./constants";
import { computeBuildingDeltas } from "./buildingProduction";
import { getSoldierLimitForPopulation, getStateBuildingLimits } from "./stateLimits";

const normalizeCode = (code) => String(code || "").toUpperCase();

const getFactionId = (id) => {
  const raw = String(id || "");
  if (!raw) return raw;
  return raw.split(/-(?:exp|cap)-/)[0] || raw;
};

const fetchJSON = async (url) => {
  const res = await fetch(assetUrl(url), { cache: "no-store" });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
};

const clamp0 = (v) => (v < 0 ? 0 : v);

const CAPTURES_PER_TURN = 2;

const computeTechTotalCost = (idx, population) => {
  const baseCost = Math.max(0, 350 * (idx + 1));
  const pop = Math.max(0, Number(population || 0));
  const popScale = 1 + Math.sqrt(pop / TECH.POP_COST_SCALE_BASE);
  return Math.max(1, Math.ceil(baseCost * popScale));
};

const computeInstituteTotalCost = (idx, population) => {
  const baseCost = Math.max(0, 200 * (idx + 1));
  const pop = Math.max(0, Number(population || 0));
  const popScale = 1 + Math.sqrt(pop / (TECH.POP_COST_SCALE_BASE * 1.4));
  return Math.max(1, Math.ceil(baseCost * popScale));
};

const progressWork = ({ active, availableScience }) => {
  if (!active) return { next: null, spend: 0, done: false };
  const totalCost = Math.max(0, Number(active.totalCost || 0));
  const remaining = Math.max(0, Number(active.remainingCost ?? totalCost));
  const turnsLeft = Math.max(0, Number(active.turnsLeft ?? TECH.TURNS_PER_TECH));
  if (!totalCost || remaining <= 0) return { next: null, spend: 0, done: true };

  const perTurn = totalCost / TECH.TURNS_PER_TECH;
  const capByPool = availableScience > 0 ? Math.max(1, Math.floor(availableScience * TECH.MAX_SPEND_FRACTION)) : 0;
  const spend = Math.max(0, Math.min(perTurn, availableScience, remaining, capByPool));
  const nextRemaining = Math.max(0, remaining - spend);
  const nextTurnsLeft = Math.max(0, turnsLeft - 1);
  const done = nextRemaining <= 0 || nextTurnsLeft <= 0;

  return {
    next: done ? null : { ...active, totalCost, remainingCost: nextRemaining, turnsLeft: nextTurnsLeft },
    spend,
    done,
  };
};

export function useGameEngine({ province, warlordCount, playerColor, initialSave = null }) {
  const playerStateCode = normalizeCode(province?.id || "");
  const provincePopulation = Number(province?.popPoints || 0) || 0;
  const initialPopulation = Math.floor(provincePopulation * 0.1 * (BASE.popGainMult || 1));
  const baseStartResources = Math.max(0, Math.floor((provincePopulation / 30000) * 1000));
  const initialPopRef = useRef(initialPopulation);
  const usedColorsRef = useRef(new Set());

  const [turn, setTurn] = useState(() => Math.max(1, Number(initialSave?.turn || 1)));

  const [targetState, setTargetState] = useState(() => initialSave?.targetState || null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [usaProvinces, setUsaProvinces] = useState(null);
  const [ownedStates, setOwnedStates] = useState(() =>
    new Set(Array.isArray(initialSave?.ownedStates) ? initialSave.ownedStates : (playerStateCode ? [playerStateCode] : []))
  );
  const [otherWarlords, setOtherWarlords] = useState(() => initialSave?.otherWarlords || []);
  const [techTrees, setTechTrees] = useState({ agriculture: null, industry: null, military: null });
  const [socialTrees, setSocialTrees] = useState(null);
  const [buildingsCfg, setBuildingsCfg] = useState(null);

  const [resources, setResources] = useState(() =>
    initialSave?.resources || {
      population: initialPopulation,
      food: baseStartResources,
      soldiers: 1000,
      resources: baseStartResources,
      tools: baseStartResources,
      weapons: baseStartResources,
      science: baseStartResources,
      buildingWorkers: 0,
    }
  );

  const [buildings, setBuildings] = useState(() =>
    initialSave?.buildings || {
      ruin: 0,
      farm: 0,
      resource_station: 0,
      tool_workshop: 0,
      weapon_factory: 0,
      university: 0,
    }
  );

  const [buildingCaps, setBuildingCaps] = useState(() =>
    initialSave?.buildingCaps || {
      ...(() => {
        const limits = getStateBuildingLimits(playerStateCode, province || {});
        return {
          farm: Math.max(1, limits.farm),
          resource_station: Math.max(1, limits.resource_station),
          workshop: Math.max(1, limits.workshop),
          university: Math.max(1, limits.university),
        };
      })(),
    }
  );

  const [lockedPop, setLockedPop] = useState(() =>
    Number.isFinite(initialSave?.lockedPop)
      ? Math.max(0, Number(initialSave.lockedPop))
      : Math.max(0, Number(province?.popPoints || 0) - initialPopulation)
  );
  const [ruinUsedThisTurn, setRuinUsedThisTurn] = useState(() => Boolean(initialSave?.ruinUsedThisTurn));
  const [turnDelta, setTurnDelta] = useState(() => initialSave?.turnDelta || { food: 0, resources: 0, tools: 0, weapons: 0, science: 0, soldiers: 0 });

  const [activeTech, setActiveTech] = useState(() => initialSave?.activeTech || null);
  const [activeInstitute, setActiveInstitute] = useState(() => initialSave?.activeInstitute || null);
  const [unlockedTechs, setUnlockedTechs] = useState(() => new Set(initialSave?.unlockedTechs || []));
  const [unlockedInstitutes, setUnlockedInstitutes] = useState(() => new Set(initialSave?.unlockedInstitutes || []));

  const [stateArmies, setStateArmies] = useState(() => initialSave?.stateArmies || {});
  const [engineError, setEngineError] = useState(null);
  const [log, setLog] = useState(() => initialSave?.log || []);
  const [fullLog, setFullLog] = useState(() => initialSave?.fullLog || []);
  const [isDefeated, setIsDefeated] = useState(() => Boolean(initialSave?.isDefeated));
  const [playerCapturesThisTurn, setPlayerCapturesThisTurn] = useState(() => Math.max(0, Number(initialSave?.playerCapturesThisTurn || 0)));
  const [turnWarnings, setTurnWarnings] = useState(() => initialSave?.turnWarnings || []);
  const [warlordZeroDefeats, setWarlordZeroDefeats] = useState(() => initialSave?.warlordZeroDefeats || {});
  const [isFinishedManually, setIsFinishedManually] = useState(() => Boolean(initialSave?.isFinishedManually));
  const playerCapturesRef = useRef(Math.max(0, Number(initialSave?.playerCapturesThisTurn || 0)));
  const warlordZeroDefeatsRef = useRef(initialSave?.warlordZeroDefeats || {});

  const pushLog = (entry) => {
    setFullLog((prev) => [...prev, entry]);
    setLog((prev) => {
      const next = [...prev, entry];
      return next.length > ENGINE.MAX_LOG ? next.slice(next.length - ENGINE.MAX_LOG) : next;
    });
  };

  const pickUniqueColor = (preferred) => {
    const used = usedColorsRef.current;
    if (preferred && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    const available = COLORS.PALETTE.filter((c) => !used.has(c));
    if (available.length) {
      const idx = Math.floor(Math.random() * available.length);
      const color = available[idx];
      used.add(color);
      return color;
    }
    let color;
    do {
      color = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
    } while (used.has(color));
    used.add(color);
    return color;
  };

  useEffect(() => {
    if (playerColor) usedColorsRef.current.add(playerColor);
  }, [playerColor]);
  useEffect(() => {
    playerCapturesRef.current = Math.max(0, Number(playerCapturesThisTurn || 0));
  }, [playerCapturesThisTurn]);
  useEffect(() => {
    warlordZeroDefeatsRef.current = warlordZeroDefeats || {};
  }, [warlordZeroDefeats]);

  useEffect(() => {
    if (!ownedStates?.size) return;
    const stateMetaByCode = new Map();
    usaProvinces?.provinces?.forEach((p) => {
      const code = normalizeCode(p?.id || "");
      if (code) stateMetaByCode.set(code, p);
    });
    let farm = 0;
    let resource = 0;
    let workshop = 0;
    let university = 0;
    ownedStates.forEach((code) => {
      const normalized = normalizeCode(code);
      const stateMeta = stateMetaByCode.get(normalized) || (normalized === playerStateCode ? province : null);
      const limits = getStateBuildingLimits(normalized, stateMeta || {});
      farm += limits.farm;
      resource += limits.resource_station;
      workshop += limits.workshop;
      university += limits.university;
    });
    setBuildingCaps((caps) => ({
      ...caps,
      farm: Math.max(1, farm),
      resource_station: Math.max(1, resource),
      workshop: Math.max(1, workshop),
      university: Math.max(1, university),
    }));
  }, [ownedStates, usaProvinces, province, playerStateCode]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetchJSON("pops_maps/pop_usa.json"),
      fetchJSON("tech_trees/agr.json"),
      fetchJSON("tech_trees/prod.json"),
      fetchJSON("tech_trees/army.json"),
      fetchJSON("tech_trees/social_institutes.json"),
      fetchJSON(ENGINE.BUILDING_ENDPOINT),
    ])
      .then(([pops, agr, prod, army, social, buildingCfg]) => {
        if (ignore) return;
        setUsaProvinces(pops);
        setTechTrees({ agriculture: agr, industry: prod, military: army });
        setSocialTrees(social);
        setBuildingsCfg(buildingCfg.buildings || {});
      })
      .catch((e) => {
        if (!ignore) console.error("load failed", e);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch(assetUrl("maps/USA.svg"), { cache: "no-store" })
      .then((r) => r.text())
      .then((svg) => {
        if (!ignore) setSvgMarkup(svg.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, ""));
      })
      .catch((e) => {
        if (!ignore) console.error("svg load failed", e);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const seededRef = useRef(Boolean(initialSave?.otherWarlords?.length));
  useEffect(() => {
    if (!usaProvinces?.provinces || !playerStateCode || seededRef.current) return;
    const candidates = usaProvinces.provinces
      .filter((p) => Number(p?.popPoints || 0) >= 20000)
      .map((p) => normalizeCode(p.id || ""))
      .filter((c) => c && c !== playerStateCode);

    const targetCount = Math.max(2, Math.min(6, Number(warlordCount) || 6, candidates.length));
    const pickNonAdjacent = (pool, maxCount) => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked = [];
      shuffled.forEach((code) => {
        if (picked.length >= maxCount) return;
        const hasAdjacent = picked.some((v) => (US_NEIGHBORS[v] || []).includes(code));
        if (!hasAdjacent) picked.push(code);
      });
      return picked;
    };

    let finalChoices = [];
    for (let i = 0; i < 40; i += 1) {
      const attempt = pickNonAdjacent(candidates, targetCount);
      if (attempt.length > finalChoices.length) finalChoices = attempt;
      if (finalChoices.length >= targetCount) break;
    }

    setOtherWarlords(
      finalChoices.map((code, idx) => {
        const id = `ai-${idx + 1}`;
        return {
          id,
          factionId: id,
          order: idx + 2,
          state: code,
          type: ["economic", "military"][idx % 2],
          color: pickUniqueColor(),
          army: WAR.DEFAULT_WARLORD_ARMY,
        };
      })
    );

    seededRef.current = true;
  }, [usaProvinces, playerStateCode, warlordCount]);

  const popByState = useMemo(() => {
    const map = new Map();
    usaProvinces?.provinces?.forEach((p) => {
      const code = normalizeCode(p?.id || "");
      if (code) map.set(code, p);
    });
    return map;
  }, [usaProvinces]);

  useEffect(() => {
    if (!usaProvinces?.provinces || Object.keys(stateArmies).length > 0) return;
    const next = {};
    popByState.forEach((p, code) => {
      next[code] = WAR.DEFAULT_NEUTRAL_ARMY;
    });
    if (playerStateCode) next[playerStateCode] = resources.soldiers;
    otherWarlords.forEach((w) => {
      const code = normalizeCode(w.state);
      if (code) next[code] = Number.isFinite(w.army) ? w.army : WAR.DEFAULT_WARLORD_ARMY;
    });
    setStateArmies(next);
  }, [usaProvinces, popByState, playerStateCode, resources.soldiers, otherWarlords, stateArmies]);

  const borderStates = useMemo(() => {
    const result = new Set();
    ownedStates.forEach((s) => (US_NEIGHBORS[s] || []).forEach((n) => result.add(n)));
    ownedStates.forEach((s) => result.delete(s));
    return Array.from(result).sort();
  }, [ownedStates]);

  const institutesIndex = useMemo(() => {
    const index = new Map();
    const institutions = socialTrees?.socialInstitutions || {};
    Object.values(institutions).forEach((group) => {
      (group?.exclusiveBranches || []).forEach((branch) => {
        (branch?.nodes || []).forEach((node) => {
          if (node?.id) index.set(node.id, node);
        });
      });
    });
    return index;
  }, [socialTrees]);

  const modifiers = useMemo(
    () => computeModifiers(unlockedTechs, techTrees, unlockedInstitutes, institutesIndex),
    [techTrees, unlockedTechs, unlockedInstitutes, institutesIndex]
  );
  const militaryCaptureBonus = Math.max(0, Number(modifiers?.militaryActionsBonus || 0));
  const playerCaptureLimit = CAPTURES_PER_TURN + militaryCaptureBonus;

  const selectedStateLimits = useMemo(() => {
    const code = normalizeCode(targetState || "");
    if (!code) return null;
    const meta = popByState.get(code);
    if (!meta) return null;
    const caps = getStateBuildingLimits(code, meta);
    const pop = Number(meta?.popPoints || 0);
    return {
      state: code,
      population: pop,
      ...caps,
      soldierLimit: getSoldierLimitForPopulation(pop, modifiers?.soldiersPer1000Pop || 0),
    };
  }, [targetState, popByState, modifiers]);

  const isVictory = useMemo(() => {
    const totalStates = popByState.size || 0;
    return !isDefeated && (otherWarlords.length === 0 || (totalStates > 0 && ownedStates.size >= totalStates));
  }, [isDefeated, ownedStates, popByState, otherWarlords]);

  const derived = useMemo(
    () => computeDerived({ resources, turn }, modifiers),
    [resources, turn, modifiers]
  );
  const ruinPopulationCapPerTurn = useMemo(() => {
    const workforce = Math.max(0, Math.floor((resources.population || 0) * BASE.workforceRatio));
    return Math.max(0, Math.min(Math.floor(workforce * 2), 50000));
  }, [resources.population]);
  const ruinsLeft = useMemo(() => {
    if (lockedPop <= 0) return 0;
    return Math.ceil(lockedPop / Math.max(1, ruinPopulationCapPerTurn));
  }, [lockedPop, ruinPopulationCapPerTurn]);

  const getBuildBlockReason = (id) => {
    const cfg = (buildingsCfg && buildingsCfg[id]) || null;
    if (!cfg || id === "ruin") return "Unavailable";
    if (id === "farm" && buildings.farm >= buildingCaps.farm) return "Farm limit reached";
    if (id === "resource_station" && buildings.resource_station >= buildingCaps.resource_station) return "Resource station limit reached";
    if ((id === "tool_workshop" || id === "weapon_factory") && Number.isFinite(buildingCaps.workshop) && (buildings.tool_workshop + buildings.weapon_factory) >= buildingCaps.workshop) {
      return "Workshop limit reached (tools + weapons)";
    }
    if (id === "university" && Number.isFinite(buildingCaps.university) && buildings.university >= buildingCaps.university) return "University limit reached";

    const workforce = Math.floor(resources.population * BASE.workforceRatio);
    const freeWorkers = Math.max(0, workforce - (resources.buildingWorkers || 0));
    if (freeWorkers < cfg.workers) return `Not enough free workers (${freeWorkers}/${cfg.workers})`;

    const cost = cfg.buildCost || {};
    const missing = Object.entries(cost)
      .filter(([k, v]) => (resources[k] || 0) < v)
      .map(([k, v]) => `${k} ${Math.max(0, v - (resources[k] || 0))}`);
    if (missing.length) return `Not enough resources: ${missing.join(", ")}`;
    return null;
  };

  const build = (id) => {
    const cfg = (buildingsCfg && buildingsCfg[id]) || null;
    const reason = getBuildBlockReason(id);
    if (!cfg || reason) {
      if (reason) pushLog({ type: "build-blocked", turn, detail: `${id}: ${reason}` });
      return false;
    }

    setBuildings((b) => ({ ...b, [id]: (b[id] || 0) + 1 }));
    setResources((r) => {
      const costPairs = Object.entries(cfg.buildCost || {});
      const next = { ...r, buildingWorkers: (r.buildingWorkers || 0) + cfg.workers };
      costPairs.forEach(([k, v]) => {
        next[k] = (next[k] || 0) - Number(v || 0);
      });
      Object.keys(next).forEach((k) => {
        if (typeof next[k] === "number") next[k] = clamp0(next[k]);
      });
      return next;
    });

    pushLog({
      type: "build",
      turn,
      detail: `Build ${id}`,
      cost: { ...(cfg.buildCost || {}), workers: cfg.workers },
    });
    return true;
  };

  const startTech = (techId, idx = 0) => {
    if (activeTech || unlockedTechs.has(techId)) return;
    const totalCost = computeTechTotalCost(idx, resources.population);
    const needToStart = Math.ceil((totalCost / TECH.TURNS_PER_TECH) * TECH.MIN_START_FRACTION);
    if ((resources.science || 0) < needToStart) return;

    setActiveTech({ id: techId, totalCost, remainingCost: totalCost, turnsLeft: TECH.TURNS_PER_TECH });
    pushLog({ type: "tech-start", turn, detail: `Tech started ${techId}`, cost: totalCost });
  };

  const startInstitute = (instId, idx = 0) => {
    if (activeInstitute || unlockedInstitutes.has(instId)) return;
    const totalCost = computeInstituteTotalCost(idx, resources.population);
    const needToStart = Math.ceil((totalCost / TECH.TURNS_PER_TECH) * TECH.MIN_START_FRACTION);
    if ((resources.science || 0) < needToStart) return;

    setActiveInstitute({ id: instId, totalCost, remainingCost: totalCost, turnsLeft: TECH.TURNS_PER_TECH });
    pushLog({ type: "inst-start", turn, detail: `Institute started ${instId}`, cost: totalCost });
  };

  const attackState = (target) => {
    if (turn < 5) return;
    const targetCode = normalizeCode(target);
    if (!borderStates.includes(targetCode)) return;
    const warlordEntry = otherWarlords.find((w) => normalizeCode(w.state) === targetCode);
    const isNeutralTarget = !warlordEntry;
    if (!isNeutralTarget && playerCapturesRef.current >= playerCaptureLimit) {
      pushLog({ type: "attack", turn, detail: `Capture limit reached (${playerCaptureLimit}/turn)` });
      return;
    }
    const defender = warlordEntry ? Math.max(0, warlordEntry.army || 0) : Math.max(0, stateArmies[targetCode] || 0);
    const attacker = Math.max(0, resources.soldiers || 0);
    if (attacker <= 0) return;

    const statePopulation = Number(popByState.get(targetCode)?.popPoints || 0);
    const popGain = Math.floor(statePopulation * WAR.CAPTURED_POP_DIRECT_SHARE * (BASE.popGainMult || 1));
    const lockedPopGain = Math.floor(statePopulation * WAR.CAPTURED_POP_LOCKED_SHARE * (BASE.popGainMult || 1));

    if (attacker <= defender) {
      const defenderLeft = Math.max(0, defender - attacker);

      if (warlordEntry) {
        const factionId = warlordEntry.factionId || getFactionId(warlordEntry.id);
        setOtherWarlords((prev) =>
          prev.map((w) => {
            const id = w.factionId || getFactionId(w.id);
            if (id !== factionId) return w;
            return { ...w, factionId: id, army: defenderLeft };
          })
        );
      } else {
        setStateArmies((prev) => ({ ...prev, [targetCode]: defenderLeft }));
      }

      setResources((r) => ({ ...r, soldiers: 0 }));
      pushLog({ type: "attack", turn, detail: `Attack ${targetCode} fail (we:${attacker} vs def:${defender})` });
      return;
    }

    const remainingSoldiers = attacker - defender;
    const defenderLeft = 0;
    if (!isNeutralTarget) playerCapturesRef.current += 1;

    setResources((r) => ({ ...r, soldiers: remainingSoldiers, population: (r.population || 0) + popGain }));
    if (lockedPopGain > 0) setLockedPop((v) => v + lockedPopGain);

    if (warlordEntry) {
      const factionId = warlordEntry.factionId || getFactionId(warlordEntry.id);
      const nextZeroDefeats = { ...(warlordZeroDefeatsRef.current || {}) };
      if (defender > 0 && defenderLeft <= 0) nextZeroDefeats[factionId] = (nextZeroDefeats[factionId] || 0) + 1;
      const collapse = (nextZeroDefeats[factionId] || 0) >= WAR.ZERO_DEFEATS_TO_COLLAPSE;
      if (collapse) delete nextZeroDefeats[factionId];
      warlordZeroDefeatsRef.current = nextZeroDefeats;
      setWarlordZeroDefeats(nextZeroDefeats);

      if (collapse) {
        const collapsingStates = otherWarlords
          .filter((w) => (w.factionId || getFactionId(w.id)) === factionId)
          .map((w) => normalizeCode(w.state))
          .filter(Boolean);
        setOtherWarlords((prev) => prev.filter((w) => (w.factionId || getFactionId(w.id)) !== factionId));
        setStateArmies((prev) => {
          const next = { ...prev };
          collapsingStates.forEach((code) => {
            if (code && code !== targetCode) next[code] = 0;
          });
          next[targetCode] = 0;
          return next;
        });
        const collapseMessage = `${factionId} collapsed after repeated defeats; states became neutral`;
        setTurnWarnings((prev) => Array.from(new Set([collapseMessage, ...(prev || [])])).slice(0, 6));
        pushLog({ type: "ai-collapse", turn, detail: collapseMessage });
      } else {
        setOtherWarlords((prev) =>
          prev
            .filter((w) => normalizeCode(w.state) !== targetCode)
            .map((w) => {
              const id = w.factionId || getFactionId(w.id);
              if (id !== factionId) return w;
              return { ...w, factionId: id, army: defenderLeft };
            })
        );
        setStateArmies((prev) => ({ ...prev, [targetCode]: 0 }));
      }
    } else {
      setStateArmies((prev) => ({ ...prev, [targetCode]: defenderLeft }));
    }

    setOwnedStates((prev) => new Set(prev).add(targetCode));
    if (!isNeutralTarget) setPlayerCapturesThisTurn((v) => v + 1);
    pushLog({ type: "attack", turn, detail: `Attack ${targetCode} win (we:${attacker} vs def:${defender}) +${lockedPopGain} locked pop` });
  };

  const nextTurn = () => {
    setEngineError(null);

    if (isDefeated || isFinishedManually) {
      pushLog({ type: "info", turn, detail: "Game is over. Log is available." });
      return;
    }

    try {
      setRuinUsedThisTurn(false);
      setPlayerCapturesThisTurn(0);
      setTurnWarnings([]);

      const workforce = Math.floor(resources.population * BASE.workforceRatio);

      const { deltas: buildingDeltas, producesTotal, consumesTotal, ran, shortages } = computeBuildingDeltas({
        buildings,
        buildingsCfg,
        resources,
        workforce,
        modifiers,
      });
      const turnWarningsNext = [];
      if (shortages.length) {
        const uniq = new Map();
        shortages.forEach((s) => {
          const key = `${s.resource}:${s.output}`;
          if (!uniq.has(key)) uniq.set(key, s);
        });
        const warnings = Array.from(uniq.values()).slice(0, 5).map((s) => `Not enough ${s.resource}; stopped production of ${s.output}`);
        turnWarningsNext.push(...warnings);
        warnings.forEach((w) => pushLog({ type: "production-halt", turn, detail: w }));
      }

      const baseCapPer1000 = turn <= 10 ? 100 : 200;
      const capPer1000 = Math.max(baseCapPer1000, Number(modifiers.soldiersPer1000Pop || baseCapPer1000));
      const soldierLimit = getSoldierLimitForPopulation(resources.population, capPer1000);
      const weaponsAvailable = Math.max(0, resources.weapons || 0);
      const soldiersNow = Math.max(0, resources.soldiers || 0);
      const missing = Math.max(0, soldierLimit - soldiersNow);
      const recruitCap = Math.max(0, Math.floor(soldierLimit * 0.1));
      const recruit = weaponsAvailable > 0 ? Math.min(recruitCap, missing, weaponsAvailable) : 0;

      const warlordByState = new Map();
      const warlordFactions = new Map();

      otherWarlords.forEach((w) => {
        const code = normalizeCode(w.state);
        if (!code) return;
        warlordByState.set(code, w);
        const factionId = w.factionId || getFactionId(w.id);
        const army = Number.isFinite(w.army) ? w.army : WAR.DEFAULT_WARLORD_ARMY;
        const entry = warlordFactions.get(factionId) || { factionId, states: [], type: w.type, color: w.color, army };
        entry.states.push(code);
        entry.army = Math.max(entry.army ?? 0, army);
        warlordFactions.set(factionId, entry);
      });

      const nextArmies = { ...(stateArmies || {}) };

      popByState.forEach((p, code) => {
        if (ownedStates.has(code) || warlordByState.has(code)) return;
        const pop = Number(p?.popPoints || 0);
        const limit = Math.max(0, Math.floor(pop * 0.2));
        const current = Math.max(0, nextArmies[code] || 0);
        nextArmies[code] = Math.min(limit, current + 100);
      });

      let factionArmies = new Map();
      warlordFactions.forEach((faction) => {
        factionArmies.set(faction.factionId, Math.max(0, Number(faction.army || 0)));
      });

      const recruitFactionArmiesByPopulation = (warlords, armiesByFaction) => {
        const statesByFaction = new Map();
        warlords.forEach((w) => {
          const stateCode = normalizeCode(w.state);
          if (!stateCode) return;
          const factionId = w.factionId || getFactionId(w.id);
          if (!statesByFaction.has(factionId)) statesByFaction.set(factionId, new Set());
          statesByFaction.get(factionId).add(stateCode);
        });

        const recruited = new Map();
        statesByFaction.forEach((states, factionId) => {
          const current = Math.max(0, Number(armiesByFaction.get(factionId) || 0));
          let totalPopulation = 0;
          states.forEach((stateCode) => {
            totalPopulation += Number(popByState.get(stateCode)?.popPoints || 0);
          });
          const limit = Math.max(0, Math.floor(totalPopulation * (turn <= 10 ? 0.15 : 0.3)));
          const recruitCap = Math.max(0, Math.floor(limit * 0.12));
          const growthGain = Math.max(100, Math.floor(totalPopulation * 0.005));
          const aiWeaponsBudget = Math.max(50, Math.floor(totalPopulation * 0.001));
          const gain = Math.min(recruitCap, growthGain, aiWeaponsBudget);
          recruited.set(factionId, Math.min(limit, current + gain));
        });

        return recruited;
      };

      const syncWarlords = (warlords, armies) =>
        warlords.map((w) => {
          const factionId = w.factionId || getFactionId(w.id);
          const army = Math.max(0, armies.get(factionId) ?? w.army ?? WAR.DEFAULT_WARLORD_ARMY);
          return { ...w, factionId, army };
        });

      let newWarlords = otherWarlords;
      let ownedWorking = new Set(ownedStates);
      let playerSoldiersAfterCombat = soldiersNow;

      if (otherWarlords.length && turn >= 5) {
        const aiLogs = [];
        newWarlords = [...otherWarlords];
        const factionCaptures = new Map();
        const zeroDefeatsWorking = { ...(warlordZeroDefeatsRef.current || {}) };
        const collapsingFactions = new Set();
        const registerZeroDefeat = (factionId, prevArmy, nextArmy) => {
          if (!factionId) return;
          if (prevArmy > 0 && nextArmy <= 0) {
            zeroDefeatsWorking[factionId] = (zeroDefeatsWorking[factionId] || 0) + 1;
            if (zeroDefeatsWorking[factionId] >= WAR.ZERO_DEFEATS_TO_COLLAPSE) collapsingFactions.add(factionId);
          }
        };

        otherWarlords.forEach((w) => {
          const code = normalizeCode(w.state);
          if (!code) return;
          const factionId = w.factionId || getFactionId(w.id);
          const capturedCount = factionCaptures.get(factionId) || 0;
          if (capturedCount >= CAPTURES_PER_TURN) return;
          const army = Math.max(0, factionArmies.get(factionId) ?? w.army ?? WAR.DEFAULT_WARLORD_ARMY);
          if (army <= 0) return;

          const neighbors = US_NEIGHBORS[code] || [];
          const enemyWarlordTargets = neighbors.filter((n) => {
            const enemy = warlordByState.get(normalizeCode(n));
            if (!enemy) return false;
            const enemyFactionId = enemy.factionId || getFactionId(enemy.id);
            return enemyFactionId !== factionId;
          });
          const playerTargets = neighbors.filter((n) => ownedWorking.has(n));
          const neutral = neighbors.filter((n) => !ownedWorking.has(n) && !warlordByState.has(normalizeCode(n)));

          const chooseEnemyTarget = () => {
            if (!enemyWarlordTargets.length) return null;
            const ranked = enemyWarlordTargets
              .map((codeN) => {
                const enemy = warlordByState.get(normalizeCode(codeN));
                if (!enemy) return null;
                const enemyFactionId = enemy.factionId || getFactionId(enemy.id);
                const defArmy = Math.max(0, factionArmies.get(enemyFactionId) ?? enemy.army ?? WAR.DEFAULT_WARLORD_ARMY);
                return { code: codeN, defArmy };
              })
              .filter(Boolean)
              .sort((a, b) => a.defArmy - b.defArmy);
            return ranked[0] || null;
          };
          const chosenEnemy = chooseEnemyTarget();
          const enemyAttackChance = chosenEnemy
            ? (army >= chosenEnemy.defArmy ? 0.85 : army >= chosenEnemy.defArmy * 0.85 ? 0.65 : 0.45)
            : 0;

          if (chosenEnemy && Math.random() < enemyAttackChance) {
            const target = chosenEnemy.code;
            const enemy = warlordByState.get(normalizeCode(target));
            if (!enemy) return;
            const enemyFactionId = enemy.factionId || getFactionId(enemy.id);
            const def = Math.max(0, factionArmies.get(enemyFactionId) ?? enemy.army ?? WAR.DEFAULT_WARLORD_ARMY);
            const loss = Math.min(army, def);
            const armyLeft = Math.max(0, army - loss);
            const enemyLeft = Math.max(0, def - loss);
            registerZeroDefeat(factionId, army, armyLeft);
            registerZeroDefeat(enemyFactionId, def, enemyLeft);
            factionArmies.set(factionId, armyLeft);
            factionArmies.set(enemyFactionId, enemyLeft);
            if (army > def) {
              newWarlords = newWarlords.filter((x) => normalizeCode(x.state) !== normalizeCode(target));
              const captured = { id: `${factionId}-cap-${target}`, state: target, type: w.type, color: w.color, factionId, army: armyLeft };
              newWarlords.push(captured);
              warlordByState.set(normalizeCode(target), captured);
              factionCaptures.set(factionId, capturedCount + 1);
              aiLogs.push({ type: "ai-attack", turn, detail: `${w.id} captured ${target} from ${enemy.id}` });
            } else {
              aiLogs.push({ type: "ai-attack", turn, detail: `${w.id} attacked ${target} (repelled)` });
            }
            return;
          }

          if (playerTargets.length && Math.random() < 0.6) {
            const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];
            const def = Math.max(0, playerSoldiersAfterCombat);
            const loss = Math.min(army, def);
            const armyLeft = Math.max(0, army - loss);
            const playerLeft = Math.max(0, def - loss);

            registerZeroDefeat(factionId, army, armyLeft);
            factionArmies.set(factionId, armyLeft);
            playerSoldiersAfterCombat = playerLeft;

            if (army > def) {
              ownedWorking.delete(target);
              newWarlords = newWarlords.filter((x) => normalizeCode(x.state) !== normalizeCode(target));
              const captured = { id: `${factionId}-cap-${target}`, state: target, type: w.type, color: w.color, factionId, army: armyLeft };
              newWarlords.push(captured);
              warlordByState.set(normalizeCode(target), captured);
              factionCaptures.set(factionId, capturedCount + 1);
              aiLogs.push({ type: "ai-attack", turn, detail: `${w.id} captured ${target}` });
            } else {
              aiLogs.push({ type: "ai-attack", turn, detail: `${w.id} attacked ${target} (repelled)` });
            }
            return;
          }

          if (neutral.length && Math.random() < 0.7) {
            const target = neutral[Math.floor(Math.random() * neutral.length)];
            const expanded = { id: `${factionId}-exp-${target}`, state: target, type: w.type, color: w.color, factionId, army };
            warlordByState.set(normalizeCode(target), expanded);
            newWarlords.push(expanded);
            aiLogs.push({ type: "ai-expand", turn, detail: `${w.id} expanded to ${target}` });
            factionCaptures.set(factionId, capturedCount + 1);
          }
        });

        const beforeRecruit = new Map(factionArmies);
        factionArmies = recruitFactionArmiesByPopulation(newWarlords, factionArmies);

        factionArmies.forEach((val, fid) => {
          const prev = beforeRecruit.get(fid) || 0;
          const diff = val - prev;
          if (diff > 0) aiLogs.push({ type: "ai-recruit", turn, detail: `${fid} recruited +${diff}` });
        });

        newWarlords = syncWarlords(newWarlords, factionArmies);
        if (collapsingFactions.size > 0) {
          const collapsedStates = [];
          newWarlords.forEach((w) => {
            const factionId = w.factionId || getFactionId(w.id);
            if (collapsingFactions.has(factionId)) collapsedStates.push(normalizeCode(w.state));
          });
          newWarlords = newWarlords.filter((w) => !collapsingFactions.has(w.factionId || getFactionId(w.id)));
          collapsedStates.forEach((code) => {
            if (code) nextArmies[code] = 0;
          });
          collapsingFactions.forEach((factionId) => {
            delete zeroDefeatsWorking[factionId];
            const collapseMessage = `${factionId} collapsed after repeated defeats; states became neutral`;
            aiLogs.push({ type: "ai-collapse", turn, detail: collapseMessage });
            turnWarningsNext.push(collapseMessage);
          });
        }
        warlordZeroDefeatsRef.current = zeroDefeatsWorking;
        setWarlordZeroDefeats(zeroDefeatsWorking);
        setOtherWarlords(newWarlords);
        setOwnedStates(ownedWorking);

        aiLogs.forEach((e) => pushLog(e));

        const defeatedNow = !ownedWorking.size || (playerStateCode && !ownedWorking.has(playerStateCode));
        if (defeatedNow) {
          setIsDefeated(true);
          pushLog({ type: "defeat", turn, detail: "Player defeated" });
        }
      } else if (otherWarlords.length) {
        const beforeRecruit = new Map(factionArmies);
        factionArmies = recruitFactionArmiesByPopulation(otherWarlords, factionArmies);
        factionArmies.forEach((val, fid) => {
          const prev = beforeRecruit.get(fid) || 0;
          const diff = val - prev;
          if (diff > 0) pushLog({ type: "ai-recruit", turn, detail: `${fid} recruited +${diff}` });
        });
        newWarlords = syncWarlords(otherWarlords, factionArmies);
        setOtherWarlords(newWarlords);
      }
      setTurnWarnings(Array.from(new Set(turnWarningsNext)).slice(0, 6));

      newWarlords.forEach((w) => {
        const code = normalizeCode(w.state);
        if (code) nextArmies[code] = Math.max(0, w.army || 0);
      });

      setStateArmies(nextArmies);

      const availableScienceBeforeSpend = Math.max(0, (resources.science || 0) + (buildingDeltas.science || 0));
      const techProgress = progressWork({ active: activeTech, availableScience: availableScienceBeforeSpend });
      const instituteProgress = progressWork({ active: activeInstitute, availableScience: Math.max(0, availableScienceBeforeSpend - techProgress.spend) });

      const prevResources = resources;
      const foodNeed = (prevResources.population || 0) * BASE.popConsumptionFood * (modifiers.foodConsumptionMult || 1);
      const fromBuildings = {
        food: buildingDeltas.food || 0,
        resources: buildingDeltas.resources || 0,
        tools: buildingDeltas.tools || 0,
        weapons: buildingDeltas.weapons || 0,
        science: buildingDeltas.science || 0,
      };
      const rawFood = (prevResources.food || 0) + fromBuildings.food - foodNeed;
      let food = clamp0(rawFood);
      let resourcesVal = clamp0((prevResources.resources || 0) + fromBuildings.resources);
      let toolsVal = clamp0((prevResources.tools || 0) + fromBuildings.tools);
      let weaponsVal = clamp0((prevResources.weapons || 0) + fromBuildings.weapons - recruit);
      let scienceVal = clamp0((prevResources.science || 0) + fromBuildings.science - techProgress.spend - instituteProgress.spend);
      let population = Math.max(0, prevResources.population || 0);
      let famineLoss = 0;

      if (rawFood < 0) {
        const deficit = Math.abs(rawFood);
        const minPop = Math.floor(initialPopRef.current * 0.25);
        let loss = Math.ceil(deficit / Math.max(0.000001, BASE.popConsumptionFood));
        loss = Math.min(loss, Math.floor(population * 0.05));
        population = Math.max(minPop, population - loss);
        famineLoss = Math.max(0, loss);
        food = 0;
      } else {
        population = population + Math.floor(population * BASE.popGrowthRate * (BASE.popGainMult || 1));
      }

      let soldiers = Math.max(0, playerSoldiersAfterCombat);
      soldiers = Math.min(soldierLimit, soldiers + recruit);

      const nextResources = {
        ...prevResources,
        population,
        food,
        resources: resourcesVal,
        tools: toolsVal,
        weapons: weaponsVal,
        science: scienceVal,
        soldiers,
        buildingWorkers: Math.min(prevResources.buildingWorkers || 0, Math.max(0, workforce)),
      };
      const deltaSnapshot = {
        food: nextResources.food - (prevResources.food || 0),
        resources: nextResources.resources - (prevResources.resources || 0),
        tools: nextResources.tools - (prevResources.tools || 0),
        weapons: nextResources.weapons - (prevResources.weapons || 0),
        science: nextResources.science - (prevResources.science || 0),
        soldiers: nextResources.soldiers - (prevResources.soldiers || 0),
        population: nextResources.population - (prevResources.population || 0),
      };

      setResources(nextResources);
      if (famineLoss > 0) {
        pushLog({ type: "famine", turn, detail: `Lost ${famineLoss} pop to starvation` });
      }

      setTurnDelta({
        food: Math.floor(deltaSnapshot.food || 0),
        resources: Math.floor(deltaSnapshot.resources || 0),
        tools: Math.floor(deltaSnapshot.tools || 0),
        weapons: Math.floor(deltaSnapshot.weapons || 0),
        science: Math.floor(deltaSnapshot.science || 0),
        soldiers: Math.floor(deltaSnapshot.soldiers || 0),
      });

      if (activeTech) {
        if (techProgress.done) {
          setUnlockedTechs((prev) => new Set(prev).add(activeTech.id));
          setActiveTech(null);
          pushLog({ type: "tech-done", turn, detail: `Tech finished ${activeTech.id}` });
        } else {
          setActiveTech(techProgress.next);
          pushLog({ type: "tech-progress", turn, detail: `Tech ${activeTech.id} -${Math.floor(techProgress.spend)} sci` });
        }
      }

      if (activeInstitute) {
        if (instituteProgress.done) {
          setUnlockedInstitutes((prev) => new Set(prev).add(activeInstitute.id));
          setActiveInstitute(null);
          pushLog({ type: "inst-done", turn, detail: `Institute finished ${activeInstitute.id}` });
        } else {
          setActiveInstitute(instituteProgress.next);
          pushLog({ type: "inst-progress", turn, detail: `Institute ${activeInstitute.id} -${Math.floor(instituteProgress.spend)} sci` });
        }
      }

      pushLog({
        type: "turn-summary",
        turn,
        detail: `Delta food ${Math.floor(deltaSnapshot.food || 0)} res ${Math.floor(deltaSnapshot.resources || 0)} tools ${Math.floor(deltaSnapshot.tools || 0)} weap ${Math.floor(deltaSnapshot.weapons || 0)} sci ${Math.floor(deltaSnapshot.science || 0)} sold ${Math.floor(deltaSnapshot.soldiers || 0)} pop ${Math.floor(deltaSnapshot.population || 0)}`,
        delta: deltaSnapshot,
        buildings: { ran, produces: producesTotal, consumes: consumesTotal },
      });

      setTurn((t0) => t0 + 1);
      setEngineError(null);
      playerCapturesRef.current = 0;
    } catch (e) {
      console.error("Engine error:", e);
      setEngineError(e?.message || String(e));
      pushLog({ type: "error", turn, detail: String(e?.message || e) });
    }
  };

  return {
    state: {
      turn,
      targetState,
      svgMarkup,
      usaProvinces,
      ownedStates,
      otherWarlords,
      resources,
      buildings,
      buildingCaps,
      buildingsCfg,
      lockedPop,
      ruinsLeft,
      ruinPopulationCapPerTurn,
      canExploreRuin: !ruinUsedThisTurn && lockedPop > 0 && ruinPopulationCapPerTurn > 0,
      buildBlockReasons: Object.keys(buildings || {})
        .filter((id) => id !== "ruin")
        .reduce((acc, id) => {
          const reason = getBuildBlockReason(id);
          if (reason) acc[id] = reason;
          return acc;
        }, {}),
      playerCaptureLimit,
      militaryCaptureBonus,
      playerCapturesLeft: Math.max(0, playerCaptureLimit - playerCapturesThisTurn),
      turnWarnings,
      workforce: Math.floor(resources.population * BASE.workforceRatio),
      freeWorkers: Math.max(0, Math.floor(resources.population * BASE.workforceRatio) - (resources.buildingWorkers || 0)),
      turnDelta,
      activeTech,
      activeInstitute,
      unlockedTechs,
      unlockedInstitutes,
      techTrees,
      socialTrees,
      modifiers,
      derived,
      popByState,
      borderStates,
      selectedStateLimits,
      stateArmies,
      log,
      fullLog,
      engineError,
      isDefeated,
      isFinishedManually,
      isVictory,
    },
    actions: {
      setTargetState,
      nextTurn,
      build,
      startTech,
      startInstitute,
      attackState,
      finishGame: () => {
        setIsFinishedManually(true);
        pushLog({ type: "info", turn, detail: "Game finished by player" });
      },
      exploreRuin: () => {
        if (lockedPop <= 0) return;
        if (ruinUsedThisTurn) return;
        const chunk = Math.max(0, Math.min(lockedPop, ruinPopulationCapPerTurn));
        if (chunk <= 0) return;
        const popGain = Math.max(1, Math.floor(chunk * (BASE.popGainMult || 1)));
        const resourceGain = Math.max(1, Math.floor((popGain * 500) / 30000));
        const toolsGain = Math.max(1, Math.floor((popGain * 500) / 30000));

        setResources((r) => ({
          ...r,
          population: (r.population || 0) + popGain,
          resources: (r.resources || 0) + resourceGain,
          tools: (r.tools || 0) + toolsGain,
        }));

        setLockedPop((v) => Math.max(0, v - chunk));
        setRuinUsedThisTurn(true);

        pushLog({ type: "ruin", turn, detail: `Explore ruin (+${popGain} pop, +${resourceGain} resources, +${toolsGain} tools)` });
      },
      getSaveData: () => ({
        turn,
        targetState,
        ownedStates: Array.from(ownedStates || []),
        otherWarlords,
        resources,
        buildings,
        buildingCaps,
        lockedPop,
        turnDelta,
        activeTech,
        activeInstitute,
        unlockedTechs: Array.from(unlockedTechs || []),
        unlockedInstitutes: Array.from(unlockedInstitutes || []),
        stateArmies,
        log: (log || []).slice(-ENGINE.MAX_LOG),
        fullLog: (fullLog || []).slice(-400),
        isDefeated,
        isFinishedManually,
        turnWarnings,
        playerCapturesThisTurn,
        ruinUsedThisTurn,
        warlordZeroDefeats: warlordZeroDefeatsRef.current,
      }),
    },
    palette: COLORS.PALETTE,
  };
}






