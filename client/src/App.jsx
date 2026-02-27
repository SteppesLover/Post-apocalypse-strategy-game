import React, { useEffect, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import Login from "./Login";
import Game from "./Game";
import WarlordDashboard from "./WarlordDashboard";

const T_EN = {
  title: "Post-Apocalypse Strategy",
  mapLabel: "Map",
  provinceLabel: "Province",
  loading: "Loading...",
  error: "Error",
  pop: "Population points",
  login: "Login",
  register: "Sign up",
  name: "Name",
  email: "Email",
  password: "Password",
  repeatPass: "Repeat password",
  submitLogin: "Sign in",
  submitRegister: "Create account",
  loggedInAs: "Signed in as",
  logout: "Logout",
  startPlaying: "Start playing",
  selectProvinceFirst: "Select a state first",
  lowPopShort: "low pop",
  lowPopWarning: "States with population below 30,000 are not recommended for play.",
  lowPopStateWarning: "This state has low population (<30,000). Starting here is not recommended.",
  warlordType: "Warlord type",
  warlordCountLabel: "Warlord count",
  colorLabel: "Warlord color",
  warlordTypes: {
    economic: "Economic",
    military: "Military",
  },
  dashboardTitle: "Warlord Control",
  youAre: "Player",
  turn: "Turn",
  nextTurn: "Next turn",
  progress: "Researching",
  noneActive: "Nothing researching",
  research: "Research",
  inProgress: "In progress",
  unlocked: "Unlocked",
  requires: "Requires",
  effects: "Effects",
  base: "Base",
  diploLegend: "Legend",
  you: "You",
  border: "Neighbors",
  borderStates: "Borders",
  target: "Target",
  attack: "Attack",
  warlordStats: "Warlords",
  log: "Log",
  freeWorkers: "Free workers",
  lockedPop: "Locked population",
  exploreRuin: "Explore ruin",
  left: "left",
  buildingsLabel: "Buildings",
  buildingLimits: "Building limits",
  cost: "Cost",
  prod: "Prod",
  cons: "Cons",
  build: "Build",
  defeatTitle: "Defeat",
  defeatText: "Your state was annexed.",
  finishedTitle: "Game finished",
  finishedText: "Session ended by player.",
  victoryTitle: "Victory",
  victoryText: "You have won the campaign.",
  saveFullLog: "Save full log",
  saveGame: "Save game",
  saveCloud: "Save to cloud",
  finishGame: "Finish game",
  loadGame: "Load game",
  cloudSaves: "Cloud saves",
  noCloudSaves: "No cloud saves yet.",
  refresh: "Refresh",
  deleteSave: "Delete",
  editSave: "Edit",
  renameSavePrompt: "New save title",
  renameSaveFail: "Rename failed",
  saveGameOk: "Game saved",
  saveGameFail: "Save failed",
  saveCloudOk: "Cloud save created",
  saveCloudFail: "Cloud save failed",
  capturesLeft: "Captures left",
  tabs: {
    tech: "Institutions & Tech",
    diplomacy: "Diplomacy",
    stats: "Stats",
  },
  resources: {
    population: "Population",
    soldiers: "Soldiers",
    food: "Food",
    other: "Resources",
    resources: "Resources",
    tools: "Tools",
    weapons: "Weapons",
    science: "Science",
  },
};

const SAVE_KEY = "warlord_save_v1";
const TOKEN_KEY = "warlord_jwt_v1";

export default function App() {
  const lang = "en";
  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [gameSetup, setGameSetup] = useState(null);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [cloudSaves, setCloudSaves] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const API = import.meta.env.VITE_API_BASE || "";
  const t = T_EN;

  const getToken = () => {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  };

  const apiFetch = async (url, options = {}) => {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { credentials: "include", ...options, headers });
  };

  useEffect(() => {
    apiFetch(`${API}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) setUser(data);
      })
      .catch(() => {});
  }, [API]);

  useEffect(() => {
    try {
      setHasSavedGame(Boolean(localStorage.getItem(SAVE_KEY)));
    } catch {
      setHasSavedGame(false);
    }
  }, []);

  const handleLogout = async () => {
    await apiFetch(`${API}/sessions/logoff`, { method: "POST" });
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setUser(null);
    setPhase("setup");
    setGameSetup(null);
  };

  const refreshCloudSaves = async () => {
    if (!user?.email) return;
    setCloudLoading(true);
    try {
      const res = await apiFetch(`${API}/api/saves?limit=30`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCloudSaves(Array.isArray(data.items) ? data.items : []);
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) refreshCloudSaves();
  }, [user?.email]);

  const startGame = ({ province, warlordType, warlordCount, playerColor }) => {
    setGameSetup({ province, warlordType, warlordCount, playerColor, initialSave: null });
    setPhase("dashboard");
  };

  const startCloudGame = (item) => {
    const payload = item?.payload || {};
    const setup = payload?.gameSetup;
    const engineSave = payload?.engineSave;
    if (!setup || !engineSave) return;
    setGameSetup({
      province: setup.province,
      warlordType: setup.warlordType,
      warlordCount: setup.warlordCount,
      playerColor: setup.playerColor,
      initialSave: engineSave,
    });
    setPhase("dashboard");
  };

  const deleteCloudSave = async (id) => {
    if (!id) return;
    const res = await apiFetch(`${API}/api/saves/${id}`, { method: "DELETE" });
    if (res.ok) await refreshCloudSaves();
  };

  const editCloudSave = async (item) => {
    const id = item?._id;
    if (!id) return;
    const currentTitle = String(item?.title || "");
    const nextTitle = window.prompt(t.renameSavePrompt || "New save title", currentTitle);
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === currentTitle) return;

    const res = await apiFetch(`${API}/api/saves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (res.ok) {
      await refreshCloudSaves();
      return;
    }

    const data = await res.json().catch(() => ({}));
    window.alert(data?.error || t.renameSaveFail || "Rename failed");
  };

  const saveGame = (engineSave) => {
    if (!gameSetup || !engineSave) return false;
    const payload = {
      version: 1,
      savedAt: Date.now(),
      gameSetup: {
        province: gameSetup.province,
        warlordType: gameSetup.warlordType,
        warlordCount: gameSetup.warlordCount,
        playerColor: gameSetup.playerColor,
      },
      engineSave,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      setHasSavedGame(true);
      return true;
    } catch {
      return false;
    }
  };

  const saveCloudGame = async (engineSave) => {
    if (!gameSetup || !engineSave) return { ok: false, error: "No save payload" };
    const body = {
      title: `${gameSetup.province?.name_en || gameSetup.province?.id || "Campaign"} T${engineSave.turn}`,
      mapId: gameSetup.province?.id || "USA",
      turn: Number(engineSave.turn || 1),
      isFinished: Boolean(engineSave.isDefeated || engineSave.isFinishedManually),
      tags: [gameSetup.warlordType || "warlord"],
      eventDates: [new Date().toISOString()],
      payload: {
        version: 1,
        savedAt: Date.now(),
        gameSetup: {
          province: gameSetup.province,
          warlordType: gameSetup.warlordType,
          warlordCount: gameSetup.warlordCount,
          playerColor: gameSetup.playerColor,
        },
        engineSave,
      },
    };

    const res = await apiFetch(`${API}/api/saves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await refreshCloudSaves();
      return { ok: true };
    }
    return { ok: false, error: data.error || "Cloud save failed" };
  };

  const loadGame = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload?.gameSetup || !payload?.engineSave) return;
      setGameSetup({
        province: payload.gameSetup.province,
        warlordType: payload.gameSetup.warlordType,
        warlordCount: payload.gameSetup.warlordCount,
        playerColor: payload.gameSetup.playerColor,
        initialSave: payload.engineSave,
      });
      setPhase("dashboard");
    } catch {}
  };

  return (
    <ErrorBoundary>
      <div className="page">
        <header>
          <div>
            <h1>{t.title}</h1>
          </div>
        </header>

        {!user ? (
          <Login
            t={t}
            onAuthed={(authData) => {
              const maybeToken = authData?.token || "";
              if (maybeToken) {
                try {
                  localStorage.setItem(TOKEN_KEY, maybeToken);
                } catch {}
              }
              if (authData?.email) setUser({ email: authData.email, id: authData.id });
            }}
          />
        ) : phase === "setup" ? (
          <Game
            lang={lang}
            t={t}
            user={user}
            onLogout={handleLogout}
            onStartGame={startGame}
            onLoadGame={loadGame}
            hasSavedGame={hasSavedGame}
            cloudSaves={cloudSaves}
            cloudLoading={cloudLoading}
            onRefreshCloudSaves={refreshCloudSaves}
            onLoadCloudSave={startCloudGame}
            onDeleteCloudSave={deleteCloudSave}
            onEditCloudSave={editCloudSave}
          />
        ) : (
          <WarlordDashboard
            lang={lang}
            t={t}
            user={user}
            province={gameSetup?.province}
            warlordType={gameSetup?.warlordType}
            warlordCount={gameSetup?.warlordCount}
            playerColor={gameSetup?.playerColor}
            initialSave={gameSetup?.initialSave}
            onSaveGame={saveGame}
            onSaveCloudGame={saveCloudGame}
          />
        )}

        <footer className="card app-footer">
          <div className="small"><strong>Game by:</strong> Alan Aman</div>
          <div className="small">
            <strong>Email:</strong> <a href="mailto:amanzhanovalikhan@gmail.com">amanzhanovalikhan@gmail.com</a>
          </div>
          <div className="small">
            <strong>Github:</strong>{" "}
            <a href="https://github.com/SteppesLover/Post-apocalypse-strategy-game" target="_blank" rel="noreferrer">
              https://github.com/SteppesLover/Post-apocalypse-strategy-game
            </a>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
