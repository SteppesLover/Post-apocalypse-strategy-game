import { getSoldierLimitForPopulation } from "../engine/stateLimits";

export function computeDerived(state, modifiers) {
  const pop = Math.max(0, Math.floor(state?.resources?.population || 0));
  const baseCapPer1000 = (state?.turn || 1) <= 10 ? 100 : 200;
  const capPer1000 = Math.max(baseCapPer1000, Number(modifiers?.soldiersPer1000Pop || baseCapPer1000));

  return {
    soldierLimit: getSoldierLimitForPopulation(pop, capPer1000),
  };
}

