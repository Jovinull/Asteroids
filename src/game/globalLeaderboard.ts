// src/game/globalLeaderboard.ts

export type GlobalLeaderboardEntry = {
  createdAt: string;
  playerName: string;
  score: number;
  playTimeSeconds: number;
};

type TopResponse =
  | { ok: true; data: GlobalLeaderboardEntry[] }
  | { ok: false; error: string };

type SubmitResponse =
  | { ok: true; inserted?: unknown }
  | { ok: false; error: string };

const STORAGE_PLAYER_NAME_KEY = "asteroids_player_name_v1";

function readApiBaseUrl(): string | null {
  const raw = (import.meta as any).env?.VITE_LEADERBOARD_API_URL as
    | string
    | undefined;
  if (!raw || typeof raw !== "string") return null;

  // remove aspas acidentais e espaços
  const u = raw.trim().replace(/^"+|"+$/g, "");
  if (!u) return null;

  return u;
}

function addQuery(base: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
}

function buildTopUrl(): string | null {
  const base = readApiBaseUrl();
  if (!base) return null;
  return addQuery(base, { action: "top" });
}

// ---------- validações client-side (mínimas; o server valida de verdade) ----------

export function sanitizePlayerNameClient(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);

  // remove espaços extras
  s = s.replace(/\s+/g, " ").trim();

  // remove caracteres perigosos comuns
  s = s.replace(/[<>`"'\\]/g, "");

  // remove controles invisíveis
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");

  // limita no máximo (igual ao server)
  if (s.length > 20) s = s.slice(0, 20);

  return s;
}

export function isValidPlayerName(name: string): boolean {
  const s = sanitizePlayerNameClient(name);
  return s.length >= 3 && s.length <= 20;
}

export function formatTimeMMSS(totalSeconds: number): string {
  const t = Math.max(
    0,
    Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0)
  );
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = Math.floor(t % 60);

  if (hh > 0) {
    return `${String(hh).padStart(1, "0")}:${String(mm).padStart(
      2,
      "0"
    )}:${String(ss).padStart(2, "0")}`;
  }
  return `${String(mm).padStart(1, "0")}:${String(ss).padStart(2, "0")}`;
}

export function getStoredPlayerName(): string {
  try {
    const raw = localStorage.getItem(STORAGE_PLAYER_NAME_KEY);
    return sanitizePlayerNameClient(raw ?? "");
  } catch {
    return "";
  }
}

export function setStoredPlayerName(name: string): void {
  try {
    const s = sanitizePlayerNameClient(name);
    localStorage.setItem(STORAGE_PLAYER_NAME_KEY, s);
  } catch {
    // ignore
  }
}

async function parseJsonSafe(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeNetworkError(err: unknown, fallbackMsg: string): string {
  const msg =
    (err as any)?.message && typeof (err as any).message === "string"
      ? String((err as any).message)
      : "";

  // Em CORS/redirect/login bloqueado, browsers costumam jogar "Failed to fetch" / "NetworkError..."
  if (/failed to fetch|networkerror/i.test(msg)) {
    return (
      "Falha de rede/CORS. Confira se o Apps Script está publicado como Web App " +
      'com acesso "Anyone" e URL termina em /exec.'
    );
  }

  return msg || fallbackMsg;
}

// ---------- API ----------

export async function fetchTopScores(): Promise<TopResponse> {
  const url = buildTopUrl();
  if (!url) {
    return {
      ok: false,
      error:
        "Env do Vite ausente: VITE_LEADERBOARD_API_URL (configure no .env)",
    };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });

    const json = await parseJsonSafe(res);

    if (!res.ok) {
      const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (!json || typeof json.ok !== "boolean") {
      return { ok: false, error: "Resposta inválida do leaderboard." };
    }

    return json as TopResponse;
  } catch (err) {
    return {
      ok: false,
      error: normalizeNetworkError(err, "Falha de rede ao buscar ranking."),
    };
  }
}

async function submitViaPost(
  base: string,
  bodyObj: any
): Promise<SubmitResponse> {
  // Blob com type text/plain evita preflight chato e funciona bem com Apps Script
  const bodyBlob = new Blob([JSON.stringify(bodyObj)], { type: "text/plain" });

  const res = await fetch(base, {
    method: "POST",
    body: bodyBlob,
    cache: "no-store",
    redirect: "follow",
  });

  const json = await parseJsonSafe(res);

  if (!res.ok) {
    const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  if (!json || typeof json.ok !== "boolean") {
    return { ok: false, error: "Resposta inválida ao enviar score." };
  }

  return json as SubmitResponse;
}

async function submitViaGet(
  base: string,
  bodyObj: any
): Promise<SubmitResponse> {
  const url = addQuery(base, {
    action: "submit",
    playerName: String(bodyObj.playerName ?? ""),
    score: String(bodyObj.score ?? 0),
    playTimeSeconds: String(bodyObj.playTimeSeconds ?? 0),
  });

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  const json = await parseJsonSafe(res);

  if (!res.ok) {
    const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  if (!json || typeof json.ok !== "boolean") {
    return { ok: false, error: "Resposta inválida ao enviar score (GET)." };
  }

  return json as SubmitResponse;
}

export async function submitScore(payload: {
  playerName: string;
  score: number;
  playTimeSeconds: number;
}): Promise<SubmitResponse> {
  const base = readApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      error:
        "Env do Vite ausente: VITE_LEADERBOARD_API_URL (configure no .env)",
    };
  }

  const body = {
    playerName: sanitizePlayerNameClient(payload.playerName),
    score: Math.floor(Number(payload.score) || 0),
    playTimeSeconds: Math.floor(Number(payload.playTimeSeconds) || 0),
  };

  try {
    // tenta POST primeiro
    return await submitViaPost(base, body);
  } catch (err) {
    // se cair em NetworkError/CORS no POST, tenta GET (funciona bem quando o POST é bloqueado)
    try {
      return await submitViaGet(base, body);
    } catch (err2) {
      return {
        ok: false,
        error: normalizeNetworkError(err2, "Falha de rede ao enviar score."),
      };
    }
  }
}
