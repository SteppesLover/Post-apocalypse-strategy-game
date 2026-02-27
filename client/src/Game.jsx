import React, { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "./utils/assetPaths";
import { getStateCodeFromElement } from "./utils/mapUtils";

const USA = {
  file: "pops_maps/pop_usa.json",
  svg: "maps/USA.svg",
  name: { en: "USA" },
};
const LOW_POP_THRESHOLD = 30000;

const fetchJSON = async (url) => {
  const resolved = assetUrl(url);
  const res = await fetch(resolved);
  if (!res.ok) throw new Error(`Failed to load ${resolved} (${res.status})`);
  return res.json();
};

export default function Game({
  lang,
  t,
  user,
  onLogout,
  onStartGame,
  onLoadGame,
  hasSavedGame,
  cloudSaves = [],
  cloudLoading = false,
  onRefreshCloudSaves,
  onLoadCloudSave,
  onDeleteCloudSave,
  onEditCloudSave,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const mapRef = useRef(null);
  const [svgMarkup, setSvgMarkup] = useState("");
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const [warlordType, setWarlordType] = useState("economic");
  const [warlordCount, setWarlordCount] = useState(6);
  const palette = [
    { value: "#ff69b4", label: "Pink" },
    { value: "#ffffff", label: "White" },
    { value: "#000000", label: "Black" },
    { value: "#800080", label: "Purple" },
    { value: "#ffd700", label: "Yellow" },
    { value: "#00bfff", label: "Sky blue" },
    { value: "#50c878", label: "Emerald" },
    { value: "#f5f5dc", label: "Beige" },
    { value: "#98ff98", label: "Mint" },
    { value: "#e6e6fa", label: "Lavender" },
  ];
  const [playerColor, setPlayerColor] = useState(palette[0].value);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setErr("");
    fetchJSON(USA.file)
      .then((json) => {
        if (!ignore) {
          setData(json);
          setSelectedIdx(0);
        }
      })
      .catch((e) => {
        if (!ignore) {
          setData(null);
          setErr(e.message);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const options = useMemo(() => {
    if (!data) return [];
    return data.provinces.map((p, i) => ({
      idx: i,
      label: `${p[`name_${lang}`] || p.name_en || p.id}${
        Number(p?.popPoints || 0) < LOW_POP_THRESHOLD ? ` (${t.lowPopShort || "low pop"})` : ""
      }`,
    }));
  }, [data, lang, t.lowPopShort]);

  const selected = data?.provinces?.[selectedIdx];

  const provinceIndexByCode = useMemo(() => {
    const index = new Map();
    if (!data?.provinces) return index;
    data.provinces.forEach((p, i) => {
      if (!p?.id) return;
      index.set(String(p.id).toLowerCase(), i);
    });
    return index;
  }, [data]);

  const provinceByCode = useMemo(() => {
    const map = new Map();
    if (!data?.provinces) return map;
    data.provinces.forEach((p) => {
      if (!p?.id) return;
      map.set(String(p.id).toLowerCase(), p);
    });
    return map;
  }, [data]);

  useEffect(() => {
    let ignore = false;
    const svgUrl = assetUrl(USA.svg);
    if (!svgUrl) return;
    fetch(svgUrl, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${svgUrl} (${r.status})`);
        return r.text();
      })
      .then((text) => {
        const withoutTitles = text.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
        if (!ignore) setSvgMarkup(withoutTitles);
      })
      .catch(() => {
        if (!ignore) setSvgMarkup("");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const getCode = (el) => {
    const code = getStateCodeFromElement(el);
    return code ? code.toLowerCase() : null;
  };

  const handleMapMouseMove = (e) => {
    const tooltipEl = tooltipRef.current;
    const wrapperEl = wrapperRef.current;
    if (!tooltipEl || !wrapperEl) return;
    const code = getCode(e.target);
    const province = code ? provinceByCode.get(code) : null;
    if (!province) {
      tooltipEl.style.display = "none";
      return;
    }
    const name = province[`name_${lang}`] || province.name_en || province.id;
    const rect = wrapperEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    tooltipEl.textContent = name;
    tooltipEl.style.left = `${x + 12}px`;
    tooltipEl.style.top = `${y + 12}px`;
    tooltipEl.style.display = "block";
  };

  const handleMapMouseLeave = () => {
    const tooltipEl = tooltipRef.current;
    if (tooltipEl) tooltipEl.style.display = "none";
  };

  const handleMapClick = (e) => {
    const code = getCode(e.target);
    if (!code) return;
    const idx = provinceIndexByCode.get(code);
    if (typeof idx === "number") setSelectedIdx(idx);
  };

  useEffect(() => {
    const root = mapRef.current;
    if (!root || !selected) return;

    const escapeCss =
      globalThis.CSS?.escape ||
      ((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

    root.querySelectorAll(".state-selected").forEach((el) => {
      el.classList.remove("state-selected");
    });

    const id = String(selected.id || "");
    const lower = id.toLowerCase();
    const upper = id.toUpperCase();
    const candidates = [
      `#${escapeCss(id)}`,
      `#${escapeCss(lower)}`,
      `#${escapeCss(upper)}`,
      `.${escapeCss(lower)}`,
      `.${escapeCss(upper)}`,
    ];

    let targets = [];
    for (const selector of candidates) {
      const found = Array.from(root.querySelectorAll(selector));
      if (found.length) {
        targets = found;
        break;
      }
    }

    targets.forEach((el) => {
      el.classList.add("state-selected");
    });
  }, [selected, svgMarkup]);

  const startDisabled = !selected || loading || Boolean(err);

  return (
    <>
      <div className="card setup-topbar">
        <div className="setup-topbar-left">
          <div className="setup-hello">
            {t.loggedInAs} <strong>{user.email}</strong>
          </div>
        </div>
        <div className="setup-topbar-right">
          <button className="secondary" onClick={onLogout}>
            {t.logout}
          </button>
        </div>
      </div>

      <div className="card setup-controls">
        <div className="row">
          <div className="field field-compact">
            <label>{t.mapLabel}</label>
            <div className="static-field">{USA.name.en}</div>
          </div>
          <div className="field field-compact">
            <label>{t.provinceLabel}</label>
            <select value={selectedIdx} onChange={(e) => setSelectedIdx(Number(e.target.value))} disabled={!data || loading}>
              {options.map((o) => (
                <option key={o.idx} value={o.idx}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-compact">
            <label>{t.warlordType}</label>
            <select value={warlordType} onChange={(e) => setWarlordType(e.target.value)}>
              <option value="economic">{t.warlordTypes.economic}</option>
              <option value="military">{t.warlordTypes.military}</option>
            </select>
          </div>
          <div className="field field-compact">
            <label>{t.warlordCountLabel || "Warlord count"}</label>
            <input
              type="number"
              min="2"
              max="6"
              value={warlordCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setWarlordCount(Math.max(2, Math.min(6, Number.isFinite(n) ? n : 2)));
              }}
            />
          </div>
          <div className="field field-compact">
            <label>{t.colorLabel || "Warlord color"}</label>
            <select value={playerColor} onChange={(e) => setPlayerColor(e.target.value)}>
              {palette.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-compact field-actions">
            <label>&nbsp;</label>
            <button
              onClick={() =>
                onStartGame?.({
                  province: selected,
                  warlordType,
                  warlordCount,
                  playerColor,
                })
              }
              disabled={startDisabled}
              title={startDisabled ? t.selectProvinceFirst : undefined}
            >
              {t.startPlaying}
            </button>
            <button
              className="secondary"
              style={{ marginTop: 8 }}
              onClick={onLoadGame}
              disabled={!hasSavedGame}
            >
              {t.loadGame || "Load game"}
            </button>
          </div>
        </div>
        {loading && <div className="flash info">{t.loading}</div>}
        {err && <div className="flash error">{t.error}: {err}</div>}
        <div className="small">
          {t.lowPopWarning || "States with population below 30,000 are not recommended for play."}
        </div>
        {selected && Number(selected?.popPoints || 0) < LOW_POP_THRESHOLD && (
          <div className="flash error">
            {t.lowPopStateWarning || "This state has low population (<30,000). Starting here is not recommended."}
          </div>
        )}
      </div>

      {USA.svg && (
        <div className="card setup-map">
          <div className="map-wrapper" ref={wrapperRef}>
            <div
              ref={mapRef}
              className="map-svg"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
              onMouseMove={handleMapMouseMove}
              onMouseLeave={handleMapMouseLeave}
              onClick={handleMapClick}
            />
            <div className="map-tooltip" ref={tooltipRef} style={{ display: "none" }} />
          </div>
        </div>
      )}
      <div className="card">
        <div className="row space-between">
          <h3>{t.cloudSaves || "Cloud saves"}</h3>
          <button className="secondary" onClick={onRefreshCloudSaves} disabled={cloudLoading}>
            {cloudLoading ? (t.loading || "Loading...") : (t.refresh || "Refresh")}
          </button>
        </div>
        {!cloudSaves.length ? (
          <div className="small">{t.noCloudSaves || "No cloud saves yet."}</div>
        ) : (
          <div className="list">
            {cloudSaves.map((item) => (
              <div key={item._id} className="list-row">
                <div className="list-main">
                  <div className="list-title">{item.title || item.mapId}</div>
                  <div className="list-meta">
                    {item.mapId} · T{item.turn} · {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}
                  </div>
                </div>
                <button className="secondary" onClick={() => onLoadCloudSave?.(item)}>
                  {t.loadGame || "Load game"}
                </button>
                <button className="secondary" onClick={() => onEditCloudSave?.(item)}>
                  {t.editSave || "Edit"}
                </button>
                <button className="secondary" onClick={() => onDeleteCloudSave?.(item._id)}>
                  {t.deleteSave || "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
