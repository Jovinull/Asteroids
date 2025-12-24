import type { ActivePowerKey, DiffConfig, DiffKey, GameState, ModeKey, PowerKey } from "./types";

export const FPS = 30;
export const DT = 1 / FPS;

export const BASE = {
  SHIP_SIZE: 30,
  ROID_SIZE: 100,
  ROIDS_JAG: 0.4,
  ROIDS_VERT: 10,
  LASER_SPD: 540,
  LASER_DIST: 0.62,
  LASER_MAX: 12,
  TURN_SPEED_DEG: 360,
  SHIP_BLINK_DUR: 0.11,
  SHIP_INV_DUR: 2.6,
  SHIP_EXPLODE_DUR: 0.35,
  LASER_EXPLODE_DUR: 0.12,
} as const;

export const MODES: Record<ModeKey, { label: string; timeLimit: number | null }> = {
  classic: { label: "CLASSIC", timeLimit: null },
  time_attack: { label: "TIME", timeLimit: 120 },
  one_life: { label: "1LIFE", timeLimit: null },
  endless: { label: "ENDLESS", timeLimit: null },
};

export const DIFFS: Record<DiffKey, DiffConfig> = {
  easy: {
    label: "EASY",
    lives: 4,
    roidSpeed: 42,
    thrust: 4.6,
    friction: 0.86,
    maxSpeed: 6.4,
    ufoRate: 0.75,
  },
  normal: {
    label: "NORMAL",
    lives: 3,
    roidSpeed: 52,
    thrust: 5.0,
    friction: 0.82,
    maxSpeed: 7.2,
    ufoRate: 1.0,
  },
  hard: {
    label: "HARD",
    lives: 2,
    roidSpeed: 64,
    thrust: 5.3,
    friction: 0.78,
    maxSpeed: 8.1,
    ufoRate: 1.25,
  },
};

export const STATE: Record<Uppercase<GameState>, GameState> = {
  MENU: "menu",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  PAUSED: "paused",
  WAVE_CLEAR: "wave_clear",
  GAMEOVER: "gameover",
};

export const POWER: Record<PowerKey, { label: string; dur: number; color: string }> = {
  triple: { label: "TRIPLE", dur: 8, color: "#27f3ff" },
  shield: { label: "SHIELD", dur: 0, color: "#43ff7a" },
  slow: { label: "SLOW", dur: 4, color: "#ff2bd6" },
  rapid: { label: "RAPID", dur: 8, color: "#ffd166" },
  score2x: { label: "SCORE x2", dur: 10, color: "#a8ff3e" },
};

export const ACTIVE_POWER_KEYS: ActivePowerKey[] = ["triple", "slow", "rapid", "score2x"];
