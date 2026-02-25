import React from "react";
import { TECH } from "../game/engine/constants";

const LABELS = {
  food_output_mult: "Food output",
  resource_output_mult: "Resource output",
  tool_output_mult: "Tool output",
  weapon_output_mult: "Weapon output",
  food_consumption_mult: "Food consumption",
  soldiers_cap_per_1000: "Soldier cap / 1000 pop",
  farm_limit_bonus: "Farm limit bonus",
  actions_military_bonus: "Capture limit bonus",
};

const DESCRIPTIONS = {
  warbands: "Organize irregular fighters into coordinated warbands.",
  squad_organization: "Create stable squads with clearer command chains.",
  command_structure: "Introduce disciplined command hierarchy.",
  national_mobilization: "Mobilize the full state for large-scale war.",
  foraging_hunting: "Standardize hunting and gathering for food stability.",
  primitive_farming: "Shift from scavenging to organized farming.",
  crop_rotation: "Rotate fields to raise yields sustainably.",
  irrigation: "Build water systems to secure food output.",
  scavenging: "Improve salvage efficiency in ruined infrastructure.",
  basic_tools: "Mass-produce simple tools for worker productivity.",
  standardized_parts: "Unify production parts to reduce losses.",
  weapon_factories: "Scale weapon production through industrial lines.",
};

const formatTitle = (id) => String(id || "").split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

const classifyEffect = (key, value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "neutral";
  if (key.includes("consumption_mult")) return num < 1 ? "pos" : num > 1 ? "neg" : "neutral";
  if (key.includes("_mult")) return num > 1 ? "pos" : num < 1 ? "neg" : "neutral";
  if (key.includes("bonus") || key.includes("cap") || key.includes("soldiers")) return num > 0 ? "pos" : num < 0 ? "neg" : "neutral";
  return num > 0 ? "pos" : num < 0 ? "neg" : "neutral";
};

const fmtValue = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (Math.abs(n) >= 100 || Number.isInteger(n)) return String(Math.round(n));
  return n.toFixed(2).replace(/\.00$/, "");
};

