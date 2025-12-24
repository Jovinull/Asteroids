import {
  ACTIVE_POWER_KEYS,
  BASE,
  DIFFS,
  DT,
  FPS,
  MODES,
  POWER,
  STATE,
} from "./constants";
import type {
  ActivePowerKey,
  Asteroid,
  DiffKey,
  Floater,
  GameRuntime,
  GameState,
  Laser,
  Meta,
  ModeKey,
  Particle,
  PowerDrop,
  PowerKey,
  Settings,
  Ship,
  Skill,
  Tuning,
  Ufo,
  UfoBullet,
} from "./types";
import { clamp, dist, preventScrollKeys, safePlay, withAlpha, wrap as wrapObj } from "./utils";
import { createAudioSystem } from "./audio";
import { computeMetaMods, hasSkill as hasSkillFn, loadMeta, saveMeta, SKILLS } from "./meta";
import { renderLeaderboard, saveLeaderboard } from "./leaderboard";

export function bootGame(): void {
  // =========================
  // DOM helpers
  // =========================
  function el<T extends Element = HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Elemento #${id} não encontrado no DOM.`);
    return node as unknown as T;
  }

  // =========================
  // Canvas / Context
  // =========================
  const canv = el<HTMLCanvasElement>("gameCanvas");
  const _ctx = canv.getContext("2d");
  if (!_ctx) throw new Error("Não foi possível obter o contexto 2D do canvas.");
  const ctx: CanvasRenderingContext2D = _ctx;

  // wrap helper (mantém chamadas antigas wrap(ship), wrap(roid) etc.)
  const wrap = (obj: { x: number; y: number; r: number }) => wrapObj(obj, canv);

  // =========================
  // UI Elements
  // =========================
  const overlay = el<HTMLDivElement>("overlay");
  const panelMenu = el<HTMLDivElement>("panelMenu");
  const panelPause = el<HTMLDivElement>("panelPause");
  const panelGameOver = el<HTMLDivElement>("panelGameOver");
  const panelSettings = el<HTMLDivElement>("panelSettings");
  const panelSkills = el<HTMLDivElement>("panelSkills");

  const btnFullscreen = el<HTMLButtonElement>("btnFullscreen");
  const btnSettings = el<HTMLButtonElement>("btnSettings");

  const selMode = el<HTMLSelectElement>("selMode");
  const selDiff = el<HTMLSelectElement>("selDiff");
  const btnPlay = el<HTMLButtonElement>("btnPlay");
  const btnSkills = el<HTMLButtonElement>("btnSkills");
  const btnShowLeaderboard = el<HTMLButtonElement>("btnShowLeaderboard");
  const leaderboard = el<HTMLDivElement>("leaderboard");
  const leaderboardList = el<HTMLOListElement>("leaderboardList");
  const leaderboardList2 = el<HTMLOListElement>("leaderboardList2");

  const btnResume = el<HTMLButtonElement>("btnResume");
  const btnRestart = el<HTMLButtonElement>("btnRestart");
  const btnQuit = el<HTMLButtonElement>("btnQuit");

  const btnAgain = el<HTMLButtonElement>("btnAgain");
  const btnBackMenu = el<HTMLButtonElement>("btnBackMenu");
  const gameOverTitle = el<HTMLDivElement>("gameOverTitle");
  const gameOverStats = el<HTMLDivElement>("gameOverStats");

  const chkMusic = el<HTMLInputElement>("chkMusic");
  const chkSfx = el<HTMLInputElement>("chkSfx");
  const rngMusic = el<HTMLInputElement>("rngMusic");
  const rngSfx = el<HTMLInputElement>("rngSfx");
  const chkReduceFlashes = el<HTMLInputElement>("chkReduceFlashes");
  const chkTouch = el<HTMLInputElement>("chkTouch");
  const btnCloseSettings = el<HTMLButtonElement>("btnCloseSettings");

  const hudMode = el<HTMLSpanElement>("hudMode");
  const hudDiff = el<HTMLSpanElement>("hudDiff");
  const hudCores = el<HTMLSpanElement>("hudCores");
  const powerbar = el<HTMLDivElement>("powerbar");

  const touch = el<HTMLDivElement>("touch");
  const btnLeft = el<HTMLButtonElement>("btnLeft");
  const btnRight = el<HTMLButtonElement>("btnRight");
  const btnThrust = el<HTMLButtonElement>("btnThrust");
  const btnFire = el<HTMLButtonElement>("btnFire");

  // Skill Tree UI
  const btnCloseSkills = el<HTMLButtonElement>("btnCloseSkills");
  const skillsCores = el<HTMLSpanElement>("skillsCores");
  const skillsGrid = el<HTMLDivElement>("skillsGrid");
  const skillsLines = el<SVGSVGElement>("skillsLines");
  const skillTitle = el<HTMLDivElement>("skillTitle");
  const skillDesc = el<HTMLDivElement>("skillDesc");
  const skillCost = el<HTMLSpanElement>("skillCost");
  const skillType = el<HTMLSpanElement>("skillType");
  const btnUnlockSkill = el<HTMLButtonElement>("btnUnlockSkill");
  const skillHint = el<HTMLElement>("skillHint");
  const activeModsEl = el<HTMLDivElement>("activeMods");

  // GameOver rewards UI
  const runCoresEl = el<HTMLElement>("runCores");
  const runCoresBreakdownEl = el<HTMLUListElement>("runCoresBreakdown");

  // =========================
  // Settings (mutáveis)
  // =========================
  const settings: Settings = {
    mode: "classic",
    difficulty: "normal",
    musicOn: true,
    sfxOn: true,
    musicVolume: 0.55,
    sfxVolume: 0.75,
    reduceFlashes: false,
    forceTouch: false,
    showFPS: false,
  };

  // =========================
  // META PROGRESSION (NÚCLEOS + SKILL TREE)
  // =========================
  let meta: Meta = loadMeta();

  const hasSkill = (id: string) => hasSkillFn(meta, id);

  function saveMetaLocal(): void {
    saveMeta(meta);
  }

  function computeMetaModsLocal() {
    return computeMetaMods(meta);
  }

  function syncCoresUI(): void {
    hudCores.textContent = String(meta.cores);
    skillsCores.textContent = String(meta.cores);
  }

  // =========================
  // Game State
  // =========================
  const game: GameRuntime = {
    state: STATE.MENU,
    wave: 0,
    lives: 3,
    score: 0,
    best: 0,
    timeLeft: null,
    roids: [],
    particles: [],
    floaters: [],
    powerDrops: [],
    ufo: null,
    ufoBullets: [],
    comboStreak: 0,
    comboMult: 1,
    comboTime: 0,
    shotsFired: 0,
    shotsHit: 0,
    hitStreak: 0,
    text: "",
    textAlpha: 0,
    countdown: 0,
    flashAlpha: 0,
    shakeTime: 0,
    shakeMag: 0,
    musicReady: false,
    ufoSpawnT: 0,
    fpsAcc: 0,
    fpsFrames: 0,
    fpsValue: 0,

    runDeaths: 0,
    runUfoKills: 0,
    runMaxCombo: 1,

    tuning: null,
  };

  // =========================
  // Audio
  // =========================
  const audio = createAudioSystem(settings);
  const { fxExplode, fxHit, fxLaser, fxThrust, fxPower, fxUfoHit, music, ufoSiren, syncAllVolumes } = audio;

  // =========================
  // Utility: Overlay + Menu
  // =========================
  function setOverlay(panel?: HTMLDivElement): void {
    overlay.classList.remove("hidden");
    panelMenu.classList.add("hidden");
    panelPause.classList.add("hidden");
    panelGameOver.classList.add("hidden");
    panelSettings.classList.add("hidden");
    panelSkills.classList.add("hidden");

    if (panel) panel.classList.remove("hidden");
  }

  function hideOverlay(): void {
    overlay.classList.add("hidden");
    panelMenu.classList.add("hidden");
    panelPause.classList.add("hidden");
    panelGameOver.classList.add("hidden");
    panelSettings.classList.add("hidden");
    panelSkills.classList.add("hidden");
  }

  function updateBest(): void {
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem("highscore", String(game.best));
    }
  }

  // =========================
  // Visual FX
  // =========================
  function spawnParticles(
    x: number,
    y: number,
    count: number,
    color: string,
    baseSpeed: number,
    lifeMin: number,
    lifeMax: number,
    sizeMin: number,
    sizeMax: number
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = baseSpeed * (0.35 + Math.random() * 0.9);
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);
      game.particles.push({
        x,
        y,
        xv: (Math.cos(ang) * spd) / FPS,
        yv: (Math.sin(ang) * spd) / FPS,
        life,
        maxLife: life,
        size,
        color,
      });
    }
  }

  function addFloater(x: number, y: number, text: string, color = "white", life = 0.9): void {
    game.floaters.push({
      x,
      y,
      text,
      color,
      life,
      maxLife: life,
      vy: -22 / FPS,
    });
  }

  function doShake(mag: number, t: number): void {
    if (settings.reduceFlashes) return;
    game.shakeMag = Math.max(game.shakeMag, mag);
    game.shakeTime = Math.max(game.shakeTime, t);
  }

  function doFlash(alpha: number): void {
    if (settings.reduceFlashes) return;
    game.flashAlpha = Math.max(game.flashAlpha, alpha);
  }

  // =========================
  // Powerups
  // =========================
  const activePower: Record<ActivePowerKey, number> = {
    triple: 0,
    slow: 0,
    rapid: 0,
    score2x: 0,
  };

  const activePowerMax: Record<ActivePowerKey, number> = {
    triple: POWER.triple.dur,
    slow: POWER.slow.dur,
    rapid: POWER.rapid.dur,
    score2x: POWER.score2x.dur,
  };

  function powerScoreMult(): number {
    return activePower.score2x > 0 ? 2 : 1;
  }

  function timeScale(): number {
    return activePower.slow > 0 ? 0.55 : 1.0;
  }

  function rapidFireCd(): number {
    const base = activePower.rapid > 0 ? 0.1 : 0.22;
    const mul = game.tuning?.shootCdMul ?? 1;
    return base * mul;
  }

  function dropPowerup(x: number, y: number): void {
    const baseChance = 0.14 + Math.min(0.06, game.wave * 0.004);
    const mul = game.tuning?.dropChanceMul ?? 1;
    const chance = clamp(baseChance * mul, 0, 0.35);
    if (Math.random() > chance) return;

    const roll = Math.random();
    let type: PowerKey = "triple";
    if (roll < 0.2) type = "shield";
    else if (roll < 0.45) type = "triple";
    else if (roll < 0.62) type = "rapid";
    else if (roll < 0.8) type = "score2x";
    else type = "slow";

    game.powerDrops.push({
      type,
      x,
      y,
      r: 10,
      xv: ((Math.random() * 20) / FPS) * (Math.random() < 0.5 ? 1 : -1),
      yv: ((Math.random() * 24) / FPS) * (Math.random() < 0.5 ? 1 : -1),
      life: 9,
    });

    addFloater(x, y, POWER[type].label, POWER[type].color, 0.8);
  }

  // =========================
  // Entities
  // =========================
  function newShip(): Ship {
    const invMul = game.tuning?.invulnMul ?? 1;
    const invDur = BASE.SHIP_INV_DUR * invMul;
    const blinkDur = BASE.SHIP_BLINK_DUR;

    return {
      x: canv.width / 2,
      y: canv.height / 2,
      r: BASE.SHIP_SIZE / 2,
      a: (90 / 180) * Math.PI,
      rot: 0,
      rotTarget: 0,
      thrusting: false,
      shooting: false,
      thrust: { x: 0, y: 0 },
      canShoot: true,
      shootCd: 0,
      lasers: [],
      dead: false,
      explodeTime: 0,
      blinkNum: Math.ceil(invDur / blinkDur),
      blinkTime: Math.ceil(blinkDur * FPS),
      shield: 0,
      tookHitGrace: 0,
    };
  }

  let ship: Ship = newShip();

  function newAsteroid(x: number, y: number, r: number, speedMult = 1): Asteroid {
    const diff = DIFFS[settings.difficulty];
    const baseSpd = game.tuning?.roidSpeed ?? diff.roidSpeed;
    const lvlMult = 1 + 0.085 * game.wave;

    const roid: Asteroid = {
      x,
      y,
      r,
      a: Math.random() * Math.PI * 2,
      vert: Math.floor(Math.random() * (BASE.ROIDS_VERT + 1) + BASE.ROIDS_VERT / 2),
      offs: [],
      xv: ((Math.random() * baseSpd * lvlMult * speedMult) / FPS) * (Math.random() < 0.5 ? 1 : -1),
      yv: ((Math.random() * baseSpd * lvlMult * speedMult) / FPS) * (Math.random() < 0.5 ? 1 : -1),
    };

    for (let i = 0; i < roid.vert; i++) {
      roid.offs.push(Math.random() * BASE.ROIDS_JAG * 2 + 1 - BASE.ROIDS_JAG);
    }
    return roid;
  }

  function applyPowerup(type: PowerKey): void {
    fxPower.play();

    if (type === "shield") {
      ship.shield = 1;
      addFloater(ship.x, ship.y, "SHIELD!", "#43ff7a", 0.9);
      return;
    }

    const durMul = game.tuning?.powerDurMul ?? 1;
    const max = POWER[type].dur * durMul;

    const k = type as ActivePowerKey;
    activePowerMax[k] = max;
    activePower[k] = Math.max(activePower[k], max);

    addFloater(ship.x, ship.y, POWER[type].label + "!", POWER[type].color, 0.9);
  }

  function renderPowerbar(): void {
    const items: Array<{ key: ActivePowerKey; time: number; max: number; label: string }> = [];

    for (const k of ACTIVE_POWER_KEYS) {
      const t = activePower[k];
      if (t > 0) {
        items.push({
          key: k,
          time: t,
          max: activePowerMax[k] || POWER[k].dur,
          label: POWER[k].label,
        });
      }
    }

    powerbar.innerHTML = "";
    if (items.length === 0) return;

    for (const it of items) {
      const elDiv = document.createElement("div");
      elDiv.className = "pu";
      elDiv.innerHTML = `
        <div class="pu__name">${it.label}</div>
        <div class="pu__bar"><div class="pu__fill" style="width:${Math.round((it.time / it.max) * 100)}%"></div></div>
      `;
      powerbar.appendChild(elDiv);
    }
  }

  // =========================
  // UFO
  // =========================
  function getUfoRate(): number {
    return game.tuning?.ufoRate ?? DIFFS[settings.difficulty].ufoRate;
  }

  function spawnUfo(): void {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const small = Math.random() < 0.55;

    const y = clamp(60 + Math.random() * (canv.height - 120), 60, canv.height - 60);
    const x = dir === 1 ? -40 : canv.width + 40;

    const baseV = small ? 110 : 80;
    const v = (baseV * getUfoRate()) / FPS;

    game.ufo = {
      small,
      x,
      y,
      r: small ? 14 : 20,
      dir,
      xv: v * dir,
      shootT: 0.9 + Math.random() * 0.8,
      life: 12,
    };

    ufoSiren.currentTime = 0;
    ufoSiren.volume = settings.sfxOn ? clamp(0.28 * settings.sfxVolume, 0, 1) : 0;
    safePlay(ufoSiren);

    addFloater(canv.width / 2, 90, "UFO!", "#ff2bd6", 0.9);
  }

  function despawnUfo(): void {
    game.ufo = null;
    game.ufoBullets.length = 0;
    ufoSiren.pause();
    ufoSiren.currentTime = 0;
  }

  function ufoScore(): number {
    return game.ufo?.small ? 250 : 150;
  }

  function ufoShoot(): void {
    if (!game.ufo) return;
    const u = game.ufo;

    const ang = Math.atan2(ship.y - u.y, ship.x - u.x);
    const spd = 260 / FPS;
    game.ufoBullets.push({
      x: u.x,
      y: u.y,
      r: 3.5,
      xv: Math.cos(ang) * spd,
      yv: Math.sin(ang) * spd,
      life: 2.8,
    });
  }

  // =========================
  // Waves / Patterns / Scoring / Combo
  // =========================
  let roidsTotal = 0;
  let roidsLeft = 0;

  function wavePattern(w: number): { large: number; med: number; small: number } {
    const m = w % 4;
    if (m === 0) return { large: 1, med: 3, small: 6 };
    if (m === 1) return { large: 3, med: 0, small: 2 };
    if (m === 2) return { large: 0, med: 6, small: 0 };
    return { large: 2, med: 2, small: 4 };
  }

  function createWave(): void {
    game.roids = [];
    const pat = wavePattern(game.wave);
    const L = Math.ceil(BASE.ROID_SIZE / 2);
    const M = Math.ceil(BASE.ROID_SIZE / 4);
    const S = Math.ceil(BASE.ROID_SIZE / 8);

    const extra = game.tuning?.extraRoidPerWave ?? 0;
    const total = pat.large + pat.med + pat.small + extra;
    roidsTotal = total;
    roidsLeft = total;

    function spawnCount(n: number, r: number, spdMult = 1): void {
      for (let i = 0; i < n; i++) {
        let x: number, y: number;
        do {
          x = Math.floor(Math.random() * canv.width);
          y = Math.floor(Math.random() * canv.height);
        } while (dist(ship.x, ship.y, x, y) < BASE.ROID_SIZE * 1.7 + ship.r);

        game.roids.push(newAsteroid(x, y, r, spdMult));
      }
    }

    spawnCount(pat.large, L, 1.0);
    spawnCount(pat.med, M, 1.05);
    spawnCount(pat.small, S, 1.12);

    if (extra > 0) {
      for (let i = 0; i < extra; i++) {
        let x: number, y: number;
        do {
          x = Math.floor(Math.random() * canv.width);
          y = Math.floor(Math.random() * canv.height);
        } while (dist(ship.x, ship.y, x, y) < BASE.ROID_SIZE * 1.7 + ship.r);
        game.roids.push(newAsteroid(x, y, M, 1.05));
      }
    }

    music.setAsteroidRatio(1);
  }

  function addScore(base: number, x = canv.width / 2, y = canv.height / 2): void {
    const scoreMult = powerScoreMult() * game.comboMult;
    const add = Math.floor(base * scoreMult);
    game.score += add;
    updateBest();
    addFloater(x, y, `+${add}`, "white", 0.8);
  }

  function bumpCombo(): void {
    game.comboStreak++;
    game.comboTime = 3.0;
    game.comboMult = clamp(1 + Math.floor(game.comboStreak / 3), 1, 5);
    game.runMaxCombo = Math.max(game.runMaxCombo, game.comboMult);

    if (game.comboStreak > 0 && game.comboStreak % 6 === 0) {
      addFloater(canv.width / 2, canv.height * 0.35, `COMBO x${game.comboMult}!`, "#27f3ff", 1.1);
    }
  }

  function resetCombo(): void {
    game.comboStreak = 0;
    game.comboMult = 1;
    game.comboTime = 0;
    game.hitStreak = 0;
  }

  function precisionHit(): void {
    game.shotsHit++;
    game.hitStreak++;

    if (game.hitStreak >= 5) {
      game.hitStreak = 0;
      addFloater(canv.width / 2, canv.height * 0.33, "PRECISION +150", "#43ff7a", 1.0);
      addScore(150, ship.x, ship.y);
    }
  }

  // =========================
  // Destroy asteroid
  // =========================
  function destroyAsteroid(index: number, hitX?: number, hitY?: number): void {
    const roid = game.roids[index];
    const x = roid.x;
    const y = roid.y;
    const r = roid.r;

    doShake(6, 0.18);
    doFlash(0.28);

    const sizeFactor = r / (BASE.ROID_SIZE / 2);
    spawnParticles(x, y, Math.floor(18 + 22 * sizeFactor), "#cfd8dc", 220, 0.25, 0.7, 1.2, 2.6);

    dropPowerup(x, y);

    if (r === Math.ceil(BASE.ROID_SIZE / 2)) addScore(20, hitX ?? x, hitY ?? y);
    else if (r === Math.ceil(BASE.ROID_SIZE / 4)) addScore(50, hitX ?? x, hitY ?? y);
    else addScore(100, hitX ?? x, hitY ?? y);

    bumpCombo();
    precisionHit();

    if (r === Math.ceil(BASE.ROID_SIZE / 2)) {
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 4), 1.05));
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 4), 1.05));
      roidsTotal += 2;
      roidsLeft += 2;
    } else if (r === Math.ceil(BASE.ROID_SIZE / 4)) {
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 8), 1.12));
      game.roids.push(newAsteroid(x, y, Math.ceil(BASE.ROID_SIZE / 8), 1.12));
      roidsTotal += 2;
      roidsLeft += 2;
    }

    game.roids.splice(index, 1);
    fxHit.play();

    roidsLeft--;
    music.setAsteroidRatio(roidsLeft <= 0 ? 1 : roidsLeft / roidsTotal);

    if (game.roids.length === 0) {
      game.state = STATE.WAVE_CLEAR;
      game.text = "WAVE CLEARED";
      game.textAlpha = 1.0;
      game.countdown = 3.0;

      spawnParticles(canv.width / 2, canv.height / 2, 90, "#27f3ff", 320, 0.25, 1.2, 1.2, 2.8);
      spawnParticles(canv.width / 2, canv.height / 2, 70, "#ff2bd6", 300, 0.25, 1.0, 1.2, 2.6);

      doShake(8, 0.25);
      doFlash(0.35);
    }
  }

  // =========================
  // Shooting
  // =========================
  function shootLaser(): void {
    if (ship.dead) return;
    if (ship.shootCd > 0) return;

    const maxLasers = game.tuning?.laserMax ?? BASE.LASER_MAX;
    if (ship.lasers.length >= maxLasers) return;

    ship.shootCd = rapidFireCd();

    const spread = activePower.triple > 0 ? [-0.14, 0, 0.14] : [0];
    for (const s of spread) {
      if (ship.lasers.length >= maxLasers) break;

      const ang = ship.a + s;
      const lx = ship.x + (4 / 3) * ship.r * Math.cos(ang);
      const ly = ship.y - (4 / 3) * ship.r * Math.sin(ang);

      const laserSpd = game.tuning?.laserSpeed ?? BASE.LASER_SPD;

      ship.lasers.push({
        x: lx,
        y: ly,
        xv: (laserSpd * Math.cos(ang)) / FPS,
        yv: (-laserSpd * Math.sin(ang)) / FPS,
        dist: 0,
        explodeTime: 0,
        trail: [{ x: lx, y: ly }],
        hit: false,
      });
      game.shotsFired++;
    }

    fxLaser.play();
  }

  // =========================
  // Ship explode
  // =========================
  function explodeShip(): void {
    ship.explodeTime = Math.ceil(BASE.SHIP_EXPLODE_DUR * FPS);
    fxExplode.play();

    doShake(14, 0.34);
    doFlash(0.65);

    spawnParticles(ship.x, ship.y, 120, "#ffb703", 420, 0.25, 1.3, 1.4, 3.5);
    spawnParticles(ship.x, ship.y, 80, "#ff2bd6", 360, 0.25, 1.1, 1.1, 3.0);
    spawnParticles(ship.x, ship.y, 60, "#ffffff", 300, 0.2, 0.9, 1.0, 2.2);
  }

  // =========================
  // Start / Reset / End
  // =========================
  function loadBest(): void {
    const s = localStorage.getItem("highscore");
    game.best = s == null ? 0 : parseInt(s, 10);
  }

  function resetRun(): void {
    const baseDiff = DIFFS[settings.difficulty];
    const metaMods = computeMetaModsLocal();

    game.wave = 0;
    game.score = 0;
    game.lives = settings.mode === "one_life" ? 1 : baseDiff.lives;

    game.timeLeft = MODES[settings.mode].timeLimit;
    game.roids = [];
    game.particles = [];
    game.floaters = [];
    game.powerDrops = [];
    game.ufo = null;
    game.ufoBullets = [];
    despawnUfo();

    game.comboStreak = 0;
    game.comboMult = 1;
    game.comboTime = 0;
    game.shotsFired = 0;
    game.shotsHit = 0;
    game.hitStreak = 0;

    game.text = "";
    game.textAlpha = 0;
    game.flashAlpha = 0;
    game.shakeTime = 0;
    game.shakeMag = 0;

    game.runDeaths = 0;
    game.runUfoKills = 0;
    game.runMaxCombo = 1;

    activePower.triple = 0;
    activePower.slow = 0;
    activePower.rapid = 0;
    activePower.score2x = 0;

    activePowerMax.triple = POWER.triple.dur * (metaMods.powerDurMul ?? 1);
    activePowerMax.slow = POWER.slow.dur * (metaMods.powerDurMul ?? 1);
    activePowerMax.rapid = POWER.rapid.dur * (metaMods.powerDurMul ?? 1);
    activePowerMax.score2x = POWER.score2x.dur * (metaMods.powerDurMul ?? 1);

    game.tuning = {
      ...baseDiff,

      roidSpeed: baseDiff.roidSpeed * metaMods.roidSpeedMul,
      ufoRate: baseDiff.ufoRate * metaMods.ufoRateMul,
      extraRoidPerWave: metaMods.extraRoidPerWave,

      thrust: baseDiff.thrust * metaMods.thrustMul,
      friction: baseDiff.friction * metaMods.frictionMul,
      maxSpeed: baseDiff.maxSpeed * metaMods.maxSpeedMul,

      laserSpeed: BASE.LASER_SPD * metaMods.laserSpeedMul,
      laserMax: BASE.LASER_MAX + metaMods.laserMaxAdd,
      shootCdMul: metaMods.shootCdMul,

      startShield: metaMods.startShield,
      invulnMul: metaMods.invulnMul,

      dropChanceMul: metaMods.dropChanceMul,
      powerDurMul: metaMods.powerDurMul,

      coresYieldBonus: metaMods.coresYieldAdd,
    };

    ship = newShip();
    if ((game.tuning.startShield ?? 0) > 0) ship.shield = 1;

    game.ufoSpawnT = 6.5;
    createWave();
  }

  function startGameFromMenu(): void {
    game.musicReady = true;

    resetRun();
    game.state = STATE.COUNTDOWN;
    game.countdown = 3.0;
    hideOverlay();

    hudMode.textContent = MODES[settings.mode].label;
    hudDiff.textContent = DIFFS[settings.difficulty].label;

    canv.focus();
    renderPowerbar();
    syncCoresUI();
  }

  function calcCoresEarned(): { cores: number; breakdown: string[] } {
    const breakdown: string[] = [];
    let cores = 0;

    const wave = game.wave + 1;
    const acc = game.shotsFired > 0 ? game.shotsHit / game.shotsFired : 0;

    if (game.score < 400 || wave < 3) {
      return { cores: 0, breakdown: ["Sem Núcleos: run curta demais."] };
    }

    if (wave >= 6) {
      cores += 1;
      breakdown.push("Wave 6+ (+1)");
    }
    if (wave >= 11) {
      cores += 1;
      breakdown.push("Wave 11+ (+1)");
    }
    if (wave >= 16) {
      cores += 1;
      breakdown.push("Wave 16+ (+1)");
    }

    const ufoC = Math.min(2, game.runUfoKills);
    if (ufoC > 0) {
      cores += ufoC;
      breakdown.push(`UFO abatido x${ufoC} (+${ufoC})`);
    }

    if (acc >= 0.7 && game.score >= 2500) {
      cores += 1;
      breakdown.push("Precisão 70%+ e 2500+ pts (+1)");
    }

    if (game.runDeaths === 0 && wave >= 8) {
      cores += 1;
      breakdown.push("Run sem mortes (Wave 8+) (+1)");
    }

    if (settings.mode === "one_life" && wave >= 6) {
      cores += 1;
      breakdown.push("One Life: Wave 6+ (+1)");
    }

    if (settings.mode === "time_attack") {
      if (game.score >= 4000) {
        cores += 2;
        breakdown.push("Time Attack: 4000+ pts (+2)");
      } else if (game.score >= 2500) {
        cores += 1;
        breakdown.push("Time Attack: 2500+ pts (+1)");
      }
    }

    if (settings.difficulty === "hard" && (wave >= 8 || game.score >= 3000)) {
      cores += 1;
      breakdown.push("Hard bônus (+1)");
    }

    const bonus = game.tuning?.coresYieldBonus ?? 0;
    if (bonus > 0 && cores > 0) {
      const extra = Math.floor(cores * bonus);
      if (extra > 0) {
        cores += extra;
        breakdown.push(`Contratos: +${Math.round(bonus * 100)}% (+${extra})`);
      } else {
        breakdown.push(`Contratos ativos (+${Math.round(bonus * 100)}%)`);
      }
    }

    return { cores, breakdown };
  }

  function endGame(reason: "time" | "dead"): void {
    game.state = STATE.GAMEOVER;
    ship.dead = true;

    saveLeaderboard(settings, game.score);

    const earned = calcCoresEarned();
    meta.cores += earned.cores;
    saveMetaLocal();
    syncCoresUI();

    runCoresEl.textContent = String(earned.cores);
    runCoresBreakdownEl.innerHTML = "";
    for (const line of earned.breakdown) {
      const li = document.createElement("li");
      li.textContent = line;
      runCoresBreakdownEl.appendChild(li);
    }

    setOverlay(panelGameOver);
    renderLeaderboard(leaderboardList2, settings);

    const acc = game.shotsFired > 0 ? Math.round((game.shotsHit / game.shotsFired) * 100) : 0;
    const modeLabel = MODES[settings.mode].label;
    const diffLabel = DIFFS[settings.difficulty].label;

    gameOverTitle.textContent = reason === "time" ? "TIME UP!" : "GAME OVER";
    gameOverStats.textContent = `Score ${game.score} | BEST ${game.best} | Acc ${acc}% | ${modeLabel}/${diffLabel}`;
  }

  // =========================
  // Drawing helpers
  // =========================
  function drawShip(x: number, y: number, a: number, colour = "white"): void {
    ctx.strokeStyle = colour;
    ctx.lineWidth = BASE.SHIP_SIZE / 20;
    ctx.beginPath();
    ctx.moveTo(x + (4 / 3) * ship.r * Math.cos(a), y - (4 / 3) * ship.r * Math.sin(a));
    ctx.lineTo(
      x - ship.r * ((2 / 3) * Math.cos(a) + Math.sin(a)),
      y + ship.r * ((2 / 3) * Math.sin(a) - Math.cos(a))
    );
    ctx.lineTo(
      x - ship.r * ((2 / 3) * Math.cos(a) - Math.sin(a)),
      y + ship.r * ((2 / 3) * Math.sin(a) + Math.cos(a))
    );
    ctx.closePath();
    ctx.stroke();
  }

  function drawHUD(): void {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "white";
    ctx.font = "24px dejavu sans mono";
    ctx.fillText(String(game.score), canv.width - BASE.SHIP_SIZE / 2, BASE.SHIP_SIZE);

    ctx.textAlign = "center";
    ctx.font = "18px dejavu sans mono";
    ctx.fillText("BEST " + game.best, canv.width / 2, BASE.SHIP_SIZE);

    for (let i = 0; i < game.lives; i++) {
      const lifeColour = ship.explodeTime > 0 && i === game.lives - 1 ? "red" : "white";
      drawShip(BASE.SHIP_SIZE + i * BASE.SHIP_SIZE * 1.2, BASE.SHIP_SIZE, 0.5 * Math.PI, lifeColour);
    }

    ctx.textAlign = "left";
    ctx.font = "16px dejavu sans mono";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`WAVE ${game.wave + 1}`, 10, canv.height - 16);

    ctx.textAlign = "right";
    ctx.fillText(`x${game.comboMult}`, canv.width - 10, canv.height - 16);

    if (game.timeLeft != null) {
      ctx.textAlign = "left";
      const t = Math.max(0, game.timeLeft);
      const mm = String(Math.floor(t / 60)).padStart(1, "0");
      const ss = String(Math.floor(t % 60)).padStart(2, "0");
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.fillText(`${mm}:${ss}`, 10, 18);
    }

    if (settings.showFPS) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "12px dejavu sans mono";
      ctx.fillText(`FPS ${game.fpsValue}`, 10, canv.height - 34);
    }

    if (ship.shield > 0 && !ship.dead) {
      ctx.save();
      ctx.strokeStyle = "rgba(67,255,122,0.85)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(67,255,122,0.45)";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCenterText(msg: string, alpha: number, y: number): void {
    if (!msg || alpha <= 0) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = "small-caps 40px dejavu sans mono";
    ctx.fillText(msg, canv.width / 2, y);
  }

  // =========================
  // Input
  // =========================
  document.addEventListener("keydown", (ev) => {
    preventScrollKeys(ev);

    if (game.state === STATE.MENU) {
      if (ev.code === "Space" || ev.key === "Enter") startGameFromMenu();
      if (ev.key.toLowerCase() === "f") settings.showFPS = !settings.showFPS;
      return;
    }

    if (ev.key === "Escape" || ev.key.toLowerCase() === "p") {
      togglePause();
      return;
    }

    if (ev.key.toLowerCase() === "f") {
      settings.showFPS = !settings.showFPS;
      return;
    }

    if (game.state !== STATE.PLAYING && game.state !== STATE.COUNTDOWN && game.state !== STATE.WAVE_CLEAR) return;
    if (ship.dead) return;

    // eslint-disable-next-line deprecation/deprecation
    switch (ev.keyCode) {
      case 37:
        ship.rotTarget = ((BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS;
        break;
      case 39:
        ship.rotTarget = ((-BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS;
        break;
      case 38:
        ship.thrusting = true;
        break;
      case 32:
        ship.shooting = true;
        break;
    }
  });

  document.addEventListener("keyup", (ev) => {
    preventScrollKeys(ev);

    if (ship.dead) return;

    // eslint-disable-next-line deprecation/deprecation
    switch (ev.keyCode) {
      case 37:
      case 39:
        ship.rotTarget = 0;
        break;
      case 38:
        ship.thrusting = false;
        break;
      case 32:
        ship.shooting = false;
        break;
    }
  });

  function bindHold(btn: HTMLElement, onDown: () => void, onUp: () => void): void {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      onDown();
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      onUp();
    };
    btn.addEventListener("pointerdown", down, { passive: false });
    btn.addEventListener("pointerup", up, { passive: false });
    btn.addEventListener("pointercancel", up, { passive: false });
    btn.addEventListener("pointerleave", up, { passive: false });
  }

  bindHold(
    btnLeft,
    () => (ship.rotTarget = ((BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS),
    () => (ship.rotTarget = 0)
  );
  bindHold(
    btnRight,
    () => (ship.rotTarget = ((-BASE.TURN_SPEED_DEG / 180) * Math.PI) / FPS),
    () => (ship.rotTarget = 0)
  );
  bindHold(btnThrust, () => (ship.thrusting = true), () => (ship.thrusting = false));
  bindHold(btnFire, () => (ship.shooting = true), () => (ship.shooting = false));

  canv.addEventListener("pointerdown", () => canv.focus(), { passive: true });

  // =========================
  // Pause / UI actions
  // =========================
  function togglePause(): void {
    if (game.state === STATE.PLAYING) {
      game.state = STATE.PAUSED;
      setOverlay(panelPause);
    } else if (game.state === STATE.PAUSED) {
      game.state = STATE.PLAYING;
      hideOverlay();
      canv.focus();
    }
  }

  btnResume.addEventListener("click", () => {
    if (game.state === STATE.PAUSED) togglePause();
  });

  btnRestart.addEventListener("click", () => {
    resetRun();
    game.state = STATE.COUNTDOWN;
    game.countdown = 3.0;
    hideOverlay();
    canv.focus();
  });

  btnQuit.addEventListener("click", () => {
    showMenu();
  });

  btnPlay.addEventListener("click", startGameFromMenu);

  btnAgain.addEventListener("click", () => {
    hideOverlay();
    startGameFromMenu();
  });

  btnBackMenu.addEventListener("click", () => {
    showMenu();
  });

  btnShowLeaderboard.addEventListener("click", () => {
    leaderboard.classList.toggle("hidden");
    renderLeaderboard(leaderboardList, settings);
  });

  btnSettings.addEventListener("click", () => openSettings());
  btnCloseSettings.addEventListener("click", () => closeSettings());

  function openSettings(): void {
    setOverlay(panelSettings);
    chkMusic.checked = settings.musicOn;
    chkSfx.checked = settings.sfxOn;
    rngMusic.value = String(settings.musicVolume);
    rngSfx.value = String(settings.sfxVolume);
    chkReduceFlashes.checked = settings.reduceFlashes;
    chkTouch.checked = settings.forceTouch;
    syncAllVolumes();
  }

  function closeSettings(): void {
    if (game.state === STATE.MENU) setOverlay(panelMenu);
    else if (game.state === STATE.PAUSED) setOverlay(panelPause);
    else {
      hideOverlay();
      canv.focus();
    }
  }

  chkMusic.addEventListener("change", () => {
    settings.musicOn = chkMusic.checked;
    syncAllVolumes();
  });

  chkSfx.addEventListener("change", () => {
    settings.sfxOn = chkSfx.checked;
    syncAllVolumes();
  });

  rngMusic.addEventListener("input", () => {
    settings.musicVolume = parseFloat(rngMusic.value);
    syncAllVolumes();
  });

  rngSfx.addEventListener("input", () => {
    settings.sfxVolume = parseFloat(rngSfx.value);
    syncAllVolumes();
  });

  chkReduceFlashes.addEventListener("change", () => {
    settings.reduceFlashes = chkReduceFlashes.checked;
  });

  chkTouch.addEventListener("change", () => {
    settings.forceTouch = chkTouch.checked;
    refreshTouchVisibility();
  });

  selMode.addEventListener("change", () => {
    const v = selMode.value as ModeKey;
    settings.mode = v;
    hudMode.textContent = MODES[settings.mode].label;
    renderLeaderboard(leaderboardList, settings);
  });

  selDiff.addEventListener("change", () => {
    const v = selDiff.value as DiffKey;
    settings.difficulty = v;
    hudDiff.textContent = DIFFS[settings.difficulty].label;
    renderLeaderboard(leaderboardList, settings);
  });

  function refreshTouchVisibility(): void {
    const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const show = settings.forceTouch || isCoarse;
    touch.classList.toggle("hidden", !show);
  }

  // fullscreen
  (() => {
    if (!document.documentElement.requestFullscreen) {
      btnFullscreen.style.display = "none";
      return;
    }

    function syncLabel(): void {
      btnFullscreen.textContent = document.fullscreenElement ? "SAIR" : "FULLSCREEN";
    }

    btnFullscreen.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch {
        // ignore
      }
      syncLabel();
    });

    document.addEventListener("fullscreenchange", syncLabel);
    syncLabel();
  })();

  // =========================
  // Skill Tree UI
  // =========================
  let selectedSkillId: string | null = null;

  function canUnlockSkill(s: Skill): boolean {
    if (hasSkill(s.id)) return false;
    if (meta.cores < s.cost) return false;
    return (s.req || []).every(hasSkill);
  }

  function renderActiveMods(): void {
    const m = computeMetaModsLocal();
    const parts = [
      `Thrust x${m.thrustMul.toFixed(2)}`,
      `Friction x${m.frictionMul.toFixed(2)}`,
      `MaxSpeed x${m.maxSpeedMul.toFixed(2)}`,
      `LaserSpeed x${m.laserSpeedMul.toFixed(2)}`,
      `ShootCD x${m.shootCdMul.toFixed(2)}`,
      `LaserMax +${m.laserMaxAdd}`,
      `PowerDur x${m.powerDurMul.toFixed(2)}`,
      `Invuln x${m.invulnMul.toFixed(2)}`,
      `DropChance x${m.dropChanceMul.toFixed(2)}`,
      `StartShield +${m.startShield}`,
      `Contracts: RoidSpeed x${m.roidSpeedMul.toFixed(2)}, UFO x${m.ufoRateMul.toFixed(
        2
      )}, +Roid/Wave ${m.extraRoidPerWave}, CoresYield +${Math.round(m.coresYieldAdd * 100)}%`,
    ];
    activeModsEl.textContent = parts.join(" | ");
  }

  function renderSkillTree(): void {
    syncCoresUI();
    renderActiveMods();

    skillsGrid.innerHTML = "";

    for (const s of SKILLS) {
      const unlocked = hasSkill(s.id);
      const available = canUnlockSkill(s);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = [
        "skillNode",
        unlocked ? "skillNode--unlocked" : "skillNode--locked",
        available ? "skillNode--available" : "",
        selectedSkillId === s.id ? "skillNode--selected" : "",
      ]
        .filter(Boolean)
        .join(" ");

      btn.dataset.skillId = s.id;

      btn.innerHTML = `
        <div class="skillNode__icon">${s.icon}</div>
        <div class="skillNode__name">${s.name}</div>
        <div class="skillNode__cost">${unlocked ? "OWNED" : `CUSTO ${s.cost}`}</div>
      `;

      btn.addEventListener("click", () => selectSkill(s.id));
      skillsGrid.appendChild(btn);
    }

    requestAnimationFrame(drawSkillLines);
  }

  function selectSkill(id: string): void {
    selectedSkillId = id;
    const s = SKILLS.find((x) => x.id === id);
    if (!s) return;

    skillTitle.textContent = `${s.icon} ${s.name}`;
    skillDesc.textContent = s.desc;
    skillCost.textContent = s.cost === 0 ? "—" : String(s.cost);
    skillType.textContent = s.type;

    const unlocked = hasSkill(s.id);
    const ok = canUnlockSkill(s);

    btnUnlockSkill.disabled = unlocked || !ok;

    if (unlocked) skillHint.textContent = "Você já possui esta habilidade.";
    else if (!ok) {
      const missingReq = (s.req || []).filter((r) => !hasSkill(r));
      if (meta.cores < s.cost) skillHint.textContent = "Núcleos insuficientes.";
      else skillHint.textContent = `Requer: ${missingReq.join(", ") || "—"}.`;
    } else {
      skillHint.textContent = "Disponível para desbloqueio.";
    }

    renderSkillTree();
  }

  function drawSkillLines(): void {
    skillsLines.innerHTML = "";

    const wrapEl = skillsGrid;
    const nodes = Array.from(wrapEl.querySelectorAll<HTMLButtonElement>(".skillNode"));
    const rectWrap = wrapEl.getBoundingClientRect();

    function centerOf(elBtn: HTMLElement): { x: number; y: number } {
      const r = elBtn.getBoundingClientRect();
      return {
        x: r.left - rectWrap.left + r.width / 2,
        y: r.top - rectWrap.top + r.height / 2,
      };
    }

    const map = new Map<string, HTMLElement>();
    for (const n of nodes) {
      const id = n.dataset.skillId;
      if (id) map.set(id, n);
    }

    for (const s of SKILLS) {
      if (!s.req || s.req.length === 0) continue;
      const toEl = map.get(s.id);
      if (!toEl) continue;

      for (const req of s.req) {
        const fromEl = map.get(req);
        if (!fromEl) continue;

        const a = centerOf(fromEl);
        const b = centerOf(toEl);

        const unlocked = hasSkill(s.id) && hasSkill(req);
        const stroke = unlocked ? "rgba(67,255,122,0.35)" : "rgba(255,255,255,0.16)";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const midX = (a.x + b.x) / 2;
        const d = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        skillsLines.appendChild(path);
      }
    }
  }

  function openSkills(): void {
    setOverlay(panelSkills);
    renderSkillTree();
    if (!selectedSkillId) selectSkill("core");
  }

  function closeSkills(): void {
    if (game.state === STATE.MENU) setOverlay(panelMenu);
    else if (game.state === STATE.PAUSED) setOverlay(panelPause);
    else hideOverlay();
  }

  btnSkills.addEventListener("click", openSkills);
  btnCloseSkills.addEventListener("click", closeSkills);

  btnUnlockSkill.addEventListener("click", () => {
    const s = SKILLS.find((x) => x.id === selectedSkillId);
    if (!s) return;
    if (!canUnlockSkill(s)) return;

    meta.cores -= s.cost;
    meta.unlocked[s.id] = true;
    saveMetaLocal();
    syncCoresUI();
    renderSkillTree();
    selectSkill(s.id);
  });

  // =========================
  // Init / Menu
  // =========================
  function init(): void {
    loadBest();
    syncAllVolumes();
    refreshTouchVisibility();

    settings.mode = selMode.value as ModeKey;
    settings.difficulty = selDiff.value as DiffKey;

    hudMode.textContent = MODES[settings.mode].label;
    hudDiff.textContent = DIFFS[settings.difficulty].label;

    game.state = STATE.MENU;
    showMenu();
    syncCoresUI();

    setInterval(update, 1000 / FPS);
  }

  function showMenu(): void {
    game.state = STATE.MENU;
    setOverlay(panelMenu);
    leaderboard.classList.add("hidden");
    renderLeaderboard(leaderboardList, settings);

    hudMode.textContent = MODES[settings.mode].label;
    hudDiff.textContent = DIFFS[settings.difficulty].label;

    despawnUfo();
    renderPowerbar();
    syncCoresUI();
  }

  // =========================
  // Update loop
  // =========================
  function update(): void {
    game.fpsAcc += DT;
    game.fpsFrames++;
    if (game.fpsAcc >= 1) {
      game.fpsValue = game.fpsFrames;
      game.fpsFrames = 0;
      game.fpsAcc = 0;
    }

    draw();

    if (game.state === STATE.PAUSED || game.state === STATE.MENU || game.state === STATE.GAMEOVER) return;

    music.tick(game.musicReady);

    if (game.state === STATE.COUNTDOWN) {
      game.countdown -= DT;
      if (game.countdown <= 0) {
        game.state = STATE.PLAYING;
        game.text = "";
        game.textAlpha = 0;
      }
      return;
    }

    if (game.state === STATE.WAVE_CLEAR) {
      game.countdown -= DT;
      if (game.countdown <= 0) {
        game.wave++;
        createWave();
        game.state = STATE.COUNTDOWN;
        game.countdown = 3.0;
        addFloater(canv.width / 2, canv.height * 0.42, `WAVE ${game.wave + 1}`, "#27f3ff", 1.2);
      }
      return;
    }

    const ts = timeScale();

    if (game.timeLeft != null) {
      game.timeLeft -= DT;
      if (game.timeLeft <= 0) {
        endGame("time");
        return;
      }
    }

    if (game.comboTime > 0) {
      game.comboTime -= DT;
      if (game.comboTime <= 0) resetCombo();
    }

    for (const k of ACTIVE_POWER_KEYS) {
      if (activePower[k] > 0) activePower[k] = Math.max(0, activePower[k] - DT);
    }
    renderPowerbar();

    ship.rot += (ship.rotTarget - ship.rot) * 0.35;
    ship.shootCd = Math.max(0, ship.shootCd - DT);
    ship.tookHitGrace = Math.max(0, ship.tookHitGrace - DT);

    const tun = game.tuning ?? (DIFFS[settings.difficulty] as unknown as Tuning);

    if (ship.thrusting && !ship.dead) {
      ship.thrust.x += (tun.thrust * Math.cos(ship.a)) / FPS;
      ship.thrust.y -= (tun.thrust * Math.sin(ship.a)) / FPS;
      fxThrust.play();
    } else {
      ship.thrust.x -= (tun.friction * ship.thrust.x) / FPS;
      ship.thrust.y -= (tun.friction * ship.thrust.y) / FPS;
      fxThrust.stop();
    }

    const spd = Math.hypot(ship.thrust.x, ship.thrust.y);
    const max = tun.maxSpeed;
    if (spd > max) {
      ship.thrust.x = (ship.thrust.x / spd) * max;
      ship.thrust.y = (ship.thrust.y / spd) * max;
    }

    if (ship.shooting && !ship.dead) shootLaser();

    const exploding = ship.explodeTime > 0;
    if (!exploding && !ship.dead) {
      ship.a += ship.rot * ts;
      ship.x += ship.thrust.x * ts;
      ship.y += ship.thrust.y * ts;
      wrap(ship);
    } else if (exploding) {
      ship.explodeTime--;
      if (ship.explodeTime === 0) {
        game.lives--;
        game.runDeaths++;

        if (game.lives <= 0) {
          endGame("dead");
          return;
        }
        ship = newShip();
        resetCombo();
      }
    }

    if (ship.blinkNum > 0 && !ship.dead) {
      ship.blinkTime--;
      if (ship.blinkTime === 0) {
        ship.blinkTime = Math.ceil(BASE.SHIP_BLINK_DUR * FPS);
        ship.blinkNum--;
      }
    }

    // lasers
    for (let i = ship.lasers.length - 1; i >= 0; i--) {
      const l = ship.lasers[i];

      if (l.dist > BASE.LASER_DIST * canv.width) {
        if (!l.hit) game.hitStreak = 0;
        ship.lasers.splice(i, 1);
        continue;
      }

      if (l.explodeTime > 0) {
        l.explodeTime--;
        if (l.explodeTime === 0) {
          ship.lasers.splice(i, 1);
          continue;
        }
      } else {
        l.x += l.xv * ts;
        l.y += l.yv * ts;
        l.dist += Math.hypot(l.xv, l.yv) * ts;

        l.trail.push({ x: l.x, y: l.y });
        if (l.trail.length > 7) l.trail.shift();
      }

      if (l.x < 0) l.x = canv.width;
      else if (l.x > canv.width) l.x = 0;

      if (l.y < 0) l.y = canv.height;
      else if (l.y > canv.height) l.y = 0;
    }

    // roids
    for (const r of game.roids) {
      r.x += r.xv * ts;
      r.y += r.yv * ts;
      wrap(r);
    }

    // particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.life -= DT;
      if (p.life <= 0) {
        game.particles.splice(i, 1);
        continue;
      }
      p.x += p.xv * ts;
      p.y += p.yv * ts;
    }

    // floaters
    for (let i = game.floaters.length - 1; i >= 0; i--) {
      const f = game.floaters[i];
      f.life -= DT;
      if (f.life <= 0) {
        game.floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy * ts;
    }

    // power drops
    for (let i = game.powerDrops.length - 1; i >= 0; i--) {
      const p = game.powerDrops[i];
      p.life -= DT;
      if (p.life <= 0) {
        game.powerDrops.splice(i, 1);
        continue;
      }
      p.x += p.xv * ts;
      p.y += p.yv * ts;

      if (p.x < 0) p.x = canv.width;
      else if (p.x > canv.width) p.x = 0;
      if (p.y < 0) p.y = canv.height;
      else if (p.y > canv.height) p.y = 0;

      if (!ship.dead && dist(ship.x, ship.y, p.x, p.y) < ship.r + p.r + 4) {
        applyPowerup(p.type);
        game.powerDrops.splice(i, 1);
      }
    }

    // UFO spawn
    game.ufoSpawnT -= DT;
    if (!game.ufo && game.ufoSpawnT <= 0) {
      const next = 10 - Math.min(6, game.wave * 0.5);
      game.ufoSpawnT = clamp(next / getUfoRate(), 3.5, 12);

      const chance = 0.25 + Math.min(0.35, game.wave * 0.03) + Math.min(0.2, game.score / 1200);
      if (Math.random() < chance) spawnUfo();
    }

    // UFO update
    if (game.ufo) {
      const u = game.ufo;
      u.life -= DT;
      u.x += u.xv * ts;

      u.shootT -= DT;
      if (u.shootT <= 0) {
        u.shootT = 0.9 + Math.random() * (u.small ? 0.8 : 1.1);
        ufoShoot();
      }

      if (u.life <= 0 || (u.dir === 1 && u.x > canv.width + 60) || (u.dir === -1 && u.x < -60)) {
        despawnUfo();
      }
    }

    // UFO bullets
    for (let i = game.ufoBullets.length - 1; i >= 0; i--) {
      const b = game.ufoBullets[i];
      b.life -= DT;
      if (b.life <= 0) {
        game.ufoBullets.splice(i, 1);
        continue;
      }
      b.x += b.xv * ts;
      b.y += b.yv * ts;

      if (b.x < 0) b.x = canv.width;
      else if (b.x > canv.width) b.x = 0;
      if (b.y < 0) b.y = canv.height;
      else if (b.y > canv.height) b.y = 0;

      if (!ship.dead && ship.explodeTime === 0 && ship.blinkNum === 0 && ship.tookHitGrace <= 0) {
        if (dist(ship.x, ship.y, b.x, b.y) < ship.r + b.r) {
          game.ufoBullets.splice(i, 1);
          if (ship.shield > 0) {
            ship.shield = 0;
            ship.tookHitGrace = 0.35;
            doShake(6, 0.16);
            addFloater(ship.x, ship.y, "SHIELD BROKE", "#43ff7a", 0.9);
            resetCombo();
          } else {
            resetCombo();
            explodeShip();
          }
        }
      }
    }

    // laser hits asteroid
    for (let i = game.roids.length - 1; i >= 0; i--) {
      const a = game.roids[i];
      for (let j = ship.lasers.length - 1; j >= 0; j--) {
        const l = ship.lasers[j];
        if (l.explodeTime !== 0) continue;
        if (dist(a.x, a.y, l.x, l.y) < a.r) {
          l.hit = true;
          destroyAsteroid(i, l.x, l.y);
          l.explodeTime = Math.ceil(BASE.LASER_EXPLODE_DUR * FPS);
          break;
        }
      }
    }

    // laser hits UFO
    if (game.ufo) {
      for (let j = ship.lasers.length - 1; j >= 0; j--) {
        const l = ship.lasers[j];
        if (l.explodeTime !== 0) continue;
        if (dist(game.ufo.x, game.ufo.y, l.x, l.y) < game.ufo.r + 2) {
          l.hit = true;
          fxUfoHit.play();
          doShake(9, 0.22);
          doFlash(0.35);

          spawnParticles(game.ufo.x, game.ufo.y, 70, "#ff2bd6", 360, 0.25, 1.1, 1.1, 2.8);
          addScore(ufoScore(), game.ufo.x, game.ufo.y);
          bumpCombo();
          precisionHit();

          game.runUfoKills++;

          l.explodeTime = Math.ceil(BASE.LASER_EXPLODE_DUR * FPS);
          despawnUfo();
          break;
        }
      }
    }

    // ship collides asteroid
    if (!exploding && !ship.dead && ship.blinkNum === 0 && ship.tookHitGrace <= 0) {
      for (let i = 0; i < game.roids.length; i++) {
        const a = game.roids[i];
        if (dist(ship.x, ship.y, a.x, a.y) < ship.r + a.r) {
          if (ship.shield > 0) {
            ship.shield = 0;
            ship.tookHitGrace = 0.35;
            doShake(7, 0.18);
            doFlash(0.22);
            addFloater(ship.x, ship.y, "SHIELD BROKE", "#43ff7a", 0.9);
            resetCombo();
            ship.thrust.x *= -0.4;
            ship.thrust.y *= -0.4;
            break;
          }

          resetCombo();
          explodeShip();
          destroyAsteroid(i, ship.x, ship.y);
          break;
        }
      }
    }
  }

  // =========================
  // Render
  // =========================
  function draw(): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canv.width, canv.height);

    ctx.save();
    if (game.shakeTime > 0) {
      game.shakeTime = Math.max(0, game.shakeTime - DT);
      const k = game.shakeTime / 0.4;
      const mag = game.shakeMag * (0.35 + k);
      const dx = (Math.random() * 2 - 1) * mag;
      const dy = (Math.random() * 2 - 1) * mag;
      ctx.translate(dx, dy);
      if (game.shakeTime === 0) game.shakeMag = 0;
    }

    for (const p of game.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = withAlpha(p.color, 0.85 * a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of game.roids) {
      const isL = r.r >= Math.ceil(BASE.ROID_SIZE / 2);
      const isM = r.r >= Math.ceil(BASE.ROID_SIZE / 4) && r.r < Math.ceil(BASE.ROID_SIZE / 2);

      const stroke = isL
        ? "rgba(200,210,215,0.85)"
        : isM
        ? "rgba(190,200,210,0.85)"
        : "rgba(160,190,220,0.92)";
      const glow = isL ? "rgba(39,243,255,0.18)" : isM ? "rgba(255,43,214,0.14)" : "rgba(67,255,122,0.14)";

      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = BASE.SHIP_SIZE / 20;
      ctx.shadowBlur = 10;
      ctx.shadowColor = glow;

      ctx.beginPath();
      ctx.moveTo(r.x + r.r * Math.cos(r.a), r.y + r.r * Math.sin(r.a));
      for (let j = 1; j < r.vert; j++) {
        ctx.lineTo(
          r.x + r.r * r.offs[j] * Math.cos(r.a + (j * Math.PI * 2) / r.vert),
          r.y + r.r * r.offs[j] * Math.sin(r.a + (j * Math.PI * 2) / r.vert)
        );
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (game.ufo) {
      const u = game.ufo;
      ctx.save();
      ctx.strokeStyle = u.small ? "rgba(255,43,214,0.9)" : "rgba(39,243,255,0.9)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = u.small ? "rgba(255,43,214,0.35)" : "rgba(39,243,255,0.30)";

      ctx.beginPath();
      ctx.ellipse(u.x, u.y, u.r + 8, u.r, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(u.x - (u.r + 10), u.y);
      ctx.lineTo(u.x + (u.r + 10), u.y);
      ctx.stroke();

      ctx.restore();
    }

    for (const b of game.ufoBullets) {
      ctx.save();
      ctx.fillStyle = "rgba(255,43,214,0.9)";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(255,43,214,0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of game.powerDrops) {
      ctx.save();
      ctx.strokeStyle = withAlpha(POWER[p.type].color, 0.9);
      ctx.shadowBlur = 14;
      ctx.shadowColor = withAlpha(POWER[p.type].color, 0.35);
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = withAlpha(POWER[p.type].color, 0.18);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    for (const l of ship.lasers) {
      if (l.trail && l.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 180, 200, 0.35)";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255, 120, 170, 0.25)";
        ctx.beginPath();
        for (let i = 0; i < l.trail.length; i++) {
          const t = l.trail[i];
          if (i === 0) ctx.moveTo(t.x, t.y);
          else ctx.lineTo(t.x, t.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      if (l.explodeTime === 0) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 170, 190, 0.95)";
        ctx.shadowBlur = 16;
        ctx.shadowColor = "rgba(255, 120, 170, 0.35)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, BASE.SHIP_SIZE / 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = "rgba(255, 69, 0, 0.9)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, ship.r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 160, 180, 0.9)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, ship.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const blinkOn = ship.blinkNum % 2 === 0;
    const exploding = ship.explodeTime > 0;

    if (!exploding) {
      if (blinkOn && !ship.dead && game.state !== STATE.MENU) {
        drawShip(ship.x, ship.y, ship.a);
      }
      if (ship.thrusting && blinkOn && !ship.dead) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
        ctx.strokeStyle = "rgba(255, 240, 120, 0.9)";
        ctx.lineWidth = BASE.SHIP_SIZE / 10;
        ctx.shadowBlur = 16;
        ctx.shadowColor = "rgba(255, 180, 120, 0.25)";

        ctx.beginPath();
        ctx.moveTo(
          ship.x - ship.r * ((2 / 3) * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
          ship.y + ship.r * ((2 / 3) * Math.sin(ship.a) - 0.5 * Math.cos(ship.a))
        );
        ctx.lineTo(ship.x - ((ship.r * 6) / 3) * Math.cos(ship.a), ship.y + ((ship.r * 6) / 3) * Math.sin(ship.a));
        ctx.lineTo(
          ship.x - ship.r * ((2 / 3) * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
          ship.y + ship.r * ((2 / 3) * Math.sin(ship.a) + 0.5 * Math.cos(ship.a))
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.fillStyle = "darkred";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "yellow";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const f of game.floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = withAlpha(f.color, 0.9 * a);
      ctx.font = "16px dejavu sans mono";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    if (game.state === STATE.COUNTDOWN) {
      const n = Math.ceil(game.countdown);
      drawCenterText(n > 0 ? String(n) : "GO!", 1.0, canv.height * 0.45);
    }
    if (game.state === STATE.WAVE_CLEAR) {
      drawCenterText("WAVE CLEARED", 0.9, canv.height * 0.45);
      const n = Math.ceil(game.countdown);
      drawCenterText(n > 0 ? String(n) : "GO!", 0.85, canv.height * 0.58);
    }

    drawHUD();

    if (game.flashAlpha > 0) {
      game.flashAlpha = Math.max(0, game.flashAlpha - 0.04);
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${game.flashAlpha})`;
      ctx.fillRect(0, 0, canv.width, canv.height);
      ctx.restore();
    }

    ctx.restore();
  }

  // =========================
  // Boot
  // =========================
  init();

  window.addEventListener("resize", refreshTouchVisibility);

  window.addEventListener("blur", () => {
    if (game.state === STATE.PLAYING) {
      game.state = STATE.PAUSED;
      setOverlay(panelPause);
    }
  });
}
