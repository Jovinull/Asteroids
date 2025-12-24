export type ModeKey = "classic" | "time_attack" | "one_life" | "endless";
export type DiffKey = "easy" | "normal" | "hard";

export type GameState =
  | "menu"
  | "countdown"
  | "playing"
  | "paused"
  | "wave_clear"
  | "gameover";

export type Vec2 = { x: number; y: number };

export type Laser = {
  x: number;
  y: number;
  xv: number;
  yv: number;
  dist: number;
  explodeTime: number;
  trail: Vec2[];
  hit: boolean;
};

export type Ship = {
  x: number;
  y: number;
  r: number;
  a: number;
  rot: number;
  rotTarget: number;
  thrusting: boolean;
  shooting: boolean;
  thrust: Vec2;
  canShoot: boolean;
  shootCd: number;
  lasers: Laser[];
  dead: boolean;
  explodeTime: number;
  blinkNum: number;
  blinkTime: number;
  shield: number; // 0/1
  tookHitGrace: number;
};

export type Asteroid = {
  x: number;
  y: number;
  r: number;
  a: number;
  vert: number;
  offs: number[];
  xv: number;
  yv: number;
};

export type Particle = {
  x: number;
  y: number;
  xv: number;
  yv: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export type Floater = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
};

export type PowerKey = "triple" | "shield" | "slow" | "rapid" | "score2x";
export type ActivePowerKey = "triple" | "slow" | "rapid" | "score2x";

export type PowerDrop = {
  type: PowerKey;
  x: number;
  y: number;
  r: number;
  xv: number;
  yv: number;
  life: number;
};

export type Ufo = {
  small: boolean;
  x: number;
  y: number;
  r: number;
  dir: number;
  xv: number;
  shootT: number;
  life: number;
};

export type UfoBullet = {
  x: number;
  y: number;
  r: number;
  xv: number;
  yv: number;
  life: number;
};

export type DiffConfig = {
  label: string;
  lives: number;
  roidSpeed: number;
  thrust: number;
  friction: number;
  maxSpeed: number;
  ufoRate: number;
};

export type Tuning = DiffConfig & {
  extraRoidPerWave: number;

  laserSpeed: number;
  laserMax: number;
  shootCdMul: number;

  startShield: number;
  invulnMul: number;

  dropChanceMul: number;
  powerDurMul: number;

  coresYieldBonus: number;
};

export type Settings = {
  mode: ModeKey;
  difficulty: DiffKey;
  musicOn: boolean;
  sfxOn: boolean;
  musicVolume: number;
  sfxVolume: number;
  reduceFlashes: boolean;
  forceTouch: boolean;
  showFPS: boolean;
};

export type Meta = {
  cores: number;
  unlocked: Record<string, boolean>;
};

export type SkillMods = Partial<{
  thrustMul: number;
  frictionMul: number;
  maxSpeedMul: number;

  laserSpeedMul: number;
  shootCdMul: number;
  laserMaxAdd: number;
  powerDurMul: number;

  invulnMul: number;
  dropChanceMul: number;
  startShield: number;

  roidSpeedMul: number;
  ufoRateMul: number;
  extraRoidPerWave: number;
  coresYieldAdd: number;
}>;

export type Skill = {
  id: string;
  name: string;
  icon: string;
  type: string;
  cost: number;
  req: string[];
  desc: string;
  mods: SkillMods;
};

export type MetaMods = {
  thrustMul: number;
  frictionMul: number;
  maxSpeedMul: number;

  laserSpeedMul: number;
  shootCdMul: number;
  laserMaxAdd: number;
  powerDurMul: number;

  invulnMul: number;
  dropChanceMul: number;
  startShield: number;

  roidSpeedMul: number;
  ufoRateMul: number;
  extraRoidPerWave: number;
  coresYieldAdd: number;
};

export type LeaderboardEntry = { score: number; date: string };

export type GameRuntime = {
  state: GameState;
  wave: number;
  lives: number;
  score: number;
  best: number;
  timeLeft: number | null;
  roids: Asteroid[];
  particles: Particle[];
  floaters: Floater[];
  powerDrops: PowerDrop[];
  ufo: Ufo | null;
  ufoBullets: UfoBullet[];
  comboStreak: number;
  comboMult: number;
  comboTime: number;
  shotsFired: number;
  shotsHit: number;
  hitStreak: number;
  text: string;
  textAlpha: number;
  countdown: number;
  flashAlpha: number;
  shakeTime: number;
  shakeMag: number;
  musicReady: boolean;
  ufoSpawnT: number;
  fpsAcc: number;
  fpsFrames: number;
  fpsValue: number;

  runDeaths: number;
  runUfoKills: number;
  runMaxCombo: number;

  tuning: Tuning | null;
};
