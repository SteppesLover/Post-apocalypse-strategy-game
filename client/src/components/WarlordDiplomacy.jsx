import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { US_NEIGHBORS } from "../usNeighbors";
import { getStateCodeFromElement } from "../utils/mapUtils";
import { getSoldierLimitForPopulation, getStateBuildingLimits } from "../game/engine/stateLimits";

const STATE_CLASSES = [
  "state-owned",
  "state-ai",
  "state-neutral",
  "state-target",
  "state-border",
];
const COLOR_CLASS_PREFIX = "state-color-";
const normalizeCode = (code) => String(code || "").toUpperCase();

export function WarlordDiplomacy({
  t,
  svgMarkup,
  borderStates = [],
  targetState,
  selectedStateLimits = null,
  onSelectState,
  stateArmies = {},
  popByState = new Map(),
  soldiersCapPer1000 = 200,
  ownedStates = new Set(),
  otherWarlords = [],
  playerColor,
  resources = {},
  turn = 1,
  onAttack,
  log = [],
}) {
  const mapRef = useRef(null);
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const initialSvgRef = useRef("");
  const [svgReady, setSvgReady] = useState(false);

  const warlordByState = useMemo(() => {
    const m = new Map();
    otherWarlords.forEach((w) => {
      const code = normalizeCode(w.state);
      if (code) m.set(code, w);
    });
    return m;
  }, [otherWarlords]);
  const ownedSet = useMemo(() => new Set(Array.from(ownedStates || []).map(normalizeCode)), [ownedStates]);
  const getArmyForState = useMemo(
    () => (code) => {
      const upper = normalizeCode(code);
      if (!upper) return 0;
      const warlord = warlordByState.get(upper);
      if (warlord) return Math.max(0, Number(warlord.army || 0));
      if (ownedSet.has(upper)) return Math.max(0, Number(resources.soldiers || 0));
      return Math.max(0, Number(stateArmies[upper] || 0));
    },
    [warlordByState, ownedSet, resources.soldiers, stateArmies]
  );

  const targetInfo = useMemo(() => {
    const soldiers = targetState ? getArmyForState(targetState) : 0;
    const isBorder = targetState ? borderStates.includes(normalizeCode(targetState)) : false;
    return { soldiers, isBorder };
  }, [targetState, borderStates, getArmyForState]);

  const canAttack = targetState && targetInfo.isBorder && onAttack && turn >= 5;
  const getStateLimits = (code) => {
    const stateMeta = popByState.get(normalizeCode(code));
    const pop = Number(stateMeta?.popPoints || 0);
    const limits = getStateBuildingLimits(code, stateMeta || {});
    const soldierLimit = getSoldierLimitForPopulation(pop, soldiersCapPer1000 || 0);
    return {
      ...limits,
      soldierLimit,
    };
  };
  const svgInnerHtml = useMemo(() => (svgReady ? { __html: initialSvgRef.current } : undefined), [svgReady]);

  useEffect(() => {
    if (initialSvgRef.current || !svgMarkup) return;
    initialSvgRef.current = svgMarkup;
    setSvgReady(true);
  }, [svgMarkup]);

  useLayoutEffect(() => {
    const rootEl = mapRef.current;
    if (!rootEl) return;

    const paint = (svgEl) => {
      const shapeSelector = "path";
      const shapeTags = new Set(["path"]);
      const normalizeCode = (code) => String(code || "").toUpperCase();

      const queryCodeEls = (code) => {
        const upper = normalizeCode(code);
        const lower = upper.toLowerCase();
        const selectors = [
          `[id="${upper}"]`,
          `[id="${lower}"]`,
          `[data-id="${upper}"]`,
          `[data-id="${lower}"]`,
          `.${upper}`,
          `.${lower}`,
          `[class~="${upper}"]`,
          `[class~="${lower}"]`,
        ];
        const result = new Set();
        selectors.forEach((sel) => {
          try {
            svgEl.querySelectorAll(sel).forEach((el) => {
              const tag = String(el.tagName || "").toLowerCase();
              if (tag === "g") {
                el.querySelectorAll(shapeSelector).forEach((child) => result.add(child));
              } else if (shapeTags.has(tag)) {
                result.add(el);
              }
            });
          } catch {}
        });
        return Array.from(result);
      };

      const clearStateClasses = (el) => {
        STATE_CLASSES.forEach((cls) => el.classList.remove(cls));
        Array.from(el.classList).forEach((cls) => {
          if (cls.startsWith(COLOR_CLASS_PREFIX)) el.classList.remove(cls);
        });
      };

      const normalizeColor = (value) => {
        if (!value) return null;
        const trimmed = String(value).trim();
        return trimmed ? trimmed : null;
      };
      const colorKey = (value) => {
        const normalized = normalizeColor(value);
        return normalized ? normalized.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : null;
      };
      const colorByKey = new Map();
      const addColor = (value) => {
        const normalized = normalizeColor(value);
        const key = colorKey(normalized);
        if (key && !colorByKey.has(key)) colorByKey.set(key, normalized);
        return key;
      };

      const playerColorKey = addColor(playerColor);
      const warlordColorByState = new Map();
      warlordByState.forEach((w, code) => {
        const key = addColor(w?.color || "#6aa6ff");
        if (key) warlordColorByState.set(normalizeCode(code), key);
      });

      const ensureColorStyles = () => {
        const doc = svgEl.ownerDocument;
        let styleEl = doc.querySelector('style[data-map-colors="true"]');
        if (!styleEl) {
          styleEl = doc.createElement("style");
          styleEl.setAttribute("data-map-colors", "true");
          doc.head.appendChild(styleEl);
        }
        const rules = [];
        colorByKey.forEach((color, key) => {
          rules.push(`.map-svg svg .state-owned.${COLOR_CLASS_PREFIX}${key} { fill: ${color} !important; }`);
          rules.push(`.map-svg svg .state-ai.${COLOR_CLASS_PREFIX}${key} { fill: ${color} !important; }`);
        });
        styleEl.textContent = rules.join("\n");
      };

      ensureColorStyles();

      const allShapes = Array.from(svgEl.querySelectorAll(shapeSelector));
      const codeMap = new Map();
      const codedShapes = [];
      allShapes.forEach((el) => {
        const code = getStateCodeFromElement(el);
        if (!code) return;
        const upper = normalizeCode(code);
        codedShapes.push(el);
        if (!codeMap.has(upper)) codeMap.set(upper, []);
        codeMap.get(upper).push(el);
      });

      const getElsForCode = (code) => {
        const upper = normalizeCode(code);
        return codeMap.get(upper) || queryCodeEls(upper);
      };

      codedShapes.forEach((el) => {
        clearStateClasses(el);
        el.classList.add("state-neutral");
      });

      const ownedSet = new Set(Array.from(ownedStates || []).map(normalizeCode));
      ownedSet.forEach((code) => {
        const els = getElsForCode(code);
        els.forEach((el) => {
          el.classList.remove("state-neutral");
          el.classList.add("state-owned");
          if (playerColorKey) el.classList.add(`${COLOR_CLASS_PREFIX}${playerColorKey}`);
        });
      });

      warlordByState.forEach((w, code) => {
        const els = getElsForCode(code);
        const key = warlordColorByState.get(normalizeCode(code));
        els.forEach((el) => {
          el.classList.remove("state-neutral");
          el.classList.add("state-ai");
          if (key) el.classList.add(`${COLOR_CLASS_PREFIX}${key}`);
        });
      });

      const neighborSet = new Set();
      const source = targetState && ownedSet.has(normalizeCode(targetState)) ? [normalizeCode(targetState)] : Array.from(ownedSet);
      source.forEach((s) => (US_NEIGHBORS[s] || []).forEach((n) => neighborSet.add(n)));
      neighborSet.forEach((n) => {
        getElsForCode(n).forEach((el) => el.classList.add("state-border"));
      });

      if (targetState) {
        const targetCode = normalizeCode(targetState);
        getElsForCode(targetCode).forEach((el) => {
          el.classList.remove("state-neutral");
          el.classList.add("state-target");
        });
      }
    };

    const svgEl = rootEl.querySelector("svg");
    if (!svgEl) {
      const observer = new MutationObserver(() => {
        const nextSvg = rootEl.querySelector("svg");
        if (nextSvg) {
          observer.disconnect();
          paint(nextSvg);
        }
      });
      observer.observe(rootEl, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    paint(svgEl);
  }, [ownedStates, otherWarlords, targetState, playerColor]);

  const legend = (
    <div className="card subtle">
      <div className="legend-title">{t.diploLegend || "Legend"}</div>
      <ul className="legend-list">
        <li>{t.you || "You"}: <span className="badge">fill</span></li>
        <li>{t.border || "Neighbors"}: <span className="badge outline">orange</span></li>
      </ul>
    </div>
  );

  const handleMouseMove = (e) => {
    const wrapperEl = wrapperRef.current;
    const tooltipEl = tooltipRef.current;
    if (!wrapperEl || !tooltipEl) return;
    const code = getStateCodeFromElement(e.target);
    if (!code) {
      tooltipEl.style.display = "none";
      return;
    }
    const soldiers = getArmyForState(code);
    const limits = getStateLimits(code);
    tooltipEl.textContent = `${code} - army ${soldiers}, cap ${limits.soldierLimit}, farm ${limits.farm}, res ${limits.resource_station}, ws ${limits.workshop}, uni ${limits.university}`;
    const rect = wrapperEl.getBoundingClientRect();
    tooltipEl.style.left = `${e.clientX - rect.left + 12}px`;
    tooltipEl.style.top = `${e.clientY - rect.top + 12}px`;
    tooltipEl.style.display = "block";
  };

  const handleMouseLeave = () => {
    const tooltipEl = tooltipRef.current;
    if (tooltipEl) tooltipEl.style.display = "none";
  };

  return (
    <div className="card">
      <h2>{t.tabs.diplomacy}</h2>

      <div className="row gap">
        {legend}

        <div className="card grow">
          <div className="row">
            <div className="field">
              <label>{t.target || "Target"}</label>
              <div className="static-field">{targetState || "-"}</div>
            </div>
            <div className="field">
              <label>{t.borderStates || "Borders"}</label>
              <div className="small">{borderStates.join(", ") || "-"}</div>
            </div>
            <div className="field">
              <label>{t.resources?.soldiers || "Soldiers"}</label>
              <div className="small">{targetInfo.soldiers}</div>
            </div>
            <div className="field">
              <label>{t.buildingsLabel || "Buildings"}</label>
              <div className="small">
                {selectedStateLimits
                  ? `Farm ${selectedStateLimits.farm}, Resource ${selectedStateLimits.resource_station}, Workshop ${selectedStateLimits.workshop}, University ${selectedStateLimits.university}, Soldier cap ${selectedStateLimits.soldierLimit}`
                  : "-"}
              </div>
            </div>
          </div>

          <div className="row">
            <button
              className="primary"
              disabled={!canAttack}
              onClick={() => canAttack && onAttack(targetState)}
            >
              {t.attack || "Attack"}
            </button>
          </div>
        </div>
      </div>

      <div className="map-wrapper" ref={wrapperRef}>
        <div
          ref={mapRef}
          className="map-svg"
          dangerouslySetInnerHTML={svgInnerHtml}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            const code = getStateCodeFromElement(e.target);
            if (code) onSelectState(code);
          }}
        />
        <div className="map-tooltip" ref={tooltipRef} style={{ display: "none" }} />
      </div>

      {otherWarlords?.length > 0 && (
        <div className="card subtle">
          <h3>{t.warlordStats || "Warlords"}</h3>
          <div className="warlord-list">
            {otherWarlords.map((w) => (
              <div key={w.id} className="warlord-row">
                <div className="warlord-title">
                  <span className="color-dot" style={{ background: w.color || "#6aa6ff" }} /> {w.id} ({w.type})
                </div>
                <div className="small">
                  {t.provinceLabel || "Province"}: {w.state} - {t.resources?.soldiers || "Soldiers"}: {getArmyForState(w.state)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {log?.length ? (
        <div className="card subtle">
          <h3>{t.log || "Log"}</h3>
          <ul className="log-list">
            {log.slice(-20).reverse().map((entry, idx) => (
              <li key={idx} className="small">
                {entry.turn ? `[T${entry.turn}] ` : ""}{entry.type}: {entry.detail || entry.actor || ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}









