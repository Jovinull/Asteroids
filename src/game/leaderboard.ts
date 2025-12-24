import type { LeaderboardEntry, Settings } from "./types";

function modeKey(settings: Settings): string {
  return `asteroids_lb_${settings.mode}_${settings.difficulty}`;
}

export function loadLeaderboard(settings: Settings): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(modeKey(settings));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(settings: Settings, score: number): void {
  const now = new Date();
  const entry: LeaderboardEntry = { score, date: now.toISOString().slice(0, 10) };
  const lb = loadLeaderboard(settings);
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  const top10 = lb.slice(0, 10);
  localStorage.setItem(modeKey(settings), JSON.stringify(top10));
}

export function renderLeaderboard(
  listEl: HTMLOListElement,
  settings: Settings
): void {
  const lb = loadLeaderboard(settings);
  listEl.innerHTML = "";
  if (lb.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sem registros ainda.";
    listEl.appendChild(li);
    return;
  }
  for (const e of lb) {
    const li = document.createElement("li");
    li.textContent = `${e.score} pts — ${e.date}`;
    listEl.appendChild(li);
  }
}
