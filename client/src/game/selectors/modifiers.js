export function computeModifiers(unlockedTechIds = new Set(), techTrees = {}, unlockedInstituteIds = new Set(), institutesIndex = new Map()) {
  const techIds = new Set(unlockedTechIds);
  const instituteIds = new Set(unlockedInstituteIds);

  const modifiers = {
    soldiersPer1000Pop: 200,
    multFood: 1,
    foodOutputMult: 1,
    toolOutputMult: 1,
    weaponOutputMult: 1,
    resourceOutputMult: 1,
    resourceEfficiency: 1,
    foodConsumptionMult: 1,
    militaryActionsBonus: 0,
  };

  for (const tree of Object.values(techTrees || {})) {
    if (!tree?.technologies) continue;
    for (const tech of tree.technologies) {
      if (!techIds.has(tech.id)) continue;
      const eff = tech.effects || {};
      if (typeof eff.soldiers_per_1000_pop === "number") {
        modifiers.soldiersPer1000Pop = Math.max(modifiers.soldiersPer1000Pop, eff.soldiers_per_1000_pop);
      }
      if (typeof eff.actions_military_bonus === "number") {
        modifiers.militaryActionsBonus += eff.actions_military_bonus;
      }
      if (typeof eff.food_output_mult === "number") modifiers.foodOutputMult *= eff.food_output_mult;
      if (typeof eff.tool_output_mult === "number") modifiers.toolOutputMult *= eff.tool_output_mult;
      if (typeof eff.weapon_output_mult === "number") modifiers.weaponOutputMult *= eff.weapon_output_mult;
      if (typeof eff.resource_output_mult === "number") modifiers.resourceOutputMult *= eff.resource_output_mult;
      if (typeof eff.resource_efficiency === "number") modifiers.resourceEfficiency *= eff.resource_efficiency;
      if (typeof eff.food_consumption_mult === "number") modifiers.foodConsumptionMult *= eff.food_consumption_mult;
      if (typeof eff.soldiers_cap_per_1000 === "number") modifiers.soldiersPer1000Pop = Math.max(modifiers.soldiersPer1000Pop, eff.soldiers_cap_per_1000);
    }
  }

  instituteIds.forEach((id) => {
    const node = institutesIndex.get(id);
    if (!node?.effects) return;
    if (typeof node.effects.food === "number") modifiers.multFood += node.effects.food;
    if (typeof node.effects.food_output_mult === "number") modifiers.foodOutputMult *= node.effects.food_output_mult;
    if (typeof node.effects.tool_output_mult === "number") modifiers.toolOutputMult *= node.effects.tool_output_mult;
    if (typeof node.effects.weapon_output_mult === "number") modifiers.weaponOutputMult *= node.effects.weapon_output_mult;
    if (typeof node.effects.resource_output_mult === "number") modifiers.resourceOutputMult *= node.effects.resource_output_mult;
    if (typeof node.effects.food_consumption_mult === "number") modifiers.foodConsumptionMult *= node.effects.food_consumption_mult;
    if (typeof node.effects.soldiers_cap_per_1000 === "number") modifiers.soldiersPer1000Pop = Math.max(modifiers.soldiersPer1000Pop, node.effects.soldiers_cap_per_1000);
  });

  return modifiers;
}
