import React from "react";

export function WarlordStats({ t, resources, derived, freeWorkers, buildings, buildingCaps, buildingsCfg, buildBlockReasons = {}, onBuild, deltas, lockedPop, ruinsLeft, canExploreRuin, onExploreRuin }) {
  const delta = deltas || {};

  const fmtDelta = (v = 0) => (v >= 0 ? `+${v}` : `${v}`);

  const capFor = (id) => {
    if (id === "farm") return buildingCaps.farm;
    if (id === "resource_station") return buildingCaps.resource_station;
    if (id === "tool_workshop" || id === "weapon_factory") return buildingCaps.workshop;
    if (id === "university") return buildingCaps.university;
    return "Infinity";
  };

  return (
    <div className="card">
      <h2>{t.tabs.stats}</h2>

      <div className="row">
        <div className="card panel">
          <h3>{t.resources.population}</h3>
          <div className="big-number">{Math.floor(resources.population)}</div>
          <div className="small">{t.freeWorkers || "Free workers"}: {freeWorkers}</div>
          {typeof lockedPop === "number" && (
            <div className="small">{t.lockedPop || "Locked population"}: {lockedPop}</div>
          )}
          {typeof ruinsLeft === "number" && ruinsLeft > 0 && (
            <button className="secondary" onClick={onExploreRuin} disabled={!canExploreRuin || ruinsLeft <= 0}>
              {t.exploreRuin || "Explore ruin"} ({t.left || "left"}: {ruinsLeft})
            </button>
          )}
        </div>
        <div className="card panel">
          <h3>{t.resources.food}</h3>
          <div className={`big-number ${(delta.food || 0) >= 0 ? "pos" : "neg"}`}>
            {Math.floor(resources.food)} ({fmtDelta(delta.food || 0)})
          </div>
        </div>
        <div className="card panel">
          <h3>{t.resources.soldiers}</h3>
          <div className="big-number">
            {Math.floor(resources.soldiers)} / {derived.soldierLimit}
          </div>
        </div>
        <div className="card panel">
          <h3>{t.resources?.other || "Resources"}</h3>
          <div className="small">
            <div>{t.resources?.resources || "Resources"}: {resources.resources} ({fmtDelta(delta.resources || 0)})</div>
            <div>{t.resources?.tools || "Tools"}: {resources.tools} ({fmtDelta(delta.tools || 0)})</div>
            <div>{t.resources?.weapons || "Weapons"}: {resources.weapons} ({fmtDelta(delta.weapons || 0)})</div>
            <div>{t.resources?.science || "Science"}: {resources.science} ({fmtDelta(delta.science || 0)})</div>
          </div>
        </div>
        <div className="card panel">
          <h3>{t.buildingLimits || "Building limits"}</h3>
          <div className="small">
            <div>Farm: {Number.isFinite(buildingCaps?.farm) ? buildingCaps.farm : "Infinity"}</div>
            <div>Resource: {Number.isFinite(buildingCaps?.resource_station) ? buildingCaps.resource_station : "Infinity"}</div>
            <div>Workshop (tools+weapons): {Number.isFinite(buildingCaps?.workshop) ? buildingCaps.workshop : "Infinity"}</div>
            <div>University: {Number.isFinite(buildingCaps?.university) ? buildingCaps.university : "Infinity"}</div>
          </div>
        </div>
      </div>

      <div className="card panel">
        <h3>{t.buildingsLabel || "Buildings"}</h3>
        {Object.keys(buildings)
          .filter((id) => id !== "ruin")
          .map((id) => {
            const cfg = buildingsCfg?.[id] || {};
            const cap = capFor(id);
            const prod = Object.entries(cfg.produces || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
            const cons = Object.entries(cfg.consumes || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
            const cost = Object.entries(cfg.buildCost || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
            const blockReason = buildBlockReasons?.[id] || null;
            const disabled = Boolean(blockReason) || !onBuild;
            return (
              <div key={id} className="list-row building-row">
                <div className="building-header">
                  <div className="building-title">
                    <strong>{id}</strong> ({buildings[id]}/{cap})
                  </div>
                  {cost && <div className="building-cost">{t.cost || "Cost"}: {cost}</div>}
                  {prod && <div className="building-prod">{t.prod || "Prod"}: {prod}</div>}
                  {cons && <div className="building-cons">{t.cons || "Cons"}: {cons}</div>}
                </div>
                <div className="building-actions">
                  <button className="secondary" onClick={() => onBuild(id)} disabled={disabled}>
                    {(t.build || "Build") + (cost ? ` (${cost})` : "")}
                  </button>
                  {blockReason && <div className="small neg">{blockReason}</div>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
