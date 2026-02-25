import React, { useState } from "react";
import { useGameEngine } from "./game/engine/useGameEngine";
import { WarlordStats } from "./components/WarlordStats";
import { WarlordDiplomacy } from "./components/WarlordDiplomacy";
import { WarlordTech } from "./components/WarlordTech";

const toName = (obj, lang) => obj?.[`name_${lang}`] || obj?.name_en || obj?.name || obj?.id;

export default function WarlordDashboard({
  lang,
  t,
  user,
  province,
  warlordType,
  warlordCount,
  playerColor,
  initialSave,
  onSaveGame,
  onSaveCloudGame,
}) {
  const {
    state: {
      turn,
      targetState,
      svgMarkup,
      ownedStates,
      otherWarlords,
      buildings,
      buildingCaps,
      buildingsCfg,
      resources,
      lockedPop,
      ruinsLeft,
      canExploreRuin,
      turnDelta,
      techTrees,
      socialTrees,
      derived,
      modifiers,
      popByState,
      freeWorkers,
      borderStates,
      activeTech,
      activeInstitute,
      unlockedTechs,
      unlockedInstitutes,
      stateArmies,
      log,
      fullLog,
      engineError,
      isDefeated,
      isFinishedManually,
      isVictory,
      turnWarnings,
      playerCapturesLeft,
      playerCaptureLimit,
      militaryCaptureBonus,
      selectedStateLimits,
      buildBlockReasons,
    },
    actions: { setTargetState, nextTurn, build, exploreRuin, startTech, startInstitute, attackState, getSaveData, finishGame },
  } = useGameEngine({ province, warlordCount, playerColor, initialSave });

  const [tab, setTab] = useState("stats");
  const [saveNotice, setSaveNotice] = useState("");

  const statsResourceDelta = turnDelta || { food: 0 };

  const saveFullLog = () => {
    const entries = Array.isArray(fullLog) && fullLog.length ? fullLog : log || [];
    if (!entries.length) return;

    const header = [
      `Player: ${user?.email || "-"}`,
      `Province: ${toName(province, lang) || "-"}`,
      `Final turn: ${turn}`,
      `Result: ${isDefeated ? "defeat" : isVictory ? "victory" : "finished"}`,
      "",
      "Full action log:",
    ].join("\n");

    const lines = entries.map((entry, idx) => {
      const partTurn = entry?.turn ? `[T${entry.turn}] ` : "";
      const partType = entry?.type ? `${entry.type}` : "event";
      const partDetail = entry?.detail || "";
      return `${idx + 1}. ${partTurn}${partType}${partDetail ? `: ${partDetail}` : ""}`;
    });

    const content = `${header}\n${lines.join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const fileName = `warlord-log-${(province?.id || "state").toString().toLowerCase()}-turn-${turn}.txt`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const saveGame = () => {
    if (!onSaveGame || !getSaveData) return;
    const ok = onSaveGame(getSaveData());
    setSaveNotice(ok ? (t.saveGameOk || "Game saved") : (t.saveGameFail || "Save failed"));
  };
  const saveCloud = async () => {
    if (!onSaveCloudGame || !getSaveData) return;
    const result = await onSaveCloudGame(getSaveData());
    setSaveNotice(result?.ok ? (t.saveCloudOk || "Cloud save created") : (result?.error || t.saveCloudFail || "Cloud save failed"));
  };

  const gameFinished = Boolean(isDefeated || isVictory || isFinishedManually);
  if (gameFinished) {
    return (
      <div className="dashboard">
        <div className={`card ${isVictory ? "victory-screen" : "defeat-screen"}`}>
          <h2>{isVictory ? (t.victoryTitle || "Victory") : isDefeated ? (t.defeatTitle || "Defeat") : (t.finishedTitle || "Game finished")}</h2>
          <div className="small">
            {isVictory
              ? (t.victoryText || "You have won the campaign.")
              : isDefeated
                ? (t.defeatText || "Your state was annexed.")
                : (t.finishedText || "Session ended by player.")}
          </div>
          <button className="primary" onClick={saveFullLog} disabled={!(fullLog?.length || log?.length)}>
            {t.saveFullLog || "Save full log"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
        {engineError && <div className="card error">Engine error: {engineError}</div>}

        <div className="card topbar">
        <div className="topbar-left">
          <div className="topbar-title">{t.dashboardTitle}</div>
          <div className="topbar-subtitle">
            {t.youAre} <strong>{user?.email}</strong> - {t.turn}: <strong>{turn}</strong> - {t.provinceLabel}:{" "}
            <strong>{toName(province, lang)}</strong>
          </div>
        </div>
        <div className="topbar-right">
          <button className="secondary" onClick={saveGame}>
            {t.saveGame || "Save game"}
          </button>
          <button className="secondary" onClick={saveCloud}>
            {t.saveCloud || "Save to cloud"}
          </button>
          <button className="secondary" onClick={finishGame}>
            {t.finishGame || "Finish game"}
          </button>
          <button onClick={nextTurn}>{t.nextTurn}</button>
        </div>
      </div>

      <div className="card summary">
        <div className="badge">{t.resources?.soldiers || "Soldiers"}: <strong>{resources.soldiers}</strong> / {derived.soldierLimit}</div>
        <div className="badge">{t.resources?.food || "Food"}: <strong>{resources.food}</strong> ({(statsResourceDelta.food || 0) >= 0 ? "+" : ""}{Math.floor(statsResourceDelta.food || 0)})</div>
        <div className="badge">{t.capturesLeft || "Captures left"}: <strong>{playerCapturesLeft}</strong> / {playerCaptureLimit}{militaryCaptureBonus > 0 ? ` (+${militaryCaptureBonus})` : ""}</div>
      </div>
      {saveNotice ? <div className="flash info">{saveNotice}</div> : null}
      {Array.isArray(turnWarnings) && turnWarnings.length > 0 && (
        <div className="flash error">
          {turnWarnings.map((w, i) => (
            <div key={`${w}-${i}`}>{w}</div>
          ))}
        </div>
      )}

      <div className="card tabs-inline">
        <button className={`tab ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>{t.tabs.stats}</button>
        <button className={`tab ${tab === "diplo" ? "active" : ""}`} onClick={() => setTab("diplo")}>{t.tabs.diplomacy}</button>
        <button className={`tab ${tab === "tech" ? "active" : ""}`} onClick={() => setTab("tech")}>{t.tabs.tech}</button>
      </div>

      {tab === "stats" && (
        <WarlordStats
          t={t}
          resources={resources}
          derived={derived}
          freeWorkers={freeWorkers}
          buildings={buildings}
          buildingCaps={buildingCaps}
          buildingsCfg={buildingsCfg}
          buildBlockReasons={buildBlockReasons}
          onBuild={build}
          deltas={turnDelta}
          lockedPop={lockedPop}
          ruinsLeft={ruinsLeft}
          canExploreRuin={canExploreRuin}
          onExploreRuin={exploreRuin}
        />
      )}

      {tab === "diplo" && (
        <WarlordDiplomacy
          t={t}
          svgMarkup={svgMarkup}
          borderStates={borderStates}
          targetState={targetState}
          selectedStateLimits={selectedStateLimits}
          stateArmies={stateArmies}
          popByState={popByState}
          soldiersCapPer1000={Math.max(turn <= 10 ? 100 : 200, Number(modifiers?.soldiersPer1000Pop || 0))}
          otherWarlords={otherWarlords}
          playerColor={playerColor}
          ownedStates={ownedStates}
          resources={resources}
          log={log}
          turn={turn}
          onSelectState={setTargetState}
          onAttack={attackState}
        />
      )}

      {tab === "tech" && (
        <WarlordTech
          t={t}
          techTrees={techTrees}
          socialTrees={socialTrees}
          resources={resources}
          activeTech={activeTech}
          unlockedTechs={unlockedTechs}
          startTech={startTech}
          activeInstitute={activeInstitute}
          unlockedInstitutes={unlockedInstitutes}
          startInstitute={startInstitute}
          warlordType={warlordType}
        />
      )}
    </div>
  );
}