export function WarlordTech({
  t,
  techTrees,
  socialTrees,
  activeTech,
  unlockedTechs,
  startTech,
  activeInstitute,
  unlockedInstitutes,
  startInstitute,
  warlordType,
  resources,
}) {
  const reqMet = (req, unlockedSet) => !req || (Array.isArray(req) ? req.every((r) => unlockedSet?.has?.(r)) : unlockedSet?.has?.(req));
  const techCost = (idx) => {
    const baseCost = Math.max(0, 350 * (idx + 1));
    const pop = Math.max(0, Number(resources?.population || 0));
    const popScale = 1 + Math.sqrt(pop / TECH.POP_COST_SCALE_BASE);
    return Math.max(1, Math.ceil(baseCost * popScale));
  };
  const instituteCost = (idx) => {
    const baseCost = Math.max(0, 200 * (idx + 1));
    const pop = Math.max(0, Number(resources?.population || 0));
    const popScale = 1 + Math.sqrt(pop / (TECH.POP_COST_SCALE_BASE * 1.4));
    return Math.max(1, Math.ceil(baseCost * popScale));
  };

  const renderEffects = (effects) => {
    if (!effects || typeof effects !== "object") return null;
    return Object.entries(effects).map(([k, v]) => {
      const cls = classifyEffect(k, v);
      return (
        <div key={k} className={`list-meta effect-${cls}`}>
          {LABELS[k] || formatTitle(k)}: {fmtValue(v)}
        </div>
      );
    });
  };

  return (
    <div className="card">
      <h2>{t.tabs.tech}</h2>
      <div className="row">
        {["military", "industry", "agriculture"].map((key) => {
          const tree = techTrees[key];
          return (
            <div key={key} className="card panel">
              <h3>{key}</h3>
              {!tree?.technologies ? (
                <div className="badge">{t.loading || "Loading..."}</div>
              ) : (
                <div className="list">
                  {tree.technologies.map((tech, idx) => {
                    const cost = techCost(idx);
                    const isActive = activeTech?.id === tech.id;
                    const isDone = unlockedTechs?.has?.(tech.id);
                    const canStart = reqMet(tech.requires, unlockedTechs);
                    return (
                      <div key={tech.id} className="list-row">
                        <div className="list-main">
                          <div className="list-title">{formatTitle(tech.id)}</div>
                          <div className="list-meta">{DESCRIPTIONS[tech.id] || "Improves this strategic direction."}</div>
                          <div className="list-meta">
                            {tech.requires ? `${t.requires || "Requires"}: ${tech.requires.map(formatTitle).join(", ")}` : t.base || "Base"}
                          </div>
                          <div className="list-meta">{t.effects || "Effects"}:</div>
                          {renderEffects(tech.effects)}
                        </div>
                        <button
                          className={`secondary ${isActive ? "active" : ""}`}
                          onClick={() => startTech?.(tech.id, idx)}
                          disabled={isActive || isDone || !canStart}
                        >
                          {isDone ? (t.unlocked || "Unlocked") : isActive ? `${t.inProgress || "In progress"} (${activeTech?.turnsLeft || 0})` : `${t.research || "Research"} (${cost} sci)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card panel">
        <h3>{t.warlordType || "Warlord type"}: {warlordType || "-"}</h3>
        {!socialTrees?.socialInstitutions ? (
          <div className="badge">{t.loading || "Loading..."}</div>
        ) : (
          <div className="row">
            {(() => {
              const inst = socialTrees.socialInstitutions?.[warlordType] || {};
              const branches = inst.exclusiveBranches || [];
              if (!branches.length) return <div className="badge">{t.noneActive || "No institutes for this type"}</div>;
              const findBranchId = (nodeId) =>
                branches.find((branch) => (branch.nodes || []).some((node) => node.id === nodeId))?.branchId || null;
              const selectedBranchId = (() => {
                if (activeInstitute?.id) {
                  const activeBranch = findBranchId(activeInstitute.id);
                  if (activeBranch) return activeBranch;
                }
                for (const id of unlockedInstitutes || []) {
                  const branchId = findBranchId(id);
                  if (branchId) return branchId;
                }
                return null;
              })();
              return branches.map((branch) => (
                <div key={branch.branchId} className="card panel">
                  <h4>{formatTitle(branch.branchId)}</h4>
                  <div className="list">
                    {(branch.nodes || []).map((node, idx) => {
                      const cost = instituteCost(idx);
                      const isActive = activeInstitute?.id === node.id;
                      const isDone = unlockedInstitutes?.has?.(node.id);
                      const lockedOut = selectedBranchId && branch.branchId !== selectedBranchId;
                      const canStart = reqMet(node.requires, unlockedInstitutes) && !lockedOut;
                      return (
                        <div key={node.id} className="list-row">
                          <div className="list-main">
                            <div className="list-title">{formatTitle(node.id)}</div>
                            <div className="list-meta">{DESCRIPTIONS[node.id] || "Builds a distinct political doctrine."}</div>
                            <div className="list-meta">
                              {node.requires ? `${t.requires || "Requires"}: ${node.requires.map(formatTitle).join(", ")}` : t.base || "Base"}
                            </div>
                            <div className="list-meta">{t.effects || "Effects"}:</div>
                            {renderEffects(node.effects)}
                          </div>
                          <button
                            className={`secondary ${isActive ? "active" : ""}`}
                            onClick={() => startInstitute?.(node.id, idx)}
                            disabled={isActive || isDone || !canStart}
                          >
                            {isDone
                              ? (t.unlocked || "Unlocked")
                              : isActive
                                ? `${t.inProgress || "In progress"} (${activeInstitute?.turnsLeft || 0})`
                                : `${t.research || "Research"} (${cost} sci)`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
